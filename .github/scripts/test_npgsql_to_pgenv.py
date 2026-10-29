import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(__file__))
from npgsql_to_pgenv import parse  # noqa: E402


class ParseTests(unittest.TestCase):
    def test_render_style_string(self):
        env = parse("Host=aws-1-eu-central-1.pooler.supabase.com;Port=5432;Database=postgres;"
                    "Username=postgres.ref;Password=secret;SSL Mode=Require;Trust Server Certificate=true")
        self.assertEqual(env["PGHOST"], "aws-1-eu-central-1.pooler.supabase.com")
        self.assertEqual(env["PGUSER"], "postgres.ref")
        self.assertEqual(env["PGPASSWORD"], "secret")
        self.assertEqual(env["PGSSLMODE"], "require")

    def test_quoted_password_with_semicolon(self):
        env = parse('Host=h;Username=u;Password="a;b=c"')
        self.assertEqual(env["PGPASSWORD"], "a;b=c")

    def test_defaults_and_aliases(self):
        env = parse("Server=h; User Id=u; Pwd=p")
        self.assertEqual((env["PGHOST"], env["PGUSER"], env["PGPASSWORD"]), ("h", "u", "p"))
        self.assertEqual((env["PGPORT"], env["PGDATABASE"]), ("5432", "postgres"))

    def test_missing_password_fails(self):
        with self.assertRaises(ValueError):
            parse("Host=h;Username=u")


if __name__ == "__main__":
    unittest.main()

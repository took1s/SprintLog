#!/usr/bin/env python3
"""Wandelt einen Npgsql-Connection-String (wie in Render: "Host=...;Username=...;Password=...")
in libpq-Umgebungsvariablen (PGHOST, PGUSER, ...) für pg_dump um.

Liest DB_CONNECTION_STRING aus der Umgebung und schreibt eine Docker-env-Datei (Pfad = 1. Argument).
Das Passwort wird in GitHub Actions maskiert und nie ausgegeben.
"""
import os
import sys
from urllib.parse import unquote, urlsplit, parse_qs

KEYS = {
    "host": "PGHOST", "server": "PGHOST",
    "port": "PGPORT",
    "database": "PGDATABASE", "db": "PGDATABASE",
    "username": "PGUSER", "user id": "PGUSER", "userid": "PGUSER", "user": "PGUSER",
    "password": "PGPASSWORD", "pwd": "PGPASSWORD",
}
SSL = {"require": "require", "verifyfull": "verify-full", "verify-full": "verify-full",
       "verifyca": "verify-ca", "verify-ca": "verify-ca", "prefer": "prefer", "disable": "disable"}


def split_pairs(connection_string: str):
    """Zerlegt "a=1;b=\"x;y\"" in Paare - Werte in Anführungszeichen dürfen ';' enthalten."""
    pairs, key, value, in_key, quote = [], "", "", True, None
    for ch in connection_string + ";":
        if in_key:
            if ch == "=":
                in_key = False
            elif ch == ";":
                key = ""
            else:
                key += ch
        elif quote:
            if ch == quote:
                quote = None
            else:
                value += ch
        elif ch in "\"'" and not value.strip():
            quote = ch
            value = ""
        elif ch == ";":
            pairs.append((key.strip().lower(), value.strip()))
            key, value, in_key = "", "", True
        else:
            value += ch
    return pairs


def parse_uri(uri: str) -> dict:
    """postgresql://user:password@host:5432/db?sslmode=require (Format aus dem Supabase-Dashboard)."""
    u = urlsplit(uri)
    env = {"PGSSLMODE": "require", "PGDATABASE": "postgres", "PGPORT": "5432"}
    if u.hostname:
        env["PGHOST"] = u.hostname
    if u.port:
        env["PGPORT"] = str(u.port)
    if u.username:
        env["PGUSER"] = unquote(u.username)
    if u.password:
        env["PGPASSWORD"] = unquote(u.password)
    if u.path and u.path != "/":
        env["PGDATABASE"] = unquote(u.path.lstrip("/"))
    mode = parse_qs(u.query).get("sslmode")
    if mode:
        env["PGSSLMODE"] = SSL.get(mode[0].lower(), "require")
    return env


def parse(connection_string: str) -> dict:
    if connection_string.lower().startswith(("postgres://", "postgresql://")):
        env = parse_uri(connection_string)
        missing = [k for k in ("PGHOST", "PGUSER", "PGPASSWORD") if k not in env]
        if missing:
            raise ValueError(f"Connection URI is missing: {', '.join(missing)}")
        return env
    env = {"PGSSLMODE": "require", "PGDATABASE": "postgres", "PGPORT": "5432"}
    for key, value in split_pairs(connection_string):
        if key in KEYS:
            env[KEYS[key]] = value
        elif key in ("ssl mode", "sslmode"):
            env["PGSSLMODE"] = SSL.get(value.lower().replace(" ", ""), "require")
    missing = [k for k in ("PGHOST", "PGUSER", "PGPASSWORD") if k not in env]
    if missing:
        keys = sorted({k for k, _ in split_pairs(connection_string)})
        raise ValueError(f"Connection string is missing: {', '.join(missing)}. "
                         f"Found keys: {keys or 'none'} (length {len(connection_string)}). "
                         "Expected 'Host=...;Username=...;Password=...' or 'postgresql://user:pass@host:5432/postgres'.")
    return env


def main() -> int:
    raw = os.environ.get("DB_CONNECTION_STRING", "").strip().strip('"').strip("'")
    # Häufiger Copy-Paste-Fehler: der Variablenname aus Render wurde mitkopiert
    for prefix in ("ConnectionStrings__DefaultConnection=", "DB_CONNECTION_STRING="):
        if raw.startswith(prefix):
            raw = raw[len(prefix):]
    if not raw:
        print("DB_CONNECTION_STRING is empty", file=sys.stderr)
        return 1
    env = parse(raw)
    if os.environ.get("GITHUB_ACTIONS"):
        print(f"::add-mask::{env['PGPASSWORD']}")
    with open(sys.argv[1], "w", encoding="utf-8") as f:
        for key, value in env.items():
            if "\n" in value:
                raise ValueError(f"{key} contains a newline")
            f.write(f"{key}={value}\n")
    summary = f"host={env['PGHOST']} port={env['PGPORT']} db={env['PGDATABASE']} sslmode={env['PGSSLMODE']} user_has_ref={'.' in env['PGUSER']}"
    print(summary)
    if os.environ.get("GITHUB_ACTIONS"):
        print(f"::notice title=Backup target::{summary}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

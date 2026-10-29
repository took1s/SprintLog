-- Erzeugt eine Abfrage "Tabelle|Zeilen" für alle Tabellen im Schema public (sortiert, für diff geeignet).
SELECT string_agg(format('SELECT %L || ''|'' || count(*) FROM public.%I', tablename, tablename), ' UNION ALL ' ORDER BY tablename)
       || ' ORDER BY 1'
FROM pg_tables WHERE schemaname = 'public';

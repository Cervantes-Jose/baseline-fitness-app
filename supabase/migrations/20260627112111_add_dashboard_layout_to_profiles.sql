-- Reconstructed from supabase_migrations.schema_migrations (version 20260627112111).
-- This migration was applied to the remote database (via MCP/dashboard) but the
-- local file was never committed, which breaks `supabase db push`. The statement
-- below is copied verbatim from the remote migration history.

alter table public.profiles add column if not exists dashboard_layout jsonb;

# Task 9a Persona Clip Reaper Runbook

The reaper is a server-only CLI. It requires the local or deployed Supabase URL
and service-role key:

```sh
SUPABASE_URL=... \
SUPABASE_SERVICE_ROLE_KEY=... \
pnpm -F @soulbound/adapters clip:reap
```

Expected output is one line containing only `scanned`, `deleted`, `failed`, and
`deletedAssetIds`. It must never contain a Storage path, signed URL, token, raw
media, transcript, or summary.

For Task 9a acceptance on the host:

1. Run `supabase db reset`.
2. Run `supabase test db` and confirm all 73 pgTAP assertions pass.
3. Export `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
   `SUPABASE_SERVICE_ROLE_KEY` from `supabase status -o env`.
4. Run `pnpm -F @soulbound/adapters test:integration` followed by
   `pnpm -F web test:integration` five consecutive times.
5. Run `pnpm -F @soulbound/adapters clip:reap` once against the reset database.
6. Record all five integration results and the CLI summary for the independent
   Opus/Cowork audit.

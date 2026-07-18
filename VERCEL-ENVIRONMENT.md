# Vercel public Supabase configuration

Project 318 loads its browser-safe Supabase configuration from
`/api/runtime-config`. The endpoint reads two Vercel environment variables and
returns only those two public values. It never returns server credentials.

## Required variables

| Variable | Production | Preview | Development |
| --- | --- | --- | --- |
| `PUBLIC_SUPABASE_URL` | `https://qanetxmyoxpqnwsntmqz.supabase.co` | `https://owsxnyxkgzplvrxaijop.supabase.co` | Staging URL or a local Supabase URL |
| `PUBLIC_SUPABASE_ANON_KEY` | Existing production **public anon** key | Project 318 Staging **public anon** key | Matching staging/local **public anon** key |

Set each value in **Vercel → Project 318 → Settings → Environment Variables**
and select only the environment named in its column. Preview values must not be
copied into Production, and Production values must not be copied into Preview.
Redeploy after changing an environment variable because existing deployments do
not inherit later changes.

Only the public anon key is permitted. Never configure a service-role key,
database password, signed-in access token, refresh token, or other privileged
credential under either public variable.

## Failure behavior

If either required value is missing or the URL is not an HTTPS Supabase project
URL, `/api/runtime-config` returns HTTP 503. The browser does not create a
Supabase client and displays a configuration error instead of falling back to a
different project.

## Local Vercel testing

Use `.env.local` for `vercel dev`; it is excluded by `.gitignore`. Never commit
real values. The checked-in `.env.test.example` remains placeholders only.


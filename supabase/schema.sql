-- CalcShore landing — demo request capture
--
-- Apply by pasting this file into the Supabase SQL editor.
-- Idempotent enough to re-run: creates are guarded with "if not exists".

create table if not exists public.demo_requests (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  name          text not null,
  company       text,
  email         text not null,
  message       text,
  status        text not null default 'new'
                  check (status in ('new', 'contacted', 'scheduled', 'dead')),
  referrer      text,
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  user_agent    text
);

create index if not exists demo_requests_created_at_idx
  on public.demo_requests (created_at desc);

create index if not exists demo_requests_status_idx
  on public.demo_requests (status);

-- RLS is ON and there are DELIBERATELY NO POLICIES.
--
-- This is not an oversight and it is not a bug. The /api/demo-request route
-- handler writes with the Supabase secret key, which bypasses RLS entirely.
-- With RLS enabled and zero policies, every anon / publishable-key request is
-- denied by default -- which is exactly what we want, since nothing in the
-- browser should ever read or write this table.
--
-- Do NOT "fix" this by adding a permissive policy. Adding even a single
-- `for insert to anon with check (true)` policy would expose the table to
-- anyone who reads the publishable key out of the client bundle.
alter table public.demo_requests enable row level security;

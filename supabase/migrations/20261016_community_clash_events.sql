create table if not exists public.community_clash_events (
  guild_id text not null,
  event_id text not null,
  status text not null default 'setup',
  event_data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (guild_id, event_id)
);

alter table public.community_clash_events enable row level security;
revoke all on table public.community_clash_events from anon, authenticated;
grant all on table public.community_clash_events to service_role;

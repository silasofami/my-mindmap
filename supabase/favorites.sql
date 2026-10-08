-- Run in Supabase SQL Editor to add cloud star favorites to an existing project.
alter table public.mindmaps
  add column if not exists is_starred boolean not null default false,
  add column if not exists starred_at timestamptz;

alter table public.folders
  add column if not exists is_starred boolean not null default false,
  add column if not exists starred_at timestamptz;

create index if not exists mindmaps_owner_starred_idx
  on public.mindmaps(owner_id, starred_at desc)
  where is_starred = true and deleted_at is null;

create index if not exists folders_owner_starred_idx
  on public.folders(owner_id, starred_at desc)
  where is_starred = true and deleted_at is null;

-- Run in the Supabase SQL Editor. Safe to re-run.
alter table public.mindmaps
  add column if not exists is_shared boolean not null default false,
  add column if not exists share_id text,
  add column if not exists allow_export boolean not null default false;

alter table public.folders
  add column if not exists is_shared boolean not null default false,
  add column if not exists share_id text,
  add column if not exists allow_export boolean not null default false;

create unique index if not exists mindmaps_share_id_uidx
  on public.mindmaps(share_id) where share_id is not null;
create unique index if not exists folders_share_id_uidx
  on public.folders(share_id) where share_id is not null;
create index if not exists mindmaps_shared_owner_idx
  on public.mindmaps(owner_id, updated_at desc) where is_shared = true;
create index if not exists folders_shared_owner_idx
  on public.folders(owner_id, updated_at desc) where is_shared = true;

grant select on public.mindmaps, public.folders to anon;

drop policy if exists "Public can read shared mindmaps" on public.mindmaps;
create policy "Public can read shared mindmaps" on public.mindmaps
  for select to anon, authenticated
  using (is_shared = true and share_id is not null and deleted_at is null);

drop policy if exists "Public can read shared folders" on public.folders;
create policy "Public can read shared folders" on public.folders
  for select to anon, authenticated
  using (is_shared = true and share_id is not null and deleted_at is null);

notify pgrst, 'reload schema';

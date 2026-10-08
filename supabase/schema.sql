-- Run this in the Supabase SQL Editor. The script is safe to re-run.
create table if not exists public.folders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.folders(id) on delete cascade,
  title text not null check (length(btrim(title)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint folders_not_own_parent check (parent_id is null or parent_id <> id)
);

create index if not exists folders_owner_parent_idx on public.folders(owner_id, parent_id);
alter table public.folders add column if not exists deleted_at timestamptz;
alter table public.folders add column if not exists deleted_parent_id uuid;
alter table public.folders add column if not exists trash_batch_id uuid;
alter table public.folders add column if not exists is_starred boolean not null default false;
alter table public.folders add column if not exists starred_at timestamptz;
create index if not exists folders_owner_deleted_idx on public.folders(owner_id, deleted_at) where deleted_at is not null;
alter table public.folders enable row level security;
alter table public.folders replica identity full;
revoke all on public.folders from anon;
grant select, insert, update, delete on public.folders to authenticated;

drop policy if exists "Users can read their own folders" on public.folders;
create policy "Users can read their own folders" on public.folders
  for select to authenticated using ((select auth.uid()) = owner_id);
drop policy if exists "Users can create their own folders" on public.folders;
create policy "Users can create their own folders" on public.folders
  for insert to authenticated with check ((select auth.uid()) = owner_id);
drop policy if exists "Users can update their own folders" on public.folders;
create policy "Users can update their own folders" on public.folders
  for update to authenticated using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
drop policy if exists "Users can delete their own folders" on public.folders;
create policy "Users can delete their own folders" on public.folders
  for delete to authenticated using ((select auth.uid()) = owner_id);

create table if not exists public.mindmaps (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '未命名导图',
  content jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.mindmaps add column if not exists folder_id uuid;
alter table public.mindmaps add column if not exists deleted_at timestamptz;
alter table public.mindmaps add column if not exists deleted_folder_id uuid;
alter table public.mindmaps add column if not exists trash_batch_id uuid;
alter table public.mindmaps add column if not exists is_starred boolean not null default false;
alter table public.mindmaps add column if not exists starred_at timestamptz;
do $$ begin
  alter table public.mindmaps add constraint mindmaps_folder_id_fkey
    foreign key (folder_id) references public.folders(id) on delete set null;
exception when duplicate_object then null;
end $$;
create index if not exists mindmaps_owner_folder_idx on public.mindmaps(owner_id, folder_id);
create index if not exists mindmaps_owner_deleted_idx on public.mindmaps(owner_id, deleted_at) where deleted_at is not null;

alter table public.mindmaps enable row level security;
alter table public.mindmaps replica identity full;
revoke all on public.mindmaps from anon;
grant select, insert, update, delete on public.mindmaps to authenticated;

drop policy if exists "Users can read their own mindmaps" on public.mindmaps;
create policy "Users can read their own mindmaps"
  on public.mindmaps for select to authenticated
  using ((select auth.uid()) = owner_id);
drop policy if exists "Users can create their own mindmaps" on public.mindmaps;
create policy "Users can create their own mindmaps"
  on public.mindmaps for insert to authenticated
  with check ((select auth.uid()) = owner_id);
drop policy if exists "Users can update their own mindmaps" on public.mindmaps;
create policy "Users can update their own mindmaps"
  on public.mindmaps for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
drop policy if exists "Users can delete their own mindmaps" on public.mindmaps;
create policy "Users can delete their own mindmaps"
  on public.mindmaps for delete to authenticated
  using ((select auth.uid()) = owner_id);

-- Independent, owner-scoped full snapshots for the editor's Version History.
create table if not exists public.mindmap_versions (
  id uuid primary key default gen_random_uuid(),
  mindmap_id uuid not null references public.mindmaps(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  version_name text not null default '手动保存',
  created_at timestamptz not null default now(),
  snapshot_data jsonb not null,
  thumbnail text
);
create index if not exists mindmap_versions_owner_map_created_idx
  on public.mindmap_versions(owner_id, mindmap_id, created_at desc);
alter table public.mindmap_versions enable row level security;
revoke all on public.mindmap_versions from anon;
grant select, insert, update, delete on public.mindmap_versions to authenticated;
drop policy if exists "Users can read their own mindmap versions" on public.mindmap_versions;
create policy "Users can read their own mindmap versions"
  on public.mindmap_versions for select to authenticated
  using ((select auth.uid()) = owner_id and exists (
    select 1 from public.mindmaps m where m.id = mindmap_id and m.owner_id = (select auth.uid())
  ));
drop policy if exists "Users can create their own mindmap versions" on public.mindmap_versions;
create policy "Users can create their own mindmap versions"
  on public.mindmap_versions for insert to authenticated
  with check ((select auth.uid()) = owner_id and exists (
    select 1 from public.mindmaps m where m.id = mindmap_id and m.owner_id = (select auth.uid())
  ));
drop policy if exists "Users can update their own mindmap versions" on public.mindmap_versions;
create policy "Users can update their own mindmap versions"
  on public.mindmap_versions for update to authenticated
  using ((select auth.uid()) = owner_id and exists (
    select 1 from public.mindmaps m where m.id = mindmap_id and m.owner_id = (select auth.uid())
  ))
  with check ((select auth.uid()) = owner_id and exists (
    select 1 from public.mindmaps m where m.id = mindmap_id and m.owner_id = (select auth.uid())
  ));
drop policy if exists "Users can delete their own mindmap versions" on public.mindmap_versions;
create policy "Users can delete their own mindmap versions"
  on public.mindmap_versions for delete to authenticated
  using ((select auth.uid()) = owner_id and exists (
    select 1 from public.mindmaps m where m.id = mindmap_id and m.owner_id = (select auth.uid())
  ));

-- RLS on folders protects reads and writes. This trigger additionally prevents
-- a user from attaching their mindmap to a folder owned by another account.
create or replace function public.ensure_mindmap_folder_owner()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.folder_id is not null and not exists (
    select 1 from public.folders f
    where f.id = new.folder_id and f.owner_id = new.owner_id
  ) then
    raise exception 'folder must belong to the same owner as the mindmap';
  end if;
  return new;
end;
$$;
drop trigger if exists mindmaps_folder_owner_guard on public.mindmaps;
create trigger mindmaps_folder_owner_guard
  before insert or update of folder_id, owner_id on public.mindmaps
  for each row execute function public.ensure_mindmap_folder_owner();
revoke all on function public.ensure_mindmap_folder_owner() from public, anon, authenticated;

-- Folder parent links must also stay within one owner.
create or replace function public.ensure_folder_parent_owner()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.parent_id is not null and not exists (
    select 1 from public.folders p
    where p.id = new.parent_id and p.owner_id = new.owner_id
  ) then
    raise exception 'parent folder must belong to the same owner';
  end if;
  return new;
end;
$$;
drop trigger if exists folders_parent_owner_guard on public.folders;
create trigger folders_parent_owner_guard
  before insert or update of parent_id, owner_id on public.folders
  for each row execute function public.ensure_folder_parent_owner();
revoke all on function public.ensure_folder_parent_owner() from public, anon, authenticated;

do $$ begin
  alter publication supabase_realtime add table public.mindmaps;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.folders;
exception when duplicate_object then null;
end $$;

-- Make newly created tables/columns visible to the Supabase Data API immediately.
notify pgrst, 'reload schema';

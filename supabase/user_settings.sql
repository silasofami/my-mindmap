-- Run in the Supabase SQL Editor. Safe to execute repeatedly.
create table if not exists public.user_settings (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  nickname text,
  theme_mode text not null default 'light'
    check (theme_mode in ('light', 'dark', 'system')),
  paste_multiline_strategy text not null default 'confirm_split'
    check (paste_multiline_strategy in ('single_node', 'confirm_split')),
  share_allow_export_default boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;
revoke all on public.user_settings from anon;
grant select, insert, update on public.user_settings to authenticated;

drop policy if exists "Users can read their own settings" on public.user_settings;
create policy "Users can read their own settings"
  on public.user_settings for select to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "Users can create their own settings" on public.user_settings;
create policy "Users can create their own settings"
  on public.user_settings for insert to authenticated
  with check ((select auth.uid()) = owner_id);

drop policy if exists "Users can update their own settings" on public.user_settings;
create policy "Users can update their own settings"
  on public.user_settings for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create or replace function public.set_user_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_settings_set_updated_at on public.user_settings;
create trigger user_settings_set_updated_at
  before update on public.user_settings
  for each row execute function public.set_user_settings_updated_at();

notify pgrst, 'reload schema';

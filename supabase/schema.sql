-- Ideos: schema đồng bộ cho Supabase.
-- Dán toàn bộ file này vào Supabase Dashboard → SQL Editor → Run. Chạy lại nhiều lần vẫn an toàn.

create table if not exists public.ideas (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  data jsonb,
  updated_at bigint not null,
  deleted boolean not null default false,
  server_updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, id)
);
create index if not exists ideas_pull_idx on public.ideas (user_id, server_updated_at);

create table if not exists public.attachments (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  idea_id text not null,
  type text not null,
  mime text not null,
  duration double precision,
  created_at bigint not null,
  deleted boolean not null default false,
  server_updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, id)
);
create index if not exists attachments_pull_idx on public.attachments (user_id, server_updated_at);

-- Bản mới hơn thắng: bỏ qua bản ghi cũ hơn bản đang có; luôn gán lại thời điểm server.
create or replace function public.ideos_ideas_lww() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return null;
  end if;
  new.server_updated_at := clock_timestamp();
  return new;
end $$;

create or replace function public.ideos_touch() returns trigger
language plpgsql as $$
begin
  new.server_updated_at := clock_timestamp();
  return new;
end $$;

drop trigger if exists ideas_lww on public.ideas;
create trigger ideas_lww before insert or update on public.ideas
  for each row execute function public.ideos_ideas_lww();

drop trigger if exists attachments_touch on public.attachments;
create trigger attachments_touch before insert or update on public.attachments
  for each row execute function public.ideos_touch();

-- Mỗi người chỉ thấy và sửa được dữ liệu của mình
alter table public.ideas enable row level security;
alter table public.attachments enable row level security;

drop policy if exists "own ideas" on public.ideas;
create policy "own ideas" on public.ideas for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "own attachments" on public.attachments;
create policy "own attachments" on public.attachments for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Realtime: máy khác nhận thay đổi gần như tức thì
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'ideas') then
      alter publication supabase_realtime add table public.ideas;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'attachments') then
      alter publication supabase_realtime add table public.attachments;
    end if;
  end if;
end $$;

-- Storage cho ảnh / ghi âm: bucket riêng tư, mỗi người một thư mục <user_id>/
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

drop policy if exists "ideos own files" on storage.objects;
create policy "ideos own files" on storage.objects for all to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);

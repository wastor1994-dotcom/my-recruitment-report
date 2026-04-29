-- Recruitment rate request schema for “อัตราคงค้าง”
-- Run in Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.rate_requests (
  id uuid primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  date_notified date not null,
  last_work_date date,
  desired_date date,

  request_type text not null check (request_type in ('replacement', 'new')),
  replacement_count integer,
  new_count integer,

  site_code text,
  request_no text,
  unit text not null,

  source text,

  employee_left_name text,
  position text not null,
  salary_rate numeric(12,2),
  left_reason text,
  uploader_staff text not null,

  status text check (
    status in ('รอดาต้า', 'รอสัมภาษณ์', 'รอผลสัมภาษณ์', 'รอเริ่มงาน', 'เริ่มงาน')
    or status is null
  ),
  responsible_person text,

  -- Constraints for responsible person (nullable until RM sets it)
  constraint rate_requests_responsible_person_check check (
    responsible_person in ('กรภัทร', 'ไอรดา', 'วันชัย') or responsible_person is null
  )
);

create table if not exists public.rate_request_files (
  id bigserial primary key,
  request_id uuid not null references public.rate_requests(id) on delete cascade,
  file_path text not null,
  file_name text not null,
  mime_type text,
  created_at timestamptz not null default now()
);

create index if not exists rate_request_files_request_id_idx on public.rate_request_files(request_id);
create index if not exists rate_requests_created_at_idx on public.rate_requests(created_at desc);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_rate_requests_updated_at on public.rate_requests;
create trigger set_rate_requests_updated_at
before update on public.rate_requests
for each row
execute function public.set_updated_at();


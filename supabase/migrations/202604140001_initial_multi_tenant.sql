create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.document_types (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users (id) on delete cascade,
  name text not null,
  slug text not null,
  description text not null,
  prompt_template text not null,
  field_definitions jsonb not null,
  is_public boolean not null default false,
  is_system boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint document_types_owner_required check (
    (is_system = true and owner_user_id is null)
    or (is_system = false and owner_user_id is not null)
  )
);

create unique index if not exists document_types_system_slug_idx
  on public.document_types (slug)
  where is_system = true;

create unique index if not exists document_types_owner_slug_idx
  on public.document_types (owner_user_id, slug)
  where owner_user_id is not null;

create index if not exists document_types_public_idx
  on public.document_types (is_public)
  where is_public = true;

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  document_type_id uuid not null references public.document_types (id) on delete restrict,
  original_name text not null,
  mime_type text not null,
  storage_bucket text not null default 'scanlee-documents',
  storage_object_path text not null,
  sha256 text not null,
  status text not null check (status in ('uploaded', 'processing', 'extracted', 'reviewed', 'completed', 'failed')),
  model_name text,
  extracted_data jsonb,
  reviewed_data jsonb,
  raw_response text,
  error_message text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists documents_owner_created_idx
  on public.documents (owner_user_id, created_at desc);

create index if not exists documents_owner_status_idx
  on public.documents (owner_user_id, status);

create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_current_timestamp_updated_at();

drop trigger if exists set_document_types_updated_at on public.document_types;
create trigger set_document_types_updated_at
before update on public.document_types
for each row
execute function public.set_current_timestamp_updated_at();

drop trigger if exists set_documents_updated_at on public.documents;
create trigger set_documents_updated_at
before update on public.documents
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.profiles enable row level security;
alter table public.document_types enable row level security;
alter table public.documents enable row level security;

drop policy if exists "profiles are private to each user" on public.profiles;
create policy "profiles are private to each user"
on public.profiles
for all
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "document types are visible by scope" on public.document_types;
create policy "document types are visible by scope"
on public.document_types
for select
using (
  is_system = true
  or is_public = true
  or owner_user_id = auth.uid()
);

drop policy if exists "owners can insert their document types" on public.document_types;
create policy "owners can insert their document types"
on public.document_types
for insert
with check (
  auth.uid() = owner_user_id
  and is_system = false
);

drop policy if exists "owners can update their document types" on public.document_types;
create policy "owners can update their document types"
on public.document_types
for update
using (
  auth.uid() = owner_user_id
  and is_system = false
);

drop policy if exists "owners can delete their document types" on public.document_types;
create policy "owners can delete their document types"
on public.document_types
for delete
using (
  auth.uid() = owner_user_id
  and is_system = false
);

drop policy if exists "owners can manage their documents" on public.documents;
create policy "owners can manage their documents"
on public.documents
for all
using (auth.uid() = owner_user_id)
with check (
  auth.uid() = owner_user_id
  and exists (
    select 1
    from public.document_types
    where document_types.id = document_type_id
      and (
        document_types.is_system = true
        or document_types.is_public = true
        or document_types.owner_user_id = auth.uid()
      )
  )
);

insert into storage.buckets (id, name, public)
values ('scanlee-documents', 'scanlee-documents', false)
on conflict (id) do nothing;

drop policy if exists "users can upload their own scanlee objects" on storage.objects;
create policy "users can upload their own scanlee objects"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'scanlee-documents'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "users can read their own scanlee objects" on storage.objects;
create policy "users can read their own scanlee objects"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'scanlee-documents'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "users can update their own scanlee objects" on storage.objects;
create policy "users can update their own scanlee objects"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'scanlee-documents'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "users can delete their own scanlee objects" on storage.objects;
create policy "users can delete their own scanlee objects"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'scanlee-documents'
  and auth.uid()::text = (storage.foldername(name))[1]
);

insert into public.document_types (
  id,
  owner_user_id,
  name,
  slug,
  description,
  prompt_template,
  field_definitions,
  is_public,
  is_system
)
values
  (
    '00000000-0000-0000-0000-000000000101',
    null,
    'Invoice',
    'invoice',
    'General vendor invoice extraction with core header fields and payment totals.',
    'Extract the invoice into strict JSON only. Preserve vendor names and invoice numbers exactly as written. Use null when a value is not visible.',
    $$[
      {"key":"vendor_name","label":"Vendor Name","kind":"text","required":true,"aliases":["supplier","from","bill from"],"description":"Company or person issuing the invoice."},
      {"key":"invoice_number","label":"Invoice Number","kind":"text","required":true,"aliases":["invoice #","reference"],"description":"The invoice identifier."},
      {"key":"invoice_date","label":"Invoice Date","kind":"date","required":true,"aliases":["date issued","invoice date"],"description":"Date the invoice was created."},
      {"key":"due_date","label":"Due Date","kind":"date","required":false,"aliases":["payment due","due on"],"description":"Date payment is due."},
      {"key":"total_amount","label":"Total Amount","kind":"currency","required":true,"aliases":["amount due","balance due","total"],"description":"Final total after taxes and discounts."}
    ]$$::jsonb,
    true,
    true
  ),
  (
    '00000000-0000-0000-0000-000000000102',
    null,
    'Cheque',
    'cheque',
    'Cheque extraction for payee, amount, cheque number, and issued date.',
    'Extract the cheque into strict JSON only. Keep payee text as written. If handwritten text is unclear, return null for the field rather than guessing.',
    $$[
      {"key":"payee","label":"Payee","kind":"text","required":true,"aliases":["pay to the order of"],"description":"Person or business receiving the cheque."},
      {"key":"cheque_number","label":"Cheque Number","kind":"text","required":true,"aliases":["check number","serial"],"description":"Printed cheque identifier."},
      {"key":"issue_date","label":"Issue Date","kind":"date","required":true,"aliases":["date"],"description":"The date written on the cheque."},
      {"key":"amount_numeric","label":"Amount Numeric","kind":"currency","required":true,"aliases":["amount","numeric amount"],"description":"The boxed numeric amount."},
      {"key":"amount_written","label":"Amount Written","kind":"text","required":false,"aliases":["amount in words"],"description":"The written-out amount line."}
    ]$$::jsonb,
    true,
    true
  )
on conflict (id) do update set
  name = excluded.name,
  slug = excluded.slug,
  description = excluded.description,
  prompt_template = excluded.prompt_template,
  field_definitions = excluded.field_definitions,
  is_public = excluded.is_public,
  is_system = excluded.is_system;
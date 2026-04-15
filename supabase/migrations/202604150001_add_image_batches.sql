create table if not exists public.image_batches (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text not null default '',
  status text not null check (status in ('draft', 'active', 'completed')) default 'draft',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists image_batches_owner_created_idx
  on public.image_batches (owner_user_id, created_at desc);

create index if not exists image_batches_owner_status_idx
  on public.image_batches (owner_user_id, status);

drop trigger if exists set_image_batches_updated_at on public.image_batches;
create trigger set_image_batches_updated_at
before update on public.image_batches
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.image_batches enable row level security;

drop policy if exists "owners can manage their image batches" on public.image_batches;
create policy "owners can manage their image batches"
on public.image_batches
for all
using (auth.uid() = owner_user_id)
with check (auth.uid() = owner_user_id);

alter table public.documents
add column if not exists image_batch_id uuid references public.image_batches (id) on delete restrict;

create index if not exists documents_owner_batch_created_idx
  on public.documents (owner_user_id, image_batch_id, created_at desc);

insert into public.image_batches (owner_user_id, name, description, status)
select distinct
  documents.owner_user_id,
  'Legacy Import',
  'Auto-created batch for documents uploaded before image batches were introduced.',
  'completed'
from public.documents
where documents.image_batch_id is null;

update public.documents
set image_batch_id = image_batches.id
from public.image_batches
where public.documents.image_batch_id is null
  and image_batches.owner_user_id = public.documents.owner_user_id
  and image_batches.name = 'Legacy Import'
  and image_batches.description = 'Auto-created batch for documents uploaded before image batches were introduced.';

alter table public.documents
alter column image_batch_id set not null;

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
  and exists (
    select 1
    from public.image_batches
    where image_batches.id = image_batch_id
      and image_batches.owner_user_id = auth.uid()
  )
);
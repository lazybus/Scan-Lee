drop policy if exists "users can update their own scanlee objects" on storage.objects;
create policy "users can update their own scanlee objects"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'scanlee-documents'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'scanlee-documents'
  and auth.uid()::text = (storage.foldername(name))[1]
);
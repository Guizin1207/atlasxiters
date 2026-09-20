drop policy if exists "support_receipts_read" on storage.objects;
create policy "support_receipts_read"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'support-receipts');

drop policy if exists "support_receipts_upload" on storage.objects;
create policy "support_receipts_upload"
on storage.objects for insert
to anon, authenticated
with check (
  bucket_id = 'support-receipts'
  and lower(storage.extension(name)) in ('jpg','jpeg','png','webp','heic','heif')
);
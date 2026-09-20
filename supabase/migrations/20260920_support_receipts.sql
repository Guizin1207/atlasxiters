-- Armazenamento de comprovantes enviados pelo chat de suporte.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'support-receipts',
  'support-receipts',
  true,
  8388608,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif']
)
on conflict (id) do update
set public = true,
    file_size_limit = 8388608,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "support_receipts_public_read" on storage.objects;
create policy "support_receipts_public_read"
on storage.objects for select
to public
using (bucket_id = 'support-receipts');

drop policy if exists "support_receipts_upload" on storage.objects;
create policy "support_receipts_upload"
on storage.objects for insert
to anon, authenticated
with check (
  bucket_id = 'support-receipts'
  and lower(storage.extension(name)) in ('jpg','jpeg','png','webp','heic','heif')
);

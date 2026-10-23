-- Profile photos remain private; owners alone can upload, replace and sign their files.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('clay-avatars','clay-avatars',false,2097152,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
drop policy if exists clay_avatar_owner on storage.objects;
create policy clay_avatar_owner on storage.objects for all to authenticated
using(bucket_id='clay-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text)
with check(bucket_id='clay-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);

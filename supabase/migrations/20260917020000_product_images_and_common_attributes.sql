-- Staff need signed reads for private catalogue images. Public visitors remain
-- limited to images attached to active, public products.
create policy product_images_staff_read on storage.objects for select to authenticated using (
  bucket_id = 'product-images'
  and public.has_permission('product_images.manage')
  and public.is_valid_product_image_path(name)
);

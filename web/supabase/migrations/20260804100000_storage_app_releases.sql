-- Private bucket for Android APK sideload (/app → /app/download signed URL)
-- Downloads: service_role createSignedUrl only (no public read policy)

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'app-releases',
  'app-releases',
  false,
  104857600,
  ARRAY[
    'application/vnd.android.package-archive',
    'application/octet-stream'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Keep stall card coords (catalogKey#stallNo). Drop leftover SP-only barnLayouts keys.
-- Does not touch alarmSettings, onboarding, controllers, or RLS.

UPDATE public.profiles
SET
  ui_config = jsonb_set(
    ui_config,
    '{barnLayouts}',
    COALESCE(
      (
        SELECT jsonb_object_agg(k, v)
        FROM jsonb_each(COALESCE(ui_config->'barnLayouts', '{}'::jsonb)) AS e(k, v)
        WHERE k LIKE '%#%'
      ),
      '{}'::jsonb
    ),
    true
  ),
  updated_at = now()
WHERE
  ui_config ? 'barnLayouts'
  AND EXISTS (
    SELECT 1
    FROM jsonb_object_keys(COALESCE(ui_config->'barnLayouts', '{}'::jsonb)) AS k
    WHERE k NOT LIKE '%#%'
  );

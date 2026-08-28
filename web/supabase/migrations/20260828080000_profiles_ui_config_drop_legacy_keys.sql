-- Strip retired profiles.ui_config keys (legacy barns array, display flags, piggy).
-- Does not touch barnLayouts, alarmSettings, onboarding, controllers, or RLS.

UPDATE public.profiles
SET
  ui_config = (
    CASE
      WHEN COALESCE(ui_config->'barnAliases', '{}'::jsonb) = '{}'::jsonb
        THEN ui_config - 'barns' - 'displaySettings' - 'piggyPlayerId' - 'barnAliases'
      ELSE ui_config - 'barns' - 'displaySettings' - 'piggyPlayerId'
    END
  ),
  updated_at = now()
WHERE
  ui_config ? 'barns'
  OR ui_config ? 'displaySettings'
  OR ui_config ? 'piggyPlayerId'
  OR (
    ui_config ? 'barnAliases'
    AND COALESCE(ui_config->'barnAliases', '{}'::jsonb) = '{}'::jsonb
  );

ALTER TABLE public.profiles
  ALTER COLUMN ui_config SET DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.profiles.ui_config IS
  '사용자 UI 설정 (barnLayouts, barnAliases, controllers, alarmSettings, onboarding)';

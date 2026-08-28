-- SMS/VOICE notify queue never opened in the dashboard (N.py / SOLAPI).
-- Approved drop 2026-08-28. No FKs. Push path (user_push_device / push_outbox) unchanged.

DROP TABLE IF EXISTS public.farm_alarm_notify;

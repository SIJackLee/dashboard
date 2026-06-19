-- Edge decode pipeline stable: drop raw+TS-decode latest View (replaced by v_iot_decoded_latest)

DROP VIEW IF EXISTS public.v_iot_live_latest;

DROP FUNCTION IF EXISTS public.iot_v0c_controller_key(bytea);

COMMENT ON VIEW public.v_iot_decoded_latest IS
  'LIVE controller latest — primary dashboard read path (Edge-decoded v0x0C).';

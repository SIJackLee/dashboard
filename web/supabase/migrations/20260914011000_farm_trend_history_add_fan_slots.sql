-- Add slot-based averages (avg_fan_a/b/c) to trend RPCs.
-- Motor graph must reference channel slot (A/B/C) + its %, not eqpmnCode.
-- EC-based avg_fan_supply/exhaust/intake are kept for backward compatibility
-- during the client transition. Changing OUT columns requires DROP + CREATE;
-- both statements run in one migration (transactional) so no caller observes a
-- missing function. The _json wrapper uses to_jsonb(t) so new columns flow through.
drop function if exists public.farm_trend_history_by_controller_json(text, text, timestamptz, timestamptz, interval);
drop function if exists public.farm_trend_history_by_controller(text, text, timestamptz, timestamptz, interval);

create or replace function public.farm_trend_history_by_controller(
  p_lsind text,
  p_item text,
  p_from timestamptz,
  p_to timestamptz,
  p_bucket interval
)
returns table(
  bucket_at timestamptz,
  stall_ty_code text,
  stall_no text,
  controller_key text,
  eqpmn_no text,
  avg_temp_c numeric,
  avg_humidity_pct numeric,
  avg_fan_supply numeric,
  avg_fan_exhaust numeric,
  avg_fan_intake numeric,
  avg_fan_a numeric,
  avg_fan_b numeric,
  avg_fan_c numeric,
  sample_count bigint
)
language sql
stable
set search_path to 'public'
as $function$
  select
    date_bin(p_bucket, mesure_at, p_from) as bucket_at,
    stall_ty_code,
    stall_no,
    controller_key,
    eqpmn_no,
    round(avg(temp_c)::numeric, 1) as avg_temp_c,
    round(avg(humidity_pct)::numeric, 1) as avg_humidity_pct,
    round(avg(fan_supply_pct)::numeric, 1) as avg_fan_supply,
    round(avg(fan_exhaust_pct)::numeric, 1) as avg_fan_exhaust,
    round(avg(fan_intake_pct)::numeric, 1) as avg_fan_intake,
    round(avg(fan_a_pct)::numeric, 1) as avg_fan_a,
    round(avg(fan_b_pct)::numeric, 1) as avg_fan_b,
    round(avg(fan_c_pct)::numeric, 1) as avg_fan_c,
    count(*) as sample_count
  from public.iot_room_state_decoded
  where lsind_regist_no = p_lsind
    and item_code = p_item
    and packet_mode in ('live', 'history', 'replay')
    and decode_status = 'ok'
    and mesure_at >= p_from
    and mesure_at < p_to
  group by
    date_bin(p_bucket, mesure_at, p_from),
    stall_ty_code,
    stall_no,
    controller_key,
    eqpmn_no
  order by
    date_bin(p_bucket, mesure_at, p_from),
    stall_ty_code,
    stall_no,
    eqpmn_no;
$function$;

create or replace function public.farm_trend_history_by_controller_json(
  p_lsind text,
  p_item text,
  p_from timestamptz,
  p_to timestamptz,
  p_bucket interval
)
returns jsonb
language sql
stable
set search_path to 'public'
as $function$
  select coalesce(
    jsonb_agg(
      to_jsonb(t)
      order by t.bucket_at, t.stall_ty_code, t.stall_no, t.eqpmn_no
    ),
    '[]'::jsonb
  )
  from public.farm_trend_history_by_controller(
    p_lsind, p_item, p_from, p_to, p_bucket
  ) t;
$function$;

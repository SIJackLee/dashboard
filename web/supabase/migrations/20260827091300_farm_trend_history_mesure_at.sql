-- Restore trend RPC to mesure_at (sensor time) after decode-batch started
-- correcting KST-as-UTC packet clocks. received_at clumped reconnect bursts.

create or replace function public.farm_trend_history(
  p_lsind text,
  p_item text,
  p_from timestamptz,
  p_to timestamptz,
  p_bucket interval
)
returns table (
  bucket_at timestamptz,
  stall_ty_code text,
  stall_no text,
  avg_temp_c numeric,
  avg_humidity_pct numeric,
  avg_fan_supply numeric,
  avg_fan_exhaust numeric,
  avg_fan_intake numeric,
  sample_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    date_bin(p_bucket, mesure_at, p_from) as bucket_at,
    stall_ty_code,
    stall_no,
    round(avg(temp_c)::numeric, 1) as avg_temp_c,
    round(avg(humidity_pct)::numeric, 1) as avg_humidity_pct,
    round(avg(fan_supply_pct)::numeric, 1) as avg_fan_supply,
    round(avg(fan_exhaust_pct)::numeric, 1) as avg_fan_exhaust,
    round(avg(fan_intake_pct)::numeric, 1) as avg_fan_intake,
    count(*) as sample_count
  from public.iot_room_state_decoded
  where lsind_regist_no = p_lsind
    and item_code = p_item
    and packet_mode in ('live', 'history', 'replay')
    and decode_status = 'ok'
    and mesure_at >= p_from
    and mesure_at < p_to
  group by date_bin(p_bucket, mesure_at, p_from), stall_ty_code, stall_no
  order by date_bin(p_bucket, mesure_at, p_from), stall_ty_code, stall_no;
$$;

comment on function public.farm_trend_history(text, text, timestamptz, timestamptz, interval) is
  'Dashboard trend: bucketed stall avg by mesure_at. Includes live/history/replay. SECURITY INVOKER → RLS.';

create or replace function public.farm_trend_history_by_controller(
  p_lsind text,
  p_item text,
  p_from timestamptz,
  p_to timestamptz,
  p_bucket interval
)
returns table (
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
  sample_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
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
$$;

comment on function public.farm_trend_history_by_controller(text, text, timestamptz, timestamptz, interval) is
  'Dashboard list/chart: controller-level avg by mesure_at. Includes live/history/replay. SECURITY INVOKER → RLS.';

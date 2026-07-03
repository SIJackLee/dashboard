-- ---------------------------------------------------------------------------
-- Dashboard trend history RPC — per-controller breakdown
-- For list-view graph mode: one series per (stall_ty_code, stall_no, controller_key).
-- Grid drill continues to use farm_trend_history (stall-level aggregate).
-- SECURITY INVOKER → honors decoded_select_scoped RLS.
-- Read-only function; creates no tables and changes no existing data.
-- ---------------------------------------------------------------------------

create function public.farm_trend_history_by_controller(
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
    date_bin(p_bucket, received_at, p_from) as bucket_at,
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
    and packet_mode = 'live'
    and decode_status = 'ok'
    and received_at >= p_from
    and received_at < p_to
  group by
    date_bin(p_bucket, received_at, p_from),
    stall_ty_code,
    stall_no,
    controller_key,
    eqpmn_no
  order by
    date_bin(p_bucket, received_at, p_from),
    stall_ty_code,
    stall_no,
    eqpmn_no;
$$;

comment on function public.farm_trend_history_by_controller(text, text, timestamptz, timestamptz, interval) is
  'Dashboard list graph: bucketed controller-level avg of temp/humidity/fan from iot_room_state_decoded. SECURITY INVOKER honors decoded_select_scoped RLS.';

grant execute on function public.farm_trend_history_by_controller(text, text, timestamptz, timestamptz, interval) to authenticated;

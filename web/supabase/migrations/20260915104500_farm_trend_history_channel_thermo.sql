-- Trend RPC: last channel thermo per bucket (A flat · B/C decoded_json).
-- Changing OUT columns requires DROP + CREATE; json wrapper uses to_jsonb(t).

create or replace function public.extract_channel_thermo(channels jsonb, p_channel text)
returns jsonb
language sql
immutable
set search_path to 'public'
as $$
  select ch -> 'thermo'
  from jsonb_array_elements(coalesce(channels, '[]'::jsonb)) as ch
  where ch ->> 'channel' = p_channel
    and jsonb_typeof(ch -> 'thermo') = 'object'
  limit 1;
$$;

comment on function public.extract_channel_thermo(jsonb, text) is
  'decoded channels[] — slot A/B/C thermo object.';

grant execute on function public.extract_channel_thermo(jsonb, text) to authenticated;

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
  sample_count bigint,
  a_setpoint_temp numeric,
  a_temp_deviation numeric,
  a_min_vent_pct numeric,
  a_max_vent_pct numeric,
  b_setpoint_temp numeric,
  b_temp_deviation numeric,
  b_min_vent_pct numeric,
  b_max_vent_pct numeric,
  c_setpoint_temp numeric,
  c_temp_deviation numeric,
  c_min_vent_pct numeric,
  c_max_vent_pct numeric
)
language sql
stable
set search_path to 'public'
as $function$
  select
    date_bin(p_bucket, d.mesure_at, p_from) as bucket_at,
    d.stall_ty_code,
    d.stall_no,
    d.controller_key,
    d.eqpmn_no,
    round(avg(d.temp_c)::numeric, 1) as avg_temp_c,
    round(avg(d.humidity_pct)::numeric, 1) as avg_humidity_pct,
    round(avg(d.fan_supply_pct)::numeric, 1) as avg_fan_supply,
    round(avg(d.fan_exhaust_pct)::numeric, 1) as avg_fan_exhaust,
    round(avg(d.fan_intake_pct)::numeric, 1) as avg_fan_intake,
    round(avg(d.fan_a_pct)::numeric, 1) as avg_fan_a,
    round(avg(d.fan_b_pct)::numeric, 1) as avg_fan_b,
    round(avg(d.fan_c_pct)::numeric, 1) as avg_fan_c,
    count(*) as sample_count,
    (array_agg(d.setpoint_temp order by d.mesure_at desc)
      filter (where d.setpoint_temp is not null))[1] as a_setpoint_temp,
    (array_agg(d.temp_deviation order by d.mesure_at desc)
      filter (where d.temp_deviation is not null))[1] as a_temp_deviation,
    (array_agg(d.min_vent_pct order by d.mesure_at desc)
      filter (where d.min_vent_pct is not null))[1] as a_min_vent_pct,
    (array_agg(d.max_vent_pct order by d.mesure_at desc)
      filter (where d.max_vent_pct is not null))[1] as a_max_vent_pct,
    (array_agg(th.b_sp order by d.mesure_at desc)
      filter (where th.b_sp is not null))[1] as b_setpoint_temp,
    (array_agg(th.b_dev order by d.mesure_at desc)
      filter (where th.b_dev is not null))[1] as b_temp_deviation,
    (array_agg(th.b_min order by d.mesure_at desc)
      filter (where th.b_min is not null))[1] as b_min_vent_pct,
    (array_agg(th.b_max order by d.mesure_at desc)
      filter (where th.b_max is not null))[1] as b_max_vent_pct,
    (array_agg(th.c_sp order by d.mesure_at desc)
      filter (where th.c_sp is not null))[1] as c_setpoint_temp,
    (array_agg(th.c_dev order by d.mesure_at desc)
      filter (where th.c_dev is not null))[1] as c_temp_deviation,
    (array_agg(th.c_min order by d.mesure_at desc)
      filter (where th.c_min is not null))[1] as c_min_vent_pct,
    (array_agg(th.c_max order by d.mesure_at desc)
      filter (where th.c_max is not null))[1] as c_max_vent_pct
  from public.iot_room_state_decoded d
  left join lateral (
    select
      public.extract_channel_thermo(d.decoded_json -> 'channels', 'B') as b_th,
      public.extract_channel_thermo(d.decoded_json -> 'channels', 'C') as c_th
  ) raw_th on true
  left join lateral (
    select
      nullif(raw_th.b_th ->> 'setpointTemp', '')::numeric as b_sp,
      nullif(raw_th.b_th ->> 'tempDeviation', '')::numeric as b_dev,
      nullif(raw_th.b_th ->> 'minVentPct', '')::numeric as b_min,
      nullif(raw_th.b_th ->> 'maxVentPct', '')::numeric as b_max,
      nullif(raw_th.c_th ->> 'setpointTemp', '')::numeric as c_sp,
      nullif(raw_th.c_th ->> 'tempDeviation', '')::numeric as c_dev,
      nullif(raw_th.c_th ->> 'minVentPct', '')::numeric as c_min,
      nullif(raw_th.c_th ->> 'maxVentPct', '')::numeric as c_max
  ) th on true
  where d.lsind_regist_no = p_lsind
    and d.item_code = p_item
    and d.packet_mode in ('live', 'history', 'replay')
    and d.decode_status = 'ok'
    and d.mesure_at >= p_from
    and d.mesure_at < p_to
  group by
    date_bin(p_bucket, d.mesure_at, p_from),
    d.stall_ty_code,
    d.stall_no,
    d.controller_key,
    d.eqpmn_no
  order by
    date_bin(p_bucket, d.mesure_at, p_from),
    d.stall_ty_code,
    d.stall_no,
    d.eqpmn_no;
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

comment on function public.farm_trend_history_by_controller(text, text, timestamptz, timestamptz, interval) is
  'Controller trend buckets plus last A/B/C thermo in each bucket. B/C setpoint is the A offset.';

grant execute on function public.farm_trend_history_by_controller(text, text, timestamptz, timestamptz, interval) to authenticated;
grant execute on function public.farm_trend_history_by_controller_json(text, text, timestamptz, timestamptz, interval) to authenticated;

-- Slot-based motor % columns for iot_room_state_decoded.
-- Motor graph must reference channel slot (A/B/C) + its %, NOT eqpmnCode.
-- The prior fan_supply/exhaust/intake_pct are eqpmnCode(EC01/02/03)-based and
-- collapse channels that share an eqpmnCode. These new columns store per-slot
-- motor % (max of that channel's decoded outputs). Additive & nullable → safe.
alter table public.iot_room_state_decoded
  add column if not exists fan_a_pct numeric,
  add column if not exists fan_b_pct numeric,
  add column if not exists fan_c_pct numeric;

comment on column public.iot_room_state_decoded.fan_a_pct is 'Motor % of channel slot A (max of channel outputs). Slot-based; complements eqpmnCode-based fan_*_pct.';
comment on column public.iot_room_state_decoded.fan_b_pct is 'Motor % of channel slot B (max of channel outputs).';
comment on column public.iot_room_state_decoded.fan_c_pct is 'Motor % of channel slot C (max of channel outputs).';

-- Backfill slot-based motor % (fan_a/b/c_pct) from decoded_json for historical rows.
-- Per slot value = max of that channel's decoded outputs (matches fanPctFromChannelSlot
-- in supabase/functions/decode-batch/wire-decode-v0c.ts). Idempotent: only fills rows
-- whose slot columns are all NULL. Safe no-op on a fresh/empty database.
-- NOTE: On the production DB this was executed in dated batches via MCP to avoid
-- long single-statement locks; this file is the canonical, reproducible form.
update public.iot_room_state_decoded d set
  fan_a_pct = (
    select max((v.value)::numeric)
    from jsonb_array_elements(d.decoded_json->'channels') ch
    cross join lateral jsonb_each_text(ch->'outputs') v
    where ch->>'channel' = 'A'
  ),
  fan_b_pct = (
    select max((v.value)::numeric)
    from jsonb_array_elements(d.decoded_json->'channels') ch
    cross join lateral jsonb_each_text(ch->'outputs') v
    where ch->>'channel' = 'B'
  ),
  fan_c_pct = (
    select max((v.value)::numeric)
    from jsonb_array_elements(d.decoded_json->'channels') ch
    cross join lateral jsonb_each_text(ch->'outputs') v
    where ch->>'channel' = 'C'
  )
where d.decode_status = 'ok'
  and jsonb_array_length(coalesce(d.decoded_json->'channels', '[]'::jsonb)) > 0
  and d.fan_a_pct is null
  and d.fan_b_pct is null
  and d.fan_c_pct is null;

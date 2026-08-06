-- P0: controller_key / channel_key (LIVE · command_ack 규칙과 동일)
-- P1: sent/address/key indexes + DROP idx_ctrl_thermo_command_target
-- J1=A, J2=A, J3=A, J4=A, J5=DROP, J6=A, J7=B

ALTER TABLE public.ctrl_thermo_command
  ADD COLUMN controller_key text
    GENERATED ALWAYS AS (
      CASE
        WHEN nullif(btrim(stall_ty_code), '') IS NULL
          OR nullif(btrim(stall_no), '') IS NULL
          OR nullif(btrim(eqpmn_no), '') IS NULL
        THEN NULL
        ELSE btrim(stall_ty_code) || ':' || btrim(stall_no) || ':' || btrim(eqpmn_no)
      END
    ) STORED,
  ADD COLUMN channel_key text
    GENERATED ALWAYS AS (
      CASE
        WHEN nullif(btrim(stall_ty_code), '') IS NULL
          OR nullif(btrim(stall_no), '') IS NULL
          OR nullif(btrim(eqpmn_no), '') IS NULL
          OR nullif(btrim(channel), '') IS NULL
          OR nullif(btrim(eqpmn_code), '') IS NULL
        THEN NULL
        ELSE btrim(stall_ty_code) || ':' || btrim(stall_no) || ':' || btrim(eqpmn_no)
          || '|' || upper(btrim(channel))
          || '|' || upper(btrim(eqpmn_code))
      END
    ) STORED;

COMMENT ON COLUMN public.ctrl_thermo_command.controller_key IS
  'Generated: stall_ty:stall_no:eqpmn_no — same as LIVE controller_key / command_ack base';
COMMENT ON COLUMN public.ctrl_thermo_command.channel_key IS
  'Generated: controller_key|CHANNEL|EQPMN_CODE — same as command_ack target; NULL for SET_CTRL_THERMO';

CREATE INDEX IF NOT EXISTS idx_ctrl_thermo_command_sent_at
  ON public.ctrl_thermo_command (sent_at)
  WHERE status = 'sent';

CREATE INDEX IF NOT EXISTS idx_ctrl_thermo_command_address
  ON public.ctrl_thermo_command (
    lsind_regist_no,
    item_code,
    module_uid,
    stall_ty_code,
    stall_no,
    eqpmn_no,
    channel,
    created_at DESC
  );

CREATE INDEX IF NOT EXISTS idx_ctrl_thermo_command_channel_key
  ON public.ctrl_thermo_command (channel_key, created_at DESC)
  WHERE channel_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ctrl_thermo_command_controller_key
  ON public.ctrl_thermo_command (
    lsind_regist_no,
    item_code,
    module_uid,
    controller_key,
    created_at DESC
  )
  WHERE controller_key IS NOT NULL;

DROP INDEX IF EXISTS public.idx_ctrl_thermo_command_target;

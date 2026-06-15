-- ctrl_thermo_command: sent → applied (LIVE uplink thermo 일치 시)

ALTER TABLE public.ctrl_thermo_command
  DROP CONSTRAINT IF EXISTS ctrl_thermo_command_status_check;

ALTER TABLE public.ctrl_thermo_command
  ADD CONSTRAINT ctrl_thermo_command_status_check
  CHECK (status IN ('pending', 'sent', 'applied', 'failed', 'cancelled'));

ALTER TABLE public.ctrl_thermo_command
  ADD COLUMN IF NOT EXISTS applied_at timestamptz;

COMMENT ON COLUMN public.ctrl_thermo_command.applied_at IS
  'LIVE uplink thermo가 명령값과 일치할 때 (D.py command_ack)';

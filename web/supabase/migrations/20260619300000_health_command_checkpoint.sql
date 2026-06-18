-- Admin checkpoint: acknowledge reviewed C/downlink failures (excluded from Health S4 rollup).

CREATE TABLE IF NOT EXISTS public.health_command_checkpoint (
  command_id uuid PRIMARY KEY
    REFERENCES public.ctrl_thermo_command (id) ON DELETE CASCADE,
  acknowledged_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  note text
);

CREATE INDEX IF NOT EXISTS idx_health_command_checkpoint_at
  ON public.health_command_checkpoint (acknowledged_at DESC);

COMMENT ON TABLE public.health_command_checkpoint IS
  'Health S4 — admin reviewed ctrl_thermo_command failure; excluded from C rollup (not COL uplink)';

ALTER TABLE public.health_command_checkpoint ENABLE ROW LEVEL SECURITY;

CREATE POLICY health_command_checkpoint_admin ON public.health_command_checkpoint
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

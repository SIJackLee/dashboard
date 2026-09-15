-- setpoint CHECK를 대시보드 MENU_STEPS.setpoint(0~30)와 맞춤.
-- 기존 이력에 30℃ 초과 행이 있어 NOT VALID (신규 INSERT만 0~30).

ALTER TABLE public.ctrl_thermo_command
  DROP CONSTRAINT IF EXISTS ctrl_thermo_command_temp_range;

ALTER TABLE public.ctrl_thermo_command
  ADD CONSTRAINT ctrl_thermo_command_temp_range
  CHECK (setpoint_temp >= 0 AND setpoint_temp <= 30) NOT VALID;

COMMENT ON CONSTRAINT ctrl_thermo_command_temp_range ON public.ctrl_thermo_command IS
  '설정온도 0~30℃ (대시보드와 동일). NOT VALID: 기존 30 초과 이력 유지.';

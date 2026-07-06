-- Farmer: read sent/applied thermo commands on farms they can access (not only own rows).

DROP POLICY IF EXISTS thermo_command_select_scoped ON public.ctrl_thermo_command;

CREATE POLICY thermo_command_select_scoped ON public.ctrl_thermo_command
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR public.is_admin(auth.uid())
    OR (
      status IN ('sent', 'applied')
      AND public.user_can_read_farm(auth.uid(), lsind_regist_no, item_code)
    )
  );

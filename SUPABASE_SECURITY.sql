-- Habilitar RLS em todas as tabelas críticas
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_studios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commands ENABLE ROW LEVEL SECURITY;

-- Políticas para APPOINTMENTS
DROP POLICY IF EXISTS "allow_public_insert_appointments" ON appointments;
DROP POLICY IF EXISTS "allow_auth_select_appointments" ON appointments;
DROP POLICY IF EXISTS "allow_auth_update_appointments" ON appointments;
DROP POLICY IF EXISTS "allow_auth_delete_appointments" ON appointments;

-- Permitir que membros do estúdio (via user_studios ou team_members) gerenciem agendamentos
CREATE POLICY "appointments_select_by_studio_members" ON appointments FOR SELECT TO authenticated
USING (
  studio_id IN (
    SELECT us.studio_id FROM public.user_studios us WHERE us.user_id = auth.uid()
    UNION
    SELECT tm.studio_id FROM public.team_members tm WHERE tm.email = auth.jwt()->>'email' AND tm.active = true
  )
);

CREATE POLICY "appointments_insert_by_studio_members" ON appointments FOR INSERT TO authenticated
WITH CHECK (
  studio_id IN (
    SELECT us.studio_id FROM public.user_studios us WHERE us.user_id = auth.uid()
    UNION
    SELECT tm.studio_id FROM public.team_members tm WHERE tm.email = auth.jwt()->>'email' AND tm.active = true
  )
);

CREATE POLICY "appointments_update_by_studio_members" ON appointments FOR UPDATE TO authenticated
USING (
  studio_id IN (
    SELECT us.studio_id FROM public.user_studios us WHERE us.user_id = auth.uid()
    UNION
    SELECT tm.studio_id FROM public.team_members tm WHERE tm.email = auth.jwt()->>'email' AND tm.active = true
  )
);

CREATE POLICY "appointments_delete_by_studio_members" ON appointments FOR DELETE TO authenticated
USING (
  studio_id IN (
    SELECT us.studio_id FROM public.user_studios us WHERE us.user_id = auth.uid()
    UNION
    SELECT tm.studio_id FROM public.team_members tm WHERE tm.email = auth.jwt()->>'email' AND tm.active = true
  )
);

-- Permitir inserção pública para agendamento online (se necessário)
CREATE POLICY "allow_anon_insert_appointments" ON appointments FOR INSERT TO anon WITH CHECK (true);

-- Políticas para CLIENTS
DROP POLICY IF EXISTS "allow_public_insert_clients" ON clients;
DROP POLICY IF EXISTS "allow_public_select_clients" ON clients;
DROP POLICY IF EXISTS "allow_auth_update_clients" ON clients;
DROP POLICY IF EXISTS "allow_auth_delete_clients" ON clients;

CREATE POLICY "clients_select_by_studio_members" ON clients FOR SELECT TO authenticated
USING (
  studio_id IN (
    SELECT us.studio_id FROM public.user_studios us WHERE us.user_id = auth.uid()
    UNION
    SELECT tm.studio_id FROM public.team_members tm WHERE tm.email = auth.jwt()->>'email' AND tm.active = true
  )
);

CREATE POLICY "clients_insert_by_studio_members" ON clients FOR INSERT TO authenticated
WITH CHECK (
  studio_id IN (
    SELECT us.studio_id FROM public.user_studios us WHERE us.user_id = auth.uid()
    UNION
    SELECT tm.studio_id FROM public.team_members tm WHERE tm.email = auth.jwt()->>'email' AND tm.active = true
  )
);

CREATE POLICY "clients_update_by_studio_members" ON clients FOR UPDATE TO authenticated
USING (
  studio_id IN (
    SELECT us.studio_id FROM public.user_studios us WHERE us.user_id = auth.uid()
    UNION
    SELECT tm.studio_id FROM public.team_members tm WHERE tm.email = auth.jwt()->>'email' AND tm.active = true
  )
);

-- Permitir consulta e inserção pública para clientes (agendamento online)
CREATE POLICY "allow_public_select_clients" ON clients FOR SELECT TO public USING (true);
CREATE POLICY "allow_public_insert_clients" ON clients FOR INSERT TO public WITH CHECK (true);

-- Garantir acesso às outras tabelas necessárias
CREATE POLICY "allow_auth_select_team_members" ON team_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_auth_select_services" ON services FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_auth_select_studios" ON studios FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_auth_select_user_studios" ON user_studios FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_auth_select_studio_settings" ON studio_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_auth_select_schedule_blocks" ON schedule_blocks FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_auth_select_financial_transactions" ON financial_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_auth_select_commands" ON commands FOR SELECT TO authenticated USING (true);

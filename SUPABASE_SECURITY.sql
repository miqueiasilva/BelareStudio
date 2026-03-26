-- Política para permitir inserção pública (anon e authenticated) na tabela de agendamentos
-- TO public abrange tanto usuários logados quanto não logados
DROP POLICY IF EXISTS "allow_public_insert_appointments" ON appointments;
CREATE POLICY "allow_public_insert_appointments" ON appointments FOR INSERT TO public WITH CHECK (true);

-- Permitir que usuários autenticados vejam, atualizem e deletem agendamentos
CREATE POLICY "allow_auth_select_appointments" ON appointments FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_auth_update_appointments" ON appointments FOR UPDATE TO authenticated USING (true);
CREATE POLICY "allow_auth_delete_appointments" ON appointments FOR DELETE TO authenticated USING (true);

-- Política para permitir inserção pública na tabela de clientes
DROP POLICY IF EXISTS "allow_public_insert_clients" ON clients;
CREATE POLICY "allow_public_insert_clients" ON clients FOR INSERT TO public WITH CHECK (true);

-- Política para permitir consulta pública na tabela de clientes
DROP POLICY IF EXISTS "allow_public_select_clients" ON clients;
CREATE POLICY "allow_public_select_clients" ON clients FOR SELECT TO public USING (true);

-- Permitir que usuários autenticados gerenciem clientes
CREATE POLICY "allow_auth_update_clients" ON clients FOR UPDATE TO authenticated USING (true);
CREATE POLICY "allow_auth_delete_clients" ON clients FOR DELETE TO authenticated USING (true);

-- Garantir acesso às outras tabelas necessárias para o funcionamento do app
CREATE POLICY "allow_auth_select_team_members" ON team_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_auth_select_services" ON services FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_auth_select_studios" ON studios FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_auth_select_user_studios" ON user_studios FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_auth_select_studio_settings" ON studio_settings FOR SELECT TO authenticated USING (true);

-- Permitir que usuários autenticados vejam e gerenciem bloqueios de agenda
CREATE POLICY "allow_auth_select_schedule_blocks" ON schedule_blocks FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_auth_insert_schedule_blocks" ON schedule_blocks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "allow_auth_update_schedule_blocks" ON schedule_blocks FOR UPDATE TO authenticated USING (true);
CREATE POLICY "allow_auth_delete_schedule_blocks" ON schedule_blocks FOR DELETE TO authenticated USING (true);

-- Permitir que usuários autenticados vejam transações financeiras (necessário para ver comandas)
CREATE POLICY "allow_auth_select_financial_transactions" ON financial_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_auth_insert_financial_transactions" ON financial_transactions FOR INSERT TO authenticated WITH CHECK (true);

-- Permitir que usuários autenticados vejam e gerenciem comandas
CREATE POLICY "allow_auth_select_commands" ON commands FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_auth_insert_commands" ON commands FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "allow_auth_update_commands" ON commands FOR UPDATE TO authenticated USING (true);

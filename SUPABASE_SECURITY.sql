-- Política para permitir inserção pública (anon) na tabela de agendamentos
-- Isso é necessário para que clientes não autenticados possam agendar via link público
CREATE POLICY "allow_public_insert_appointments" ON appointments FOR INSERT TO anon WITH CHECK (true);

-- Política para permitir inserção pública (anon) na tabela de clientes
-- Necessário para cadastrar novos clientes via link público
CREATE POLICY "allow_public_insert_clients" ON clients FOR INSERT TO anon WITH CHECK (true);

-- Política para permitir consulta pública (anon) na tabela de clientes por whatsapp
-- Necessário para verificar se o cliente já existe
CREATE POLICY "allow_public_select_clients" ON clients FOR SELECT TO anon USING (true);

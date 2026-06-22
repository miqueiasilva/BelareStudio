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
DROP POLICY IF EXISTS "allow_anon_update_appointments" ON appointments;

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

-- Permitir consulta pública para agendamento online (checar slots) restrito a estúdios válidos
CREATE POLICY "allow_public_select_appointments" ON appointments FOR SELECT TO public 
USING (studio_id IS NOT NULL);

-- Permitir inserção pública para agendamento online
CREATE POLICY "allow_anon_insert_appointments" ON appointments FOR INSERT TO public 
WITH CHECK (studio_id IS NOT NULL);

-- Permitir apenas atualização pública de agendamento específica para status (agendamento self-confirm via WhatsApp ou cancelamento)
CREATE POLICY "allow_anon_update_appointments" ON appointments FOR UPDATE TO public 
USING (studio_id IS NOT NULL)
WITH CHECK (status IN ('confirmado_whatsapp', 'cancelado'));

-- Políticas para CLIENTS (Hardened to prevent entire table scraping)
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
    SELECT tm.team_member_id FROM public.team_members tm WHERE tm.email = auth.jwt()->>'email' AND tm.active = true
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

-- Consulta pública restrita a buscas direcionadas por WhatsApp e Studio (evita vazamento em massa de dados de clientes)
CREATE POLICY "allow_public_select_clients" ON clients FOR SELECT TO public 
USING (whatsapp IS NOT NULL AND studio_id IS NOT NULL);

-- Inserção pública segura de clientes
CREATE POLICY "allow_public_insert_clients" ON clients FOR INSERT TO public 
WITH CHECK (studio_id IS NOT NULL);

-- Garantir acesso às tabelas institucionais de cada estúdio para agendamento online
DROP POLICY IF EXISTS "allow_public_select_team_members" ON team_members;
CREATE POLICY "allow_public_select_team_members" ON team_members FOR SELECT TO public 
USING (studio_id IS NOT NULL AND active = true);

DROP POLICY IF EXISTS "allow_public_select_services" ON services;
CREATE POLICY "allow_public_select_services" ON services FOR SELECT TO public 
USING (studio_id IS NOT NULL AND ativo = true);

CREATE POLICY "allow_public_select_studios" ON studios FOR SELECT TO public 
USING (id IS NOT NULL);

DROP POLICY IF EXISTS "allow_public_select_studio_settings" ON studio_settings;
CREATE POLICY "allow_public_select_studio_settings" ON studio_settings FOR SELECT TO public 
USING (studio_id IS NOT NULL);

CREATE POLICY "allow_auth_select_user_studios" ON user_studios FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_auth_select_schedule_blocks" ON schedule_blocks FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_auth_select_financial_transactions" ON financial_transactions FOR SELECT TO authenticated USING (true);

-- Habilitar RLS e Políticas para WHATSAPP_REMINDERS_LOG para total conformidade de segurança
ALTER TABLE public.whatsapp_reminders_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "whatsapp_reminders_log_select_by_studio_members" ON whatsapp_reminders_log;
CREATE POLICY "whatsapp_reminders_log_select_by_studio_members" ON whatsapp_reminders_log FOR SELECT TO authenticated
USING (
  studio_id IN (
    SELECT us.studio_id FROM public.user_studios us WHERE us.user_id = auth.uid()
    UNION
    SELECT tm.studio_id FROM public.team_members tm WHERE tm.email = auth.jwt()->>'email' AND tm.active = true
  )
);

DROP POLICY IF EXISTS "allow_all_insert_whatsapp_reminders_log" ON whatsapp_reminders_log;
CREATE POLICY "allow_all_insert_whatsapp_reminders_log" ON whatsapp_reminders_log FOR INSERT TO public 
WITH CHECK (studio_id IS NOT NULL);

-- ==========================================
-- POLÍTICAS PARA COMMANDS & COMMAND_ITEMS
-- ==========================================

ALTER TABLE public.commands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_auth_select_commands" ON commands;
DROP POLICY IF EXISTS "commands_select_by_studio_members" ON commands;
DROP POLICY IF EXISTS "commands_insert_by_studio_members" ON commands;
DROP POLICY IF EXISTS "commands_update_by_studio_members" ON commands;
DROP POLICY IF EXISTS "commands_delete_by_studio_members" ON commands;

CREATE POLICY "commands_select_by_studio_members" ON commands FOR SELECT TO authenticated
USING (
  studio_id IN (
    SELECT us.studio_id FROM public.user_studios us WHERE us.user_id = auth.uid()
    UNION
    SELECT tm.studio_id FROM public.team_members tm WHERE tm.email = auth.jwt()->>'email' AND tm.active = true
  )
);

CREATE POLICY "commands_insert_by_studio_members" ON commands FOR INSERT TO authenticated
WITH CHECK (
  studio_id IN (
    SELECT us.studio_id FROM public.user_studios us WHERE us.user_id = auth.uid()
    UNION
    SELECT tm.studio_id FROM public.team_members tm WHERE tm.email = auth.jwt()->>'email' AND tm.active = true
  )
);

CREATE POLICY "commands_update_by_studio_members" ON commands FOR UPDATE TO authenticated
USING (
  studio_id IN (
    SELECT us.studio_id FROM public.user_studios us WHERE us.user_id = auth.uid()
    UNION
    SELECT tm.studio_id FROM public.team_members tm WHERE tm.email = auth.jwt()->>'email' AND tm.active = true
  )
);

CREATE POLICY "commands_delete_by_studio_members" ON commands FOR DELETE TO authenticated
USING (
  studio_id IN (
    SELECT us.studio_id FROM public.user_studios us WHERE us.user_id = auth.uid()
    UNION
    SELECT tm.studio_id FROM public.team_members tm WHERE tm.email = auth.jwt()->>'email' AND tm.active = true
  )
);

-- Políticas para COMMAND_ITEMS
ALTER TABLE public.command_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "command_items_select_by_studio_members" ON command_items;
DROP POLICY IF EXISTS "command_items_insert_by_studio_members" ON command_items;
DROP POLICY IF EXISTS "command_items_update_by_studio_members" ON command_items;
DROP POLICY IF EXISTS "command_items_delete_by_studio_members" ON command_items;

CREATE POLICY "command_items_select_by_studio_members" ON command_items FOR SELECT TO authenticated
USING (
  studio_id IN (
    SELECT us.studio_id FROM public.user_studios us WHERE us.user_id = auth.uid()
    UNION
    SELECT tm.studio_id FROM public.team_members tm WHERE tm.email = auth.jwt()->>'email' AND tm.active = true
  )
);

CREATE POLICY "command_items_insert_by_studio_members" ON command_items FOR INSERT TO authenticated
WITH CHECK (
  studio_id IN (
    SELECT us.studio_id FROM public.user_studios us WHERE us.user_id = auth.uid()
    UNION
    SELECT tm.studio_id FROM public.team_members tm WHERE tm.email = auth.jwt()->>'email' AND tm.active = true
  )
);

CREATE POLICY "command_items_update_by_studio_members" ON command_items FOR UPDATE TO authenticated
USING (
  studio_id IN (
    SELECT us.studio_id FROM public.user_studios us WHERE us.user_id = auth.uid()
    UNION
    SELECT tm.studio_id FROM public.team_members tm WHERE tm.email = auth.jwt()->>'email' AND tm.active = true
  )
);

CREATE POLICY "command_items_delete_by_studio_members" ON command_items FOR DELETE TO authenticated
USING (
  studio_id IN (
    SELECT us.studio_id FROM public.user_studios us WHERE us.user_id = auth.uid()
    UNION
    SELECT tm.studio_id FROM public.team_members tm WHERE tm.email = auth.jwt()->>'email' AND tm.active = true
  )
);

-- Políticas para FINANCIAL_CATEGORIES
ALTER TABLE public.financial_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "financial_categories_select_by_studio_members" ON financial_categories;
DROP POLICY IF EXISTS "financial_categories_insert_by_studio_members" ON financial_categories;
DROP POLICY IF EXISTS "financial_categories_update_by_studio_members" ON financial_categories;
DROP POLICY IF EXISTS "financial_categories_delete_by_studio_members" ON financial_categories;

CREATE POLICY "financial_categories_select_by_studio_members" ON financial_categories FOR SELECT TO authenticated
USING (
  studio_id IN (
    SELECT us.studio_id FROM public.user_studios us WHERE us.user_id = auth.uid()
    UNION
    SELECT tm.studio_id FROM public.team_members tm WHERE tm.email = auth.jwt()->>'email' AND tm.active = true
  )
);

CREATE POLICY "financial_categories_insert_by_studio_members" ON financial_categories FOR INSERT TO authenticated
WITH CHECK (
  studio_id IN (
    SELECT us.studio_id FROM public.user_studios us WHERE us.user_id = auth.uid()
    UNION
    SELECT tm.studio_id FROM public.team_members tm WHERE tm.email = auth.jwt()->>'email' AND tm.active = true
  )
);

CREATE POLICY "financial_categories_update_by_studio_members" ON financial_categories FOR UPDATE TO authenticated
USING (
  studio_id IN (
    SELECT us.studio_id FROM public.user_studios us WHERE us.user_id = auth.uid()
    UNION
    SELECT tm.studio_id FROM public.team_members tm WHERE tm.email = auth.jwt()->>'email' AND tm.active = true
  )
);

CREATE POLICY "financial_categories_delete_by_studio_members" ON financial_categories FOR DELETE TO authenticated
USING (
  studio_id IN (
    SELECT us.studio_id FROM public.user_studios us WHERE us.user_id = auth.uid()
    UNION
    SELECT tm.studio_id FROM public.team_members tm WHERE tm.email = auth.jwt()->>'email' AND tm.active = true
  )
);

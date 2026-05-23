-- Migration to add whatsapp_reminder_template to business_settings
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_settings' AND column_name = 'whatsapp_reminder_template') THEN
        ALTER TABLE business_settings ADD COLUMN whatsapp_reminder_template TEXT DEFAULT 'Olá, {cliente}! Confirmamos seu agendamento de {servico} com {profissional} no dia {data} às {horario}. Para confirmar ou reagendar seu horário, use o link: {link_confirmacao}';
    END IF;
END $$;

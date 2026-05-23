-- Migration to create whatsapp_reminders_log to track WhatsApp reminders sent by Jaci IA
CREATE TABLE IF NOT EXISTS whatsapp_reminders_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    studio_id UUID,
    appointment_id UUID,
    client_name TEXT,
    phone TEXT,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    sender TEXT DEFAULT 'Jaci IA'
);

-- Enable RLS
ALTER TABLE whatsapp_reminders_log ENABLE ROW LEVEL SECURITY;

-- Drop policy if exists and create a permissive one for development and testing
DROP POLICY IF EXISTS "Allow all on whatsapp_reminders_log" ON whatsapp_reminders_log;
CREATE POLICY "Allow all on whatsapp_reminders_log" ON whatsapp_reminders_log
    FOR ALL
    USING (true)
    WITH CHECK (true);

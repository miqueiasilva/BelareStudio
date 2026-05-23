-- Migration to add whatsapp_reminder_number to business_settings
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_settings' AND column_name = 'whatsapp_reminder_number') THEN
        ALTER TABLE business_settings ADD COLUMN whatsapp_reminder_number TEXT DEFAULT '';
    END IF;
END $$;

-- Migration to add Meta WhatsApp Business API columns to business_settings
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_settings' AND column_name = 'meta_whatsapp_token') THEN
        ALTER TABLE business_settings ADD COLUMN meta_whatsapp_token TEXT DEFAULT '';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_settings' AND column_name = 'meta_whatsapp_phone_number_id') THEN
        ALTER TABLE business_settings ADD COLUMN meta_whatsapp_phone_number_id TEXT DEFAULT '';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_settings' AND column_name = 'meta_whatsapp_business_account_id') THEN
        ALTER TABLE business_settings ADD COLUMN meta_whatsapp_business_account_id TEXT DEFAULT '';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_settings' AND column_name = 'meta_whatsapp_template_name') THEN
        ALTER TABLE business_settings ADD COLUMN meta_whatsapp_template_name TEXT DEFAULT '';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_settings' AND column_name = 'meta_whatsapp_language') THEN
        ALTER TABLE business_settings ADD COLUMN meta_whatsapp_language TEXT DEFAULT 'pt_BR';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_settings' AND column_name = 'meta_whatsapp_active') THEN
        ALTER TABLE business_settings ADD COLUMN meta_whatsapp_active BOOLEAN DEFAULT false;
    END IF;
END $$;

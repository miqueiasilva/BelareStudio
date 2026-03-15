
-- Migration to add theme_color and discount_rules to studio_settings
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='studio_settings' AND column_name='theme_color') THEN
        ALTER TABLE studio_settings ADD COLUMN theme_color TEXT DEFAULT '#f97316';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='studio_settings' AND column_name='discount_rules') THEN
        ALTER TABLE studio_settings ADD COLUMN discount_rules JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

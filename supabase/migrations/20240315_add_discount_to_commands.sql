-- Migration to add discount fields to commands table
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'commands' AND column_name = 'discount_amount') THEN
        ALTER TABLE commands ADD COLUMN discount_amount NUMERIC DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'commands' AND column_name = 'discount_info') THEN
        ALTER TABLE commands ADD COLUMN discount_info JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;


-- 1. DESTRUIÇÃO TOTAL DE VERSÕES ANTERIORES
-- Remove qualquer assinatura existente para permitir a troca de tipos (ex: de bigint para uuid)
DROP FUNCTION IF EXISTS public.register_payment_transaction;

-- Limpeza profunda de overloads (garante que não reste lixo no catálogo do Postgres)
DO $$ 
DECLARE 
    _routine record;
BEGIN
    FOR _routine IN 
        SELECT oid::regprocedure as signature
        FROM pg_proc 
        WHERE proname = 'register_payment_transaction' 
        AND pronamespace = 'public'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION ' || _routine.signature;
    END LOOP;
END $$;

-- 2. RECRIAÇÃO COM ASSINATURA SINCRONIZADA (11 Parâmetros)
-- Os parâmetros seguem a ordem e nomes exatos enviados pelo Frontend
CREATE OR REPLACE FUNCTION public.register_payment_transaction(
  p_amount numeric,
  p_brand text DEFAULT NULL,           -- Solicitado: DEFAULT NULL
  p_client_id uuid DEFAULT NULL,        -- UUID Estrito
  p_command_id uuid DEFAULT NULL,       -- UUID Estrito
  p_description text DEFAULT 'Venda',
  p_fee_amount numeric DEFAULT 0,
  p_installments integer DEFAULT 1,     -- Solicitado: DEFAULT 1
  p_method text DEFAULT 'pix',
  p_net_value numeric DEFAULT 0,
  p_professional_id uuid DEFAULT NULL,  -- UUID Estrito
  p_studio_id uuid DEFAULT NULL         -- UUID Estrito
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transaction_id uuid;
BEGIN
  -- 3. INSERÇÃO DIRETA NAS COLUNAS UUID (Garante que IDs de mock não quebrem o banco)
  INSERT INTO public.financial_transactions (
    amount,
    net_value,
    fee_amount,
    payment_method,
    type,
    category,
    description,
    status,
    date,
    client_id,
    command_id,
    professional_id,
    studio_id
  ) VALUES (
    p_amount,
    p_net_value,
    p_fee_amount,
    p_method,
    'income',
    'Serviço',
    p_description,
    'pago',
    NOW(),
    p_client_id,
    p_command_id,
    p_professional_id,
    p_studio_id
  )
  RETURNING id INTO v_transaction_id;

  -- 4. ATUALIZAÇÃO DA COMANDA (Fluxo de liquidação)
  IF p_command_id IS NOT NULL THEN
    UPDATE public.commands 
    SET 
      status = 'paid', 
      closed_at = NOW(),
      total_amount = p_amount
    WHERE id = p_command_id;
  END IF;

  RETURN v_transaction_id;
END;
$$;

-- PERMISSÕES
GRANT EXECUTE ON FUNCTION public.register_payment_transaction TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_payment_transaction TO service_role;

-- 5. COMANDO CRÍTICO: Notifica o Supabase para recarregar o cache da API imediatamente
NOTIFY pgrst, 'reload schema';


-- 1. LIMPEZA PROFUNDA
-- Remove qualquer assinatura existente (uuid ou text) para evitar conflitos de overload no schema cache
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

-- 2. RECRIAÇÃO COM ASSINATURA COMPATÍVEL (Text para IDs)
-- Usar TEXT nos parâmetros de entrada é mais resiliente a strings vindas do JS
CREATE OR REPLACE FUNCTION public.register_payment_transaction(
  p_amount numeric,
  p_brand text DEFAULT NULL,
  p_client_id text DEFAULT NULL,
  p_command_id text DEFAULT NULL,
  p_description text DEFAULT 'Venda',
  p_fee_amount numeric DEFAULT 0,
  p_installments integer DEFAULT 1,
  p_method text DEFAULT 'pix',
  p_net_value numeric DEFAULT 0,
  p_professional_id text DEFAULT NULL,
  p_studio_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transaction_id uuid;
  v_u_client_id uuid;
  v_u_command_id uuid;
  v_u_professional_id uuid;
  v_u_studio_id uuid;
BEGIN
  -- Conversão segura: string vazia vira NULL, senão cast para UUID
  v_u_client_id := NULLIF(p_client_id, '')::uuid;
  v_u_command_id := NULLIF(p_command_id, '')::uuid;
  v_u_professional_id := NULLIF(p_professional_id, '')::uuid;
  v_u_studio_id := NULLIF(p_studio_id, '')::uuid;

  -- 3. INSERÇÃO NO FLUXO DE CAIXA
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
    v_u_client_id,
    v_u_command_id,
    v_u_professional_id,
    v_u_studio_id
  )
  RETURNING id INTO v_transaction_id;

  -- 4. ATUALIZAÇÃO DA COMANDA
  IF v_u_command_id IS NOT NULL THEN
    UPDATE public.commands 
    SET 
      status = 'paid', 
      closed_at = NOW(),
      total_amount = p_amount
    WHERE id = v_u_command_id;
  END IF;

  RETURN v_transaction_id;
END;
$$;

-- PERMISSÕES
GRANT EXECUTE ON FUNCTION public.register_payment_transaction TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_payment_transaction TO service_role;

-- 5. RECARGA DE CACHE (CRÍTICO para resolver o erro 404)
NOTIFY pgrst, 'reload schema';

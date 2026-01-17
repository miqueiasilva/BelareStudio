
-- 1. LIMPEZA RADICAL: Remove TODAS as assinaturas da função para evitar conflitos de tipos
DO $$ 
DECLARE 
    _func_name text := 'register_payment_transaction';
    _routine record;
BEGIN
    FOR _routine IN 
        SELECT oid::regprocedure as signature
        FROM pg_proc 
        WHERE proname = _func_name 
        AND pronamespace = 'public'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION ' || _routine.signature;
    END LOOP;
END $$;

-- 2. CRIAÇÃO DA FUNÇÃO COM PARÂMETROS UUID PUROS
CREATE OR REPLACE FUNCTION public.register_payment_transaction(
  p_amount numeric,
  p_brand text,
  p_client_id uuid,        -- Tipo UUID explícito
  p_command_id uuid,       -- Tipo UUID explícito
  p_description text,
  p_fee_amount numeric,
  p_installments integer,
  p_method text,
  p_net_value numeric,
  p_professional_id uuid,  -- Tipo UUID explícito
  p_studio_id uuid         -- Tipo UUID explícito
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transaction_id uuid;
BEGIN
  -- 3. INSERÇÃO DIRETA NA TABELA FINANCEIRA
  -- Os parâmetros já são UUID ou NULL::uuid, evitando erros de cast bigint
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

  -- 4. ATUALIZAÇÃO DA COMANDA (Se houver uma vinculada)
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

-- 5. PERMISSÕES
GRANT EXECUTE ON FUNCTION public.register_payment_transaction TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_payment_transaction TO service_role;

-- Notifica o PostgREST para atualizar o cache de funções
NOTIFY pgrst, 'reload schema';

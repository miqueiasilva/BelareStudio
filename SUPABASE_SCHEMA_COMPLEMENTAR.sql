
-- 1. DESTRUIÇÃO TOTAL: Garante que nenhuma versão antiga com parâmetros bigint ou text permaneça.
-- O PostgreSQL exige isso para mudar os tipos dos parâmetros de entrada da função.
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

-- 2. RECRIAÇÃO LIMPA: Definição dos parâmetros estritamente como UUID.
CREATE OR REPLACE FUNCTION public.register_payment_transaction(
  p_amount numeric,
  p_brand text,
  p_client_id uuid,        -- UUID puro, vindo direto do frontend
  p_command_id uuid,       -- UUID puro
  p_description text,
  p_fee_amount numeric,
  p_installments integer,
  p_method text,
  p_net_value numeric,
  p_professional_id uuid,  -- UUID puro, sem cast para bigint
  p_studio_id uuid         -- UUID puro
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transaction_id uuid;
BEGIN
  -- 3. INSERÇÃO DIRETA: Respeita a tipagem UUID das colunas da tabela financial_transactions.
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

  -- 4. ATUALIZAÇÃO DO STATUS DA COMANDA (SE EXISTIR)
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

-- 5. PERMISSÕES E SINCRONIZAÇÃO
GRANT EXECUTE ON FUNCTION public.register_payment_transaction TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_payment_transaction TO service_role;

-- Notifica o motor do Supabase (PostgREST) para atualizar seu mapa de tipos.
NOTIFY pgrst, 'reload schema';

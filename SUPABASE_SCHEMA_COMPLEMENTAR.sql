
-- 1. DESTRUIÇÃO EXPLÍCITA: Remove a função para permitir a troca de tipos de parâmetros
-- O Postgres não permite CREATE OR REPLACE se os tipos dos argumentos mudarem (ex: bigint para uuid)
DROP FUNCTION IF EXISTS public.register_payment_transaction(numeric,text,uuid,uuid,text,numeric,integer,text,numeric,uuid,uuid);
DROP FUNCTION IF EXISTS public.register_payment_transaction;

-- 2. LIMPEZA TOTAL DE OVERLOADS: Garante que nenhuma versão antiga (bigint/text) permaneça no cache
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

-- 3. RECRIAÇÃO LIMPA: Parâmetros UUID estritos para evitar erro "expression is of type bigint"
CREATE OR REPLACE FUNCTION public.register_payment_transaction(
  p_amount numeric,
  p_brand text,
  p_client_id uuid,        -- Tipo UUID obrigatório
  p_command_id uuid,       -- Tipo UUID obrigatório
  p_description text,
  p_fee_amount numeric,
  p_installments integer,
  p_method text,
  p_net_value numeric,
  p_professional_id uuid,  -- Tipo UUID obrigatório
  p_studio_id uuid         -- Tipo UUID obrigatório
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transaction_id uuid;
BEGIN
  -- 4. INSERÇÃO DIRETA: Sem casts manuais (::bigint), respeitando a tipagem da tabela
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

  -- 5. ATUALIZAÇÃO DA COMANDA (Fluxo de liquidação)
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

-- Notifica o PostgREST para recarregar as definições de tipo
NOTIFY pgrst, 'reload schema';

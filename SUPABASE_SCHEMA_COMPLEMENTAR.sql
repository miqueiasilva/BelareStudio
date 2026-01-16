
-- 1. LIMPEZA AGRESSIVA DE SOBRECARGAS (Evita erro 400 por ambiguidade)
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

-- 2. CRIAÇÃO DA FUNÇÃO DEFINITIVA COM TIPOS UUID
-- Recebemos parâmetros como TEXT no RPC para total flexibilidade do frontend
CREATE OR REPLACE FUNCTION public.register_payment_transaction(
  p_amount numeric,
  p_brand text,
  p_client_id text,        -- Recebe como texto para validação interna
  p_command_id text,       -- Recebe como texto para validação interna
  p_description text,
  p_fee_amount numeric,
  p_installments integer,
  p_method text,
  p_net_value numeric,
  p_professional_id text,  -- Recebe como texto para validação interna
  p_studio_id text         -- Recebe como texto para validação interna
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transaction_id uuid;
  v_client_uuid uuid;
  v_command_uuid uuid;
  v_professional_uuid uuid;
  v_studio_uuid uuid;
BEGIN
  -- 3. CASTING DEFENSIVO (Ajustado para o seu schema de UUID)
  -- Tenta converter strings para UUID. Se falhar (ex: "2433"), o valor fica NULL
  -- Isso evita o erro "expression is of type bigint/text but column is uuid"
  BEGIN v_client_uuid := p_client_id::uuid; EXCEPTION WHEN OTHERS THEN v_client_uuid := NULL; END;
  BEGIN v_command_uuid := p_command_id::uuid; EXCEPTION WHEN OTHERS THEN v_command_uuid := NULL; END;
  BEGIN v_professional_uuid := p_professional_id::uuid; EXCEPTION WHEN OTHERS THEN v_professional_uuid := NULL; END;
  BEGIN v_studio_uuid := p_studio_id::uuid; EXCEPTION WHEN OTHERS THEN v_studio_uuid := NULL; END;

  -- 4. INSERÇÃO NO FINANCEIRO
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
    v_client_uuid,
    v_command_uuid,
    v_professional_uuid,
    v_studio_uuid
  )
  RETURNING id INTO v_transaction_id;

  -- 5. ATUALIZAÇÃO DA COMANDA (Se ID for válido)
  IF v_command_uuid IS NOT NULL THEN
    UPDATE public.commands 
    SET 
      status = 'paid', 
      closed_at = NOW(),
      total_amount = p_amount
    WHERE id = v_command_uuid;
  END IF;

  RETURN v_transaction_id;
END;
$$;

-- 6. PERMISSÕES E RECARGA DE CACHE
GRANT EXECUTE ON FUNCTION public.register_payment_transaction TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_payment_transaction TO service_role;

NOTIFY pgrst, 'reload schema';

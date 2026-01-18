
-- =============================================================================
-- 1. LIMPEZA RADICAL DE FUNÇÕES CONFLITANTES
-- =============================================================================
DO $$ 
DECLARE 
    _routine record;
BEGIN
    FOR _routine IN 
        SELECT oid::regprocedure as signature
        FROM pg_proc 
        WHERE (proname = 'register_payment_transaction' 
           OR proname = 'pay_and_close_command'
           OR proname = 'pay_latest_open_command_v6')
        AND pronamespace = 'public'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION ' || _routine.signature || ' CASCADE';
    END LOOP;
END $$;

-- =============================================================================
-- 2. FUNÇÃO AUXILIAR: CAST SEGURO DE TEXTO PARA UUID
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_safe_uuid(p_val text)
RETURNS uuid AS $$
BEGIN
    IF p_val IS NULL OR p_val = '' OR p_val = 'null' OR p_val = 'undefined' THEN RETURN NULL; END IF;
    IF p_val ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        RETURN p_val::uuid;
    ELSE
        RETURN NULL;
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================================================
-- 3. FUNÇÃO MESTRA: register_payment_transaction (VERSÃO BLINDADA)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.register_payment_transaction(
  p_amount numeric,
  p_method text DEFAULT 'pix',
  p_brand text DEFAULT NULL,
  p_installments integer DEFAULT 1,
  p_description text DEFAULT 'Venda',
  p_client_id text DEFAULT NULL,
  p_command_id text DEFAULT NULL,
  p_studio_id text DEFAULT NULL,
  p_professional_id text DEFAULT NULL,
  p_payment_method_config_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cmd_id uuid;
  v_std_id uuid;
  v_prof_id uuid;
  v_config_id uuid;
  v_clt_id uuid;
  v_fee_rate numeric := 0;
  v_fee_amount numeric := 0;
  v_net_value numeric;
  v_payment_id uuid;
  v_total_command_value numeric;
  v_total_paid_so_far numeric;
BEGIN
  -- A. Sanitização de IDs (Tolerância total a strings vindas do JS)
  v_cmd_id    := public.fn_safe_uuid(p_command_id);
  v_std_id    := public.fn_safe_uuid(p_studio_id);
  v_prof_id   := public.fn_safe_uuid(p_professional_id);
  v_config_id := public.fn_safe_uuid(p_payment_method_config_id);
  v_clt_id    := public.fn_safe_uuid(p_client_id);

  -- B. Resolução da Configuração de Taxas
  IF v_config_id IS NULL THEN
    SELECT id INTO v_config_id 
    FROM public.payment_methods_config 
    WHERE studio_id = v_std_id 
      AND type = p_method 
      AND (brand = p_brand OR brand IS NULL)
      AND is_active = true
    LIMIT 1;
  END IF;

  -- C. Motor de Cálculo Financeiro
  IF v_config_id IS NOT NULL THEN
    -- Tenta obter taxa via função auxiliar ou valor padrão 0
    BEGIN
        v_fee_rate := public.fn_get_installment_fee_rate(v_config_id, p_installments);
    EXCEPTION WHEN OTHERS THEN
        v_fee_rate := 0;
    END;
  END IF;

  v_fee_amount := p_amount * (v_fee_rate / 100.0);
  v_net_value  := p_amount - v_fee_amount;

  -- D. Persistência na tabela de pagamentos da comanda
  INSERT INTO public.command_payments (
    amount,
    net_value,
    fee_amount,
    fee_rate,
    method_id,
    command_id,
    studio_id,
    status,
    brand,
    installments,
    professional_id,
    created_at
  ) VALUES (
    p_amount,
    v_net_value,
    v_fee_amount,
    v_fee_rate,
    v_config_id,
    v_cmd_id,
    v_std_id,
    'paid',
    p_brand,
    p_installments,
    v_prof_id,
    NOW()
  ) RETURNING id INTO v_payment_id;

  -- E. Registro no Fluxo de Caixa (financial_transactions)
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
    v_net_value,
    v_fee_amount,
    p_method,
    'income',
    'Serviço',
    p_description,
    'pago',
    NOW(),
    v_clt_id,
    v_cmd_id,
    v_prof_id,
    v_std_id
  );

  -- F. Automação de Status da Comanda
  IF v_cmd_id IS NOT NULL THEN
    SELECT total_amount INTO v_total_command_value FROM public.commands WHERE id = v_cmd_id;
    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid_so_far FROM public.command_payments WHERE command_id = v_cmd_id AND status = 'paid';

    IF v_total_paid_so_far >= v_total_command_value THEN
        UPDATE public.commands SET status = 'paid', closed_at = NOW() WHERE id = v_cmd_id;
    END IF;
  END IF;

  RETURN v_payment_id;
END;
$$;

-- =============================================================================
-- 4. FUNÇÃO WRAPPER: pay_latest_open_command_v6
-- =============================================================================
CREATE OR REPLACE FUNCTION public.pay_latest_open_command_v6(
    p_amount numeric,
    p_method text,
    p_brand text DEFAULT NULL,
    p_installments integer DEFAULT 1
)
RETURNS uuid AS $$
DECLARE
    v_target_command_id uuid;
    v_studio_id uuid;
BEGIN
    -- Busca studio_id do perfil do usuário logado
    SELECT studio_id INTO v_studio_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;

    SELECT id INTO v_target_command_id
    FROM public.commands
    WHERE studio_id = v_studio_id AND status = 'open'
    ORDER BY created_at DESC LIMIT 1;

    IF v_target_command_id IS NULL THEN
        RAISE EXCEPTION 'Nenhuma comanda aberta encontrada.';
    END IF;

    RETURN public.register_payment_transaction(
        p_amount => p_amount,
        p_method => p_method,
        p_brand => p_brand,
        p_installments => p_installments,
        p_command_id => v_target_command_id::text,
        p_studio_id => v_studio_id::text
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.register_payment_transaction TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_payment_transaction TO service_role;
GRANT EXECUTE ON FUNCTION public.pay_latest_open_command_v6 TO authenticated;

NOTIFY pgrst, 'reload schema';

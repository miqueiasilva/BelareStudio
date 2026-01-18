
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
           OR proname = 'register_payment_transaction_v2'
           OR proname = 'pay_and_close_command'
           OR proname = 'pay_latest_open_command_v6')
        AND pronamespace = 'public'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION ' || _routine.signature || ' CASCADE';
    END LOOP;
END $$;

-- =============================================================================
-- 2. FUNÇÃO MESTRA: register_payment_transaction_v2 (ISOLADA E SEGURA)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.register_payment_transaction_v2(
  p_studio_id uuid,
  p_professional_id uuid,
  p_amount numeric,
  p_method text,
  p_brand text,
  p_installments integer,
  p_command_id uuid DEFAULT NULL,
  p_client_id bigint DEFAULT NULL,
  p_description text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payment_id uuid;
  v_transaction_id uuid;
  v_config_id uuid;
  v_fee_rate numeric := 0;
  v_fee_amount numeric := 0;
  v_net_value numeric;
  v_total_command_value numeric;
  v_total_paid_so_far numeric;
  v_installment_rates jsonb;
BEGIN
  -- 1. Resolução Interna de Taxas (Evita lookup externo/loop)
  SELECT id, rate_cash, installment_rates 
  INTO v_config_id, v_fee_rate, v_installment_rates
  FROM public.payment_methods_config
  WHERE studio_id = p_studio_id 
    AND type = p_method 
    AND (brand = p_brand OR brand IS NULL OR p_brand = '')
    AND is_active = true
  ORDER BY (brand = p_brand) DESC
  LIMIT 1;

  -- Ajuste de taxa para parcelamento
  IF p_installments > 1 AND v_installment_rates ? p_installments::text THEN
    v_fee_rate := (v_installment_rates->>p_installments::text)::numeric;
  END IF;

  v_fee_amount := p_amount * (COALESCE(v_fee_rate, 0) / 100.0);
  v_net_value  := p_amount - v_fee_amount;

  -- 2. Registro no Fluxo de Caixa (financial_transactions)
  -- Inserção explícita ignorando triggers via lógica interna se necessário
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
    COALESCE(p_description, 'Venda via Checkout V2'),
    'pago',
    NOW(),
    p_client_id,
    p_command_id,
    p_professional_id,
    p_studio_id
  ) RETURNING id INTO v_transaction_id;

  -- 3. Registro do Pagamento vinculado à Comanda (se houver)
  IF p_command_id IS NOT NULL THEN
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
      financial_transaction_id,
      created_at
    ) VALUES (
      p_amount,
      v_net_value,
      v_fee_amount,
      COALESCE(v_fee_rate, 0),
      v_config_id,
      p_command_id,
      p_studio_id,
      'paid',
      p_brand,
      p_installments,
      p_professional_id,
      v_transaction_id,
      NOW()
    ) RETURNING id INTO v_payment_id;

    -- 4. Verificação de Quitação da Comanda
    SELECT total_amount INTO v_total_command_value FROM public.commands WHERE id = p_command_id;
    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid_so_far FROM public.command_payments WHERE command_id = p_command_id AND status = 'paid';

    IF v_total_paid_so_far >= v_total_command_value THEN
        UPDATE public.commands SET status = 'paid', closed_at = NOW() WHERE id = p_command_id;
    END IF;
  END IF;

  RETURN json_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'payment_id', v_payment_id,
    'command_id', p_command_id
  );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.register_payment_transaction_v2 TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_payment_transaction_v2 TO service_role;

NOTIFY pgrst, 'reload schema';

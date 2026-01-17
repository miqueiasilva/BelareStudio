
-- 1. Limpeza de versões anteriores
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

-- 2. Função de Registro de Pagamento Enriquecida
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
  v_u_client_id := NULLIF(p_client_id, '')::uuid;
  v_u_command_id := NULLIF(p_command_id, '')::uuid;
  v_u_professional_id := NULLIF(p_professional_id, '')::uuid;
  v_u_studio_id := NULLIF(p_studio_id, '')::uuid;

  INSERT INTO public.financial_transactions (
    amount,        -- Valor Bruto (Gross)
    net_value,     -- Valor Líquido (Net)
    fee_amount,    -- Valor da Taxa
    payment_method,-- Enum original
    payment_brand, -- Bandeira
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
    COALESCE(p_net_value, p_amount),
    COALESCE(p_fee_amount, 0),
    p_method,
    p_brand,
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

  RETURN v_transaction_id;
END;
$$;

-- 3. View de Fluxo de Caixa para Performance e Labels Amigáveis
CREATE OR REPLACE VIEW public.v_cashflow AS
SELECT 
    ft.id as transaction_id,
    ft.date,
    ft.description,
    ft.amount as gross_value,
    ft.fee_amount,
    ft.net_value,
    ft.type,
    ft.studio_id,
    COALESCE(c.nome, c.name, 'Consumidor Final') as client_display_name,
    UPPER(
        CASE 
            WHEN ft.payment_method = 'cash' THEN 'DINHEIRO'
            WHEN ft.payment_method = 'pix' THEN 'PIX'
            WHEN ft.payment_method = 'credit' THEN 'CRÉDITO'
            WHEN ft.payment_method = 'debit' THEN 'DÉBITO'
            ELSE ft.payment_method 
        END
    ) as payment_channel,
    ft.payment_brand as brand
FROM public.financial_transactions ft
LEFT JOIN public.clients c ON ft.client_id = c.id;

GRANT SELECT ON public.v_cashflow TO authenticated;
NOTIFY pgrst, 'reload schema';

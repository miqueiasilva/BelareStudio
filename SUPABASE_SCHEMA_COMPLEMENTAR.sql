
-- 1. VIEW para Histórico de Pagamentos na Comanda (Enriquecida)
CREATE OR REPLACE VIEW public.v_command_payments_history AS
SELECT 
    cp.id,
    cp.command_id,
    cp.gross_amount,
    cp.fee_amount,
    cp.net_amount,
    cp.method,
    cp.brand,
    cp.installments,
    cp.created_at,
    COALESCE(c.nome, c.name, 'Consumidor Final') as client_name,
    p.name as professional_name
FROM public.command_payments cp
LEFT JOIN public.commands cmd ON cp.command_id = cmd.id
LEFT JOIN public.clients c ON cmd.client_id = c.id
LEFT JOIN public.professionals p ON cmd.professional_id = p.uuid_id;

-- 2. VIEW para Fluxo de Caixa (Detalhamento Contábil)
CREATE OR REPLACE VIEW public.v_cashflow_detailed AS
SELECT 
    ft.id as transaction_id,
    ft.date,
    ft.description,
    ft.amount as gross_value,
    ft.fee_amount,
    ft.net_value,
    ft.type,
    ft.studio_id,
    ft.status,
    COALESCE(cl.nome, cl.name, 'Consumidor Final') as client_display_name,
    UPPER(
        CASE 
            WHEN ft.payment_method = 'cash' THEN 'DINHEIRO'
            WHEN ft.payment_method = 'pix' THEN 'PIX'
            WHEN ft.payment_method = 'credit' THEN 'CRÉDITO'
            WHEN ft.payment_method = 'debit' THEN 'DÉBITO'
            ELSE COALESCE(ft.payment_method, 'OUTRO')
        END
    ) as payment_channel,
    ft.payment_brand as brand
FROM public.financial_transactions ft
LEFT JOIN public.clients cl ON ft.client_id = cl.id;

GRANT SELECT ON public.v_command_payments_history TO authenticated;
GRANT SELECT ON public.v_cashflow_detailed TO authenticated;

-- Notificar recarga de schema para o PostgREST
NOTIFY pgrst, 'reload schema';

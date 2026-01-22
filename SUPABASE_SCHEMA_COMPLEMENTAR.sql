
-- =============================================================================
-- (A) SQL COMPLETO DE ESTABILIZAÇÃO E BLINDAGEM EM PRODUÇÃO
-- =============================================================================

-- 1. CONFIGURAÇÃO DA FUNÇÃO OFICIAL (v2)
-- Localiza a assinatura exata e aplica restrições de segurança e acesso.
DO $$ 
DECLARE 
    _sig text;
BEGIN
    SELECT oid::regprocedure::text INTO _sig 
    FROM pg_proc 
    WHERE proname = 'register_payment_transaction_v2' 
    AND pronamespace = 'public'::regnamespace;

    IF _sig IS NOT NULL THEN
        -- SECURITY DEFINER: Permite que a função execute inserts em tabelas financeiras ignorando políticas restritivas do usuário comum
        -- SET search_path: Proteção contra ataques de schema injection
        EXECUTE 'ALTER FUNCTION ' || _sig || ' SECURITY DEFINER SET search_path = public';
        
        -- GRANTS: Limita quem pode invocar a função (Apenas usuários autenticados e o sistema)
        EXECUTE 'REVOKE ALL ON FUNCTION ' || _sig || ' FROM public';
        EXECUTE 'GRANT EXECUTE ON FUNCTION ' || _sig || ' TO authenticated, service_role';
        
        RAISE NOTICE 'Sucesso: Função % configurada como OFICIAL.', _sig;
    ELSE
        RAISE EXCEPTION 'Erro Crítico: Função register_payment_transaction_v2 não encontrada no schema public.';
    END IF;
END $$;

-- 2. DESATIVAÇÃO DE FUNÇÕES LEGADAS (Segurança por revogação de EXECUTE)
DO $$ 
DECLARE 
    _legacy record;
BEGIN
    FOR _legacy IN 
        SELECT oid::regprocedure as sig
        FROM pg_proc 
        WHERE (proname IN ('register_payment_transaction', 'pay_latest_open_command_v6') 
           OR proname LIKE 'pay_and_close_command%')
        AND proname != 'register_payment_transaction_v2'
        AND pronamespace = 'public'::regnamespace
    LOOP
        EXECUTE 'REVOKE EXECUTE ON FUNCTION ' || _legacy.sig || ' FROM authenticated, public';
        RAISE NOTICE 'Acesso revogado para função legada: %', _legacy.sig;
    END LOOP;
END $$;

-- 3. NORMALIZAÇÃO RETROATIVA DE DATA INTEGRITY
-- Garante que todos os registros históricos usem o uuid_id canônico da tabela professionals.
BEGIN;

-- Normalizar Comandas
UPDATE public.commands c
SET professional_id = p.uuid_id
FROM public.professionals p
WHERE (c.professional_id = p.team_member_id OR c.professional_id = p.professional_uuid)
  AND c.professional_id != p.uuid_id;

-- Normalizar Agendamentos
UPDATE public.appointments a
SET professional_id = p.uuid_id
FROM public.professionals p
WHERE (a.professional_id = p.team_member_id OR a.professional_id = p.professional_uuid)
  AND a.professional_id != p.uuid_id;

COMMIT;

-- 4. RE-NOTIFICAÇÃO DE SCHEMA PARA O POSTGREST (Limpeza de Cache de API)
NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- (B) SMOKE TESTS (Copie e rode no SQL Editor do Supabase)
-- =============================================================================
/*
-- TESTE 1: Verificar se restaram IDs não-canônicos (Deve retornar 0)
SELECT count(*) as "Comandas_Invalidas"
FROM public.commands c
LEFT JOIN public.professionals p ON p.uuid_id = c.professional_id
WHERE c.professional_id IS NOT NULL AND p.uuid_id IS NULL;

-- TESTE 2: Validar privilégios da v2 (Deve listar apenas authenticated e service_role)
SELECT grantee, privilege_type 
FROM information_schema.role_routine_grants 
WHERE routine_name = 'register_payment_transaction_v2';
*/

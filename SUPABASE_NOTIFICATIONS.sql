
-- Tabela para persistir o estado de leitura das notificações
CREATE TABLE IF NOT EXISTS public.notification_reads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    notification_key TEXT NOT NULL,
    read_at TIMESTAMPTZ DEFAULT now(),
    studio_id TEXT NOT NULL, -- Usando TEXT para compatibilidade com o activeStudioId que pode ser slug ou UUID
    
    -- Garante que um usuário não tenha duplicatas para a mesma notificação no mesmo estúdio
    UNIQUE(user_id, notification_key, studio_id)
);

-- Ativar RLS
ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;

-- Políticas de Segurança
CREATE POLICY "Usuários podem ver suas próprias leituras"
ON public.notification_reads FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem registrar suas próprias leituras"
ON public.notification_reads FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar suas próprias leituras"
ON public.notification_reads FOR DELETE
USING (auth.uid() = user_id);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_notification_reads_user_studio ON public.notification_reads(user_id, studio_id);
CREATE INDEX IF NOT EXISTS idx_notification_reads_key ON public.notification_reads(notification_key);

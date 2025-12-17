
import { GoogleGenAI, Type } from "@google/genai";
import { initialAppointments, mockTransactions, clients, professionals } from "../data/mockData";
import { format, isSameDay } from "date-fns";

// --- Configuration ---
// Função segura para obter a chave de API em diferentes ambientes (Vite, Next, Node, Vanilla)
const getApiKey = () => {
    try {
        // @ts-ignore
        if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
            // @ts-ignore
            return process.env.API_KEY;
        }
        // @ts-ignore
        if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_KEY) {
            // @ts-ignore
            return import.meta.env.VITE_API_KEY;
        }
    } catch (e) {
        console.warn("Ambiente não suporta acesso a variáveis de ambiente padrão.");
    }
    return null;
};

const apiKey = getApiKey();
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
const modelId = "gemini-2.5-flash";

// --- Fallback Data (Usado se a API falhar ou estiver sem chave) ---
const insightsFallback = [
    "O faturamento deste mês está 15% acima da meta! Considere oferecer um bônus para a equipe.",
    "A taxa de ocupação nas terças-feiras está baixa. Sugiro criar uma promoção 'Terça em Dobro'.",
    "Clientes que fazem 'Corte e Barba' costumam retornar a cada 25 dias. Envie um lembrete automático.",
    "A profissional Maria Silva teve a maior média de avaliação (4.9 estrelas) este mês.",
];

const topicInsightsFallback: Record<string, string[]> = {
    financeiro: ["Revise os gastos com insumos, subiram 10%.", "Fluxo de caixa positivo para a semana."],
    agenda: ["Sexta-feira está quase lotada, prepare a equipe.", "Muitos buracos na agenda de amanhã à tarde."],
    clientes: ["3 aniversariantes hoje, envie parabéns!", "Cliente João não vem há 45 dias."],
    marketing: ["A campanha de Botox teve bom retorno.", "Impulsione o post do Instagram hoje."]
};

const getRandomItem = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const simulateApiCall = <T,>(data: T, delay?: number): Promise<T> => {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve(data);
        }, delay ?? 800 + Math.random() * 500);
    });
};

// --- Real AI Implementations ---

export const getDashboardInsight = async (): Promise<string> => {
    if (!ai) return simulateApiCall(getRandomItem(insightsFallback));

    try {
        // Constrói um contexto resumido do estado atual do app
        const today = new Date();
        const totalAppointments = initialAppointments.length;
        const totalClients = clients.length;
        const activeProfs = professionals.length;
        
        const prompt = `
            Você é a JaciBot, uma consultora IA experiente e motivadora para um estúdio de beleza.
            
            Dados atuais do estúdio (hoje ${format(today, "dd/MM/yyyy")}):
            - Atendimentos na agenda: ${totalAppointments}
            - Base de clientes: ${totalClients}
            - Profissionais ativos: ${activeProfs}
            
            Tarefa: Gere um insight curto (máximo 1 frase), estratégico ou motivacional para a dona do salão ler agora no painel principal.
            Exemplo: "Sua agenda está cheia hoje, ótimo trabalho na retenção de clientes!"
        `;

        const response = await ai.models.generateContent({
            model: modelId,
            contents: prompt,
        });

        return response.text || getRandomItem(insightsFallback);
    } catch (error) {
        console.error("JaciBot AI Error:", error);
        return getRandomItem(insightsFallback);
    }
};

export const getInsightByTopic = async (topic: string): Promise<string> => {
    if (!ai) return simulateApiCall(getRandomItem(topicInsightsFallback[topic] || insightsFallback));

    try {
        const prompt = `
            Você é a JaciBot. O usuário pediu uma análise rápida sobre o tópico: "${topic}".
            Gere uma dica, observação ou alerta útil sobre esse tema para um salão de beleza moderno.
            Mantenha curto (máx 20 palavras) e direto.
        `;

        const response = await ai.models.generateContent({
            model: modelId,
            contents: prompt,
        });

        return response.text || getRandomItem(topicInsightsFallback[topic] || insightsFallback);
    } catch (error) {
        return getRandomItem(topicInsightsFallback[topic] || insightsFallback);
    }
};

export const getFinancialAlert = async (): Promise<string> => {
    // Mantendo simulação para alertas críticos por enquanto para garantir estabilidade visual
    const alerts = [
        "Divergência detectada no fechamento de ontem: -R$ 15,50.",
        "Estoque crítico: Pomada Modeladora (2 un).",
        "Conta de Luz vence amanhã."
    ];
    return simulateApiCall(getRandomItem(alerts));
};

export const getClientCampaignSuggestion = async (clientName: string): Promise<string> => {
    if (!ai) {
        return simulateApiCall(`Olá ${clientName}, sentimos sua falta! Que tal agendar um horário essa semana com 10% off?`);
    }

    try {
        const response = await ai.models.generateContent({
            model: modelId,
            contents: `Crie uma mensagem curta de marketing (WhatsApp) para o cliente "${clientName}" que não aparece há 30 dias. Ofereça um incentivo sutil e seja carinhosa. Sem hashtags.`
        });
        return response.text || "";
    } catch (e) {
        return `Oi ${clientName}, faz tempo que não te vemos! Venha realçar sua beleza conosco.`;
    }
};

// --- JaciBot Action Functions ---

export const suggestSmartSlots = async (date: Date): Promise<string[]> => {
    console.log(`[JaciBot] Buscando encaixes inteligentes para ${date.toISOString()}`);
    
    if (!ai) {
        const slots = [
            "Jaciene Félix: 14:30 - 15:00 (ideal para Design Simples)",
            "Jéssica Félix: 11:20 - 12:00 (vago após Volume EGÍPCIO)",
            "Elá Priscila: 16:00 - 17:00 (encaixe para Limpeza de Pele)"
        ];
        return simulateApiCall(slots, 1200);
    }

    try {
        // Envia um resumo simplificado da agenda para a IA encontrar buracos
        const scheduleContext = initialAppointments
            .slice(0, 15) 
            .map(a => `${a.professional.name}: ${format(a.start, 'HH:mm')} - ${format(a.end, 'HH:mm')}`)
            .join('\n');

        const response = await ai.models.generateContent({
            model: modelId,
            contents: `
                Analise esta lista de horários ocupados hoje:
                ${scheduleContext}
                
                Sugira 3 oportunidades de "encaixe" (gaps de tempo) onde caberia um serviço rápido (30min).
                Se não houver dados suficientes, invente 3 horários plausíveis baseados em um salão movimentado.
                Retorne APENAS um Array JSON de strings.
            `,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                }
            }
        });

        const jsonStr = response.text;
        return jsonStr ? JSON.parse(jsonStr) : [];
    } catch (error) {
        console.error("AI Smart Slots Error", error);
        return ["Sugestão AI indisponível no momento."];
    }
}

export const enqueueReminder = async (appointmentId: number, type: 'confirmacao' | 'lembrete' | 'pos' | 'aniversario' | 'retorno'): Promise<{ success: boolean; message: string }> => {
    if (!ai) {
        const logMessage = `[JaciBot Mock] Lembrete '${type}' para agendamento #${appointmentId} enfileirado.`;
        return simulateApiCall({ success: true, message: logMessage });
    }

    try {
        const response = await ai.models.generateContent({
            model: modelId,
            contents: `Gere uma mensagem curta, cordial e profissional de WhatsApp para um cliente de salão de beleza sobre: ${type}. Apenas o texto da mensagem.`
        });
        
        return { 
            success: true, 
            message: `[JaciBot] Mensagem gerada: "${response.text?.trim()}"` 
        };
    } catch (e) {
        return { success: false, message: "Erro ao gerar mensagem via AI." };
    }
}

export const autoCashClose = async (date: Date): Promise<{ totalPrevisto: number; totalRecebido: number; diferenca: number; resumo: string }> => {
    
    // Calcula totais baseados nos dados mockados
    const income = mockTransactions
        .filter(t => t.type === 'receita' && isSameDay(new Date(t.date), date) || true) // Mock: pega tudo para demonstração
        .reduce((sum, t) => sum + t.amount, 0);
    
    const result = {
        totalPrevisto: income,
        totalRecebido: income, 
        diferenca: 0.00,
        resumo: ""
    };

    if (!ai) {
        result.resumo = "Caixa fechado com sucesso. Todos os pagamentos reconciliados (Simulação).";
        return simulateApiCall(result, 1500);
    }

    try {
        const response = await ai.models.generateContent({
            model: modelId,
            contents: `
                Atue como uma auditora financeira de um salão.
                Total Receitas do dia: R$ ${income.toFixed(2)}.
                Diferença de caixa: R$ 0,00.
                Gere um resumo executivo de 1 frase confirmando o fechamento positivo e elogiando a gestão.
            `
        });
        result.resumo = response.text || "Fechamento realizado com sucesso.";
        return result;
    } catch (e) {
        result.resumo = "Fechamento realizado (AI Offline).";
        return result;
    }
}

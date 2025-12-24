
import { GoogleGenAI, Type } from "@google/genai";
import { initialAppointments, mockTransactions, clients, professionals } from "../data/mockData";
import { format, isSameDay } from "date-fns";

// --- Padrão Lazy Singleton para Estabilidade ---

let aiInstance: GoogleGenAI | null = null;
const modelId = "gemini-3-flash-preview";

/**
 * Obtém a instância do SDK apenas quando necessário.
 * Evita crash global se a chave estiver ausente.
 */
const getAIClient = () => {
    if (aiInstance) return aiInstance;
    
    const apiKey = process.env.API_KEY;
    if (!apiKey || apiKey === 'undefined') {
        console.warn("JaciBot: Chave de API não configurada. Operando em modo de fallback.");
        return null;
    }

    try {
        aiInstance = new GoogleGenAI({ apiKey });
        return aiInstance;
    } catch (e) {
        console.error("JaciBot: Erro ao inicializar SDK da Google GenAI", e);
        return null;
    }
};

// --- Dados de Fallback (Segurança de Interface) ---

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

// --- Implementações Blindadas (Public API) ---

export const getDashboardInsight = async (): Promise<string> => {
    const ai = getAIClient();
    if (!ai) return getRandomItem(insightsFallback);

    try {
        const today = new Date();
        const context = `Atendimentos: ${initialAppointments.length}, Clientes: ${clients.length}, Profissionais: ${professionals.length}`;
        
        const response = await ai.models.generateContent({
            model: modelId,
            contents: `Você é a JaciBot, consultora IA de beleza. Dados hoje (${format(today, "dd/MM")}): ${context}. Gere um insight estratégico de 1 frase.`,
        });

        return response.text || getRandomItem(insightsFallback);
    } catch (error) {
        console.error("JaciBot Error:", error);
        return getRandomItem(insightsFallback);
    }
};

export const getInsightByTopic = async (topic: string): Promise<string> => {
    const ai = getAIClient();
    if (!ai) return getRandomItem(topicInsightsFallback[topic] || insightsFallback);

    try {
        const response = await ai.models.generateContent({
            model: modelId,
            contents: `JaciBot, forneça uma dica rápida (máx 15 palavras) sobre o tópico: "${topic}" para um salão de beleza moderno.`,
        });

        return response.text || getRandomItem(topicInsightsFallback[topic] || insightsFallback);
    } catch (error) {
        return getRandomItem(topicInsightsFallback[topic] || insightsFallback);
    }
};

export const suggestSmartSlots = async (date: Date): Promise<string[]> => {
    const ai = getAIClient();
    const fallbackSlots = ["10:00 - Design Sobrancelha", "14:30 - Manicure", "16:00 - Corte"];
    
    if (!ai) return fallbackSlots;
    
    try {
        const response = await ai.models.generateContent({
            model: modelId,
            contents: `Analise a agenda e sugira 3 horários de encaixe plausíveis para hoje. Retorne APENAS um Array JSON de strings.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                }
            }
        });

        const jsonStr = response.text;
        return jsonStr ? JSON.parse(jsonStr) : fallbackSlots;
    } catch (error) {
        return fallbackSlots;
    }
};

export const enqueueReminder = async (appointmentId: number, type: string): Promise<{ success: boolean; message: string }> => {
    const ai = getAIClient();
    if (!ai) return { success: true, message: "[Modo Offline] Lembrete padrão agendado para o cliente." };

    try {
        const response = await ai.models.generateContent({
            model: modelId,
            contents: `Gere uma mensagem curta e cordial de WhatsApp para um cliente sobre: ${type}. Apenas o texto.`
        });
        
        return { 
            success: true, 
            message: `[JaciBot] Mensagem gerada: "${response.text?.trim()}"` 
        };
    } catch (e) {
        return { success: false, message: "Erro ao gerar mensagem via IA." };
    }
};

export const autoCashClose = async (date: Date): Promise<{ totalPrevisto: number; totalRecebido: number; diferenca: number; resumo: string }> => {
    const ai = getAIClient();
    const income = mockTransactions
        .filter(t => t.type === 'receita')
        .reduce((sum, t) => sum + t.amount, 0);
    
    const result = {
        totalPrevisto: income,
        totalRecebido: income, 
        diferenca: 0,
        resumo: "Fechamento realizado com sucesso baseados nos lançamentos do sistema."
    };

    if (!ai) return result;

    try {
        const response = await ai.models.generateContent({
            model: modelId,
            contents: `Resumo financeiro: R$ ${income.toFixed(2)}. Diferença zero. Gere um elogio executivo curto de 1 frase para a gerente.`
        });
        result.resumo = response.text || result.resumo;
        return result;
    } catch (e) {
        return result;
    }
};

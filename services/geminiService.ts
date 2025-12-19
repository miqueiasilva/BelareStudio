import { GoogleGenAI, Type } from "@google/genai";
import { initialAppointments, mockTransactions, clients, professionals } from "../data/mockData";
import { format, isSameDay } from "date-fns";

// --- Segurança de Inicialização ---

let aiInstance: GoogleGenAI | null = null;
const modelId = "gemini-3-flash-preview";

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

// --- Fallback Data ---
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

// --- Real AI Implementations com Safety Gates ---

export const getDashboardInsight = async (): Promise<string> => {
    const ai = getAIClient();
    if (!ai) return getRandomItem(insightsFallback);

    try {
        const today = new Date();
        const context = `Atendimentos: ${initialAppointments.length}, Clientes: ${clients.length}, Profissionais: ${professionals.length}`;
        
        const response = await ai.models.generateContent({
            model: modelId,
            contents: `Você é a JaciBot. Dados do estúdio hoje (${format(today, "dd/MM")}): ${context}. Gere um insight curto e estratégico de 1 frase.`,
        });

        return response.text || getRandomItem(insightsFallback);
    } catch (error) {
        return getRandomItem(insightsFallback);
    }
};

export const getInsightByTopic = async (topic: string): Promise<string> => {
    const ai = getAIClient();
    if (!ai) return getRandomItem(topicInsightsFallback[topic] || insightsFallback);

    try {
        const response = await ai.models.generateContent({
            model: modelId,
            contents: `JaciBot, dica rápida (máx 15 palavras) sobre: ${topic} para um salão de beleza.`,
        });

        return response.text || getRandomItem(topicInsightsFallback[topic] || insightsFallback);
    } catch (error) {
        return getRandomItem(topicInsightsFallback[topic] || insightsFallback);
    }
};

export const suggestSmartSlots = async (date: Date): Promise<string[]> => {
    const ai = getAIClient();
    if (!ai) return ["10:00 - Design Sobrancelha", "14:30 - Manicure", "16:00 - Corte"];
    
    try {
        const response = await ai.models.generateContent({
            model: modelId,
            contents: `Sugira 3 horários livres plausíveis para hoje. Retorne APENAS um Array JSON de strings.`,
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
        return ["Sugestão AI indisponível."];
    }
}

export const enqueueReminder = async (appointmentId: number, type: string): Promise<{ success: boolean; message: string }> => {
    const ai = getAIClient();
    if (!ai) return { success: true, message: "[Fallback] Lembrete padrão agendado." };

    try {
        const response = await ai.models.generateContent({
            model: modelId,
            contents: `Crie uma mensagem curta de WhatsApp para: ${type}. Apenas o texto.`
        });
        
        return { success: true, message: `[JaciBot] ${response.text?.trim()}` };
    } catch (e) {
        return { success: false, message: "Erro ao gerar mensagem via AI." };
    }
}

export const autoCashClose = async (date: Date): Promise<{ totalPrevisto: number; totalRecebido: number; diferenca: number; resumo: string }> => {
    const ai = getAIClient();
    const income = mockTransactions
        .filter(t => t.type === 'receita')
        .reduce((sum, t) => sum + t.amount, 0);
    
    const result = { totalPrevisto: income, totalRecebido: income,  diferenca: 0, resumo: "Fechamento realizado." };

    if (!ai) return result;

    try {
        const response = await ai.models.generateContent({
            model: modelId,
            contents: `Resumo financeiro: R$ ${income.toFixed(2)}. Diferença: 0. Gere um elogio curto de 1 frase.`
        });
        result.resumo = response.text || result.resumo;
        return result;
    } catch (e) {
        return result;
    }
}
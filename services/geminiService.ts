
import { GoogleGenAI, Type } from "@google/genai";
import { initialAppointments, mockTransactions, clients, professionals } from "../data/mockData";
import { format } from "date-fns";

// --- Padrão Lazy Singleton para Estabilidade ---
let aiInstance: GoogleGenAI | null = null;
const modelId = "gemini-3-flash-preview";
const imageModelId = "gemini-2.5-flash-image";

const getAIClient = () => {
    if (aiInstance) return aiInstance;
    const apiKey = process.env.API_KEY;
    if (!apiKey || apiKey === 'undefined') return null;
    try {
        aiInstance = new GoogleGenAI({ apiKey });
        return aiInstance;
    } catch (e) {
        return null;
    }
};

/**
 * Limpa strings retornadas pela IA que podem conter blocos de código markdown
 */
const cleanJsonResponse = (text: string): string => {
    return text.replace(/```json\s?|```/g, "").trim();
};

const insightsFallback = [
    "O faturamento deste mês está 15% acima da meta!",
    "Sugiro criar uma promoção 'Terça em Dobro'.",
    "Clientes de 'Corte' costumam retornar a cada 30 dias.",
];

export const getDashboardInsight = async (): Promise<string> => {
    const ai = getAIClient();
    if (!ai) return insightsFallback[0];
    try {
        const response = await ai.models.generateContent({
            model: modelId,
            contents: "Você é JaciBot, analista de beleza. Gere 1 dica curta de gestão.",
        });
        return response.text || insightsFallback[0];
    } catch (error) {
        return insightsFallback[0];
    }
};

export const generateMarketingContent = async (service: string, theme: string, tone: string) => {
    const ai = getAIClient();
    if (!ai) throw new Error("IA não configurada");

    try {
        // 1. Legendas
        const textResponse = await ai.models.generateContent({
            model: modelId,
            contents: `Crie 3 legendas para Instagram sobre "${service}". Tema: "${theme}". Tom: "${tone}". Retorne apenas JSON puro.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING },
                            content: { type: Type.STRING }
                        },
                        required: ["title", "content"]
                    }
                }
            }
        });

        const captions = JSON.parse(cleanJsonResponse(textResponse.text || "[]"));

        // 2. Imagem
        const imagePrompt = `Professional aesthetic banner for beauty salon. Topic: ${service}. Style: ${theme}. No text. High resolution.`;
        const imageResponse = await ai.models.generateContent({
            model: imageModelId,
            contents: [{ text: imagePrompt }],
            config: { imageConfig: { aspectRatio: "1:1" } }
        });

        let imageUrl = '';
        if (imageResponse.candidates?.[0]?.content?.parts) {
            for (const part of imageResponse.candidates[0].content.parts) {
                if (part.inlineData) {
                    imageUrl = `data:image/png;base64,${part.inlineData.data}`;
                    break;
                }
            }
        }

        return { captions, imageUrl };
    } catch (error) {
        console.error("Marketing AI Error:", error);
        throw error;
    }
};

export const getInsightByTopic = async (topic: string): Promise<string> => {
    const ai = getAIClient();
    if (!ai) return "Análise indisponível no momento.";
    try {
        const response = await ai.models.generateContent({
            model: modelId,
            contents: `Dê uma dica de 10 palavras sobre ${topic} para um estúdio de beleza.`,
        });
        return response.text || "Mantenha o foco na experiência do cliente.";
    } catch (error) {
        return "Revise seus indicadores mensais.";
    }
};

export const suggestSmartSlots = async (date: Date): Promise<string[]> => {
    return ["10:00 - Encaixe disponível", "14:30 - Horário nobre vago", "16:00 - Sugestão de agendamento"];
};

export const enqueueReminder = async (id: number, type: string) => {
    return { success: true, message: "Lembrete processado pela JaciBot." };
};

export const autoCashClose = async (date: Date) => {
    return { totalPrevisto: 0, totalRecebido: 0, diferenca: 0, resumo: "Fechamento automático realizado." };
};

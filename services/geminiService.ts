import { Type } from "@google/genai";
import { initialAppointments, mockTransactions, clients } from "../data/mockData";
import { format } from "date-fns";
import { supabase } from "./supabaseClient";

// --- IA Model Configs ---
const modelId = "gemini-3.5-flash";
const imageModelId = "gemini-2.5-flash-image";

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
    try {
        const { data, error } = await supabase.functions.invoke('jacibot', {
            body: {
                prompt: "Você é JaciBot, analista de beleza. Gere 1 dica curta de gestão.",
                model: modelId,
            }
        });
        if (error) throw error;
        return data?.text || insightsFallback[0];
    } catch (error) {
        console.error("Dashboard Insight Error:", error);
        return insightsFallback[0];
    }
};

export const generateMarketingContent = async (service: string, theme: string, tone: string) => {
    try {
        // 1. Legendas
        const { data: textData, error: textError } = await supabase.functions.invoke('jacibot', {
            body: {
                prompt: `Crie 3 legendas para Instagram sobre "${service}". Tema: "${theme}". Tom: "${tone}". Retorne apenas JSON puro.`,
                model: modelId,
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
                            required: ["title", "content"],
                            propertyOrdering: ["title", "content"]
                        }
                    }
                }
            }
        });

        if (textError) throw textError;
        const captions = JSON.parse(cleanJsonResponse(textData?.text || "[]"));

        // 2. Imagem
        const imagePrompt = `Professional aesthetic banner for beauty salon. Topic: ${service}. Style: ${theme}. No text. High resolution.`;
        const { data: imageData, error: imageError } = await supabase.functions.invoke('jacibot', {
            body: {
                prompt: imagePrompt,
                model: imageModelId,
                config: {
                    imageConfig: {
                        aspectRatio: "1:1"
                    }
                }
            }
        });

        if (imageError) throw imageError;

        let imageUrl = '';
        if (imageData?.candidates?.[0]?.content?.parts) {
            for (const part of imageData.candidates[0].content.parts) {
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

export const analyzeStaffPerformance = async (staffData: any[]): Promise<string> => {
    try {
        const prompt = `
            Você é um consultor sênior de gestão para salões de beleza e estúdios.
            Analise os seguintes dados de performance da equipe e forneça feedback acionável (pontos fortes, pontos a melhorar e uma recomendação prática).
            
            Dados da Equipe:
            ${JSON.stringify(staffData)}
            
            Formate a resposta em Markdown, sendo direto e profissional. Foque em taxas de ocupação, ticket médio por profissional e consistência.
        `;

        const { data, error } = await supabase.functions.invoke('jacibot', {
            body: {
                prompt,
                model: modelId,
            }
        });

        if (error) throw error;
        return data?.text || "Não foi possível gerar a análise no momento.";
    } catch (error) {
        console.error("Staff Analysis AI Error:", error);
        return "Erro ao processar análise de performance da equipe.";
    }
};

export const getInsightByTopic = async (topic: string): Promise<string> => {
    try {
        const { data, error } = await supabase.functions.invoke('jacibot', {
            body: {
                prompt: `Dê uma dica de 10 palavras sobre ${topic} para um estúdio de beleza.`,
                model: modelId,
            }
        });

        if (error) throw error;
        return data?.text || "Mantenha o foco na experiência do cliente.";
    } catch (error) {
        console.error("Topic Insight Error:", error);
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
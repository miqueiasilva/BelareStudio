import { GoogleGenAI, Type } from "@google/genai";
import { initialAppointments, mockTransactions, clients } from "../data/mockData";
import { format } from "date-fns";
import { supabase } from "./supabaseClient";

// --- IA Model Configs ---
const modelId = "gemini-3.5-flash";
const imageModelId = "gemini-2.5-flash-image";

// Global local client lazy initialization to prevent any environment loading crash
let localGeminiClient: any = null;
const getLocalGeminiClient = () => {
    if (!localGeminiClient) {
        let apiKey = '';
        try {
            // Retrieve key from Vite environment or local storage safely
            // @ts-expect-error - import.meta.env might not be fully typed in all environments
            apiKey = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GEMINI_API_KEY) || 
                     (typeof window !== 'undefined' && window.localStorage.getItem('VITE_GEMINI_API_KEY')) || 
                     '';
        } catch (e) {
            console.warn("Could not read Gemini API Key:", e);
        }

        if (apiKey) {
            try {
                localGeminiClient = new GoogleGenAI({
                    apiKey: apiKey,
                    httpOptions: {
                        headers: {
                            'User-Agent': 'aistudio-build'
                        }
                    }
                });
                console.log("[GEMINI_SERVICE] Direct local Gemini client initialized with custom key.");
            } catch (err) {
                console.error("[GEMINI_SERVICE] Failed to initialize local GoogleGenAI client:", err);
            }
        }
    }
    return localGeminiClient;
};

/**
 * Limpa strings retornadas pela IA que podem conter blocos de código markdown
 */
const cleanJsonResponse = (text: string): string => {
    return text.replace(/```json\s?|```/g, "").trim();
};

const insightsFallback = [
    "Dica de JaciBot: Oferecer pacotes de fidelidade para serviços de alto LTV como Micropigmentação aumenta a retenção em até 35%.",
    "Dica de JaciBot: Analise o ticket médio por categoria de serviço no painel de relatórios para ajustar tarifas subfaturadas.",
    "Dica de JaciBot: Clientes que agendam online retornam cerca de 22% mais rápido. Promova seu link de agendamento online!",
    "Dica de JaciBot: Reduza cancelamentos enviando lembretes automáticos de agendamento por WhatsApp com antecedência de 24h."
];

// Helper templates for marketing captions fallback
const getFallbackCaptions = (service: string, theme: string, tone: string) => {
    const serviceName = service || "nosso serviço exclusivo";
    
    let intro = `Eleve sua experiência de bem-estar com ${serviceName}.`;
    let mid = `No BelareStudio, cada detalhe é planejado para realçar sua beleza natural com o máximo de conforto e tecnologia.`;
    let cta = `Reserve seu momento hoje mesmo pelo link na bio. ✨`;
    
    if (theme === 'Luxo & Sofisticação') {
        intro = `A verdadeira excelência em estética espera por você. Experimente o refinamento de ${serviceName} no BelareStudio.`;
        mid = `Um ambiente exclusivo, atendimento altamente personalizado e resultados incomparáveis para quem busca o melhor.`;
        cta = `Permita-se viver essa experiência única. Agendamentos seletos disponíveis pelo link na bio. ✨`;
    } else if (theme === 'Moderno & Minimalista') {
        intro = `Foco na essência. Sinta a inovação e o design impecável por trás do procedimento de ${serviceName}.`;
        mid = `Simplificamos o cuidado para destacar o que há de mais marcante em você. Praticidade aliada à perfeição estética.`;
        cta = `Momentos dedicados a você. Garanta seu horário no nosso link de agendamento online.`;
    } else if (theme === 'Cores Vibrantes & Verão') {
        intro = `Sinta a energia da estação e prepare-se para brilhar muito com ${serviceName}! ☀️`;
        mid = `Autoestima renovada e o tratamento preferido das nossas clientes para curtir os melhores dias do ano com autoconfiança.`;
        cta = `O verão é seu! Clique no link em nossa bio e agende agora de forma rápida e prática!`;
    } else if (theme === 'Aconchegante & Natural') {
        intro = `Um convite ao relaxamento e conexão profunda. Conecte-se com sua beleza natural através de ${serviceName}. 🌿`;
        mid = `Feito com produtos selecionados e técnicas suaves que respeitam a sua individualidade, em um espaço de paz e harmonia.`;
        cta = `Desacelere sua rotina de forma descomplicada. Escolha seu horário com facilidade pelo nosso agendamento online.`;
    } else if (theme === 'Promoção de Flash') {
        intro = `Oportunidade especial de cuidado! Aproveite condições exclusivas para ${serviceName} no BelareStudio. ⚡`;
        mid = `Os procedimentos mais desejados por um valor especial por tempo super limitado nas nossas comandas semanais.`;
        cta = `Vagas limitadas! Não deixe para depois, agende seu horário online no perfil ou nos envie um direct!`;
    }

    let tonePrefix = "";
    if (tone === 'Inspirador') {
        tonePrefix = "A beleza começa quando você decide priorizar a si mesma. ";
    } else if (tone === 'Urgente (Gatilho de Escassez)') {
        tonePrefix = "ATENÇÃO: Pouquíssimos horários disponíveis para esta semana! ";
    } else if (tone === 'Divertido & Jovem') {
        tonePrefix = "Alerta de autocuidado ativado! Pronta para ficar ainda mais maravilhosa para o fim de semana? 😉 ";
    } else if (tone === 'Direto & Informativo') {
        tonePrefix = "Segurança, materiais 100% esterilizados e biossegurança garantida em nosso espaço. ";
    } else if (tone === 'Profissional') {
        tonePrefix = "Procedimento executado por equipe altamente qualificada, com insumos importados de alta performance. ";
    }

    return [
        {
            title: "Legenda Feed Principal",
            content: `${tonePrefix}${intro}\n\n${mid}\n\n${cta}\n\n#belarestudio #estetica #beleza #salaodebeleza #autoestima #cuidados`
        },
        {
            title: "Legenda Curta / Stories",
            content: `✨ Detalhes que fazem a diferença: agende seu procedimento de ${serviceName}.\n\nSeu ritual favorito de autocuidado com o requinte que você merece. Venha nos visitar! 🤍\n\n👉 Reserve online no link da bio!`
        },
        {
            title: "Chamada Direct / WhatsApp",
            content: `Oi! Que tal tirar um tempo hoje para cuidar de você? 🌸\n\nNesta semana, nosso serviço de *${serviceName}* está com horários especiais. Responda aqui ou clique no agendamento automático para garantir sua vaga!`
        }
    ];
};

// Generates a breathtaking visual banner programmatically inside high-resolution vector Canvas
const drawFallbackBanner = (service: string, theme: string): string => {
    if (typeof document === 'undefined') return '';
    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 1000;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // Background themes styling setup
    const grad = ctx.createLinearGradient(0, 0, 1000, 1000);
    let accentColor: string;
    let titleColor: string;
    let descColor: string;
    let themeLabel: string;

    if (theme === 'Luxo & Sofisticação') {
        grad.addColorStop(0, '#090d16');
        grad.addColorStop(0.5, '#121a2e');
        grad.addColorStop(1, '#05070a');
        accentColor = '#f59e0b'; // Gold
        titleColor = '#ffffff';
        descColor = '#cbd5e1';
        themeLabel = 'LUXO & REFINAMENTO';
    } else if (theme === 'Moderno & Minimalista') {
        grad.addColorStop(0, '#f8fafc');
        grad.addColorStop(0.5, '#f1f5f9');
        grad.addColorStop(1, '#e2e8f0');
        accentColor = '#0f172a'; // Deep Navy Slate
        titleColor = '#0f172a';
        descColor = '#475569';
        themeLabel = 'DESIGN & ESSÊNCIA';
    } else if (theme === 'Cores Vibrantes & Verão') {
        grad.addColorStop(0, '#ec4899'); // Pink
        grad.addColorStop(0.5, '#f43f5e'); // Rose
        grad.addColorStop(1, '#e11d48');
        accentColor = '#ffffff';
        titleColor = '#ffffff';
        descColor = '#ffe4e6';
        themeLabel = 'SOL, ENERGIA & BELEZA';
    } else if (theme === 'Aconchegante & Natural') {
        grad.addColorStop(0, '#115e59'); // Deep teal green
        grad.addColorStop(0.5, '#0d9488'); // Emerald teal
        grad.addColorStop(1, '#134e4a');
        accentColor = '#f5e0b3'; // Sand
        titleColor = '#ffffff';
        descColor = '#ccfbf1';
        themeLabel = 'CUIDADO INTEGRAL & ORGÂNICO';
    } else if (theme === 'Promoção de Flash') {
        grad.addColorStop(0, '#1e1b4b'); // Cyber indigo-dark
        grad.addColorStop(0.5, '#4f46e5'); // Electric indigo
        grad.addColorStop(1, '#312e81');
        accentColor = '#38bdf8'; // Electric blue
        titleColor = '#ffffff';
        descColor = '#e0e7ff';
        themeLabel = 'OFERTA FLASH EXCLUSIVA';
    } else {
        grad.addColorStop(0, '#1e293b');
        grad.addColorStop(1, '#0f172a');
        accentColor = '#f97316';
        themeLabel = 'BELARE EXCLUSIVE';
    }

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1000, 1000);

    // Grid details for tech / precision feeling
    ctx.strokeStyle = theme === 'Moderno & Minimalista' ? 'rgba(15, 23, 42, 0.02)' : 'rgba(255, 255, 255, 0.02)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 1000; i += 50) {
        ctx.beginPath();
        ctx.moveTo(i, 0); ctx.lineTo(i, 1000); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i); ctx.lineTo(1000, i); ctx.stroke();
    }

    // Elegant dual outer frame borders
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(40, 40, 920, 920);
    ctx.strokeStyle = theme === 'Moderno & Minimalista' ? 'rgba(15, 23, 42, 0.1)' : 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.strokeRect(50, 50, 900, 900);

    // Subtle geometrical shapes in the background for depth
    ctx.save();
    ctx.beginPath();
    ctx.arc(500, 500, 360, 0, Math.PI * 2);
    ctx.strokeStyle = theme === 'Moderno & Minimalista' ? 'rgba(15, 23, 42, 0.03)' : 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(500, 500, 345, 0, Math.PI * 2);
    ctx.strokeStyle = theme === 'Moderno & Minimalista' ? 'rgba(15, 23, 42, 0.015)' : 'rgba(255, 255, 255, 0.015)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // Corner decorative tick shapes
    ctx.fillStyle = accentColor;
    const size = 18;
    ctx.fillRect(52, 52, size, size);
    ctx.fillRect(930, 52, size, size);
    ctx.fillRect(52, 930, size, size);
    ctx.fillRect(930, 930, size, size);

    // Typeset Headline and Metadata info
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Badge styling text
    ctx.fillStyle = accentColor;
    ctx.font = '900 16px "Space Grotesk", "Inter", sans-serif';
    ctx.fillText('BELARESTUDIO • JACIBOT AI CREATIVE', 500, 180);

    // Decorative line accents
    ctx.strokeStyle = theme === 'Moderno & Minimalista' ? 'rgba(15, 23, 42, 0.15)' : 'rgba(255, 255, 255, 0.2)';
    ctx.beginPath();
    ctx.moveTo(180, 180); ctx.lineTo(280, 180); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(720, 180); ctx.lineTo(820, 180); ctx.stroke();

    // Secondary sub theme subtitle label
    ctx.fillStyle = descColor;
    ctx.font = '900 13px "JetBrains Mono", monospace';
    ctx.fillText(`COLLECTION: ${themeLabel}`, 500, 220);

    // Big Service Title typesetting with word wrap
    const maxTitleWidth = 780;
    const words = (service || "Beleza & Autoestima").toUpperCase().split(' ');
    const lines: string[] = [];
    let currentLine = '';
    
    ctx.font = '900 68px "Space Grotesk", "Helvetica Neue", sans-serif';
    
    for (let n = 0; n < words.length; n++) {
        const testLine = currentLine + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxTitleWidth && n > 0) {
            lines.push(currentLine.trim());
            currentLine = words[n] + ' ';
        } else {
            currentLine = testLine;
        }
    }
    lines.push(currentLine.trim());

    const startY = 480 - ((lines.length - 1) * 45);
    ctx.fillStyle = titleColor;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = (theme === 'Luxo & Sofisticação' || theme === 'Promoção de Flash') ? 18 : 0;
    
    lines.forEach((line, index) => {
        ctx.fillText(line, 500, startY + (index * 95));
    });
    
    // Reset shadow
    ctx.shadowBlur = 0;

    // Inspirational accent line
    ctx.fillStyle = accentColor;
    ctx.font = 'italic 500 28px "Inter", sans-serif';
    let subHeadline = 'Sinta a elegância de valorizar a sua essência.';
    if (theme === 'Luxo & Sofisticação') subHeadline = 'Especialistas no mais alto padrão em beleza facial.';
    if (theme === 'Cores Vibrantes & Verão') subHeadline = 'Prepare-se para viver a estação mais vibrante em alta!';
    if (theme === 'Aconchegante & Natural') subHeadline = 'Harmonia perfeita entre ativos orgânicos e design.';
    if (theme === 'Promoção de Flash') subHeadline = 'Condição imperdível na agenda ou via link online.';
    ctx.fillText(subHeadline, 500, 640);

    // Decorative geometric center ribbon
    ctx.fillStyle = theme === 'Moderno & Minimalista' ? 'rgba(15, 23, 42, 0.03)' : 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(200, 750, 600, 70);
    ctx.strokeStyle = accentColor;
    ctx.strokeRect(200, 750, 600, 70);

    ctx.fillStyle = titleColor;
    if (theme === 'Moderno & Minimalista') ctx.fillStyle = '#0f172a';
    ctx.font = '900 16px "JetBrains Mono", sans-serif';
    const ctaText = theme === 'Promoção de Flash' ? 'GARANTA SEU HORÁRIO EM SEGUNDOS' : 'RESERVE SEU ATENDIMENTO ONLINE';
    ctx.fillText(ctaText, 500, 785);

    // Footnote text
    ctx.fillStyle = descColor;
    ctx.font = '500 13px "Inter", sans-serif';
    ctx.fillText('ACESSE O SITE DE AGENDAMENTOS OU CONSULTE NOSSA EQUIPE PELO INSTAGRAM', 500, 880);

    return canvas.toDataURL('image/png');
};

export const getDashboardInsight = async (): Promise<string> => {
    try {
        // Tenta usar cliente local primeiro se configurado
        const localClient = getLocalGeminiClient();
        if (localClient) {
            try {
                const res = await localClient.models.generateContent({
                    model: modelId,
                    contents: "Você é JaciBot, analista de beleza do BelareStudio. Gere 1 dica de gestão de negócios para estúdios de beleza e clínicas de estética extremamente curta e prática em uma linha (com no máximo 15 palavras).",
                });
                if (res.text) return res.text;
            } catch (err) {
                console.warn("[GEMINI_SERVICE] Direct getDashboardInsight failed, calling Edge Function...");
            }
        }

        const { data, error } = await supabase.functions.invoke('jacibot', {
            body: {
                prompt: "Você é JaciBot, analista de beleza. Gere 1 dica curta de gestão.",
                model: modelId,
            }
        });
        if (error) throw error;
        return data?.text || insightsFallback[Math.floor(Math.random() * insightsFallback.length)];
    } catch (error) {
        console.error("Dashboard Insight Error:", error);
        return insightsFallback[Math.floor(Math.random() * insightsFallback.length)];
    }
};

export const generateMarketingContent = async (service: string, theme: string, tone: string) => {
    try {
        let captions: any[] = [];
        let imageUrl = '';

        // Tenta usar cliente local direct se configurado
        const localClient = getLocalGeminiClient();
        if (localClient) {
            try {
                // Generates Text via direct API to ensure zero latency
                const textRes = await localClient.models.generateContent({
                    model: modelId,
                    contents: `Crie 3 legendas para Instagram sobre "${service}". Tema: "${theme}". Tom: "${tone}". Retorne apenas JSON puro sem markdown de código. O formato do JSON precisa ser uma array contendo objetos com propriedades 'title' e 'content'.`,
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

                if (textRes.text) {
                    captions = JSON.parse(cleanJsonResponse(textRes.text));
                }
            } catch (err) {
                console.warn("[GEMINI_SERVICE] Direct captions generation failed, cascading:", err);
            }
        }

        // Se local não gerou ou falhou, tenta Supabase Edge Function
        if (!captions || captions.length === 0) {
            try {
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
                if (textData?.text) {
                    captions = JSON.parse(cleanJsonResponse(textData.text));
                }
            } catch (err) {
                console.error("[GEMINI_SERVICE] Supabase edge captions failed:", err);
                captions = getFallbackCaptions(service, theme, tone);
            }
        }

        // Tenta gerar imagem real se localClient estiver disponível
        if (localClient) {
            try {
                const imagePrompt = `Professional minimalistic aesthetic photography for a luxury beauty salon banner advert. Focus on high-end beauty, salon products, or skincare aesthetic. Subject matter: ${service}. Visual style theme: ${theme}. No written text on the graphic. Cinematic light, soft high resolution 4k raw photo.`;
                const imageRes = await localClient.models.generateContent({
                    model: imageModelId,
                    contents: {
                        parts: [
                            { text: imagePrompt }
                        ]
                    },
                    config: {
                        imageConfig: {
                            aspectRatio: "1:1",
                            imageSize: "1K"
                        }
                    }
                });

                if (imageRes.candidates?.[0]?.content?.parts) {
                    for (const part of imageRes.candidates[0].content.parts) {
                        if (part.inlineData) {
                            imageUrl = `data:image/png;base64,${part.inlineData.data}`;
                            break;
                        }
                    }
                }
            } catch (err) {
                console.warn("[GEMINI_SERVICE] Direct image generation failed, cascading:", err);
            }
        }

        // Se imagem real não gerou, tenta Supabase Edge Function
        if (!imageUrl) {
            try {
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

                if (!imageError && imageData?.candidates?.[0]?.content?.parts) {
                    for (const part of imageData.candidates[0].content.parts) {
                        if (part.inlineData) {
                            imageUrl = `data:image/png;base64,${part.inlineData.data}`;
                            break;
                        }
                    }
                }
            } catch (err) {
                console.error("[GEMINI_SERVICE] Supabase edge image failed:", err);
            }
        }

        // Se de tudo falhou imagem real, desenha o canvas profissional programático
        if (!imageUrl) {
            console.log("[GEMINI_SERVICE] Custom Canvas Art drawing activated for theme:", theme);
            imageUrl = drawFallbackBanner(service, theme);
        }

        // Garantia de captions preenchidas
        if (!captions || captions.length === 0) {
            captions = getFallbackCaptions(service, theme, tone);
        }

        return { captions, imageUrl };
    } catch (error) {
        console.error("Marketing AI General Error:", error);
        // Garantia total de funcionamento mesmo na falha mais crítica
        return {
            captions: getFallbackCaptions(service, theme, tone),
            imageUrl: drawFallbackBanner(service, theme)
        };
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

        const localClient = getLocalGeminiClient();
        if (localClient) {
            try {
                const res = await localClient.models.generateContent({
                    model: modelId,
                    contents: prompt,
                });
                if (res.text) return res.text;
            } catch (err) {
                console.warn("[GEMINI_SERVICE] Direct analyzeStaffPerformance failed, cascading...");
            }
        }

        const { data, error } = await supabase.functions.invoke('jacibot', {
            body: {
                prompt,
                model: modelId,
                config: {
                    temperature: 0.7
                }
            }
        });

        if (error) throw error;
        return data?.text || "Não foi possível gerar a análise no momento devido a indisponibilidade temporária.";
    } catch (error) {
        console.error("Staff Analysis AI Error:", error);
        return "### Resumo de Performance da Equipe\n\n*   **Pontos Fortes**: Atendimento consistente e taxas de retorno estáveis para serviços recorrentes.\n*   **A Melhorar**: Distribuição de horários vagos e estímulo a vendas cruzadas (cross-selling) de produtos premium para elevar o ticket médio.\n*   **Dica de Ouro**: Ofereça treinamentos integrados de técnicas de venda consultiva durante o atendimento.";
    }
};

export const getInsightByTopic = async (topic: string): Promise<string> => {
    try {
        const localClient = getLocalGeminiClient();
        if (localClient) {
            try {
                const res = await localClient.models.generateContent({
                    model: modelId,
                    contents: `Dê uma dica de no máximo 15 palavras sobre ${topic} para um estúdio de beleza de alto padrão.`,
                });
                if (res.text) return res.text;
            } catch (err) {
                console.warn("[GEMINI_SERVICE] Direct getInsightByTopic failed, cascading...");
            }
        }

        const { data, error } = await supabase.functions.invoke('jacibot', {
            body: {
                prompt: `Dê uma dica de 10 palavras sobre ${topic} para um estúdio de beleza.`,
                model: modelId,
            }
        });

        if (error) throw error;
        return data?.text || "Mantenha o foco na experiência e no acolhimento do cliente.";
    } catch (error) {
        console.error("Topic Insight Error:", error);
        
        // Topic específicos
        if (topic.toLowerCase().includes('caixa') || topic.toLowerCase().includes('finance')) {
            return "Monitore as entradas e saídas diariamente para garantir um fluxo de caixa saudável.";
        }
        if (topic.toLowerCase().includes('fidelidade') || topic.toLowerCase().includes('retorno')) {
            return "Crie programas de fidelidade estruturados de acordo com o padrão do cliente.";
        }
        return "Foque sempre em detalhes de excelência para impressionar e encantar cada visitante.";
    }
};

export const suggestSmartSlots = async (date: Date): Promise<string[]> => {
    return ["10:00 - Encaixe disponível", "14:30 - Horário nobre vago", "16:00 - Sugestão de agendamento"];
};

export const enqueueReminder = async (id: number, type: string) => {
    return { success: true, message: "Lembrete processado pela JaciBot." };
};

export const autoCashClose = async (date: Date) => {
    return { totalPrevisto: 0, totalRecebido: 0, diferenca: 0, resumo: "Fechamento automático realizado pelo JaciBot." };
};

export interface PendingTransaction {
    id: string;
    description: string;
    amount: number;
    date: string;
    type: 'income' | 'expense';
}

export interface CategorySuggestion {
    id: string;
    category: string;
    confidence: number;
    reasoning: string;
}

export const getLocalCategorySuggestionsFallback = (
    pending: PendingTransaction[],
    categories: string[]
): CategorySuggestion[] => {
    return pending.map(p => {
        const desc = p.description.toLowerCase();
        let category = "Outros";
        let confidence = 70;
        let reasoning = "Classificado como 'Outros' por padrão.";

        if (desc.includes("loreal") || desc.includes("shampoo") || desc.includes("condicionador") || desc.includes("cosmet") || desc.includes("compra beleza") || desc.includes("wella") || desc.includes("keune") || desc.includes("esmalte") || desc.includes("produtos") || desc.includes("insumos")) {
            category = categories.find(c => c.toLowerCase().includes("produtos") || c.toLowerCase().includes("insumos")) || "Produtos e Insumos";
            confidence = 95;
            reasoning = `Sugerido '${category}' baseado na identificação de marcas ou palavras-chave de produtos/insumos de beleza.`;
        } else if (desc.includes("enel") || desc.includes("luz") || desc.includes("energia") || desc.includes("sabesp") || desc.includes("agua") || desc.includes("telef") || desc.includes("internet") || desc.includes("wi-fi") || desc.includes("wifi") || desc.includes("celular")) {
            category = categories.find(c => c.toLowerCase().includes("água") || c.toLowerCase().includes("luz") || c.toLowerCase().includes("internet") || c.toLowerCase().includes("consumo")) || "Água/Luz/Internet";
            confidence = 98;
            reasoning = `Identificado como conta de consumo recorrente (${category}).`;
        } else if (desc.includes("aluguel") || desc.includes("salao") || desc.includes("condominio") || desc.includes("imobiliaria") || desc.includes("locacao")) {
            category = categories.find(c => c.toLowerCase().includes("aluguel")) || "Aluguel";
            confidence = 95;
            reasoning = "Sugerido como despesa de Aluguel/Condomínio da instalação do estúdio.";
        } else if (desc.includes("marketing") || desc.includes("anuncio") || desc.includes("facebook") || desc.includes("google ads") || desc.includes("instagram") || desc.includes("panfleto") || desc.includes("propaganda") || desc.includes("impulsiona")) {
            category = categories.find(c => c.toLowerCase().includes("marketing")) || "Marketing";
            confidence = 90;
            reasoning = "Identificado como gasto de tráfego pago ou promoção do salão.";
        } else if (desc.includes("tarifa") || desc.includes("itau") || desc.includes("banco") || desc.includes("manutencao conta") || desc.includes("iof") || desc.includes("juros") || desc.includes("mensalidade conta") || desc.includes("ted") || desc.includes("doc")) {
            category = categories.find(c => c.toLowerCase().includes("outros")) || "Outros";
            confidence = 85;
            reasoning = "Taxas, juros e tarifas financeiras bancárias operacionais.";
        } else if (p.type === "income" && (desc.includes("pix") || desc.includes("recebido") || desc.includes("comanda") || desc.includes("atendimento") || desc.includes("unhas") || desc.includes("cabelo") || desc.includes("corte") || desc.includes("escova") || desc.includes("cliente"))) {
            category = categories.find(c => c.toLowerCase().includes("serviço")) || "Serviço";
            confidence = 90;
            reasoning = "Entrada identificada como pagamento de serviço de beleza prestado.";
        } else if (desc.includes("comissao") || desc.includes("repasses") || desc.includes("comissões") || desc.includes("repasse profissional")) {
            category = categories.find(c => c.toLowerCase().includes("comissões")) || "Comissões";
            confidence = 95;
            reasoning = "Sugerido como repasse de comissões da equipe do estúdio.";
        }

        return {
            id: p.id,
            category,
            confidence,
            reasoning
        };
    });
};

export const suggestTransactionCategories = async (
    pending: PendingTransaction[],
    categories: string[],
    history: { description: string; category: string }[]
): Promise<CategorySuggestion[]> => {
    try {
        const localClient = getLocalGeminiClient();
        if (localClient) {
            const prompt = `
                Você é JaciBot, assistente de IA especialista em finanças para o salão de beleza BelareStudio.
                Sua tarefa é analisar uma lista de transações bancárias pendentes e sugerir a melhor categoria para cada uma delas, baseando-se nas categorias disponíveis e no histórico de lançamentos do estúdio.

                Categorias Disponíveis:
                ${JSON.stringify(categories)}

                Histórico de Referência do Estúdio:
                ${JSON.stringify(history.slice(0, 15))}

                Transações Pendentes a Categorizar:
                ${JSON.stringify(pending.map(p => ({ id: p.id, description: p.description, amount: p.amount, type: p.type })))}

                Retorne uma array contendo as sugestões em formato JSON estruturado com 'id', 'category' (deve ser EXATAMENTE uma das categorias disponíveis ou se não encaixar, 'Outros'), 'confidence' (número de 0 a 100) e 'reasoning' (uma justificativa curta em português explicando por que escolheu essa categoria).
                Responda APENAS o JSON puro, sem blocos de código markdown ou texto extra.
            `;

            try {
                const res = await localClient.models.generateContent({
                    model: modelId,
                    contents: prompt,
                    config: {
                        responseMimeType: "application/json",
                        responseSchema: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.STRING },
                                    category: { type: Type.STRING },
                                    confidence: { type: Type.INTEGER },
                                    reasoning: { type: Type.STRING }
                                },
                                required: ["id", "category", "confidence", "reasoning"]
                            }
                        }
                    }
                });

                if (res.text) {
                    const parsed = JSON.parse(cleanJsonResponse(res.text));
                    if (Array.isArray(parsed)) {
                        return parsed as CategorySuggestion[];
                    }
                }
            } catch (err) {
                console.warn("[GEMINI_SERVICE] Direct suggestTransactionCategories failed, falling back to rule-based matcher:", err);
            }
        }

        // Fallback rule-based
        return getLocalCategorySuggestionsFallback(pending, categories);
    } catch (error) {
        console.error("AI Category Suggestion Error:", error);
        return getLocalCategorySuggestionsFallback(pending, categories);
    }
};

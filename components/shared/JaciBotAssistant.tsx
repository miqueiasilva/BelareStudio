
import React, { useState, useEffect } from 'react';
import { Sparkles, DollarSign, Calendar, Users, Megaphone, RefreshCw, Loader2 } from 'lucide-react';
import { getInsightByTopic } from '../../services/geminiService';

interface JaciBotAssistantProps {
    fetchInsight: () => Promise<string>;
}

const topics = [
    { id: 'financeiro', label: 'Financeiro', icon: DollarSign },
    { id: 'agenda', label: 'Agenda', icon: Calendar },
    { id: 'clientes', label: 'Clientes', icon: Users },
    { id: 'marketing', label: 'Marketing', icon: Megaphone },
];

const JaciBotAssistant: React.FC<JaciBotAssistantProps> = ({ fetchInsight }) => {
    const [insight, setInsight] = useState('Olá! Clique em um dos tópicos abaixo para eu analisar sua operação em tempo real.');
    const [loading, setLoading] = useState(false);
    const [activeTopic, setActiveTopic] = useState<string | null>(null);

    const loadInsight = async (topic?: string) => {
        setLoading(true);
        setActiveTopic(topic || null);
        
        // Simulação de processamento de IA para feedback imediato ao usuário
        const processingMsg = topic 
            ? `Analisando dados de ${topic}...` 
            : "Consultando indicadores estratégicos...";
        setInsight(processingMsg);

        try {
            // Pequeno delay artificial para sensação de "trabalho da IA"
            await new Promise(resolve => setTimeout(resolve, 1500));

            const newInsight = topic 
                ? await getInsightByTopic(topic)
                : await fetchInsight();
            
            setInsight(newInsight);
        } catch (error) {
            setInsight("Ops, tive um problema na conexão. Mas analisando o padrão, recomendo revisar os horários de pico desta semana.");
        } finally {
            setLoading(false);
        }
    };

    // Não carrega automaticamente para evitar chamadas de API desnecessárias no dev/vazio
    // O usuário clica para ver funcionar

    return (
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden flex flex-col justify-between min-h-[220px]">
            {/* Background Effects */}
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-orange-500/10 rounded-full filter blur-3xl"></div>
            <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-cyan-500/10 rounded-full filter blur-3xl"></div>
            
            {/* Header */}
            <div className="flex items-center justify-between mb-4 relative z-10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-400/20 rounded-full flex items-center justify-center border-2 border-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.3)]">
                        <Sparkles className="w-5 h-5 text-orange-400 animate-pulse" />
                    </div>
                    <div>
                        <h4 className="font-bold text-lg leading-tight">JaciBot AI</h4>
                        <p className="text-[10px] text-orange-300 font-medium tracking-wide uppercase">Inteligência de Negócio</p>
                    </div>
                </div>
                <button 
                    onClick={() => loadInsight(activeTopic || undefined)} 
                    disabled={loading}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-300 hover:text-white disabled:opacity-50"
                    title="Novo Insight"
                >
                    <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                </button>
            </div>

            {/* Content Area */}
            <div className="relative z-10 flex-1 mb-4">
                {loading ? (
                    <div className="flex flex-col gap-2 mt-2">
                        <div className="flex items-center gap-2 text-orange-400 text-xs font-bold animate-pulse">
                            <Loader2 size={14} className="animate-spin" /> Processando indicadores...
                        </div>
                        <div className="h-2 bg-slate-700/50 rounded w-full overflow-hidden">
                            <div className="h-full bg-orange-500/50 animate-progress origin-left"></div>
                        </div>
                    </div>
                ) : (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <p className="text-slate-200 text-sm leading-relaxed font-medium italic">
                            "{insight}"
                        </p>
                    </div>
                )}
            </div>

            {/* Action Chips */}
            <div className="relative z-10">
                <p className="text-[10px] text-slate-400 uppercase font-bold mb-3 tracking-wider">Solicitar análise inteligente:</p>
                <div className="flex flex-wrap gap-2">
                    {topics.map((topic) => (
                        <button
                            key={topic.id}
                            onClick={() => loadInsight(topic.id)}
                            disabled={loading}
                            className={`
                                flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all border
                                ${activeTopic === topic.id 
                                    ? 'bg-orange-500 border-orange-500 text-white shadow-[0_0_10px_rgba(249,115,22,0.4)]' 
                                    : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:border-white/20 hover:text-white'
                                }
                            `}
                        >
                            <topic.icon size={12} />
                            {topic.label}
                        </button>
                    ))}
                </div>
            </div>
            
            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes progress {
                    0% { transform: scaleX(0); }
                    100% { transform: scaleX(1); }
                }
                .animate-progress {
                    animation: progress 1.5s ease-in-out infinite;
                }
            `}} />
        </div>
    );
};

export default JaciBotAssistant;

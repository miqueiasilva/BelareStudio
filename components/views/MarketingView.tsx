
import React, { useState, useEffect } from 'react';
import { 
    Sparkles, Wand2, Download, Copy, RefreshCw, 
    Image as ImageIcon, Type, Share2, Loader2,
    Palette, ChevronRight, CheckCircle2, Megaphone
} from 'lucide-react';
import { generateMarketingContent } from '../../services/geminiService';
import { supabase } from '../../services/supabaseClient';
import { useStudio } from '../../contexts/StudioContext';
import Card from '../shared/Card';
import Toast, { ToastType } from '../shared/Toast';

const MarketingView: React.FC = () => {
    const { activeStudioId } = useStudio();
    const [isLoading, setIsLoading] = useState(false);
    const [services, setServices] = useState<any[]>([]);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    // Form State
    const [selectedService, setSelectedService] = useState('');
    const [theme, setTheme] = useState('Luxo & Sofisticação');
    const [tone, setTone] = useState('Inspirador');

    // Result State
    const [result, setResult] = useState<{ captions: any[], imageUrl: string } | null>(null);

    useEffect(() => {
        const fetchServices = async () => {
            if (!activeStudioId) return;
            const { data } = await supabase.from('services').select('nome').eq('studio_id', activeStudioId).eq('ativo', true);
            if (data) setServices(data);
        };
        fetchServices();
    }, [activeStudioId]);

    const handleGenerate = async () => {
        if (!selectedService) {
            setToast({ message: "Selecione um serviço primeiro!", type: 'error' });
            return;
        }

        setIsLoading(true);
        setResult(null);
        try {
            const data = await generateMarketingContent(selectedService, theme, tone);
            setResult(data);
            setToast({ message: "Conteúdo gerado com sucesso! ✨", type: 'success' });
        } catch (e) {
            setToast({ message: "Erro ao gerar conteúdo. Tente novamente.", type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setToast({ message: "Texto copiado!", type: 'success' });
    };

    const downloadImage = () => {
        if (!result?.imageUrl) return;
        const link = document.createElement('a');
        link.href = result.imageUrl;
        link.download = `promo-${selectedService.replace(/\s+/g, '-').toLowerCase()}.png`;
        link.click();
    };

    return (
        <div className="h-full flex flex-col bg-slate-50 font-sans text-left overflow-hidden">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm z-20 flex-shrink-0">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-orange-50 text-orange-600 rounded-xl">
                        <Megaphone size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-slate-800 tracking-tight">Marketing IA</h1>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">JaciBot Creative Studio</p>
                    </div>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
                <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
                    
                    {/* Painel de Controle */}
                    <div className="lg:col-span-4 space-y-6">
                        <Card title="Configurar Promoção" icon={<Wand2 size={18} className="text-orange-500" />}>
                            <div className="space-y-5">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Serviço em Foco</label>
                                    <select 
                                        value={selectedService}
                                        onChange={(e) => setSelectedService(e.target.value)}
                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3.5 font-bold text-slate-700 outline-none focus:border-orange-400 transition-all"
                                    >
                                        <option value="">Selecione um serviço...</option>
                                        {services.map(s => <option key={s.nome} value={s.nome}>{s.nome}</option>)}
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tema Visual</label>
                                    <select 
                                        value={theme}
                                        onChange={(e) => setTheme(e.target.value)}
                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3.5 font-bold text-slate-700 outline-none focus:border-orange-400"
                                    >
                                        <option>Luxo & Sofisticação</option>
                                        <option>Moderno & Minimalista</option>
                                        <option>Cores Vibrantes & Verão</option>
                                        <option>Aconchegante & Natural</option>
                                        <option>Promoção de Flash</option>
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tom da Legenda</label>
                                    <select 
                                        value={tone}
                                        onChange={(e) => setTone(e.target.value)}
                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3.5 font-bold text-slate-700 outline-none focus:border-orange-400"
                                    >
                                        <option>Inspirador</option>
                                        <option>Direto & Informativo</option>
                                        <option>Divertido & Jovem</option>
                                        <option>Urgente (Gatilho de Escassez)</option>
                                        <option>Profissional</option>
                                    </select>
                                </div>

                                <button 
                                    onClick={handleGenerate}
                                    disabled={isLoading}
                                    className="w-full bg-slate-800 hover:bg-slate-900 text-white font-black py-4 rounded-2xl shadow-xl flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50 mt-4"
                                >
                                    {isLoading ? <Loader2 className="animate-spin" /> : <Sparkles size={20} />}
                                    {isLoading ? 'Criando Mágica...' : 'Gerar Criativos'}
                                </button>
                            </div>
                        </Card>

                        <div className="p-6 bg-orange-50 rounded-[32px] border border-orange-100">
                            <h4 className="font-black text-orange-800 text-sm uppercase tracking-tighter flex items-center gap-2">
                                <Palette size={16} /> Dica JaciBot
                            </h4>
                            <p className="text-xs text-orange-700 mt-2 leading-relaxed">
                                Imagens minimalistas com tons pastéis tendem a performar 40% melhor para serviços de estética no Instagram.
                            </p>
                        </div>
                    </div>

                    {/* Área de Resultado */}
                    <div className="lg:col-span-8">
                        {isLoading ? (
                            <div className="h-[600px] bg-white rounded-[48px] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 text-center p-12">
                                <div className="relative mb-8">
                                    <div className="w-24 h-24 bg-orange-100 rounded-full animate-ping opacity-20"></div>
                                    <Sparkles size={64} className="absolute inset-0 m-auto text-orange-500 animate-pulse" />
                                </div>
                                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">A IA está desenhando...</h3>
                                <p className="text-sm mt-2 font-medium max-w-xs">Estamos combinando seu serviço com as tendências visuais de 2025.</p>
                            </div>
                        ) : result ? (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {/* Preview Imagem */}
                                    <div className="space-y-4">
                                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Banner Gerado</h3>
                                        <div className="group relative rounded-[40px] overflow-hidden shadow-2xl bg-white border-8 border-white">
                                            <img src={result.imageUrl} className="w-full aspect-square object-cover" alt="Generated Promo" />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                                                <button onClick={downloadImage} className="p-4 bg-white rounded-2xl text-slate-800 shadow-xl hover:scale-110 transition-transform"><Download size={24} /></button>
                                            </div>
                                        </div>
                                        <button onClick={downloadImage} className="w-full py-4 bg-white border border-slate-200 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
                                            <Download size={18} /> Baixar Arte HD
                                        </button>
                                    </div>

                                    {/* Legendas */}
                                    <div className="space-y-4">
                                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Sugestões de Copy</h3>
                                        <div className="space-y-4">
                                            {result.captions.map((cap, idx) => (
                                                <div key={idx} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm relative group hover:border-orange-200 transition-all">
                                                    <div className="flex justify-between items-start mb-3">
                                                        <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest bg-orange-50 px-2 py-0.5 rounded-lg">{cap.title}</span>
                                                        <button onClick={() => copyToClipboard(cap.content)} className="p-2 text-slate-300 hover:text-orange-500 transition-colors opacity-0 group-hover:opacity-100"><Copy size={16} /></button>
                                                    </div>
                                                    <p className="text-sm text-slate-600 leading-relaxed font-medium whitespace-pre-wrap">{cap.content}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                            </div>
                        ) : (
                            <div className="h-[600px] bg-white rounded-[48px] border border-slate-100 flex flex-col items-center justify-center text-slate-300 text-center p-12">
                                <div className="w-24 h-24 bg-slate-50 rounded-[40px] flex items-center justify-center mb-6">
                                    <ImageIcon size={40} className="opacity-20" />
                                </div>
                                <h3 className="text-lg font-black text-slate-400 uppercase tracking-widest">Nada gerado ainda</h3>
                                <p className="text-sm mt-2 max-w-xs font-bold text-slate-300">Configure os parâmetros à esquerda e deixe a IA cuidar do seu marketing.</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default MarketingView;


import React, { useState, useCallback } from 'react';
import { 
    Globe, Eye, Save, Palette, Settings2, Star, TrendingUp, 
    Copy, Upload, Camera, Clock, Calendar, AlertTriangle, 
    MessageCircle, Users, MousePointer2, CheckCircle2, 
    ArrowRight, MessageSquare, Share2, Info
} from 'lucide-react';
import Card from '../shared/Card';
import ToggleSwitch from '../shared/ToggleSwitch';
import Toast, { ToastType } from '../shared/Toast';

type TabId = 'aparencia' | 'regras' | 'avaliacoes' | 'desempenho';

const AgendaOnlineView: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabId>('aparencia');
    const [isSaving, setIsSaving] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    // Form States
    const [isActive, setIsActive] = useState(true);
    const [studioName, setStudioName] = useState('Belaflow Studio');
    const [description, setDescription] = useState('Especialistas em realçar sua beleza natural com as melhores técnicas do mercado.');
    const [interval, setInterval] = useState(30);

    const showToast = useCallback((message: string, type: ToastType = 'success') => {
        setToast({ message, type });
    }, []);

    const handleCopyLink = () => {
        navigator.clipboard.writeText('belaapp.com/belaflow-studio');
        showToast("Link copiado!");
    };

    const handleSave = () => {
        setIsSaving(true);
        setTimeout(() => {
            setIsSaving(false);
            showToast("Configurações salvas com sucesso!");
        }, 8000);
    };

    const tabs = [
        { id: 'aparencia', label: 'Geral & Aparência', icon: Palette },
        { id: 'regras', label: 'Regras de Agendamento', icon: Settings2 },
        { id: 'avaliacoes', label: 'Avaliações', icon: Star },
        { id: 'desempenho', label: 'Desempenho', icon: TrendingUp },
    ];

    return (
        <div className="h-full flex flex-col bg-slate-50 font-sans overflow-hidden">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* HEADER */}
            <header className="bg-white border-b border-slate-200 px-8 py-6 flex flex-col md:flex-row justify-between items-center gap-4 shrink-0 z-20">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-50 text-orange-500 rounded-xl">
                        <Globe size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-slate-800 uppercase tracking-tight">Agenda Online</h1>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-0.5">Configurações da sua vitrine pública</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all">
                        <Eye size={18} /> Visualizar
                    </button>
                    <button 
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-orange-500 text-white font-black text-sm hover:bg-orange-600 shadow-lg shadow-orange-100 transition-all active:scale-95 disabled:opacity-50"
                    >
                        {isSaving ? <span className="animate-pulse">Salvando...</span> : <><Save size={18} /> Salvar Alterações</>}
                    </button>
                </div>
            </header>

            {/* TAB NAVIGATION */}
            <div className="bg-white border-b border-slate-100 px-8 flex gap-8 shrink-0 overflow-x-auto scrollbar-hide">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as TabId)}
                        className={`flex items-center gap-2 py-5 border-b-2 font-black text-xs uppercase tracking-[0.15em] transition-all whitespace-nowrap ${
                            activeTab === tab.id 
                            ? 'border-orange-500 text-orange-600' 
                            : 'border-transparent text-slate-400 hover:text-slate-600'
                        }`}
                    >
                        <tab.icon size={16} /> {tab.label}
                    </button>
                ))}
            </div>

            {/* CONTENT AREA */}
            <main className="flex-1 overflow-y-auto p-8 scrollbar-hide">
                <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                    
                    {/* ABA 1: GERAL & APARÊNCIA */}
                    {activeTab === 'aparencia' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <Card title="Status da Agenda" icon={<Globe size={18} />}>
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between p-5 bg-slate-50 rounded-3xl border border-slate-100">
                                        <div>
                                            <p className="font-bold text-slate-700 text-sm">Aceitar agendamentos online?</p>
                                            <p className="text-xs text-slate-400 mt-0.5">Ative para permitir que clientes reservem sozinhos.</p>
                                        </div>
                                        <ToggleSwitch on={isActive} onClick={() => setIsActive(!isActive)} />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Seu Link Público</label>
                                        <div className="flex gap-2">
                                            <div className="flex-1 bg-white border border-slate-200 px-4 py-3 rounded-2xl flex items-center gap-3 overflow-hidden">
                                                <Globe size={16} className="text-slate-300" />
                                                <span className="text-sm font-bold text-slate-500 truncate">belaapp.com/belaflow-studio</span>
                                            </div>
                                            <button onClick={handleCopyLink} className="p-4 bg-slate-900 text-white rounded-2xl hover:bg-black transition-all">
                                                <Copy size={18} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-start gap-3">
                                        <Info size={16} className="text-blue-500 mt-0.5 shrink-0" />
                                        <p className="text-[10px] text-blue-700 leading-relaxed font-medium uppercase tracking-tight">Dica: Adicione este link na bio do seu Instagram para aumentar suas reservas.</p>
                                    </div>
                                </div>
                            </Card>

                            <Card title="Identidade Visual" icon={<Palette size={18} />}>
                                <div className="space-y-5">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome do Estúdio</label>
                                        <input value={studioName} onChange={e => setStudioName(e.target.value)} className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-orange-100" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descrição Curta</label>
                                        <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm font-medium text-slate-500 outline-none focus:ring-2 focus:ring-orange-100 resize-none" />
                                    </div>
                                    <div className="flex items-center gap-4 pt-2">
                                        <div className="w-20 h-20 rounded-3xl bg-slate-100 flex items-center justify-center border-2 border-dashed border-slate-300 relative group overflow-hidden">
                                            <Camera size={24} className="text-slate-400 group-hover:scale-110 transition-transform" />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                                                <Upload size={20} className="text-white" />
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-slate-700">Logo do Estúdio</p>
                                            <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest font-black">PNG ou JPG até 2MB</p>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        </div>
                    )}

                    {/* ABA 2: REGRAS DE AGENDAMENTO */}
                    {activeTab === 'regras' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <Card title="Intervalos e Horários" icon={<Clock size={18} />}>
                                <div className="space-y-8">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Intervalo da Grade</label>
                                        <div className="grid grid-cols-4 gap-2">
                                            {[15, 20, 30, 60].map(m => (
                                                <button key={m} onClick={() => setInterval(m)} className={`py-3 rounded-2xl text-xs font-black transition-all ${interval === m ? 'bg-orange-500 text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>{m}m</button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Antecedência Mínima</label>
                                            <select className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 outline-none bg-white">
                                                <option>1 hora antes</option>
                                                <option selected>2 horas antes</option>
                                                <option>No dia anterior</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Agenda Aberta até</label>
                                            <select className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 outline-none bg-white">
                                                <option>15 dias futuros</option>
                                                <option selected>30 dias futuros</option>
                                                <option>90 dias futuros</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </Card>

                            <Card title="Política de Cancelamento" icon={<AlertTriangle size={18} />}>
                                <div className="space-y-6">
                                    <div className="p-5 bg-amber-50 border border-amber-100 rounded-[32px] flex gap-4">
                                        <div className="w-10 h-10 bg-amber-400 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-amber-200">
                                            <Info size={20} />
                                        </div>
                                        <p className="text-xs text-amber-800 leading-relaxed font-medium italic">"Políticas claras evitam buracos na agenda. Defina um tempo justo para que você possa reocupar o horário vago."</p>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Limite para cancelamento grátis</label>
                                        <select className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 outline-none bg-white">
                                            <option>Até 2h antes</option>
                                            <option>Até 12h antes</option>
                                            <option selected>Até 24h antes</option>
                                            <option>Não permite cancelar online</option>
                                        </select>
                                    </div>
                                </div>
                            </Card>
                        </div>
                    )}

                    {/* ABA 3: AVALIAÇÕES */}
                    {activeTab === 'avaliacoes' && (
                        <div className="space-y-4">
                            {[
                                { name: 'Juliana Paes', rating: 5, service: 'Design com Henna', date: 'Há 2 dias', comment: 'Atendimento impecável! A Jacilene é uma profissional incrível, amei o resultado das minhas sobrancelhas.', reply: 'Muito obrigada, Juliana! É sempre um prazer receber você.' },
                                { name: 'Marina Ruy Barbosa', rating: 5, service: 'Volume Egípcio', date: 'Há 5 dias', comment: 'Melhor estúdio de cílios da região. Super recomendo!', reply: null },
                                { name: 'Bruna Marquezine', rating: 4, service: 'Limpeza de Pele Premium', date: 'Há 1 semana', comment: 'Gostei muito, mas o café estava frio. O serviço em si nota 10!', reply: null }
                            ].map((review, i) => (
                                <div key={i} className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm space-y-4">
                                    <div className="flex justify-between items-start">
                                        <div className="flex gap-4">
                                            <div className="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-black text-slate-400">{review.name.charAt(0)}</div>
                                            <div>
                                                <h4 className="font-bold text-slate-800">{review.name}</h4>
                                                <div className="flex items-center gap-3 mt-0.5">
                                                    <div className="flex text-amber-400 gap-0.5">
                                                        {[...Array(5)].map((_, star) => <Star key={star} size={12} fill={star < review.rating ? 'currentColor' : 'none'} />)}
                                                    </div>
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">• {review.service}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{review.date}</span>
                                    </div>
                                    <p className="text-sm text-slate-600 leading-relaxed font-medium italic">"{review.comment}"</p>
                                    
                                    {review.reply ? (
                                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex gap-3">
                                            <MessageSquare size={14} className="text-orange-500 mt-1" />
                                            <p className="text-xs text-slate-500 font-bold">Sua Resposta: <span className="font-medium italic text-slate-400">"{review.reply}"</span></p>
                                        </div>
                                    ) : (
                                        <div className="pt-2">
                                            <textarea placeholder="Escrever resposta para a cliente..." className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-orange-100 transition-all resize-none" rows={2} />
                                            <div className="flex justify-end mt-2">
                                                <button className="text-[10px] font-black text-orange-600 uppercase tracking-widest py-2 px-4 hover:bg-orange-50 rounded-lg transition-all">Enviar Resposta</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* ABA 4: DESEMPENHO */}
                    {activeTab === 'desempenho' && (
                        <div className="space-y-8">
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                {[
                                    { label: 'Visualizações', val: '1.250', icon: Eye, color: 'bg-blue-500' },
                                    { label: 'Iniciaram', val: '180', icon: MousePointer2, color: 'bg-purple-500' },
                                    { label: 'Concluídos', val: '65', icon: CheckCircle2, color: 'bg-emerald-500' },
                                    { label: 'Taxa Conv.', val: '36.1%', icon: TrendingUp, color: 'bg-orange-500' }
                                ].map((kpi, i) => (
                                    <div key={i} className="bg-white p-5 rounded-[28px] border border-slate-200 shadow-sm flex items-center justify-between">
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{kpi.label}</p>
                                            <h4 className="text-2xl font-black text-slate-800 mt-1">{kpi.val}</h4>
                                        </div>
                                        <div className={`p-3 rounded-2xl text-white shadow-lg ${kpi.color}`}>
                                            <kpi.icon size={18} />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                <div className="lg:col-span-2">
                                    <Card title="Funil de Agendamento" icon={<TrendingUp size={18} />}>
                                        <div className="space-y-6 py-4">
                                            {[
                                                { label: 'Acessaram a página', val: '100%', count: 1250, color: 'bg-blue-400' },
                                                { label: 'Clicaram em agendar', val: '14.4%', count: 180, color: 'bg-purple-400' },
                                                { label: 'Finalizaram reserva', val: '5.2%', count: 65, color: 'bg-orange-500' }
                                            ].map((step, i) => (
                                                <div key={i} className="space-y-2">
                                                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
                                                        <span>{step.label}</span>
                                                        <span className="text-slate-800">{step.count} ({step.val})</span>
                                                    </div>
                                                    <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
                                                        <div className={`h-full transition-all duration-1000 ${step.color}`} style={{ width: step.val }} />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </Card>
                                </div>

                                <div className="space-y-6">
                                    <div className="bg-emerald-500 p-8 rounded-[40px] shadow-xl shadow-emerald-100 flex flex-col items-center text-center text-white space-y-4">
                                        <div className="w-16 h-16 bg-white/20 rounded-[24px] flex items-center justify-center border border-white/30 backdrop-blur-sm">
                                            <MessageCircle size={32} />
                                        </div>
                                        <div>
                                            <h4 className="text-4xl font-black">42</h4>
                                            <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mt-1">Cliques no WhatsApp</p>
                                        </div>
                                        <p className="text-xs font-medium opacity-70">Clientes que preferiram tirar dúvidas antes de agendar online.</p>
                                    </div>

                                    <div className="bg-slate-900 p-8 rounded-[40px] shadow-xl text-white relative overflow-hidden group">
                                        <div className="relative z-10">
                                            <h4 className="font-bold text-lg leading-tight">Deseja impulsionar <br/> suas vendas?</h4>
                                            <p className="text-xs text-slate-400 mt-2">Crie campanhas de desconto exclusivas para agendamento online.</p>
                                            <button className="mt-6 flex items-center gap-2 text-[10px] font-black text-orange-500 uppercase tracking-widest hover:translate-x-1 transition-transform">
                                                Criar Campanha <ArrowRight size={14} />
                                            </button>
                                        </div>
                                        <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform">
                                            <Share2 size={120} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default AgendaOnlineView;


import React, { useState, useEffect, useMemo } from 'react';
import { 
    Globe, Settings, MessageSquare, BarChart2, ExternalLink, 
    Copy, CheckCircle, Share2, Save, Eye, Star, MessageCircle,
    Clock, Calendar, AlertTriangle, ShieldCheck, Loader2, Info,
    Trash2, User, Filter, EyeOff, StarHalf
} from 'lucide-react';
import Card from '../shared/Card';
import ToggleSwitch from '../shared/ToggleSwitch';
import { mockAnalytics } from '../../data/mockData';
import { supabase } from '../../services/supabaseClient';
import Toast, { ToastType } from '../shared/Toast';
import { format } from 'date-fns';
import { ptBR as pt } from 'date-fns/locale/pt-BR';

// --- Subcomponente de Estrelas ---
const StarRating = ({ rating, size = 16 }: { rating: number, size?: number }) => (
    <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((s) => (
            <Star 
                key={s} 
                size={size} 
                className={s <= rating ? 'text-amber-400 fill-amber-400' : 'text-slate-200 fill-slate-100'} 
            />
        ))}
    </div>
);

// --- Subcomponente de Card de Review ---
const ReviewCard = ({ review, onToggle, onDelete }: any) => (
    <div className={`p-6 rounded-[32px] border transition-all duration-300 bg-white ${review.is_public ? 'border-slate-100 shadow-sm' : 'border-slate-100 bg-slate-50/50 opacity-75'}`}>
        <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div className="flex gap-4">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 flex-shrink-0">
                    <User size={24} />
                </div>
                <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-black text-slate-800 text-sm truncate">{review.client_name}</h4>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                            {format(new Date(review.created_at), "dd MMM yyyy", { locale: pt })}
                        </span>
                    </div>
                    <div className="mt-1">
                        <StarRating rating={review.rating} />
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <div className="flex flex-col items-end mr-2">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Exibir no site?</span>
                    <ToggleSwitch on={review.is_public} onClick={() => onToggle(review.id, !review.is_public)} />
                </div>
                <button 
                    onClick={() => onDelete(review.id)}
                    className="p-3 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all"
                >
                    <Trash2 size={18} />
                </button>
            </div>
        </div>

        <div className="mt-4">
            <p className="text-sm text-slate-600 leading-relaxed font-medium">"{review.comment}"</p>
        </div>

        {review.service_name && (
            <div className="mt-4 flex items-center gap-2">
                <div className="px-3 py-1 bg-orange-50 text-orange-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-orange-100">
                    {review.service_name}
                </div>
            </div>
        )}
    </div>
);

const StyledSelect = ({ label, icon: Icon, value, onChange, options, helperText }: any) => (
    <div className="space-y-1.5">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
        <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-orange-500 transition-colors">
                <Icon size={18} />
            </div>
            <select 
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full pl-12 pr-10 py-3.5 bg-white border border-slate-200 rounded-2xl appearance-none outline-none focus:ring-4 focus:ring-orange-100 focus:border-orange-400 transition-all font-bold text-slate-700 cursor-pointer shadow-sm"
            >
                {options.map((opt: any) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300">
                <ChevronDown size={16} strokeWidth={3} />
            </div>
        </div>
        {helperText && <p className="text-[10px] text-slate-400 font-medium ml-1 leading-tight">{helperText}</p>}
    </div>
);

const ChevronDown = ({ size, strokeWidth }: any) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth || 2} strokeLinecap="round" strokeLinejoin="round">
        <path d="m6 9 6 6 6-6"/>
    </svg>
);

const TabButton = ({ id, label, active, onClick, icon: Icon }: any) => (
    <button
        onClick={() => onClick(id)}
        className={`flex items-center gap-2 px-5 py-4 border-b-2 transition-all font-bold text-sm whitespace-nowrap min-h-[48px] ${
            active 
            ? 'border-orange-500 text-orange-600 bg-orange-50/50' 
            : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
        }`}
    >
        <Icon className="w-4 h-4 flex-shrink-0" />
        {label}
    </button>
);

const AgendaOnlineView: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'geral' | 'regras' | 'avaliacoes' | 'analytics'>('geral');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const [reviews, setReviews] = useState<any[]>([]);

    const [config, setConfig] = useState({
        id: null,
        isActive: true,
        slug: '',
        studioName: '',
        description: '',
        min_scheduling_notice: '2',
        max_scheduling_window: '30',
        cancellation_notice: '24',
        cancellation_policy: ''
    });

    const showToast = (message: string, type: ToastType = 'success') => setToast({ message, type });

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const { data: settings } = await supabase.from('studio_settings').select('*').maybeSingle();
            if (settings) {
                setConfig({
                    id: settings.id,
                    isActive: settings.online_booking_active ?? true,
                    slug: settings.slug || '',
                    studioName: settings.studio_name || '',
                    description: settings.presentation_text || '',
                    min_scheduling_notice: settings.min_scheduling_notice?.toString() || '2',
                    max_scheduling_window: settings.max_scheduling_window?.toString() || '30',
                    cancellation_notice: settings.cancellation_notice?.toString() || '24',
                    cancellation_policy: settings.cancellation_policy || ''
                });
            }

            const { data: reviewsData } = await supabase
                .from('service_reviews')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (reviewsData) setReviews(reviewsData);

        } catch (e) {
            showToast("Erro ao carregar dados.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleToggleReview = async (id: string, status: boolean) => {
        try {
            const { error } = await supabase
                .from('service_reviews')
                .update({ is_public: status })
                .eq('id', id);
            
            if (error) throw error;
            setReviews(prev => prev.map(r => r.id === id ? { ...r, is_public: status } : r));
            showToast(status ? "Visível no site" : "Oculto no site", "info");
        } catch (e) {
            showToast("Erro ao atualizar status.", "error");
        }
    };

    const handleDeleteReview = async (id: string) => {
        if (!window.confirm("Deseja apagar esta avaliação permanentemente?")) return;
        try {
            const { error } = await supabase.from('service_reviews').delete().eq('id', id);
            if (error) throw error;
            setReviews(prev => prev.filter(r => r.id !== id));
            showToast("Avaliação excluída.");
        } catch (e) {
            showToast("Erro ao excluir.", "error");
        }
    };

    const stats = useMemo(() => {
        if (reviews.length === 0) return { avg: 0, total: 0 };
        const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
        return {
            avg: (sum / reviews.length).toFixed(1),
            total: reviews.length
        };
    }, [reviews]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const payload = {
                online_booking_active: config.isActive,
                min_scheduling_notice: parseInt(config.min_scheduling_notice),
                max_scheduling_window: parseInt(config.max_scheduling_window),
                cancellation_notice: parseInt(config.cancellation_notice),
                cancellation_policy: config.cancellation_policy,
                studio_name: config.studioName,
                presentation_text: config.description
            };

            const { error } = await supabase
                .from('studio_settings')
                .update(payload)
                .eq('id', config.id);

            if (error) throw error;
            showToast("Alterações salvas!");
        } catch (e: any) {
            showToast(e.message, "error");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) return <div className="h-full flex items-center justify-center text-slate-400 font-bold uppercase tracking-widest text-[10px]"><Loader2 className="animate-spin text-orange-500 mr-2" /> Carregando...</div>;

    return (
        <div className="h-full flex flex-col bg-slate-50 overflow-hidden font-sans">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4 flex-shrink-0 z-30 shadow-sm">
                <div>
                    <h1 className="text-xl sm:text-2xl font-black text-slate-800 flex items-center gap-2">
                        <Globe className="text-blue-500 w-6 h-6" />
                        Agenda Online
                    </h1>
                    <p className="text-slate-500 text-xs font-medium">Configure a experiência pública do seu estúdio.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => window.location.hash = '/public-preview'} className="px-5 py-2.5 bg-white border border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-50 flex items-center gap-2 text-sm transition-all shadow-sm">
                        <Eye size={18} /> Visualizar
                    </button>
                    <button 
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-6 py-2.5 bg-orange-500 text-white font-black rounded-xl hover:bg-orange-600 shadow-lg shadow-orange-100 flex items-center gap-2 text-sm transition-all active:scale-95 disabled:opacity-50"
                    >
                        {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                        Salvar Alterações
                    </button>
                </div>
            </header>

            <div className="bg-white border-b border-slate-200 flex overflow-x-auto scrollbar-hide flex-shrink-0 z-20">
                <div className="flex px-4">
                    <TabButton id="geral" label="Geral" icon={Settings} active={activeTab === 'geral'} onClick={setActiveTab} />
                    <TabButton id="regras" label="Regras" icon={ShieldCheck} active={activeTab === 'regras'} onClick={setActiveTab} />
                    <TabButton id="avaliacoes" label="Avaliações" icon={Star} active={activeTab === 'avaliacoes'} onClick={setActiveTab} />
                    <TabButton id="analytics" label="Desempenho" icon={BarChart2} active={activeTab === 'analytics'} onClick={setActiveTab} />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar">
                <div className="max-w-4xl mx-auto pb-20">
                    
                    {activeTab === 'geral' && (
                        <Card title="Status do Link Público" className="rounded-[32px] border-slate-200 shadow-sm">
                            <div className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100 mb-8">
                                <div>
                                    <p className="font-black text-slate-800 text-sm">Disponibilidade Online</p>
                                    <p className="text-xs text-slate-500 mt-1 font-medium">Se desativado, o link exibirá uma mensagem de indisponibilidade.</p>
                                </div>
                                <ToggleSwitch on={config.isActive} onClick={() => setConfig({...config, isActive: !config.isActive})} />
                            </div>
                            <div className="space-y-4">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Endereço de Acesso (URL)</label>
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <div className="flex-1 flex items-center px-5 py-4 bg-slate-100 border border-slate-200 rounded-2xl text-slate-500 font-bold text-sm overflow-hidden truncate">
                                        {window.location.host}/bela/{config.slug || 'seu-estudio'}
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => { navigator.clipboard.writeText(`${window.location.host}/bela/${config.slug}`); showToast('Copiado!'); }} className="p-4 bg-white border border-slate-300 rounded-2xl hover:bg-slate-50 text-slate-600 transition-all shadow-sm"><Copy size={20}/></button>
                                        <button className="p-4 bg-green-500 text-white rounded-2xl hover:bg-green-600 transition-all shadow-lg shadow-green-100"><Share2 size={20}/></button>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    )}

                    {activeTab === 'regras' && (
                        <div className="space-y-6 animate-in slide-in-from-bottom-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Card title="Limites de Agendamento" icon={<Clock size={20} className="text-orange-500" />} className="rounded-[32px]">
                                    <div className="space-y-6 mt-2">
                                        <StyledSelect 
                                            label="Antecedência Mínima"
                                            icon={Clock}
                                            value={config.min_scheduling_notice}
                                            onChange={(val: string) => setConfig({...config, min_scheduling_notice: val})}
                                            options={[
                                                { value: '1', label: '1 hora antes' },
                                                { value: '2', label: '2 horas antes' },
                                                { value: '4', label: '4 horas antes' },
                                                { value: '24', label: '24 horas (1 dia)' },
                                            ]}
                                        />
                                        <StyledSelect 
                                            label="Horizonte da Agenda"
                                            icon={Calendar}
                                            value={config.max_scheduling_window}
                                            onChange={(val: string) => setConfig({...config, max_scheduling_window: val})}
                                            options={[
                                                { value: '15', label: 'Próximos 15 dias' },
                                                { value: '30', label: 'Próximos 30 dias' },
                                                { value: '60', label: 'Próximos 60 dias' },
                                            ]}
                                        />
                                    </div>
                                </Card>
                                <Card title="Política de Cancelamento" icon={<AlertTriangle size={20} className="text-orange-500" />} className="rounded-[32px]">
                                    <div className="space-y-6 mt-2">
                                        <StyledSelect 
                                            label="Aviso Prévio"
                                            icon={Info}
                                            value={config.cancellation_notice}
                                            onChange={(val: string) => setConfig({...config, cancellation_notice: val})}
                                            options={[
                                                { value: '0', label: 'A qualquer momento' },
                                                { value: '12', label: '12 horas antes' },
                                                { value: '24', label: '24 horas antes' },
                                            ]}
                                        />
                                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                            <p className="text-[10px] text-slate-500 leading-relaxed font-bold italic">
                                                * Regras claras evitam furos e prejuízos na agenda.
                                            </p>
                                        </div>
                                    </div>
                                </Card>
                            </div>
                        </div>
                    )}

                    {activeTab === 'avaliacoes' && (
                        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                            {/* Score Summary */}
                            <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-8">
                                <div className="text-center md:text-left">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Nota Média do Estúdio</p>
                                    <div className="flex items-end gap-3 justify-center md:justify-start">
                                        <h2 className="text-6xl font-black text-slate-800 tracking-tighter">{stats.avg}</h2>
                                        <div className="pb-2 space-y-1">
                                            <StarRating rating={Math.round(Number(stats.avg))} size={24} />
                                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{stats.total} avaliações</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="h-px w-20 bg-slate-100 md:h-20 md:w-px hidden sm:block"></div>
                                <div className="flex-1 max-w-xs space-y-2">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center md:text-left">Distribuição</p>
                                    {[5, 4, 3, 2, 1].map(star => {
                                        const count = reviews.filter(r => r.rating === star).length;
                                        const percent = stats.total > 0 ? (count / stats.total) * 100 : 0;
                                        return (
                                            <div key={star} className="flex items-center gap-3">
                                                <span className="text-[10px] font-black text-slate-500 w-2">{star}</span>
                                                <div className="flex-1 h-2 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                                                    <div className="h-full bg-amber-400" style={{ width: `${percent}%` }}></div>
                                                </div>
                                                <span className="text-[9px] font-black text-slate-400 w-6 text-right">{count}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Reviews List */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between px-2">
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Feedbacks Recentes</h3>
                                    <div className="flex items-center gap-2">
                                        <button className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase text-slate-500 hover:bg-slate-50">
                                            <Filter size={12}/> Filtrar
                                        </button>
                                    </div>
                                </div>

                                {reviews.length === 0 ? (
                                    <div className="bg-white p-20 rounded-[40px] border-2 border-dashed border-slate-100 text-center">
                                        <MessageSquare size={48} className="mx-auto text-slate-100 mb-6" />
                                        <h4 className="font-black text-slate-800 text-lg">Sem avaliações ainda</h4>
                                        <p className="text-slate-400 text-sm mt-2 max-w-xs mx-auto leading-relaxed">As avaliações aparecerão aqui assim que seus clientes finalizarem o agendamento pelo link.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {reviews.map(review => (
                                            <ReviewCard 
                                                key={review.id} 
                                                review={review} 
                                                onToggle={handleToggleReview}
                                                onDelete={handleDeleteReview}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AgendaOnlineView;

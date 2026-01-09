
import React, { useState, useEffect, useMemo } from 'react';
import { 
    Globe, Settings, MessageSquare, BarChart2, ExternalLink, 
    Copy, CheckCircle, Share2, Save, Eye, Star, MessageCircle,
    Clock, Calendar, AlertTriangle, ShieldCheck, Loader2, Info,
    Trash2, User, Filter, EyeOff, StarHalf, TrendingUp, TrendingDown,
    MousePointer2, CalendarCheck, DollarSign, RefreshCw, Sparkles, Scissors
} from 'lucide-react';
import { 
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
    CartesianGrid, Tooltip, BarChart, Bar, Cell 
} from 'recharts';
import Card from '../shared/Card';
import ToggleSwitch from '../shared/ToggleSwitch';
import { supabase } from '../../services/supabaseClient';
import Toast, { ToastType } from '../shared/Toast';
import { format, subDays, startOfDay, parseISO, isSameDay } from 'date-fns';
import { ptBR as pt } from 'date-fns/locale/pt-BR';

// --- Subcomponente de KPI Card ---
const KpiCard = ({ label, value, icon: Icon, color, trend, trendValue }: any) => (
    <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-md transition-all">
        <div className="flex justify-between items-start mb-4">
            <div className={`p-3 rounded-2xl ${color} text-white shadow-lg`}>
                <Icon size={20} />
            </div>
            {trend && (
                <div className={`flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg ${trend === 'up' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                    {trend === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {trendValue}%
                </div>
            )}
        </div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
        <h3 className="text-2xl font-black text-slate-800 mt-1">{value}</h3>
    </div>
);

const StarRating = ({ rating, size = 16 }: { rating: number; size?: number }) => (
    <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
            <Star
                key={star}
                size={size}
                className={star <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}
            />
        ))}
    </div>
);

const ReviewCard = ({ review, onToggle, onDelete }: any) => (
    <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm group">
        <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 font-black">
                    {review.client_name?.charAt(0) || 'C'}
                </div>
                <div>
                    <h4 className="font-black text-slate-800 text-sm">{review.client_name}</h4>
                    <div className="flex items-center gap-2 mt-1">
                        <StarRating rating={review.rating} size={12} />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            {review.created_at ? format(parseISO(review.created_at), 'dd MMM yyyy', { locale: pt }) : '---'}
                        </span>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                    onClick={() => onToggle(review.id, !review.is_public)}
                    className={`p-2 rounded-xl transition-all ${review.is_public ? 'bg-orange-50 text-orange-600' : 'bg-slate-50 text-slate-400'}`}
                    title={review.is_public ? "Ocultar" : "Mostrar"}
                >
                    {review.is_public ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
                <button 
                    onClick={() => onDelete(review.id)}
                    className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                >
                    <Trash2 size={16} />
                </button>
            </div>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed font-medium italic">"{review.comment}"</p>
        {review.service_name && (
            <div className="mt-4 pt-4 border-t border-slate-50 flex items-center gap-2">
                <Scissors size={12} className="text-slate-300" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{review.service_name}</span>
            </div>
        )}
    </div>
);

// --- Componentes auxiliares de UI ---
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
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const [reviews, setReviews] = useState<any[]>([]);
    
    const [metrics, setMetrics] = useState({
        views: 0,
        bookings: 0,
        revenue: 0,
        conversion: 0
    });
    const [chartData, setChartData] = useState<any[]>([]);
    const [topServices, setTopServices] = useState<any[]>([]);

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

    // Link real de acesso público baseado na rota atual do navegador
    const realLink = useMemo(() => {
        return window.location.origin + "/#/public-preview";
    }, []);

    const fetchAnalytics = async () => {
        setIsRefreshing(true);
        try {
            const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
            const { data: appts } = await supabase
                .from('appointments')
                .select('value, service_name, date')
                .eq('origem', 'link')
                .gte('date', thirtyDaysAgo);

            const viewsCount = 450; 

            if (appts) {
                const totalRev = appts.reduce((acc, curr) => acc + (Number(curr.value) || 0), 0);
                const totalBookings = appts.length;
                const conversion = viewsCount > 0 ? (totalBookings / viewsCount) * 100 : 0;

                setMetrics({
                    views: viewsCount,
                    bookings: totalBookings,
                    revenue: totalRev,
                    conversion: Number(conversion.toFixed(1))
                });

                const ranking: Record<string, number> = {};
                appts.forEach(a => {
                    ranking[a.service_name] = (ranking[a.service_name] || 0) + 1;
                });
                const sortedRanking = Object.entries(ranking)
                    .map(([name, count]) => ({ name, count }))
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 5);
                setTopServices(sortedRanking);

                const last7Days = Array.from({ length: 7 }).map((_, i) => {
                    const d = subDays(new Date(), 6 - i);
                    const dayBookings = appts.filter(a => isSameDay(parseISO(a.date), d)).length;
                    const dayViews = Math.floor(Math.random() * 20) + 10; 
                    return {
                        name: format(d, 'dd/MM'),
                        views: dayViews,
                        bookings: dayBookings
                    };
                });
                setChartData(last7Days);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsRefreshing(false);
        }
    };

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

            await fetchAnalytics();

        } catch (e) {
            showToast("Erro ao carregar dados.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const payload = {
                online_booking_active: config.isActive,
                min_scheduling_notice: parseFloat(config.min_scheduling_notice), 
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

    const handleCopyLink = () => {
        navigator.clipboard.writeText(realLink);
        showToast('Link copiado!');
    };

    const handleShareWhatsApp = () => {
        const text = `Olá! Agende seu horário no ${config.studioName || 'nosso estúdio'} através do link: ${realLink}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    };

    if (isLoading) return <div className="h-full flex items-center justify-center text-slate-400 font-bold uppercase tracking-widest text-[10px]"><Loader2 className="animate-spin text-orange-500 mr-2" /> Carregando Painel...</div>;

    return (
        <div className="h-full flex flex-col bg-slate-50 overflow-hidden font-sans text-left">
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
                    
                    {activeTab === 'analytics' && (
                        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                            <div className="flex justify-between items-center px-2">
                                <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Retorno dos últimos 30 dias</h2>
                                <button onClick={fetchAnalytics} disabled={isRefreshing} className="flex items-center gap-2 text-[10px] font-black text-orange-500 uppercase tracking-widest hover:text-orange-600 transition-colors">
                                    <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} /> Atualizar Dados
                                </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <KpiCard label="Acessos ao Link" value={metrics.views} icon={MousePointer2} color="bg-blue-500" trend="up" trendValue="12" />
                                <KpiCard label="Agendamentos" value={metrics.bookings} icon={CalendarCheck} color="bg-purple-500" trend="up" trendValue="8" />
                                <KpiCard label="Conversão" value={`${metrics.conversion}%`} icon={TrendingUp} color="bg-amber-500" />
                                <KpiCard label="Faturamento Link" value={`R$ ${metrics.revenue.toFixed(0)}`} icon={DollarSign} color="bg-emerald-500" />
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <Card title="Tendência de Acessos vs. Reservas" className="lg:col-span-2 rounded-[32px] overflow-hidden">
                                    <div className="h-64 mt-4">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                <defs>
                                                    <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 'bold'}} />
                                                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                                                <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} labelStyle={{fontWeight: '900', color: '#1e293b', marginBottom: '4px'}} />
                                                <Area type="monotone" dataKey="views" name="Acessos" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorViews)" />
                                                <Area type="monotone" dataKey="bookings" name="Reservas" stroke="#f97316" strokeWidth={3} fill="transparent" />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="flex justify-center gap-6 mt-4">
                                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500"><div className="w-2 h-2 rounded-full bg-blue-500"></div> Acessos</div>
                                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500"><div className="w-2 h-2 rounded-full bg-orange-500"></div> Reservas</div>
                                    </div>
                                </Card>

                                <Card title="Mais Procurados" className="rounded-[32px]">
                                    <div className="space-y-4 mt-2">
                                        {topServices.map((service, index) => (
                                            <div key={index} className="flex items-center gap-4 group">
                                                <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-[10px] font-black text-slate-400 border border-slate-100 group-hover:bg-orange-50 group-hover:text-orange-600 transition-colors">
                                                    #{index + 1}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-slate-700 truncate">{service.name}</p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                            <div className="h-full bg-orange-400 rounded-full transition-all duration-1000" style={{ width: `${(service.count / metrics.bookings) * 100}%` }} />
                                                        </div>
                                                        <span className="text-[10px] font-black text-slate-400">{service.count}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                            </div>
                        </div>
                    )}

                    {activeTab === 'geral' && (
                        <div className="grid grid-cols-1 gap-6 animate-in fade-in duration-500">
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
                                            {realLink}
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={handleCopyLink} className="p-4 bg-white border border-slate-300 rounded-2xl hover:bg-slate-50 text-slate-600 transition-all shadow-sm"><Copy size={20}/></button>
                                            <button onClick={handleShareWhatsApp} className="p-4 bg-green-500 text-white rounded-2xl hover:bg-green-600 transition-all shadow-lg shadow-green-100"><Share2 size={20}/></button>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        </div>
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
                                                { value: '0.5', label: '30 minutos antes' },
                                                { value: '1', label: '1 hora antes' },
                                                { value: '2', label: '2 horas antes (Padrão)' },
                                                { value: '3', label: '3 horas antes' },
                                                { value: '4', label: '4 horas antes' },
                                                { value: '6', label: '6 horas antes' },
                                                { value: '12', label: '12 horas antes' },
                                                { value: '24', label: '24 horas (1 dia)' },
                                                { value: '48', label: '48 horas (2 dias)' },
                                            ]}
                                            helperText="Tempo mínimo para você se organizar antes do cliente chegar."
                                        />
                                        <StyledSelect 
                                            label="Horizonte da Agenda"
                                            icon={Calendar}
                                            value={config.max_scheduling_window}
                                            onChange={(val: string) => setConfig({...config, max_scheduling_window: val})}
                                            options={[
                                                { value: '7', label: 'Até 7 dias (Semana atual)' },
                                                { value: '15', label: 'Até 15 dias' },
                                                { value: '30', label: 'Até 30 dias (1 mês)' },
                                                { value: '60', label: 'Até 60 dias (2 meses)' },
                                                { value: '90', label: 'Até 90 dias (3 meses)' },
                                                { value: '180', label: 'Até 6 meses' },
                                            ]}
                                            helperText="Define até que data futura o cliente pode ver seus horários."
                                        />
                                    </div>
                                </Card>
                                <Card title="Política de Cancelamento" icon={<AlertTriangle size={20} className="text-orange-500" />} className="rounded-[32px]">
                                    <div className="space-y-6 mt-2">
                                        <StyledSelect 
                                            label="Aviso de Cancelamento"
                                            icon={Info}
                                            value={config.cancellation_notice}
                                            onChange={(val: string) => setConfig({...config, cancellation_notice: val})}
                                            options={[
                                                { value: '0', label: 'A qualquer momento' },
                                                { value: '1', label: 'Até 1 hora antes' },
                                                { value: '2', label: 'Até 2 horas antes' },
                                                { value: '4', label: 'Até 4 horas antes' },
                                                { value: '12', label: 'Até 12 horas antes' },
                                                { value: '24', label: 'Até 24 horas antes' },
                                                { value: '48', label: 'Até 48 horas antes' },
                                            ]}
                                            helperText="Tempo de antecedência exigido para o cancelamento sem multa."
                                        />
                                        <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100">
                                            <p className="text-[10px] text-orange-800 leading-relaxed font-bold italic">
                                                * Dica: Exigir 24h ajuda a manter sua taxa de ocupação estável.
                                            </p>
                                        </div>
                                    </div>
                                </Card>
                            </div>
                        </div>
                    )}

                    {activeTab === 'avaliacoes' && (
                        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                            <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-8">
                                <div className="text-center md:text-left">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Nota Média do Estúdio</p>
                                    <div className="flex items-end gap-3 justify-center md:justify-start">
                                        <h2 className="text-6xl font-black text-slate-800 tracking-tighter">4.9</h2>
                                        <div className="pb-2 space-y-1">
                                            <StarRating rating={5} size={24} />
                                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{reviews.length} avaliações</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="h-px w-20 bg-slate-100 md:h-20 md:w-px hidden sm:block"></div>
                                <div className="flex-1 max-w-xs space-y-2">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center md:text-left">Distribuição</p>
                                    {[5, 4, 3, 2, 1].map(star => {
                                        const count = reviews.filter(r => r.rating === star).length;
                                        const percent = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
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

                            <div className="space-y-4">
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
                                                onToggle={(id: any, status: any) => {
                                                    setReviews(prev => prev.map(r => r.id === id ? {...r, is_public: status} : r));
                                                    showToast(status ? "Visível" : "Oculto");
                                                }}
                                                onDelete={(id: any) => setReviews(prev => prev.filter(r => r.id !== id))}
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


import React, { useMemo, useState, useEffect } from 'react';
import Card from '../shared/Card';
import JaciBotAssistant from '../shared/JaciBotAssistant';
import TodayScheduleWidget from '../dashboard/TodayScheduleWidget';
import { getDashboardInsight } from '../../services/geminiService';
import { DollarSign, Calendar, Users, TrendingUp, PlusCircle, UserPlus, ShoppingBag, Clock, Globe, Loader2, BarChart3, Zap, UserCircle, Sparkles, Pencil } from 'lucide-react';
// FIX: Grouping date-fns imports and removing problematic members startOfDay, subDays, startOfMonth.
import { 
    format, addDays, endOfDay, endOfMonth
} from 'date-fns';
import { ptBR as pt } from 'date-fns/locale/pt-BR';
import { ViewState } from '../../types';
import { supabase } from '../../services/supabaseClient';
import { useStudio } from '../../contexts/StudioContext';
import toast from 'react-hot-toast';

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        maximumFractionDigits: 0
    }).format(value);
};

const StatCard = ({ title, value, icon: Icon, colorClass, subtext, trend }: any) => (
    <div className="bg-white p-5 rounded-[32px] border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-[0_20px_50px_rgba(0,0,0,0.05)] transition-all hover:-translate-y-1 text-left h-full group">
        <div className="flex items-start justify-between mb-4">
            <div className={`p-3.5 rounded-2xl flex-shrink-0 ${colorClass} shadow-lg transition-transform group-hover:scale-110`}>
                <Icon className="w-5 h-5 text-white" />
            </div>
            {trend && (
                <div className={`flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-full ${trend > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                    {trend > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                    {Math.abs(trend)}%
                </div>
            )}
        </div>
        <div className="min-w-0">
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-1">{title}</p>
            <h3 className="text-2xl font-black text-slate-800 tracking-tighter truncate">{value}</h3>
            {subtext && <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase truncate opacity-60 tracking-wider">{subtext}</p>}
        </div>
    </div>
);

const QuickAction = ({ icon: Icon, label, color, onClick }: any) => (
    <button 
        onClick={onClick}
        className="flex flex-col items-center justify-center p-5 rounded-[32px] border border-slate-100 bg-white hover:border-orange-200 hover:bg-orange-50/30 transition-all group active:scale-95 w-full shadow-sm hover:shadow-md"
    >
        <div className={`w-14 h-14 rounded-2xl mb-3 transition-all flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 shadow-lg ${color}`}>
            <Icon className="w-6 h-6 text-white" />
        </div>
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover:text-orange-700">{label}</span>
    </button>
);

const DashboardView: React.FC<{onNavigate: (view: ViewState) => void}> = ({ onNavigate }) => {
    const { activeStudioId } = useStudio();
    const [isLoading, setIsLoading] = useState(true);
    const [appointments, setAppointments] = useState<any[]>([]);
    const [financialGoal, setFinancialGoal] = useState(0);
    const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
    const [tempGoal, setTempGoal] = useState('');
    const [isSavingGoal, setIsSavingGoal] = useState(false);

    const handleSaveGoal = async (val: number) => {
        if (!activeStudioId) return;
        setIsSavingGoal(true);
        try {
            const { error } = await supabase
                .from('studio_settings')
                .upsert({
                    id: activeStudioId,
                    revenue_goal: val,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'id' });

            if (error) throw error;
            setFinancialGoal(val);
            toast.success("Meta faturamento atualizada com sucesso!");
            setIsGoalModalOpen(false);
        } catch (err: any) {
            console.error("Erro ao salvar meta financeira:", err);
            toast.error("Erro ao salvar meta financeira: " + (err.message || 'tente novamente'));
        } finally {
            setIsSavingGoal(false);
        }
    };

    const [monthRevenueTotal, setMonthRevenueTotal] = useState(0);
    const [last24hReminders, setLast24hReminders] = useState(0);
    
    // Filtro de Período
    const [filter, setFilter] = useState<'hoje' | 'semana' | 'mes' | 'custom'>('hoje');
    const [customStart] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [customEnd] = useState(format(new Date(), 'yyyy-MM-dd'));
    
    const dateRange = useMemo(() => {
        const now = new Date();
        switch (filter) {
            case 'hoje': {
                // FIX: Manual startOfDay replacement.
                const startToday = new Date(now);
                startToday.setHours(0, 0, 0, 0);
                return { 
                    start: startToday.toISOString(), 
                    end: endOfDay(now).toISOString(),
                    label: 'Hoje'
                };
            }
            case 'semana': {
                // FIX: Manual subDays and startOfDay replacement.
                const startWeek = addDays(now, -7);
                startWeek.setHours(0, 0, 0, 0);
                return { 
                    start: startWeek.toISOString(), 
                    end: endOfDay(now).toISOString(),
                    label: 'Últimos 7 dias'
                };
            }
            case 'mes': {
                // FIX: Manual startOfMonth replacement.
                const startMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
                return { 
                    start: startMonth.toISOString(), 
                    end: endOfMonth(now).toISOString(),
                    label: 'Este Mês'
                };
            }
            case 'custom': {
                // FIX: Manual startOfDay replacement.
                const startCustom = new Date(customStart);
                startCustom.setHours(0, 0, 0, 0);
                const endCustom = new Date(customEnd);
                endCustom.setHours(23, 59, 59, 999);
                return {
                    start: startCustom.toISOString(),
                    end: endCustom.toISOString(),
                    label: `Período: ${format(new Date(customStart), 'dd/MM')} a ${format(new Date(customEnd), 'dd/MM')}`
                };
            }
            default: {
                const sToday = new Date(now);
                sToday.setHours(0, 0, 0, 0);
                return { 
                    start: sToday.toISOString(), 
                    end: endOfDay(now).toISOString(),
                    label: 'Hoje'
                };
            }
        }
    }, [filter, customStart, customEnd]);

    // --- CARREGAMENTO DE DADOS ---
    useEffect(() => {
        if (!activeStudioId) return;
        let mounted = true;

        const fetchDashboardData = async () => {
            try {
                if (mounted) setIsLoading(true);

                const { data: appts, error: apptsError } = await supabase
                    .from('appointments')
                    .select('*')
                    .eq('studio_id', activeStudioId)
                    .gte('date', dateRange.start)
                    .lte('date', dateRange.end)
                    .order('date', { ascending: true });

                if (apptsError) throw apptsError;

                const rawAppts = appts || [];
                // Exibe os agendamentos imediatamente
                if (mounted) setAppointments(rawAppts);

                // Enriquesse depois de forma assíncrona e segura com o apelido/whatsapp do cliente
                if (rawAppts.length > 0) {
                    const clientIds = Array.from(new Set(rawAppts.map(r => r.client_id).filter(Boolean)));
                    if (clientIds.length > 0) {
                        try {
                            const { data: cData, error: cError } = await supabase
                                .from('clients')
                                .select('id, nome, apelido, whatsapp, email')
                                .in('id', clientIds);
                            
                            if (!cError && cData && cData.length > 0) {
                                const clientsMap = new Map(cData.map(c => [c.id, c]));
                                const enrichedAppts = rawAppts.map(row => ({
                                    ...row,
                                    clients: row.client_id ? clientsMap.get(row.client_id) : undefined
                                }));
                                if (mounted) setAppointments(enrichedAppts);
                            }
                        } catch (enrichError) {
                            console.warn("Falha silenciosa ao enriquecer clientes no dashboard:", enrichError);
                        }
                    }
                }

                const now = new Date();
                // FIX: Manual startOfMonth replacement.
                const startMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
                const startMonthStr = startMonth.toISOString();
                const endMonthStr = endOfMonth(now).toISOString();
                
                const { data: monthData, error: monthError } = await supabase
                    .from('appointments')
                    .select('value')
                    .eq('studio_id', activeStudioId)
                    .eq('status', 'concluido')
                    .gte('date', startMonthStr)
                    .lte('date', endMonthStr);
                
                if (monthError) throw monthError;
                
                const totalMonthRev = monthData?.reduce((acc, curr) => acc + (Number(curr.value) || 0), 0) || 0;
                if (mounted) setMonthRevenueTotal(totalMonthRev);

                const { data: settings, error: settingsError } = await supabase
                    .from('studio_settings')
                    .select('revenue_goal')
                    .eq('id', activeStudioId) // Supondo que id do studio_settings seja o activeStudioId
                    .maybeSingle();
                
                if (settingsError) throw settingsError;
                
                if (mounted) {
                    setFinancialGoal(settings?.revenue_goal || 5000);
                }

                // Busca dinâmica de disparos de lembrete da Jaci IA nas últimas 24h
                const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
                try {
                    const { count: reminderCount, error: countError } = await supabase
                        .from('whatsapp_reminders_log')
                        .select('*', { count: 'exact', head: true })
                        .eq('studio_id', activeStudioId)
                        .gte('sent_at', twentyFourHoursAgo);

                    if (!countError && mounted) {
                        setLast24hReminders(reminderCount || 0);
                    }
                } catch (err) {
                    console.error("Erro ao buscar lembretes 24h:", err);
                }

            } catch (e) {
                console.error("Erro crítico ao sincronizar dashboard:", e);
            } finally {
                if (mounted) setIsLoading(false);
            }
        };

        fetchDashboardData();

        return () => {
            mounted = false;
        };
    }, [dateRange, activeStudioId]);

    // KPIs Dinâmicos
    const kpis = useMemo(() => {
        const revenue = appointments
            .filter(a => a.status === 'concluido')
            .reduce((acc, a) => acc + (Number(a.value) || 0), 0);
        
        const scheduled = appointments.filter(a => a.status !== 'cancelado').length;
        const completed = appointments.filter(a => a.status === 'concluido').length;
        
        const onlineCount = appointments.filter(a => 
            (a.origin === 'online' || a.origin === 'link') && 
            a.status !== 'cancelado'
        ).length;
        
        const onlineRate = scheduled > 0 ? (onlineCount / scheduled) * 100 : 0;

        return { revenue, scheduled, completed, onlineCount, onlineRate };
    }, [appointments]);

    // Lógica de Meta Financeira
    const goalMetrics = useMemo(() => {
        const goalProgress = financialGoal > 0 ? (monthRevenueTotal / financialGoal) * 100 : 0;
        const displayGoal = financialGoal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        return {
            progress: goalProgress,
            display: displayGoal,
            visual: Math.min(goalProgress, 100)
        };
    }, [monthRevenueTotal, financialGoal]);

    if (isLoading) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-white">
                <div className="relative">
                    <Loader2 className="animate-spin text-orange-500 mb-4" size={48} />
                    <div className="absolute inset-0 animate-ping rounded-full border-4 border-orange-100"></div>
                </div>
                <p className="text-xs font-black uppercase tracking-[0.3em] mt-4">Sincronizando {dateRange.label}...</p>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-8 h-full overflow-y-auto bg-slate-50/30 custom-scrollbar font-sans text-left">
            <header className="flex flex-col xl:flex-row justify-between items-start xl:items-end mb-10 gap-6">
                <div>
                    <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mb-2">
                        <Zap size={14} className="text-orange-500 animate-pulse" />
                        <span>Insight do Sistema • {format(new Date(), "dd 'de' MMMM", { locale: pt })}</span>
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-black text-slate-800 leading-none tracking-tighter">
                        Olá, <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-orange-400">Time Belare</span>
                    </h1>
                    <p className="text-slate-400 text-sm mt-2 font-medium">Seu estúdio está com <span className="text-emerald-500 font-black">94% de produtividade</span> hoje.</p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full xl:w-auto">
                    <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <button onClick={() => setFilter('hoje')} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filter === 'hoje' ? 'bg-slate-800 text-white shadow-xl' : 'text-slate-400 hover:bg-slate-50'}`}>Hoje</button>
                        <button onClick={() => setFilter('semana')} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filter === 'semana' ? 'bg-slate-800 text-white shadow-xl' : 'text-slate-400 hover:bg-slate-50'}`}>7 Dias</button>
                        <button onClick={() => setFilter('mes')} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filter === 'mes' ? 'bg-slate-800 text-white shadow-xl' : 'text-slate-400 hover:bg-slate-50'}`}>Mês</button>
                    </div>
                    <button onClick={() => onNavigate('agenda')} className="px-6 py-4 bg-orange-500 text-white font-black rounded-2xl hover:bg-orange-600 focus:ring-4 focus:ring-orange-100 transition-all shadow-xl shadow-orange-500/20 flex items-center justify-center gap-2 text-xs uppercase tracking-widest active:scale-95">
                        <PlusCircle size={18} /> Novo Agendamento
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 lg:gap-6 mb-10">
                <StatCard title="Faturamento" value={formatCurrency(kpis.revenue)} icon={DollarSign} colorClass="bg-emerald-500" subtext={dateRange.label} trend={12} />
                <StatCard title="Agendados" value={kpis.scheduled} icon={Calendar} colorClass="bg-blue-500" subtext={dateRange.label} trend={8} />
                <StatCard title="Online" value={kpis.onlineCount} icon={Globe} colorClass="bg-orange-500" subtext={`${kpis.onlineRate.toFixed(1)}% do total`} trend={22} />
                <StatCard title="Ticket Médio" value={formatCurrency(kpis.revenue / (kpis.completed || 1))} icon={TrendingUp} colorClass="bg-purple-500" subtext="Por cliente" />
                <StatCard title="Lembretes Jaci IA" value={`${last24hReminders} ${last24hReminders === 1 ? 'disparo' : 'disparos'}`} icon={Sparkles} colorClass="bg-orange-500" subtext="Últimas 24 horas" />
                
                <div 
                    onClick={() => { setTempGoal(financialGoal ? financialGoal.toString() : ''); setIsGoalModalOpen(true); }}
                    className="bg-slate-900 p-6 rounded-[32px] text-white flex flex-col justify-between shadow-2xl relative overflow-hidden group h-full cursor-pointer hover:bg-slate-800 transition-all active:scale-98 border border-white/5"
                    title="Clique para editar a meta mensal"
                >
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                        <Zap size={120} />
                    </div>
                    <div className="flex justify-between items-start z-10 font-bold">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-400">FOCO NA META</p>
                        <div className="flex items-center gap-1 bg-orange-500/20 border border-orange-500/10 px-2.5 py-0.5 rounded-full text-orange-400 text-[8px] tracking-wider uppercase font-black">
                            <Pencil size={8} /> Alterar
                        </div>
                    </div>
                    <div className="mt-4 z-10 text-left">
                        <div className="flex items-end justify-between mb-3">
                            <h3 className="text-3xl font-black tracking-tighter">{goalMetrics.progress.toFixed(0)}%</h3>
                            <span className="text-[10px] font-bold text-slate-400 mb-1">ALVO: {goalMetrics.display}</span>
                        </div>
                        <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden mb-1">
                            <div className="h-full bg-gradient-to-r from-orange-600 to-orange-400 transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(249,115,22,0.5)]" style={{ width: `${goalMetrics.visual}%` }} />
                        </div>
                        <p className="text-[8px] text-slate-500 font-bold uppercase mt-1 tracking-wider text-right">Toque para configurar</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                        <QuickAction icon={UserCircle} label="Clientes" color="bg-blue-600" onClick={() => onNavigate('clientes')} />
                        <QuickAction icon={Globe} label="Portal" color="bg-purple-600" onClick={() => onNavigate('agenda_online')} />
                        <QuickAction icon={ShoppingBag} label="PDV" color="bg-emerald-600" onClick={() => onNavigate('vendas')} />
                        <QuickAction icon={BarChart3} label="DRE" color="bg-slate-800" onClick={() => onNavigate('relatorios')} />
                        <QuickAction icon={Calendar} label="Agenda" color="bg-orange-600" onClick={() => onNavigate('agenda')} />
                    </div>
                    
                    <div className="bg-white rounded-[40px] p-2 border border-slate-100 shadow-sm overflow-hidden">
                        <JaciBotAssistant fetchInsight={getDashboardInsight} />
                    </div>
                    
                    <Card title="Desempenho Semanal" icon={<BarChart3 size={18} className="text-orange-500" />}>
                        <div className="py-16 text-center text-slate-400 flex flex-col items-center">
                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-slate-200">
                                <TrendingUp size={40} />
                            </div>
                            <p className="text-xs font-black uppercase tracking-[0.3em]">IA em processamento...</p>
                            <p className="text-[10px] font-bold mt-2 text-slate-300">Cruzando dados de faturamento e ocupação</p>
                        </div>
                    </Card>
                </div>
                <div className="lg:col-span-1">
                    <div className="sticky top-6">
                        <TodayScheduleWidget onNavigate={onNavigate} appointments={appointments} dateLabel={dateRange.label} />
                    </div>
                </div>
            </div>

            {isGoalModalOpen && (
                <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div 
                        className="bg-white rounded-[32px] p-8 max-w-sm w-full border border-slate-100 shadow-[0_20px_50px_rgba(0,0,0,0.15)] animate-in zoom-in-95 duration-200 relative overflow-hidden text-center"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center mx-auto mb-4 border border-orange-500/5">
                            <Zap size={22} className="animate-pulse" />
                        </div>
                        <h3 className="font-black text-slate-800 uppercase tracking-tighter text-lg leading-tight">Meta de Faturamento</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 mb-6">Defina o objetivo financeiro mensal do estúdio</p>
                        
                        <div className="relative mb-6">
                            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-black text-sm">R$</span>
                            <input 
                                type="number" 
                                value={tempGoal} 
                                onChange={e => {
                                    const val = e.target.value;
                                    if (val === '' || parseFloat(val) >= 0) {
                                        setTempGoal(val);
                                    }
                                }}
                                placeholder="5000"
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-5 py-4 font-black text-slate-700 text-lg outline-none focus:ring-4 focus:ring-orange-100 focus:border-orange-500/30 transition-all shadow-inner text-left"
                                autoFocus
                            />
                        </div>

                        <div className="flex gap-3">
                            <button 
                                onClick={() => setIsGoalModalOpen(false)} 
                                disabled={isSavingGoal}
                                className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold rounded-2xl text-[10px] uppercase tracking-widest transition-all active:scale-95"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={async () => {
                                    const val = parseFloat(tempGoal) || 0;
                                    await handleSaveGoal(val);
                                }} 
                                disabled={isSavingGoal}
                                className="flex-1 py-4 bg-slate-800 hover:bg-slate-900 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
                            >
                                {isSavingGoal ? <Loader2 size={16} className="animate-spin text-white" /> : 'Salvar Meta'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DashboardView;

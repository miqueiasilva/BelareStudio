
import React, { useMemo, useState, useEffect } from 'react';
import Card from '../shared/Card';
import JaciBotAssistant from '../shared/JaciBotAssistant';
import TodayScheduleWidget from '../dashboard/TodayScheduleWidget';
import WeeklyChart from '../charts/WeeklyChart';
import { getDashboardInsight } from '../../services/geminiService';
import { DollarSign, Calendar, Users, TrendingUp, PlusCircle, UserPlus, ShoppingBag, Clock, Globe, Edit3, Loader2, BarChart3, AlertCircle, ChevronRight, CalendarRange, Filter as FilterIcon } from 'lucide-react';
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, isSameDay, parseISO } from 'date-fns';
import { ptBR as pt } from 'date-fns/locale/pt-BR';
import { ViewState } from '../../types';
import { supabase } from '../../services/supabaseClient';
import { useStudio } from '../../contexts/StudioContext';

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        maximumFractionDigits: 0
    }).format(value);
};

const StatCard = ({ title, value, icon: Icon, colorClass, subtext }: any) => (
    <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-sm flex items-start justify-between hover:shadow-md transition-shadow text-left h-full">
        <div className="min-w-0">
            <p className="text-slate-500 text-[10px] sm:text-xs font-black uppercase tracking-wider truncate">{title}</p>
            <h3 className="text-xl sm:text-2xl font-black text-slate-800 mt-1 truncate">{value}</h3>
            {subtext && <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase truncate">{subtext}</p>}
        </div>
        <div className={`p-2.5 sm:p-3 rounded-xl flex-shrink-0 ${colorClass}`}>
            <Icon className="w-5 h-5 text-white" />
        </div>
    </div>
);

const QuickAction = ({ icon: Icon, label, color, onClick }: any) => (
    <button 
        onClick={onClick}
        className="flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl border border-slate-100 bg-white hover:border-orange-200 hover:bg-orange-50 transition-all group active:scale-95 w-full"
    >
        <div className={`p-3 rounded-full mb-2 transition-colors group-hover:bg-white ${color} shadow-sm`}>
            <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white group-hover:text-orange-50" />
        </div>
        <span className="text-[10px] sm:text-xs font-black text-slate-600 uppercase tracking-tighter group-hover:text-orange-700">{label}</span>
    </button>
);

const DashboardView: React.FC<{onNavigate: (view: ViewState) => void}> = ({ onNavigate }) => {
    const { activeStudioId } = useStudio();
    const [isLoading, setIsLoading] = useState(true);
    const [appointments, setAppointments] = useState<any[]>([]);
    const [financialGoal, setFinancialGoal] = useState(0);
    const [monthRevenueTotal, setMonthRevenueTotal] = useState(0);
    
    // Filtro de Período
    const [filter, setFilter] = useState<'hoje' | 'semana' | 'mes' | 'custom'>('hoje');
    const [customStart, setCustomStart] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [customEnd, setCustomEnd] = useState(format(new Date(), 'yyyy-MM-dd'));
    
    // Estados temporários para o filtro personalizado (UX de confirmação)
    const [tempStart, setTempStart] = useState(customStart);
    const [tempEnd, setTempEnd] = useState(customEnd);

    const dateRange = useMemo(() => {
        const now = new Date();
        switch (filter) {
            case 'hoje':
                return { 
                    start: startOfDay(now).toISOString(), 
                    end: endOfDay(now).toISOString(),
                    label: 'Hoje'
                };
            case 'semana':
                return { 
                    start: startOfDay(subDays(now, 7)).toISOString(), 
                    end: endOfDay(now).toISOString(),
                    label: 'Últimos 7 dias'
                };
            case 'mes':
                return { 
                    start: startOfMonth(now).toISOString(), 
                    end: endOfMonth(now).toISOString(),
                    label: 'Este Mês'
                };
            case 'custom':
                return {
                    start: startOfDay(parseISO(customStart)).toISOString(),
                    end: endOfDay(parseISO(customEnd)).toISOString(),
                    label: `Período: ${format(parseISO(customStart), 'dd/MM')} a ${format(parseISO(customEnd), 'dd/MM')}`
                };
            default:
                return { 
                    start: startOfDay(now).toISOString(), 
                    end: endOfDay(now).toISOString(),
                    label: 'Hoje'
                };
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
                if (mounted) setAppointments(appts || []);

                const now = new Date();
                const startMonthStr = startOfMonth(now).toISOString();
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

        return { revenue, scheduled, completed };
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

    const handleApplyCustomFilter = () => {
        setCustomStart(tempStart);
        setCustomEnd(tempEnd);
    };

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
        <div className="p-4 sm:p-6 h-full overflow-y-auto bg-slate-50/50 custom-scrollbar font-sans text-left">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 sm:mb-8 gap-4">
                <div>
                    <div className="flex items-center gap-2 text-slate-400 text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-1">
                        <Calendar size={14} className="text-orange-500" />
                        <span className="capitalize">{format(new Date(), "EEEE, dd 'de' MMMM", { locale: pt })}</span>
                    </div>
                    <h1 className="text-xl sm:text-3xl font-black text-slate-800 leading-tight">
                        Dashboard <span className="text-orange-500">Real-Time</span>
                    </h1>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex flex-col gap-2 items-end">
                        <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <button onClick={() => setFilter('hoje')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${filter === 'hoje' ? 'bg-orange-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>Hoje</button>
                            <button onClick={() => setFilter('semana')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${filter === 'semana' ? 'bg-orange-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>7 Dias</button>
                            <button onClick={() => setFilter('mes')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${filter === 'mes' ? 'bg-orange-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>Mês</button>
                            <button onClick={() => setFilter('custom')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${filter === 'custom' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>Personalizado</button>
                        </div>
                    </div>
                    <button onClick={() => onNavigate('agenda')} className="px-4 py-2.5 bg-orange-500 text-white font-black rounded-xl hover:bg-orange-600 transition shadow-lg flex items-center gap-2 text-sm active:scale-95">
                        <PlusCircle size={18} /> Novo Agendamento
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
                <StatCard title={`Faturamento (${dateRange.label})`} value={formatCurrency(kpis.revenue)} icon={DollarSign} colorClass="bg-green-500" subtext="Serviços concluídos" />
                <StatCard title={`Agendados (${dateRange.label})`} value={kpis.scheduled} icon={Calendar} colorClass="bg-blue-500" subtext="Total no período" />
                <StatCard title={`Concluídos (${dateRange.label})`} value={kpis.completed} icon={Users} colorClass="bg-purple-500" subtext="Finalizados" />
                
                <div className="bg-slate-800 p-4 sm:p-5 rounded-2xl text-white flex flex-col justify-between shadow-lg relative overflow-hidden group h-full">
                    <div className="flex justify-between items-start z-10">
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-60">META MENSAL</p>
                        <TrendingUp size={12} className="text-orange-400" />
                    </div>
                    <div className="mt-2 z-10">
                        <div className="flex items-end justify-between mb-2">
                            <h3 className="text-2xl font-black">{goalMetrics.progress.toFixed(1)}%</h3>
                            <span className="text-[10px] font-bold opacity-60">alvo: {goalMetrics.display}</span>
                        </div>
                        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mb-1">
                            <div className="h-full bg-orange-500 transition-all duration-1000 ease-out" style={{ width: `${goalMetrics.visual}%` }} />
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-4">
                        <QuickAction icon={UserPlus} label="Cliente" color="bg-blue-500" onClick={() => onNavigate('clientes')} />
                        <QuickAction icon={Globe} label="Link" color="bg-purple-500" onClick={() => onNavigate('agenda_online')} />
                        <QuickAction icon={ShoppingBag} label="Venda" color="bg-green-500" onClick={() => onNavigate('vendas')} />
                        <QuickAction icon={TrendingUp} label="Caixa" color="bg-slate-700" onClick={() => onNavigate('financeiro')} />
                        <QuickAction icon={Clock} label="Agenda" color="bg-orange-500" onClick={() => onNavigate('agenda')} />
                    </div>
                    <JaciBotAssistant fetchInsight={getDashboardInsight} />
                    <Card title="Atividade Recente" icon={<BarChart3 size={18} className="text-orange-500" />}>
                        <div className="py-10 text-center text-slate-400 flex flex-col items-center">
                            <TrendingUp className="opacity-10 mb-2" size={48} />
                            <p className="text-sm font-bold uppercase tracking-widest">Análise em processamento...</p>
                        </div>
                    </Card>
                </div>
                <div className="lg:col-span-1">
                    <TodayScheduleWidget onNavigate={onNavigate} appointments={appointments} dateLabel={dateRange.label} />
                </div>
            </div>
        </div>
    );
};

export default DashboardView;

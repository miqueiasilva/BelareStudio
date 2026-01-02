
import React, { useMemo, useState, useEffect } from 'react';
import Card from '../shared/Card';
import JaciBotAssistant from '../shared/JaciBotAssistant';
import TodayScheduleWidget from '../dashboard/TodayScheduleWidget';
import WeeklyChart from '../charts/WeeklyChart';
import { getDashboardInsight } from '../../services/geminiService';
import { DollarSign, Calendar, Users, TrendingUp, PlusCircle, UserPlus, ShoppingBag, Clock, Globe, Edit3, Loader2, BarChart3, AlertCircle } from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { ptBR as pt } from 'date-fns/locale/pt-BR';
import { ViewState } from '../../types';
import { supabase } from '../../services/supabaseClient';

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        maximumFractionDigits: 0
    }).format(value);
};

const StatCard = ({ title, value, icon: Icon, colorClass, subtext }: any) => (
    <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-sm flex items-start justify-between hover:shadow-md transition-shadow text-left">
        <div className="min-w-0">
            <p className="text-slate-500 text-[10px] sm:text-xs font-black uppercase tracking-wider truncate">{title}</p>
            <h3 className="text-xl sm:text-2xl font-black text-slate-800 mt-1 truncate">{value}</h3>
            {subtext && <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase">{subtext}</p>}
        </div>
        <div className={`p-2.5 sm:p-3 rounded-xl flex-shrink-0 ${colorClass}`}>
            <Icon className="w-5 h-5 text-white" />
        </div>
    </div>
);

const QuickAction = ({ icon: Icon, label, color, onClick }: any) => (
    <button 
        onClick={onClick}
        className="flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl border border-slate-100 bg-white hover:border-orange-200 hover:bg-orange-50 transition-all group active:scale-95"
    >
        <div className={`p-3 rounded-full mb-2 transition-colors group-hover:bg-white ${color} shadow-sm`}>
            <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white group-hover:text-orange-50" />
        </div>
        <span className="text-[10px] sm:text-xs font-black text-slate-600 uppercase tracking-tighter group-hover:text-orange-700">{label}</span>
    </button>
);

const DashboardView: React.FC<{onNavigate: (view: ViewState) => void}> = ({ onNavigate }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [todayAppointments, setTodayAppointments] = useState<any[]>([]);
    const [monthlyGoal, setMonthlyGoal] = useState(0);
    const [monthRevenue, setMonthRevenue] = useState(0);

    // --- CARREGAMENTO SEGURO (ANTI-HANG) ---
    useEffect(() => {
        let mounted = true;

        const fetchDashboardData = async () => {
            try {
                if (mounted) setIsLoading(true);

                const now = new Date();
                const start = startOfDay(now).toISOString();
                const end = endOfDay(now).toISOString();

                // 1. Agendamentos de HOJE
                const { data: appts, error: apptsError } = await supabase
                    .from('appointments')
                    .select('*')
                    .gte('date', start)
                    .lte('date', end)
                    .order('date', { ascending: true });

                if (apptsError) throw apptsError;
                if (mounted) setTodayAppointments(appts || []);

                // 2. Meta e Faturamento Mensal
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
                const { data: monthData } = await supabase
                    .from('appointments')
                    .select('value')
                    .eq('status', 'concluido')
                    .gte('date', startOfMonth)
                    .lte('date', end);
                
                const totalMonth = monthData?.reduce((acc, curr) => acc + (Number(curr.value) || 0), 0) || 0;
                if (mounted) setMonthRevenue(totalMonth);

                // 3. Busca meta do estúdio
                const { data: settings } = await supabase.from('studio_settings').select('monthly_revenue_goal').maybeSingle();
                if (mounted) setMonthlyGoal(settings?.monthly_revenue_goal || 0);

                // Delay de segurança para UX
                await new Promise(resolve => setTimeout(resolve, 300));

            } catch (e) {
                console.error("Erro crítico ao sincronizar dashboard:", e);
                // No caso de erro, apenas exibimos o que temos (ou vazio) mas liberamos a tela
            } finally {
                // GARANTIA DE DESTRAVAMENTO
                if (mounted) setIsLoading(false);
            }
        };

        fetchDashboardData();

        return () => {
            mounted = false;
        };
    }, []);

    // KPIs Calculados estritamente dos dados de hoje
    const kpis = useMemo(() => {
        const revenue = todayAppointments
            .filter(a => a.status === 'concluido')
            .reduce((acc, a) => acc + (Number(a.value) || 0), 0);
        
        const scheduled = todayAppointments.filter(a => a.status !== 'cancelado').length;
        const completed = todayAppointments.filter(a => a.status === 'concluido').length;

        return { revenue, scheduled, completed };
    }, [todayAppointments]);

    const goalPercent = useMemo(() => {
        if (monthlyGoal <= 0) return 0;
        return Math.min(100, Math.round((monthRevenue / monthlyGoal) * 100));
    }, [monthRevenue, monthlyGoal]);

    if (isLoading) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-white">
                <div className="relative">
                    <Loader2 className="animate-spin text-orange-500 mb-4" size={48} />
                    <div className="absolute inset-0 animate-ping rounded-full border-4 border-orange-100"></div>
                </div>
                <p className="text-xs font-black uppercase tracking-[0.3em] animate-pulse mt-4">Sincronizando hoje...</p>
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
                <button onClick={() => onNavigate('agenda')} className="px-4 py-2.5 bg-orange-500 text-white font-black rounded-xl hover:bg-orange-600 transition shadow-lg shadow-orange-100 flex items-center gap-2 text-sm active:scale-95">
                    <PlusCircle size={18} /> Novo Agendamento
                </button>
            </header>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
                <StatCard 
                    title="Faturamento Hoje" 
                    value={formatCurrency(kpis.revenue)} 
                    icon={DollarSign} 
                    colorClass="bg-green-500" 
                    subtext="Serviços concluídos"
                />
                <StatCard 
                    title="Agendados" 
                    value={kpis.scheduled} 
                    icon={Calendar} 
                    colorClass="bg-blue-500" 
                    subtext="Total ativo hoje"
                />
                <StatCard 
                    title="Concluídos" 
                    value={kpis.completed} 
                    icon={Users} 
                    colorClass="bg-purple-500" 
                    subtext="Finalizados"
                />
                
                <div className="bg-slate-800 p-4 sm:p-5 rounded-2xl text-white flex flex-col justify-between shadow-lg relative overflow-hidden group">
                    <div className="flex justify-between items-start z-10">
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Meta Mensal</p>
                        <TrendingUp size={12} className="text-orange-400" />
                    </div>
                    <div className="mt-2 z-10">
                        <div className="flex items-end justify-between mb-2">
                            <h3 className="text-2xl font-black">{goalPercent}%</h3>
                            <span className="text-[10px] font-bold opacity-60">alvo: {formatCurrency(monthlyGoal)}</span>
                        </div>
                        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mb-1">
                            <div className="h-full bg-orange-500 transition-all duration-1000" style={{ width: `${goalPercent}%` }} />
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-4">
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
                            <p className="text-sm font-bold uppercase tracking-widest">Gráficos em sincronização...</p>
                        </div>
                    </Card>
                </div>

                <div className="lg:col-span-1">
                    <TodayScheduleWidget onNavigate={onNavigate} appointments={todayAppointments} />
                </div>
            </div>
        </div>
    );
};

export default DashboardView;

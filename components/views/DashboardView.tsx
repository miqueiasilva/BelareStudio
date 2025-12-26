import React, { useMemo, useState, useEffect } from 'react';
import Card from '../shared/Card';
import JaciBotAssistant from '../shared/JaciBotAssistant';
import TodayScheduleWidget from '../dashboard/TodayScheduleWidget';
import WeeklyChart from '../charts/WeeklyChart';
import { getDashboardInsight } from '../../services/geminiService';
import { DollarSign, Calendar, Users, TrendingUp, PlusCircle, UserPlus, ShoppingBag, Clock, Globe, Edit3, Loader2, BarChart3 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR as pt } from 'date-fns/locale/pt-BR';
import { toNumber } from '../../utils/normalize';
import { ViewState } from '../../types';
import { supabase } from '../../services/supabaseClient';

interface DashboardData {
    today_revenue: number;
    today_scheduled: number;
    today_completed: number;
    week_chart_data: { day: string; count: number }[];
}

const StatCard = ({ title, value, trend, icon: Icon, colorClass }: any) => (
    <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-sm flex items-start justify-between hover:shadow-md transition-shadow text-left">
        <div className="min-w-0">
            <p className="text-slate-500 text-[10px] sm:text-xs font-black uppercase tracking-wider truncate">{title}</p>
            <h3 className="text-xl sm:text-2xl font-black text-slate-800 mt-1 truncate">{value}</h3>
            {trend && (
                <div className="flex items-center gap-1 mt-2">
                    <span className={`text-[10px] font-bold ${trend > 0 ? 'text-green-600' : 'text-red-600'} bg-opacity-10 py-0.5 px-1.5 rounded`}>
                        {trend > 0 ? '+' : ''}{trend}%
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">vs. ontem</span>
                </div>
            )}
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
            <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white group-hover:text-orange-500" />
        </div>
        <span className="text-[10px] sm:text-xs font-black text-slate-600 uppercase tracking-tighter group-hover:text-orange-700">{label}</span>
    </button>
);

const DashboardView: React.FC<{onNavigate: (view: ViewState) => void}> = ({ onNavigate }) => {
    const today = new Date();
    const [goal, setGoal] = useState<number>(10000);
    const [dbData, setDbData] = useState<DashboardData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchDashboardData = async () => {
        setIsLoading(true);
        try {
            // 1. Busca resumo via RPC
            const { data: summary, error: rpcError } = await supabase.rpc('get_dashboard_summary');
            if (rpcError) throw rpcError;
            
            // 2. Busca Meta
            const { data: settings } = await supabase.from('studio_settings').select('monthly_revenue_goal').maybeSingle();
            
            if (summary) setDbData(summary);
            if (settings) setGoal(toNumber(settings.monthly_revenue_goal));
        } catch (e) {
            console.error("Dashboard Fetch Error:", e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const goalProgress = useMemo(() => {
        if (!dbData || goal <= 0) return 0;
        return (dbData.today_revenue / goal) * 100;
    }, [dbData, goal]);

    const handleEditGoal = async () => {
        const newGoal = prompt("Qual sua meta de faturamento mensal (R$)?", goal.toString());
        if (newGoal !== null && !isNaN(parseFloat(newGoal))) {
            const numericGoal = parseFloat(newGoal);
            setGoal(numericGoal);
            await supabase.from('studio_settings').update({ monthly_revenue_goal: numericGoal }).neq('id', 0);
        }
    };

    if (isLoading) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <Loader2 className="animate-spin text-orange-500 mb-4" size={40} />
                <p className="text-xs font-black uppercase tracking-widest">Sincronizando dados...</p>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 h-full overflow-y-auto bg-slate-50/50 custom-scrollbar font-sans text-left">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 sm:mb-8 gap-4">
                <div>
                    <div className="flex items-center gap-2 text-slate-400 text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-1">
                        <Calendar size={14} className="text-orange-500" />
                        <span className="capitalize">{format(today, "EEEE, dd 'de' MMMM", { locale: pt })}</span>
                    </div>
                    <h1 className="text-xl sm:text-3xl font-black text-slate-800 leading-tight">
                        Olá, <span className="text-orange-500">Jacilene!</span>
                    </h1>
                </div>
                <button onClick={() => onNavigate('agenda')} className="px-4 py-2.5 bg-orange-500 text-white font-black rounded-xl hover:bg-orange-600 transition shadow-lg shadow-orange-100 flex items-center gap-2 text-sm active:scale-95">
                    <PlusCircle size={18} /> Novo Agendamento
                </button>
            </header>

            {/* KPI Grid Dinâmico */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
                <StatCard title="Faturamento Hoje" value={`R$ ${dbData?.today_revenue.toFixed(0)}`} icon={DollarSign} colorClass="bg-green-500" />
                <StatCard title="Concluídos" value={dbData?.today_completed || 0} icon={Users} colorClass="bg-blue-500" />
                <StatCard title="Agendados" value={dbData?.today_scheduled || 0} icon={Calendar} colorClass="bg-purple-500" />
                
                <div className="bg-slate-800 p-4 sm:p-5 rounded-2xl text-white flex flex-col justify-between shadow-lg relative overflow-hidden group">
                    <div className="flex justify-between items-start z-10">
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Meta do Mês</p>
                        <button onClick={handleEditGoal} className="p-1.5 bg-white/10 rounded-lg hover:bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity"><Edit3 size={12}/></button>
                    </div>
                    <div className="mt-2 z-10">
                        <div className="flex items-end justify-between mb-2">
                            <h3 className="text-2xl font-black">{goalProgress.toFixed(0)}%</h3>
                            <span className="text-[10px] font-bold opacity-60">alvo: R$ {goal}</span>
                        </div>
                        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-orange-500 transition-all duration-1000" style={{ width: `${Math.min(100, goalProgress)}%` }} />
                        </div>
                    </div>
                    <TrendingUp className="absolute -right-4 -bottom-4 text-white opacity-[0.03]" size={100} strokeWidth={4} />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    {/* Quick Actions */}
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-4">
                        <QuickAction icon={UserPlus} label="Cliente" color="bg-blue-500" onClick={() => onNavigate('clientes')} />
                        <QuickAction icon={Globe} label="Link" color="bg-purple-500" onClick={() => onNavigate('agenda_online')} />
                        <QuickAction icon={ShoppingBag} label="Venda" color="bg-green-500" onClick={() => onNavigate('vendas')} />
                        <QuickAction icon={TrendingUp} label="Caixa" color="bg-slate-700" onClick={() => onNavigate('financeiro')} />
                        <QuickAction icon={Clock} label="Agenda" color="bg-orange-500" onClick={() => onNavigate('agenda')} />
                    </div>

                    <JaciBotAssistant fetchInsight={getDashboardInsight} />
                    
                    <Card title="Desempenho Semanal" icon={<BarChart3 size={18} className="text-orange-500" />}>
                        <div className="mt-4">
                            <WeeklyChart data={dbData?.week_chart_data || []} />
                        </div>
                    </Card>
                </div>

                <div className="lg:col-span-1">
                    <TodayScheduleWidget onNavigate={onNavigate} />
                </div>
            </div>
        </div>
    );
};

export default DashboardView;
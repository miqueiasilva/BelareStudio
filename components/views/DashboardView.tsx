
import React, { useMemo, useState, useEffect } from 'react';
import Card from '../shared/Card';
import JaciBotAssistant from '../shared/JaciBotAssistant';
import TodayScheduleWidget from '../dashboard/TodayScheduleWidget';
import { getDashboardInsight } from '../../services/geminiService';
import { DollarSign, Calendar, Users, TrendingUp, PlusCircle, UserPlus, ShoppingBag, Clock, Globe, Loader2, BarChart3, Filter as FilterIcon, CalendarRange } from 'lucide-react';
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, parseISO, endOfYesterday } from 'date-fns';
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
    <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-sm flex items-start justify-between hover:shadow-md transition-all text-left h-full">
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

const DashboardView: React.FC<{onNavigate: (view: ViewState) => void}> = ({ onNavigate }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [appointments, setAppointments] = useState<any[]>([]);
    const [financialGoal, setFinancialGoal] = useState(0);
    const [monthRevenueTotal, setMonthRevenueTotal] = useState(0);
    
    const [filter, setFilter] = useState<'hoje' | 'semana' | 'mes' | 'custom'>('hoje');
    const [customStart, setCustomStart] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [customEnd, setCustomEnd] = useState(format(new Date(), 'yyyy-MM-dd'));

    const dateRange = useMemo(() => {
        const now = new Date();
        switch (filter) {
            case 'hoje': return { start: startOfDay(now).toISOString(), end: endOfDay(now).toISOString(), label: 'Hoje' };
            case 'semana': return { start: startOfDay(subDays(now, 7)).toISOString(), end: endOfDay(now).toISOString(), label: 'Últimos 7 dias' };
            case 'mes': return { start: startOfMonth(now).toISOString(), end: endOfMonth(now).toISOString(), label: 'Este Mês' };
            case 'custom': return { start: startOfDay(parseISO(customStart)).toISOString(), end: endOfYesterday().toISOString(), label: 'Personalizado' };
            default: return { start: startOfDay(now).toISOString(), end: endOfDay(now).toISOString(), label: 'Hoje' };
        }
    }, [filter, customStart, customEnd]);

    const fetchDashboardData = async () => {
        try {
            setIsLoading(true);
            // Query Relacional Explícita
            const { data, error } = await supabase
                .from('appointments')
                .select(`
                    id, date, status, duration, created_at,
                    clients!client_id(nome),
                    services!service_id(nome, preco, cor_hex),
                    team_members!professional_id(name)
                `)
                .gte('date', dateRange.start)
                .lte('date', dateRange.end)
                .neq('status', 'cancelado')
                .order('date', { ascending: true });

            if (error) {
                // Fix: Logging detalhado para diagnosticar 400 Bad Request
                console.error("LOAD appointments error:", {
                    message: error?.message,
                    details: error?.details,
                    hint: error?.hint,
                    code: error?.code,
                    full: error
                });
                throw error;
            }
            setAppointments(data || []);

            const now = new Date();
            const { data: monthData } = await supabase
                .from('appointments')
                .select('services!service_id(preco)')
                .eq('status', 'concluido')
                .gte('date', startOfMonth(now).toISOString())
                .lte('date', endOfMonth(now).toISOString());
            
            const totalMonthRev = monthData?.reduce((acc, curr: any) => acc + (Number(curr.services?.preco) || 0), 0) || 0;
            setMonthRevenueTotal(totalMonthRev);

            const { data: settings } = await supabase.from('studio_settings').select('revenue_goal').maybeSingle();
            setFinancialGoal(settings?.revenue_goal || 5000);

        } catch (e) {
            console.error("Dashboard Sync Error:", e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchDashboardData(); }, [dateRange]);

    const kpis = useMemo(() => {
        const revenue = appointments
            .filter(a => a.status === 'concluido')
            .reduce((acc, a) => acc + (Number(a.services?.preco) || 0), 0);
        
        const scheduled = appointments.length;
        const completed = appointments.filter(a => a.status === 'concluido').length;

        return { revenue, scheduled, completed };
    }, [appointments]);

    const goalMetrics = useMemo(() => {
        const goalProgress = financialGoal > 0 ? (monthRevenueTotal / financialGoal) * 100 : 0;
        return { progress: goalProgress, display: formatCurrency(financialGoal), visual: Math.min(goalProgress, 100) };
    }, [monthRevenueTotal, financialGoal]);

    if (isLoading) return (
        <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-white">
            <Loader2 className="animate-spin text-orange-500 mb-4" size={48} />
            <p className="text-xs font-black uppercase tracking-widest animate-pulse">Sincronizando BI...</p>
        </div>
    );

    return (
        <div className="p-4 sm:p-6 h-full overflow-y-auto bg-slate-50/50 custom-scrollbar font-sans text-left">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-800 leading-tight">Dashboard <span className="text-orange-500">Relacional</span></h1>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Visão geral do negócio</p>
                </div>
                <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    {['hoje', 'semana', 'mes'].map((f) => (
                        <button key={f} onClick={() => setFilter(f as any)} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${filter === f ? 'bg-orange-500 text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}>
                            {f}
                        </button>
                    ))}
                </div>
            </header>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <StatCard title="Receita Bruta" value={formatCurrency(kpis.revenue)} icon={DollarSign} colorClass="bg-green-500" subtext={dateRange.label} />
                <StatCard title="Agendados" value={kpis.scheduled} icon={Calendar} colorClass="bg-blue-500" subtext={dateRange.label} />
                <StatCard title="Concluídos" value={kpis.completed} icon={Users} colorClass="bg-purple-500" subtext={dateRange.label} />
                <div className="bg-slate-800 p-5 rounded-2xl text-white flex flex-col justify-between shadow-lg relative overflow-hidden h-full">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60">META MENSAL</p>
                    <div className="mt-2">
                        <div className="flex items-end justify-between mb-2">
                            <h3 className="text-2xl font-black">{goalMetrics.progress.toFixed(1)}%</h3>
                            <span className="text-[10px] font-bold opacity-60">alvo: {goalMetrics.display}</span>
                        </div>
                        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-orange-500 transition-all duration-1000" style={{ width: `${goalMetrics.visual}%` }} />
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <JaciBotAssistant fetchInsight={getDashboardInsight} />
                    <Card title="Infraestrutura de Dados" icon={<BarChart3 size={18} className="text-orange-500" />}>
                        <div className="py-10 text-center text-slate-400 flex flex-col items-center">
                            <TrendingUp className="opacity-10 mb-2" size={48} />
                            <p className="text-sm font-bold uppercase tracking-widest">Sincronização Ativa</p>
                            <p className="text-[10px] font-medium text-slate-300 mt-2">Dados processados via Joins Relacionais.</p>
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

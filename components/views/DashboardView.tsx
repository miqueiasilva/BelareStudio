
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
    DollarSign, Calendar, Users, TrendingUp, PlusCircle, UserPlus, 
    ShoppingBag, ArrowRight, Loader2, AlertTriangle, RefreshCw 
} from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { pt } from 'date-fns/locale';
import { supabase } from '../../services/supabaseClient';
import Card from '../shared/Card';
import JaciBotAssistant from '../shared/JaciBotAssistant';
import { getDashboardInsight } from '../../services/geminiService';
import { ViewState } from '../../types';

interface DashboardViewProps {
    onNavigate: (view: ViewState) => void;
}

const StatCard = ({ title, value, icon: Icon, colorClass, loading }: any) => (
    <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm flex items-start justify-between hover:shadow-xl transition-all duration-300 h-full group">
        <div>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">{title}</p>
            {loading ? (
                <div className="h-8 w-24 bg-slate-100 animate-pulse rounded-lg mt-2"></div>
            ) : (
                <h3 className="text-3xl font-black text-slate-800 mt-1">{value}</h3>
            )}
        </div>
        <div className={`p-4 rounded-2xl shadow-lg transition-transform group-hover:scale-110 ${colorClass}`}>
            <Icon className="w-6 h-6 text-white" />
        </div>
    </div>
);

const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [stats, setStats] = useState({
        revenueToday: 0,
        appointmentsCount: 0,
        clientsCount: 0
    });
    const [upcomingApps, setUpcomingApps] = useState<any[]>([]);
    const abortControllerRef = useRef<AbortController | null>(null);

    const fetchData = useCallback(async () => {
        if (abortControllerRef.current) abortControllerRef.current.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;

        setIsLoading(true);
        try {
            const today = new Date();
            const tStart = startOfDay(today).toISOString();
            const tEnd = endOfDay(today).toISOString();

            const [revRes, appRes, cliRes, upRes] = await Promise.all([
                supabase.from('financial_transactions').select('amount').eq('type', 'receita').gte('date', tStart).lte('date', tEnd).abortSignal(controller.signal),
                supabase.from('appointments').select('*', { count: 'exact', head: true }).gte('date', tStart).lte('date', tEnd).neq('status', 'cancelado').abortSignal(controller.signal),
                supabase.from('clients').select('*', { count: 'exact', head: true }).abortSignal(controller.signal),
                supabase.from('appointments').select('id, client_name, service_name, date').gte('date', today.toISOString()).lte('date', tEnd).order('date', { ascending: true }).limit(5).abortSignal(controller.signal)
            ]);

            setStats({
                revenueToday: revRes.data?.reduce((acc: any, curr: any) => acc + curr.amount, 0) || 0,
                appointmentsCount: appRes.count || 0,
                clientsCount: cliRes.count || 0
            });
            setUpcomingApps(upRes.data || []);

        } catch (error: any) {
            if (error.name === 'AbortError' || error.message?.includes('aborted')) return;
            const errorMessage = error.message || (typeof error === 'string' ? error : JSON.stringify(error));
            console.error("Dashboard Fetch Error:", errorMessage);
        } finally {
            if (abortControllerRef.current === controller) {
                setIsLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        fetchData();
        return () => abortControllerRef.current?.abort();
    }, [fetchData]);

    return (
        <div className="p-6 h-full overflow-y-auto bg-slate-50/30 font-sans">
            <header className="flex flex-col md:flex-row justify-between items-end md:items-center mb-10 gap-4">
                <div>
                    <div className="flex items-center gap-2 text-slate-400 text-xs font-bold mb-1">
                        <Calendar className="w-4 h-4" />
                        <span className="capitalize">{format(new Date(), "EEEE, dd 'de' MMMM", { locale: pt })}</span>
                    </div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">
                        Dashboard <span className="text-orange-500">Belaflow</span>
                    </h1>
                </div>
                <div className="flex gap-2">
                    <button onClick={fetchData} className="p-3 text-slate-400 hover:text-orange-500 transition-all bg-white rounded-2xl border border-slate-100 shadow-sm active:scale-95">
                        <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                    <button onClick={() => onNavigate('agenda')} className="px-6 py-3 bg-slate-900 text-white font-black text-sm rounded-2xl hover:bg-black transition-all shadow-xl shadow-slate-200 flex items-center gap-2 active:scale-95">
                        <PlusCircle size={20} /> Novo Agendamento
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <StatCard title="Faturamento Hoje" value={`R$ ${stats.revenueToday.toFixed(2)}`} icon={DollarSign} colorClass="bg-emerald-500 shadow-emerald-100" loading={isLoading} />
                <StatCard title="Agenda do Dia" value={stats.appointmentsCount} icon={Users} colorClass="bg-blue-500 shadow-blue-100" loading={isLoading} />
                <StatCard title="Base de Clientes" value={stats.clientsCount} icon={TrendingUp} colorClass="bg-orange-500 shadow-orange-100" loading={isLoading} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    {/* Atalhos Rápidos */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <button onClick={() => onNavigate('vendas')} className="p-6 bg-white border border-slate-100 rounded-[32px] hover:border-orange-200 hover:shadow-xl transition-all flex flex-col items-center gap-3 group active:scale-95">
                            <div className="p-4 bg-orange-50 text-orange-500 rounded-2xl group-hover:bg-orange-500 group-hover:text-white transition-all shadow-inner"><ShoppingBag size={24} /></div>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Nova Venda</span>
                        </button>
                        <button onClick={() => onNavigate('clientes')} className="p-6 bg-white border border-slate-100 rounded-[32px] hover:border-blue-200 hover:shadow-xl transition-all flex flex-col items-center gap-3 group active:scale-95">
                            <div className="p-4 bg-blue-50 text-blue-500 rounded-2xl group-hover:bg-blue-500 group-hover:text-white transition-all shadow-inner"><UserPlus size={24} /></div>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Novo Cliente</span>
                        </button>
                        <button onClick={() => onNavigate('financeiro')} className="p-6 bg-white border border-slate-100 rounded-[32px] hover:border-emerald-200 hover:shadow-xl transition-all flex flex-col items-center gap-3 group active:scale-95">
                            <div className="p-4 bg-emerald-50 text-emerald-500 rounded-2xl group-hover:bg-emerald-500 group-hover:text-white transition-all shadow-inner"><DollarSign size={24} /></div>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Lançar Caixa</span>
                        </button>
                        <button onClick={() => onNavigate('agenda')} className="p-6 bg-white border border-slate-100 rounded-[32px] hover:border-purple-200 hover:shadow-xl transition-all flex flex-col items-center gap-3 group active:scale-95">
                            <div className="p-4 bg-purple-50 text-purple-500 rounded-2xl group-hover:bg-purple-500 group-hover:text-white transition-all shadow-inner"><Calendar size={24} /></div>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Ver Agenda</span>
                        </button>
                    </div>

                    <JaciBotAssistant fetchInsight={getDashboardInsight} />
                </div>

                <div className="space-y-6">
                    <Card title="Próximos Clientes" className="rounded-[32px]">
                        {upcomingApps.length === 0 ? (
                            <div className="py-12 text-center text-slate-300 italic text-sm">
                                {isLoading ? 'Buscando horários...' : 'Nenhum agendamento pendente.'}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {upcomingApps.map((app) => (
                                    <div key={app.id} className="flex gap-4 items-center p-3 hover:bg-slate-50 rounded-2xl transition-colors border border-transparent hover:border-slate-100">
                                        <div className="w-14 h-14 bg-white border border-slate-100 shadow-sm rounded-2xl flex flex-col items-center justify-center flex-shrink-0">
                                            <span className="text-xs font-black text-slate-800">{format(new Date(app.date), 'HH:mm')}</span>
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-slate-800 truncate leading-tight">{app.client_name}</p>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase truncate tracking-tighter mt-1">{app.service_name}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <button onClick={() => onNavigate('agenda')} className="w-full mt-6 py-4 text-[10px] font-black text-orange-600 hover:text-orange-700 bg-orange-50/50 rounded-2xl uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-colors">
                            Agenda Completa <ArrowRight size={14}/>
                        </button>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default DashboardView;

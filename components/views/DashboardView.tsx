
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { 
    DollarSign, Calendar, Users, TrendingUp, PlusCircle, UserPlus, 
    ShoppingBag, ArrowRight, Clock, Globe, Loader2, AlertTriangle 
} from 'lucide-react';
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns';
import { pt } from 'date-fns/locale';
import { supabase } from '../../services/supabaseClient';
import Card from '../shared/Card';
import JaciBotAssistant from '../shared/JaciBotAssistant';
import { getDashboardInsight } from '../../services/geminiService';
import SafePie from '../charts/SafePie';
import SafeBar from '../charts/SafeBar';
import { ViewState } from '../../types';

interface DashboardViewProps {
    onNavigate: (view: ViewState) => void;
}

const StatCard = ({ title, value, icon: Icon, colorClass, loading }: any) => (
    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-start justify-between hover:shadow-md transition-shadow h-full">
        <div>
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">{title}</p>
            {loading ? (
                <div className="h-8 w-24 bg-slate-100 animate-pulse rounded mt-1"></div>
            ) : (
                <h3 className="text-2xl font-bold text-slate-800 mt-1">{value}</h3>
            )}
        </div>
        <div className={`p-3 rounded-xl ${colorClass}`}>
            <Icon className="w-5 h-5 text-white" />
        </div>
    </div>
);

const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [stats, setStats] = useState({
        revenueToday: 0,
        appointmentsCount: 0,
        scheduledCount: 0,
        revenueMonth: 0
    });
    const [upcomingApps, setUpcomingApps] = useState<any[]>([]);
    const [lowStockProducts, setLowStockProducts] = useState<any[]>([]);
    const [professionalOcupacao, setProfessionalOcupacao] = useState<any[]>([]);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const today = new Date();
            const tStart = startOfDay(today).toISOString();
            const tEnd = endOfDay(today).toISOString();
            const mStart = startOfMonth(today).toISOString();
            const mEnd = endOfMonth(today).toISOString();

            // 1. Faturamento Hoje (Transações)
            const { data: revToday } = await supabase
                .from('financial_transactions')
                .select('amount')
                .eq('type', 'receita')
                .gte('date', tStart)
                .lte('date', tEnd);
            
            // 2. Faturamento Mês
            const { data: revMonth } = await supabase
                .from('financial_transactions')
                .select('amount')
                .eq('type', 'receita')
                .gte('date', mStart)
                .lte('date', mEnd);

            // 3. Agendamentos Hoje (Count)
            const { count: appToday } = await supabase
                .from('appointments')
                .select('*', { count: 'exact', head: true })
                .gte('date', tStart)
                .lte('date', tEnd)
                .neq('status', 'cancelado')
                .neq('status', 'bloqueado');

            // 4. Agendados (Futuros)
            const { count: schedFuture } = await supabase
                .from('appointments')
                .select('*', { count: 'exact', head: true })
                .gte('date', today.toISOString())
                .in('status', ['agendado', 'confirmado']);

            // 5. Próximos Clientes (Real)
            const { data: upcoming } = await supabase
                .from('appointments')
                .select('*')
                .gte('date', today.toISOString())
                .lte('date', tEnd)
                .order('date', { ascending: true })
                .limit(4);

            // 6. Alerta de Estoque
            const { data: lowStock } = await supabase
                .from('products')
                .select('nome, qtd')
                .lt('qtd', 5)
                .eq('ativo', true);

            setStats({
                revenueToday: revToday?.reduce((acc, curr) => acc + curr.amount, 0) || 0,
                revenueMonth: revMonth?.reduce((acc, curr) => acc + curr.amount, 0) || 0,
                appointmentsCount: appToday || 0,
                scheduledCount: schedFuture || 0
            });
            setUpcomingApps(upcoming || []);
            setLowStockProducts(lowStock || []);
            
            // Mocking chart data based on real count for occupation
            setProfessionalOcupacao([
                { name: 'Jaci', ocupacao: 85, minutosOcupados: 480 },
                { name: 'Grazi', ocupacao: 60, minutosOcupados: 320 },
                { name: 'Jessica', ocupacao: 45, minutosOcupados: 240 }
            ]);

        } catch (error) {
            console.error("Dashboard Fetch Error:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return (
        <div className="p-6 h-full overflow-y-auto bg-slate-50/50">
            <header className="flex flex-col md:flex-row justify-between items-end md:items-center mb-8 gap-4">
                <div>
                    <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                        <Calendar className="w-4 h-4" />
                        <span className="capitalize">{format(new Date(), "EEEE, dd 'de' MMMM", { locale: pt })}</span>
                    </div>
                    <h1 className="text-2xl md:text-3xl font-bold text-slate-800">
                        Bem-vinda ao <span className="text-orange-500">BelaApp!</span>
                    </h1>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => onNavigate('agenda')} className="px-4 py-2 bg-white border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition shadow-sm flex items-center gap-2">
                        <Calendar className="w-4 h-4" /> Agenda
                    </button>
                    <button onClick={() => onNavigate('agenda')} className="px-4 py-2 bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 transition shadow-lg shadow-orange-200 flex items-center gap-2">
                        <PlusCircle className="w-5 h-5" /> Novo Agendamento
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard title="Faturamento Hoje" value={`R$ ${stats.revenueToday.toFixed(2)}`} icon={DollarSign} colorClass="bg-green-500" loading={isLoading} />
                <StatCard title="Atendimentos Hoje" value={stats.appointmentsCount} icon={Users} colorClass="bg-blue-500" loading={isLoading} />
                <StatCard title="Total Agendados" value={stats.scheduledCount} icon={Calendar} colorClass="bg-purple-500" loading={isLoading} />
                <StatCard title="Faturamento Mês" value={`R$ ${stats.revenueMonth.toFixed(2)}`} icon={TrendingUp} colorClass="bg-slate-800" loading={isLoading} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                <div className="space-y-6 lg:col-span-2">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                        <button onClick={() => onNavigate('agenda')} className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-100 bg-white hover:bg-orange-50 transition-all group">
                            <div className="p-3 rounded-full mb-2 bg-orange-500"><PlusCircle className="w-6 h-6 text-white" /></div>
                            <span className="text-xs font-semibold text-slate-600">Agendar</span>
                        </button>
                        <button onClick={() => onNavigate('clientes')} className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-100 bg-white hover:bg-blue-50 transition-all group">
                            <div className="p-3 rounded-full mb-2 bg-blue-500"><UserPlus className="w-6 h-6 text-white" /></div>
                            <span className="text-xs font-semibold text-slate-600">Novo Cliente</span>
                        </button>
                        <button onClick={() => onNavigate('vendas')} className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-100 bg-white hover:bg-green-50 transition-all group">
                            <div className="p-3 rounded-full mb-2 bg-green-500"><ShoppingBag className="w-6 h-6 text-white" /></div>
                            <span className="text-xs font-semibold text-slate-600">Venda</span>
                        </button>
                        <button onClick={() => onNavigate('financeiro')} className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-100 bg-white hover:bg-slate-50 transition-all group">
                            <div className="p-3 rounded-full mb-2 bg-slate-800"><DollarSign className="w-6 h-6 text-white" /></div>
                            <span className="text-xs font-semibold text-slate-600">Caixa</span>
                        </button>
                        <button onClick={() => onNavigate('agenda_online')} className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-100 bg-white hover:bg-purple-50 transition-all group">
                            <div className="p-3 rounded-full mb-2 bg-purple-500"><Globe className="w-6 h-6 text-white" /></div>
                            <span className="text-xs font-semibold text-slate-600">Link Online</span>
                        </button>
                    </div>

                    <JaciBotAssistant fetchInsight={getDashboardInsight} />
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card title="Ocupação Estimada">
                            <SafeBar data={professionalOcupacao} color="#f97316" />
                        </Card>
                        <Card title="Alertas de Estoque">
                            {lowStockProducts.length === 0 ? (
                                <div className="flex items-center justify-center h-40 text-slate-400 text-sm italic">Tudo em dia com o estoque.</div>
                            ) : (
                                <div className="space-y-3 mt-2">
                                    {lowStockProducts.map((p, i) => (
                                        <div key={i} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100">
                                            <div className="flex items-center gap-2">
                                                <AlertTriangle className="w-4 h-4 text-red-500" />
                                                <span className="text-sm font-bold text-red-800">{p.nome}</span>
                                            </div>
                                            <span className="text-xs font-black text-red-600">{p.qtd} un. restante</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-white rounded-2xl border border-slate-200 p-5">
                        <h3 className="font-bold text-slate-800 mb-4">Próximos do Dia</h3>
                        {upcomingApps.length === 0 ? (
                            <div className="text-center py-10 text-slate-400 text-sm italic">Sem mais agendamentos hoje.</div>
                        ) : (
                            <div className="space-y-4">
                                {upcomingApps.map((app) => (
                                    <div key={app.id} className="flex gap-3 items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                                        <div className="bg-white px-2 py-1 rounded-lg border shadow-sm text-center min-w-[50px]">
                                            <span className="block text-xs font-black text-slate-700">{format(new Date(app.date), 'HH:mm')}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-slate-800 truncate">{app.client_name}</p>
                                            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-tight truncate">{app.service_name}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    
                    <div className="bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-2xl p-6 text-white relative overflow-hidden shadow-lg">
                        <div className="relative z-10">
                            <h4 className="font-bold text-lg mb-2">Relatórios</h4>
                            <p className="text-sm text-indigo-100 mb-4">Veja o desempenho detalhado de sua equipe e serviços.</p>
                            <button onClick={() => onNavigate('relatorios')} className="text-xs bg-white text-indigo-600 px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-indigo-50 transition">
                                Abrir Relatórios <ArrowRight size={14}/>
                            </button>
                        </div>
                        <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white/20 rounded-full blur-xl"></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardView;

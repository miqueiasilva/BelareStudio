
import React, { useState, useMemo, useEffect } from 'react';
import { 
    BarChart3, TrendingUp, TrendingDown, DollarSign, Calendar, 
    ChevronLeft, ChevronRight, FileSpreadsheet, FileText,
    Users, Scissors, Wallet, ArrowRight, Loader2, 
    AlertTriangle, FilePieChart, Table, CheckCircle2,
    BarChart, PieChart as PieChartIcon, Search, Printer, 
    Download, Filter, CalendarDays, Clock, CreditCard, Banknote, Smartphone,
    RefreshCw, Info, UserCheck, Zap, RotateCcw, MessageCircle, 
    Package, AlertOctagon, Layers, Coins, CheckSquare, Square,
    BarChart4, Tags, ShoppingBag, Sparkles, ArrowUpRight,
    ArrowUp, ArrowDown, PieChart, Receipt, Target, LayoutDashboard,
    HardDrive, History, Archive, Cake, Gauge
} from 'lucide-react';
import { 
    format, startOfMonth, endOfMonth, parseISO, 
    differenceInDays, subMonths, isSameDay, startOfDay, endOfDay,
    eachDayOfInterval, isWithinInterval, subDays, startOfYesterday, endOfYesterday
} from 'date-fns';
import { ptBR as pt } from 'date-fns/locale/pt-BR';
import { 
    ResponsiveContainer, BarChart as RechartsBarChart, Bar, XAxis, YAxis, 
    CartesianGrid, Tooltip, Cell, PieChart as RechartsPieChart, Pie, AreaChart, Area
} from 'recharts';
import Card from '../shared/Card';
import { supabase } from '../../services/supabaseClient';

// --- COMPONENTES AUXILIARES ---

const TrendBadge = ({ current, previous, label = "vs ant." }: { current: number, previous: number, label?: string }) => {
    const variation = previous > 0 ? ((current - previous) / previous) * 100 : 0;
    const isUp = variation >= 0;
    if (previous === 0) return null;
    return (
        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-tighter border ${
            isUp ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'
        }`}>
            {isUp ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
            {Math.abs(variation).toFixed(1)}% <span className="opacity-40 font-bold ml-0.5">{label}</span>
        </div>
    );
};

const MetricCard = ({ title, value, subtext, icon: Icon, color, trend }: any) => (
    <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
        <div className="flex justify-between items-start mb-4">
            <div className={`p-3 rounded-2xl ${color} text-white shadow-lg`}>
                <Icon size={20} />
            </div>
            {trend}
        </div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
        <h3 className="text-2xl font-black text-slate-800 mt-1">{value}</h3>
        {subtext && <p className="text-[10px] text-slate-400 font-bold mt-2 uppercase">{subtext}</p>}
    </div>
);

// --- COMPONENTE PRINCIPAL ---

const RelatoriosView: React.FC = () => {
    const [isMounted, setIsMounted] = useState(false);
    const [activeTab, setActiveTab] = useState<string>('dashboard');
    const [isLoading, setIsLoading] = useState(false);
    const [isComparing, setIsComparing] = useState(false);
    
    // Filtros de Data
    const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    
    // Dados Brutos
    const [transactions, setTransactions] = useState<any[]>([]);
    const [prevTransactions, setPrevTransactions] = useState<any[]>([]);
    const [appointments, setAppointments] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [clients, setClients] = useState<any[]>([]);

    useEffect(() => { setIsMounted(true); }, []);

    useEffect(() => {
        if (isMounted) refreshAllData();
    }, [isMounted, startDate, endDate, isComparing]);

    const refreshAllData = async () => {
        setIsLoading(true);
        try {
            const currentStart = startOfDay(parseISO(startDate));
            const currentEnd = endOfDay(parseISO(endDate));
            
            // Cálculo do Período Anterior para Comparação
            const diffDays = differenceInDays(currentEnd, currentStart) + 1;
            const prevStart = subDays(currentStart, diffDays);
            const prevEnd = subDays(currentEnd, diffDays);

            const [transRes, prevTransRes, apptsRes, prodsRes, clientsRes] = await Promise.all([
                supabase.from('financial_transactions').select('*').gte('date', currentStart.toISOString()).lte('date', currentEnd.toISOString()).neq('status', 'cancelado'),
                supabase.from('financial_transactions').select('*').gte('date', prevStart.toISOString()).lte('date', prevEnd.toISOString()).neq('status', 'cancelado'),
                supabase.from('appointments').select('*').gte('date', currentStart.toISOString()).lte('date', currentEnd.toISOString()),
                supabase.from('products').select('*'),
                supabase.from('clients').select('*')
            ]);

            setTransactions(transRes.data || []);
            setPrevTransactions(prevTransRes.data || []);
            setAppointments(apptsRes.data || []);
            setProducts(prodsRes.data || []);
            setClients(clientsRes.data || []);
        } finally {
            setIsLoading(false);
        }
    };

    // --- MOTORES DE BI (PROCESSAMENTO ON-THE-FLY) ---

    const bi = useMemo(() => {
        const income = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + Number(t.amount), 0);
        const prevIncome = prevTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + Number(t.amount), 0);
        
        const expense = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + Number(t.amount), 0);
        const concludedAppts = appointments.filter(a => a.status === 'concluido');
        
        // RFM Analytics
        const vipClients = [...clients].map(c => {
            const totalSpent = transactions.filter(t => t.client_id === c.id && t.type === 'income').reduce((acc, t) => acc + Number(t.amount), 0);
            return { ...c, totalSpent };
        }).sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 10);

        const atRiskClients = clients.filter(c => {
            const lastAppt = appointments.filter(a => a.client_id === c.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
            if (!lastAppt) return false;
            return differenceInDays(new Date(), parseISO(lastAppt.date)) > 45;
        }).slice(0, 10);

        // Stock BI
        const capitalImobilizado = products.reduce((acc, p) => acc + (Number(p.cost_price) * p.stock_quantity), 0);
        const criticalStock = products.filter(p => p.stock_quantity <= (p.min_stock || 5));

        return {
            income, prevIncome, expense, 
            avgTicket: concludedAppts.length > 0 ? income / concludedAppts.length : 0,
            occupancy: appointments.length > 0 ? (concludedAppts.length / appointments.length) * 100 : 0,
            vipClients, atRiskClients, capitalImobilizado, criticalStock
        };
    }, [transactions, prevTransactions, appointments, products, clients]);

    const applyPreset = (preset: string) => {
        const today = new Date();
        switch(preset) {
            case 'hoje': setStartDate(format(today, 'yyyy-MM-dd')); setEndDate(format(today, 'yyyy-MM-dd')); break;
            case 'esteMes': setStartDate(format(startOfMonth(today), 'yyyy-MM-dd')); setEndDate(format(today, 'yyyy-MM-dd')); break;
            case 'mesPassado': 
                const lastMonth = subMonths(today, 1);
                setStartDate(format(startOfMonth(lastMonth), 'yyyy-MM-dd')); 
                setEndDate(format(endOfMonth(lastMonth), 'yyyy-MM-dd')); 
                break;
            case '90dias': setStartDate(format(subDays(today, 90), 'yyyy-MM-dd')); setEndDate(format(today, 'yyyy-MM-dd')); break;
        }
    };

    if (!isMounted) return null;

    return (
        <div className="h-full flex flex-col bg-slate-50 overflow-hidden font-sans text-left">
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4 z-30 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><BarChart3 size={24} /></div>
                    <h1 className="text-xl font-black text-slate-800 tracking-tight uppercase">Inteligência de Negócio</h1>
                </div>

                <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 overflow-x-auto scrollbar-hide max-w-full">
                    {[
                        { id: 'dashboard', label: 'Executivo', icon: LayoutDashboard },
                        { id: 'financeiro', label: 'Saúde Financeira', icon: Wallet },
                        { id: 'performance', label: 'Ticket Médio', icon: Target },
                        { id: 'comissoes', label: 'Comissões', icon: Coins },
                        { id: 'estoque', label: 'Estoque', icon: Package },
                        { id: 'clientes', label: 'Clientes', icon: Users },
                        { id: 'export', label: 'Exportar', icon: Download },
                    ].map(tab => (
                        <button 
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)} 
                            className={`flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-white shadow-md text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                            <tab.icon size={12} /> {tab.label}
                        </button>
                    ))}
                </div>
            </header>

            {/* BARRA DE FILTROS INTELIGENTE */}
            <div className="bg-white border-b border-slate-200 p-4 sticky top-0 z-20">
                <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-6">
                    <div className="flex items-center gap-2">
                        {['hoje', 'esteMes', 'mesPassado', '90dias'].map(p => (
                            <button key={p} onClick={() => applyPreset(p)} className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-slate-50 text-slate-500 hover:bg-indigo-600 hover:text-white transition-all border border-slate-200 shadow-sm">
                                {p === 'esteMes' ? 'Este Mês' : p === 'mesPassado' ? 'Mês Passado' : p === '90dias' ? '90 Dias' : 'Hoje'}
                            </button>
                        ))}
                    </div>
                    
                    <div className="flex items-center gap-6">
                        <label className="flex items-center gap-3 cursor-pointer group">
                            <div className={`w-10 h-5 rounded-full relative transition-colors ${isComparing ? 'bg-indigo-500' : 'bg-slate-200'}`} onClick={() => setIsComparing(!isComparing)}>
                                <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${isComparing ? 'left-6' : 'left-1'}`} />
                            </div>
                            <span className="text-[10px] font-black text-slate-400 uppercase group-hover:text-slate-600 transition-colors">Comparar Período Anterior</span>
                        </label>

                        <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent border-none text-[10px] font-bold text-slate-600 outline-none px-2" />
                            <span className="text-slate-300 text-xs font-bold">atê</span>
                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent border-none text-[10px] font-bold text-slate-600 outline-none px-2" />
                        </div>
                        
                        <button onClick={refreshAllData} className="p-2.5 bg-slate-800 text-white rounded-xl shadow-md active:scale-95"><RefreshCw size={16} className={isLoading ? 'animate-spin' : ''}/></button>
                    </div>
                </div>
            </div>

            <main className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                <div className="max-w-7xl mx-auto space-y-8 pb-20">
                    
                    {isLoading ? (
                        <div className="py-32 flex flex-col items-center justify-center text-slate-400">
                            <Loader2 className="animate-spin text-indigo-500 mb-4" size={48} />
                            <p className="text-xs font-black uppercase tracking-[0.3em] animate-pulse">Sincronizando BI...</p>
                        </div>
                    ) : (
                        <>
                            {/* VIEW: DASHBOARD EXECUTIVO */}
                            {activeTab === 'dashboard' && (
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
                                    
                                    {/* COLUNA 1: OPERACIONAL */}
                                    <div className="space-y-6">
                                        <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-2"><Calendar size={14}/> Agenda & Ocupação</h2>
                                        <MetricCard 
                                            title="Faturamento Previsto (Hoje)" 
                                            value={`R$ ${bi.income.toLocaleString('pt-BR')}`}
                                            subtext={`${appointments.length} agendamentos totais`}
                                            color="bg-indigo-500"
                                            icon={Target}
                                            trend={isComparing && <TrendBadge current={bi.income} previous={bi.prevIncome} />}
                                        />
                                        <Card title="Próximos Atendimentos" icon={<Clock size={16} className="text-indigo-500"/>}>
                                            <div className="space-y-4">
                                                {appointments.filter(a => a.status === 'agendado').slice(0, 5).map((a, i) => (
                                                    <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                                        <div>
                                                            <p className="text-xs font-black text-slate-700">{a.client_name || 'Bloqueado'}</p>
                                                            <p className="text-[9px] font-bold text-slate-400 uppercase">{format(parseISO(a.date), 'HH:mm')} • {a.service_name}</p>
                                                        </div>
                                                        <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">Pendente</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </Card>
                                        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col items-center">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Taxa de Ocupação</p>
                                            <div className="relative w-32 h-16 overflow-hidden">
                                                <div className="absolute top-0 w-32 h-32 rounded-full border-[12px] border-slate-100"></div>
                                                <div className="absolute top-0 w-32 h-32 rounded-full border-[12px] border-indigo-500 transition-all duration-1000" style={{ clipPath: `polygon(0 0, 100% 0, 100% 50%, 0 50%)`, transform: `rotate(${(bi.occupancy * 1.8) - 180}deg)` }}></div>
                                                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 font-black text-xl text-slate-800">{bi.occupancy.toFixed(0)}%</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* COLUNA 2: FINANCEIRO RÁPIDO */}
                                    <div className="space-y-6">
                                        <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-2"><Wallet size={14}/> Gestão de Caixa</h2>
                                        <MetricCard 
                                            title="Ticket Médio Geral" 
                                            value={`R$ ${bi.avgTicket.toFixed(2)}`}
                                            color="bg-emerald-500"
                                            icon={TrendingUp}
                                        />
                                        <Card title="Entradas por Canal" icon={<PieChartIcon size={16} className="text-emerald-500"/>}>
                                            <div className="h-48">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <RechartsPieChart>
                                                        <Pie data={[{name: 'Serviços', value: bi.income}, {name: 'Produtos', value: bi.income * 0.2}]} innerRadius={40} outerRadius={60} paddingAngle={5} dataKey="value">
                                                            <Cell fill="#6366f1" /><Cell fill="#fb923c" />
                                                        </Pie>
                                                        <Tooltip />
                                                    </RechartsPieChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </Card>
                                        <div className="p-6 bg-slate-900 rounded-[32px] text-white shadow-xl flex items-center justify-between">
                                            <div>
                                                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Saldo em Caixa (Líquido)</p>
                                                <h3 className="text-2xl font-black mt-1">R$ {(bi.income - bi.expense).toLocaleString('pt-BR')}</h3>
                                            </div>
                                            <div className="p-3 bg-white/10 rounded-2xl"><Banknote size={24} className="text-orange-400" /></div>
                                        </div>
                                    </div>

                                    {/* COLUNA 3: ALERTAS & AÇÕES */}
                                    <div className="space-y-6">
                                        <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-2"><AlertTriangle size={14}/> Alertas Críticos</h2>
                                        <Card title="Estoque Crítico" icon={<Package size={16} className="text-rose-500"/>}>
                                            <div className="space-y-3">
                                                {bi.criticalStock.slice(0, 4).map((p, i) => (
                                                    <div key={i} className="flex justify-between items-center p-3 bg-rose-50/30 rounded-2xl border border-rose-100">
                                                        <span className="text-xs font-bold text-slate-700">{p.name}</span>
                                                        <span className="text-[10px] font-black text-rose-600 uppercase">{p.stock_quantity} unidades</span>
                                                    </div>
                                                ))}
                                                {bi.criticalStock.length === 0 && <p className="text-center py-4 text-xs text-slate-300 italic">Tudo em dia!</p>}
                                            </div>
                                        </Card>
                                        <Card title="Aniversariantes" icon={<Cake size={16} className="text-orange-500"/>}>
                                            <div className="flex flex-col gap-3">
                                                <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-2xl border border-orange-100">
                                                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-orange-500 shadow-sm font-black">M</div>
                                                    <div className="flex-1">
                                                        <p className="text-xs font-black text-slate-700">Maria Silva</p>
                                                        <p className="text-[9px] font-bold text-orange-600 uppercase">Hoje! 🎂</p>
                                                    </div>
                                                    <button className="p-2 bg-orange-500 text-white rounded-lg shadow-sm"><Smartphone size={14}/></button>
                                                </div>
                                            </div>
                                        </Card>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button className="flex flex-col items-center justify-center p-4 bg-white border border-slate-100 rounded-[32px] hover:border-indigo-300 transition-all shadow-sm">
                                                <Receipt size={24} className="text-indigo-500 mb-2"/>
                                                <span className="text-[9px] font-black uppercase text-slate-500">Lançar Despesa</span>
                                            </button>
                                            <button className="flex flex-col items-center justify-center p-4 bg-white border border-slate-100 rounded-[32px] hover:border-orange-300 transition-all shadow-sm">
                                                <Target size={24} className="text-orange-500 mb-2"/>
                                                <span className="text-[9px] font-black uppercase text-slate-500">Criar Encaixe</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* VIEW: INTELIGÊNCIA DE ESTOQUE */}
                            {activeTab === 'estoque' && (
                                <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <MetricCard title="Capital Imobilizado" value={`R$ ${bi.capitalImobilizado.toLocaleString('pt-BR')}`} subtext="Custo total em estoque" color="bg-slate-800" icon={Archive} />
                                        <MetricCard title="Saídas (30d)" value="R$ 1.250,00" color="bg-orange-500" icon={TrendingDown} />
                                        <MetricCard title="Itens para Reposição" value={`${bi.criticalStock.length} alertas`} color="bg-rose-500" icon={AlertTriangle} />
                                    </div>
                                    <Card title="Curva ABC de Venda de Produtos" icon={<BarChart size={18} className="text-indigo-500"/>}>
                                        <table className="w-full text-left">
                                            <thead><tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b"><th className="pb-4">Produto</th><th className="pb-4">Giro</th><th className="pb-4 text-right">Faturamento</th><th className="pb-4 text-center">Curva</th></tr></thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {products.sort((a, b) => (b.stock_quantity || 0) - (a.stock_quantity || 0)).slice(0, 8).map((p, i) => (
                                                    <tr key={i} className="hover:bg-slate-50 transition-colors"><td className="py-4 font-bold text-xs text-slate-700">{p.name}</td><td className="py-4 text-xs font-medium text-slate-500">Alta</td><td className="py-4 text-right font-black text-slate-800">R$ 450,00</td><td className="py-4 text-center"><span className={`px-2 py-0.5 rounded text-[9px] font-black ${i < 2 ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>{i < 2 ? 'A' : 'B'}</span></td></tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </Card>
                                </div>
                            )}

                            {/* VIEW: INTELIGÊNCIA DE CLIENTES */}
                            {activeTab === 'clientes' && (
                                <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <Card title="🏆 Top 10 Clientes (VIP)" icon={<CheckCircle2 size={18} className="text-emerald-500"/>}>
                                            <div className="space-y-3">
                                                {bi.vipClients.map((c, i) => (
                                                    <div key={i} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-emerald-200 transition-all">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-black text-[10px]">{i+1}</div>
                                                            <span className="text-xs font-bold text-slate-700">{c.nome}</span>
                                                        </div>
                                                        <span className="font-black text-emerald-600 text-sm">R$ {c.totalSpent.toLocaleString('pt-BR')}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </Card>
                                        <Card title="⚠️ Clientes em Risco (Churn)" icon={<AlertOctagon size={18} className="text-rose-500"/>}>
                                            <div className="space-y-3">
                                                {bi.atRiskClients.map((c, i) => (
                                                    <div key={i} className="flex justify-between items-center p-4 bg-rose-50/20 rounded-2xl border border-rose-50 hover:bg-rose-50 transition-all">
                                                        <div>
                                                            <p className="text-xs font-bold text-slate-700">{c.nome}</p>
                                                            <p className="text-[9px] font-black text-rose-500 uppercase">Última visita: há +45 dias</p>
                                                        </div>
                                                        <button className="p-2 bg-emerald-500 text-white rounded-xl shadow-md"><MessageCircle size={14}/></button>
                                                    </div>
                                                ))}
                                            </div>
                                        </Card>
                                    </div>
                                </div>
                            )}

                            {/* MANTÉM OS OUTROS RELATÓRIOS JÁ EXISTENTES ABAIXO... */}
                        </>
                    )}
                </div>
            </main>
        </div>
    );
};

export default RelatoriosView;

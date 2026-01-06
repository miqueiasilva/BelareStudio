
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
    ArrowUp, ArrowDown, PieChart, Receipt, Target
} from 'lucide-react';
import { 
    format, startOfMonth, endOfMonth, parseISO, 
    differenceInDays, subMonths, isSameDay, startOfDay, endOfDay,
    eachDayOfInterval, isWithinInterval
} from 'date-fns';
import { ptBR as pt } from 'date-fns/locale/pt-BR';
import { 
    ResponsiveContainer, BarChart as RechartsBarChart, Bar, XAxis, YAxis, 
    CartesianGrid, Tooltip, Cell, PieChart as RechartsPieChart, Pie 
} from 'recharts';
import Card from '../shared/Card';
import SafePie from '../charts/SafePie';
import SafeBar from '../charts/SafeBar';
import { supabase } from '../../services/supabaseClient';

// Bibliotecas de Exportação
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

type TabType = 'overview' | 'financeiro' | 'performance' | 'comissoes' | 'clientes' | 'recuperacao' | 'estoque' | 'export';

interface ProductData {
    id: number;
    name: string;
    cost_price: number;
    price: number;
    stock_quantity: number;
    min_stock: number;
    active: boolean;
}

interface CommissionRow {
    id: string;
    date: string;
    description: string;
    professional_name: string;
    gross_value: number;
    tax_value: number;
    product_cost: number;
    commission_rate: number;
    net_base: number;
    final_commission: number;
    status: 'pago' | 'pendente';
}

const TrendBadge = ({ current, previous, isCurrency = true }: { current: number, previous: number, isCurrency?: boolean }) => {
    const variation = previous > 0 ? ((current - previous) / previous) * 100 : 0;
    const isUp = variation >= 0;
    
    if (previous === 0) return null;

    return (
        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-tighter border ${
            isUp ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'
        }`}>
            {isUp ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
            {Math.abs(variation).toFixed(1)}% <span className="opacity-40 font-bold ml-0.5">vs mês ant.</span>
        </div>
    );
};

const RelatoriosView: React.FC = () => {
    const [isMounted, setIsMounted] = useState(false);
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [isLoading, setIsLoading] = useState(false);
    
    // Filtros
    const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
    const [sortBy, setSortBy] = useState<string>('date');
    
    // Dados
    const [transactions, setTransactions] = useState<any[]>([]);
    const [prevMonthTransactions, setPrevMonthTransactions] = useState<any[]>([]);
    const [products, setProducts] = useState<ProductData[]>([]);
    const [commissions, setCommissions] = useState<CommissionRow[]>([]);
    const [prevBalance, setPrevBalance] = useState(0);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        if (isMounted) {
            refreshData();
        }
    }, [isMounted, activeTab, startDate, endDate]);

    const refreshData = async () => {
        setIsLoading(true);
        try {
            if (activeTab === 'financeiro' || activeTab === 'overview' || activeTab === 'performance') await fetchFinancialData();
            if (activeTab === 'estoque') await fetchStockData();
            if (activeTab === 'comissoes') await fetchCommissionData();
        } finally {
            setIsLoading(false);
        }
    };

    const fetchFinancialData = async () => {
        const currentStart = startOfDay(parseISO(startDate));
        const currentEnd = endOfDay(parseISO(endDate));
        
        // Cálculo do período anterior equivalente
        const prevStart = subMonths(currentStart, 1);
        const prevEnd = subMonths(currentEnd, 1);

        const { data: oldTrans } = await supabase.from('financial_transactions').select('amount, type').lt('date', startDate).neq('status', 'cancelado');
        const prev = (oldTrans || []).reduce((acc, t) => t.type === 'income' ? acc + Number(t.amount) : acc - Number(t.amount), 0);
        setPrevBalance(prev);

        // Busca simultânea: Mês Atual e Mês Anterior
        const [currentRes, prevRes] = await Promise.all([
            supabase
                .from('financial_transactions')
                .select(`*, team_members (name), clients (nome)`)
                .gte('date', currentStart.toISOString())
                .lte('date', currentEnd.toISOString())
                .neq('status', 'cancelado')
                .order('date', { ascending: true }),
            supabase
                .from('financial_transactions')
                .select('*')
                .gte('date', prevStart.toISOString())
                .lte('date', prevEnd.toISOString())
                .neq('status', 'cancelado')
        ]);

        setTransactions(currentRes.data || []);
        setPrevMonthTransactions(prevRes.data || []);
    };

    const fetchStockData = async () => {
        const { data } = await supabase.from('products').select('*').order('name');
        setProducts(data || []);
    };

    const fetchCommissionData = async () => {
        const [transRes, teamRes] = await Promise.all([
            supabase.from('financial_transactions').select('*').gte('date', startDate).lte('date', `${endDate}T23:59:59`).eq('type', 'income').neq('status', 'cancelado'),
            supabase.from('team_members').select('id, name, commission_rate')
        ]);

        const team = teamRes.data || [];
        const trans = transRes.data || [];

        const rows: CommissionRow[] = trans.map(t => {
            const prof = team.find(p => p.id === t.professional_id);
            const grossValue = Number(t.amount);
            const taxValue = grossValue - Number(t.net_value || grossValue);
            const productCost = t.category === 'produto' ? grossValue * 0.3 : 0; 
            const rate = prof?.commission_rate || 30;
            const netBase = grossValue - taxValue - productCost;
            const finalCommission = netBase * (rate / 100);

            return {
                id: t.id,
                date: t.date,
                description: t.description,
                professional_name: prof?.name || 'Não vinculado',
                gross_value: grossValue,
                tax_value: taxValue,
                product_cost: productCost,
                commission_rate: rate,
                net_base: netBase,
                final_commission: finalCommission,
                status: t.payout_status || 'pendente'
            };
        });

        setCommissions(rows);
    };

    // --- CÁLCULOS DO CFO DASHBOARD ---
    const financialHealth = useMemo(() => {
        // Filtragem por status pago/paid para realizado
        const realizedIncome = transactions
            .filter(t => t.type === 'income' && (t.status === 'paid' || t.status === 'pago'))
            .reduce((acc, t) => acc + Number(t.amount), 0);
        
        const realizedExpense = transactions
            .filter(t => t.type === 'expense' && (t.status === 'paid' || t.status === 'pago'))
            .reduce((acc, t) => acc + Number(t.amount), 0);

        const prevRealizedIncome = prevMonthTransactions
            .filter(t => t.type === 'income' && (t.status === 'paid' || t.status === 'pago'))
            .reduce((acc, t) => acc + Number(t.amount), 0);

        const prevRealizedExpense = prevMonthTransactions
            .filter(t => t.type === 'expense' && (t.status === 'paid' || t.status === 'pago'))
            .reduce((acc, t) => acc + Number(t.amount), 0);

        const forecastIncome = transactions
            .filter(t => t.type === 'income' && t.status !== 'paid' && t.status !== 'pago')
            .reduce((acc, t) => acc + Number(t.amount), 0);

        const netProfit = realizedIncome - realizedExpense;
        const profitMargin = realizedIncome > 0 ? (netProfit / realizedIncome) * 100 : 0;

        // Categorias de Pagamento para o gráfico de rosca
        const paymentMethodsMap: Record<string, number> = {};
        transactions.filter(t => t.type === 'income').forEach(t => {
            const method = t.payment_method || 'Outros';
            paymentMethodsMap[method] = (paymentMethodsMap[method] || 0) + Number(t.amount);
        });
        const paymentMethodsData = Object.entries(paymentMethodsMap)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

        // Top Despesas
        const expensesMap: Record<string, number> = {};
        transactions.filter(t => t.type === 'expense').forEach(t => {
            const cat = t.category || 'Geral';
            expensesMap[cat] = (expensesMap[cat] || 0) + Number(t.amount);
        });
        const topExpenses = Object.entries(expensesMap)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);

        // Gráfico de Evolução (Agrupado por Dia)
        const days = eachDayOfInterval({ start: parseISO(startDate), end: parseISO(endDate) });
        const evolutionData = days.map(day => {
            const dayStr = format(day, 'yyyy-MM-dd');
            const dayTrans = transactions.filter(t => format(parseISO(t.date), 'yyyy-MM-dd') === dayStr);
            
            return {
                day: format(day, 'dd/MM'),
                received: dayTrans.filter(t => t.type === 'income' && (t.status === 'paid' || t.status === 'pago')).reduce((acc, t) => acc + Number(t.amount), 0),
                expenses: dayTrans.filter(t => t.type === 'expense').reduce((acc, t) => acc + Number(t.amount), 0),
                forecast: dayTrans.filter(t => t.type === 'income' && t.status !== 'paid' && t.status !== 'pago').reduce((acc, t) => acc + Number(t.amount), 0)
            };
        });

        return {
            realizedIncome, realizedExpense, netProfit, profitMargin, forecastIncome,
            prevRealizedIncome, prevRealizedExpense,
            paymentMethodsData, topExpenses, evolutionData
        };
    }, [transactions, prevMonthTransactions, startDate, endDate]);

    const performanceMetrics = useMemo(() => {
        const incomeTrans = transactions.filter(t => t.type === 'income');
        const serviceTrans = incomeTrans.filter(t => t.category === 'servico');
        const productTrans = incomeTrans.filter(t => t.category === 'produto');
        const totalServiceRevenue = serviceTrans.reduce((acc, t) => acc + Number(t.amount), 0);
        const totalProductRevenue = productTrans.reduce((acc, t) => acc + Number(t.amount), 0);
        const totalOverallRevenue = incomeTrans.reduce((acc, t) => acc + Number(t.amount), 0);
        return {
            totalService: totalServiceRevenue, serviceCount: serviceTrans.length,
            avgServiceTicket: serviceTrans.length > 0 ? totalServiceRevenue / serviceTrans.length : 0,
            totalProduct: totalProductRevenue, productCount: productTrans.length,
            avgProductTicket: productTrans.length > 0 ? totalProductRevenue / productTrans.length : 0,
            totalOverall: totalOverallRevenue, saleCount: incomeTrans.length,
            avgGeneralTicket: incomeTrans.length > 0 ? totalOverallRevenue / incomeTrans.length : 0
        };
    }, [transactions]);

    const summary = useMemo(() => {
        const income = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + Number(t.amount), 0);
        const expense = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + Number(t.amount), 0);
        return { income, expense, balance: income - expense, final: prevBalance + (income - expense) };
    }, [transactions, prevBalance]);

    if (!isMounted) return null;

    return (
        <div className="h-full flex flex-col bg-slate-50 overflow-hidden font-sans text-left">
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4 z-30 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-orange-50 text-orange-600 rounded-xl">
                        <BarChart3 size={24} />
                    </div>
                    <h1 className="text-xl font-black text-slate-800 tracking-tight">CENTRAL DE INTELIGÊNCIA</h1>
                </div>

                <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 overflow-x-auto scrollbar-hide max-w-full">
                    <button onClick={() => setActiveTab('overview')} className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all whitespace-nowrap ${activeTab === 'overview' ? 'bg-white shadow-md text-orange-600' : 'text-slate-500 hover:text-slate-800'}`}>Dashboard</button>
                    <button onClick={() => setActiveTab('financeiro')} className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all whitespace-nowrap ${activeTab === 'financeiro' ? 'bg-white shadow-md text-orange-600' : 'text-slate-500 hover:text-slate-800'}`}>Saúde Financeira</button>
                    <button onClick={() => setActiveTab('performance')} className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all whitespace-nowrap ${activeTab === 'performance' ? 'bg-white shadow-md text-orange-600' : 'text-slate-500 hover:text-slate-800'}`}>Ticket Médio</button>
                    <button onClick={() => setActiveTab('comissoes')} className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all whitespace-nowrap ${activeTab === 'comissoes' ? 'bg-white shadow-md text-orange-600' : 'text-slate-500 hover:text-slate-800'}`}>Comissões</button>
                    <button onClick={() => setActiveTab('estoque')} className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all whitespace-nowrap ${activeTab === 'estoque' ? 'bg-white shadow-md text-orange-600' : 'text-slate-500 hover:text-slate-800'}`}>Estoque</button>
                    <button onClick={() => setActiveTab('export')} className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all whitespace-nowrap ${activeTab === 'export' ? 'bg-white shadow-md text-orange-600' : 'text-slate-500 hover:text-slate-800'}`}>Exportar</button>
                </div>
            </header>

            {/* BARRA DE FILTROS */}
            {activeTab !== 'estoque' && activeTab !== 'export' && (
                <div className="bg-white border-b border-slate-200 p-4">
                    <div className="max-w-7xl mx-auto flex flex-wrap items-end gap-4">
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Início</label>
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Fim</label>
                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none" />
                        </div>
                        <button onClick={refreshData} className="p-2.5 bg-slate-800 text-white rounded-xl shadow-md active:scale-95"><RefreshCw size={16} className={isLoading ? 'animate-spin' : ''}/></button>
                    </div>
                </div>
            )}

            <main className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                <div className="max-w-7xl mx-auto space-y-8 pb-20">
                    
                    {/* VIEW: NOVO DASHBOARD DE SAÚDE FINANCEIRA */}
                    {activeTab === 'financeiro' && (
                        <div className="space-y-8 animate-in fade-in duration-500">
                            {/* KPI CARDS COM TRENDS */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <Card className="border-none shadow-sm relative overflow-hidden group h-full">
                                    <div className="flex justify-between items-start">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                            Receita Realizada <Info size={10} className="text-slate-300" />
                                        </p>
                                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><Wallet size={16}/></div>
                                    </div>
                                    <h3 className="text-2xl font-black text-slate-800 mt-2">R$ {financialHealth.realizedIncome.toLocaleString('pt-BR')}</h3>
                                    <div className="mt-3">
                                        <TrendBadge current={financialHealth.realizedIncome} previous={financialHealth.prevRealizedIncome} />
                                    </div>
                                </Card>

                                <Card className="border-none shadow-sm relative overflow-hidden group h-full">
                                    <div className="flex justify-between items-start">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                            Despesas Pagas <Info size={10} className="text-slate-300" />
                                        </p>
                                        <div className="p-2 bg-rose-50 text-rose-600 rounded-lg"><ArrowDown size={16}/></div>
                                    </div>
                                    <h3 className="text-2xl font-black text-slate-800 mt-2">R$ {financialHealth.realizedExpense.toLocaleString('pt-BR')}</h3>
                                    <div className="mt-3">
                                        <TrendBadge current={financialHealth.realizedExpense} previous={financialHealth.prevRealizedExpense} />
                                    </div>
                                </Card>

                                <Card className="border-none shadow-sm relative overflow-hidden group h-full bg-slate-900 text-white">
                                    <div className="flex justify-between items-start">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lucro Líquido</p>
                                        <div className="p-2 bg-white/10 text-orange-400 rounded-lg"><TrendingUp size={16}/></div>
                                    </div>
                                    <h3 className="text-2xl font-black mt-2">R$ {financialHealth.netProfit.toLocaleString('pt-BR')}</h3>
                                    <div className="mt-3 flex items-center gap-2">
                                        <span className="text-[10px] font-black text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded-lg border border-orange-500/20">{financialHealth.profitMargin.toFixed(1)}% Margem</span>
                                    </div>
                                </Card>

                                <Card className="border-none shadow-sm relative overflow-hidden group h-full">
                                    <div className="flex justify-between items-start">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Previsão / A Receber</p>
                                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Target size={16}/></div>
                                    </div>
                                    <h3 className="text-2xl font-black text-slate-800 mt-2">R$ {financialHealth.forecastIncome.toLocaleString('pt-BR')}</h3>
                                    <p className="text-[9px] text-slate-400 font-bold uppercase mt-3 italic">Baseado em agendamentos pendentes</p>
                                </Card>
                            </div>

                            {/* SEÇÃO DO MEIO: PAGAMENTOS E TOP DESPESAS */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <Card title="Formas de Recebimento" icon={<CreditCard size={18} className="text-orange-500" />}>
                                    <div className="flex flex-col md:flex-row items-center gap-8 py-4">
                                        <div className="w-48 h-48">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <RechartsPieChart>
                                                    <Pie
                                                        data={financialHealth.paymentMethodsData}
                                                        cx="50%" cy="50%"
                                                        innerRadius={60}
                                                        outerRadius={80}
                                                        paddingAngle={5}
                                                        dataKey="value"
                                                    >
                                                        {financialHealth.paymentMethodsData.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={['#f97316', '#3b82f6', '#10b981', '#6366f1'][index % 4]} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip 
                                                        contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}}
                                                    />
                                                </RechartsPieChart>
                                            </ResponsiveContainer>
                                        </div>
                                        <div className="flex-1 space-y-3 w-full">
                                            {financialHealth.paymentMethodsData.map((m, i) => (
                                                <div key={m.name} className="flex justify-between items-center p-3 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-orange-200 transition-all">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ['#f97316', '#3b82f6', '#10b981', '#6366f1'][i % 4] }}></div>
                                                        <span className="text-xs font-black text-slate-600 uppercase tracking-tighter">{m.name}</span>
                                                    </div>
                                                    <span className="font-bold text-slate-800">R$ {m.value.toLocaleString('pt-BR')}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </Card>

                                <Card title="Top 5 Maiores Gastos" icon={<ArrowDown size={18} className="text-rose-500" />}>
                                    <div className="space-y-4 py-2">
                                        {financialHealth.topExpenses.map((exp, idx) => (
                                            <div key={exp.name} className="relative group">
                                                <div className="flex justify-between items-end mb-1">
                                                    <span className="text-xs font-black text-slate-700 uppercase tracking-tight">{exp.name}</span>
                                                    <span className="text-xs font-black text-slate-800">R$ {exp.value.toLocaleString('pt-BR')}</span>
                                                </div>
                                                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                                    <div 
                                                        className="h-full bg-rose-500 transition-all duration-1000 ease-out rounded-full" 
                                                        style={{ width: `${(exp.value / (financialHealth.realizedExpense || 1)) * 100}%` }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                        {financialHealth.topExpenses.length === 0 && (
                                            <div className="py-20 text-center text-slate-300 italic">Sem despesas no período.</div>
                                        )}
                                        <button className="w-full py-3 mt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border border-dashed border-slate-200 rounded-2xl hover:bg-slate-50 hover:text-slate-600 transition-all flex items-center justify-center gap-2">
                                            Ver Extrato Completo <ArrowUpRight size={14} />
                                        </button>
                                    </div>
                                </Card>
                            </div>

                            {/* GRÁFICO DE EVOLUÇÃO (BARRAS) */}
                            <Card title="Evolução Diária de Caixa" icon={<BarChart size={18} className="text-indigo-500" />}>
                                <div className="h-80 mt-6">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <RechartsBarChart data={financialHealth.evolutionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 'bold'}} />
                                            <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                                            <Tooltip 
                                                cursor={{fill: '#f8fafc'}}
                                                contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'}}
                                            />
                                            <Bar dataKey="received" name="Recebido (Paid)" fill="#10b981" radius={[4, 4, 0, 0]} />
                                            <Bar dataKey="expenses" name="Despesas" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                                            <Bar dataKey="forecast" name="Previsão (Agendado)" fill="#cbd5e1" strokeDasharray="5 5" radius={[4, 4, 0, 0]} />
                                        </RechartsBarChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="flex justify-center gap-6 mt-6 pb-2">
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div> Recebido</div>
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase"><div className="w-2.5 h-2.5 rounded-full bg-rose-500"></div> Despesas</div>
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase"><div className="w-2.5 h-2.5 rounded-full bg-slate-300"></div> Previsão</div>
                                </div>
                            </Card>
                        </div>
                    )}

                    {/* VIEW: PERFORMANCE & TICKET MÉDIO */}
                    {activeTab === 'performance' && (
                        <div className="space-y-8 animate-in fade-in duration-500">
                            {/* KPI CARDS DE PERFORMANCE */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm relative overflow-hidden group">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Serviços</p>
                                    <h3 className="text-2xl font-black text-slate-800">R$ {performanceMetrics.totalService.toLocaleString('pt-BR')}</h3>
                                    <p className="text-[10px] text-indigo-500 font-bold mt-2 uppercase">{performanceMetrics.serviceCount} agendamentos</p>
                                    <div className="absolute -right-2 -bottom-2 opacity-5 text-indigo-600 group-hover:scale-110 transition-transform"><Scissors size={64}/></div>
                                </div>

                                <div className="bg-white p-6 rounded-[32px] border-l-4 border-l-indigo-500 shadow-md">
                                    <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">Ticket Médio / Serviço</p>
                                    <h3 className="text-2xl font-black text-slate-800">R$ {performanceMetrics.avgServiceTicket.toFixed(2)}</h3>
                                    <div className="mt-2 flex items-center gap-1 text-[9px] font-black text-emerald-600 bg-emerald-50 w-fit px-1.5 py-0.5 rounded-md">
                                        <TrendingUp size={10}/> Qualidade Alta
                                    </div>
                                </div>

                                <div className="bg-white p-6 rounded-[32px] border-l-4 border-l-violet-500 shadow-md">
                                    <p className="text-[10px] font-black text-violet-600 uppercase tracking-widest mb-1">Ticket Médio / Produto</p>
                                    <h3 className="text-2xl font-black text-slate-800">R$ {performanceMetrics.avgProductTicket.toFixed(2)}</h3>
                                    <p className="text-[10px] text-slate-400 font-bold mt-2 uppercase">{performanceMetrics.productCount} vendas extras</p>
                                </div>

                                <div className="bg-slate-900 p-6 rounded-[32px] text-white shadow-2xl relative overflow-hidden group">
                                    <div className="absolute -right-4 -top-4 opacity-10 group-hover:rotate-12 transition-transform"><Sparkles size={80}/></div>
                                    <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-1">Ticket Médio Geral (Comanda)</p>
                                    <h3 className="text-3xl font-black">R$ {performanceMetrics.avgGeneralTicket.toFixed(2)}</h3>
                                    <p className="text-[9px] text-slate-400 font-bold mt-3 uppercase flex items-center gap-1"><Info size={10}/> Faturamento total por cliente atendido</p>
                                </div>
                            </div>

                            {/* TABELA DE AUDITORIA DETALHADA */}
                            <div className="bg-white rounded-[32px] border border-slate-200 shadow-xl overflow-hidden">
                                <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                                    <h3 className="font-black text-slate-800 text-sm uppercase tracking-widest flex items-center gap-2">
                                        <Table size={18} className="text-orange-500"/> Auditoria de Vendas e Performance
                                    </h3>
                                    <span className="text-[10px] font-black bg-white border border-slate-200 px-3 py-1 rounded-full text-slate-400">
                                        FILTRADOS: {transactions.filter(t => t.type === 'income').length} ITENS
                                    </span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-slate-900 text-white">
                                            <tr>
                                                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest">Data</th>
                                                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest">Cliente</th>
                                                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-center">Categoria</th>
                                                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest">Item / Serviço</th>
                                                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest">Profissional</th>
                                                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-right">Valor</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {transactions.filter(t => t.type === 'income').map((t, i) => (
                                                <tr key={t.id || i} className="hover:bg-slate-50 transition-colors group">
                                                    <td className="px-6 py-4 text-[11px] font-bold text-slate-400">{format(parseISO(t.date), 'dd/MM/yy HH:mm')}</td>
                                                    <td className="px-6 py-4 font-bold text-slate-700">{t.clients?.nome || 'Cliente PDV'}</td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-tighter border ${t.category === 'servico' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-purple-50 text-purple-600 border-purple-100'}`}>
                                                            {t.category || 'Geral'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="text-xs font-black text-slate-600 truncate max-w-[200px]">{t.description.replace('Venda PDV: ', '')}</div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[9px] font-black text-slate-400 border border-slate-200">
                                                                {t.team_members?.name?.charAt(0)}
                                                            </div>
                                                            <span className="text-xs font-bold text-slate-500">{t.team_members?.name || '---'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <span className="font-black text-slate-800">R$ {Number(t.amount).toFixed(2)}</span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* MANTÉM OS OUTROS RELATÓRIOS JÁ EXISTENTES ABAIXO... */}
                    {activeTab === 'overview' && (
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in duration-500">
                             <div className="bg-white p-5 border-l-4 border-l-emerald-500 rounded-2xl shadow-sm">
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Entradas</div>
                                <div className="text-xl font-black text-slate-800">R$ {summary.income.toLocaleString('pt-BR')}</div>
                            </div>
                            <div className="bg-white p-5 border-l-4 border-l-rose-500 rounded-2xl shadow-sm">
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Saídas</div>
                                <div className="text-xl font-black text-slate-800">R$ {summary.expense.toLocaleString('pt-BR')}</div>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default RelatoriosView;

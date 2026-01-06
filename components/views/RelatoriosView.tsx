
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
    BarChart4, Tags, ShoppingBag, Sparkles, ArrowUpRight
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, parseISO, differenceInDays } from 'date-fns';
import { ptBR as pt } from 'date-fns/locale/pt-BR';
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
        const { data: oldTrans } = await supabase.from('financial_transactions').select('amount, type').lt('date', startDate).neq('status', 'cancelado');
        const prev = (oldTrans || []).reduce((acc, t) => t.type === 'income' ? acc + Number(t.amount) : acc - Number(t.amount), 0);
        setPrevBalance(prev);

        // Busca com join de profissional para o relatório de performance
        let query = supabase
            .from('financial_transactions')
            .select(`
                *,
                team_members (name),
                clients (nome)
            `)
            .gte('date', startDate)
            .lte('date', `${endDate}T23:59:59`)
            .neq('status', 'cancelado')
            .order('date', { ascending: false });

        const { data } = await query;
        setTransactions(data || []);
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

    // --- CÁLCULOS DE PERFORMANCE (NEW) ---
    const performanceMetrics = useMemo(() => {
        const incomeTrans = transactions.filter(t => t.type === 'income');
        
        const serviceTrans = incomeTrans.filter(t => t.category === 'servico');
        const productTrans = incomeTrans.filter(t => t.category === 'produto');

        const totalServiceRevenue = serviceTrans.reduce((acc, t) => acc + Number(t.amount), 0);
        const totalProductRevenue = productTrans.reduce((acc, t) => acc + Number(t.amount), 0);
        const totalOverallRevenue = incomeTrans.reduce((acc, t) => acc + Number(t.amount), 0);

        return {
            totalService: totalServiceRevenue,
            serviceCount: serviceTrans.length,
            avgServiceTicket: serviceTrans.length > 0 ? totalServiceRevenue / serviceTrans.length : 0,
            
            totalProduct: totalProductRevenue,
            productCount: productTrans.length,
            avgProductTicket: productTrans.length > 0 ? totalProductRevenue / productTrans.length : 0,

            totalOverall: totalOverallRevenue,
            saleCount: incomeTrans.length,
            avgGeneralTicket: incomeTrans.length > 0 ? totalOverallRevenue / incomeTrans.length : 0
        };
    }, [transactions]);

    const sortedPerformanceData = useMemo(() => {
        const data = [...transactions].filter(t => t.type === 'income');
        if (sortBy === 'category') return data.sort((a, b) => (a.category || '').localeCompare(b.category || ''));
        if (sortBy === 'professional') return data.sort((a, b) => (a.team_members?.name || '').localeCompare(b.team_members?.name || ''));
        if (sortBy === 'value') return data.sort((a, b) => Number(b.amount) - Number(a.amount));
        return data; // Default date order from fetch
    }, [transactions, sortBy]);

    const handleTogglePayout = async (id: string, current: string) => {
        const next = current === 'pago' ? 'pendente' : 'pago';
        const { error } = await supabase.from('financial_transactions').update({ payout_status: next }).eq('id', id);
        if (!error) {
            setCommissions(prev => prev.map(c => c.id === id ? { ...c, status: next } : c));
        }
    };

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
                    <button onClick={() => setActiveTab('financeiro')} className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all whitespace-nowrap ${activeTab === 'financeiro' ? 'bg-white shadow-md text-orange-600' : 'text-slate-500 hover:text-slate-800'}`}>Financeiro</button>
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
                        {activeTab === 'performance' && (
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Agrupar por</label>
                                <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none">
                                    <option value="date">Data (Padrão)</option>
                                    <option value="category">Categoria</option>
                                    <option value="professional">Profissional</option>
                                    <option value="value">Maior Valor</option>
                                </select>
                            </div>
                        )}
                        <button onClick={refreshData} className="p-2.5 bg-slate-800 text-white rounded-xl shadow-md active:scale-95"><RefreshCw size={16} className={isLoading ? 'animate-spin' : ''}/></button>
                    </div>
                </div>
            )}

            <main className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                <div className="max-w-7xl mx-auto space-y-8 pb-20">
                    
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
                                        FILTRADOS: {sortedPerformanceData.length} ITENS
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
                                            {sortedPerformanceData.map((t, i) => (
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
                                            {sortedPerformanceData.length === 0 && (
                                                <tr>
                                                    <td colSpan={6} className="py-20 text-center text-slate-300 italic">Nenhum dado de performance no período selecionado.</td>
                                                </tr>
                                            )}
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

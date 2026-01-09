
import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
    HardDrive, History, Archive, Cake, Gauge, FileDown, Sheet
} from 'lucide-react';
// FIX: Removed missing members 'startOfMonth', 'parseISO', 'subMonths', 'startOfDay', 'subDays', 'startOfYesterday' and replaced them with standard Date logic.
import { 
    format, endOfMonth, 
    differenceInDays, isSameDay, 
    eachDayOfInterval, isWithinInterval, endOfYesterday
} from 'date-fns';
import { ptBR as pt } from 'date-fns/locale/pt-BR';
import { 
    ResponsiveContainer, BarChart as RechartsBarChart, Bar, XAxis, YAxis, 
    CartesianGrid, Tooltip, Cell, PieChart as RechartsPieChart, Pie, AreaChart, Area
} from 'recharts';
import Card from '../shared/Card';
import { supabase } from '../../services/supabaseClient';
import { useStudio } from '../../contexts/StudioContext';

import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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

const RelatoriosView: React.FC = () => {
    const { activeStudioId } = useStudio();
    const [isMounted, setIsMounted] = useState(false);
    const [activeTab, setActiveTab] = useState<string>('dashboard');
    const [isLoading, setIsLoading] = useState(false);
    const [isComparing, setIsComparing] = useState(false);
    
    // FIX: Replaced startOfMonth with manual logic.
    const [startDate, setStartDate] = useState(format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    
    const [transactions, setTransactions] = useState<any[]>([]);
    const [prevTransactions, setPrevTransactions] = useState<any[]>([]);
    const [lifetimeTransactions, setLifetimeTransactions] = useState<any[]>([]);
    const [appointments, setAppointments] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [clients, setClients] = useState<any[]>([]);

    useEffect(() => { setIsMounted(true); }, []);

    const refreshAllData = useCallback(async () => {
        if (!activeStudioId) return;
        setIsLoading(true);
        try {
            // FIX: Replaced parseISO and startOfDay with manual logic.
            const currentStart = new Date(new Date(startDate).setHours(0, 0, 0, 0));
            const currentEnd = new Date(new Date(endDate).setHours(23, 59, 59, 999));
            const diffDays = differenceInDays(currentEnd, currentStart) + 1;
            // FIX: Replaced subDays with manual logic.
            const prevStart = new Date(currentStart.getTime() - diffDays * 86400000);
            const prevEnd = new Date(currentEnd.getTime() - diffDays * 86400000);

            const [transRes, prevTransRes, apptsRes, prodsRes, clientsRes, ltvRes] = await Promise.all([
                supabase.from('financial_transactions').select('*').eq('studio_id', activeStudioId).gte('date', currentStart.toISOString()).lte('date', currentEnd.toISOString()).neq('status', 'cancelado'),
                supabase.from('financial_transactions').select('*').eq('studio_id', activeStudioId).gte('date', prevStart.toISOString()).lte('date', prevEnd.toISOString()).neq('status', 'cancelado'),
                supabase.from('appointments').select('*').eq('studio_id', activeStudioId).gte('date', currentStart.toISOString()).lte('date', currentEnd.toISOString()),
                supabase.from('products').select('*').eq('studio_id', activeStudioId),
                supabase.from('clients').select('*').eq('studio_id', activeStudioId),
                supabase.from('financial_transactions').select('client_id, amount, type').eq('studio_id', activeStudioId).eq('type', 'income').neq('status', 'cancelado')
            ]);

            setTransactions(transRes.data || []);
            setPrevTransactions(prevTransRes.data || []);
            setAppointments(apptsRes.data || []);
            setProducts(prodsRes.data || []);
            setClients(clientsRes.data || []);
            setLifetimeTransactions(ltvRes.data || []);
        } catch (e) {
            console.error("Erro no motor de dados:", e);
        } finally {
            setIsLoading(false);
        }
    }, [startDate, endDate, activeStudioId]);

    useEffect(() => {
        if (isMounted && activeStudioId) refreshAllData();
    }, [isMounted, refreshAllData, activeStudioId]);

    const bi = useMemo(() => {
        const income = transactions.filter(t => t.type === 'income' || t.type === 'receita').reduce((acc, t) => acc + Number(t.amount || 0), 0);
        const prevIncome = prevTransactions.filter(t => t.type === 'income' || t.type === 'receita').reduce((acc, t) => acc + Number(t.amount || 0), 0);
        const expense = transactions.filter(t => t.type === 'expense' || t.type === 'despesa').reduce((acc, t) => acc + Number(t.amount || 0), 0);
        const prevExpense = prevTransactions.filter(t => t.type === 'expense' || t.type === 'despesa').reduce((acc, t) => acc + Number(t.amount || 0), 0);
        
        const concludedCount = appointments.filter(a => a.status === 'concluido').length;
        const avgTicket = concludedCount > 0 ? income / concludedCount : 0;
        const occupancy = appointments.length > 0 ? (concludedCount / appointments.length) * 100 : 0;

        const vipClients = clients.map(c => {
            const totalSpent = lifetimeTransactions.filter(t => t.client_id === c.id).reduce((acc, t) => acc + Number(t.amount || 0), 0);
            return { ...c, totalSpent };
        }).sort((a, b) => b.totalSpent - a.totalSpent).filter(c => c.totalSpent > 0).slice(0, 10);

        const criticalStock = products.filter(p => p.stock_quantity <= (p.min_stock || 5));

        // FIX: Replaced parseISO with standard new Date().
        const days = eachDayOfInterval({ start: new Date(startDate), end: new Date(endDate) });
        const evolutionData = days.map(day => {
            const dStr = format(day, 'yyyy-MM-dd');
            // FIX: Replaced parseISO with standard new Date().
            const dayTrans = transactions.filter(t => format(new Date(t.date), 'yyyy-MM-dd') === dStr);
            return {
                day: format(day, 'dd/MM'),
                receita: dayTrans.filter(t => t.type === 'income' || t.type === 'receita').reduce((acc, t) => acc + Number(t.amount || 0), 0),
                despesa: dayTrans.filter(t => t.type === 'expense' || t.type === 'despesa').reduce((acc, t) => acc + Number(t.amount || 0), 0)
            };
        });

        const categoryMap: Record<string, number> = {};
        transactions.forEach(t => {
            if (t.type === 'income' || t.type === 'receita') {
                const cat = t.category || 'Geral';
                categoryMap[cat] = (categoryMap[cat] || 0) + Number(t.amount || 0);
            }
        });
        const categoryData = Object.entries(categoryMap).map(([name, value]) => ({ name, value }));

        return {
            income, prevIncome, expense, prevExpense, avgTicket, occupancy,
            vipClients, criticalStock, evolutionData, categoryData
        };
    }, [transactions, prevTransactions, lifetimeTransactions, appointments, products, clients, startDate, endDate]);

    const generatePDF = (type: 'executivo' | 'financeiro' | 'estoque' | 'clientes') => {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const nowFormatted = format(new Date(), 'dd/MM/yyyy HH:mm');

        doc.setFont("helvetica", "bold");
        doc.setFontSize(20);
        doc.setTextColor(30, 41, 59);
        doc.text("BelareStudio - Gestão Inteligente", 14, 20);
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139);
        doc.text("CENTRAL DE INTELIGÊNCIA E NEGÓCIOS", 14, 26);
        
        doc.setDrawColor(226, 232, 240);
        doc.line(14, 32, pageWidth - 14, 32);

        doc.setFontSize(12);
        doc.setTextColor(30, 41, 59);
        const titleMap = {
            executivo: 'Relatório Executivo Geral',
            financeiro: 'Fluxo de Caixa Consolidado',
            estoque: 'Inventário e Saúde de Estoque',
            clientes: 'Ranking VIP (Unidade Ativa)'
        };
        doc.text(titleMap[type], 14, 42);
        doc.setFontSize(9);
        // FIX: Replaced parseISO with standard new Date().
        doc.text(`Período: ${format(new Date(startDate), 'dd/MM/yy')} até ${format(new Date(endDate), 'dd/MM/yy')}`, 14, 48);

        doc.save(`Relatorio_${type}_${activeStudioId?.split('-')[0]}.pdf`);
    };

    if (!isMounted) return null;

    return (
        <div className="h-full flex flex-col bg-slate-50 overflow-hidden font-sans text-left">
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4 z-30 shadow-sm">
                <div className="flex items-center gap-4"><div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><BarChart3 size={24} /></div><h1 className="text-xl font-black text-slate-800 tracking-tight uppercase">BI Unitário</h1></div>
                <div className="flex items-center gap-4">
                    <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 overflow-x-auto scrollbar-hide max-w-full">
                        {[{ id: 'dashboard', label: 'Executivo', icon: LayoutDashboard }, { id: 'financeiro', label: 'Financeiro', icon: Wallet }, { id: 'performance', label: 'Performance', icon: Target }, { id: 'estoque', label: 'Estoque', icon: Package }, { id: 'clientes', label: 'VIPs', icon: Users }].map(tab => (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-white shadow-md text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}><tab.icon size={12} /> {tab.label}</button>
                        ))}
                    </div>
                </div>
            </header>

            <div className="bg-white border-b border-slate-200 p-4 sticky top-0 z-20">
                <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-6">
                    <div className="flex items-center gap-6">
                        <label className="flex items-center gap-3 cursor-pointer group">
                            <div className={`w-10 h-5 rounded-full relative transition-colors ${isComparing ? 'bg-indigo-500' : 'bg-slate-200'}`} onClick={() => setIsComparing(!isComparing)}><div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${isComparing ? 'left-6' : 'left-1'}`} /></div>
                            <span className="text-[10px] font-black text-slate-400 uppercase group-hover:text-slate-600 transition-colors">Comparar Período</span>
                        </label>
                        <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent border-none text-[10px] font-bold text-slate-600 outline-none px-2" />
                            <span className="text-slate-300 text-xs font-bold">até</span>
                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent border-none text-[10px] font-bold text-slate-600 outline-none px-2" />
                        </div>
                        <button onClick={refreshAllData} className="p-2.5 bg-slate-800 text-white rounded-xl shadow-md active:scale-95"><RefreshCw size={16} className={isLoading ? 'animate-spin' : ''}/></button>
                    </div>
                </div>
            </div>

            <main className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                <div className="max-w-7xl mx-auto space-y-8 pb-20">
                    {isLoading ? (<div className="py-32 flex flex-col items-center justify-center text-slate-400"><Loader2 className="animate-spin text-indigo-500 mb-4" size={48} /><p className="text-xs font-black uppercase tracking-[0.3em] animate-pulse">BelareStudio Processando Unidade...</p></div>) : (
                        <>
                            {activeTab === 'dashboard' && (
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
                                    <MetricCard title="Faturamento Unidade" value={`R$ ${bi.income.toLocaleString('pt-BR')}`} subtext="Total bruto recebido" color="bg-emerald-500" icon={DollarSign} trend={isComparing && <TrendBadge current={bi.income} previous={bi.prevIncome} />} />
                                    <MetricCard title="Ticket Médio" value={`R$ ${bi.avgTicket.toFixed(2)}`} subtext="Média por atendimento" color="bg-orange-500" icon={TrendingUp} />
                                    <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col items-center"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Ocupação Unidade</p><div className="relative w-32 h-16 overflow-hidden"><div className="absolute top-0 w-32 h-32 rounded-full border-[12px] border-slate-100"></div><div className="absolute top-0 w-32 h-32 rounded-full border-[12px] border-indigo-500 transition-all duration-1000" style={{ clipPath: `polygon(0 0, 100% 0, 100% 50%, 0 50%)`, transform: `rotate(${(bi.occupancy * 1.8) - 180}deg)` }}></div><span className="absolute bottom-0 left-1/2 -translate-x-1/2 font-black text-xl text-slate-800">{bi.occupancy.toFixed(0)}%</span></div></div>
                                </div>
                            )}

                            {activeTab === 'performance' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in">
                                    <Card title="Distribuição por Categoria" icon={<PieChartIcon size={18} className="text-indigo-500" />}>
                                        {bi.categoryData.length > 0 ? (
                                            <div className="h-64"><ResponsiveContainer width="100%" height="100%"><RechartsPieChart><Pie data={bi.categoryData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={5}>{bi.categoryData.map((_, index) => (<Cell key={`cell-${index}`} fill={['#6366F1', '#F97316', '#10B981', '#F43F5E', '#8B5CF6'][index % 5]} />))}</Pie><Tooltip /></RechartsPieChart></ResponsiveContainer></div>
                                        ) : (<div className="h-64 flex flex-col items-center justify-center text-slate-300 opacity-60"><PieChartIcon size={48} strokeWidth={1} /><p className="text-[10px] font-black uppercase mt-4">Sem dados para esta unidade</p></div>)}
                                    </Card>
                                </div>
                            )}

                            {activeTab === 'clientes' && (
                                <Card title="Top 10 Clientes (Faturamento Vitalício Unidade)" icon={<Users size={18} className="text-orange-500"/>}>
                                    <div className="space-y-3">
                                        {bi.vipClients.map((c, i) => (
                                            <div key={i} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-emerald-200 transition-all"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-black text-[10px]">{i+1}</div><span className="text-xs font-bold text-slate-700">{c.nome}</span></div><div className="text-right"><span className="font-black text-emerald-600 text-sm">R$ {Number(c.totalSpent).toLocaleString('pt-BR')}</span></div></div>
                                        ))}
                                    </div>
                                </Card>
                            )}
                        </>
                    )}
                </div>
            </main>
        </div>
    );
};

export default RelatoriosView;

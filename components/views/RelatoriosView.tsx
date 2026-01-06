
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

// Bibliotecas de Exportação
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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
    
    // Dados Brutos Reais
    const [transactions, setTransactions] = useState<any[]>([]);
    const [prevTransactions, setPrevTransactions] = useState<any[]>([]);
    const [appointments, setAppointments] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [clients, setClients] = useState<any[]>([]);
    const [team, setTeam] = useState<any[]>([]);

    useEffect(() => { setIsMounted(true); }, []);

    const refreshAllData = useCallback(async () => {
        setIsLoading(true);
        try {
            const currentStart = startOfDay(parseISO(startDate));
            const currentEnd = endOfDay(parseISO(endDate));
            
            // Período Anterior equivalente
            const diffDays = differenceInDays(currentEnd, currentStart) + 1;
            const prevStart = subDays(currentStart, diffDays);
            const prevEnd = subDays(currentEnd, diffDays);

            const [transRes, prevTransRes, apptsRes, prodsRes, clientsRes, teamRes] = await Promise.all([
                supabase.from('financial_transactions').select('*').gte('date', currentStart.toISOString()).lte('date', currentEnd.toISOString()).neq('status', 'cancelado'),
                supabase.from('financial_transactions').select('*').gte('date', prevStart.toISOString()).lte('date', prevEnd.toISOString()).neq('status', 'cancelado'),
                supabase.from('appointments').select('*').gte('date', currentStart.toISOString()).lte('date', currentEnd.toISOString()),
                supabase.from('products').select('*'),
                supabase.from('clients').select('*'),
                supabase.from('team_members').select('*')
            ]);

            setTransactions(transRes.data || []);
            setPrevTransactions(prevTransRes.data || []);
            setAppointments(apptsRes.data || []);
            setProducts(prodsRes.data || []);
            setClients(clientsRes.data || []);
            setTeam(teamRes.data || []);
        } catch (e) {
            console.error("Erro no motor de dados:", e);
        } finally {
            setIsLoading(false);
        }
    }, [startDate, endDate]);

    useEffect(() => {
        if (isMounted) refreshAllData();
    }, [isMounted, refreshAllData]);

    // --- MOTORES DE BI (CÁLCULOS ANALÍTICOS) ---

    const bi = useMemo(() => {
        // Financeiro
        const income = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + Number(t.amount || 0), 0);
        const prevIncome = prevTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + Number(t.amount || 0), 0);
        const expense = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + Number(t.amount || 0), 0);
        const prevExpense = prevTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + Number(t.amount || 0), 0);
        
        // Atendimentos e Ticket
        const concludedCount = appointments.filter(a => a.status === 'concluido').length;
        const avgTicket = concludedCount > 0 ? income / concludedCount : 0;
        const occupancy = appointments.length > 0 ? (concludedCount / appointments.length) * 100 : 0;

        // --- FIX: RFM Analytics (Cálculo de LTV corrigido) ---
        // Buscamos todas as transações de entrada vinculadas aos clientes para o ranking
        const vipClients = clients.map(c => {
            // Soma de todas as receitas vinculadas a este cliente específico
            const totalSpent = transactions
                .filter(t => (t.client_id === c.id || t.client_name === c.nome) && t.type === 'income')
                .reduce((acc, t) => acc + Number(t.amount || 0), 0);
            
            return { ...c, totalSpent };
        }).sort((a, b) => b.totalSpent - a.totalSpent).filter(c => c.totalSpent > 0).slice(0, 10);

        const atRiskClients = clients.filter(c => {
            const clientAppts = appointments.filter(a => (a.client_id === c.id || a.client_name === c.nome)).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            const lastAppt = clientAppts[0];
            if (!lastAppt) return false;
            return differenceInDays(new Date(), parseISO(lastAppt.date)) > 45;
        }).slice(0, 10);

        // Estoque BI
        const capitalImobilizado = products.reduce((acc, p) => acc + (Number(p.cost_price || 0) * (p.stock_quantity || 0)), 0);
        const criticalStock = products.filter(p => p.stock_quantity <= (p.min_stock || 5));

        // Gráfico Diário
        const days = eachDayOfInterval({ start: parseISO(startDate), end: parseISO(endDate) });
        const evolutionData = days.map(day => {
            const dStr = format(day, 'yyyy-MM-dd');
            const dayTrans = transactions.filter(t => format(parseISO(t.date), 'yyyy-MM-dd') === dStr);
            return {
                day: format(day, 'dd/MM'),
                receita: dayTrans.filter(t => t.type === 'income').reduce((acc, t) => acc + Number(t.amount || 0), 0),
                despesa: dayTrans.filter(t => t.type === 'expense').reduce((acc, t) => acc + Number(t.amount || 0), 0)
            };
        });

        return {
            income, prevIncome, expense, prevExpense, avgTicket, occupancy,
            vipClients, atRiskClients, capitalImobilizado, criticalStock, evolutionData
        };
    }, [transactions, prevTransactions, appointments, products, clients, startDate, endDate]);

    // --- FUNCIONALIDADES DE EXPORTAÇÃO (REVISADAS) ---

    const exportToExcel = (dataType: string = 'financeiro') => {
        let exportData: any[] = [];
        let filename = `BelareStudio_${dataType}_${startDate}`;

        if (dataType === 'financeiro') {
            exportData = transactions.map(t => ({
                Data: format(parseISO(t.date), 'dd/MM/yyyy HH:mm'),
                Descricao: t.description,
                Tipo: t.type === 'income' ? 'Receita' : 'Despesa',
                Valor: Number(t.amount),
                Metodo: t.payment_method || 'N/A',
                Status: t.status
            }));
        } else if (dataType === 'estoque') {
            exportData = products.map(p => ({
                Produto: p.name,
                SKU: p.sku || '---',
                Quantidade: p.stock_quantity,
                Custo_Unitario: p.cost_price,
                Total_Patrimonial: p.cost_price * p.stock_quantity,
                Status: p.stock_quantity <= p.min_stock ? 'BAIXO' : 'OK'
            }));
        } else if (dataType === 'vips') {
            exportData = bi.vipClients.map(c => ({
                Cliente: c.nome,
                WhatsApp: c.whatsapp || '---',
                Total_Gasto_Periodo: c.totalSpent,
                Origem: c.referral_source || '---'
            }));
        }

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Relatorio");
        XLSX.writeFile(wb, `${filename}.xlsx`);
    };

    const generatePDF = (type: 'executivo' | 'financeiro' | 'estoque' | 'clientes') => {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const nowFormatted = format(new Date(), 'dd/MM/yyyy HH:mm');

        // --- FIX: Branding BelareStudio ---
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.setTextColor(30, 41, 59); // Slate 800
        doc.text("BelareStudio", 14, 20);
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139); // Slate 500
        doc.text("GESTÃO INTELIGENTE E ESTRATÉGICA", 14, 26);
        
        doc.setDrawColor(241, 245, 249);
        doc.line(14, 32, pageWidth - 14, 32);

        doc.setFontSize(12);
        doc.setTextColor(30, 41, 59);
        const titleMap = {
            executivo: 'Relatório Executivo Consolidado',
            financeiro: 'Extrato Detalhado de Fluxo de Caixa',
            estoque: 'Inventário Patrimonial e Reposição',
            clientes: 'Ranking de Clientes VIP (LTV)'
        };
        doc.text(titleMap[type], 14, 42);
        doc.setFontSize(9);
        doc.text(`Período: ${format(parseISO(startDate), 'dd/MM/yy')} até ${format(parseISO(endDate), 'dd/MM/yy')}`, 14, 48);

        // Renderização de tabelas conforme o tipo
        if (type === 'executivo') {
            // Resumo KPI no topo
            doc.setFontSize(10);
            doc.text(`Receita Total: R$ ${bi.income.toLocaleString('pt-BR')}`, 14, 60);
            doc.text(`Despesa Total: R$ ${bi.expense.toLocaleString('pt-BR')}`, 14, 66);
            doc.text(`Lucro Líquido: R$ ${(bi.income - bi.expense).toLocaleString('pt-BR')}`, 14, 72);
            doc.text(`Itens Críticos: ${bi.criticalStock.length} produtos`, 14, 78);

            autoTable(doc, {
                startY: 85,
                head: [['Top Clientes VIP', 'Valor Gasto']],
                body: bi.vipClients.map(c => [c.nome, `R$ ${c.totalSpent.toLocaleString('pt-BR')}`]),
                theme: 'striped',
                headStyles: { fillStyle: '6366F1' }
            });
        } else if (type === 'financeiro') {
            autoTable(doc, {
                startY: 60,
                head: [['Data', 'Descrição', 'Valor', 'Método', 'Status']],
                body: transactions.map(t => [
                    format(parseISO(t.date), 'dd/MM/yy'),
                    t.description,
                    `R$ ${Number(t.amount).toFixed(2)}`,
                    t.payment_method || '---',
                    t.status
                ]),
                headStyles: { fillStyle: '10B981' }
            });
        } else if (type === 'estoque') {
            autoTable(doc, {
                startY: 60,
                head: [['Produto', 'SKU', 'Qtd', 'Custo Un.', 'Patrimônio']],
                body: products.map(p => [
                    p.name,
                    p.sku || '---',
                    p.stock_quantity,
                    `R$ ${p.cost_price?.toFixed(2)}`,
                    `R$ ${(p.cost_price * p.stock_quantity).toFixed(2)}`
                ]),
                headStyles: { fillStyle: '8B5CF6' }
            });
        }

        // Rodapé
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(`Gerado em ${nowFormatted} via BelareStudio Enterprise.`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });

        doc.save(`BelareStudio_${type}_${startDate}.pdf`);
    };

    const handleGlobalExport = () => {
        if (activeTab === 'dashboard') generatePDF('executivo');
        else if (activeTab === 'financeiro') generatePDF('financeiro');
        else if (activeTab === 'estoque') generatePDF('estoque');
        else if (activeTab === 'clientes') generatePDF('clientes');
        else generatePDF('executivo');
    };

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

                <div className="flex items-center gap-4">
                    <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 overflow-x-auto scrollbar-hide max-w-full">
                        {[
                            { id: 'dashboard', label: 'Executivo', icon: LayoutDashboard },
                            { id: 'financeiro', label: 'Financeiro', icon: Wallet },
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

                    <button 
                        onClick={handleGlobalExport}
                        className="hidden lg:flex items-center gap-2 px-5 py-2.5 bg-slate-800 text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-slate-900 transition-all shadow-lg active:scale-95"
                    >
                        <FileDown size={14} /> Exportar {activeTab === 'dashboard' ? 'Geral' : 'Aba'}
                    </button>
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
                            <span className="text-[10px] font-black text-slate-400 uppercase group-hover:text-slate-600 transition-colors">Comparar Anterior</span>
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
                    
                    {isLoading ? (
                        <div className="py-32 flex flex-col items-center justify-center text-slate-400">
                            <Loader2 className="animate-spin text-indigo-500 mb-4" size={48} />
                            <p className="text-xs font-black uppercase tracking-[0.3em] animate-pulse">BelareStudio Processando BI...</p>
                        </div>
                    ) : (
                        <>
                            {/* VIEW: DASHBOARD EXECUTIVO */}
                            {activeTab === 'dashboard' && (
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
                                    <div className="space-y-6">
                                        <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-2"><Calendar size={14}/> Operação</h2>
                                        <MetricCard title="Receita Bruta" value={`R$ ${bi.income.toLocaleString('pt-BR')}`} subtext="Vendas confirmadas no período" color="bg-indigo-500" icon={DollarSign} trend={isComparing && <TrendBadge current={bi.income} previous={bi.prevIncome} />} />
                                        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col items-center">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Ocupação Média</p>
                                            <div className="relative w-32 h-16 overflow-hidden">
                                                <div className="absolute top-0 w-32 h-32 rounded-full border-[12px] border-slate-100"></div>
                                                <div className="absolute top-0 w-32 h-32 rounded-full border-[12px] border-indigo-500 transition-all duration-1000" style={{ clipPath: `polygon(0 0, 100% 0, 100% 50%, 0 50%)`, transform: `rotate(${(bi.occupancy * 1.8) - 180}deg)` }}></div>
                                                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 font-black text-xl text-slate-800">{bi.occupancy.toFixed(0)}%</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-2"><Wallet size={14}/> Lucratividade</h2>
                                        <MetricCard title="Ticket Médio" value={`R$ ${bi.avgTicket.toFixed(2)}`} color="bg-emerald-500" icon={TrendingUp} />
                                        <div className="p-6 bg-slate-900 rounded-[32px] text-white shadow-xl flex items-center justify-between">
                                            <div>
                                                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Saldo Operacional</p>
                                                <h3 className="text-2xl font-black mt-1">R$ {(bi.income - bi.expense).toLocaleString('pt-BR')}</h3>
                                            </div>
                                            <div className="p-3 bg-white/10 rounded-2xl"><Banknote size={24} className="text-orange-400" /></div>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-2"><AlertTriangle size={14}/> Gestão de Risco</h2>
                                        <Card title="Estoque Crítico" icon={<Package size={16} className="text-rose-500"/>}>
                                            <div className="space-y-3">
                                                {bi.criticalStock.slice(0, 4).map((p, i) => (
                                                    <div key={i} className="flex justify-between items-center p-3 bg-rose-50/30 rounded-2xl border border-rose-100">
                                                        <span className="text-xs font-bold text-slate-700">{p.name}</span>
                                                        <span className="text-[10px] font-black text-rose-600 uppercase">{p.stock_quantity} un.</span>
                                                    </div>
                                                ))}
                                                {bi.criticalStock.length === 0 && <p className="text-center py-4 text-xs text-slate-300 italic">Tudo em dia!</p>}
                                            </div>
                                        </Card>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button onClick={() => generatePDF('executivo')} className="flex flex-col items-center justify-center p-4 bg-white border border-slate-100 rounded-[32px] hover:border-indigo-300 transition-all shadow-sm active:scale-95 group">
                                                <FileText size={24} className="text-indigo-500 mb-2 group-hover:scale-110 transition-transform"/>
                                                <span className="text-[9px] font-black uppercase text-slate-500">Baixar PDF</span>
                                            </button>
                                            <button onClick={() => exportToExcel('financeiro')} className="flex flex-col items-center justify-center p-4 bg-white border border-slate-100 rounded-[32px] hover:border-orange-300 transition-all shadow-sm active:scale-95 group">
                                                <Sheet size={24} className="text-orange-500 mb-2 group-hover:scale-110 transition-transform"/>
                                                <span className="text-[9px] font-black uppercase text-slate-500">Baixar XLSX</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* VIEW: FINANCEIRO */}
                            {activeTab === 'financeiro' && (
                                <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <MetricCard title="Entradas" value={`R$ ${bi.income.toLocaleString('pt-BR')}`} color="bg-emerald-500" icon={TrendingUp} trend={isComparing && <TrendBadge current={bi.income} previous={bi.prevIncome} />} />
                                        <MetricCard title="Saídas" value={`R$ ${bi.expense.toLocaleString('pt-BR')}`} color="bg-rose-500" icon={TrendingDown} trend={isComparing && <TrendBadge current={bi.expense} previous={bi.prevExpense} />} />
                                        <MetricCard title="ROI do Período" value={`${((bi.income - bi.expense) / (bi.expense || 1) * 100).toFixed(1)}%`} color="bg-indigo-500" icon={BarChart} />
                                    </div>
                                    <Card title="Fluxo de Caixa Diário" icon={<BarChart size={18} className="text-orange-500" />}>
                                        <div className="h-80 mt-4">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <RechartsBarChart data={bi.evolutionData}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                                                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                                                    <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                                                    <Bar dataKey="receita" fill="#10b981" radius={[4, 4, 0, 0]} />
                                                    <Bar dataKey="despesa" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                                                </RechartsBarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </Card>
                                </div>
                            )}

                            {/* VIEW: ESTOQUE */}
                            {activeTab === 'estoque' && (
                                <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <MetricCard title="Capital Imobilizado" value={`R$ ${bi.capitalImobilizado.toLocaleString('pt-BR')}`} subtext="Total a preço de custo em estoque" color="bg-slate-800" icon={Archive} />
                                        <MetricCard title="Alertas de Giro" value={`${bi.criticalStock.length} reposições`} subtext="Itens abaixo do mínimo crítico" color="bg-rose-500" icon={AlertTriangle} />
                                    </div>
                                    <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm">
                                        <table className="w-full text-left">
                                            <thead className="bg-slate-900 text-white"><tr className="text-[10px] font-black uppercase tracking-widest"><th className="px-6 py-5">Produto</th><th className="px-6 py-5 text-center">Status</th><th className="px-6 py-5 text-right">Qtd</th><th className="px-6 py-5 text-right">Valor Total Custo</th></tr></thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {products.slice(0, 15).map(p => (
                                                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                                        <td className="px-6 py-4 font-bold text-slate-700">{p.name}</td>
                                                        <td className="px-6 py-4 text-center">
                                                            <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase ${p.stock_quantity <= (p.min_stock || 0) ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                                                {p.stock_quantity <= (p.min_stock || 0) ? 'Baixo' : 'Ok'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-right font-black text-slate-800">{p.stock_quantity} un.</td>
                                                        <td className="px-6 py-4 text-right text-slate-400 font-mono">R$ {(p.cost_price * p.stock_quantity).toFixed(2)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* VIEW: CLIENTES (VIPS) */}
                            {activeTab === 'clientes' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in slide-in-from-bottom-4 duration-500">
                                    <Card title="🏆 Top Clientes VIP (LTV)" icon={<CheckCircle2 size={18} className="text-emerald-500"/>}>
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
                                            {bi.vipClients.length === 0 && <p className="text-center py-20 text-slate-300 italic">Sem vendas vinculadas no período.</p>}
                                        </div>
                                    </Card>

                                    <Card title="⚠️ Churn & Recuperação" icon={<AlertOctagon size={18} className="text-rose-500"/>}>
                                        <div className="space-y-3">
                                            {bi.atRiskClients.map((c, i) => (
                                                <div key={i} className="flex justify-between items-center p-4 bg-rose-50/20 rounded-2xl border border-rose-50 hover:bg-rose-50 transition-all">
                                                    <div>
                                                        <p className="text-xs font-bold text-slate-700">{c.nome}</p>
                                                        <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest mt-0.5">Sem visita há mais de 45 dias</p>
                                                    </div>
                                                    <button className="p-2 bg-emerald-500 text-white rounded-xl shadow-md active:scale-90"><MessageCircle size={14}/></button>
                                                </div>
                                            ))}
                                        </div>
                                    </Card>
                                </div>
                            )}

                            {/* VIEW: EXPORTAR (DUAL BUTTONS) */}
                            {activeTab === 'export' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in zoom-in-95 duration-500">
                                    {[
                                        { title: 'Fluxo de Caixa', desc: 'Extrato financeiro detalhado', type: 'financeiro', color: 'text-emerald-600', bg: 'bg-emerald-50' },
                                        { title: 'Inventário Geral', desc: 'Patrimônio e giro de produtos', type: 'estoque', color: 'text-purple-600', bg: 'bg-purple-50' },
                                        { title: 'Ranking de VIPS', desc: 'Melhores clientes por LTV', type: 'vips', color: 'text-blue-600', bg: 'bg-blue-50' },
                                        { title: 'Relatório Executivo', desc: 'Resumo para gestão (PDF)', type: 'executivo', color: 'text-orange-600', bg: 'bg-orange-50' }
                                    ].map((item, i) => (
                                        <div key={i} className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm hover:shadow-xl transition-all flex flex-col items-center text-center group">
                                            <div className={`p-6 rounded-[28px] ${item.bg} ${item.color} mb-6 transition-transform group-hover:scale-110`}>
                                                {item.type === 'executivo' ? <FileText size={48} /> : (item.type === 'estoque' ? <Archive size={48} /> : <FileSpreadsheet size={48} />)}
                                            </div>
                                            <h3 className="font-black text-slate-800 text-lg leading-tight">{item.title}</h3>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase mt-2 tracking-widest">{item.desc}</p>
                                            
                                            <div className="mt-8 flex gap-3 w-full">
                                                {item.type !== 'executivo' && (
                                                    <button 
                                                        onClick={() => exportToExcel(item.type)}
                                                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-50 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition-all border border-slate-100"
                                                    >
                                                        <Sheet size={14} /> Excel
                                                    </button>
                                                )}
                                                <button 
                                                    onClick={() => generatePDF(item.type as any)}
                                                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-50 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all border border-slate-100"
                                                >
                                                    <FileText size={14} /> PDF
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </main>
        </div>
    );
};

export default RelatoriosView;


import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
    ArrowUpCircle, ArrowDownCircle, Wallet, TrendingUp, AlertTriangle, 
    CheckCircle, Plus, Loader2, Calendar, Search, Filter, Download,
    RefreshCw, ChevronLeft, ChevronRight, FileText, Clock, User,
    Coins, Banknote, Percent, Trash2, BarChart3, PieChart, ArrowUpRight,
    ArrowDownRight, Landmark, History, Smartphone, CreditCard,
    ChevronDown, FileDown, Target, LineChart, FileSpreadsheet
} from 'lucide-react';
import { 
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
    CartesianGrid, Tooltip, Legend, PieChart as RechartsPieChart, Pie, Cell
} from 'recharts';
import Card from '../shared/Card';
import NewTransactionModal from '../modals/NewTransactionModal';
import { FinancialTransaction, TransactionType } from '../../types';
import { supabase } from '../../services/supabaseClient';
import { useStudio } from '../../contexts/StudioContext';
import { 
    format, isSameDay, isAfter, 
    endOfDay, endOfMonth, startOfMonth,
    eachDayOfInterval, addDays, subDays, startOfDay
} from 'date-fns';
import { ptBR as pt } from 'date-fns/locale/pt-BR';
import Toast, { ToastType } from '../shared/Toast';

// Libs para exportação
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// FIX: Added FinanceiroViewProps interface to match props passed from App.tsx
interface FinanceiroViewProps {
    transactions: FinancialTransaction[];
    onAddTransaction: (t: FinancialTransaction) => void;
}

const formatBRL = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const StatCard = ({ title, value, subtext, icon: Icon, colorClass, trend }: any) => (
    <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-md transition-all group">
        <div className="flex justify-between items-start mb-4">
            <div className={`p-3 rounded-2xl ${colorClass} text-white shadow-lg`}>
                <Icon size={20} />
            </div>
            {trend && (
                <div className={`flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg ${trend > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                    {trend > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                    {Math.abs(trend)}%
                </div>
            )}
        </div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
        <h3 className="text-2xl font-black text-slate-800 mt-1">{value}</h3>
        {subtext && <p className="text-[9px] text-slate-400 font-bold uppercase mt-2 tracking-tighter">{subtext}</p>}
    </div>
);

// FIX: Updated component definition to accept FinanceiroViewProps
const FinanceiroView: React.FC<FinanceiroViewProps> = ({ transactions, onAddTransaction }) => {
    const { activeStudioId } = useStudio();
    const [dbTransactions, setDbTransactions] = useState<any[]>([]);
    const [projections, setProjections] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Filtros
    const [filterPeriod, setFilterPeriod] = useState<'hoje' | 'mes' | 'custom'>('hoje');
    const [startDate, setStartDate] = useState(format(startOfDay(new Date()), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(endOfDay(new Date()), 'yyyy-MM-dd'));
    
    const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState<TransactionType | null>(null);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    // --- FETCH DE DADOS REAIS ---
    const fetchData = useCallback(async () => {
        if (!activeStudioId) return;
        setLoading(true);
        try {
            let start, end;
            if (filterPeriod === 'hoje') {
                start = startOfDay(new Date());
                end = endOfDay(new Date());
            } else if (filterPeriod === 'mes') {
                start = startOfMonth(new Date());
                end = endOfMonth(new Date());
            } else {
                start = startOfDay(new Date(startDate));
                end = endOfDay(new Date(endDate));
            }

            // 1. Buscar Transações Reais
            const { data: trans, error: transError } = await supabase
                .from('financial_transactions')
                .select('*')
                .eq('studio_id', activeStudioId)
                .gte('date', start.toISOString())
                .lte('date', end.toISOString())
                .order('date', { ascending: false });
            
            if (transError) throw transError;

            // 2. Buscar Projeções (Agendamentos confirmados nos próximos 7 dias)
            const projStart = startOfDay(new Date());
            const projEnd = endOfDay(addDays(new Date(), 7));
            
            const { data: apps, error: appsError } = await supabase
                .from('appointments')
                .select('date, value')
                .eq('studio_id', activeStudioId)
                .in('status', ['agendado', 'confirmado', 'confirmado_whatsapp'])
                .gte('date', projStart.toISOString())
                .lte('date', projEnd.toISOString());

            if (appsError) throw appsError;

            setDbTransactions(trans || []);
            setProjections(apps || []);
        } catch (error: any) {
            console.error("Erro Financeiro:", error);
            setToast({ message: "Erro ao sincronizar financeiro.", type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [activeStudioId, startDate, endDate, filterPeriod]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // --- CÁLCULOS DE BUSINESS INTELLIGENCE ---
    const bi = useMemo(() => {
        const filtered = dbTransactions.filter(t => {
            const matchSearch = (t.description || '').toLowerCase().includes(searchTerm.toLowerCase());
            const matchCat = selectedCategory === 'Todas' || t.category === selectedCategory;
            return matchSearch && matchCat;
        });

        const grossRevenue = filtered
            .filter(t => t.type === 'income' || t.type === 'receita')
            .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);

        const netRevenue = filtered
            .filter(t => t.type === 'income' || t.type === 'receita')
            .reduce((acc, t) => acc + (Number(t.net_value) || Number(t.amount) || 0), 0);

        const totalExpenses = filtered
            .filter(t => t.type === 'expense' || t.type === 'despesa')
            .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);

        const categoriesSet = new Set(dbTransactions.map(t => t.category).filter(Boolean));
        const categories = Array.from(categoriesSet);

        // Mix de Categorias para o PieChart
        const categoryMix = categories.map(cat => {
            const total = dbTransactions
                .filter(t => t.category === cat)
                .reduce((acc, t) => acc + Number(t.amount || 0), 0);
            return { name: cat, value: total };
        }).sort((a, b) => b.value - a.value).slice(0, 5);

        // Dados para o gráfico temporal (Passado + Projeção Futura)
        const rangeStart = filterPeriod === 'hoje' ? startOfDay(new Date()) : (filterPeriod === 'custom' ? new Date(startDate) : startOfMonth(new Date()));
        const rangeEnd = filterPeriod === 'hoje' ? endOfDay(new Date()) : (filterPeriod === 'custom' ? new Date(endDate) : endOfMonth(new Date()));
        
        const daysInPeriod = eachDayOfInterval({
            start: rangeStart,
            end: rangeEnd
        });

        const chartData = daysInPeriod.map(day => {
            const dayStr = format(day, 'yyyy-MM-dd');
            const dayTrans = dbTransactions.filter(t => format(new Date(t.date), 'yyyy-MM-dd') === dayStr);
            const dayProj = projections.filter(p => format(new Date(p.date), 'yyyy-MM-dd') === dayStr);
            
            const income = dayTrans.filter(t => t.type === 'income' || t.type === 'receita').reduce((acc, t) => acc + Number(t.amount || 0), 0);
            const projection = dayProj.reduce((acc, p) => acc + Number(p.value || 0), 0);

            return {
                name: format(day, 'dd/MM'),
                receita: income > 0 ? income : null,
                despesa: dayTrans.filter(t => t.type === 'expense' || t.type === 'despesa').reduce((acc, t) => acc + Number(t.amount || 0), 0),
                projecao: projection > 0 ? projection : null
            };
        });

        return { 
            filtered, 
            grossRevenue, 
            netRevenue, 
            totalExpenses, 
            balance: netRevenue - totalExpenses, // SALDO REAL: LÍQUIDO - DESPESAS
            categories,
            categoryMix,
            chartData
        };
    }, [dbTransactions, projections, searchTerm, selectedCategory, startDate, endDate, filterPeriod]);

    // --- FUNÇÕES DE EXPORTAÇÃO ---
    const handleExportExcel = () => {
        const dataToExport = bi.filtered.map(t => ({
            Data: format(new Date(t.date), 'dd/MM/yyyy HH:mm'),
            Descrição: t.description,
            Categoria: t.category || 'Geral',
            Tipo: t.type === 'income' ? 'Entrada' : 'Saída',
            Pagamento: t.payment_method,
            Valor_Bruto: t.amount,
            Valor_Liquido: t.net_value || t.amount
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Extrato");
        XLSX.writeFile(wb, `Extrato_Financeiro_BelaRestudio_${format(new Date(), 'dd_MM_yy')}.xlsx`);
        setToast({ message: "Planilha gerada com sucesso!", type: 'success' });
    };

    const handleExportPDF = () => {
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text("BelaRestudio - Relatório de Fluxo de Caixa", 14, 22);
        doc.setFontSize(10);
        doc.text(`Período: ${startDate} até ${endDate}`, 14, 30);

        const tableData = bi.filtered.map(t => [
            format(new Date(t.date), 'dd/MM/yy'),
            t.description,
            t.category || 'Geral',
            t.payment_method,
            t.type === 'income' ? `+ ${formatBRL(t.amount)}` : `- ${formatBRL(t.amount)}`
        ]);

        autoTable(doc, {
            startY: 40,
            head: [['Data', 'Descrição', 'Categoria', 'Pagamento', 'Valor']],
            body: tableData,
            theme: 'striped',
            headStyles: { fill: 'orange' }
        });

        doc.save(`Relatorio_Financeiro_BelaRestudio_${format(new Date(), 'dd_MM_yy')}.pdf`);
        setToast({ message: "PDF gerado com sucesso!", type: 'success' });
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Deseja realmente excluir este lançamento? O saldo será recalculado.")) return;
        try {
            const { error } = await supabase.from('financial_transactions').delete().eq('id', id);
            if (error) throw error;
            setToast({ message: "Lançamento removido.", type: 'info' });
            fetchData();
        } catch (e) {
            setToast({ message: "Erro ao excluir.", type: 'error' });
        }
    };

    const handleSaveNewTransaction = async (t: any) => {
        try {
            const payload = {
                ...t,
                studio_id: activeStudioId,
                date: new Date(t.date).toISOString()
            };
            delete payload.id; // Remover ID do mock se existir

            const { error } = await supabase.from('financial_transactions').insert([payload]);
            if (error) throw error;

            // FIX: If onAddTransaction exists, call it to keep parent state in sync
            if (onAddTransaction) {
                onAddTransaction(t as FinancialTransaction);
            }

            setToast({ message: "Lançamento registrado com sucesso!", type: 'success' });
            fetchData();
            setShowModal(null);
        } catch (e: any) {
            setToast({ message: "Erro ao salvar transação.", type: 'error' });
        }
    };

    return (
        <div className="h-full flex flex-col bg-slate-50 font-sans text-left overflow-hidden">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4 shadow-sm z-20">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-orange-50 text-orange-600 rounded-2xl">
                        <Landmark size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-slate-800 tracking-tight">Fluxo de Caixa</h1>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Gestão de Rentabilidade Real</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
                        <button 
                            onClick={() => { setFilterPeriod('hoje'); }}
                            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all border ${filterPeriod === 'hoje' ? 'bg-orange-500 text-white shadow-lg border-orange-600' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                        >Hoje</button>
                        <button 
                            onClick={() => { setFilterPeriod('mes'); }}
                            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all border ${filterPeriod === 'mes' ? 'bg-orange-500 text-white shadow-lg border-orange-600' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                        >Mês</button>
                        <button 
                            onClick={() => setFilterPeriod('custom')}
                            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all border ${filterPeriod === 'custom' ? 'bg-slate-800 text-white shadow-lg border-slate-900' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                        >Período</button>
                    </div>
                    <button onClick={() => setShowModal('receita')} className="bg-emerald-500 text-white px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-100 active:scale-95 transition-all">Lançar Entrada</button>
                    <button onClick={() => setShowModal('despesa')} className="bg-rose-500 text-white px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-rose-100 active:scale-95 transition-all">Lançar Saída</button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 custom-scrollbar">
                
                {filterPeriod === 'custom' && (
                    <div className="bg-white p-6 rounded-[32px] border border-orange-100 shadow-xl flex flex-wrap items-center gap-6 animate-in slide-in-from-top-2 duration-300">
                        <div className="flex items-center gap-3">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Data Inicial:</span>
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-orange-50 focus:border-orange-200" />
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Data Final:</span>
                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-orange-50 focus:border-orange-200" />
                        </div>
                        <button onClick={fetchData} className="p-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-all shadow-lg shadow-orange-100 active:rotate-180 duration-500"><RefreshCw size={20} /></button>
                    </div>
                )}

                {/* GRID DE MÉTRICAS */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard 
                        title="Saldo em Conta (Dinheiro Vivo)" 
                        value={formatBRL(bi.balance)} 
                        icon={Wallet} 
                        colorClass="bg-slate-800" 
                        subtext="Faturamento Líquido - Despesas"
                    />
                    <StatCard 
                        title="Faturamento Bruto" 
                        value={formatBRL(bi.grossRevenue)} 
                        icon={TrendingUp} 
                        colorClass="bg-blue-600" 
                        subtext="Total que entrou no salão"
                    />
                    <StatCard 
                        title="Faturamento Líquido" 
                        value={formatBRL(bi.netRevenue)} 
                        icon={CheckCircle} 
                        colorClass="bg-emerald-600" 
                        subtext="O que realmente cai na conta"
                    />
                    <StatCard 
                        title="Despesas Totais" 
                        value={formatBRL(bi.totalExpenses)} 
                        icon={ArrowDownCircle} 
                        colorClass="bg-rose-600" 
                        subtext="Custos e retiradas"
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* GRÁFICO DE DESEMPENHO COM PROJEÇÃO */}
                    <Card title="Evolução e Projeção" className="lg:col-span-2 rounded-[32px] overflow-hidden" icon={<LineChart size={18} className="text-orange-500" />}>
                        <div className="h-72 mt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={bi.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorRec" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                        </linearGradient>
                                        <linearGradient id="colorProj" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                                    <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                                    <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{paddingBottom: '20px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase'}} />
                                    <Area type="monotone" dataKey="receita" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRec)" name="Faturamento" />
                                    <Area type="monotone" dataKey="despesa" stroke="#f43f5e" strokeWidth={2} fillOpacity={0} name="Saídas" />
                                    <Area type="monotone" dataKey="projecao" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorProj)" name="Projeção (D+7)" strokeDasharray="5 5" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>

                    {/* GRÁFICO DE CATEGORIAS (Mix de Gastos) */}
                    <Card title="Mix de Gastos/Receita" icon={<PieChart size={18} className="text-orange-500" />}>
                        <div className="h-64 mt-2">
                            <ResponsiveContainer width="100%" height="100%">
                                <RechartsPieChart>
                                    <Pie
                                        data={bi.categoryMix}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {bi.categoryMix.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={['#f97316', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6'][index % 5]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </RechartsPieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="space-y-2 mt-4">
                            {bi.categoryMix.map((cat, i) => (
                                <div key={i} className="flex justify-between items-center text-[10px] font-black uppercase">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ['#f97316', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6'][i % 5] }}></div>
                                        <span className="text-slate-600">{cat.name}</span>
                                    </div>
                                    <span className="text-slate-400">{formatBRL(cat.value)}</span>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>

                {/* LISTAGEM DE TRANSAÇÕES COM FILTROS */}
                <Card className="rounded-[40px] border-slate-200 shadow-xl overflow-hidden">
                    <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                        <div className="flex items-center gap-3">
                            <History className="text-orange-500" size={24} />
                            <h2 className="text-lg font-black text-slate-800 uppercase tracking-tighter">Extrato de Movimentação</h2>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                            <button onClick={handleExportExcel} className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-all shadow-sm" title="Exportar Excel"><FileSpreadsheet size={20}/></button>
                            <button onClick={handleExportPDF} className="p-2.5 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition-all shadow-sm" title="Exportar PDF"><FileDown size={20}/></button>
                            <div className="relative flex-1 md:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                                <input 
                                    type="text" 
                                    placeholder="Pesquisar..." 
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-orange-100 outline-none transition-all"
                                />
                            </div>
                            <select 
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-widest text-slate-600 outline-none focus:ring-2 focus:ring-orange-100"
                            >
                                <option value="Todas">Filtro: Categorias</option>
                                {bi.categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                        </div>
                    </header>

                    <div className="overflow-x-auto -mx-6">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50/50 border-y border-slate-100">
                                <tr>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Data/Hora</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Descrição / Categoria</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Pagamento</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Valor</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {loading ? (
                                    <tr><td colSpan={5} className="p-20 text-center"><Loader2 className="animate-spin text-orange-500 mx-auto" /></td></tr>
                                ) : bi.filtered.length === 0 ? (
                                    <tr><td colSpan={5} className="p-20 text-center text-slate-400 font-bold uppercase text-xs italic">Nenhum registro no período.</td></tr>
                                ) : (
                                    bi.filtered.map(t => (
                                        <tr key={t.id} className="hover:bg-orange-50/20 transition-colors group">
                                            <td className="px-8 py-5">
                                                <p className="text-xs font-bold text-slate-700">{format(new Date(t.date), 'dd/MM/yy')}</p>
                                                <p className="text-[10px] text-slate-400 font-medium">{format(new Date(t.date), 'HH:mm')}</p>
                                            </td>
                                            <td className="px-8 py-5">
                                                <p className="text-sm font-black text-slate-700 group-hover:text-orange-600 transition-colors truncate max-w-xs">{t.description}</p>
                                                <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-black uppercase tracking-wider mt-1">{t.category || 'Geral'}</span>
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-2">
                                                    {t.payment_method === 'pix' && <Smartphone size={14} className="text-teal-500" />}
                                                    {t.payment_method === 'dinheiro' && <Banknote size={14} className="text-green-500" />}
                                                    {(t.payment_method?.includes('cartao')) && <CreditCard size={14} className="text-blue-500" />}
                                                    <span className="text-[10px] font-black text-slate-500 uppercase">{t.payment_method?.replace('_', ' ') || 'Outro'}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <p className={`text-sm font-black ${t.type === 'income' || t.type === 'receita' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                    {t.type === 'income' || t.type === 'receita' ? '+' : '-'} {formatBRL(t.amount)}
                                                </p>
                                                {t.net_value && t.net_value !== t.amount && (
                                                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">Liq: {formatBRL(t.net_value)}</p>
                                                )}
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <button onClick={() => handleDelete(t.id)} className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100">
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>

            {showModal && (
                <NewTransactionModal 
                    type={showModal} 
                    onClose={() => setShowModal(null)} 
                    onSave={handleSaveNewTransaction} 
                />
            )}
        </div>
    );
};

export default FinanceiroView;

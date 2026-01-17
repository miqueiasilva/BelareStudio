
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
    format, endOfDay, endOfMonth, startOfMonth,
    eachDayOfInterval, addDays, startOfDay
} from 'date-fns';
import { ptBR as pt } from 'date-fns/locale/pt-BR';
import Toast, { ToastType } from '../shared/Toast';

// Libs para exportação
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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

const FinanceiroView: React.FC<FinanceiroViewProps> = ({ transactions: propsTransactions, onAddTransaction }) => {
    const { activeStudioId } = useStudio();
    const [dbTransactions, setDbTransactions] = useState<any[]>([]);
    const [projections, setProjections] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    // CACHE LOCAL: Mapeamento de client_id -> Nome do Cliente
    const [clientNames, setClientNames] = useState<Record<string, string>>({});
    
    // Filtros
    const [filterPeriod, setFilterPeriod] = useState<'hoje' | 'mes' | 'custom'>('hoje');
    const [startDate, setStartDate] = useState(format(startOfDay(new Date()), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(endOfDay(new Date()), 'yyyy-MM-dd'));
    
    const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState<TransactionType | null>(null);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    // --- HELPER: MAPEAMENTO DE LABELS DE PAGAMENTO ---
    const getPaymentLabel = (method: string) => {
        const m = method?.toLowerCase() || '';
        if (m === 'pix') return 'PIX';
        if (m === 'cash') return 'DINHEIRO';
        if (m === 'credit') return 'CRÉDITO';
        if (m === 'debit') return 'DÉBITO';
        return 'OUTRO';
    };

    // --- LOGICA DE RESOLUÇÃO DE CLIENTES COM CACHE ---
    const resolveClientNames = useCallback(async (txs: any[]) => {
        // 1. Extrair IDs únicos que ainda NÃO estão no cache e não são nulos
        const uniqueIds = Array.from(new Set(
            txs
                .map(t => t.client_id)
                .filter(id => id !== null && id !== undefined && !clientNames[String(id)])
        ));

        if (uniqueIds.length === 0) return;

        try {
            // 2. Chamar RPC para cada ID (deduplicado)
            const results = await Promise.all(uniqueIds.map(async (id) => {
                const { data, error } = await supabase.rpc('fn_get_client_name', { c_id: id });
                if (error) {
                    console.error(`Erro RPC para cliente ${id}:`, error.message);
                    return { id: String(id), name: 'Consumidor Final' };
                }
                return { id: String(id), name: data || 'Consumidor Final' };
            }));

            // 3. Atualizar cache local
            setClientNames(prev => {
                const updated = { ...prev };
                results.forEach(res => {
                    updated[res.id] = res.name;
                });
                return updated;
            });
        } catch (e) {
            console.error("Erro ao processar nomes de clientes:", e);
        }
    }, [clientNames]);

    // --- FETCH DE DADOS ---
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

            // Buscar Transações (Garantindo seleção explícita para debug)
            const { data: trans, error: transError } = await supabase
                .from('financial_transactions')
                .select('id, description, amount, net_value, type, category, date, payment_method, client_id, professional_id')
                .eq('studio_id', activeStudioId)
                .gte('date', start.toISOString())
                .lte('date', end.toISOString())
                .order('date', { ascending: false });
            
            if (transError) throw transError;

            // DEBUG CONSOLE.TABLE CONFORME SOLICITADO NO PASSO 1
            if (trans) {
                console.log("--- DEBUG EXTRATO FINANCEIRO ---");
                console.table(trans.slice(0, 10).map(t => ({ 
                    id: t.id, 
                    client_id: t.client_id, 
                    description: t.description,
                    method: t.payment_method 
                })));
            }

            // Buscar Projeções
            const projStart = startOfDay(new Date());
            const projEnd = endOfDay(addDays(new Date(), 7));
            const { data: apps } = await supabase
                .from('appointments')
                .select('date, value')
                .eq('studio_id', activeStudioId)
                .in('status', ['agendado', 'confirmado', 'confirmado_whatsapp'])
                .gte('date', projStart.toISOString())
                .lte('date', projEnd.toISOString());

            setDbTransactions(trans || []);
            setProjections(apps || []);
            
            // Iniciar busca dos nomes dos clientes para esta lista
            if (trans && trans.length > 0) {
                resolveClientNames(trans);
            }

        } catch (error: any) {
            console.error("Erro Financeiro:", error);
            setToast({ message: "Erro ao sincronizar financeiro.", type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [activeStudioId, startDate, endDate, filterPeriod, resolveClientNames]);

    useEffect(() => { fetchData(); }, [fetchData]);

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

        const categories = Array.from(new Set(dbTransactions.map(t => t.category).filter(Boolean)));
        
        const categoryMix = categories.map(cat => {
            const total = dbTransactions
                .filter(t => t.category === cat)
                .reduce((acc, t) => acc + Number(t.amount || 0), 0);
            return { name: cat, value: total };
        }).sort((a, b) => b.value - a.value).slice(0, 5);

        const rangeStart = filterPeriod === 'hoje' ? startOfDay(new Date()) : (filterPeriod === 'custom' ? new Date(startDate) : startOfMonth(new Date()));
        const rangeEnd = filterPeriod === 'hoje' ? endOfDay(new Date()) : (filterPeriod === 'custom' ? new Date(endDate) : endOfMonth(new Date()));
        const daysInPeriod = eachDayOfInterval({ start: rangeStart, end: rangeEnd });

        const chartData = daysInPeriod.map(day => {
            const dayStr = format(day, 'yyyy-MM-dd');
            const dayTrans = dbTransactions.filter(t => format(new Date(t.date), 'yyyy-MM-dd') === dayStr);
            const income = dayTrans.filter(t => t.type === 'income' || t.type === 'receita').reduce((acc, t) => acc + Number(t.amount || 0), 0);
            const expense = dayTrans.filter(t => t.type === 'expense' || t.type === 'despesa').reduce((acc, t) => acc + Number(t.amount || 0), 0);
            return { name: format(day, 'dd/MM'), receita: income || null, despesa: expense || null };
        });

        return { filtered, grossRevenue, netRevenue, totalExpenses, balance: netRevenue - totalExpenses, categories, categoryMix, chartData };
    }, [dbTransactions, projections, searchTerm, selectedCategory, startDate, endDate, filterPeriod]);

    const handleExportExcel = () => {
        const dataToExport = bi.filtered.map(t => ({
            Data: format(new Date(t.date), 'dd/MM/yyyy HH:mm'),
            Descrição: t.description,
            Cliente: t.client_id ? (clientNames[String(t.client_id)] || 'Consumidor Final') : 'Consumidor Final',
            Pagamento: getPaymentLabel(t.payment_method),
            Valor: t.amount
        }));
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Extrato");
        XLSX.writeFile(wb, `Extrato_Financeiro_${format(new Date(), 'dd_MM_yy')}.xlsx`);
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Excluir este lançamento?")) return;
        try {
            await supabase.from('financial_transactions').delete().eq('id', id);
            fetchData();
        } catch (e) { console.error(e); }
    };

    return (
        <div className="h-full flex flex-col bg-slate-50 font-sans text-left overflow-hidden">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4 shadow-sm z-20">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-orange-50 text-orange-600 rounded-2xl"><Landmark size={24} /></div>
                    <div>
                        <h1 className="text-xl font-black text-slate-800 tracking-tight">Fluxo de Caixa</h1>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Gestão de Rentabilidade Real</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
                        <button onClick={() => setFilterPeriod('hoje')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${filterPeriod === 'hoje' ? 'bg-orange-500 text-white shadow-lg' : 'bg-white text-slate-500'}`}>Hoje</button>
                        <button onClick={() => setFilterPeriod('mes')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${filterPeriod === 'mes' ? 'bg-orange-500 text-white shadow-lg' : 'bg-white text-slate-500'}`}>Mês</button>
                        <button onClick={() => setFilterPeriod('custom')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${filterPeriod === 'custom' ? 'bg-slate-800 text-white shadow-lg' : 'bg-white text-slate-500'}`}>Período</button>
                    </div>
                    <button onClick={() => setShowModal('receita')} className="bg-emerald-500 text-white px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg">Lançar Entrada</button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard title="Saldo em Conta" value={formatBRL(bi.balance)} icon={Wallet} colorClass="bg-slate-800" subtext="Faturamento Líquido - Despesas" />
                    <StatCard title="Faturamento Bruto" value={formatBRL(bi.grossRevenue)} icon={TrendingUp} colorClass="bg-blue-600" />
                    <StatCard title="Faturamento Líquido" value={formatBRL(bi.netRevenue)} icon={CheckCircle} colorClass="bg-emerald-600" />
                    <StatCard title="Despesas Totais" value={formatBRL(bi.totalExpenses)} icon={ArrowDownCircle} colorClass="bg-rose-600" />
                </div>

                <Card className="rounded-[40px] border-slate-200 shadow-xl overflow-hidden">
                    <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                        <div className="flex items-center gap-3"><History className="text-orange-500" size={24} /><h2 className="text-lg font-black text-slate-800 uppercase tracking-tighter">Extrato de Movimentação</h2></div>
                        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                            <button onClick={handleExportExcel} className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-all shadow-sm"><FileSpreadsheet size={20}/></button>
                            <div className="relative flex-1 md:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                                <input type="text" placeholder="Pesquisar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-orange-100 outline-none" />
                            </div>
                        </div>
                    </header>

                    <div className="overflow-x-auto -mx-6">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50/50 border-y border-slate-100">
                                <tr>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Data/Hora</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Descrição / Cliente</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Pagamento</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Valor</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {loading ? (
                                    <tr><td colSpan={5} className="p-20 text-center"><Loader2 className="animate-spin text-orange-500 mx-auto" /></td></tr>
                                ) : bi.filtered.length === 0 ? (
                                    <tr><td colSpan={5} className="p-20 text-center text-slate-400 font-bold uppercase text-xs italic">Nenhum registro.</td></tr>
                                ) : (
                                    bi.filtered.map(t => (
                                        <tr key={t.id} className="hover:bg-orange-50/20 transition-colors group">
                                            <td className="px-8 py-5">
                                                <p className="text-xs font-bold text-slate-700">{format(new Date(t.date), 'dd/MM/yy')}</p>
                                                <p className="text-[10px] text-slate-400 font-medium">{format(new Date(t.date), 'HH:mm')}</p>
                                            </td>
                                            <td className="px-8 py-5">
                                                <p className="text-sm font-black text-slate-700 group-hover:text-orange-600 transition-colors truncate max-w-xs">{t.description}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[9px] font-bold text-orange-500 uppercase tracking-tight">
                                                        • Cliente: {clientNames[String(t.client_id)] || 'Consumidor Final'}
                                                    </span>
                                                    {!t.client_id && <span className="text-[8px] text-slate-300 italic">(Sem ID vinculado)</span>}
                                                </div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-2">
                                                    {t.payment_method?.toLowerCase() === 'pix' && <Smartphone size={14} className="text-teal-500" />}
                                                    {t.payment_method?.toLowerCase() === 'cash' && <Banknote size={14} className="text-green-500" />}
                                                    {(t.payment_method?.toLowerCase() === 'credit' || t.payment_method?.toLowerCase() === 'debit') && <CreditCard size={14} className="text-blue-500" />}
                                                    <span className="text-[10px] font-black text-slate-500 uppercase">
                                                        {getPaymentLabel(t.payment_method)}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <p className={`text-sm font-black ${t.type === 'income' || t.type === 'receita' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                    {t.type === 'income' || t.type === 'receita' ? '+' : '-'} {formatBRL(t.amount)}
                                                </p>
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <button onClick={() => handleDelete(t.id)} className="p-2 text-slate-300 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100"><Trash2 size={16} /></button>
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
                    onSave={(t) => { onAddTransaction(t); setShowModal(null); fetchData(); }} 
                />
            )}
        </div>
    );
};

export default FinanceiroView;

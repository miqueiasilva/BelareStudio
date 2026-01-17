
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

import * as XLSX from 'xlsx';

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

const FinanceiroView: React.FC<FinanceiroViewProps> = ({ onAddTransaction }) => {
    const { activeStudioId } = useStudio();
    const [dbTransactions, setDbTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
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
        if (m === 'cash' || m === 'money') return 'DINHEIRO';
        if (m === 'credit') return 'CRÉDITO';
        if (m === 'debit') return 'DÉBITO';
        return m.toUpperCase() || 'OUTRO';
    };

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

            // CORREÇÃO: Consultando a VIEW v_cashflow para trazer cliente e canal amigável
            const { data, error } = await supabase
                .from('v_cashflow')
                .select('*')
                .eq('studio_id', activeStudioId)
                .gte('date', start.toISOString())
                .lte('date', end.toISOString())
                .order('date', { ascending: false });
            
            if (error) throw error;
            setDbTransactions(data || []);
        } catch (error: any) {
            setToast({ message: "Erro ao sincronizar financeiro.", type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [activeStudioId, startDate, endDate, filterPeriod]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const bi = useMemo(() => {
        const filtered = dbTransactions.filter(t => {
            const matchSearch = (t.description || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                               (t.client_display_name || '').toLowerCase().includes(searchTerm.toLowerCase());
            return matchSearch;
        });

        const grossRevenue = filtered
            .filter(t => t.type === 'income' || t.type === 'receita')
            .reduce((acc, t) => acc + (Number(t.gross_value) || 0), 0);

        const netRevenue = filtered
            .filter(t => t.type === 'income' || t.type === 'receita')
            .reduce((acc, t) => acc + (Number(t.net_value) || 0), 0);

        const totalExpenses = filtered
            .filter(t => t.type === 'expense' || t.type === 'despesa')
            .reduce((acc, t) => acc + (Number(t.gross_value) || 0), 0);

        return { filtered, grossRevenue, netRevenue, totalExpenses, balance: netRevenue - totalExpenses };
    }, [dbTransactions, searchTerm]);

    const handleExportExcel = () => {
        const dataToExport = bi.filtered.map(t => ({
            Data: format(new Date(t.date), 'dd/MM/yyyy HH:mm'),
            Descrição: t.description,
            Cliente: t.client_display_name,
            Canal: t.payment_channel,
            'Valor Bruto': t.gross_value,
            'Taxa Adm': t.fee_amount,
            'Valor Líquido': t.net_value
        }));
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Extrato");
        XLSX.writeFile(wb, `Financeiro_BelaStudio_${format(new Date(), 'dd_MM_yy')}.xlsx`);
    };

    return (
        <div className="h-full flex flex-col bg-slate-50 font-sans text-left overflow-hidden">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4 shadow-sm z-20">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-orange-50 text-orange-600 rounded-2xl"><Landmark size={24} /></div>
                    <div>
                        <h1 className="text-xl font-black text-slate-800 tracking-tight">Fluxo de Caixa</h1>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Visão Analítica de Recebíveis</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
                        <button onClick={() => setFilterPeriod('hoje')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${filterPeriod === 'hoje' ? 'bg-orange-500 text-white shadow-lg' : 'bg-white text-slate-500'}`}>Hoje</button>
                        <button onClick={() => setFilterPeriod('mes')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${filterPeriod === 'mes' ? 'bg-orange-500 text-white shadow-lg' : 'bg-white text-slate-500'}`}>Mês</button>
                    </div>
                    <button onClick={() => setShowModal('receita')} className="bg-emerald-500 text-white px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg">Entrada Manual</button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard title="Saldo Consolidado" value={formatBRL(bi.balance)} icon={Wallet} colorClass="bg-slate-800" subtext="Disponível (Pós-Taxas)" />
                    <StatCard title="Faturamento Bruto" value={formatBRL(bi.grossRevenue)} icon={TrendingUp} colorClass="bg-blue-600" />
                    <StatCard title="Total de Taxas" value={formatBRL(bi.grossRevenue - bi.netRevenue)} icon={Percent} colorClass="bg-orange-500" subtext="Custos de Transação" />
                    <StatCard title="Despesas Gerais" value={formatBRL(bi.totalExpenses)} icon={ArrowDownCircle} colorClass="bg-rose-600" />
                </div>

                <Card className="rounded-[40px] border-slate-200 shadow-xl overflow-hidden">
                    <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                        <div className="flex items-center gap-3"><History className="text-orange-500" size={24} /><h2 className="text-lg font-black text-slate-800 uppercase tracking-tighter">Extrato Consolidado</h2></div>
                        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                            <button onClick={handleExportExcel} className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-all shadow-sm"><FileSpreadsheet size={20}/></button>
                            <div className="relative flex-1 md:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                                <input type="text" placeholder="Buscar por cliente ou item..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-orange-100 outline-none" />
                            </div>
                        </div>
                    </header>

                    <div className="overflow-x-auto -mx-6">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50/50 border-y border-slate-100">
                                <tr>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data / Canal</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente / Descrição</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Bruto</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Taxas</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Líquido</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {loading ? (
                                    <tr><td colSpan={5} className="p-20 text-center"><Loader2 className="animate-spin text-orange-500 mx-auto" /></td></tr>
                                ) : bi.filtered.length === 0 ? (
                                    <tr><td colSpan={5} className="p-20 text-center text-slate-400 font-bold uppercase text-xs italic">Nenhuma movimentação.</td></tr>
                                ) : (
                                    bi.filtered.map(t => (
                                        <tr key={t.transaction_id} className="hover:bg-orange-50/20 transition-colors group">
                                            <td className="px-8 py-5">
                                                <p className="text-xs font-bold text-slate-700">{format(new Date(t.date), 'dd/MM/yy HH:mm')}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className={`text-[8px] font-black px-2 py-0.5 rounded border ${
                                                        t.payment_channel === 'PIX' ? 'bg-teal-50 text-teal-600 border-teal-100' : 
                                                        t.payment_channel === 'DINHEIRO' ? 'bg-green-50 text-green-600 border-green-100' : 
                                                        'bg-blue-50 text-blue-600 border-blue-100'
                                                    }`}>
                                                        {t.payment_channel}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <p className="text-sm font-black text-slate-800">{t.client_display_name}</p>
                                                <p className="text-[10px] text-slate-400 font-medium truncate max-w-xs">{t.description}</p>
                                            </td>
                                            <td className="px-8 py-5 text-right font-bold text-slate-400 text-xs">
                                                {formatBRL(t.gross_value)}
                                            </td>
                                            <td className="px-8 py-5 text-right font-bold text-rose-300 text-xs">
                                                - {formatBRL(t.fee_amount || 0)}
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <p className={`text-sm font-black ${t.type === 'income' || t.type === 'receita' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                    {formatBRL(t.net_value || t.gross_value)}
                                                </p>
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

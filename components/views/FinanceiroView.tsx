
import React, { useState, useMemo, useEffect } from 'react';
import { 
    ArrowUpCircle, ArrowDownCircle, Wallet, TrendingUp, AlertTriangle, 
    CheckCircle, Plus, Loader2, Calendar, Search, Filter, Download,
    RefreshCw, ChevronLeft, ChevronRight, FileText, Clock, User,
    Coins, Banknote, Percent, Trash2
} from 'lucide-react';
import Card from '../shared/Card';
import SafePie from '../charts/SafePie';
import NewTransactionModal from '../modals/NewTransactionModal';
import { FinancialTransaction, TransactionType } from '../../types';
import { supabase } from '../../services/supabaseClient';
import { useStudio } from '../../contexts/StudioContext';
import { 
    format, isSameDay, isSameWeek, isSameMonth, 
    startOfDay, endOfDay, startOfWeek, endOfWeek, 
    startOfMonth, endOfMonth, parseISO 
} from 'date-fns';
import { ptBR as pt } from 'date-fns/locale/pt-BR';
import Toast, { ToastType } from '../shared/Toast';

const formatBRL = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const FinanceiroView: React.FC<any> = ({ onAddTransaction }) => {
    const { activeStudioId } = useStudio();
    const [dbTransactions, setDbTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
    const [activeTab, setActiveTab] = useState<'extrato' | 'comissoes'>('extrato');
    const [showModal, setShowModal] = useState<TransactionType | null>(null);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    const fetchData = async () => {
        if (!activeStudioId) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('financial_transactions')
                .select('*')
                .eq('studio_id', activeStudioId)
                .order('date', { ascending: false });
            if (error) throw error;
            setDbTransactions(data || []);
        } catch (error: any) {
            setToast({ message: "Erro ao sincronizar dados.", type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [activeStudioId]);

    const filteredTransactions = useMemo(() => {
        return dbTransactions.filter(t => {
            const tDate = parseISO(t.date);
            if (viewMode === 'daily') return isSameDay(tDate, currentDate);
            if (viewMode === 'monthly') return isSameMonth(tDate, currentDate);
            return true;
        });
    }, [dbTransactions, currentDate, viewMode]);

    const metrics = useMemo(() => {
        const income = filteredTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
        const expense = filteredTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
        return { income, expense, balance: income - expense };
    }, [filteredTransactions]);

    return (
        <div className="h-full flex flex-col bg-slate-50 font-sans text-left overflow-hidden">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm">
                <div>
                    <h1 className="text-xl font-black text-slate-800 flex items-center gap-2"><Wallet className="text-orange-500" /> Financeiro</h1>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Dados da Unidade Ativa</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setShowModal('receita')} className="bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-100 transition-all active:scale-95">RECEITA</button>
                    <button onClick={() => setShowModal('despesa')} className="bg-rose-500 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-rose-100 transition-all active:scale-95">DESPESA</button>
                </div>
            </header>
            <div className="flex-1 overflow-y-auto p-8 space-y-8">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
                        <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Saldo Líquido</p>
                        <h3 className="text-2xl font-black">{formatBRL(metrics.balance)}</h3>
                    </div>
                    <div className="bg-emerald-50/20 p-6 rounded-[32px] border border-emerald-100 shadow-sm">
                        <p className="text-emerald-600 text-[10px] font-black uppercase tracking-widest mb-1">Total Entradas</p>
                        <h3 className="text-2xl font-black text-emerald-600">{formatBRL(metrics.income)}</h3>
                    </div>
                </div>
                <Card title="Extrato Detalhado">
                    {loading ? <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-orange-500" /></div> : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead><tr className="text-slate-400 text-[10px] font-black uppercase"><th className="pb-4">Descrição</th><th className="pb-4 text-right">Valor</th></tr></thead>
                                <tbody className="divide-y divide-slate-50">
                                    {filteredTransactions.map(t => (
                                        <tr key={t.id} className="hover:bg-slate-50">
                                            <td className="py-4 font-bold text-slate-700">{t.description}</td>
                                            <td className={`py-4 text-right font-black ${t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>{formatBRL(t.amount)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>
            </div>
            {showModal && <NewTransactionModal type={showModal} onClose={() => setShowModal(null)} onSave={fetchData} />}
        </div>
    );
};

export default FinanceiroView;

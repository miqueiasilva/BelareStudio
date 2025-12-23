
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
    ArrowUpCircle, ArrowDownCircle, Wallet, TrendingUp, RefreshCw, 
    Plus, Loader2, Calendar, Search, AlertCircle
} from 'lucide-react';
import { format, isSameDay } from 'date-fns';
import { pt } from 'date-fns/locale';
import { supabase } from '../../services/supabaseClient';
import NewTransactionModal from '../modals/NewTransactionModal';
import Toast, { ToastType } from '../shared/Toast';
import { FinancialTransaction, TransactionType } from '../../types';

const FinanceiroView: React.FC = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
    const [showModal, setShowModal] = useState<TransactionType | null>(null);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    
    const abortControllerRef = useRef<AbortController | null>(null);

    const fetchTransactions = useCallback(async () => {
        if (abortControllerRef.current) abortControllerRef.current.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;

        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .order('date', { ascending: false })
                .abortSignal(controller.signal);
            
            if (error) throw error;

            const mapped: FinancialTransaction[] = (data || []).map((t: any) => ({
                id: t.id,
                description: t.description,
                amount: Number(t.amount) || 0,
                type: t.type,
                category: t.category,
                date: new Date(t.date),
                paymentMethod: t.payment_method || 'pix',
                status: t.status
            }));
            setTransactions(mapped);
        } catch (error: any) {
            if (error.name === 'AbortError' || error.message?.includes('aborted')) return;
            
            const errorMessage = error.message || (typeof error === 'string' ? error : JSON.stringify(error));
            console.error("Financeiro Fetch Error Details:", errorMessage);
            
            setToast({ 
                message: `Falha ao carregar extrato: ${errorMessage}`, 
                type: 'error' 
            });
        } finally {
            if (abortControllerRef.current === controller) {
                setIsLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        fetchTransactions();
        return () => abortControllerRef.current?.abort();
    }, [fetchTransactions]);

    const metrics = useMemo(() => {
        const today = new Date();
        const income = transactions.filter(t => t.type === 'receita').reduce((acc, t) => acc + t.amount, 0);
        const expense = transactions.filter(t => t.type === 'despesa').reduce((acc, t) => acc + t.amount, 0);
        const incomeToday = transactions.filter(t => t.type === 'receita' && isSameDay(t.date, today)).reduce((acc, t) => acc + t.amount, 0);
        
        return { income, expense, balance: income - expense, incomeToday };
    }, [transactions]);

    const filteredTransactions = useMemo(() => {
        return transactions.filter(t => 
            t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.category.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [transactions, searchTerm]);

    const handleSaveTransaction = async (t: FinancialTransaction) => {
        try {
            const { error } = await supabase.from('transactions').insert([{
                description: t.description,
                amount: t.amount,
                type: t.type,
                category: t.category,
                date: t.date.toISOString(),
                payment_method: t.paymentMethod,
                status: 'pago'
            }]);

            if (error) throw error;

            setToast({ message: 'Lançamento registrado!', type: 'success' });
            setShowModal(null);
            fetchTransactions();
        } catch (error: any) {
            const msg = error?.message || "Falha ao registrar transação.";
            alert("Erro ao salvar: " + msg);
        }
    };

    return (
        <div className="h-full flex flex-col bg-slate-50 overflow-hidden font-sans">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <header className="bg-white border-b border-slate-200 px-6 py-5 flex flex-col md:flex-row justify-between items-center gap-4 flex-shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Wallet className="text-orange-500" /> Fluxo de Caixa Real
                    </h1>
                </div>
                
                <div className="flex gap-2">
                    <button onClick={fetchTransactions} className="p-2.5 text-slate-400 hover:text-orange-500 bg-white border border-slate-100 rounded-xl transition-all">
                        <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                    <button onClick={() => setShowModal('receita')} className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95">
                        <Plus size={16}/> Receita
                    </button>
                    <button onClick={() => setShowModal('despesa')} className="bg-rose-500 hover:bg-rose-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95">
                        <Plus size={16}/> Despesa
                    </button>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-white p-6 rounded-[28px] border border-slate-200 shadow-sm">
                        <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Saldo Consolidado</p>
                        <h3 className={`text-2xl font-black mt-1 ${metrics.balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            R$ {metrics.balance.toFixed(2)}
                        </h3>
                    </div>
                    <div className="bg-white p-6 rounded-[28px] border border-slate-200 shadow-sm">
                        <p className="text-emerald-500 text-[10px] font-black uppercase tracking-widest">Entradas (Mês)</p>
                        <h3 className="text-2xl font-black text-slate-800 mt-1">R$ {metrics.income.toFixed(2)}</h3>
                    </div>
                    <div className="bg-white p-6 rounded-[28px] border border-slate-200 shadow-sm">
                        <p className="text-rose-500 text-[10px] font-black uppercase tracking-widest">Saídas (Mês)</p>
                        <h3 className="text-2xl font-black text-slate-800 mt-1">R$ {metrics.expense.toFixed(2)}</h3>
                    </div>
                    <div className="bg-slate-900 p-6 rounded-[28px] shadow-xl text-white">
                        <p className="text-orange-400 text-[10px] font-black uppercase tracking-widest">Hoje ({format(new Date(), 'dd/MM')})</p>
                        <h3 className="text-2xl font-black text-white mt-1">R$ {metrics.incomeToday.toFixed(2)}</h3>
                    </div>
                </div>

                <div className="relative max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Buscar no extrato..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-orange-500 outline-none transition-all font-medium"
                    />
                </div>

                <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden min-h-[300px] flex flex-col">
                    {isLoading ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 animate-pulse">
                            <Loader2 className="animate-spin mb-4" size={40} />
                            <p className="font-bold text-xs uppercase tracking-widest">Consultando banco...</p>
                        </div>
                    ) : filteredTransactions.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-300 italic p-10">
                            <AlertCircle size={48} className="mb-4 opacity-20" />
                            <p>Nenhuma transação encontrada no período.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 border-b text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    <tr>
                                        <th className="px-6 py-5">Data</th>
                                        <th className="px-6 py-5">Descrição</th>
                                        <th className="px-6 py-5">Pagamento</th>
                                        <th className="px-6 py-5 text-right">Valor</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredTransactions.map((t) => (
                                        <tr key={t.id} className="hover:bg-slate-50/50 transition-colors group">
                                            <td className="px-6 py-4 text-xs text-slate-500 font-bold">{format(t.date, 'dd/MM/yyyy')}</td>
                                            <td className="px-6 py-4">
                                                <p className="text-sm font-bold text-slate-800">{t.description}</p>
                                                <p className="text-[10px] text-slate-400 uppercase">{t.category}</p>
                                            </td>
                                            <td className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">{t.paymentMethod}</td>
                                            <td className={`px-6 py-4 text-right font-black text-base ${t.type === 'receita' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {t.type === 'receita' ? '+' : '-'} R$ {t.amount.toFixed(2)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>

            {showModal && <NewTransactionModal type={showModal} onClose={() => setShowModal(null)} onSave={handleSaveTransaction} />}
        </div>
    );
};

export default FinanceiroView;

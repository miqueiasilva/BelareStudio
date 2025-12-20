
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
    ArrowUpCircle, ArrowDownCircle, Wallet, TrendingUp, RefreshCw, 
    Plus, Loader2, Calendar, Search, Filter 
} from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { pt } from 'date-fns/locale';
import { supabase } from '../../services/supabaseClient';
import Card from '../shared/Card';
import NewTransactionModal from '../modals/NewTransactionModal';
import Toast, { ToastType } from '../shared/Toast';
import { FinancialTransaction, TransactionType } from '../../types';

const FinanceiroView: React.FC = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
    const [showModal, setShowModal] = useState<TransactionType | null>(null);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchTransactions = useCallback(async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('financial_transactions')
                .select('*')
                .order('date', { ascending: false });
            
            if (error) throw error;
            // Map keys if necessary, but assuming column names match our types
            setTransactions((data as any[]) || []);
        } catch (error: any) {
            setToast({ message: 'Erro ao carregar finanças.', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTransactions();
    }, [fetchTransactions]);

    const metrics = useMemo(() => {
        const income = transactions.filter(t => t.type === 'receita').reduce((acc, t) => acc + t.amount, 0);
        const expense = transactions.filter(t => t.type === 'despesa').reduce((acc, t) => acc + t.amount, 0);
        return { income, expense, balance: income - expense };
    }, [transactions]);

    const filteredTransactions = useMemo(() => {
        return transactions.filter(t => 
            t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.category.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [transactions, searchTerm]);

    const handleSaveTransaction = async (t: FinancialTransaction) => {
        try {
            const { error } = await supabase.from('financial_transactions').insert([{
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
            setToast({ message: 'Erro ao salvar transação.', type: 'error' });
        }
    };

    return (
        <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <header className="bg-white border-b border-slate-200 px-6 py-5 flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Wallet className="text-orange-500" />
                        Fluxo de Caixa
                    </h1>
                    <p className="text-slate-500 text-sm">Controle financeiro integrado e real.</p>
                </div>
                
                <div className="flex gap-2">
                    <button onClick={fetchTransactions} className="p-2.5 text-slate-400 hover:text-orange-500 hover:bg-orange-50 rounded-xl transition-all"><RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} /></button>
                    <button onClick={() => setShowModal('receita')} className="bg-green-500 hover:bg-green-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-green-100">
                        <Plus className="w-4 h-4"/> Receita
                    </button>
                    <button onClick={() => setShowModal('despesa')} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-red-100">
                        <Plus className="w-4 h-4"/> Despesa
                    </button>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="bg-white border-l-4 border-l-blue-500">
                        <p className="text-slate-400 text-xs font-black uppercase tracking-widest">Saldo Total</p>
                        <h3 className={`text-3xl font-black mt-1 ${metrics.balance >= 0 ? 'text-slate-800' : 'text-red-600'}`}>
                            R$ {metrics.balance.toFixed(2)}
                        </h3>
                    </Card>
                    <Card className="bg-green-50 border-l-4 border-l-green-500">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-green-600 text-xs font-black uppercase tracking-widest">Entradas</p>
                                <h3 className="text-3xl font-black text-green-700 mt-1">R$ {metrics.income.toFixed(2)}</h3>
                            </div>
                            <ArrowUpCircle className="text-green-400 w-8 h-8" />
                        </div>
                    </Card>
                    <Card className="bg-red-50 border-l-4 border-l-red-500">
                         <div className="flex justify-between items-start">
                            <div>
                                <p className="text-red-600 text-xs font-black uppercase tracking-widest">Saídas</p>
                                <h3 className="text-3xl font-black text-red-700 mt-1">R$ {metrics.expense.toFixed(2)}</h3>
                            </div>
                            <ArrowDownCircle className="text-red-400 w-8 h-8" />
                        </div>
                    </Card>
                </div>

                <div className="flex flex-col md:flex-row gap-4 items-center mb-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                            type="text" 
                            placeholder="Buscar no extrato..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-orange-500 outline-none"
                        />
                    </div>
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                    {isLoading && transactions.length === 0 ? (
                        <div className="p-20 text-center text-slate-400">
                            <Loader2 className="animate-spin mx-auto mb-4" size={40} />
                            <p>Sincronizando extrato...</p>
                        </div>
                    ) : filteredTransactions.length === 0 ? (
                        <div className="p-20 text-center text-slate-400">
                            <p>Nenhuma transação encontrada.</p>
                        </div>
                    ) : (
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                <tr>
                                    <th className="px-6 py-4">Data</th>
                                    <th className="px-6 py-4">Descrição</th>
                                    <th className="px-6 py-4">Categoria</th>
                                    <th className="px-6 py-4 text-right">Valor</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredTransactions.map((t) => (
                                    <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 text-sm text-slate-500 font-medium">
                                            {format(new Date(t.date), 'dd/MM/yyyy')}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-bold text-slate-800">{t.description}</td>
                                        <td className="px-6 py-4">
                                            <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-500 text-[10px] font-black uppercase">{t.category}</span>
                                        </td>
                                        <td className={`px-6 py-4 text-right font-black ${t.type === 'receita' ? 'text-green-600' : 'text-red-600'}`}>
                                            {t.type === 'receita' ? '+' : '-'} R$ {t.amount.toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </main>

            {showModal && (
                <NewTransactionModal 
                    type={showModal} 
                    onClose={() => setShowModal(null)} 
                    onSave={handleSaveTransaction}
                />
            )}
        </div>
    );
};

export default FinanceiroView;

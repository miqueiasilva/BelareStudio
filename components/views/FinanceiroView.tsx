
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
import { 
    format, isSameDay, isSameWeek, isSameMonth, 
    startOfDay, endOfDay, startOfWeek, endOfWeek, 
    startOfMonth, endOfMonth, parseISO 
} from 'date-fns';
import { ptBR as pt } from 'date-fns/locale/pt-BR';
import Toast, { ToastType } from '../shared/Toast';

// Helper de formatação BRL
const formatBRL = (value: number) => {
    return value.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    });
};

interface FinanceiroViewProps {
    transactions?: FinancialTransaction[]; 
    onAddTransaction: (t: FinancialTransaction) => void;
}

const FinanceiroView: React.FC<FinanceiroViewProps> = ({ onAddTransaction }) => {
    const [dbTransactions, setDbTransactions] = useState<any[]>([]);
    const [professionals, setProfessionals] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
    const [activeTab, setActiveTab] = useState<'visao_geral' | 'extrato' | 'comissoes'>('visao_geral');
    const [showModal, setShowModal] = useState<TransactionType | null>(null);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    // --- Data Fetching ---
    const fetchData = async () => {
        setLoading(true);
        try {
            // Busca transações e profissionais (incluindo taxa de comissão da tabela team_members)
            const [transRes, profsRes] = await Promise.all([
                supabase
                    .from('financial_transactions')
                    .select('*')
                    .order('date', { ascending: false }),
                supabase
                    .from('team_members') // Usando team_members para pegar commission_rate real
                    .select('id, name, photo_url, role, commission_rate')
                    .eq('active', true)
            ]);

            if (transRes.error) throw transRes.error;
            if (profsRes.error) throw profsRes.error;

            setDbTransactions(transRes.data || []);
            setProfessionals(profsRes.data || []);
        } catch (error: any) {
            console.error("Erro financeiro:", error);
            setToast({ message: "Erro ao sincronizar dados financeiros.", type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // --- Filtros e Cálculos ---
    const filteredTransactions = useMemo(() => {
        return dbTransactions.filter(t => {
            const tDate = parseISO(t.date);
            if (viewMode === 'daily') return isSameDay(tDate, currentDate);
            
            if (viewMode === 'weekly') {
                const start = startOfWeek(currentDate, { weekStartsOn: 1 });
                const end = endOfWeek(currentDate, { weekStartsOn: 1 });
                return tDate >= start && tDate <= end;
            }
            
            if (viewMode === 'monthly') return isSameMonth(tDate, currentDate);
            return true;
        });
    }, [dbTransactions, currentDate, viewMode]);

    const metrics = useMemo(() => {
        const income = filteredTransactions
            .filter(t => t.type === 'income' || t.type === 'receita')
            .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
            
        const expense = filteredTransactions
            .filter(t => t.type === 'expense' || t.type === 'despesa')
            .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
            
        const balance = income - expense;
        
        return { income, expense, balance };
    }, [filteredTransactions]);

    // --- Motor de Cálculo de Comissões Reais ---
    const commissionStats = useMemo(() => {
        return professionals.map(prof => {
            // Filtra receitas confirmadas deste profissional no período selecionado
            const profSales = filteredTransactions.filter(t => 
                (t.type === 'income' || t.type === 'receita') && 
                String(t.professional_id) === String(prof.id) &&
                t.status === 'paid'
            );

            // Soma do bruto (valor nominal dos serviços)
            const grossProduction = profSales.reduce((acc, t) => acc + Number(t.amount || 0), 0);
            
            // Cálculo da comissão (Líquido para o profissional)
            const rate = Number(prof.commission_rate || 0);
            const netCommission = grossProduction * (rate / 100);

            return {
                ...prof,
                grossProduction,
                netCommission,
                salesCount: profSales.length,
                rate
            };
        }).sort((a, b) => b.grossProduction - a.grossProduction);
    }, [professionals, filteredTransactions]);

    const chartData = useMemo(() => {
        const expenseByCategory: Record<string, number> = {};
        filteredTransactions
            .filter(t => t.type === 'expense' || t.type === 'despesa')
            .forEach(t => {
                const cat = t.category || 'Outros';
                expenseByCategory[cat] = (expenseByCategory[cat] || 0) + (Number(t.amount) || 0);
            });

        return Object.entries(expenseByCategory).map(([name, value]) => ({ name, receita: value }));
    }, [filteredTransactions]);

    // --- Handlers ---
    const handleAddTransaction = async (transaction: any) => {
        await fetchData();
        onAddTransaction(transaction); 
        setShowModal(null);
    };

    const handleDeleteTransaction = async (id: number) => {
        if (!window.confirm("Deseja realmente excluir este lançamento financeiro? Esta ação afetará o seu saldo imediatamente.")) return;

        try {
            const { error } = await supabase
                .from('financial_transactions')
                .delete()
                .eq('id', id);

            if (error) throw error;

            setDbTransactions(prev => prev.filter(t => t.id !== id));
            setToast({ message: "Lançamento removido com sucesso.", type: 'info' });
        } catch (err: any) {
            console.error("Erro ao excluir transação:", err);
            setToast({ message: "Falha ao excluir o lançamento do banco de dados.", type: 'error' });
        }
    };

    const handleNavigateDate = (direction: number) => {
        const newDate = new Date(currentDate);
        if (viewMode === 'daily') newDate.setDate(newDate.getDate() + direction);
        else if (viewMode === 'weekly') newDate.setDate(newDate.getDate() + (direction * 7));
        else if (viewMode === 'monthly') newDate.setMonth(newDate.getMonth() + direction);
        setCurrentDate(newDate);
    };

    if (loading && dbTransactions.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50">
                <Loader2 className="animate-spin text-orange-500 mb-4" size={48} />
                <p className="text-xs font-black uppercase tracking-widest animate-pulse">Auditando Fluxo de Caixa...</p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-slate-50 overflow-hidden font-sans text-left">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* Header */}
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col lg:flex-row justify-between items-center gap-4 flex-shrink-0 z-30 shadow-sm">
                <div>
                    <h1 className="text-xl md:text-2xl font-black text-slate-800 flex items-center gap-2">
                        <Wallet className="text-orange-500" />
                        Fluxo de Caixa
                    </h1>
                    <div className="flex items-center gap-3 mt-1">
                        <div className="flex items-center gap-1">
                            <button onClick={() => handleNavigateDate(-1)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400"><ChevronLeft size={16}/></button>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest min-w-[120px] text-center">
                                {viewMode === 'daily' && format(currentDate, "dd 'de' MMMM", { locale: pt })}
                                {viewMode === 'weekly' && `Semana ${format(currentDate, "dd/MM")}`}
                                {viewMode === 'monthly' && format(currentDate, "MMMM 'de' yyyy", { locale: pt })}
                            </span>
                            <button onClick={() => handleNavigateDate(1)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400"><ChevronRight size={16}/></button>
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center gap-4 w-full lg:w-auto">
                    <div className="flex flex-1 items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                        {(['daily', 'weekly', 'monthly'] as const).map((mode) => (
                            <button 
                                key={mode}
                                onClick={() => setViewMode(mode)}
                                className={`flex-1 px-4 py-2 text-[10px] font-black uppercase tracking-tighter rounded-lg transition-all ${viewMode === mode ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500 hover:text-slate-800'}`}
                            >
                                {mode === 'daily' ? 'Dia' : mode === 'weekly' ? 'Semana' : 'Mês'}
                            </button>
                        ))}
                    </div>

                    <div className="flex gap-2">
                        <button onClick={() => setShowModal('receita')} className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-emerald-100 transition-all active:scale-95">
                            <Plus size={16} strokeWidth={3}/> Receita
                        </button>
                        <button onClick={() => setShowModal('despesa')} className="bg-rose-50 hover:bg-rose-600 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-rose-100 transition-all active:scale-95">
                            <Plus size={16} strokeWidth={3}/> Despesa
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 custom-scrollbar">
                
                {/* KPI Cards Reais */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
                        <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Saldo Líquido</p>
                        <h3 className={`text-2xl font-black tracking-tighter ${metrics.balance >= 0 ? 'text-slate-800' : 'text-rose-600'}`}>
                            {formatBRL(metrics.balance)}
                        </h3>
                    </div>
                    <div className="bg-white p-6 rounded-[32px] border border-emerald-50 bg-emerald-50/20 shadow-sm relative overflow-hidden group">
                        <div className="relative z-10">
                            <p className="text-emerald-600/70 text-[10px] font-black uppercase tracking-widest mb-1">Total Receitas</p>
                            <h3 className="text-2xl font-black text-emerald-600 tracking-tighter">{formatBRL(metrics.income)}</h3>
                        </div>
                        <ArrowUpCircle className="absolute -right-2 -bottom-2 text-emerald-500/10 group-hover:scale-110 transition-transform" size={80}/>
                    </div>
                    <div className="bg-white p-6 rounded-[32px] border border-rose-50 bg-rose-50/20 shadow-sm relative overflow-hidden group">
                        <div className="relative z-10">
                            <p className="text-rose-600/70 text-[10px] font-black uppercase tracking-widest mb-1">Total Despesas</p>
                            <h3 className="text-2xl font-black text-rose-600 tracking-tighter">{formatBRL(metrics.expense)}</h3>
                        </div>
                        <ArrowDownCircle className="absolute -right-2 -bottom-2 text-rose-500/10 group-hover:scale-110 transition-transform" size={80}/>
                    </div>
                    <div className="bg-slate-900 p-6 rounded-[32px] text-white shadow-xl shadow-slate-200 flex flex-col justify-center">
                        <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Operações</p>
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-black text-orange-400">{filteredTransactions.length}</h3>
                            <div className="flex items-center gap-1 text-[9px] font-bold text-slate-500 uppercase">
                                <TrendingUp size={12} className="text-emerald-400" /> {((metrics.income / (metrics.expense || 1)) * 100).toFixed(0)}% ROI
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs Navigation */}
                <div className="flex border-b border-slate-200 overflow-x-auto scrollbar-hide">
                    <button onClick={() => setActiveTab('visao_geral')} className={`px-6 pb-4 text-xs font-black uppercase tracking-widest transition-all border-b-4 whitespace-nowrap ${activeTab === 'visao_geral' ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                        Gráficos e Insights
                    </button>
                    <button onClick={() => setActiveTab('extrato')} className={`px-6 pb-4 text-xs font-black uppercase tracking-widest transition-all border-b-4 whitespace-nowrap ${activeTab === 'extrato' ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                        Extrato Detalhado
                    </button>
                    <button onClick={() => setActiveTab('comissoes')} className={`px-6 pb-4 text-xs font-black uppercase tracking-widest transition-all border-b-4 whitespace-nowrap ${activeTab === 'comissoes' ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                        Comissões & Equipe
                    </button>
                </div>

                {/* TAB CONTENT */}

                {activeTab === 'visao_geral' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-500">
                        <Card title="Comparativo Faturamento" className="rounded-[40px]">
                            <div className="h-72 flex items-end justify-center gap-12 lg:gap-24 pb-8">
                                <div className="flex flex-col items-center gap-4 w-full max-w-[120px]">
                                    <div className="w-full bg-emerald-500 rounded-2xl transition-all duration-700 shadow-lg shadow-emerald-50 relative group" style={{ height: `${Math.max(10, Math.min(100, (metrics.income / Math.max(metrics.income, metrics.expense, 1)) * 100))}%` }}>
                                        <div className="absolute -top-8 w-full text-center font-black text-emerald-600 text-xs">{formatBRL(metrics.income)}</div>
                                    </div>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Entradas</span>
                                </div>
                                <div className="flex flex-col items-center gap-4 w-full max-w-[120px]">
                                    <div className="w-full bg-rose-500 rounded-2xl transition-all duration-700 shadow-lg shadow-rose relative group" style={{ height: `${Math.max(10, Math.min(100, (metrics.expense / Math.max(metrics.income, metrics.expense, 1)) * 100))}%` }}>
                                        <div className="absolute -top-8 w-full text-center font-black text-rose-600 text-xs">{formatBRL(metrics.expense)}</div>
                                    </div>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Saídas</span>
                                </div>
                            </div>
                        </Card>
                        
                        <Card title="Origem dos Gastos" className="rounded-[40px]">
                            <div className="h-72 flex items-center justify-center">
                                {chartData.length > 0 ? (
                                    <SafePie 
                                        data={chartData}
                                        colors={['#f87171', '#fb923c', '#facc15', '#a78bfa', '#60a5fa', '#10b981']}
                                    />
                                ) : (
                                    <div className="text-center text-slate-300">
                                        <AlertTriangle size={32} className="mx-auto mb-2 opacity-20" />
                                        <p className="text-[10px] font-black uppercase tracking-widest">Sem despesas no período</p>
                                    </div>
                                )}
                            </div>
                        </Card>

                        {/* JaciBot Strategic Box */}
                        <div className="lg:col-span-2 bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-[40px] p-8 text-white shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-12 opacity-10">
                                <TrendingUp size={140} />
                            </div>
                            <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                                <div className="p-4 bg-white/10 backdrop-blur-md rounded-3xl border border-white/20">
                                    <TrendingUp size={32} className="text-orange-400" />
                                </div>
                                <div className="text-center md:text-left flex-1">
                                    <h4 className="text-lg font-black uppercase tracking-widest text-indigo-200">Insight Estratégico</h4>
                                    <p className="text-base font-medium leading-relaxed mt-2 italic opacity-90">
                                        "Analisando seus dados reais, notei que {metrics.income > metrics.expense ? 'seu estúdio está operando no azul este mês!' : 'atenção: suas despesas superaram a receita no período selecionado.'} {metrics.balance > 2000 ? 'Considere investir em marketing para os horários de baixa ocupação.' : 'Revise seus custos fixos para melhorar sua margem de lucro.'}"
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'extrato' && (
                    <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50/50 border-b border-slate-100 text-slate-400 uppercase text-[10px] font-black tracking-widest">
                                    <tr>
                                        <th className="px-8 py-5">Lançamento</th>
                                        <th className="px-8 py-5">Categoria</th>
                                        <th className="px-8 py-5">Método</th>
                                        <th className="px-8 py-5 text-right">Valor Final</th>
                                        <th className="px-8 py-5 text-center">Status</th>
                                        <th className="px-8 py-5 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {filteredTransactions.map(t => (
                                        <tr key={t.id} className="hover:bg-slate-50/50 group transition-colors">
                                            <td className="px-8 py-4">
                                                <p className="font-black text-slate-800 group-hover:text-orange-600 transition-colors">{t.description}</p>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mt-0.5">{format(parseISO(t.date), 'dd MMM yyyy • HH:mm', { locale: pt })}</p>
                                            </td>
                                            <td className="px-8 py-4">
                                                <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${t.type === 'income' || t.type === 'receita' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                                                    {t.category || 'Geral'}
                                                </span>
                                            </td>
                                            <td className="px-8 py-4">
                                                <span className="text-xs font-bold text-slate-500 uppercase">{t.payment_method?.replace('_', ' ') || '---'}</span>
                                            </td>
                                            <td className={`px-8 py-4 text-right font-black text-base tracking-tighter ${t.type === 'income' || t.type === 'receita' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {t.type === 'expense' || t.type === 'despesa' ? '- ' : '+ '}
                                                {formatBRL(Number(t.amount))}
                                            </td>
                                            <td className="px-8 py-4 text-center">
                                                {t.status === 'paid' || t.status === 'pago' ? (
                                                    <div className="flex items-center justify-center gap-1.5 text-emerald-500 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100 w-fit mx-auto">
                                                        <CheckCircle size={12}/> <span className="text-[9px] font-black uppercase">Liquidado</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center justify-center gap-1.5 text-amber-500 bg-amber-50 px-2 py-1 rounded-lg border border-amber-100 w-fit mx-auto">
                                                        <Clock size={12}/> <span className="text-[9px] font-black uppercase">Pendente</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-8 py-4 text-right">
                                                <button 
                                                    onClick={() => handleDeleteTransaction(t.id)}
                                                    className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all active:scale-90"
                                                    title="Excluir Lançamento"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredTransactions.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="px-8 py-20 text-center flex flex-col items-center">
                                                <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center mb-4 text-slate-300">
                                                    <FileText size={32} />
                                                </div>
                                                <h4 className="font-black text-slate-700">Nenhuma movimentação</h4>
                                                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Realize vendas no PDV para ver o extrato.</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'comissoes' && (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        {/* Summary Header for Commissions */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {commissionStats.map(prof => (
                                <div key={prof.id} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col group hover:shadow-xl transition-all relative overflow-hidden">
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="w-14 h-14 rounded-[20px] bg-slate-100 overflow-hidden border-2 border-white shadow-md flex-shrink-0">
                                            {prof.photo_url ? (
                                                <img src={prof.photo_url} alt={prof.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-slate-300 font-black text-xl">
                                                    {prof.name.charAt(0)}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-black text-slate-800 truncate leading-tight">{prof.name}</h3>
                                            <div className="flex items-center gap-1.5 mt-1">
                                                <span className="text-[9px] font-black bg-orange-50 text-orange-600 px-2 py-0.5 rounded border border-orange-100 uppercase tracking-widest">
                                                    {prof.rate}% Comissão
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50">
                                        <div>
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Produção Bruta</p>
                                            <p className="text-sm font-bold text-slate-600">{formatBRL(prof.grossProduction)}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[9px] font-black text-orange-500 uppercase tracking-widest">Repasse Líquido</p>
                                            <p className="text-lg font-black text-slate-800">{formatBRL(prof.netCommission)}</p>
                                        </div>
                                    </div>

                                    <div className="mt-4 flex items-center justify-between">
                                        <span className="text-[9px] font-black text-slate-300 uppercase italic">
                                            {prof.salesCount} serviços no período
                                        </span>
                                        <button className="p-2 bg-slate-50 text-slate-400 hover:text-orange-500 hover:bg-orange-50 rounded-xl transition-all">
                                            <ChevronRight size={18} />
                                        </button>
                                    </div>
                                    
                                    <div className="absolute -right-4 -bottom-4 opacity-5 pointer-events-none group-hover:scale-110 transition-transform">
                                        <Percent size={120} />
                                    </div>
                                </div>
                            ))}
                        </div>

                        {commissionStats.length === 0 && (
                            <div className="p-20 text-center flex flex-col items-center bg-white rounded-[40px] border-2 border-dashed border-slate-100">
                                <User size={48} className="text-slate-100 mb-4" />
                                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Nenhum profissional com vendas no período selecionado.</p>
                            </div>
                        )}
                    </div>
                )}

            </div>
            
            {/* Modal de Transação */}
            {showModal && (
                <NewTransactionModal 
                    type={showModal} 
                    onClose={() => setShowModal(null)} 
                    onSave={handleAddTransaction}
                />
            )}

            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes spin-slow {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .animate-spin-slow {
                    animation: spin-slow 8s linear infinite;
                }
            `}} />
        </div>
    );
};

export default FinanceiroView;

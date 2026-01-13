
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
    ArrowUpCircle, ArrowDownCircle, Wallet, TrendingUp, AlertTriangle, 
    CheckCircle, Plus, Loader2, Calendar, Search, Filter, Download,
    RefreshCw, ChevronLeft, ChevronRight, FileText, Clock, User,
    // FIX: Added missing icons History, Smartphone, and CreditCard to fix "Cannot find name" errors.
    Coins, Banknote, Percent, Trash2, BarChart3, PieChart, ArrowUpRight,
    ArrowDownRight, Landmark, History, Smartphone, CreditCard
} from 'lucide-react';
import { 
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
    CartesianGrid, Tooltip, Legend 
} from 'recharts';
import Card from '../shared/Card';
import NewTransactionModal from '../modals/NewTransactionModal';
import { FinancialTransaction, TransactionType } from '../../types';
import { supabase } from '../../services/supabaseClient';
import { useStudio } from '../../contexts/StudioContext';
import { 
    format, isSameDay, isSameMonth, 
    endOfDay, endOfMonth, startOfMonth,
    eachDayOfInterval, addDays, subDays
} from 'date-fns';
import { ptBR as pt } from 'date-fns/locale/pt-BR';
import Toast, { ToastType } from '../shared/Toast';

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

const FinanceiroView: React.FC = () => {
    const { activeStudioId } = useStudio();
    const [dbTransactions, setDbTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [filterPeriod, setFilterPeriod] = useState<'hoje' | 'mes' | 'custom'>('mes');
    const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState<TransactionType | null>(null);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    // --- FETCH DE DADOS ---
    const fetchData = useCallback(async () => {
        if (!activeStudioId) return;
        setLoading(true);
        try {
            let start, end;
            if (filterPeriod === 'hoje') {
                start = new Date(); start.setHours(0,0,0,0);
                end = endOfDay(new Date());
            } else if (filterPeriod === 'mes') {
                start = startOfMonth(currentDate);
                end = endOfMonth(currentDate);
            } else {
                // Custom period logic could go here
                start = startOfMonth(currentDate);
                end = endOfMonth(currentDate);
            }

            const { data, error } = await supabase
                .from('financial_transactions')
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
    }, [activeStudioId, currentDate, filterPeriod]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // --- CÁLCULOS DE BUSINESS INTELLIGENCE ---
    const bi = useMemo(() => {
        const filtered = dbTransactions.filter(t => {
            const matchSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase());
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

        const categories = Array.from(new Set(dbTransactions.map(t => t.category))).filter(Boolean);

        // Dados para o gráfico temporal
        const daysInPeriod = eachDayOfInterval({
            start: startOfMonth(currentDate),
            end: endOfMonth(currentDate)
        });

        const chartData = daysInPeriod.map(day => {
            const dayStr = format(day, 'yyyy-MM-dd');
            const dayTrans = dbTransactions.filter(t => format(new Date(t.date), 'yyyy-MM-dd') === dayStr);
            return {
                name: format(day, 'dd'),
                receita: dayTrans.filter(t => t.type === 'income' || t.type === 'receita').reduce((acc, t) => acc + Number(t.amount || 0), 0),
                despesa: dayTrans.filter(t => t.type === 'expense' || t.type === 'despesa').reduce((acc, t) => acc + Number(t.amount || 0), 0)
            };
        });

        return { 
            filtered, 
            grossRevenue, 
            netRevenue, 
            totalExpenses, 
            balance: netRevenue - totalExpenses,
            categories,
            chartData
        };
    }, [dbTransactions, searchTerm, selectedCategory, currentDate]);

    const handleDelete = async (id: number) => {
        if (!confirm("Deseja estornar esta transação?")) return;
        try {
            const { error } = await supabase.from('financial_transactions').delete().eq('id', id);
            if (error) throw error;
            setToast({ message: "Transação estornada.", type: 'info' });
            fetchData();
        } catch (e) {
            setToast({ message: "Erro ao excluir.", type: 'error' });
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
                    <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                        <button 
                            onClick={() => setFilterPeriod('hoje')}
                            className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${filterPeriod === 'hoje' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500'}`}
                        >Hoje</button>
                        <button 
                            onClick={() => setFilterPeriod('mes')}
                            className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${filterPeriod === 'mes' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500'}`}
                        >Mês</button>
                    </div>
                    <button onClick={() => setShowModal('receita')} className="bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-100 active:scale-95 transition-all">Lançar Entrada</button>
                    <button onClick={() => setShowModal('despesa')} className="bg-rose-500 text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-rose-100 active:scale-95 transition-all">Lançar Saída</button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 custom-scrollbar">
                
                {/* GRID DE MÉTRICAS */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard 
                        title="Saldo em Conta (Líquido)" 
                        value={formatBRL(bi.balance)} 
                        icon={Wallet} 
                        colorClass="bg-slate-800" 
                        subtext="Bruto - Taxas - Despesas"
                    />
                    <StatCard 
                        title="Faturamento Bruto" 
                        value={formatBRL(bi.grossRevenue)} 
                        icon={TrendingUp} 
                        colorClass="bg-blue-600" 
                        subtext="Valor total das vendas"
                    />
                    <StatCard 
                        title="Faturamento Líquido" 
                        value={formatBRL(bi.netRevenue)} 
                        icon={CheckCircle} 
                        colorClass="bg-emerald-600" 
                        subtext="Após taxas de cartão/app"
                    />
                    <StatCard 
                        title="Despesas Totais" 
                        value={formatBRL(bi.totalExpenses)} 
                        icon={ArrowDownCircle} 
                        colorClass="bg-rose-600" 
                        subtext="Gastos operacionais e fixos"
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* GRÁFICO DE DESEMPENHO */}
                    <Card title="Evolução Mensal" className="lg:col-span-2 rounded-[32px] overflow-hidden" icon={<BarChart3 size={18} className="text-orange-500" />}>
                        <div className="h-72 mt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={bi.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorRec" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                        </linearGradient>
                                        <linearGradient id="colorDes" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1}/>
                                            <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                                    <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                                    <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{paddingBottom: '20px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase'}} />
                                    <Area type="monotone" dataKey="receita" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRec)" name="Entradas" />
                                    <Area type="monotone" dataKey="despesa" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#colorDes)" name="Saídas" strokeDasharray="5 5" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>

                    {/* SELETOR DE MÊS / FILTROS */}
                    <div className="space-y-6">
                        <Card title="Calendário" icon={<Calendar size={18} className="text-orange-500" />}>
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                    <button onClick={() => setCurrentDate(subDays(currentDate, 30))} className="p-2 hover:bg-white rounded-xl text-slate-400 hover:text-orange-500 transition-all"><ChevronLeft size={20}/></button>
                                    <div className="text-center">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mês de Referência</p>
                                        <p className="font-black text-slate-800 capitalize">{format(currentDate, 'MMMM yyyy', { locale: pt })}</p>
                                    </div>
                                    <button onClick={() => setCurrentDate(addDays(currentDate, 30))} className="p-2 hover:bg-white rounded-xl text-slate-400 hover:text-orange-500 transition-all"><ChevronRight size={20}/></button>
                                </div>
                                <button 
                                    onClick={() => { setCurrentDate(new Date()); setFilterPeriod('hoje'); }}
                                    className="w-full py-3 bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all"
                                >Ir para Hoje</button>
                            </div>
                        </Card>

                        <Card title="Exportação" icon={<Download size={18} className="text-orange-500" />}>
                            <p className="text-[10px] text-slate-400 font-bold uppercase mb-4">Relatórios para contabilidade</p>
                            <div className="grid grid-cols-2 gap-3">
                                <button className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-orange-200 transition-all group">
                                    <FileText size={20} className="text-slate-400 group-hover:text-orange-500 mb-2" />
                                    <span className="text-[9px] font-black uppercase">PDF</span>
                                </button>
                                <button className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-orange-200 transition-all group">
                                    <Landmark size={20} className="text-slate-400 group-hover:text-orange-500 mb-2" />
                                    <span className="text-[9px] font-black uppercase">Excel</span>
                                </button>
                            </div>
                        </Card>
                    </div>
                </div>

                {/* LISTAGEM DE TRANSAÇÕES COM FILTROS */}
                <Card className="rounded-[40px] border-slate-200 shadow-xl overflow-hidden">
                    <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                        <div className="flex items-center gap-3">
                            <History className="text-orange-500" size={24} />
                            <h2 className="text-lg font-black text-slate-800 uppercase tracking-tighter">Extrato de Movimentação</h2>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                            <div className="relative flex-1 md:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                                <input 
                                    type="text" 
                                    placeholder="Pesquisar extrato..." 
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
                                <option value="Todas">Todas Categorias</option>
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
                                    <tr><td colSpan={5} className="p-20 text-center text-slate-400 font-bold uppercase text-xs">Nenhum lançamento encontrado.</td></tr>
                                ) : (
                                    bi.filtered.map(t => (
                                        <tr key={t.id} className="hover:bg-slate-50/80 transition-colors group">
                                            <td className="px-8 py-5">
                                                <p className="text-xs font-bold text-slate-700">{format(new Date(t.date), 'dd/MM/yy')}</p>
                                                <p className="text-[10px] text-slate-400 font-medium">{format(new Date(t.date), 'HH:mm')}</p>
                                            </td>
                                            <td className="px-8 py-5">
                                                <p className="text-sm font-black text-slate-700 group-hover:text-orange-600 transition-colors">{t.description}</p>
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
                    onSave={() => { fetchData(); setShowModal(null); }} 
                />
            )}
        </div>
    );
};

export default FinanceiroView;

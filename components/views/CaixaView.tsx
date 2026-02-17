
import React, { useState, useMemo, useEffect } from 'react';
import { 
    Archive, Lock, Unlock, ArrowUpCircle, ArrowDownCircle, 
    DollarSign, AlertTriangle, Calculator, Calendar, History,
    X, Receipt, User, ArrowRight, Loader2
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { useStudio } from '../../contexts/StudioContext';
import Card from '../shared/Card';
import { format } from 'date-fns';
import { ptBR as pt } from 'date-fns/locale/pt-BR';
import Toast, { ToastType } from '../shared/Toast';

const StatCard = ({ title, value, icon: Icon, colorClass, textColor }: any) => (
    <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-md transition-all">
        <div>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">{title}</p>
            <p className={`text-xl font-black mt-1 ${textColor}`}>{value}</p>
        </div>
        <div className={`p-3 rounded-2xl ${colorClass} shadow-lg text-white`}>
            <Icon size={18} />
        </div>
    </div>
);

const CaixaView: React.FC = () => {
    const { activeStudioId } = useStudio();
    const [sessionStatus, setSessionStatus] = useState<'aberto' | 'fechado'>('aberto');
    const [movements, setMovements] = useState<any[]>([]);
    const [sales, setSales] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    const fetchData = async () => {
        if (!activeStudioId) return;
        setLoading(true);
        try {
            const today = new Date();
            const startStr = new Date(today.setHours(0,0,0,0)).toISOString();
            const endStr = new Date(today.setHours(23,59,59,999)).toISOString();

            // Busca transações financeiras do dia
            const { data: trans } = await supabase
                .from('financial_transactions')
                .select('*, clients:client_id(nome)')
                .eq('studio_id', activeStudioId)
                .gte('date', startStr)
                .lte('date', endStr)
                .order('date', { ascending: false });
            
            setMovements(trans || []);
            // Filtra apenas vendas para conferência de liquidação (Maria/Zaneide)
            setSales(trans?.filter(t => t.type === 'income' || t.type === 'receita') || []);

        } catch (e) {
            setToast({ message: "Erro ao sincronizar caixa", type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [activeStudioId]);

    const totals = useMemo(() => {
        const entradas = movements.filter(m => m.type === 'income' || m.type === 'receita').reduce((acc, m) => acc + Number(m.amount), 0);
        const saidas = movements.filter(m => m.type === 'expense' || m.type === 'despesa').reduce((acc, m) => acc + Number(m.amount), 0);
        return { entradas, saidas, saldo: entradas - saidas };
    }, [movements]);

    return (
        <div className="h-full flex flex-col bg-slate-50 font-sans text-left overflow-hidden">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4 z-30 shadow-sm flex-shrink-0">
                <div>
                    <h1 className="text-xl font-black text-slate-800 flex items-center gap-2 uppercase tracking-tighter">
                        <Archive className="text-purple-500" /> Controle de Caixa
                    </h1>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">
                        <Calendar size={12}/>
                        <span>{format(new Date(), "dd 'de' MMMM, yyyy", { locale: pt })}</span>
                        <span className="text-slate-200">•</span>
                        <span className={`font-black ${sessionStatus === 'aberto' ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {sessionStatus === 'aberto' ? 'CAIXA OPERANTE' : 'CAIXA ENCERRADO'}
                        </span>
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard title="Total em Gaveta (Saldo)" value={`R$ ${totals.saldo.toFixed(2)}`} icon={Calculator} colorClass="bg-slate-800" textColor="text-slate-800" />
                    <StatCard title="Recebimentos" value={`+ R$ ${totals.entradas.toFixed(2)}`} icon={DollarSign} colorClass="bg-emerald-500" textColor="text-emerald-600" />
                    <StatCard title="Sangrias / Saídas" value={`- R$ ${totals.saidas.toFixed(2)}`} icon={ArrowDownCircle} colorClass="bg-rose-500" textColor="text-rose-600" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Lista Detalhada de Vendas para conferência da Maria/Zaneide */}
                    <Card title="Vendas do Turno (Conferência)" icon={<Receipt size={18} className="text-emerald-500" />}>
                        <div className="space-y-4 mt-2">
                            {loading ? (
                                <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-orange-500" /></div>
                            ) : sales.length === 0 ? (
                                <div className="py-20 text-center text-slate-400 italic font-bold text-[10px] uppercase">Sem vendas registradas hoje</div>
                            ) : (
                                sales.map((sale) => (
                                    <div key={sale.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between hover:border-emerald-300 transition-all group">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-emerald-500 transition-colors">
                                                <User size={20} />
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-700 text-sm uppercase tracking-tight">{sale.clients?.nome || 'Consumidor Final'}</p>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{format(new Date(sale.date), 'HH:mm')} • {sale.payment_method}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-black text-slate-800">R$ {Number(sale.amount).toFixed(2)}</p>
                                            <span className="text-[8px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-black uppercase">Liquidado</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </Card>

                    {/* Todos os movimentos (Suprimentos/Sangrias) */}
                    <Card title="Fluxo Analítico Completo" icon={<History size={18} className="text-orange-500" />}>
                        <div className="divide-y divide-slate-50">
                            {movements.map((m) => (
                                <div key={m.id} className="py-3 flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-slate-700 truncate max-w-[200px]">{m.description}</span>
                                        <span className="text-[9px] text-slate-400 font-bold uppercase">{format(new Date(m.date), 'HH:mm')}</span>
                                    </div>
                                    <span className={`text-xs font-black ${m.type === 'income' || m.type === 'receita' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                        {m.type === 'income' || m.type === 'receita' ? '+' : '-'} R$ {Number(m.amount).toFixed(2)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default CaixaView;

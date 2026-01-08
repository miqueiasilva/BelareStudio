
import React, { useState, useEffect, useMemo } from 'react';
import { 
    ChevronLeft, CreditCard, Smartphone, Banknote, 
    Trash2, Plus, ArrowRight, Loader2, CheckCircle,
    User, Phone, Scissors, ShoppingBag, Receipt,
    FileText, Tag, DollarSign, Percent, AlertCircle,
    Calendar, ShoppingCart, Info, X, Coins, UserCheck,
    PlusCircle
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { Command, CommandItem, PaymentMethod } from '../../types';
import Toast, { ToastType } from '../shared/Toast';

interface CommandDetailViewProps {
    commandId: string;
    onBack: () => void;
}

interface PaymentEntry {
    id: string;
    method: PaymentMethod;
    amount: number;
}

const CommandDetailView: React.FC<CommandDetailViewProps> = ({ commandId, onBack }) => {
    const { user } = useAuth();
    const [command, setCommand] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [isFinishing, setIsFinishing] = useState(false);
    const [addedPayments, setAddedPayments] = useState<PaymentEntry[]>([]);
    const [amountInput, setAmountInput] = useState<string>('0');
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    const fetchCommand = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('commands')
                .select(`
                    *, 
                    clients:client_id(id, nome, name, whatsapp), 
                    command_items(*, team_members:professional_id(id, name, commission_rate))
                `)
                .eq('id', commandId)
                .single();

            if (error) throw error;
            setCommand(data);
            
            const total = data.command_items.reduce((acc: number, i: any) => acc + (Number(i.price) * Number(i.quantity)), 0);
            setAmountInput(total.toString());
        } catch (e: any) {
            setToast({ message: "Erro ao carregar dados da comanda.", type: 'error' });
            setTimeout(onBack, 2000);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (commandId) fetchCommand();
    }, [commandId]);

    const totals = useMemo(() => {
        if (!command) return { total: 0, paid: 0, remaining: 0 };
        const total = command.command_items.reduce((acc: number, i: any) => acc + (Number(i.price) * Number(i.quantity)), 0);
        const paid = addedPayments.reduce((acc, p) => acc + p.amount, 0);
        const remaining = Math.max(0, total - paid);
        return { total, paid, remaining };
    }, [command, addedPayments]);

    const handleAddPayment = (method: PaymentMethod) => {
        const val = parseFloat(amountInput);
        if (isNaN(val) || val <= 0) return setToast({ message: "Informe um valor válido.", type: 'error' });
        if (val > totals.remaining + 0.01) return setToast({ message: "Valor superior ao saldo.", type: 'error' });

        setAddedPayments([...addedPayments, { id: Math.random().toString(36).substr(2, 9), method, amount: val }]);
        setAmountInput((totals.remaining - val).toFixed(2));
    };

    // FUNÇÃO CORRIGIDA: Agora aguarda o banco e valida usuário
    const handleFinishPayment = async () => {
        if (!command || isFinishing) return;
        
        // GUARD CLAUSE: Proteção contra Comissões Zeradas
        if (!user?.id) {
            setToast({ message: "Sessão inválida. Reinicie o sistema.", type: 'error' });
            return;
        }

        if (totals.remaining > 0.01) {
            setToast({ message: "Valor total não atingido.", type: 'error' });
            return;
        }

        setIsFinishing(true);
        try {
            // Registra as transações vinculadas aos profissionais dos itens para comissão
            // Percorre os pagamentos realizados
            for (const payment of addedPayments) {
                // Para garantir o vínculo de comissão, usamos o professional_id do primeiro item da comanda
                // como referência principal, ou o profissional vinculado ao item específico se houver.
                const { error: tError } = await supabase.from('financial_transactions').insert([{
                    description: `Checkout Comanda #${command.id.substring(0,8).toUpperCase()}`,
                    amount: payment.amount,
                    type: 'income',
                    category: 'servico',
                    payment_method: payment.method,
                    client_id: command.client_id,
                    professional_id: command.command_items[0]?.professional_id, // Vínculo para Remunerações
                    created_by: user.id,
                    status: 'paid',
                    date: new Date().toISOString()
                }]);
                if (tError) throw tError;
            }

            const { error: cmdError } = await supabase.from('commands')
                .update({ status: 'paid', closed_at: new Date().toISOString(), total_amount: totals.total })
                .eq('id', command.id);
            
            if (cmdError) throw cmdError;

            setToast({ message: "Checkout finalizado com sucesso!", type: 'success' });
            setTimeout(onBack, 1000);
        } catch (e: any) {
            console.error("[FATAL_CHECKOUT_ERROR]", e);
            setToast({ message: "Erro de conexão com o banco.", type: 'error' });
        } finally {
            setIsFinishing(false);
        }
    };

    if (loading) return <div className="h-full flex items-center justify-center text-slate-400 font-black uppercase text-[10px] tracking-widest"><Loader2 className="animate-spin text-orange-500 mr-2" /> Validando Integridade...</div>;
    if (!command) return null;

    const clientDisplayName = command.clients?.nome || command.clients?.name || 'Cliente Não Identificado';

    return (
        <div className="h-full flex flex-col bg-slate-50 font-sans text-left overflow-hidden">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center z-20 shadow-sm">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400"><ChevronLeft size={24} /></button>
                    <h1 className="text-xl font-black text-slate-800 tracking-tighter">FECHAMENTO <span className="text-orange-500">#{command.id.substring(0,8).toUpperCase()}</span></h1>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
                <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm flex items-center gap-6">
                            <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center font-black text-xl">{clientDisplayName.charAt(0)}</div>
                            <div>
                                <h3 className="text-2xl font-black text-slate-800">{clientDisplayName}</h3>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 mt-1"><Phone size={14} className="text-orange-500" /> {command.clients?.whatsapp || 'Sem telefone'}</p>
                            </div>
                        </div>

                        <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center"><h4 className="font-black text-slate-800 text-sm uppercase tracking-widest">Resumo de Consumo</h4></div>
                            <div className="divide-y divide-slate-50">
                                {command.command_items.map((item: any) => (
                                    <div key={item.id} className="p-6 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 rounded-2xl bg-slate-50 text-slate-400">{item.product_id ? <ShoppingBag size={20} /> : <Scissors size={20} />}</div>
                                            <div>
                                                <p className="font-black text-slate-800 leading-tight">{item.title}</p>
                                                <p className="text-[10px] font-black uppercase text-slate-400 mt-1">Feito por: <span className="text-orange-600">{item.team_members?.name || 'NÃO VINCULADO'}</span></p>
                                            </div>
                                        </div>
                                        <p className="font-black text-slate-800">R$ {Number(item.price).toFixed(2)}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-slate-900 rounded-[40px] p-8 text-white shadow-2xl relative overflow-hidden">
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">A Receber</p>
                            <h2 className={`text-4xl font-black tracking-tighter ${totals.remaining <= 0.01 ? 'text-emerald-400' : 'text-white'}`}>R$ {totals.remaining.toFixed(2)}</h2>
                            <p className="text-[10px] font-bold text-white/40 mt-4 uppercase">Total da Venda: R$ {totals.total.toFixed(2)}</p>
                        </div>

                        {totals.remaining > 0.01 && (
                            <div className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm space-y-4">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Lançar Pagamento Parcial</label>
                                <input type="number" value={amountInput} onChange={(e) => setAmountInput(e.target.value)} className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-xl text-slate-800 outline-none focus:ring-4 focus:ring-orange-100 transition-all" />
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={() => handleAddPayment('pix')} className="flex flex-col items-center gap-2 p-4 bg-slate-50 hover:bg-orange-50 border border-slate-100 rounded-2xl transition-all group">
                                        <Smartphone className="text-teal-600" />
                                        <span className="text-[10px] font-black uppercase text-slate-600">Pix</span>
                                    </button>
                                    <button onClick={() => handleAddPayment('cartao_credito')} className="flex flex-col items-center gap-2 p-4 bg-slate-50 hover:bg-orange-50 border border-slate-100 rounded-2xl transition-all group">
                                        <CreditCard className="text-blue-600" />
                                        <span className="text-[10px] font-black uppercase text-slate-600">Cartão</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {addedPayments.length > 0 && (
                            <div className="space-y-2">
                                {addedPayments.map(p => (
                                    <div key={p.id} className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                        <p className="text-xs font-black text-slate-700 uppercase">{p.method.replace('_', ' ')}: R$ {p.amount.toFixed(2)}</p>
                                        <button onClick={() => setAddedPayments(addedPayments.filter(x => x.id !== p.id))} className="text-rose-400 hover:text-rose-600"><X size={16}/></button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <button 
                            onClick={handleFinishPayment}
                            disabled={totals.remaining > 0.01 || isFinishing}
                            className={`w-full py-5 rounded-[28px] font-black text-white shadow-xl flex items-center justify-center gap-3 transition-all active:scale-95 ${totals.remaining <= 0.01 ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200' : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'}`}
                        >
                            {isFinishing ? <Loader2 className="animate-spin" /> : <><CheckCircle size={24}/> Confirmar Pagamento</>}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CommandDetailView;

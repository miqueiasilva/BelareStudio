
import React, { useState, useEffect, useMemo } from 'react';
import { 
    ChevronLeft, CreditCard, Smartphone, Banknote, 
    Trash2, Plus, ArrowRight, Loader2, CheckCircle,
    User, Phone, Scissors, ShoppingBag, Receipt,
    FileText, Tag, DollarSign, Percent, AlertCircle,
    Calendar, ShoppingCart, Info, X, Coins
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR as pt } from 'date-fns/locale/pt-BR';
import { supabase } from '../../services/supabaseClient';
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
    const [command, setCommand] = useState<Command | null>(null);
    const [loading, setLoading] = useState(true);
    const [isFinishing, setIsFinishing] = useState(false);
    
    // Pagamentos Mistos
    const [addedPayments, setAddedPayments] = useState<PaymentEntry[]>([]);
    const [activeMethod, setActiveMethod] = useState<PaymentMethod | null>(null);
    const [amountToPay, setAmountToPay] = useState<string>('0');
    
    const [discount, setDiscount] = useState<string>('0');
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    const fetchCommand = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('commands')
                .select('*, clients(*), command_items(*)')
                .eq('id', commandId)
                .single();

            if (error) throw error;
            setCommand(data);
        } catch (e: any) {
            setToast({ message: "Erro ao localizar comanda.", type: 'error' });
            setTimeout(onBack, 2000);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (commandId) fetchCommand();
    }, [commandId]);

    // --- CÁLCULOS DE TOTAIS ---
    const totals = useMemo(() => {
        if (!command) return { subtotal: 0, total: 0, paid: 0, remaining: 0 };
        
        const subtotal = command.command_items.reduce((acc, i) => acc + (Number(i.price) * Number(i.quantity)), 0);
        const discValue = parseFloat(discount) || 0;
        const totalAfterDiscount = Math.max(0, subtotal - discValue);
        
        const paid = addedPayments.reduce((acc, p) => acc + p.amount, 0);
        const remaining = Math.max(0, totalAfterDiscount - paid);

        return {
            subtotal,
            total: totalAfterDiscount,
            paid,
            remaining
        };
    }, [command, discount, addedPayments]);

    // --- HANDLERS DE PAGAMENTO ---
    const handleInitPayment = (method: PaymentMethod) => {
        setActiveMethod(method);
        setAmountToPay(totals.remaining.toFixed(2));
    };

    const handleConfirmPartialPayment = () => {
        if (!activeMethod || parseFloat(amountToPay) <= 0) return;

        const newPayment: PaymentEntry = {
            id: Math.random().toString(36).substring(2, 9),
            method: activeMethod,
            amount: parseFloat(amountToPay)
        };

        setAddedPayments(prev => [...prev, newPayment]);
        setActiveMethod(null);
        setAmountToPay('0');
    };

    const handleRemovePayment = (id: string) => {
        setAddedPayments(prev => prev.filter(p => p.id !== id));
    };

    const handleFinishPayment = async () => {
        if (!command || isFinishing || addedPayments.length === 0) return;
        setIsFinishing(true);

        const shortId = command.id.split('-')[0].toUpperCase();
        const clientName = command.clients?.nome || command.clients?.name || command.clients?.full_name || 'Cliente';

        try {
            // PASSO 1: SALVAR TRANSAÇÕES (FLUXO DE CAIXA)
            for (const payment of addedPayments) {
                const { error: finError } = await supabase.from('financial_transactions').insert([{
                    description: `Recebimento Comanda #${shortId} (${payment.method.toUpperCase()}) - ${clientName}`,
                    amount: payment.amount,
                    type: 'income',
                    category: 'servico',
                    payment_method: payment.method,
                    client_id: command.client_id,
                    date: new Date().toISOString(),
                    status: 'paid'
                    // Nota: se houver a coluna command_id na tabela transactions, ela deve ser vinculada aqui
                }]);
                
                if (finError) throw finError;
            }

            // PASSO 2: FECHAR A COMANDA (ATUALIZAÇÃO SIMPLES)
            // Definimos o payment_method da comanda como 'multiple' se houver mais de um método
            const finalMethodLabel = addedPayments.length > 1 ? 'multiple' : addedPayments[0].method;

            const { error: cmdError } = await supabase
                .from('commands')
                .update({ 
                    status: 'paid',
                    closed_at: new Date().toISOString(),
                    total_amount: totals.total,
                    payment_method: finalMethodLabel // Grava apenas o texto, corrigindo o erro 400
                })
                .eq('id', command.id);

            if (cmdError) throw cmdError;

            setToast({ message: "Comanda finalizada com sucesso! 💰", type: 'success' });
            setTimeout(onBack, 2000);
        } catch (e: any) {
            console.error("Erro no checkout:", e);
            setToast({ message: `Falha ao finalizar checkout: ${e.message}`, type: 'error' });
        } finally {
            setIsFinishing(false);
        }
    };

    if (loading) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50">
                <Loader2 className="animate-spin text-orange-500 mb-4" size={48} />
                <p className="text-xs font-black uppercase tracking-widest animate-pulse">Sincronizando Checkout...</p>
            </div>
        );
    }

    if (!command) return null;

    const clientName = command.clients?.nome || command.clients?.name || command.clients?.full_name || 'Cliente sem nome';
    const clientPhone = command.clients?.whatsapp || command.clients?.telefone || command.clients?.phone || 'Sem telefone';

    const paymentMethods = [
        { id: 'pix', label: 'Pix', icon: Smartphone, color: 'text-teal-600', bg: 'bg-teal-50' },
        { id: 'dinheiro', label: 'Dinheiro', icon: Banknote, color: 'text-green-600', bg: 'bg-green-50' },
        { id: 'cartao_credito', label: 'Crédito', icon: CreditCard, color: 'text-blue-600', bg: 'bg-blue-50' },
        { id: 'cartao_debito', label: 'Débito', icon: CreditCard, color: 'text-cyan-600', bg: 'bg-cyan-50' },
    ];

    return (
        <div className="h-full flex flex-col bg-slate-50 font-sans text-left overflow-hidden">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center z-20 shadow-sm flex-shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 transition-colors">
                        <ChevronLeft size={24} />
                    </button>
                    <div>
                        <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
                            Checkout Comanda <span className="text-orange-500 font-mono">#{command.id.split('-')[0].toUpperCase()}</span>
                        </h1>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Processamento de Recebimento</p>
                    </div>
                </div>
                <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${command.status === 'open' ? 'bg-orange-50 text-orange-600 border border-orange-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                    {command.status === 'open' ? 'Em Aberto' : 'Pago'}
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
                <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 pb-10">
                    
                    <div className="lg:col-span-2 space-y-6">
                        {/* CARD CLIENTE */}
                        <div className="bg-white rounded-[40px] border border-slate-100 p-8 shadow-sm flex flex-col md:flex-row items-center gap-6">
                            <div className="w-20 h-20 bg-orange-100 text-orange-600 rounded-3xl flex items-center justify-center font-black text-2xl shadow-inner border-4 border-white">
                                {clientName.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 text-center md:text-left">
                                <h3 className="text-2xl font-black text-slate-800">{clientName}</h3>
                                <div className="flex flex-wrap justify-center md:justify-start gap-4 mt-2">
                                    <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-tighter">
                                        <Phone size={14} className="text-orange-500" />
                                        {clientPhone}
                                    </div>
                                    <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-tighter">
                                        <Calendar size={14} className="text-orange-500" />
                                        {format(new Date(command.created_at), "dd 'de' MMMM 'às' HH:mm", { locale: pt })}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* LISTA DE ITENS */}
                        <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
                            <header className="px-8 py-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
                                <h3 className="font-black text-slate-800 text-sm uppercase tracking-widest flex items-center gap-2">
                                    <ShoppingCart size={18} className="text-orange-500" /> Itens Lançados
                                </h3>
                            </header>

                            <div className="divide-y divide-slate-50">
                                {command.command_items.map(item => (
                                    <div key={item.id} className="p-8 flex items-center justify-between group hover:bg-slate-50/50 transition-colors">
                                        <div className="flex items-center gap-5">
                                            <div className={`p-4 rounded-3xl ${item.product_id ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                                                {item.product_id ? <ShoppingBag size={24} /> : <Scissors size={24} />}
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-800 text-lg leading-tight">{item.title}</p>
                                                <p className="text-[10px] text-slate-400 font-black uppercase mt-1">
                                                    {item.quantity} un. x R$ {Number(item.price).toFixed(2)}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-8">
                                            <p className="font-black text-slate-800 text-xl">R$ {(item.price * item.quantity).toFixed(2)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* LISTA DE PAGAMENTOS JÁ ADICIONADOS */}
                        {addedPayments.length > 0 && (
                            <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden animate-in slide-in-from-bottom-4">
                                <header className="px-8 py-5 border-b border-slate-50 bg-emerald-50/50">
                                    <h3 className="font-black text-emerald-800 text-xs uppercase tracking-widest flex items-center gap-2">
                                        <CheckCircle size={16} /> Parcelas de Recebimento
                                    </h3>
                                </header>
                                <div className="divide-y divide-slate-50">
                                    {addedPayments.map(p => (
                                        <div key={p.id} className="px-8 py-4 flex items-center justify-between group">
                                            <div className="flex items-center gap-4">
                                                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                                                    <Coins size={16} />
                                                </div>
                                                <span className="text-sm font-black text-slate-700 uppercase">{p.method.replace('_', ' ')}</span>
                                            </div>
                                            <div className="flex items-center gap-6">
                                                <span className="font-black text-slate-800">R$ {p.amount.toFixed(2)}</span>
                                                <button onClick={() => handleRemovePayment(p.id)} className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors">
                                                    <X size={18} strokeWidth={3} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="space-y-6">
                        {/* RESUMO FINANCEIRO */}
                        <div className="bg-slate-900 rounded-[48px] p-10 text-white shadow-2xl relative overflow-hidden group">
                            <div className="absolute -right-4 -top-4 opacity-5 group-hover:rotate-12 transition-transform duration-700">
                                <Receipt size={200} />
                            </div>
                            
                            <div className="relative z-10 space-y-6">
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs font-black uppercase tracking-widest text-slate-400">
                                        <span>Subtotal</span>
                                        <span>R$ {totals.subtotal.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-orange-400">
                                            <Percent size={14} /> Desconto (R$)
                                        </div>
                                        <input 
                                            type="number" 
                                            value={discount}
                                            onChange={e => setDiscount(e.target.value)}
                                            className="w-24 bg-white/10 border border-white/10 rounded-xl px-3 py-1.5 text-right font-black text-white outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-white/10">
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Total da Conta</p>
                                    <h2 className="text-5xl font-black tracking-tighter text-emerald-400">
                                        R$ {totals.total.toFixed(2)}
                                    </h2>
                                </div>

                                {totals.paid > 0 && (
                                    <div className="bg-white/5 p-4 rounded-3xl border border-white/10 space-y-3">
                                        <div className="flex justify-between text-xs font-bold">
                                            <span className="text-slate-400">Total Pago:</span>
                                            <span className="text-emerald-400">R$ {totals.paid.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between items-center pt-2 border-t border-white/5">
                                            <span className="text-xs font-black uppercase tracking-widest text-orange-400">A Pagar:</span>
                                            <span className={`text-xl font-black ${totals.remaining === 0 ? 'text-emerald-400' : 'text-white animate-pulse'}`}>
                                                R$ {totals.remaining.toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* MÉTODOS DE PAGAMENTO */}
                        <div className="bg-white rounded-[48px] p-8 border border-slate-100 shadow-sm space-y-6">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 flex items-center gap-2">
                                <CreditCard size={14} className="text-orange-500" /> Adicionar Pagamento
                            </h4>
                            
                            {activeMethod ? (
                                <div className="bg-slate-50 p-6 rounded-[32px] border-2 border-orange-500 animate-in zoom-in-95">
                                    <div className="flex justify-between items-center mb-4">
                                        <span className="text-[10px] font-black uppercase text-orange-600 tracking-widest">Valor no {activeMethod.toUpperCase()}</span>
                                        <button onClick={() => setActiveMethod(null)} className="text-slate-300 hover:text-slate-500"><X size={20}/></button>
                                    </div>
                                    <div className="relative mb-4">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-300">R$</span>
                                        <input 
                                            autoFocus
                                            type="number"
                                            value={amountToPay}
                                            onChange={e => setAmountToPay(e.target.value)}
                                            className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-2xl font-black text-slate-800 outline-none focus:ring-4 focus:ring-orange-100"
                                        />
                                    </div>
                                    <button 
                                        onClick={handleConfirmPartialPayment}
                                        className="w-full bg-slate-800 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg"
                                    >
                                        <Plus size={18} /> Confirmar Parcela
                                    </button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-3">
                                    {paymentMethods.map(pm => (
                                        <button
                                            key={pm.id}
                                            onClick={() => handleInitPayment(pm.id as PaymentMethod)}
                                            className="flex flex-col items-center justify-center p-6 rounded-[32px] border-2 border-transparent bg-slate-50 text-slate-400 hover:border-slate-200 hover:bg-white transition-all active:scale-95"
                                        >
                                            <pm.icon size={28} className="mb-3 text-slate-300 group-hover:text-orange-500" />
                                            <span className="text-[10px] font-black uppercase tracking-tighter">{pm.label}</span>
                                        </button>
                                    ))}
                                </div>
                            )}

                            <button 
                                onClick={handleFinishPayment}
                                disabled={isFinishing || totals.remaining > 0 || addedPayments.length === 0}
                                className={`w-full mt-6 py-6 rounded-[32px] font-black flex items-center justify-center gap-3 text-lg uppercase tracking-widest transition-all active:scale-95 shadow-2xl ${
                                    totals.remaining === 0 && addedPayments.length > 0
                                    ? 'bg-emerald-600 text-white shadow-emerald-100 hover:bg-emerald-700'
                                    : 'bg-slate-100 text-slate-300 cursor-not-allowed shadow-none'
                                }`}
                            >
                                {isFinishing ? (
                                    <Loader2 size={24} className="animate-spin" />
                                ) : (
                                    <>
                                        <CheckCircle size={24} /> 
                                        {totals.remaining > 0 ? `Faltam R$ ${totals.remaining.toFixed(2)}` : 'Fechar Conta'}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CommandDetailView;

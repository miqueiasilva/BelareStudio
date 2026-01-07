
import React, { useState, useEffect, useMemo } from 'react';
import { 
    ChevronLeft, CreditCard, Smartphone, Banknote, 
    Trash2, Plus, ArrowRight, Loader2, CheckCircle,
    User, Phone, Scissors, ShoppingBag, Receipt,
    FileText, Tag, DollarSign, Percent, AlertCircle,
    // Added missing icon imports
    Calendar, ShoppingCart, Info
} from 'lucide-react';
// Added missing date-fns imports
import { format } from 'date-fns';
import { ptBR as pt } from 'date-fns/locale/pt-BR';
import { supabase } from '../../services/supabaseClient';
import { Command, CommandItem, PaymentMethod } from '../../types';
import Toast, { ToastType } from '../shared/Toast';

interface CommandDetailViewProps {
    commandId: string;
    onBack: () => void;
}

const CommandDetailView: React.FC<CommandDetailViewProps> = ({ commandId, onBack }) => {
    const [command, setCommand] = useState<Command | null>(null);
    const [loading, setLoading] = useState(true);
    const [isFinishing, setIsFinishing] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
    const [discount, setDiscount] = useState<string>('0');
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    const fetchCommand = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('commands')
                .select('*, clients(nome, whatsapp), command_items(*)')
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

    const totals = useMemo(() => {
        if (!command) return { subtotal: 0, total: 0 };
        const subtotal = command.command_items.reduce((acc, i) => acc + (Number(i.price) * Number(i.quantity)), 0);
        const discValue = parseFloat(discount) || 0;
        return {
            subtotal,
            total: Math.max(0, subtotal - discValue)
        };
    }, [command, discount]);

    const handleRemoveItem = async (itemId: string) => {
        if (!window.confirm("Deseja remover este item?")) return;
        try {
            const { error } = await supabase.from('command_items').delete().eq('id', itemId);
            if (error) throw error;
            setCommand(prev => prev ? {
                ...prev,
                command_items: prev.command_items.filter(i => i.id !== itemId)
            } : null);
            setToast({ message: "Item removido.", type: 'info' });
        } catch (e) {
            setToast({ message: "Erro ao remover.", type: 'error' });
        }
    };

    const handleFinishPayment = async () => {
        if (!command || isFinishing) return;
        setIsFinishing(true);

        try {
            // 1. Registrar no Financeiro
            const { error: finError } = await supabase.from('financial_transactions').insert([{
                description: `Recebimento Comanda #${command.id.split('-')[0].toUpperCase()} - ${command.clients?.nome}`,
                amount: totals.total,
                type: 'income',
                category: 'servico',
                payment_method: paymentMethod,
                client_id: command.client_id,
                date: new Date().toISOString(),
                status: 'paid'
            }]);

            if (finError) throw finError;

            // 2. Atualizar Comanda
            const { error: cmdError } = await supabase
                .from('commands')
                .update({ 
                    status: 'paid',
                    closed_at: new Date().toISOString(),
                    total_amount: totals.total
                })
                .eq('id', command.id);

            if (cmdError) throw cmdError;

            setToast({ message: "Pagamento confirmado com sucesso! 💰", type: 'success' });
            setTimeout(onBack, 2000);
        } catch (e) {
            setToast({ message: "Falha ao processar checkout.", type: 'error' });
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
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Processamento de Pagamento Final</p>
                    </div>
                </div>
                <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${command.status === 'open' ? 'bg-orange-50 text-orange-600 border border-orange-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                    {command.status === 'open' ? 'Em Aberto' : 'Pago'}
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
                <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 pb-10">
                    
                    {/* COLUNA ESQUERDA: Itens e Cliente */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* CARD CLIENTE */}
                        <div className="bg-white rounded-[40px] border border-slate-100 p-8 shadow-sm flex flex-col md:flex-row items-center gap-6">
                            <div className="w-20 h-20 bg-orange-100 text-orange-600 rounded-3xl flex items-center justify-center font-black text-2xl shadow-inner border-4 border-white">
                                {command.clients?.nome?.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 text-center md:text-left">
                                <h3 className="text-2xl font-black text-slate-800">{command.clients?.nome}</h3>
                                <div className="flex flex-wrap justify-center md:justify-start gap-4 mt-2">
                                    <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-tighter">
                                        <Phone size={14} className="text-orange-500" />
                                        {command.clients?.whatsapp || 'Sem telefone'}
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
                                <button className="text-[10px] font-black text-orange-500 uppercase tracking-widest hover:underline flex items-center gap-1">
                                    <Plus size={14} /> Adicionar mais
                                </button>
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
                                            <button 
                                                onClick={() => handleRemoveItem(item.id)}
                                                className="p-2.5 text-slate-200 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all"
                                            >
                                                <Trash2 size={20} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {command.command_items.length === 0 && (
                                    <div className="p-20 text-center text-slate-300">
                                        <AlertCircle size={48} className="mx-auto mb-4 opacity-20" />
                                        <p className="font-bold uppercase tracking-widest text-sm">Nenhum item na comanda</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* COLUNA DIREITA: Pagamento e Totais */}
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
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Total a Receber</p>
                                    <h2 className="text-5xl font-black tracking-tighter text-emerald-400">
                                        R$ {totals.total.toFixed(2)}
                                    </h2>
                                </div>
                            </div>
                        </div>

                        {/* MÉTODOS DE PAGAMENTO */}
                        <div className="bg-white rounded-[48px] p-8 border border-slate-100 shadow-sm space-y-6">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 flex items-center gap-2">
                                <CreditCard size={14} className="text-orange-500" /> Método de Recebimento
                            </h4>
                            
                            <div className="grid grid-cols-2 gap-3">
                                {paymentMethods.map(pm => (
                                    <button
                                        key={pm.id}
                                        onClick={() => setPaymentMethod(pm.id as PaymentMethod)}
                                        className={`flex flex-col items-center justify-center p-6 rounded-[32px] border-2 transition-all active:scale-95 ${
                                            paymentMethod === pm.id 
                                            ? 'border-orange-500 bg-orange-50/30 shadow-lg shadow-orange-100' 
                                            : 'bg-slate-50 border-transparent text-slate-400 hover:border-slate-200'
                                        }`}
                                    >
                                        <pm.icon size={28} className={`mb-3 ${paymentMethod === pm.id ? pm.color : 'text-slate-300'}`} />
                                        <span className="text-[10px] font-black uppercase tracking-tighter">{pm.label}</span>
                                    </button>
                                ))}
                            </div>

                            <button 
                                onClick={handleFinishPayment}
                                disabled={isFinishing || command.command_items.length === 0}
                                className="w-full mt-6 bg-orange-500 hover:bg-orange-600 text-white font-black py-6 rounded-[32px] shadow-2xl shadow-orange-100 transition-all active:scale-95 flex items-center justify-center gap-3 text-lg uppercase tracking-widest disabled:opacity-50"
                            >
                                {isFinishing ? <Loader2 size={24} className="animate-spin" /> : <><CheckCircle size={24} /> Confirmar Pagamento</>}
                            </button>
                        </div>

                        {/* DICA INTELIGENTE */}
                        <div className="p-6 bg-blue-50 rounded-[32px] border border-blue-100 flex gap-4">
                            <div className="p-2 bg-blue-100 rounded-xl h-fit"><Info size={20} className="text-blue-600" /></div>
                            <p className="text-[10px] text-blue-800 font-bold uppercase leading-relaxed">
                                Ao confirmar, os valores serão lançados automaticamente no seu Fluxo de Caixa e o status do agendamento será concluído.
                            </p>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default CommandDetailView;

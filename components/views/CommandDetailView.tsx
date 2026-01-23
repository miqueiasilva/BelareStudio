
import React, { useState, useEffect, useMemo } from 'react';
import { 
    ChevronLeft, CreditCard, Smartphone, Banknote, 
    Plus, Loader2, CheckCircle,
    Phone, Scissors, ShoppingBag, Receipt,
    Percent, Calendar, ShoppingCart, X, Coins,
    ArrowRight, ShieldCheck, Tag, CreditCard as CardIcon
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR as pt } from 'date-fns/locale/pt-BR';
import { supabase } from '../../services/supabaseClient';
import { useStudio } from '../../contexts/StudioContext';
import { Command, PaymentMethod } from '../../types';
import Toast, { ToastType } from '../shared/Toast';

interface CommandDetailViewProps {
    commandId: string;
    onBack: () => void;
}

interface PaymentEntry {
    id: string;
    method: PaymentMethod;
    amount: number;
    brand?: string;
    installments?: number;
}

const BRANDS = ['Visa', 'Mastercard', 'Elo', 'Hipercard', 'Amex', 'Outros'];

const CommandDetailView: React.FC<CommandDetailViewProps> = ({ commandId, onBack }) => {
    const { activeStudioId } = useStudio();
    const [command, setCommand] = useState<Command | null>(null);
    const [loading, setLoading] = useState(true);
    const [isFinishing, setIsFinishing] = useState(false);
    
    // Estados de Checkout
    const [addedPayments, setAddedPayments] = useState<PaymentEntry[]>([]);
    const [activeMethod, setActiveMethod] = useState<PaymentMethod | null>(null);
    const [selectedBrand, setSelectedBrand] = useState<string>('Visa');
    const [selectedInstallments, setSelectedInstallments] = useState<number>(1);
    const [amountToPay, setAmountToPay] = useState<string>('0');
    
    const [discount, setDiscount] = useState<string>('0');
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    // Estado para armazenar o retorno oficial da RPC v5
    const [serverReceipt, setServerReceipt] = useState<{ net_amount: number; fee_applied: number } | null>(null);

    const fetchCommand = async () => {
        if (!activeStudioId) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('commands')
                .select('*, clients(*), command_items(*)')
                .eq('id', commandId)
                .eq('studio_id', activeStudioId)
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
        if (commandId && activeStudioId) fetchCommand();
    }, [commandId, activeStudioId]);

    const totals = useMemo(() => {
        if (!command) return { subtotal: 0, total: 0, paid: 0, remaining: 0 };
        const subtotal = command.command_items.reduce((acc, i) => acc + (Number(i.price || 0) * Number(i.quantity || 0)), 0);
        const discValue = parseFloat(discount) || 0;
        const totalAfterDiscount = Math.max(0, subtotal - discValue);
        const paid = addedPayments.reduce((acc, p) => acc + p.amount, 0);
        const remaining = Math.max(0, totalAfterDiscount - paid);
        return { subtotal, total: totalAfterDiscount, paid, remaining };
    }, [command, discount, addedPayments]);

    const handleInitPayment = (method: PaymentMethod) => {
        setActiveMethod(method);
        setAmountToPay(totals.remaining.toFixed(2));
        setSelectedBrand('Visa');
        setSelectedInstallments(1);
    };

    const handleConfirmPartialPayment = () => {
        if (!activeMethod || parseFloat(amountToPay) <= 0) return;
        const newPayment: PaymentEntry = {
            id: Math.random().toString(36).substring(2, 9),
            method: activeMethod,
            amount: parseFloat(amountToPay),
            brand: activeMethod === 'cartao_credito' ? selectedBrand : undefined,
            installments: activeMethod === 'cartao_credito' ? selectedInstallments : 1
        };
        setAddedPayments(prev => [...prev, newPayment]);
        setActiveMethod(null);
        setAmountToPay('0');
    };

    const handleRemovePayment = (id: string) => {
        setAddedPayments(prev => prev.filter(p => p.id !== id));
    };

    const handleFinishPayment = async () => {
        if (!command || !activeStudioId || isFinishing || addedPayments.length === 0) return;
        
        setIsFinishing(true);

        // Mapeamento de tipos para o contrato v5
        const methodMapping: Record<string, string> = {
            'pix': 'pix',
            'cartao_credito': 'credit',
            'cartao_debito': 'debit',
            'dinheiro': 'pix'
        };

        const primaryEntry = addedPayments[0];
        const primaryMethod = methodMapping[primaryEntry.method] || 'pix';

        try {
            // Chamada da RPC v5 - Processamento atômico (Venda + Estoque + Taxas)
            const { data, error } = await supabase.rpc('pay_and_close_command_v5', {
                p_command_id: command.id,
                p_payment_method: primaryMethod,
                p_brand: primaryEntry.brand?.toLowerCase() || 'outros',
                p_installments: primaryEntry.installments || 1
            });

            if (error) throw new Error(error.message || "Falha no fechamento via Banco de Dados.");

            // Sincronização visual com o que o Banco calculou
            if (data) {
                setServerReceipt({
                    net_amount: data.net_amount || 0,
                    fee_applied: data.fee_applied || 0
                });
            }

            setToast({ message: "Comanda liquidada e estoque baixado!", type: 'success' });
            
            // Delay para visualização do resumo de lucro líquido
            setTimeout(onBack, 3500);

        } catch (e: any) {
            console.error("[RPC_V5_ERROR]", e);
            setToast({ message: `Erro: ${e.message}`, type: 'error' });
            setIsFinishing(false);
        }
    };

    if (loading) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50">
                <Loader2 className="animate-spin text-orange-500 mb-4" size={48} />
                <p className="text-xs font-black uppercase tracking-[0.2em] animate-pulse">Sincronizando Checkout v5...</p>
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
                            Checkout <span className="text-orange-500 font-mono">#{command.id.split('-')[0].toUpperCase()}</span>
                        </h1>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Processamento SaaS v5</p>
                    </div>
                </div>
                <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${command.status === 'open' ? 'bg-orange-50 text-orange-600 border border-orange-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                    {command.status === 'open' ? 'Aberto' : 'Liquidado'}
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
                <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 pb-10">
                    <div className="lg:col-span-2 space-y-6">
                        {/* CLIENT CARD */}
                        <div className="bg-white rounded-[40px] border border-slate-100 p-8 shadow-sm flex flex-col md:flex-row items-center gap-6">
                            <div className="w-20 h-20 bg-orange-100 text-orange-600 rounded-3xl flex items-center justify-center font-black text-2xl shadow-inner border-4 border-white">
                                {command.clients?.nome?.charAt(0).toUpperCase() || 'C'}
                            </div>
                            <div className="flex-1 text-center md:text-left">
                                <h3 className="text-2xl font-black text-slate-800">{command.clients?.nome || 'Consumidor Final'}</h3>
                                <div className="flex flex-wrap justify-center md:justify-start gap-4 mt-2">
                                    <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-tighter">
                                        <Phone size={14} className="text-orange-500" /> {command.clients?.whatsapp || 'Sem contato'}
                                    </div>
                                    <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-tighter">
                                        <Calendar size={14} className="text-orange-500" /> {format(new Date(command.created_at), "dd/MM 'às' HH:mm", { locale: pt })}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ITEMS LIST */}
                        <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
                            <header className="px-8 py-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
                                <h3 className="font-black text-slate-800 text-sm uppercase tracking-widest flex items-center gap-2">
                                    <ShoppingCart size={18} className="text-orange-500" /> Composição do Ticket
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
                                                    {item.quantity} un. x R$ {Number(item.price || 0).toFixed(2)}
                                                    {item.product_id && <span className="ml-2 text-purple-500 opacity-60">• Baixa de Estoque</span>}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-8">
                                            <p className="font-black text-slate-800 text-xl">R$ {(Number(item.price || 0) * Number(item.quantity || 0)).toFixed(2)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* PAYMENTS LIST */}
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
                                                <div>
                                                    <span className="text-sm font-black text-slate-700 uppercase">{p.method.replace('_', ' ')}</span>
                                                    {p.brand && <span className="ml-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{p.brand} ({p.installments}x)</span>}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-6">
                                                <span className="font-black text-slate-800">R$ {p.amount.toFixed(2)}</span>
                                                {!serverReceipt && (
                                                    <button onClick={() => handleRemovePayment(p.id)} className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors">
                                                        <X size={18} strokeWidth={3} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="space-y-6">
                        {/* TOTALIZER CARD */}
                        <div className="bg-slate-900 rounded-[48px] p-10 text-white shadow-2xl relative overflow-hidden group">
                            <div className="absolute -right-4 -top-4 opacity-5 group-hover:rotate-12 transition-transform duration-700">
                                <Receipt size={200} />
                            </div>
                            <div className="relative z-10 space-y-6">
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs font-black uppercase tracking-widest text-slate-400">
                                        <span>Subtotal Comanda</span>
                                        <span>R$ {totals.subtotal.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-orange-400">
                                            <Percent size={14} /> Desconto Aplicado
                                        </div>
                                        <input 
                                            type="number" 
                                            disabled={!!serverReceipt}
                                            value={discount}
                                            onChange={e => setDiscount(e.target.value)}
                                            className="w-24 bg-white/10 border border-white/10 rounded-xl px-3 py-1.5 text-right font-black text-white outline-none focus:ring-2 focus:ring-orange-500 transition-all disabled:opacity-50"
                                        />
                                    </div>
                                </div>
                                <div className="pt-6 border-t border-white/10">
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">A Receber</p>
                                    <h2 className="text-5xl font-black tracking-tighter text-emerald-400">R$ {totals.total.toFixed(2)}</h2>
                                </div>

                                {/* EXIBIÇÃO DE DADOS DO SERVIDOR (RETORNO RPC V5) */}
                                {serverReceipt && (
                                    <div className="mt-8 p-6 bg-white/5 border border-white/10 rounded-[32px] animate-in zoom-in duration-500">
                                        <div className="flex items-center gap-2 mb-4 text-[10px] font-black uppercase text-emerald-400 tracking-widest">
                                            <ShieldCheck size={14} /> Conciliação Financeira v5
                                        </div>
                                        <div className="space-y-3">
                                            <div className="flex justify-between text-xs font-bold">
                                                <span className="text-slate-400">Taxas Adquirente (Desconto DB)</span>
                                                <span className="text-rose-400">- R$ {serverReceipt.fee_applied.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between items-end pt-3 border-t border-white/5">
                                                <span className="text-xs font-black uppercase text-slate-400">Depósito Líquido em Conta</span>
                                                <span className="text-2xl font-black text-white">R$ {serverReceipt.net_amount.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {totals.paid > 0 && !serverReceipt && (
                                    <div className="bg-white/5 p-4 rounded-3xl border border-white/10 space-y-3">
                                        <div className="flex justify-between text-xs font-bold"><span className="text-slate-400">Total Pago:</span><span className="text-emerald-400">R$ {totals.paid.toFixed(2)}</span></div>
                                        <div className="flex justify-between items-center pt-2 border-t border-white/5"><span className="text-xs font-black uppercase tracking-widest text-orange-400">Pendente:</span><span className={`text-xl font-black ${totals.remaining === 0 ? 'text-emerald-400' : 'text-white animate-pulse'}`}>R$ {totals.remaining.toFixed(2)}</span></div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* PAYMENT SELECTION */}
                        {!serverReceipt && (
                            <div className="bg-white rounded-[48px] p-8 border border-slate-100 shadow-sm space-y-6">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 flex items-center gap-2"><Tag size={14} className="text-orange-500" /> Forma de Pagamento</h4>
                                
                                {activeMethod === 'cartao_credito' ? (
                                    <div className="bg-slate-50 p-6 rounded-[32px] border-2 border-orange-500 animate-in zoom-in-95 space-y-6">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-black uppercase text-orange-600 tracking-widest">Configuração de Crédito</span>
                                            <button onClick={() => setActiveMethod(null)} className="text-slate-300 hover:text-slate-500"><X size={20}/></button>
                                        </div>
                                        
                                        <div className="space-y-4">
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Bandeira do Cartão</label>
                                                <div className="grid grid-cols-3 gap-2">
                                                    {BRANDS.map(b => (
                                                        <button 
                                                            key={b} 
                                                            onClick={() => setSelectedBrand(b)}
                                                            className={`py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter border-2 transition-all ${selectedBrand === b ? 'bg-orange-500 border-orange-500 text-white shadow-md' : 'bg-white border-slate-100 text-slate-400 hover:border-orange-200'}`}
                                                        >
                                                            {b}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Parcelamento (1x até 12x)</label>
                                                <div className="flex items-center gap-4 bg-white border border-slate-200 rounded-2xl px-4 py-3">
                                                    <input 
                                                        type="range" min="1" max="12" 
                                                        value={selectedInstallments}
                                                        onChange={e => setSelectedInstallments(parseInt(e.target.value))}
                                                        className="flex-1 accent-orange-500" 
                                                    />
                                                    <span className="font-black text-orange-600 text-lg w-10 text-right">{selectedInstallments}x</span>
                                                </div>
                                            </div>

                                            <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-300">R$</span><input type="number" value={amountToPay} onChange={e => setAmountToPay(e.target.value)} className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-2xl font-black text-slate-800 outline-none focus:ring-4 focus:ring-orange-100"/></div>
                                        </div>
                                        
                                        <button onClick={handleConfirmPartialPayment} className="w-full bg-slate-800 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg"><Plus size={18} /> Confirmar Dados do Cartão</button>
                                    </div>
                                ) : activeMethod ? (
                                    <div className="bg-slate-50 p-6 rounded-[32px] border-2 border-orange-500 animate-in zoom-in-95">
                                        <div className="flex justify-between items-center mb-4"><span className="text-[10px] font-black uppercase text-orange-600 tracking-widest">Valor no {activeMethod.toUpperCase()}</span><button onClick={() => setActiveMethod(null)} className="text-slate-300 hover:text-slate-500"><X size={20}/></button></div>
                                        <div className="relative mb-4"><span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-300">R$</span><input autoFocus type="number" value={amountToPay} onChange={e => setAmountToPay(e.target.value)} className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-2xl font-black text-slate-800 outline-none focus:ring-4 focus:ring-orange-100"/></div>
                                        <button onClick={handleConfirmPartialPayment} className="w-full bg-slate-800 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg"><Plus size={18} /> Confirmar Parcela</button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-3">
                                        {paymentMethods.map(pm => (
                                            <button key={pm.id} onClick={() => handleInitPayment(pm.id as PaymentMethod)} className="flex flex-col items-center justify-center p-6 rounded-[32px] border-2 border-transparent bg-slate-50 text-slate-400 hover:border-slate-200 hover:bg-white transition-all active:scale-95 group">
                                                <pm.icon size={28} className="mb-3 text-slate-300 group-hover:text-orange-500 transition-colors" />
                                                <span className="text-[10px] font-black uppercase tracking-tighter">{pm.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                
                                <button 
                                    onClick={handleFinishPayment} 
                                    disabled={isFinishing || totals.remaining > 0 || addedPayments.length === 0} 
                                    className={`w-full mt-6 py-6 rounded-[32px] font-black flex items-center justify-center gap-3 text-lg uppercase tracking-widest transition-all active:scale-95 shadow-2xl ${totals.remaining === 0 && addedPayments.length > 0 ? 'bg-emerald-600 text-white shadow-emerald-100 hover:bg-emerald-700' : 'bg-slate-100 text-slate-300 cursor-not-allowed shadow-none'}`}
                                >
                                    {isFinishing ? (<Loader2 size={24} className="animate-spin" />) : (<><CheckCircle size={24} /> {totals.remaining > 0 ? `Faltam R$ ${totals.remaining.toFixed(2)}` : 'Fechar Conta v5'}</>)}
                                </button>
                            </div>
                        )}
                        
                        {serverReceipt && (
                            <button 
                                onClick={onBack}
                                className="w-full py-6 rounded-[32px] bg-slate-800 text-white font-black text-lg uppercase tracking-widest shadow-xl hover:bg-slate-900 transition-all active:scale-95 flex items-center justify-center gap-3"
                            >
                                <ArrowRight size={24} /> Voltar para Comandas
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CommandDetailView;

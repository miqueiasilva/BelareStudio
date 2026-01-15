
import React, { useState, useEffect, useMemo } from 'react';
import { 
    ChevronLeft, CreditCard, Smartphone, Banknote, 
    Plus, Loader2, CheckCircle,
    Phone, Scissors, ShoppingBag, Receipt,
    Percent, Calendar, ShoppingCart, X, Coins,
    ArrowRight, ShieldCheck, Tag, CreditCard as CardIcon,
    AlertCircle, Sparkles, CheckCircle2, ArrowUpRight,
    Trash2
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
    method: 'credit' | 'debit' | 'pix' | 'money';
    amount: number;
    brand: string;
    installments: number;
}

interface ServerReceipt {
    gross_amount: number;
    net_amount: number;
    fee_amount: number;
}

const BRANDS = ['Visa', 'Mastercard', 'Elo', 'Hipercard', 'Amex', 'Outros'];

const CommandDetailView: React.FC<CommandDetailViewProps> = ({ commandId, onBack }) => {
    const { activeStudioId } = useStudio();
    const [command, setCommand] = useState<Command | null>(null);
    const [loading, setLoading] = useState(true);
    const [isFinishing, setIsFinishing] = useState(false);
    const [isSuccessfullyClosed, setIsSuccessfullyClosed] = useState(false);
    
    const [addedPayments, setAddedPayments] = useState<PaymentEntry[]>([]);
    const [activeMethod, setActiveMethod] = useState<'credit' | 'debit' | 'pix' | 'money' | null>(null);
    const [selectedBrand, setSelectedBrand] = useState<string>('Visa');
    const [selectedInstallments, setSelectedInstallments] = useState<number>(1);
    const [amountToPay, setAmountToPay] = useState<string>('0');
    
    const [discount, setDiscount] = useState<string>('0');
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const [serverReceipt, setServerReceipt] = useState<ServerReceipt | null>(null);

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
            
            if (data.status === 'paid') {
                setIsSuccessfullyClosed(true);
            }
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

    const handleInitPayment = (method: 'credit' | 'debit' | 'pix' | 'money') => {
        setActiveMethod(method);
        setAmountToPay(totals.remaining.toFixed(2));
        setSelectedBrand('Visa');
        setSelectedInstallments(1);
    };

    const handleConfirmPartialPayment = () => {
        const val = parseFloat(amountToPay);
        if (!activeMethod || val <= 0) return;

        if (val > totals.remaining + 0.01) {
            setToast({ message: `Valor superior ao restante (R$ ${totals.remaining.toFixed(2)})`, type: 'error' });
            return;
        }

        const newPayment: PaymentEntry = {
            id: Math.random().toString(36).substring(2, 9),
            method: activeMethod,
            amount: val,
            brand: (activeMethod === 'credit' || activeMethod === 'debit') ? selectedBrand : 'outros',
            installments: activeMethod === 'credit' ? selectedInstallments : 1
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
        
        if (totals.remaining > 0.01) {
            setToast({ message: "A soma dos pagamentos não atinge o total da venda!", type: 'error' });
            return;
        }
        
        setIsFinishing(true);
        let totalNetValue = 0;
        let grossValueSnapshot = totals.total;

        try {
            // Mapeamento de métodos para o padrão esperado pela register_payment_transaction
            const methodMap: Record<string, string> = {
                'money': 'cash',
                'credit': 'credit',
                'debit': 'debit',
                'pix': 'pix'
            };

            for (const entry of addedPayments) {
                const payload = {
                    p_command_id: command.id,
                    p_amount: entry.amount,
                    p_method: methodMap[entry.method] || entry.method,
                    p_brand: (entry.method === 'credit' || entry.method === 'debit') 
                        ? (entry.brand.toLowerCase() === 'outros' ? null : entry.brand.toLowerCase()) 
                        : null,
                    p_installments: Math.floor(entry.installments)
                };

                const { data, error } = await supabase.rpc('pay_and_close_command_api_v1', payload);

                if (error) {
                    console.error("[RPC_ERROR_DETAIL]", error);
                    throw error;
                }
                
                // Se a RPC não retornar net_amount (pois agora delega para register_payment_transaction),
                // usamos o valor bruto para a UI. No banco as taxas estarão corretas.
                totalNetValue += (data?.net_amount || data?.net_value || entry.amount);
            }

            const totalFee = grossValueSnapshot - totalNetValue;

            setServerReceipt({
                gross_amount: grossValueSnapshot,
                net_amount: totalNetValue,
                fee_amount: totalFee > 0 ? totalFee : 0
            });

            setIsSuccessfullyClosed(true);
            setAddedPayments([]);
            setDiscount('0');
            setActiveMethod(null);
            
            setToast({ message: "Liquidação processada com sucesso!", type: 'success' });
            fetchCommand();

        } catch (e: any) {
            console.error("[RPC_API_V1_FAIL]", e);
            // Previne a exibição de [object Object] extraindo a mensagem real
            const displayError = e?.message || e?.hint || (typeof e === 'string' ? e : "Erro interno no servidor.");
            setToast({ message: `Falha na liquidação: ${displayError}`, type: 'error' });
            setIsFinishing(false);
        }
    };

    if (loading) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50">
                <Loader2 className="animate-spin text-orange-500 mb-4" size={48} />
                <p className="text-xs font-black uppercase tracking-[0.2em]">Iniciando Checkout v5...</p>
            </div>
        );
    }

    if (!command) return null;

    const paymentMethods = [
        { id: 'pix', label: 'Pix', icon: Smartphone, color: 'text-teal-600', bg: 'bg-teal-50' },
        { id: 'money', label: 'Dinheiro', icon: Banknote, color: 'text-green-600', bg: 'bg-green-50' },
        { id: 'credit', label: 'Crédito', icon: CreditCard, color: 'text-blue-600', bg: 'bg-blue-50' },
        { id: 'debit', label: 'Débito', icon: CardIcon, color: 'text-cyan-600', bg: 'bg-cyan-50' },
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
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Motor Multi-Pagamento Zelda v5</p>
                    </div>
                </div>
                <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${isSuccessfullyClosed ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-orange-50 text-orange-600 border border-orange-100'}`}>
                    {isSuccessfullyClosed ? 'Venda Finalizada' : 'Caixa Aberto'}
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
                <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 pb-10">
                    
                    <div className="lg:col-span-2 space-y-6">
                        
                        {isSuccessfullyClosed && (
                            <div className="bg-emerald-600 rounded-[40px] p-10 text-white shadow-2xl animate-in zoom-in-95 duration-500 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12">
                                    <Sparkles size={120} />
                                </div>
                                <div className="relative z-10 flex flex-col items-center text-center">
                                    <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mb-6 backdrop-blur-md">
                                        <CheckCircle2 size={48} className="text-white" />
                                    </div>
                                    <h2 className="text-3xl font-black mb-2 uppercase tracking-widest">Venda Finalizada!</h2>
                                    <p className="text-emerald-100 font-medium max-w-sm">Os pagamentos foram processados individualmente e integrados ao Fluxo de Caixa.</p>
                                </div>
                            </div>
                        )}

                        <div className="bg-white rounded-[40px] border border-slate-100 p-8 shadow-sm flex flex-col md:flex-row items-center gap-6">
                            <div className={`w-20 h-20 rounded-3xl flex items-center justify-center font-black text-2xl shadow-inner border-4 border-white ${isSuccessfullyClosed ? 'bg-emerald-100 text-emerald-600' : 'bg-orange-100 text-orange-600'}`}>
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

                        {!isSuccessfullyClosed && (
                            <div className="space-y-6">
                                <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden animate-in slide-in-from-left-4">
                                    <header className="px-8 py-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
                                        <h3 className="font-black text-slate-800 text-sm uppercase tracking-widest flex items-center gap-2">
                                            <ShoppingCart size={18} className="text-orange-500" /> Itens na Comanda
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
                                                        </p>
                                                    </div>
                                                </div>
                                                <p className="font-black text-slate-800 text-xl">R$ {(Number(item.price || 0) * Number(item.quantity || 0)).toFixed(2)}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden animate-in slide-in-from-left-6 duration-500">
                                    <header className="px-8 py-6 border-b border-slate-50 flex justify-between items-center bg-slate-800 text-white">
                                        <h3 className="font-black text-sm uppercase tracking-widest flex items-center gap-2">
                                            <CheckCircle size={18} className="text-emerald-400" /> Pagamentos Lançados
                                        </h3>
                                        <span className="text-[10px] font-black uppercase bg-white/10 px-3 py-1 rounded-full">Recebido: R$ {totals.paid.toFixed(2)}</span>
                                    </header>
                                    <div className="divide-y divide-slate-50">
                                        {addedPayments.length === 0 ? (
                                            <div className="p-12 text-center text-slate-300 italic text-sm font-medium">Nenhum pagamento registrado. Escolha um método ao lado.</div>
                                        ) : (
                                            addedPayments.map(p => (
                                                <div key={p.id} className="p-6 flex items-center justify-between group animate-in fade-in slide-in-from-top-1">
                                                    <div className="flex items-center gap-4">
                                                        <div className="p-3 bg-slate-50 rounded-2xl text-slate-400">
                                                            {p.method === 'pix' ? <Smartphone size={20}/> : p.method === 'money' ? <Coins size={20}/> : <CreditCard size={20}/>}
                                                        </div>
                                                        <div>
                                                            <p className="font-black text-slate-700 text-sm uppercase">
                                                                {p.method === 'credit' ? 'Crédito' : p.method === 'debit' ? 'Débito' : p.method === 'pix' ? 'Pix' : 'Dinheiro'}
                                                                {p.brand !== 'outros' && ` • ${p.brand}`}
                                                            </p>
                                                            {p.method === 'credit' && <p className="text-[9px] font-black text-orange-500 uppercase tracking-widest">{p.installments}x no Cartão</p>}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-6">
                                                        <span className="font-black text-slate-800 text-xl">R$ {p.amount.toFixed(2)}</span>
                                                        <button onClick={() => handleRemovePayment(p.id)} className="p-2 text-slate-200 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
                                                            <Trash2 size={20} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="space-y-6">
                        <div className="bg-slate-900 rounded-[48px] p-10 text-white shadow-2xl relative overflow-hidden group">
                            <div className="relative z-10 space-y-6 text-left">
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs font-black uppercase tracking-widest text-slate-400">
                                        <span>Subtotal Bruto</span>
                                        <span>R$ {totals.subtotal.toFixed(2)}</span>
                                    </div>
                                    {!isSuccessfullyClosed && (
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-orange-400">
                                                <Percent size={14} /> Desconto
                                            </div>
                                            <input 
                                                type="number" 
                                                value={discount}
                                                onChange={e => setDiscount(e.target.value)}
                                                className="w-24 bg-white/10 border border-white/10 rounded-xl px-3 py-1.5 text-right font-black text-white outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                                            />
                                        </div>
                                    )}
                                </div>
                                <div className="pt-6 border-t border-white/10">
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Total da Venda</p>
                                    <h2 className={`text-5xl font-black tracking-tighter ${isSuccessfullyClosed ? 'text-emerald-400' : 'text-white'}`}>
                                        R$ {isSuccessfullyClosed && serverReceipt ? serverReceipt.gross_amount.toFixed(2) : totals.total.toFixed(2)}
                                    </h2>
                                </div>

                                {serverReceipt && (
                                    <div className="mt-8 p-6 bg-white/5 border border-white/10 rounded-[32px] animate-in slide-in-from-top-4">
                                        <div className="flex items-center gap-2 mb-4 text-[10px] font-black uppercase text-emerald-400 tracking-widest">
                                            <ShieldCheck size={14} /> Detalhamento de Taxas
                                        </div>
                                        <div className="space-y-3">
                                            <div className="flex justify-between text-xs font-bold">
                                                <span className="text-slate-400">Taxas Retidas</span>
                                                <span className="text-rose-400">- R$ {serverReceipt.fee_amount.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between items-end pt-3 border-t border-white/5">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black uppercase text-slate-400">Recebimento Líquido</span>
                                                    <span className="text-[8px] font-bold text-slate-500">SALDO REAL EM CAIXA</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-2xl font-black text-white">R$ {serverReceipt.net_amount.toFixed(2)}</span>
                                                    <ArrowUpRight size={18} className="text-emerald-500" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {!isSuccessfullyClosed && (
                            <div className="bg-white rounded-[48px] p-8 border border-slate-100 shadow-sm space-y-6 text-left">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 flex items-center gap-2">
                                    <Tag size={14} className="text-orange-500" /> Forma de Recebimento
                                </h4>
                                
                                { (activeMethod === 'credit' || activeMethod === 'debit') ? (
                                    <div className="bg-slate-50 p-6 rounded-[32px] border-2 border-orange-500 animate-in zoom-in-95 space-y-6">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-black uppercase text-orange-600 tracking-widest">
                                                Configuração {activeMethod === 'credit' ? 'Crédito' : 'Débito'}
                                            </span>
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

                                            {activeMethod === 'credit' && (
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Parcelamento: {selectedInstallments}x</label>
                                                    <input 
                                                        type="range" min="1" max="12" 
                                                        value={selectedInstallments}
                                                        onChange={e => setSelectedInstallments(parseInt(e.target.value))}
                                                        className="w-full accent-orange-500" 
                                                    />
                                                </div>
                                            )}

                                            <div className="relative">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-300">R$</span>
                                                <input type="number" value={amountToPay} onChange={e => setAmountToPay(e.target.value)} className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-2xl font-black text-slate-800 outline-none focus:ring-4 focus:ring-orange-100 transition-all shadow-inner"/>
                                            </div>
                                        </div>
                                        
                                        <button onClick={handleConfirmPartialPayment} className="w-full bg-slate-800 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg">Confirmar {activeMethod === 'credit' ? 'Parcela' : 'Bandeira'}</button>
                                    </div>
                                ) : activeMethod ? (
                                    <div className="bg-slate-50 p-6 rounded-[32px] border-2 border-orange-500 animate-in zoom-in-95">
                                        <div className="flex justify-between items-center mb-4"><span className="text-[10px] font-black uppercase text-orange-600 tracking-widest">Valor no {activeMethod.toUpperCase()}</span><button onClick={() => setActiveMethod(null)} className="text-slate-300 hover:text-slate-500"><X size={20}/></button></div>
                                        <div className="relative mb-4"><span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-300">R$</span><input autoFocus type="number" value={amountToPay} onChange={e => setAmountToPay(e.target.value)} className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-2xl font-black text-slate-800 outline-none focus:ring-4 focus:ring-orange-100 transition-all shadow-inner"/></div>
                                        <button onClick={handleConfirmPartialPayment} className="w-full bg-slate-800 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg">Adicionar Pagamento</button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-3">
                                        {paymentMethods.map(pm => (
                                            <button key={pm.id} onClick={() => handleInitPayment(pm.id as any)} className="flex flex-col items-center justify-center p-6 rounded-[32px] border-2 border-transparent bg-slate-50 text-slate-400 hover:border-slate-200 hover:bg-white transition-all active:scale-95 group">
                                                <pm.icon size={28} className="mb-3 text-slate-300 group-hover:text-orange-500 transition-colors" />
                                                <span className="text-[10px] font-black uppercase tracking-tighter">{pm.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                
                                <button 
                                    onClick={handleFinishPayment} 
                                    disabled={isFinishing || totals.remaining > 0.01 || addedPayments.length === 0} 
                                    className={`w-full mt-6 py-6 rounded-[32px] font-black flex items-center justify-center gap-3 text-lg uppercase tracking-widest transition-all active:scale-95 shadow-2xl ${totals.remaining < 0.02 && addedPayments.length > 0 ? 'bg-emerald-600 text-white shadow-emerald-100 hover:bg-emerald-700' : 'bg-slate-100 text-slate-300 cursor-not-allowed shadow-none'}`}
                                >
                                    {isFinishing ? <Loader2 size={24} className="animate-spin" /> : <><CheckCircle size={24} /> {totals.remaining > 0.01 ? `Faltam R$ ${totals.remaining.toFixed(2)}` : 'LIQUIDAR COMANDA'}</>}
                                </button>
                            </div>
                        )}
                        
                        {isSuccessfullyClosed && (
                            <button 
                                onClick={onBack}
                                className="w-full py-6 rounded-[32px] bg-slate-800 text-white font-black text-lg uppercase tracking-widest shadow-xl hover:bg-slate-900 transition-all active:scale-95 flex items-center justify-center gap-3"
                            >
                                <ArrowRight size={24} /> Próximo Cliente
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CommandDetailView;

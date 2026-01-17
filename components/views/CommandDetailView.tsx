import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    ChevronLeft, CreditCard, Smartphone, Banknote, 
    Plus, Loader2, CheckCircle,
    Phone, Scissors, ShoppingBag, Receipt,
    Percent, Calendar, ShoppingCart, X, Coins,
    ArrowRight, ShieldCheck, Tag, CreditCard as CardIcon,
    AlertCircle, Sparkles, CheckCircle2, ArrowUpRight,
    Trash2, ChevronDown, Check, User, Briefcase
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
    method_id: string; // Adicionado para persistência correta
    amount: number;
    brand: string;
    rate: number;
    fee: number;
    net: number;
    installments: number;
}

const categories = [
    { id: 'pix', label: 'Pix', icon: Smartphone, color: 'text-teal-600', bg: 'bg-teal-50' },
    { id: 'money', label: 'Dinheiro', icon: Banknote, color: 'text-green-600', bg: 'bg-green-50' },
    { id: 'credit', label: 'Crédito', icon: CreditCard, color: 'text-blue-600', bg: 'bg-blue-50' },
    { id: 'debit', label: 'Débito', icon: CreditCard, color: 'text-cyan-600', bg: 'bg-cyan-50' },
];

const CommandDetailView: React.FC<CommandDetailViewProps> = ({ commandId, onBack }) => {
    const { activeStudioId } = useStudio();
    const isMounted = useRef(true);
    const [command, setCommand] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isFinishing, setIsFinishing] = useState(false);
    const [isSuccessfullyClosed, setIsSuccessfullyClosed] = useState(false);
    
    const [resolvedClientName, setResolvedClientName] = useState<string>('Consumidor Final');
    const [dbMethods, setDbMethods] = useState<any[]>([]);
    const [addedPayments, setAddedPayments] = useState<PaymentEntry[]>([]);
    const [historyPayments, setHistoryPayments] = useState<any[]>([]); 
    
    const [activeCategory, setActiveCategory] = useState<'credit' | 'debit' | 'pix' | 'money' | null>(null);
    const [selectedMethodObj, setSelectedMethodObj] = useState<any>(null);
    const [selectedInstallments, setSelectedInstallments] = useState<number>(1);
    const [amountToPay, setAmountToPay] = useState<string>('0');
    
    const [discount, setDiscount] = useState<string>('0');
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);

    const fetchSystemData = async () => {
        if (!activeStudioId || !commandId) return;
        setLoading(true);
        try {
            const [cmdRes, methodsRes, paymentsRes] = await Promise.all([
                supabase
                    .from('commands')
                    .select(`
                      *,
                      client:clients!commands_client_id_fkey (id, nome, name, nickname, apelido, whatsapp),
                      professional:professionals!commands_professional_id_fkey (uuid_id, name),
                      command_items (*, team_members (name))
                    `)
                    .eq('id', commandId)
                    .single(),
                supabase.from('payment_methods_config').select('*').eq('is_active', true),
                supabase.from('v_command_payments_history').select('*').eq('command_id', commandId)
            ]);

            if (cmdRes.error) throw cmdRes.error;
            
            if (isMounted.current) {
                const cmdData = cmdRes.data;
                setCommand(cmdData);
                setDbMethods(methodsRes.data || []);
                setHistoryPayments(paymentsRes.data || []);
                
                if (cmdData.status === 'paid') setIsSuccessfullyClosed(true);

                const clientObj = cmdData?.client;
                const clientName = clientObj?.nome || clientObj?.name || clientObj?.nickname || clientObj?.apelido || 'Consumidor Final';
                setResolvedClientName(clientName);
            }
        } catch (e: any) {
            if (isMounted.current) setToast({ message: "Erro ao sincronizar comanda.", type: 'error' });
        } finally {
            if (isMounted.current) setLoading(false);
        }
    };

    useEffect(() => { fetchSystemData(); }, [commandId, activeStudioId]);

    const totals = useMemo(() => {
        if (!command) return { subtotal: 0, total: 0, paid: 0, remaining: 0, totalNet: 0 };
        const subtotal = Number(command.total_amount || 0);
        const discValue = parseFloat(discount) || 0;
        const totalAfterDiscount = Math.max(0, subtotal - discValue);
        
        const isClosed = command.status === 'paid' || isSuccessfullyClosed;
        const paidSource = isClosed ? historyPayments : addedPayments;
        
        const paid = paidSource.reduce((acc, p) => acc + Number(p.amount || p.gross_amount || 0), 0);
        const totalNet = paidSource.reduce((acc, p) => acc + Number(p.net || p.net_amount || 0), 0);
        
        const remaining = Math.max(0, totalAfterDiscount - paid);
        return { subtotal, total: isClosed ? paid : totalAfterDiscount, paid, remaining: isClosed ? 0 : remaining, totalNet };
    }, [command, discount, addedPayments, historyPayments, isSuccessfullyClosed]);

    const professionalName = useMemo(() => {
        if (command?.professional?.name) return command.professional.name;
        return 'Não informado';
    }, [command]);

    // FIX: Added missing useMemo for filteredMethodsForActiveCat to fix 'Cannot find name' error.
    const filteredMethodsForActiveCat = useMemo(() => {
        if (!activeCategory) return [];
        return dbMethods.filter(m => m.type === activeCategory);
    }, [dbMethods, activeCategory]);

    const handleInitPayment = (category: 'credit' | 'debit' | 'pix' | 'money') => {
        setActiveCategory(category);
        setAmountToPay(totals.remaining.toFixed(2));
        setSelectedInstallments(1);
        const defaultMethod = dbMethods.find(m => m.type === category);
        setSelectedMethodObj(defaultMethod || null);
    };

    const handleConfirmPartialPayment = () => {
        const val = parseFloat(amountToPay);
        if (!activeCategory || isNaN(val) || val <= 0 || !selectedMethodObj) return;
        
        const isFeeFree = activeCategory === 'pix' || activeCategory === 'money';
        let finalRate = 0;
        if (!isFeeFree) {
            finalRate = (selectedInstallments === 1) 
                ? Number(selectedMethodObj.rate_cash || 0) 
                : Number(selectedMethodObj.installment_rates?.[selectedInstallments.toString()] || selectedMethodObj.rate_installment_12x || 0);
        }

        const feeAmount = val * (finalRate / 100);
        const netAmount = val - feeAmount;

        const newPayment: PaymentEntry = {
            id: Math.random().toString(36).substring(2, 9),
            method: activeCategory,
            method_id: selectedMethodObj.id, // ID REAL DO BANCO
            amount: val,
            brand: isFeeFree ? 'DIRETO' : (selectedMethodObj?.brand || 'OUTROS'),
            rate: finalRate,
            fee: feeAmount,
            net: netAmount,
            installments: selectedInstallments
        };
        setAddedPayments(prev => [...prev, newPayment]);
        setActiveCategory(null);
    };

    const handleFinishPayment = async (e?: React.MouseEvent) => {
        if (e) e.preventDefault();
        if (!command?.id || !activeStudioId || isFinishing || addedPayments.length === 0) return;
        
        setIsFinishing(true);
        try {
            const methodMap: Record<string, string> = { 'money': 'cash', 'credit': 'credit', 'debit': 'debit', 'pix': 'pix' };

            for (const entry of addedPayments) {
                // RPC Segura: IDs passados explicitamente como NULL se vazios
                const { data: txId, error: rpcError } = await supabase.rpc('register_payment_transaction', {
                    p_amount: entry.amount,
                    p_brand: String(entry.brand || 'DIRETO'),
                    p_client_id: command.client_id ? String(command.client_id) : null,
                    p_command_id: String(commandId),
                    p_description: `Checkout Comanda #${commandId.split('-')[0].toUpperCase()}`,
                    p_fee_amount: entry.fee,
                    p_installments: entry.installments,
                    p_method: methodMap[entry.method] || 'pix',
                    p_net_value: entry.net,
                    p_professional_id: command.professional_id ? String(command.professional_id) : null,
                    p_studio_id: String(activeStudioId)
                });
                
                if (rpcError) throw rpcError;

                // PERSISTÊNCIA CORRETA NA TABELA DE PAGAMENTOS
                await supabase.from('command_payments').insert([{
                    command_id: commandId,
                    studio_id: activeStudioId,
                    financial_transaction_id: txId,
                    method_id: entry.method_id, // Usando a FK correta
                    gross_amount: entry.amount,
                    fee_value: entry.fee, // Alinhado com schema: fee_value
                    net_amount: entry.net,
                    brand: entry.brand,
                    installments: entry.installments
                }]);
            }

            await supabase.from('commands').update({ 
                status: 'paid', 
                closed_at: new Date().toISOString(),
                total_amount: totals.paid
            }).eq('id', commandId);

            if (isMounted.current) {
                setIsSuccessfullyClosed(true);
                setAddedPayments([]);
                setToast({ message: "Liquidação realizada com sucesso!", type: 'success' });
                fetchSystemData();
            }
        } catch (e: any) {
            if (isMounted.current) {
                setToast({ message: `Erro: ${e.message}`, type: 'error' });
                setIsFinishing(false);
            }
        }
    };

    if (loading) return <div className="h-full flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-orange-500" size={40} /></div>;

    return (
        <div className="h-full flex flex-col bg-slate-50 font-sans text-left overflow-hidden">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center z-20 shadow-sm flex-shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 transition-colors"><ChevronLeft size={24} /></button>
                    <div>
                        <h1 className="text-xl font-black text-slate-800">Checkout <span className="text-orange-500">#{command.id.toString().split('-')[0].toUpperCase()}</span></h1>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Controle de Baixa Financeira</p>
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
                <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 pb-10">
                    <div className="lg:col-span-2 space-y-6">
                        {isSuccessfullyClosed && (
                            <div className="bg-emerald-600 rounded-[40px] p-10 text-white shadow-2xl animate-in zoom-in-95 duration-500 flex flex-col items-center text-center">
                                <CheckCircle2 size={64} className="mb-4" />
                                <h2 className="text-3xl font-black uppercase tracking-widest">Pagamento Confirmado</h2>
                                <p className="text-emerald-100 mt-2">Os valores líquidos foram creditados no fluxo de caixa.</p>
                            </div>
                        )}

                        <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
                            <header className="px-8 py-5 border-b border-slate-50 bg-slate-50/30 flex items-center gap-2">
                                <Sparkles size={18} className="text-orange-500" />
                                <h3 className="font-black text-slate-800 text-sm uppercase tracking-widest">Resumo do Atendimento</h3>
                            </header>
                            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center shadow-sm border border-orange-100">
                                        <User size={24} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Cliente</p>
                                        <p className="font-black text-slate-700 text-lg leading-tight">{resolvedClientName}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center shadow-sm border border-orange-100">
                                        <Scissors size={24} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Profissional</p>
                                        <p className="font-black text-slate-700 text-lg leading-tight">{professionalName}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
                            <header className="px-8 py-5 border-b border-slate-50 bg-slate-50/30 flex items-center gap-2">
                                <ShoppingCart size={18} className="text-orange-500" />
                                <h3 className="font-black text-slate-800 text-sm uppercase tracking-widest">Serviços e Itens</h3>
                            </header>
                            <div className="divide-y divide-slate-50">
                                {command.command_items?.map((item: any) => (
                                    <div key={item.id} className="p-6 flex justify-between items-center">
                                        <div><p className="font-black text-slate-700">{item.title}</p><p className="text-[10px] text-slate-400 font-bold uppercase">{item.quantity} un x R$ {Number(item.price).toFixed(2)}</p></div>
                                        <p className="font-black text-slate-800">R$ {(item.price * item.quantity).toFixed(2)}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
                            <header className="px-8 py-5 bg-slate-800 text-white flex justify-between items-center">
                                <h3 className="font-black text-sm uppercase tracking-widest">Canais de Pagamento Utilizados</h3>
                                <span className="text-[10px] font-black bg-white/10 px-3 py-1 rounded-full">RECEBIDO: R$ {totals.paid.toFixed(2)}</span>
                            </header>
                            <div className="divide-y divide-slate-50">
                                {(isSuccessfullyClosed ? historyPayments : addedPayments).length === 0 ? (
                                    <div className="p-10 text-center text-slate-300 italic text-sm">Aguardando lançamento de pagamento...</div>
                                ) : (
                                    (isSuccessfullyClosed ? historyPayments : addedPayments).map((p: any, idx: number) => (
                                        <div key={p.id || idx} className="p-6 flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="p-3 bg-slate-50 rounded-2xl text-slate-400">
                                                    {['PIX', 'pix'].includes(p.payment_channel || p.method) ? <Smartphone size={20}/> : <Coins size={20}/>}
                                                </div>
                                                <div>
                                                    <p className="font-black text-slate-700 text-sm uppercase">
                                                        {(p.payment_channel || p.method || 'PAGAMENTO').toUpperCase()} {p.brand && `• ${p.brand}`}
                                                        {p.installments > 1 && ` (${p.installments}x)`}
                                                    </p>
                                                    <p className="text-[9px] font-black text-emerald-500 uppercase tracking-tighter">
                                                        Líquido: R$ {(p.net || p.net_amount || 0).toFixed(2)}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-black text-slate-800">R$ {(p.amount || p.gross_amount || 0).toFixed(2)}</p>
                                                {!isSuccessfullyClosed && (
                                                    <button onClick={() => setAddedPayments(prev => prev.filter(i => i.id !== p.id))} className="text-[10px] text-rose-500 font-bold hover:underline">Remover</button>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-slate-900 rounded-[48px] p-10 text-white shadow-2xl relative overflow-hidden">
                            <div className="relative z-10 space-y-6">
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs font-black uppercase text-slate-400"><span>Subtotal Bruto</span><span>R$ {totals.subtotal.toFixed(2)}</span></div>
                                    {!isSuccessfullyClosed && (
                                        <div className="flex justify-between items-center text-orange-400">
                                            <span className="text-xs font-black uppercase">Desconto Extra</span>
                                            <input type="number" value={discount} onChange={e => setDiscount(e.target.value)} className="w-20 bg-white/10 border-none rounded-lg px-2 py-1 text-right text-white font-black" />
                                        </div>
                                    )}
                                </div>
                                <div className="pt-6 border-t border-white/10">
                                    <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Total Líquido (Real em Caixa)</p>
                                    <h2 className="text-5xl font-black tracking-tighter text-emerald-400">R$ {totals.totalNet.toFixed(2)}</h2>
                                    <p className="text-[10px] font-bold text-slate-500 mt-2">TOTAL BRUTO: R$ {totals.paid.toFixed(2)}</p>
                                </div>
                            </div>
                        </div>

                        {!isSuccessfullyClosed && (
                            <div className="bg-white rounded-[48px] p-8 border border-slate-100 shadow-sm space-y-6">
                                {activeCategory ? (
                                    <div className="space-y-6 animate-in zoom-in-95">
                                        <div className="flex justify-between items-center">
                                            <h4 className="text-[10px] font-black uppercase text-orange-600 tracking-widest">Configurar {activeCategory}</h4>
                                            <button onClick={() => setActiveCategory(null)} className="p-1 hover:bg-slate-100 rounded-lg"><X size={18}/></button>
                                        </div>
                                        <div className="space-y-2"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Valor do Pagamento</label><div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-300">R$</span><input type="number" value={amountToPay} onChange={e => setAmountToPay(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-2xl font-black text-slate-800 outline-none focus:border-orange-400 transition-all" /></div></div>
                                        <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Operadora / Bandeira</label><select value={selectedMethodObj?.id || ''} onChange={e => setSelectedMethodObj(dbMethods.find(m => m.id === e.target.value))} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 font-bold text-slate-700 outline-none">{filteredMethodsForActiveCat.map(m => (<option key={m.id} value={m.id}>{m.name} {m.brand ? `(${m.brand})` : ''}</option>))}</select></div>
                                        <button onClick={handleConfirmPartialPayment} className="w-full bg-slate-800 text-white font-black py-4 rounded-2xl shadow-lg active:scale-95 transition-all">Registrar Pagamento</button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-3">
                                        {categories.map(pm => (
                                            <button key={pm.id} onClick={() => handleInitPayment(pm.id as any)} className="flex flex-col items-center justify-center p-6 rounded-[32px] border-2 border-slate-50 bg-slate-50/50 text-slate-400 hover:border-orange-200 hover:bg-white transition-all active:scale-95 group"><pm.icon size={28} className="mb-3 group-hover:text-orange-500 transition-colors" /><span className="text-[10px] font-black uppercase tracking-tighter">{pm.label}</span></button>
                                        ))}
                                    </div>
                                )}
                                <button onClick={(e) => handleFinishPayment(e)} disabled={isFinishing || totals.remaining > 0.05 || (isSuccessfullyClosed ? historyPayments : addedPayments).length === 0} className={`w-full mt-6 py-6 rounded-[32px] font-black flex items-center justify-center gap-3 text-lg uppercase tracking-widest transition-all ${totals.remaining < 0.05 && addedPayments.length > 0 ? 'bg-emerald-600 text-white shadow-2xl hover:bg-emerald-700' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}>{isFinishing ? <Loader2 className="animate-spin" size={24} /> : <><CheckCircle size={24} /> LIQUIDAR COMANDA</>}</button>
                            </div>
                        )}
                        {isSuccessfullyClosed && (
                            <button onClick={onBack} className="w-full py-6 rounded-[32px] bg-slate-800 text-white font-black text-lg uppercase tracking-widest shadow-xl hover:bg-slate-900 transition-all active:scale-95 flex items-center justify-center gap-3"><ArrowRight size={24} /> Próximo Atendimento</button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CommandDetailView;
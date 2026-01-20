
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
    method_id: string;
    amount: number;
    brand: string;
    installments: number;
}

const CommandDetailView: React.FC<CommandDetailViewProps> = ({ commandId, onBack }) => {
    const { activeStudioId } = useStudio();
    const isMounted = useRef(true);
    
    const [loading, setLoading] = useState(true);
    const [isFinishing, setIsFinishing] = useState(false);
    const [isSuccessfullyClosed, setIsSuccessfullyClosed] = useState(false);
    
    // Estados do Contexto unificado via RPC (JSON)
    const [command, setCommand] = useState<any>(null);
    const [client, setClient] = useState<any>(null);
    const [professional, setProfessional] = useState<any>(null);
    const [items, setItems] = useState<any[]>([]);
    const [dbMethods, setDbMethods] = useState<any[]>([]);
    const [historyPayments, setHistoryPayments] = useState<any[]>([]); 
    
    const [activeCategory, setActiveCategory] = useState<'credit' | 'debit' | 'pix' | 'money' | null>(null);
    const [selectedMethodObj, setSelectedMethodObj] = useState<any>(null);
    const [selectedInstallments, setSelectedInstallments] = useState<number>(1);
    const [amountToPay, setAmountToPay] = useState<string>('0');
    
    const [discount, setDiscount] = useState<string>('0');
    const [addedPayments, setAddedPayments] = useState<PaymentEntry[]>([]);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);

    const fetchSystemData = async () => {
        if (!activeStudioId || !commandId) return;
        setLoading(true);
        try {
            // ✅ CORREÇÃO 5.1: Usando RPC para evitar Erro 400 (relation professionals does not exist)
            const { data, error } = await supabase.rpc('get_checkout_context', {
                p_command_id: commandId
            });

            if (error) throw error;
            if (!data) throw new Error("Falha ao obter contexto da comanda.");

            if (isMounted.current) {
                // Mapeando dados do JSON retornado pelo RPC
                setCommand(data.command);
                setClient(data.client);
                setProfessional(data.professional); // team_members
                setItems(data.items || []);
                
                // Normaliza métodos de pagamento para a UI
                const normalizedMethods = (data.methods || []).map((m: any) => ({
                    id: m.id,
                    name: m.name,
                    type: (m.type || m.method_type || '').toLowerCase(),
                    brand: m.brand || 'OUTRAS',
                    max_installments: m.max_installments || 1
                }));
                setDbMethods(normalizedMethods);
                
                // Busca histórico via View auditada
                const { data: historyRes } = await supabase
                    .from('v_command_payments_history')
                    .select('*')
                    .eq('command_id', commandId);
                
                setHistoryPayments(historyRes || []);
                
                if (data.command?.status === 'paid') {
                    setIsSuccessfullyClosed(true);
                }
            }
        } catch (e: any) {
            console.error("Fetch Error:", e);
            if (isMounted.current) setToast({ message: "Erro ao sincronizar checkout.", type: 'error' });
        } finally {
            if (isMounted.current) setLoading(false);
        }
    };

    useEffect(() => { fetchSystemData(); }, [commandId, activeStudioId]);

    const totals = useMemo(() => {
        if (!command) return { subtotal: 0, total: 0, paid: 0, remaining: 0, totalAfterDiscount: 0 };
        const subtotal = Number(command.total_amount || 0);
        const discValue = parseFloat(discount) || 0;
        const totalAfterDiscount = Math.max(0, subtotal - discValue);
        
        const isClosed = command.status === 'paid' || isSuccessfullyClosed;
        const paid = (isClosed ? historyPayments : addedPayments).reduce((acc, p) => acc + Number(p.amount || p.gross_amount || 0), 0);
        const remaining = Math.max(0, totalAfterDiscount - paid);
        
        return { subtotal, total: isClosed ? paid : totalAfterDiscount, paid, remaining, totalAfterDiscount };
    }, [command, discount, addedPayments, historyPayments, isSuccessfullyClosed]);

    const handleInitPayment = (category: 'credit' | 'debit' | 'pix' | 'money') => {
        setActiveCategory(category);
        setAmountToPay(totals.remaining.toFixed(2));
        setSelectedInstallments(1);
        const defaultMethod = dbMethods.find(m => m.type === category || (category === 'money' && m.type === 'cash'));
        setSelectedMethodObj(defaultMethod || null);
    };

    const handleConfirmPartialPayment = () => {
        const val = parseFloat(amountToPay);
        if (!activeCategory || isNaN(val) || val <= 0 || !selectedMethodObj) return;
        
        const newPayment: PaymentEntry = {
            id: Math.random().toString(36).substring(2, 9),
            method: activeCategory,
            method_id: selectedMethodObj.id,
            amount: val,
            brand: selectedMethodObj.brand || 'DIRETO',
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
                // ✅ CORREÇÃO: Usando estritamente register_payment_transaction_v2
                // Isso evita erros de colunas inexistentes como 'method' no command_payments
                const payload = {
                    p_studio_id: String(activeStudioId),
                    p_professional_id: command.professional_id ? String(command.professional_id) : null,
                    p_amount: Number(entry.amount),
                    p_method: methodMap[entry.method] || 'pix',
                    p_brand: String(entry.brand || 'DIRETO'),
                    p_installments: Number(entry.installments),
                    p_command_id: String(commandId),
                    p_client_id: command.client_id ? Number(command.client_id) : null,
                    p_description: `Checkout Comanda #${commandId.split('-')[0].toUpperCase()}`
                };

                // Logs de auditoria senior
                console.log('--- RPC register_payment_transaction_v2 ---');
                console.log('Payload:', payload);

                const { error: rpcError } = await supabase.rpc('register_payment_transaction_v2', payload);
                if (rpcError) throw rpcError;
            }
            
            if (isMounted.current) {
                setIsSuccessfullyClosed(true);
                setAddedPayments([]);
                setToast({ message: "Checkout finalizado com sucesso!", type: 'success' });
                await fetchSystemData();
            }
        } catch (e: any) {
            console.error("Checkout Error:", e);
            if (isMounted.current) {
                setToast({ message: `Falha na liquidação: ${e.message}`, type: 'error' });
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
                    <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors"><ChevronLeft size={24} /></button>
                    <div>
                        <h1 className="text-xl font-black text-slate-800">Checkout <span className="text-orange-500">#{commandId.split('-')[0].toUpperCase()}</span></h1>
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
                                <p className="text-emerald-100 mt-2">Valores auditados e creditados no caixa.</p>
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
                                        <p className="font-black text-slate-700 text-lg leading-tight">{client?.nome || 'Consumidor Final'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center shadow-sm border border-orange-100">
                                        <Briefcase size={24} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Profissional Responsável</p>
                                        <p className="font-black text-slate-700 text-lg leading-tight">{professional?.name || 'Venda Direta'}</p>
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
                                {items.map((item: any) => (
                                    <div key={item.id} className="p-6 flex justify-between items-center">
                                        <div><p className="font-black text-slate-700">{item.title}</p><p className="text-[10px] text-slate-400 font-bold uppercase">{item.quantity} un x R$ {Number(item.price).toFixed(2)}</p></div>
                                        <p className="font-black text-slate-800">R$ {(item.price * item.quantity).toFixed(2)}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
                            <header className="px-8 py-5 bg-slate-800 text-white flex justify-between items-center">
                                <h3 className="font-black text-sm uppercase tracking-widest">Canais de Pagamento</h3>
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
                                                    {['PIX', 'pix'].includes(p.method || p.payment_channel || p.payment_method) ? <Smartphone size={20}/> : <Coins size={20}/>}
                                                </div>
                                                <div>
                                                    <p className="font-black text-slate-700 text-sm uppercase">
                                                        {(p.payment_channel || p.payment_method || p.method || 'PAGAMENTO').toUpperCase()} {p.brand && `• ${p.brand}`}
                                                        {p.installments > 1 && ` (${p.installments}x)`}
                                                    </p>
                                                    {isSuccessfullyClosed && (
                                                        <p className="text-[9px] font-black text-emerald-500 uppercase tracking-tighter">Auditado pelo Banco</p>
                                                    )}
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
                                    <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Total a Liquidar</p>
                                    <h2 className="text-5xl font-black tracking-tighter text-emerald-400">R$ {totals.totalAfterDiscount.toFixed(2)}</h2>
                                    <p className="text-[10px] font-bold text-slate-500 mt-2">VALOR PAGO: R$ {totals.paid.toFixed(2)}</p>
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
                                        <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Operadora / Bandeira</label><select value={selectedMethodObj?.id || ''} onChange={e => setSelectedMethodObj(dbMethods.find(m => m.id === e.target.value))} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 font-bold text-slate-700 outline-none">{dbMethods.filter(m => m.type === activeCategory || (activeCategory === 'money' && m.type === 'cash')).map(m => (<option key={m.id} value={m.id}>{m.label} {m.brand ? `(${m.brand})` : ''}</option>))}</select></div>
                                        <button onClick={handleConfirmPartialPayment} className="w-full bg-slate-800 text-white font-black py-4 rounded-2xl shadow-lg active:scale-95 transition-all">Registrar Pagamento</button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-3">
                                        {[
                                            { id: 'pix', label: 'Pix', icon: Smartphone },
                                            { id: 'money', label: 'Dinheiro', icon: Banknote },
                                            { id: 'credit', label: 'Crédito', icon: CreditCard },
                                            { id: 'debit', label: 'Débito', icon: CreditCard },
                                        ].map(pm => (
                                            <button key={pm.id} onClick={() => handleInitPayment(pm.id as any)} className="flex flex-col items-center justify-center p-6 rounded-[32px] border-2 border-slate-50 bg-slate-50/50 text-slate-400 hover:border-orange-200 hover:bg-white transition-all active:scale-95 group"><pm.icon size={28} className="mb-3 group-hover:text-orange-500 transition-colors" /><span className="text-[10px] font-black uppercase tracking-tighter">{pm.label}</span></button>
                                        ))}
                                    </div>
                                )}
                                <button onClick={(e) => handleFinishPayment(e)} disabled={isFinishing || totals.remaining > 0.05 || addedPayments.length === 0} className={`w-full mt-6 py-6 rounded-[32px] font-black flex items-center justify-center gap-3 text-lg uppercase tracking-widest transition-all ${totals.remaining < 0.05 && addedPayments.length > 0 ? 'bg-emerald-600 text-white shadow-2xl hover:bg-emerald-700' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}>{isFinishing ? <Loader2 className="animate-spin" size={24} /> : <><CheckCircle size={24} /> LIQUIDAR COMANDA</>}</button>
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


import React, { useState, useEffect, useMemo } from 'react';
import { 
    ChevronLeft, CreditCard, Smartphone, Banknote, 
    Plus, Loader2, CheckCircle,
    Phone, Scissors, ShoppingBag, Receipt,
    Percent, Calendar, ShoppingCart, X, Coins,
    ArrowRight, ShieldCheck, Tag, CreditCard as CardIcon,
    User, UserCheck, Trash2, Lock, MoreVertical, AlertTriangle
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
    method: string;
    amount: number;
    brand?: string;
    installments: number;
    method_id: string;
    fee_rate: number;
    fee_value: number;
    net_amount: number;
}

const BRANDS = ['Visa', 'Mastercard', 'Elo', 'Hipercard', 'Amex', 'Outros'];

const isUUID = (str: any): boolean => {
    if (!str || typeof str !== 'string') return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
};

const CommandDetailView: React.FC<CommandDetailViewProps> = ({ commandId, onBack }) => {
    const { activeStudioId } = useStudio();
    const [command, setCommand] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isFinishing, setIsFinishing] = useState(false);
    const [isLocked, setIsLocked] = useState(false);
    
    const [addedPayments, setAddedPayments] = useState<PaymentEntry[]>([]);
    const [activeMethod, setActiveMethod] = useState<string | null>(null);
    const [selectedBrand, setSelectedBrand] = useState<string>('Visa');
    const [selectedInstallments, setSelectedInstallments] = useState<number>(1);
    const [amountToPay, setAmountToPay] = useState<string>('0');
    const [discount, setDiscount] = useState<string>('0');
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const [availableConfigs, setAvailableConfigs] = useState<any[]>([]);

    const fetchContext = async () => {
        if (!activeStudioId || !commandId) return;
        setLoading(true);
        
        try {
            // 1. Busca contexto via RPC v2 (Prioridade absoluta para nomes reais)
            const { data: contextData, error: ctxError } = await supabase.rpc('get_checkout_context_v2', {
                p_command_id: commandId
            });

            if (ctxError) console.warn("RPC Context Error:", ctxError);
            const context = Array.isArray(contextData) ? contextData[0] : contextData;

            // 2. Busca dados base da comanda com relação de cliente e configurações de taxas
            const [cmdRes, configsRes] = await Promise.all([
                supabase.from('commands').select('*, clients(nome, telefone), command_items(*)').eq('id', commandId).single(),
                supabase.from('payment_methods_config').select('*').eq('studio_id', activeStudioId).eq('is_active', true)
            ]);

            if (cmdRes.error) throw cmdRes.error;
            setAvailableConfigs(configsRes.data || []);

            const alreadyPaid = cmdRes.data.status === 'paid';
            setIsLocked(alreadyPaid);

            // 3. Mapeamento Inteligente: RPC -> Relação DB -> Fallback Texto
            setCommand({
                ...cmdRes.data,
                display_client_name: context?.client_display_name || cmdRes.data.clients?.nome || cmdRes.data.client_name || "Cliente sem cadastro",
                display_client_phone: context?.client_phone || cmdRes.data.clients?.telefone || "SEM CONTATO",
                display_professional_name: context?.professional_display_name || cmdRes.data.professional_name || "Geral / Studio",
                display_professional_photo: context?.professional_photo_url || null,
                professional_id: context?.professional_id || cmdRes.data.professional_id,
                client_id: context?.client_id || cmdRes.data.client_id
            });

        } catch (e: any) {
            console.error('[CHECKOUT_LOAD_ERROR]', e);
            setToast({ message: "Erro ao carregar contexto.", type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchContext(); }, [commandId, activeStudioId]);

    const totals = useMemo(() => {
        if (!command) return { subtotal: 0, total: 0, paid: 0, remaining: 0 };
        const subtotal = command.command_items?.reduce((acc: number, i: any) => acc + (Number(i.price || 0) * Number(i.quantity || 1)), 0) || 0;
        const discValue = parseFloat(discount) || 0;
        const totalAfterDiscount = Math.max(0, subtotal - discValue);
        const paid = addedPayments.reduce((acc, p) => acc + p.amount, 0);
        const remaining = Math.max(0, totalAfterDiscount - paid);
        return { subtotal, total: totalAfterDiscount, paid, remaining };
    }, [command, discount, addedPayments]);

    const handleInitPayment = (method: string) => {
        if (isLocked) return;
        setActiveMethod(method);
        setAmountToPay(totals.remaining.toFixed(2));
        setSelectedBrand('Visa');
        setSelectedInstallments(1);
    };

    const handleConfirmPartialPayment = () => {
        if (!activeMethod || isLocked) return;
        const amount = parseFloat(amountToPay.replace(',', '.'));
        if (isNaN(amount) || amount <= 0) return;

        const typeMap: Record<string, string> = {
            'pix': 'pix', 'dinheiro': 'money', 'cartao_credito': 'credit', 'cartao_debito': 'debit'
        };

        const config = availableConfigs.find(c => 
            c.type === (typeMap[activeMethod] || activeMethod) && 
            (c.type === 'pix' || c.type === 'money' || String(c.brand).toLowerCase() === selectedBrand.toLowerCase())
        );

        let feeRate = 0;
        if (config) {
            if (activeMethod === 'cartao_credito' && selectedInstallments > 1 && config.installment_rates) {
                feeRate = Number(config.installment_rates[selectedInstallments.toString()] || config.rate_cash || 0);
            } else {
                feeRate = Number(config.rate_cash || 0);
            }
        }

        const feeValue = Number((amount * (feeRate / 100)).toFixed(2));

        const newPayment: PaymentEntry = {
            id: Math.random().toString(36).substring(7),
            method: String(activeMethod),
            method_id: String(config?.id || 'manual'),
            amount: amount,
            installments: selectedInstallments,
            brand: String(selectedBrand),
            fee_rate: feeRate,
            fee_value: feeValue,
            net_amount: Number((amount - feeValue).toFixed(2))
        };

        setAddedPayments(prev => [...prev, newPayment]);
        setActiveMethod(null);
    };

    const handleFinishCheckout = async () => {
        if (!command || isFinishing || isLocked || addedPayments.length === 0) return;
        setIsFinishing(true);

        try {
            const studioId = String(activeStudioId);
            
            // 1. Garante que haja um client_id (Evita erro NULL)
            let clientId = command.client_id;
            if (!clientId) {
                const { data: defaultClient } = await supabase
                    .from('clients')
                    .select('id')
                    .eq('studio_id', studioId)
                    .eq('nome', 'Cliente sem cadastro')
                    .maybeSingle();
                
                clientId = defaultClient?.id;
                if (!clientId) {
                    const { data: newDefault } = await supabase
                        .from('clients')
                        .insert([{ nome: 'Cliente sem cadastro', studio_id: studioId, consent: true }])
                        .select().single();
                    clientId = newDefault.id;
                }
                await supabase.from('commands').update({ client_id: clientId }).eq('id', commandId);
            }

            // 2. Prevenção de Duplicidade (Erro 23505)
            const { data: existing } = await supabase.from('financial_transactions').select('id').eq('command_id', commandId).maybeSingle();
            
            if (!existing) {
                const methodMap: Record<string, string> = {
                    'pix': 'pix', 'dinheiro': 'cash', 'cartao_credito': 'credit', 'cartao_debito': 'debit'
                };

                const totalAmount = addedPayments.reduce((acc, p) => acc + p.amount, 0);
                const primaryPayment = addedPayments[0];

                const { error: rpcError } = await supabase.rpc('register_payment_transaction', {
                    p_studio_id: studioId,
                    p_professional_id: isUUID(command.professional_id) ? command.professional_id : null,
                    p_command_id: commandId,
                    p_amount: Number(totalAmount),
                    p_method: methodMap[primaryPayment.method] || 'pix',
                    p_brand: primaryPayment.brand || null,
                    p_installments: Number(primaryPayment.installments || 1)
                });

                if (rpcError) {
                    const isDuplicate = rpcError.code === '23505' || rpcError.message?.includes('ux_command_payments_one_paid_per_command');
                    if (!isDuplicate) throw new Error(rpcError.message);
                }
            }

            // 3. Marca comanda como paga
            const { error: closeError } = await supabase
                .from('commands')
                .update({ 
                    status: 'paid', 
                    closed_at: new Date().toISOString(),
                    total_amount: Number(totals.total),
                    client_id: clientId
                })
                .eq('id', commandId);

            if (closeError) throw closeError;

            setToast({ message: "Checkout finalizado com sucesso! ✅", type: 'success' });
            setIsLocked(true);
            setTimeout(onBack, 1500);
        } catch (e: any) {
            console.error('[FINISH_ERROR]', e);
            setToast({ message: `Erro financeiro: ${e.message}`, type: 'error' });
        } finally {
            setIsFinishing(false);
        }
    };

    if (loading) return <div className="h-full flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-orange-500" size={48} /></div>;
    if (!command) return <div className="p-8 text-center text-slate-500">Comanda não encontrada.</div>;

    const currentCommandIdDisplay = String(commandId).substring(0, 8).toUpperCase();

    return (
        <div className="h-full flex flex-col bg-slate-50 font-sans text-left overflow-hidden">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center z-20 shadow-sm flex-shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 transition-all"><ChevronLeft size={24} /></button>
                    <div>
                        <h1 className="text-xl font-black text-slate-800">Checkout <span className="text-orange-500 font-mono">#{currentCommandIdDisplay}</span></h1>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                            Profissional: {command.display_professional_name}
                        </p>
                    </div>
                </div>
                <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${command.status === 'open' ? 'bg-orange-50 text-orange-600 border border-orange-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                    {command.status === 'open' ? 'Em aberto' : 'Finalizada'}
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
                <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 pb-10">
                    <div className="lg:col-span-2 space-y-6">
                        {/* CARD CLIENTE */}
                        <div className="bg-white rounded-[40px] border border-slate-100 p-8 shadow-sm flex flex-col md:flex-row items-center gap-6">
                            <div className="w-20 h-20 bg-orange-100 text-orange-600 rounded-3xl flex items-center justify-center font-black text-2xl uppercase overflow-hidden">
                                {command.display_professional_photo ? (
                                    <img src={command.display_professional_photo} className="w-full h-full object-cover" />
                                ) : (
                                    command.display_client_name.charAt(0)
                                )}
                            </div>
                            <div className="flex-1 text-center md:text-left">
                                <h3 className="text-2xl font-black text-slate-800 leading-tight">{command.display_client_name}</h3>
                                <div className="flex flex-wrap justify-center md:justify-start gap-4 mt-2">
                                    <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-tighter"><Phone size={14} className="text-orange-500" /> {command.display_client_phone}</div>
                                    <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-tighter"><UserCheck size={14} className="text-orange-500" /> {command.display_professional_name}</div>
                                    <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-tighter"><Calendar size={14} className="text-orange-500" /> {format(new Date(command.created_at), "dd/MM 'às' HH:mm", { locale: pt })}</div>
                                </div>
                            </div>
                        </div>

                        {/* DETALHES DO CONSUMO */}
                        <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
                            <header className="px-8 py-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
                                <h3 className="font-black text-slate-800 text-sm uppercase tracking-widest flex items-center gap-2"><ShoppingCart size={18} className="text-orange-500" /> Detalhes do Consumo</h3>
                            </header>
                            <div className="divide-y divide-slate-50">
                                {command.command_items?.map((item: any) => (
                                    <div key={item.id} className="p-8 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                                        <div className="flex items-center gap-5">
                                            <div className={`p-4 rounded-3xl ${item.product_id ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>{item.product_id ? <ShoppingBag size={24} /> : <Scissors size={24} />}</div>
                                            <div>
                                                <p className="font-black text-slate-800 text-lg leading-tight">{item.title}</p>
                                                <p className="text-[10px] text-slate-400 font-black uppercase mt-1">{item.quantity} un. x R$ {Number(item.price || 0).toFixed(2)}</p>
                                            </div>
                                        </div>
                                        <p className="font-black text-slate-800 text-xl">R$ {(Number(item.price || 0) * Number(item.quantity || 1)).toFixed(2)}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* RECEBIMENTOS LANÇADOS */}
                        {addedPayments.length > 0 && (
                            <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden animate-in slide-in-from-bottom-4">
                                <header className="px-8 py-5 border-b border-slate-50 bg-emerald-50/50">
                                    <h3 className="font-black text-emerald-800 text-xs uppercase tracking-widest flex items-center gap-2"><CheckCircle size={16} /> Recebimentos Lançados</h3>
                                </header>
                                <div className="divide-y divide-slate-50">
                                    {addedPayments.map(p => (
                                        <div key={p.id} className="px-8 py-5 flex items-center justify-between bg-white">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500"><Coins size={20} /></div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-black text-slate-700 uppercase">{String(p.method).replace('_', ' ')}</span>
                                                        {p.brand && <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{String(p.brand)} ({p.installments}x)</span>}
                                                    </div>
                                                    <div className="flex gap-3 mt-0.5">
                                                        <p className="text-[9px] font-black text-rose-500 uppercase">TAXA: {p.fee_rate}% (- R$ {p.fee_value.toFixed(2)})</p>
                                                        <p className="text-[9px] font-black text-emerald-600 uppercase">LÍQUIDO: R$ {p.net_amount.toFixed(2)}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-6">
                                                <span className="font-black text-slate-800 text-lg">R$ {Number(p.amount).toFixed(2)}</span>
                                                {!isLocked && <button onClick={() => setAddedPayments(prev => prev.filter(item => item.id !== p.id))} className="p-2 text-slate-200 hover:text-rose-500 transition-colors"><X size={20} strokeWidth={3} /></button>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="space-y-6">
                        {/* CARD FINANCEIRO */}
                        <div className="bg-slate-900 rounded-[48px] p-10 text-white shadow-2xl relative overflow-hidden">
                            <div className="relative z-10 space-y-6">
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs font-black uppercase tracking-widest text-slate-400"><span>Subtotal</span><span>R$ {totals.subtotal.toFixed(2)}</span></div>
                                    <div className="flex justify-between items-center"><div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-orange-400"><Percent size={14} /> Desconto</div><input type="number" value={discount} disabled={isLocked} onChange={e => setDiscount(e.target.value)} className="w-24 bg-white/10 border border-white/10 rounded-xl px-3 py-1.5 text-right font-black text-white outline-none focus:ring-2 focus:ring-orange-500 transition-all" /></div>
                                </div>
                                <div className="pt-6 border-t border-white/10">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Total a Receber</p>
                                    <h2 className="text-5xl font-black tracking-tighter text-emerald-400">R$ {totals.total.toFixed(2)}</h2>
                                </div>
                                {totals.paid > 0 && (
                                    <div className="bg-white/5 p-4 rounded-3xl border border-white/10 space-y-3">
                                        <div className="flex justify-between text-xs font-bold"><span className="text-slate-400">Total Pago:</span><span className="text-emerald-400">R$ {totals.paid.toFixed(2)}</span></div>
                                        <div className="flex justify-between items-center pt-2 border-t border-white/5"><span className="text-xs font-black uppercase tracking-widest text-orange-400">Restante:</span><span className={`text-xl font-black ${totals.remaining === 0 ? 'text-emerald-400' : 'text-white'}`}>R$ {totals.remaining.toFixed(2)}</span></div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* SELEÇÃO DE PAGAMENTO */}
                        <div className="bg-white rounded-[48px] p-8 border border-slate-100 shadow-sm space-y-6">
                            {!isLocked ? (
                                <>
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 flex items-center gap-2"><Tag size={14} className="text-orange-500" /> Forma de Recebimento</h4>
                                    {activeMethod ? (
                                        <div className="bg-slate-50 p-6 rounded-[32px] border-2 border-orange-500 animate-in zoom-in-95 space-y-6">
                                            <div className="flex justify-between items-center"><span className="text-[10px] font-black uppercase text-orange-600 tracking-widest">{String(activeMethod).replace('_', ' ')}</span><button onClick={() => setActiveMethod(null)} className="text-slate-300"><X size={20}/></button></div>
                                            <div className="space-y-4">
                                                {(activeMethod === 'cartao_credito' || activeMethod === 'cartao_debito') && (
                                                    <div className="grid grid-cols-3 gap-2">{BRANDS.map(b => (<button key={b} onClick={() => setSelectedBrand(b)} className={`py-2 rounded-xl text-[9px] font-black uppercase transition-all ${selectedBrand === b ? 'bg-orange-500 text-white' : 'bg-white border-slate-100 text-slate-400'}`}>{b}</button>))}</div>
                                                )}
                                                <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-300">R$</span><input type="number" value={amountToPay} onChange={e => setAmountToPay(e.target.value)} className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-2xl font-black text-slate-800 outline-none" /></div>
                                            </div>
                                            <button onClick={handleConfirmPartialPayment} className="w-full bg-slate-800 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg">Confirmar Parcela</button>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-3">
                                            {[
                                                { id: 'pix', label: 'Pix', icon: Smartphone },
                                                { id: 'dinheiro', label: 'Dinheiro', icon: Banknote },
                                                { id: 'cartao_credito', label: 'Crédito', icon: CreditCard },
                                                { id: 'cartao_debito', label: 'Débito', icon: CardIcon }
                                            ].map(pm => (
                                                <button key={pm.id} onClick={() => handleInitPayment(pm.id)} className="flex flex-col items-center justify-center p-6 rounded-[32px] bg-slate-50 text-slate-400 hover:border-orange-200 hover:bg-white transition-all active:scale-95 group">
                                                    <pm.icon size={28} className="mb-3 text-slate-300 group-hover:text-orange-500 transition-colors" />
                                                    <span className="text-[10px] font-black uppercase tracking-tighter">{pm.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="bg-emerald-50 p-8 rounded-[32px] border-2 border-emerald-100 text-center space-y-4">
                                    <CheckCircle size={40} className="text-emerald-500 mx-auto" />
                                    <p className="text-emerald-800 font-black text-lg uppercase tracking-tighter">Comanda Liquidada</p>
                                </div>
                            )}
                            
                            <button 
                                onClick={handleFinishCheckout} 
                                disabled={isLocked || isFinishing || totals.remaining > 0 || addedPayments.length === 0} 
                                className={`w-full mt-6 py-6 rounded-[32px] font-black flex items-center justify-center gap-3 text-lg uppercase tracking-widest shadow-2xl transition-all ${!isLocked && totals.remaining === 0 && addedPayments.length > 0 ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-300'}`}
                            >
                                {isFinishing ? (<Loader2 size={24} className="animate-spin" />) : isLocked ? (<><CheckCircle size={24} /> FINALIZADO</>) : (<><CheckCircle size={24} /> FECHAR CHECKOUT</>)}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CommandDetailView;

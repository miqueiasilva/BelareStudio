import React, { useState, useEffect, useMemo } from 'react';
import { 
    ChevronLeft, CreditCard, Smartphone, Banknote, 
    Plus, Loader2, CheckCircle,
    Phone, Scissors, ShoppingBag, Receipt,
    Percent, Calendar, ShoppingCart, X, Coins,
    ArrowRight, ShieldCheck, Tag,
    User, UserCheck, Trash2, Lock, MoreVertical, AlertTriangle,
    Clock, Landmark, ChevronRight, Calculator, Layers,
    CheckCircle2, Printer, Share2, ArrowDownCircle, Info,
    ArrowLeft // FIX: Added missing ArrowLeft import from lucide-react
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR as pt } from 'date-fns/locale/pt-BR';
import { supabase } from '../../services/supabaseClient';
import { useStudio } from '../../contexts/StudioContext';
import Toast, { ToastType } from '../shared/Toast';

interface CommandDetailViewProps {
    commandId: string;
    onBack: () => void;
}

interface PaymentEntry {
    id: string;
    method: string;
    amount: number;
    installments: number;
    fee_rate: number;
    fee_amount: number; 
    net_value: number;
    brand?: string;
    method_id?: string; 
    created_at?: string;
}

const formatBRL = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const isSafeUUID = (id: any): boolean => {
    if (!id) return false;
    const sid = String(id).trim();
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sid) || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sid);
};

const CommandDetailView: React.FC<CommandDetailViewProps> = ({ commandId, onBack }) => {
    const { activeStudioId } = useStudio();
    const [command, setCommand] = useState<any>(null);
    const [items, setItems] = useState<any[]>([]);
    const [historyPayments, setHistoryPayments] = useState<PaymentEntry[]>([]);
    const [availableConfigs, setAvailableConfigs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFinishing, setIsFinishing] = useState(false);
    
    // Estados do Terminal para Comandas Abertas
    const [addedPayments, setAddedPayments] = useState<PaymentEntry[]>([]);
    const [paymentStep, setPaymentStep] = useState<'type' | 'brand' | 'installments' | 'confirm'>('type');
    const [selectedType, setSelectedType] = useState<string | null>(null);
    const [selectedConfig, setSelectedConfig] = useState<any | null>(null);
    const [installments, setInstallments] = useState<number>(1);
    const [amountToPay, setAmountToPay] = useState<string>('0');
    const [discount, setDiscount] = useState<string>('0');
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    /**
     * Defensive rendering for closed commands: 
     * Normaliza os dados crus do banco para evitar crashes por propriedades undefined.
     */
    const normalizeCommandData = (rawCommand: any) => {
        if (!rawCommand) return null;
        return {
            ...rawCommand,
            client_name: rawCommand.client_name || rawCommand.clients?.nome || rawCommand.clients?.name || "CONSUMIDOR FINAL",
            client_photo_url: rawCommand.client_photo_url || rawCommand.clients?.photo_url || null,
            discount_amount: Number(rawCommand.discount_amount || 0),
            total_amount: Number(rawCommand.total_amount || 0),
            status: rawCommand.status || 'open',
            created_at: rawCommand.created_at || new Date().toISOString(),
            professional_name: rawCommand.professional_name || "Geral"
        };
    };

    const fetchContext = async () => {
        if (!activeStudioId || !commandId) return;
        
        setLoading(true);
        try {
            const { data, error } = await supabase.rpc('get_command_full', { 
                p_command_id: commandId 
            });

            if (error) throw error;

            if (!data || !data.command) {
                setCommand(null);
                setLoading(false);
                return;
            }

            const { data: configs } = await supabase
                .from('payment_methods_config')
                .select('*')
                .eq('studio_id', activeStudioId)
                .eq('is_active', true);

            setAvailableConfigs(configs || []);
            
            // Aplica normalização defensiva antes de setar o estado
            const safeCommand = normalizeCommandData(data.command);
            setCommand(safeCommand);
            setItems(data.items || []);
            
            // Mapeia pagamentos históricos garantindo números válidos
            const safePayments = (data.payments || []).map((p: any) => ({
                ...p,
                amount: Number(p.amount || 0),
                fee_rate: Number(p.fee_rate || 0),
                fee_amount: Number(p.fee_amount || 0),
                net_value: Number(p.net_value || p.net_amount || p.amount || 0),
                installments: Number(p.installments || 1)
            }));
            setHistoryPayments(safePayments);
            
            if (safeCommand?.discount_amount) {
                setDiscount(safeCommand.discount_amount.toString());
            }

        } catch (e: any) {
            console.error('[FETCH_CONTEXT_ERROR]', e);
            setToast({ message: "Falha ao carregar dados da comanda.", type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchContext(); }, [commandId, activeStudioId]);

    const isPaid = command?.status === 'paid';

    const totals = useMemo(() => {
        if (!command) return { subtotal: 0, total: 0, paid: 0, remaining: 0, fees: 0 };
        const subtotal = items.reduce((acc, i) => acc + (Number(i.price || 0) * Number(i.quantity || 1)), 0);
        const discValue = parseFloat(discount) || 0;
        const totalAfterDiscount = Math.max(0, subtotal - discValue);
        
        const allPayments = [...historyPayments, ...addedPayments];
        const paid = allPayments.reduce((acc, p) => acc + Number(p.amount), 0);
        const fees = allPayments.reduce((acc, p) => acc + Number(p.fee_amount || 0), 0);
        const remaining = Math.max(0, totalAfterDiscount - paid);
        
        return { subtotal, total: totalAfterDiscount, paid, remaining, fees };
    }, [command, items, discount, addedPayments, historyPayments]);

    const filteredConfigs = useMemo(() => {
        if (!selectedType) return [];
        const typeMap: Record<string, string> = {
            'pix': 'pix', 'money': 'money', 'debit': 'debit', 'credit': 'credit', 'parcelado': 'credit'
        };
        const targetType = typeMap[selectedType];
        return availableConfigs.filter(c => {
            const matchType = c.type === targetType;
            if (selectedType === 'parcelado') return matchType && (c.max_installments >= 2 || c.allow_installments);
            return matchType;
        });
    }, [selectedType, availableConfigs]);

    const handleSelectType = (type: string) => {
        setSelectedType(type);
        setAmountToPay(totals.remaining.toFixed(2));
        setSelectedConfig(null);
        setInstallments(1);

        if (type === 'pix' || type === 'money') {
            const config = availableConfigs.find(c => c.type === (type === 'money' ? 'money' : 'pix'));
            if (config) {
                setSelectedConfig(config);
                setPaymentStep('confirm');
            } else {
                setSelectedConfig({ type, name: type.toUpperCase(), rate_cash: 0 });
                setPaymentStep('confirm');
            }
        } else {
            setPaymentStep('brand');
        }
    };

    const handleConfirmPartialPayment = () => {
        if (!selectedConfig) return;
        const amount = parseFloat(amountToPay.replace(',', '.'));
        if (isNaN(amount) || amount <= 0) return;

        const feeRate = installments > 1 
            ? (selectedConfig.installment_rates?.[installments] || selectedConfig.rate_cash || 0)
            : (selectedConfig.rate_cash || 0);
            
        const feeAmount = Number((amount * (feeRate / 100)).toFixed(2));
        const netValue = Number((amount - feeAmount).toFixed(2));

        const newPayment: PaymentEntry = {
            id: Math.random().toString(36).substring(7),
            method: selectedConfig.type,
            amount: amount,
            installments: installments,
            fee_rate: Number(feeRate),
            fee_amount: feeAmount,
            net_value: netValue,
            brand: selectedConfig.brand || selectedConfig.name,
            method_id: selectedConfig.id
        };

        setAddedPayments(prev => [...prev, newPayment]);
        setSelectedType(null);
        setSelectedConfig(null);
        setInstallments(1);
        setPaymentStep('type');
    };

    const handleFinishCheckout = async () => {
        if (isFinishing || isPaid || !command) return;
        setIsFinishing(true);

        try {
            const profId = isSafeUUID(command.professional_id) ? command.professional_id : null;

            for (const p of addedPayments) {
                const { data: txId, error: txErr } = await supabase.rpc('register_payment_transaction', {
                    p_studio_id: activeStudioId,
                    p_professional_id: profId,
                    p_amount: p.amount,
                    p_method: p.method,
                    p_brand: p.brand || null,
                    p_installments: p.installments,
                    p_command_id: command.id,
                    p_client_id: command.client_id
                });

                if (txErr) throw txErr;

                await supabase.from('command_payments').insert([{
                    command_id: command.id,
                    studio_id: activeStudioId,
                    financial_transaction_id: txId,
                    method_id: p.method_id || null,
                    amount: p.amount,
                    fee_amount: p.fee_amount,
                    net_value: p.net_value,
                    fee_rate: p.fee_rate,
                    installments: p.installments,
                    brand: p.brand || null,
                    status: 'paid'
                }]);
            }

            await supabase.from('commands').update({ 
                status: 'paid', 
                closed_at: new Date().toISOString(),
                total_amount: totals.total,
                discount_amount: parseFloat(discount) || 0
            }).eq('id', command.id);

            setToast({ message: "Venda finalizada!", type: 'success' });
            setTimeout(onBack, 800);
        } catch (e: any) {
            console.error(e);
            setToast({ message: "Erro ao liquidar comanda.", type: 'error' });
        } finally {
            setIsFinishing(false);
        }
    };

    if (loading) return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-orange-500" size={48} /></div>;

    // Estado vazio amigável caso a comanda não seja carregada
    if (!command) return (
        <div className="h-full flex flex-col items-center justify-center p-8 bg-slate-50">
            <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-[32px] flex items-center justify-center mb-6 shadow-sm">
                <AlertTriangle size={40} />
            </div>
            <h2 className="text-xl font-black text-slate-800 uppercase">Comanda não encontrada</h2>
            <p className="text-slate-500 mt-2 font-medium text-center max-w-xs">O registro pode ter sido removido ou não pertence a esta unidade.</p>
            <button onClick={onBack} className="mt-8 flex items-center gap-2 px-8 py-3 bg-slate-800 text-white font-bold rounded-2xl transition-all active:scale-95">
                <ArrowLeft size={18} /> Voltar para Lista
            </button>
        </div>
    );

    return (
        <div className="h-full flex flex-col bg-slate-50 font-sans text-left overflow-hidden">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center z-20 shadow-sm flex-shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 transition-all"><ChevronLeft size={24} /></button>
                    <div>
                        <h1 className="text-xl font-black text-slate-800 uppercase tracking-tighter">
                            {isPaid ? 'Comanda Arquivada' : 'Finalizar Atendimento'}
                        </h1>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Ref: {commandId.substring(0,8).toUpperCase()}</p>
                    </div>
                </div>
                <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${isPaid ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-orange-50 text-orange-600 border border-orange-100'}`}>
                    {isPaid ? 'Liquidado' : 'Em Aberto'}
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
                <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 pb-20">
                    
                    {/* COLUNA ESQUERDA: CLIENTE E ITENS */}
                    <div className="lg:col-span-8 space-y-6">
                        {/* Header Cliente */}
                        <div className="bg-white rounded-[40px] p-8 border border-slate-100 shadow-sm flex items-center gap-6">
                            <div className="w-20 h-20 rounded-[24px] bg-orange-100 text-orange-600 flex items-center justify-center font-black text-2xl overflow-hidden shadow-sm flex-shrink-0">
                                {command.client_photo_url ? <img src={command.client_photo_url} className="w-full h-full object-cover" /> : (command.client_name || 'C').charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-2xl font-black text-slate-800 tracking-tight truncate">{command.client_name || 'Consumidor Final'}</h3>
                                <div className="flex flex-wrap gap-4 mt-2">
                                    <span className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1.5"><Calendar size={12} className="text-orange-500" /> {format(new Date(command.created_at), "dd 'de' MMMM", { locale: pt })}</span>
                                    <span className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1.5"><UserCheck size={12} className="text-orange-500" /> {command.professional_name || 'Geral'}</span>
                                    {isPaid && command.closed_at && <span className="text-[10px] font-black text-emerald-500 uppercase flex items-center gap-1.5"><CheckCircle2 size={12} /> Pago em {format(new Date(command.closed_at), "HH:mm")}</span>}
                                </div>
                            </div>
                        </div>

                        {/* Lista de Consumo */}
                        <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
                            <header className="px-8 py-6 border-b border-slate-50 bg-slate-50/30 flex justify-between items-center">
                                <h3 className="font-black text-slate-800 text-xs uppercase tracking-widest flex items-center gap-2"><ShoppingCart size={16} className="text-orange-500" /> Itens Consumidos</h3>
                                <span className="text-[10px] font-black text-slate-400 uppercase">{items.length} itens</span>
                            </header>
                            <div className="divide-y divide-slate-50">
                                {items.length === 0 ? (
                                    <div className="p-12 text-center text-slate-400 italic">Nenhum item lançado.</div>
                                ) : items.map((item: any) => (
                                    <div key={item.id} className="p-8 flex items-center justify-between hover:bg-slate-50/50 transition-colors group">
                                        <div className="flex items-center gap-5">
                                            <div className={`p-4 rounded-3xl transition-transform group-hover:scale-110 ${item.product_id ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                                                {item.product_id ? <ShoppingBag size={24} /> : <Scissors size={24} />}
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-800 text-lg leading-tight">{item.title || "Item sem título"}</p>
                                                <p className="text-[10px] text-slate-400 font-black uppercase mt-1">Qtde: {item.quantity} • Unit: {formatBRL(Number(item.price))}</p>
                                            </div>
                                        </div>
                                        <p className="font-black text-slate-800 text-xl">{formatBRL(Number(item.quantity || 1) * Number(item.price || 0))}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Auditoria de Pagamentos (Se já estiver paga ou houver pagamentos parciais) */}
                        {(isPaid || historyPayments.length > 0 || addedPayments.length > 0) && (
                            <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
                                <header className="px-8 py-5 border-b border-slate-50 bg-emerald-50/50 flex justify-between items-center">
                                    <h3 className="font-black text-emerald-800 text-xs uppercase tracking-widest flex items-center gap-2"><Landmark size={16} /> Fluxo Financeiro</h3>
                                    <span className="text-[10px] font-black text-emerald-600 uppercase">Recebido: {formatBRL(totals.paid)}</span>
                                </header>
                                <div className="divide-y divide-slate-50">
                                    {[...historyPayments, ...addedPayments].length === 0 ? (
                                        <div className="p-10 text-center text-slate-300 italic text-xs">Pagamento não informado formalmente.</div>
                                    ) : [...historyPayments, ...addedPayments].map((p: any) => (
                                        <div key={p.id} className="p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                                                    {p.method === 'pix' ? <Smartphone size={20}/> : <CreditCard size={20}/>}
                                                </div>
                                                <div>
                                                    <p className="font-black text-slate-800 uppercase text-sm">
                                                        {p.brand || p.method} {p.installments > 1 ? `${p.installments}x` : 'À Vista'}
                                                    </p>
                                                    <div className="flex items-center gap-3 mt-1">
                                                        <span className="text-[9px] font-black text-rose-400 uppercase">Taxa: {p.fee_rate}% ({formatBRL(Number(p.fee_amount || 0))})</span>
                                                        <span className="text-[9px] font-black text-emerald-600 uppercase">Líquido: {formatBRL(Number(p.net_value || 0))}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-black text-slate-800 text-xl">{formatBRL(Number(p.amount || 0))}</p>
                                                {p.created_at && <p className="text-[9px] font-bold text-slate-300 uppercase">{format(new Date(p.created_at), "HH:mm 'em' dd/MM")}</p>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* COLUNA DIREITA: RESUMO E TERMINAL */}
                    <div className="lg:col-span-4 space-y-6">
                        {/* Resumo de Totais */}
                        <div className="bg-slate-900 rounded-[48px] p-8 text-white shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
                            <div className="relative z-10 space-y-6">
                                <div className="space-y-3">
                                    <div className="flex justify-between text-xs font-black uppercase tracking-widest text-slate-400"><span>Bruto Consumido</span><span>{formatBRL(totals.subtotal)}</span></div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-black uppercase tracking-widest text-orange-400">Descontos</span>
                                        {isPaid ? (
                                            <span className="text-orange-400 font-bold">-{formatBRL(command.discount_amount)}</span>
                                        ) : (
                                            <input type="number" value={discount} onChange={e => setDiscount(e.target.value)} className="w-24 bg-white/10 border border-white/10 rounded-xl px-3 py-1 text-right font-black text-white outline-none focus:ring-2 focus:ring-orange-500" />
                                        )}
                                    </div>
                                    {isPaid && (
                                        <div className="flex justify-between text-xs font-black uppercase tracking-widest text-rose-400 pt-1 border-t border-white/5">
                                            <span>Taxas Retidas</span>
                                            <span>-{formatBRL(totals.fees)}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="pt-6 border-t border-white/10 flex justify-between items-end">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{isPaid ? 'Total Líquido' : 'Total à Liquidar'}</p>
                                        <h2 className={`text-4xl font-black tracking-tighter ${isPaid ? 'text-emerald-400' : 'text-orange-400'}`}>
                                            {isPaid ? formatBRL(totals.paid - totals.fees) : formatBRL(totals.total)}
                                        </h2>
                                    </div>
                                    <Receipt size={32} className="text-white/10 mb-1" />
                                </div>

                                {totals.paid > 0 && !isPaid && (
                                    <div className="bg-white/5 p-4 rounded-3xl border border-white/10 space-y-2 animate-in zoom-in">
                                        <div className="flex justify-between text-[10px] font-black uppercase text-slate-400"><span>Total Pago:</span><span className="text-emerald-400">{formatBRL(totals.paid)}</span></div>
                                        <div className="flex justify-between items-center pt-2 border-t border-white/5">
                                            <span className="text-[10px] font-black uppercase text-orange-400">Restante:</span>
                                            <span className="text-xl font-black">{formatBRL(totals.remaining)}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Terminal de Cobrança (Apenas para abertas) */}
                        {!isPaid ? (
                            <div className="bg-white rounded-[48px] p-8 border border-slate-100 shadow-sm space-y-6">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 flex items-center gap-2">
                                    <Smartphone size={14} className="text-orange-500" /> Terminal de Recebimento
                                </h4>
                                
                                <div className="bg-slate-50 p-6 rounded-[32px] border-2 border-slate-100 space-y-6 min-h-[300px] flex flex-col">
                                    {paymentStep === 'type' && (
                                        <div className="grid grid-cols-2 gap-3 animate-in fade-in">
                                            {[
                                                { id: 'pix', label: 'Pix', icon: Smartphone },
                                                { id: 'money', label: 'Dinheiro', icon: Banknote },
                                                { id: 'debit', label: 'Débito', icon: CreditCard },
                                                { id: 'credit', label: 'Crédito', icon: CardIcon },
                                                { id: 'parcelado', label: 'Parcelado', icon: Layers }
                                            ].map(pm => (
                                                <button key={pm.id} onClick={() => handleSelectType(pm.id)} className="flex flex-col items-center justify-center p-5 rounded-3xl bg-white border border-slate-100 hover:border-orange-300 transition-all group shadow-sm">
                                                    <pm.icon size={24} className="mb-2 text-slate-300 group-hover:text-orange-500 transition-colors" />
                                                    <span className="text-[9px] font-black uppercase">{pm.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {paymentStep === 'brand' && (
                                        <div className="space-y-4 animate-in slide-in-from-right-4">
                                            <header className="flex justify-between items-center px-1"><span className="text-[9px] font-black uppercase text-orange-500 tracking-widest">Bandeira do Cartão</span><button onClick={() => setPaymentStep('type')}><X size={16} className="text-slate-300" /></button></header>
                                            <div className="grid grid-cols-1 gap-2">
                                                {filteredConfigs.map(cfg => (
                                                    <button key={cfg.id} onClick={() => { setSelectedConfig(cfg); setPaymentStep(selectedType === 'parcelado' ? 'installments' : 'confirm'); }} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl hover:border-orange-400 transition-all group">
                                                        <span className="text-xs font-black text-slate-700 uppercase">{cfg.brand || cfg.name}</span>
                                                        <ChevronRight size={14} className="text-slate-300" />
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {paymentStep === 'installments' && (
                                        <div className="space-y-6 animate-in slide-in-from-right-4">
                                            <header className="flex justify-between items-center px-1"><span className="text-[9px] font-black uppercase text-orange-500 tracking-widest">Número de Parcelas</span><button onClick={() => setPaymentStep('brand')}><X size={16} className="text-slate-300" /></button></header>
                                            <div className="grid grid-cols-3 gap-2">
                                                {Array.from({ length: (selectedConfig?.max_installments || 12) - 1 }, (_, i) => i + 2).map(n => (
                                                    <button key={n} onClick={() => { setInstallments(n); setPaymentStep('confirm'); }} className="py-3 bg-white border border-slate-100 rounded-xl font-black text-xs text-slate-600 hover:border-orange-400 transition-all">{n}x</button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {paymentStep === 'confirm' && (
                                        <div className="space-y-6 animate-in slide-in-from-bottom-4 flex-1 flex flex-col">
                                            <header className="flex justify-between items-center px-1">
                                                <div><span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">{selectedConfig?.name}</span>{installments > 1 && <span className="text-[9px] font-bold text-orange-500 uppercase">Plano: {installments}x</span>}</div>
                                                <button onClick={() => setPaymentStep('type')}><X size={16} className="text-slate-300" /></button>
                                            </header>
                                            <div className="space-y-2 flex-1">
                                                <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Valor do Lançamento</label>
                                                <div className="relative">
                                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-300">R$</span>
                                                    <input type="number" autoFocus value={amountToPay} onChange={e => setAmountToPay(e.target.value)} className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-2xl font-black text-slate-800 outline-none focus:border-orange-400 transition-all" />
                                                </div>
                                            </div>
                                            <button onClick={handleConfirmPartialPayment} className="w-full bg-slate-800 text-white font-black py-4 rounded-2xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2">
                                                <Plus size={18} /> Confirmar Parcela
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <button 
                                    onClick={handleFinishCheckout} 
                                    disabled={isFinishing || totals.remaining > 0 || (addedPayments.length === 0 && historyPayments.length === 0)} 
                                    className={`w-full py-6 rounded-[32px] font-black flex items-center justify-center gap-3 text-lg uppercase transition-all shadow-2xl ${totals.remaining === 0 && !isFinishing ? 'bg-emerald-600 text-white shadow-emerald-100' : 'bg-slate-100 text-slate-300'}`}
                                >
                                    {isFinishing ? <Loader2 className="animate-spin" /> : <><CheckCircle size={24} /> Fechar Comanda</>}
                                </button>
                            </div>
                        ) : (
                            /* Modo Arquivo: Ações de Recibo */
                            <div className="bg-white rounded-[48px] p-8 border border-slate-100 shadow-sm space-y-4 animate-in fade-in">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Ações do Documento</h4>
                                <button className="w-full flex items-center justify-center gap-3 py-4 bg-slate-100 text-slate-700 font-black rounded-3xl hover:bg-slate-200 transition-all text-sm uppercase tracking-widest"><Printer size={18}/> Imprimir Recibo</button>
                                <button className="w-full flex items-center justify-center gap-3 py-4 bg-slate-100 text-slate-700 font-black rounded-3xl hover:bg-slate-200 transition-all text-sm uppercase tracking-widest"><Share2 size={18}/> Enviar p/ WhatsApp</button>
                                
                                <div className="pt-6 border-t border-slate-100">
                                    <div className="bg-blue-50 p-6 rounded-[32px] border border-blue-100">
                                        <div className="flex items-center gap-3 mb-2"><Info size={18} className="text-blue-500"/><h5 className="text-[10px] font-black text-blue-800 uppercase tracking-widest">Informações de Auditoria</h5></div>
                                        <p className="text-[10px] text-blue-600 leading-relaxed font-medium">Esta comanda foi liquidada e não pode ser editada. Caso precise realizar um estorno, acesse o módulo de <button className="underline font-bold">Fluxo de Caixa</button>.</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CommandDetailView;
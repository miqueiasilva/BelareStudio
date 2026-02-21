
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    ChevronLeft, CreditCard, Smartphone, Banknote, 
    Plus, Loader2, CheckCircle,
    Phone, Scissors, ShoppingBag, Receipt,
    Percent, Calendar, ShoppingCart, X, Coins,
    ArrowRight, ShieldCheck, Tag, CreditCard as CardIcon,
    User, UserCheck, Trash2, Lock, MoreVertical, AlertTriangle,
    Clock, Landmark, ChevronRight, Calculator, Layers
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { useStudio } from '../../contexts/StudioContext';
import Toast, { ToastType } from '../shared/Toast';

const CommandDetailView: React.FC<{ commandId: string; onBack: () => void }> = ({ commandId, onBack }) => {
    const { activeStudioId } = useStudio();
    const [command, setCommand] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isFinishing, setIsFinishing] = useState(false);
    const [isLocked, setIsLocked] = useState(false);
    
    const isProcessingRef = useRef(false);
    
    const [addedPayments, setAddedPayments] = useState<any[]>([]);
    const [historyPayments, setHistoryPayments] = useState<any[]>([]);
    const [paymentStep, setPaymentStep] = useState<'type' | 'brand' | 'installments' | 'confirm'>('type');
    const [selectedType, setSelectedType] = useState<string | null>(null);
    const [selectedConfig, setSelectedConfig] = useState<any | null>(null);
    const [installments, setInstallments] = useState<number>(1);
    const [amountToPay, setAmountToPay] = useState<string>('0');
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const [availableConfigs, setAvailableConfigs] = useState<any[]>([]);

    const fetchContext = async () => {
        if (!activeStudioId || !commandId) return;
        setLoading(true);
        try {
            const { data: cmdData, error: cmdError } = await supabase
                .from('commands')
                .select('*, clients:client_id (id, nome, name, photo_url)')
                .eq('id', commandId)
                .single();

            if (cmdError) throw cmdError;

            const { data: itemsData } = await supabase.from('command_items').select('*').eq('command_id', commandId);
            const [configsRes, payHistoryRes] = await Promise.all([
                supabase.from('payment_methods_config').select('*').eq('studio_id', activeStudioId).eq('is_active', true),
                supabase.from('command_payments').select(`*, method:method_id(name, brand)`).eq('command_id', commandId)
            ]);

            setAvailableConfigs(configsRes.data || []);
            setHistoryPayments(payHistoryRes.data || []);
            setCommand({ ...cmdData, command_items: itemsData || [] });
            
            if (cmdData.status === 'paid') {
                setIsLocked(true);
            }
        } catch (e: any) {
            setToast({ message: "Falha ao carregar comanda", type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { 
        isProcessingRef.current = false;
        fetchContext(); 
    }, [commandId, activeStudioId]);

    const totals = useMemo(() => {
        if (!command) return { total: 0, paid: 0, remaining: 0 };
        const total = command.command_items?.reduce((acc: number, i: any) => acc + (Number(i.price || 0) * Number(i.quantity || 1)), 0) || 0;
        const currentPaid = addedPayments.reduce((acc, p) => acc + p.amount, 0);
        return { total, paid: currentPaid, remaining: Math.max(0, total - currentPaid) };
    }, [command, addedPayments]);

    // ─── CÁLCULO DE TAXA ──────────────────────────────────────────────────────
    const feeInfo = useMemo(() => {
        if (!selectedConfig) return { rate: 0, feeAmount: 0, netAmount: 0 };
        const amount = parseFloat(String(amountToPay).replace(',', '.')) || 0;
        
        let rate = 0;
        if (selectedConfig.type === 'pix' || selectedConfig.type === 'dinheiro' || selectedConfig.type === 'money') {
            rate = Number(selectedConfig.rate_cash || 0);
        } else if (selectedConfig.type === 'debit') {
            rate = Number(selectedConfig.rate_cash || 0);
        } else if (selectedConfig.type === 'credit') {
            if (installments === 1) {
                rate = Number(selectedConfig.rate_cash || 0);
            } else {
                const installmentRates = selectedConfig.installment_rates || {};
                rate = Number(installmentRates[installments.toString()] || selectedConfig.rate_installment_12x || 0);
            }
        }

        const feeAmount = (amount * rate) / 100;
        const netAmount = amount - feeAmount;
        return { rate, feeAmount, netAmount };
    }, [selectedConfig, installments, amountToPay]);

    const handleFinishCheckout = async () => {
        if (isProcessingRef.current || isLocked) return;
        
        if (totals.remaining > 0 || addedPayments.length === 0) {
            setToast({ message: "Saldo pendente. Adicione o pagamento.", type: 'error' });
            return;
        }

        isProcessingRef.current = true;
        setIsFinishing(true);

        try {
            const mainPayment = addedPayments[0];
            const dbMethod = mainPayment.method === 'money' ? 'dinheiro' : mainPayment.method;

            const { data, error: rpcError } = await supabase.rpc('register_payment_transaction', {
                p_studio_id: activeStudioId,
                p_professional_id: command.professional_id,
                p_client_id: command.client_id ? Number(command.client_id) : null,
                p_command_id: commandId,
                p_amount: totals.total,
                p_method: dbMethod,
                p_brand: mainPayment.brand || 'N/A',
                p_installments: Number(mainPayment.installments || 1)
            });

            if (rpcError) {
                if (rpcError.status === 409 || rpcError.code === '23505' || rpcError.code === 'P0001') {
                    const { data: check } = await supabase.from('commands').select('status').eq('id', commandId).single();
                    if (check?.status === 'paid') {
                        setToast({ message: 'Venda processada com sucesso!', type: 'success' });
                        setIsLocked(true);
                        setTimeout(onBack, 1000);
                        return;
                    }
                }
                throw rpcError;
            }

            setToast({ message: 'Pagamento confirmado! ✅', type: 'success' });
            setIsLocked(true);
            setTimeout(onBack, 1500);

        } catch (e: any) {
            console.error('[FATAL_CHECKOUT]', e);
            setToast({ message: `Erro: ${e.message || 'Falha na comunicação'}`, type: 'error' });
            isProcessingRef.current = false;
            setIsFinishing(false);
        }
    };

    const handleSelectType = (type: string) => {
        setSelectedType(type);
        setInstallments(1);
        const dbType = type === 'money' ? 'dinheiro' : type;
        if (dbType === 'pix' || dbType === 'dinheiro') {
            const config = availableConfigs.find(c => c.type === dbType);
            setSelectedConfig(config || { type: dbType, name: dbType.toUpperCase(), rate_cash: 0 });
            // Preenche automaticamente com o saldo restante
            const remaining = totals.remaining > 0 ? totals.remaining : totals.total;
            setAmountToPay(String(remaining.toFixed(2)));
            setPaymentStep('confirm');
        } else { 
            setPaymentStep('brand'); 
        }
    };

    const handleSelectBrand = (cfg: any) => {
        setSelectedConfig(cfg);
        // Preenche automaticamente com o saldo restante
        const remaining = totals.remaining > 0 ? totals.remaining : totals.total;
        setAmountToPay(String(remaining.toFixed(2)));
        // Se crédito com parcelamento, vai para step de parcelas; senão direto para confirm
        if (cfg.type === 'credit' && cfg.allow_installments && cfg.max_installments > 1) {
            setPaymentStep('installments');
        } else {
            setPaymentStep('confirm');
        }
    };

    const handleConfirmPartialPayment = () => {
        if (!selectedConfig) return;
        const amount = parseFloat(String(amountToPay).replace(',', '.'));
        if (isNaN(amount) || amount <= 0) return;
        setAddedPayments(prev => [...prev, {
            id: Math.random().toString(36).substring(7),
            method: selectedConfig.type,
            amount: amount,
            installments: installments,
            brand: selectedConfig.brand || selectedConfig.name,
            rate: feeInfo.rate,
            feeAmount: feeInfo.feeAmount,
            netAmount: feeInfo.netAmount,
        }]);
        setPaymentStep('type');
        setSelectedType(null);
        setSelectedConfig(null);
        setInstallments(1);
    };

    if (loading) return <div className="h-full flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-orange-500" size={48} /></div>;

    return (
        <div className="h-full flex flex-col bg-slate-50 font-sans text-left overflow-hidden">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center z-20 shadow-sm">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400"><ChevronLeft size={24} /></button>
                    <div>
                        <h1 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Liquidação de Comanda</h1>
                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Status: {isLocked ? 'CONCLUÍDO' : 'PENDENTE'}</p>
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
                <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 pb-20">
                    <div className="lg:col-span-2 space-y-6">
                        {/* ITENS DA CONTA */}
                        <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
                            <header className="px-6 py-4 border-b border-slate-50 bg-slate-50/50">
                                <h3 className="font-black text-slate-800 text-[10px] uppercase tracking-widest flex items-center gap-2"><ShoppingCart size={16} /> Itens da Conta</h3>
                            </header>
                            <div className="divide-y divide-slate-50">
                                {command.command_items?.map((item: any) => (
                                    <div key={item.id} className="p-5 flex items-center justify-between">
                                        <div>
                                            <p className="font-bold text-slate-700">{item.title}</p>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase">{item.quantity} un x R$ {Number(item.price).toFixed(2)}</p>
                                        </div>
                                        <p className="font-black text-slate-800 text-lg">R$ {(item.quantity * item.price).toFixed(2)}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* PAGAMENTOS REGISTRADOS */}
                        {(addedPayments.length > 0 || historyPayments.length > 0) && (
                            <div className="bg-white rounded-[32px] border border-slate-100 overflow-hidden shadow-sm">
                                <header className="px-6 py-4 border-b border-slate-50 bg-emerald-50/30">
                                    <h3 className="font-black text-emerald-800 text-[10px] uppercase tracking-widest">Pagamento Registrado</h3>
                                </header>
                                <div className="divide-y divide-slate-50">
                                    {(isLocked ? historyPayments : addedPayments).map(p => (
                                        <div key={p.id} className="px-6 py-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-500 flex items-center justify-center font-black text-[10px]">{p.installments}x</div>
                                                    <span className="text-sm font-black text-slate-700 uppercase">{p.brand || p.method}</span>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <span className="font-black text-slate-800 text-lg">R$ {Number(p.amount).toFixed(2)}</span>
                                                    {!isLocked && <button onClick={() => setAddedPayments(prev => prev.filter(i => i.id !== p.id))} className="text-rose-400 p-2 hover:bg-rose-50 rounded-lg"><X size={18} /></button>}
                                                </div>
                                            </div>
                                            {/* EXIBIÇÃO DA TAXA */}
                                            {p.rate > 0 && (
                                                <div className="mt-2 ml-11 flex items-center gap-4 text-[10px] font-bold">
                                                    <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg">
                                                        Taxa {p.rate}% = - R$ {Number(p.feeAmount).toFixed(2)}
                                                    </span>
                                                    <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg">
                                                        Líquido: R$ {Number(p.netAmount).toFixed(2)}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* PAINEL DIREITO */}
                    <div className="space-y-6">
                        <div className="bg-slate-900 rounded-[40px] p-8 text-white shadow-2xl relative overflow-hidden">
                            <p className="text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Total a Receber</p>
                            <h2 className="text-5xl font-black text-emerald-400 tracking-tighter">R$ {totals.total.toFixed(2)}</h2>
                            {totals.remaining > 0 && addedPayments.length > 0 && (
                                <p className="text-[10px] font-black uppercase text-amber-400 mt-3 tracking-widest">
                                    Restante: R$ {totals.remaining.toFixed(2)}
                                </p>
                            )}
                        </div>

                        {!isLocked && (
                            <div className="bg-white rounded-[40px] p-6 border border-slate-100 shadow-sm space-y-6">
                                <div className="bg-slate-50 p-4 rounded-3xl min-h-[250px] flex flex-col">

                                    {/* STEP: TIPO */}
                                    {paymentStep === 'type' && (
                                        <div className="grid grid-cols-2 gap-2">
                                            {[
                                                {id:'pix',label:'Pix',icon:Smartphone},
                                                {id:'money',label:'Dinheiro',icon:Banknote},
                                                {id:'debit',label:'Débito',icon:CreditCard},
                                                {id:'credit',label:'Crédito',icon:CardIcon}
                                            ].map(pm => (
                                                <button key={pm.id} onClick={() => handleSelectType(pm.id)} className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white border border-slate-100 hover:border-orange-300 transition-all shadow-sm active:scale-95 group">
                                                    <pm.icon size={20} className="mb-2 text-slate-300 group-hover:text-orange-500 transition-colors" />
                                                    <span className="text-[9px] font-black uppercase">{pm.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* STEP: BANDEIRA */}
                                    {paymentStep === 'brand' && (
                                        <div className="grid grid-cols-1 gap-2">
                                            <header className="flex justify-between items-center px-1 mb-1">
                                                <span className="text-[9px] font-black uppercase text-orange-500">Selecione a bandeira</span>
                                                <button onClick={() => setPaymentStep('type')}><X size={16} className="text-slate-300" /></button>
                                            </header>
                                            {availableConfigs.filter(c => c.type === selectedType).map(cfg => (
                                                <button key={cfg.id} onClick={() => handleSelectBrand(cfg)} className="p-4 bg-white border border-slate-100 rounded-xl font-black text-xs uppercase text-left hover:border-orange-400 transition-all flex justify-between items-center">
                                                    <span>{cfg.brand || cfg.name}</span>
                                                    <span className="text-[9px] text-slate-400 font-bold">Taxa {cfg.rate_cash}%</span>
                                                </button>
                                            ))}
                                            {availableConfigs.filter(c => c.type === selectedType).length === 0 && (
                                                <p className="text-center text-[10px] text-slate-400 font-bold py-4">Nenhuma bandeira configurada para este tipo.</p>
                                            )}
                                        </div>
                                    )}

                                    {/* STEP: PARCELAMENTO */}
                                    {paymentStep === 'installments' && selectedConfig && (
                                        <div className="space-y-3">
                                            <header className="flex justify-between items-center px-1 mb-1">
                                                <span className="text-[9px] font-black uppercase text-orange-500">Parcelas — {selectedConfig.brand || selectedConfig.name}</span>
                                                <button onClick={() => setPaymentStep('brand')}><X size={16} className="text-slate-300" /></button>
                                            </header>
                                            <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto">
                                                {/* 1x à vista */}
                                                <button
                                                    onClick={() => { setInstallments(1); setPaymentStep('confirm'); }}
                                                    className="p-3 bg-white border border-slate-100 rounded-xl font-bold text-xs text-left hover:border-orange-400 transition-all flex justify-between items-center"
                                                >
                                                    <span>1x à vista</span>
                                                    <span className="text-[9px] text-emerald-600 font-black bg-emerald-50 px-2 py-0.5 rounded-lg">Taxa {selectedConfig.rate_cash}%</span>
                                                </button>
                                                {/* 2x até max_installments */}
                                                {selectedConfig.allow_installments && Array.from({ length: (selectedConfig.max_installments || 2) - 1 }, (_, i) => i + 2).map(n => {
                                                    const rate = selectedConfig.installment_rates?.[n.toString()] ?? selectedConfig.rate_installment_12x ?? 0;
                                                    return (
                                                        <button
                                                            key={n}
                                                            onClick={() => { setInstallments(n); setPaymentStep('confirm'); }}
                                                            className="p-3 bg-white border border-slate-100 rounded-xl font-bold text-xs text-left hover:border-orange-400 transition-all flex justify-between items-center"
                                                        >
                                                            <span>{n}x parcelado</span>
                                                            <span className="text-[9px] text-amber-600 font-black bg-amber-50 px-2 py-0.5 rounded-lg">Taxa {rate}%</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* STEP: CONFIRMAR VALOR */}
                                    {paymentStep === 'confirm' && selectedConfig && (
                                        <div className="space-y-3 flex-1 flex flex-col">
                                            <header className="flex justify-between items-center">
                                                <div>
                                                    <span className="text-[9px] font-black uppercase text-orange-500">
                                                        {selectedConfig.brand || selectedConfig.name}
                                                        {installments > 1 ? ` — ${installments}x` : ' — à vista'}
                                                    </span>
                                                </div>
                                                <button onClick={() => setPaymentStep('type')}><X size={16} className="text-slate-300" /></button>
                                            </header>
                                            
                                            <input 
                                                type="number" 
                                                autoFocus 
                                                value={amountToPay} 
                                                onChange={e => setAmountToPay(e.target.value)} 
                                                className="w-full bg-white border-2 border-slate-100 rounded-2xl py-5 text-center text-2xl font-black text-slate-800 outline-none focus:border-orange-400" 
                                            />

                                            {/* PREVIEW DE TAXA */}
                                            {feeInfo.rate > 0 && parseFloat(amountToPay) > 0 && (
                                                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3 space-y-1">
                                                    <div className="flex justify-between text-[10px] font-black uppercase">
                                                        <span className="text-amber-700">Taxa {feeInfo.rate}%</span>
                                                        <span className="text-amber-700">- R$ {feeInfo.feeAmount.toFixed(2)}</span>
                                                    </div>
                                                    <div className="flex justify-between text-[10px] font-black uppercase border-t border-amber-100 pt-1">
                                                        <span className="text-emerald-700">Valor Líquido</span>
                                                        <span className="text-emerald-700">R$ {feeInfo.netAmount.toFixed(2)}</span>
                                                    </div>
                                                </div>
                                            )}

                                            <button onClick={handleConfirmPartialPayment} className="w-full bg-slate-800 text-white font-black py-4 rounded-2xl shadow-xl active:scale-95 mt-auto">
                                                Vincular Pagamento
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <button 
                                    onClick={handleFinishCheckout} 
                                    disabled={isFinishing || totals.remaining > 0 || addedPayments.length === 0} 
                                    className={`w-full py-5 rounded-[24px] font-black text-lg uppercase transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3 ${totals.remaining === 0 && addedPayments.length > 0 && !isFinishing ? 'bg-emerald-600 text-white shadow-emerald-100' : 'bg-slate-100 text-slate-300'}`}
                                >
                                    {isFinishing ? <Loader2 size={24} className="animate-spin" /> : <><CheckCircle size={24} /> LIQUIDAR CONTA</>}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CommandDetailView;

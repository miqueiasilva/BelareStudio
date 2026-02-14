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
        created_at?: string;
        brand?: string;
        method_id: string; 
    }
    
    const CommandDetailView: React.FC<CommandDetailViewProps> = ({ commandId, onBack }) => {
        const { activeStudioId } = useStudio();
        const [command, setCommand] = useState<any>(null);
        const [loading, setLoading] = useState(true);
        const [isFinishing, setIsFinishing] = useState(false);
        const [isLocked, setIsLocked] = useState(false);

        // Bloqueio de processamento contra duplo clique/condição de corrida
        const isProcessingRef = useRef(false);
        
        const [addedPayments, setAddedPayments] = useState<PaymentEntry[]>([]);
        const [historyPayments, setHistoryPayments] = useState<any[]>([]);
        
        const [paymentStep, setPaymentStep] = useState<'type' | 'brand' | 'installments' | 'confirm'>('type');
        const [selectedType, setSelectedType] = useState<string | null>(null);
        const [selectedConfig, setSelectedConfig] = useState<any | null>(null);
        const [installments, setInstallments] = useState<number>(1);
        
        const [amountToPay, setAmountToPay] = useState<string>('0');
        const [discount, setDiscount] = useState<string>('0');
        const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
        const [availableConfigs, setAvailableConfigs] = useState<any[]>([]);
    
        const fetchContext = async () => {
            if (!activeStudioId || !commandId) return;
            
            setLoading(true);
            try {
                const { data: cmdData, error: cmdError } = await supabase
                    .from('commands')
                    .select(`
                        id, studio_id, client_id, client_name, professional_id, status, total_amount, created_at, closed_at,
                        clients:client_id (id, nome, name, whatsapp, photo_url)
                    `)
                    .eq('id', commandId)
                    .single();
    
                if (cmdError) throw cmdError;
    
                const { data: itemsData } = await supabase
                    .from('command_items')
                    .select('*')
                    .eq('command_id', commandId);
    
                const [configsRes] = await Promise.all([
                    supabase.from('payment_methods_config')
                        .select('*')
                        .eq('studio_id', activeStudioId)
                        .eq('is_active', true)
                ]);
    
                setAvailableConfigs(configsRes.data || []);
                
                // BUSCA AUDITORIA DE PAGAMENTOS (Pode existir mesmo se status local não refletir)
                const { data: payHistory } = await supabase
                    .from('command_payments')
                    .select(`*, payment_methods_config (name, brand)`)
                    .eq('command_id', commandId);
                
                if (payHistory && payHistory.length > 0) {
                    setHistoryPayments(payHistory);
                    if (payHistory.some(p => p.status === 'paid')) {
                        setIsLocked(true);
                    }
                }
    
                setCommand({
                    ...cmdData,
                    command_items: itemsData || [],
                    display_client_name: cmdData.clients?.nome || cmdData.clients?.name || cmdData.client_name || "Consumidor Final",
                    display_client_phone: cmdData.clients?.whatsapp || "S/ CONTATO",
                    display_client_photo: cmdData.clients?.photo_url || null
                });

                if (cmdData.status === 'paid') setIsLocked(true);

            } catch (e: any) {
                console.error('[COMMAND_DETAIL_FETCH_ERROR]', e);
            } finally {
                setLoading(false);
            }
        };
    
        useEffect(() => { 
            isProcessingRef.current = false;
            fetchContext(); 
        }, [commandId, activeStudioId]);
    
        const totals = useMemo(() => {
            if (!command) return { subtotal: 0, total: 0, paid: 0, remaining: 0 };
            const subtotal = command.command_items?.reduce((acc: number, i: any) => acc + (Number(i.price || 0) * Number(i.quantity || 1)), 0) || 0;
            const discValue = parseFloat(discount) || 0;
            const totalAfterDiscount = Math.max(0, subtotal - discValue);
            
            const currentPaid = addedPayments.reduce((acc, p) => acc + p.amount, 0);
            const remaining = Math.max(0, totalAfterDiscount - currentPaid);
            
            return { subtotal, total: totalAfterDiscount, paid: currentPaid, remaining };
        }, [command, discount, addedPayments]);

        const filteredConfigs = useMemo(() => {
            if (!selectedType) return [];
            if (selectedType === 'parcelado') {
                return availableConfigs.filter(c => c.type === 'credit' && c.allow_installments);
            }
            return availableConfigs.filter(c => c.type === selectedType);
        }, [availableConfigs, selectedType]);
    
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
                ? (selectedConfig.installment_rates?.[installments] || selectedConfig.rate_installment || 0)
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
            // BLOQUEIO CRÍTICO DE EXECUÇÃO ÚNICA
            if (isProcessingRef.current || isFinishing || isLocked || addedPayments.length === 0) {
                console.log('🚫 Bloqueado - Processamento ou trava ativa');
                return;
            }
            
            isProcessingRef.current = true;
            setIsFinishing(true);

            try {
                const consolidatedPayment = {
                    command_id: commandId,
                    studio_id: activeStudioId,
                    amount: addedPayments.reduce((acc, p) => acc + p.amount, 0),
                    fee_amount: addedPayments.reduce((acc, p) => acc + p.fee_amount, 0),
                    net_value: addedPayments.reduce((acc, p) => acc + p.net_value, 0),
                    fee_applied: addedPayments[0].fee_rate,
                    installments: Math.max(...addedPayments.map(p => p.installments)),
                    method_id: addedPayments[0].method_id,
                    brand: addedPayments.length > 1 ? 'Misto' : (addedPayments[0].brand || null),
                    status: 'paid'
                };

                // 2. VERIFICAÇÃO DE IDEMPOTÊNCIA NO DB
                const { data: existing, error: checkError } = await supabase
                    .from('command_payments')
                    .select('id, status')
                    .eq('command_id', commandId)
                    .maybeSingle();

                if (checkError) throw checkError;

                console.log('payment upsert path', { existing, status: existing?.status });

                let secured = false;
                if (existing) {
                    if (existing.status !== 'paid') {
                        const { error: updErr } = await supabase
                            .from('command_payments')
                            .update(consolidatedPayment)
                            .eq('id', existing.id);
                        if (updErr) {
                            console.error('payment error', { code: updErr.code, message: updErr.message });
                            throw updErr;
                        }
                    }
                    secured = true;
                } else {
                    const { error: insErr } = await supabase
                        .from('command_payments')
                        .insert([consolidatedPayment]);
                    if (insErr) {
                        console.error('payment error', { code: insErr.code, message: insErr.message });
                        throw insErr;
                    }
                    secured = true;
                }

                // 3. FINALIZAÇÃO DA COMANDA (APENAS SE O FINANCEIRO FOR GARANTIDO)
                if (secured) {
                    const { error: closeError } = await supabase
                        .from('commands')
                        .update({ 
                            status: 'paid', 
                            closed_at: new Date().toISOString(),
                            total_amount: totals.total
                        })
                        .eq('id', commandId);
    
                    if (closeError) {
                        console.error('[BALCAO_CLOSE_ERROR]', closeError);
                    }
    
                    setToast({ message: "Atendimento finalizado com sucesso! ✅", type: 'success' });
                    setIsLocked(true);
                    setTimeout(onBack, 800);
                }
    
            } catch (e: any) {
                console.error('[BALCAO_EXCEPTION]', e);
                setToast({ message: `Falha no encerramento: ${e.message}`, type: 'error' });
                // Só destrava em caso de erro para permitir nova tentativa
                isProcessingRef.current = false;
                setIsFinishing(false);
            }
        };
    
        if (loading) return <div className="h-full flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-orange-500" size={48} /></div>;
    
        return (
            <div className="h-full flex flex-col bg-slate-50 font-sans text-left overflow-hidden">
                {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
                
                <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center z-20 shadow-sm flex-shrink-0">
                    <div className="flex items-center gap-4">
                        <button onClick={onBack} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 transition-all"><ChevronLeft size={24} /></button>
                        <div>
                            <h1 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Concluir Atendimento</h1>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1">Ref: {commandId.substring(0,8).toUpperCase()}</p>
                        </div>
                    </div>
                    <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${isLocked ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-orange-50 text-orange-600 border border-orange-100'}`}>
                        {isLocked ? 'Liquidado' : 'Em Aberto'}
                    </div>
                </header>
    
                <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
                    <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 pb-20">
                        <div className="lg:col-span-2 space-y-6">
                            <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
                                <header className="px-8 py-6 border-b border-slate-50 bg-slate-50/30">
                                    <h3 className="font-black text-slate-800 text-sm uppercase tracking-widest flex items-center gap-2"><ShoppingCart size={18} className="text-orange-500" /> Resumo do Consumo</h3>
                                </header>
                                <div className="divide-y divide-slate-50">
                                    {command.command_items?.map((item: any) => (
                                        <div key={item.id} className="p-8 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                                            <div className="flex items-center gap-5">
                                                <div className={`p-4 rounded-3xl ${item.product_id ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                                                    {item.product_id ? <ShoppingBag size={24} /> : <Scissors size={24} />}
                                                </div>
                                                <div>
                                                    <p className="font-black text-slate-800 text-lg leading-tight">{item.title}</p>
                                                    <p className="text-[10px] text-slate-400 font-black uppercase mt-1">{item.quantity} un x R$ {Number(item.price || 0).toFixed(2)}</p>
                                                </div>
                                            </div>
                                            <p className="font-black text-slate-800 text-xl">R$ {(item.quantity * item.price).toFixed(2)}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
    
                            {(addedPayments.length > 0 || historyPayments.length > 0) && (
                                <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden animate-in slide-in-from-bottom-4">
                                    <header className="px-8 py-5 border-b border-slate-50 bg-emerald-50/50 flex justify-between items-center">
                                        <h3 className="font-black text-emerald-800 text-xs uppercase tracking-widest flex items-center gap-2"><CheckCircle size={16} /> Fluxo Financeiro Auditado</h3>
                                    </header>
                                    <div className="divide-y divide-slate-50">
                                        {(isLocked ? historyPayments : addedPayments).map(p => {
                                            const name = isLocked 
                                                ? (p.payment_methods_config?.name || p.brand || 'Pagamento')
                                                : (p.brand || p.method?.replace('_', ' '));
                                            
                                            return (
                                                <div key={p.id} className="px-8 py-5 flex items-center justify-between bg-white group animate-in slide-in-from-right-4">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center font-black">
                                                            {p.installments > 1 ? `${p.installments}x` : '1x'}
                                                        </div>
                                                        <div>
                                                            <span className="text-sm font-black text-slate-700 uppercase">{name}</span>
                                                            <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Saldo Líquido: R$ {Number(p.net_value).toFixed(2)}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <span className="font-black text-slate-800 text-lg">R$ {Number(p.amount).toFixed(2)}</span>
                                                        {!isLocked && <button onClick={() => setAddedPayments(prev => prev.filter(i => i.id !== p.id))} className="p-2 text-slate-200 hover:text-rose-500 transition-colors"><X size={18} /></button>}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
    
                        <div className="space-y-6">
                            <div className="bg-slate-900 rounded-[48px] p-10 text-white shadow-2xl relative overflow-hidden">
                                <div className="relative z-10 space-y-6">
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs font-black uppercase tracking-widest text-slate-400"><span>Subtotal</span><span>R$ {totals.subtotal.toFixed(2)}</span></div>
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-orange-400"><Percent size={14} /> Desconto</div>
                                            <input type="number" value={discount} disabled={isLocked} onChange={e => setDiscount(e.target.value)} className="w-24 bg-white/10 border border-white/10 rounded-xl px-3 py-1.5 text-right font-black text-white outline-none focus:ring-2 focus:ring-orange-50/50" />
                                        </div>
                                    </div>
                                    <div className="pt-6 border-t border-white/10">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Valor Total</p>
                                        <h2 className="text-5xl font-black tracking-tighter text-emerald-400">R$ {totals.total.toFixed(2)}</h2>
                                    </div>
                                    {(totals.paid > 0 || isLocked) && (
                                        <div className="bg-white/5 p-4 rounded-3xl border border-white/10 space-y-2">
                                            <div className="flex justify-between text-xs font-bold text-slate-400"><span>Pago:</span><span className="text-emerald-400">R$ {(isLocked ? command.total_amount : totals.paid).toFixed(2)}</span></div>
                                            {!isLocked && (
                                                <div className="flex justify-between items-center pt-2 border-t border-white/5">
                                                    <span className="text-xs font-black uppercase tracking-widest text-orange-400">Restante:</span>
                                                    <span className={`text-xl font-black ${totals.remaining === 0 ? 'text-emerald-400' : 'text-white'}`}>R$ {totals.remaining.toFixed(2)}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
    
                            {!isLocked && (
                                <div className="bg-white rounded-[48px] p-8 border border-slate-100 shadow-sm space-y-6">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 flex items-center gap-2">
                                        <Tag size={14} className="text-orange-500" /> Cobrança Terminal
                                    </h4>
                                    
                                    <div className="bg-slate-50 p-6 rounded-[32px] border-2 border-slate-100 space-y-6 min-h-[320px] flex flex-col">
                                        {paymentStep === 'type' && (
                                            <div className="grid grid-cols-2 gap-3 animate-in fade-in">
                                                {[
                                                    { id: 'pix', label: 'Pix', icon: Smartphone },
                                                    { id: 'money', label: 'Dinheiro', icon: Banknote },
                                                    { id: 'debit', label: 'Débito', icon: CreditCard },
                                                    { id: 'credit', label: 'Crédito', icon: CardIcon },
                                                    { id: 'parcelado', label: 'Parcelado', icon: Layers }
                                                ].map(pm => (
                                                    <button key={pm.id} disabled={isFinishing} onClick={() => handleSelectType(pm.id)} className="flex flex-col items-center justify-center p-5 rounded-3xl bg-white border border-slate-100 hover:border-orange-300 transition-all group shadow-sm active:scale-95 disabled:opacity-50">
                                                        <pm.icon size={24} className="mb-2 text-slate-300 group-hover:text-orange-500 transition-colors" />
                                                        <span className="text-[9px] font-black uppercase">{pm.label}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
    
                                        {paymentStep === 'brand' && (
                                            <div className="space-y-4 animate-in slide-in-from-right-4 flex-1">
                                                <header className="flex justify-between items-center px-1"><span className="text-[9px] font-black uppercase text-orange-500 tracking-widest">Escolha a Bandeira</span><button onClick={() => setPaymentStep('type')}><X size={16} className="text-slate-300" /></button></header>
                                                <div className="grid grid-cols-1 gap-2">
                                                    {filteredConfigs.map(cfg => (
                                                        <button key={cfg.id} disabled={isFinishing} onClick={() => { setSelectedConfig(cfg); setPaymentStep(selectedType === 'parcelado' ? 'installments' : 'confirm'); }} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl hover:border-orange-400 transition-all group shadow-sm disabled:opacity-50">
                                                            <span className="text-xs font-black text-slate-700 uppercase">{cfg.brand || cfg.name}</span>
                                                            <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-tighter">{100 - cfg.rate_cash}% Líquido</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
    
                                        {paymentStep === 'installments' && (
                                            <div className="space-y-6 animate-in slide-in-from-right-4 flex-1">
                                                <header className="flex justify-between items-center px-1"><span className="text-[9px] font-black uppercase text-orange-500 tracking-widest">Número de Parcelas</span><button onClick={() => setPaymentStep('brand')}><X size={16} className="text-slate-300" /></button></header>
                                                <div className="grid grid-cols-3 gap-2">
                                                    {Array.from({ length: (selectedConfig?.max_installments || 12) - 1 }, (_, i) => i + 2).map(n => (
                                                        <button key={n} disabled={isFinishing} onClick={() => { setInstallments(n); setPaymentStep('confirm'); }} className="py-3 bg-white border border-slate-100 rounded-xl font-black text-xs text-slate-600 hover:border-orange-400 hover:text-orange-600 transition-all disabled:opacity-50">
                                                            {n}x
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
    
                                        {paymentStep === 'confirm' && (
                                            <div className="space-y-6 animate-in slide-in-from-bottom-4 flex-1 flex flex-col">
                                                <header className="flex justify-between items-center px-1">
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{selectedConfig?.brand || selectedConfig?.name}</span>
                                                        {installments > 1 && <span className="text-[9px] font-bold text-orange-500 uppercase">Plano: {installments}x</span>}
                                                    </div>
                                                    <button onClick={() => setPaymentStep('type')}><X size={16} className="text-slate-300" /></button>
                                                </header>
                                                <div className="space-y-4 flex-1">
                                                    <div className="relative">
                                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-300">R$</span>
                                                        <input type="number" autoFocus disabled={isFinishing} value={amountToPay} onChange={e => setAmountToPay(e.target.value)} className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-2xl font-black text-slate-800 outline-none focus:border-orange-400 transition-all shadow-inner disabled:opacity-50" />
                                                    </div>
                                                </div>
                                                <button onClick={handleConfirmPartialPayment} disabled={isFinishing} className="w-full bg-slate-800 text-white font-black py-4 rounded-2xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                                                    <Calculator size={18} /> Confirmar Recebimento
                                                </button>
                                            </div>
                                        )}
                                    </div>
    
                                    <button 
                                        onClick={handleFinishCheckout} 
                                        disabled={isFinishing || totals.remaining > 0 || addedPayments.length === 0} 
                                        className={`w-full mt-6 py-6 rounded-[32px] font-black flex items-center justify-center gap-3 text-lg uppercase transition-all shadow-2xl ${totals.remaining === 0 && !isFinishing ? 'bg-emerald-600 text-white shadow-emerald-100' : 'bg-slate-100 text-slate-300'}`}
                                    >
                                        {isFinishing ? (
                                            <div className="flex items-center gap-2"><Loader2 size={24} className="animate-spin" /><span>PROCESSANDO...</span></div>
                                        ) : (
                                            <><CheckCircle size={24} /> FECHAR ATENDIMENTO</>
                                        )}
                                    </button>
                                </div>
                            )}
    
                            {isLocked && (
                                <div className="bg-emerald-50 p-8 rounded-[48px] border-2 border-emerald-100 text-center space-y-4 animate-in zoom-in-95">
                                    <CheckCircle size={48} className="text-emerald-500 mx-auto" />
                                    <h3 className="text-xl font-black text-emerald-800 uppercase tracking-tighter">Venda Liquidada</h3>
                                    <p className="text-xs text-emerald-600 font-medium leading-relaxed">Documento arquivado com sucesso.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    };
    
    export default CommandDetailView;
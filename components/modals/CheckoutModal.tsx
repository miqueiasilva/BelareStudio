import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
    X, CheckCircle, CreditCard, Banknote, 
    Smartphone, Loader2, Calendar, Split,
    History, ChevronDown, ChevronUp, AlertCircle,
    Check
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { useStudio } from '../../contexts/StudioContext';
import Toast, { ToastType } from '../shared/Toast';

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value);
};

interface DBPaymentMethod {
    id: string; 
    name: string;
    type: 'credit' | 'debit' | 'pix' | 'money';
    rate_cash: number;
    allow_installments: boolean;
    max_installments: number;
    installment_rates: Record<string, number>;
}

interface CheckoutModalProps {
    isOpen: boolean;
    onClose: () => void;
    appointment: {
        id: number;
        client_id?: number | string;
        client_name: string;
        service_name: string;
        price: number;
        professional_id?: number | string; 
        professional_name: string;
        payments?: any[];
        paid_amount?: number;
        remaining_amount?: number;
        notes?: string;
    };
    initialMode?: 'full' | 'partial';
    onSuccess: (info?: { isPartial?: boolean; amountPaid?: number; remaining?: number }) => void;
}

const CheckoutModal: React.FC<CheckoutModalProps> = ({ 
    isOpen, 
    onClose, 
    appointment, 
    initialMode = 'full',
    onSuccess 
}) => {
    const { activeStudioId } = useStudio();
    const [isLoading, setIsLoading] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    const [dbProfessionals, setDbProfessionals] = useState<any[]>([]);
    const [dbPaymentMethods, setDbPaymentMethods] = useState<DBPaymentMethod[]>([]);
    const [selectedProfessionalId, setSelectedProfessionalId] = useState<string>('');
    const [selectedCategory, setSelectedCategory] = useState<'pix' | 'money' | 'credit' | 'debit'>('pix');
    const [selectedMethodId, setSelectedMethodId] = useState<string>('');
    const [installments, setInstallments] = useState(1);
    
    // Suporte a Baixa Parcial e Quitação
    const [checkoutMode, setCheckoutMode] = useState<'full' | 'partial'>(initialMode);
    const [customAmount, setCustomAmount] = useState<string>('');
    const [paymentNotes, setPaymentNotes] = useState<string>('');
    const [existingPayments, setExistingPayments] = useState<any[]>([]);
    const [showHistory, setShowHistory] = useState<boolean>(false);

    const [paymentDate, setPaymentDate] = useState<string>(() => {
        const d = new Date();
        const tzoffset = d.getTimezoneOffset() * 60000;
        return (new Date(Date.now() - tzoffset)).toISOString().slice(0, 10);
    });

    const isSafeUUID = (id: any): boolean => {
        if (!id) return false;
        const sid = String(id).trim();
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sid);
    };

    const resetLocalState = useCallback(() => {
        setSelectedProfessionalId('');
        setSelectedCategory('pix');
        setSelectedMethodId('');
        setInstallments(1);
        setCustomAmount('');
        setPaymentNotes('');
        setExistingPayments([]);
        setShowHistory(false);
        setCheckoutMode(initialMode);
        const d = new Date();
        const tzoffset = d.getTimezoneOffset() * 60000;
        setPaymentDate((new Date(Date.now() - tzoffset)).toISOString().slice(0, 10));
    }, [initialMode]);

    // Cálculos Financeiros do Procedimento
    const totalPrice = useMemo(() => Number(appointment?.price || 0), [appointment?.price]);

    const alreadyPaid = useMemo(() => {
        return existingPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    }, [existingPayments]);

    const remainingBalance = useMemo(() => {
        return Math.max(0, totalPrice - alreadyPaid);
    }, [totalPrice, alreadyPaid]);

    // Define o valor padrão para baixa parcial quando abre em modo partial
    useEffect(() => {
        if (isOpen && remainingBalance > 0) {
            if (initialMode === 'partial' && !customAmount) {
                // Sugere 50% como padrão para sinal
                const half = Math.round((remainingBalance * 0.5) * 100) / 100;
                setCustomAmount(half.toFixed(2));
            }
            setCheckoutMode(initialMode);
        }
    }, [isOpen, initialMode, remainingBalance]);

    const amountToPay = useMemo(() => {
        if (checkoutMode === 'full') {
            return remainingBalance;
        }
        const parsed = parseFloat(String(customAmount).replace(',', '.'));
        return isNaN(parsed) ? 0 : Math.max(0, parsed);
    }, [checkoutMode, remainingBalance, customAmount]);

    const newRemaining = useMemo(() => {
        return Math.max(0, Math.round((remainingBalance - amountToPay) * 100) / 100);
    }, [remainingBalance, amountToPay]);

    const isCompleting = useMemo(() => {
        return amountToPay >= (remainingBalance - 0.01) && remainingBalance > 0;
    }, [amountToPay, remainingBalance]);

    const loadSystemData = useCallback(async () => {
        try {
            const [profsRes, methodsRes] = await Promise.all([
                supabase.from('team_members').select('id, name').order('name'),
                supabase.from('payment_methods_config').select('*').eq('is_active', true)
            ]);

            if (profsRes.error) throw profsRes.error;
            if (methodsRes.error) throw methodsRes.error;

            setDbProfessionals(profsRes.data || []);
            setDbPaymentMethods(methodsRes.data || []);

            if (methodsRes.data && methodsRes.data.length > 0) {
                const firstPix = methodsRes.data.find((m: any) => m.type === 'pix');
                if (firstPix) setSelectedMethodId(firstPix.id);
            }

            // Buscar histórico de pagamentos já vinculados a este agendamento
            if (appointment?.id) {
                let foundPayments: any[] = [];
                
                // 1. Verificar em transactions
                try {
                    const { data: trans } = await supabase
                        .from('financial_transactions')
                        .select('id, date, amount, payment_method, description, net_value, created_at')
                        .eq('appointment_id', appointment.id)
                        .neq('status', 'cancelado')
                        .order('date', { ascending: true });
                    
                    if (trans && trans.length > 0) {
                        foundPayments = trans.map((t: any) => ({
                            id: t.id,
                            date: t.date || t.created_at,
                            amount: Number(t.amount || 0),
                            method: t.payment_method || 'pix',
                            notes: t.description || 'Pagamento',
                            net_value: Number(t.net_value || t.amount || 0)
                        }));
                    }
                } catch (_tErr) {
                    // ignora silenciosamente
                }

                // 2. Se não achou em transações ou veio nos props do agendamento
                if (foundPayments.length === 0 && appointment.payments && appointment.payments.length > 0) {
                    foundPayments = appointment.payments;
                } else if (foundPayments.length === 0 && appointment.notes) {
                    const payMatch = appointment.notes.match(/---PAYMENTS_JSON---[\r\n\s]*([\s\S]*?)[\r\n\s]*---END_PAYMENTS_JSON---/);
                    if (payMatch) {
                        try {
                            foundPayments = JSON.parse(payMatch[1]);
                        } catch (_err) {
                            // ignora
                        }
                    }
                }

                setExistingPayments(foundPayments);
            }
        } catch (_err: any) {
            setToast({ message: "Erro ao sincronizar dados.", type: 'error' });
        }
    }, [appointment?.id, appointment?.payments, appointment?.notes]);

    useEffect(() => {
        if (isOpen) loadSystemData();
        else resetLocalState();
    }, [isOpen, loadSystemData]);

    useEffect(() => {
        if (isOpen && appointment && dbProfessionals.length > 0) {
            if (selectedProfessionalId) return;
            const profId = String(appointment.professional_id);
            if (isSafeUUID(profId)) {
                setSelectedProfessionalId(profId);
            } else if (appointment.professional_name) {
                const found = dbProfessionals.find(p => p.name.trim().toLowerCase() === appointment.professional_name.trim().toLowerCase());
                if (found) setSelectedProfessionalId(String(found.id));
            }
        }
    }, [isOpen, appointment, dbProfessionals, selectedProfessionalId]);

    const filteredMethods = useMemo(() => {
        return dbPaymentMethods.filter(m => m.type === selectedCategory);
    }, [dbPaymentMethods, selectedCategory]);

    useEffect(() => {
        if (filteredMethods.length > 0) {
            setSelectedMethodId(filteredMethods[0].id);
            setInstallments(1);
        } else setSelectedMethodId('');
    }, [selectedCategory, filteredMethods]);

    const currentMethod = useMemo(() => {
        return dbPaymentMethods.find(m => m.id === selectedMethodId);
    }, [dbPaymentMethods, selectedMethodId]);

    const financialMetrics = useMemo(() => {
        if (!currentMethod) return { rate: 0, netValue: amountToPay };
        const rate = installments === 1 ? Number(currentMethod.rate_cash || 0) : Number(currentMethod.installment_rates[installments.toString()] || 0);
        const discount = (amountToPay * rate) / 100;
        return { rate, netValue: amountToPay - discount };
    }, [currentMethod, installments, amountToPay]);

    const handleConfirmPayment = async () => {
        if (!currentMethod || isLoading) return;

        if (amountToPay <= 0) {
            setToast({ message: "Informe um valor válido para o recebimento.", type: 'error' });
            return;
        }

        if (amountToPay > remainingBalance + 0.01) {
            setToast({ message: `O valor informado (${formatCurrency(amountToPay)}) é maior que o saldo restante (${formatCurrency(remainingBalance)}).`, type: 'error' });
            return;
        }

        setIsLoading(true);

        try {
            const profId = isSafeUUID(selectedProfessionalId) ? selectedProfessionalId : null;
            const isPartialPayment = !isCompleting;
            
            // Descrição rica com detalhamento contábil
            const description = isPartialPayment
                ? `Baixa Parcial (${formatCurrency(amountToPay)}) - ${appointment.client_name} - ${appointment.service_name} (Restante: ${formatCurrency(newRemaining)})${paymentNotes ? ` - Obs: ${paymentNotes.trim()}` : ''}`
                : (alreadyPaid > 0 
                    ? `Quitação Final (${formatCurrency(amountToPay)}) - ${appointment.client_name} - ${appointment.service_name}${paymentNotes ? ` - Obs: ${paymentNotes.trim()}` : ''}`
                    : `Atendimento - ${appointment.client_name} - ${appointment.service_name}${paymentNotes ? ` - Obs: ${paymentNotes.trim()}` : ''}`);

            // 1. REGISTRO DO PAGAMENTO NO FINANCEIRO (RPC)
            const { data: transaction, error: rpcError } = await supabase.rpc('register_payment_transaction', {
                p_studio_id: activeStudioId || null,
                p_professional_id: profId,
                p_description: description,
                p_amount: Number(amountToPay),
                p_method: selectedCategory || 'pix',
                p_installments: Number(installments || 1),
                p_appointment_id: appointment.id,
                p_tax_rate: Number(financialMetrics.rate || 0),
                p_net_value: Number(financialMetrics.netValue || amountToPay)
            });

            if (rpcError) throw rpcError;

            // Determinar a data da baixa retroativa ou atual com timestamp atual
            const targetDate = new Date(paymentDate);
            const nowTime = new Date();
            targetDate.setHours(nowTime.getHours(), nowTime.getMinutes(), nowTime.getSeconds(), nowTime.getMilliseconds());
            const finalDateISO = targetDate.toISOString();

            const transactionId = (transaction as any)?.id;
            if (transactionId) {
                await supabase
                    .from('financial_transactions')
                    .update({ 
                        date: finalDateISO,
                        description: description
                    })
                    .eq('id', transactionId);
            }

            // 2. CRIAR/VINCULAR COMANDA PARA HISTÓRICO
            const { data: command } = await supabase
                .from('commands')
                .insert([{
                    studio_id: activeStudioId || null,
                    client_id: appointment.client_id || null,
                    client_name: appointment.client_name || 'Cliente',
                    professional_id: profId,
                    status: isCompleting ? 'pago' : 'open',
                    total_amount: Number(appointment.price || 0),
                    closed_at: isCompleting ? finalDateISO : null,
                    paid_at: finalDateISO,
                    payment_method: selectedCategory,
                    payment_data: {
                        payment_method: selectedCategory,
                        tax_rate: Number(financialMetrics.rate || 0),
                        gross_value: Number(amountToPay),
                        net_value: Number(financialMetrics.netValue || amountToPay),
                        installments: installments,
                        is_partial: isPartialPayment,
                        total_appointment_price: totalPrice,
                        amount_paid_now: amountToPay,
                        total_paid_so_far: alreadyPaid + amountToPay,
                        remaining_balance: newRemaining,
                        payment_notes: paymentNotes || null,
                        brand: null
                    }
                }])
                .select('id')
                .single();

            if (command && transactionId) {
                await supabase
                    .from('financial_transactions')
                    .update({ command_id: command.id })
                    .eq('id', transactionId);

                await supabase.from('command_items').insert([{
                    command_id: command.id,
                    appointment_id: appointment.id,
                    studio_id: activeStudioId || null,
                    title: isPartialPayment ? `${appointment.service_name} (Baixa Parcial)` : appointment.service_name,
                    price: amountToPay,
                    quantity: 1,
                    professional_id: profId
                }]);
            }

            // 3. ATUALIZAÇÃO DO AGENDAMENTO COM HISTÓRICO COMPLETO DE PAGAMENTOS
            const { data: freshAppt } = await supabase
                .from('appointments')
                .select('notes, status')
                .eq('id', appointment.id)
                .maybeSingle();

            let rawNotes = freshAppt?.notes || appointment.notes || '';
            const pIdx = rawNotes.indexOf('---PAYMENTS_JSON---');
            if (pIdx !== -1) {
                const pEnd = rawNotes.indexOf('---END_PAYMENTS_JSON---');
                if (pEnd !== -1) {
                    rawNotes = (rawNotes.substring(0, pIdx) + rawNotes.substring(pEnd + '---END_PAYMENTS_JSON---'.length)).trim();
                } else {
                    rawNotes = rawNotes.substring(0, pIdx).trim();
                }
            }

            const newPaymentEntry = {
                id: transactionId || String(Date.now()),
                date: finalDateISO,
                amount: Number(amountToPay),
                method: selectedCategory,
                installments: Number(installments || 1),
                notes: paymentNotes.trim() || (isPartialPayment ? 'Baixa Parcial / Antecipação' : 'Quitação Integral'),
                remaining: newRemaining,
                net_value: Number(financialMetrics.netValue || amountToPay),
                tax_rate: Number(financialMetrics.rate || 0)
            };

            const updatedAllPayments = [...existingPayments, newPaymentEntry];
            const paymentsMetadata = `\n---PAYMENTS_JSON---\n${JSON.stringify(updatedAllPayments)}\n---END_PAYMENTS_JSON---`;
            const finalNotes = (rawNotes ? rawNotes + '\n' : '') + paymentsMetadata;

            // Se quitou totalmente, status vira 'concluido'. Se foi parcial, mantém o status original (ex: agendado/confirmado)
            const targetStatus = isCompleting ? 'concluido' : (freshAppt?.status || 'agendado');

            const { error: apptError } = await supabase
                .from('appointments')
                .update({ 
                    status: targetStatus,
                    value: Number(appointment.price || 0),
                    notes: finalNotes
                })
                .eq('id', appointment.id);
            
            if (apptError) throw apptError;

            if (isPartialPayment) {
                setToast({ 
                    message: `Baixa parcial de ${formatCurrency(amountToPay)} recebida! Saldo restante: ${formatCurrency(newRemaining)}`, 
                    type: 'success' 
                });
            } else {
                setToast({ message: "Procedimento quitado com sucesso! ✅", type: 'success' });
            }

            setTimeout(() => {
                onSuccess({
                    isPartial: isPartialPayment,
                    amountPaid: amountToPay,
                    remaining: newRemaining
                });
                onClose();
            }, 600);

        } catch (error: any) {
            console.error("Erro no recebimento:", error);
            setToast({ message: "Erro ao finalizar recebimento: " + error.message, type: 'error' });
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    const categories = [
        { id: 'pix', label: 'Pix', icon: Smartphone, color: 'text-teal-600', bg: 'bg-teal-50' },
        { id: 'money', label: 'Dinheiro', icon: Banknote, color: 'text-green-600', bg: 'bg-green-50' },
        { id: 'credit', label: 'Crédito', icon: CreditCard, color: 'text-blue-600', bg: 'bg-blue-50' },
        { id: 'debit', label: 'Débito', icon: CreditCard, color: 'text-cyan-600', bg: 'bg-cyan-50' },
    ];

    return (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-300">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            <div className="bg-white w-full max-w-lg rounded-[36px] shadow-2xl overflow-hidden max-h-[92vh] flex flex-col text-left">
                {/* Header */}
                <header className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="p-1.5 bg-orange-100 text-orange-600 rounded-xl">
                                <Split size={16} />
                            </span>
                            <h2 className="text-lg sm:text-xl font-black text-slate-800 uppercase tracking-tight">
                                {alreadyPaid > 0 ? 'Recebimento / Quitação' : 'Recebimento de Procedimento'}
                            </h2>
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5 ml-8">
                            Cliente: {appointment.client_name}
                        </p>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-2 text-slate-400 hover:bg-slate-200 rounded-full transition-all"
                    >
                        <X size={20} />
                    </button>
                </header>

                <main className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
                    {/* Seletor do Tipo de Recebimento: Quitação Total vs Baixa Parcial */}
                    <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-2xl">
                        <button
                            type="button"
                            onClick={() => {
                                setCheckoutMode('full');
                                setCustomAmount('');
                            }}
                            className={`py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                                checkoutMode === 'full' 
                                    ? 'bg-white text-slate-800 shadow-sm' 
                                    : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            <CheckCircle size={14} className={checkoutMode === 'full' ? 'text-emerald-500' : 'text-slate-400'} />
                            <span>{alreadyPaid > 0 ? 'Quitar Restante' : 'Quitação Total'}</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setCheckoutMode('partial');
                                if (!customAmount && remainingBalance > 0) {
                                    setCustomAmount((remainingBalance * 0.5).toFixed(2));
                                }
                            }}
                            className={`py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                                checkoutMode === 'partial' 
                                    ? 'bg-white text-orange-600 shadow-sm' 
                                    : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            <Split size={14} className={checkoutMode === 'partial' ? 'text-orange-500' : 'text-slate-400'} />
                            <span>Baixa Parcial / Sinal</span>
                        </button>
                    </div>

                    {/* Card de Valores */}
                    <div className="bg-slate-900 rounded-[28px] p-5 text-white shadow-xl relative overflow-hidden">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{appointment.service_name}</p>
                                <p className="text-xs text-slate-300 font-bold mt-0.5">Valor Total: {formatCurrency(totalPrice)}</p>
                            </div>
                            {alreadyPaid > 0 && (
                                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                                    Já Pago: {formatCurrency(alreadyPaid)}
                                </span>
                            )}
                        </div>

                        {/* Valor que será pago agora */}
                        <div className="mt-3 pt-3 border-t border-slate-800 flex justify-between items-end">
                            <div>
                                <span className="text-[9px] font-black uppercase text-orange-400 tracking-wider block">
                                    {checkoutMode === 'full' ? 'Valor a Quitar Agora' : 'Valor Desta Baixa Parcial'}
                                </span>
                                <h3 className="text-3xl font-black text-emerald-400 tracking-tight">
                                    {formatCurrency(amountToPay)}
                                </h3>
                            </div>

                            {checkoutMode === 'partial' && (
                                <div className="text-right">
                                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">
                                        Restará Pendente
                                    </span>
                                    <span className={`text-base font-black ${newRemaining > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                        {formatCurrency(newRemaining)}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Mensagem descritiva de quitação */}
                        {isCompleting ? (
                            <div className="mt-3 flex items-center gap-1.5 text-[10px] font-bold text-emerald-300 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
                                <Check size={12} className="shrink-0" />
                                <span>Este recebimento quita 100% do procedimento e conclui o agendamento.</span>
                            </div>
                        ) : (
                            <div className="mt-3 flex items-center gap-1.5 text-[10px] font-bold text-amber-300 bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/20">
                                <AlertCircle size={12} className="shrink-0" />
                                <span>O agendamento continuará ativo na agenda aguardando quitação do saldo restante.</span>
                            </div>
                        )}
                    </div>

                    {/* Inputs específicos para Baixa Parcial */}
                    {checkoutMode === 'partial' && (
                        <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 space-y-3">
                            <label className="text-[10px] font-black uppercase text-amber-800 tracking-wider flex items-center justify-between">
                                <span>Digite o valor a receber agora (R$)</span>
                                <span className="text-amber-600 font-bold">Saldo máximo: {formatCurrency(remainingBalance)}</span>
                            </label>

                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400 text-sm">R$</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    max={remainingBalance}
                                    value={customAmount}
                                    onChange={(e) => setCustomAmount(e.target.value)}
                                    placeholder="0,00"
                                    className="w-full bg-white border border-amber-300 rounded-xl pl-11 pr-4 py-3 font-black text-slate-800 text-lg outline-none focus:ring-4 focus:ring-amber-200 focus:border-amber-500 transition-all shadow-xs"
                                />
                            </div>

                            {/* Chips de Atalhos Rápidos */}
                            <div className="flex flex-wrap gap-1.5 pt-1">
                                <span className="text-[9px] font-bold uppercase text-amber-700 w-full mb-0.5">Sugestões Rápidas:</span>
                                {remainingBalance > 0 && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => setCustomAmount((remainingBalance * 0.5).toFixed(2))}
                                            className="px-2.5 py-1 bg-white hover:bg-amber-100/80 border border-amber-200 rounded-lg text-[10px] font-black text-amber-800 transition-all shadow-2xs"
                                        >
                                            50% (Metade: {formatCurrency(remainingBalance * 0.5)})
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setCustomAmount((remainingBalance * 0.3).toFixed(2))}
                                            className="px-2.5 py-1 bg-white hover:bg-amber-100/80 border border-amber-200 rounded-lg text-[10px] font-black text-amber-800 transition-all shadow-2xs"
                                        >
                                            30% ({formatCurrency(remainingBalance * 0.3)})
                                        </button>
                                        {remainingBalance >= 50 && (
                                            <button
                                                type="button"
                                                onClick={() => setCustomAmount('50.00')}
                                                className="px-2.5 py-1 bg-white hover:bg-amber-100/80 border border-amber-200 rounded-lg text-[10px] font-black text-amber-800 transition-all shadow-2xs"
                                            >
                                                Sinal R$ 50,00
                                            </button>
                                        )}
                                        {remainingBalance >= 100 && (
                                            <button
                                                type="button"
                                                onClick={() => setCustomAmount('100.00')}
                                                className="px-2.5 py-1 bg-white hover:bg-amber-100/80 border border-amber-200 rounded-lg text-[10px] font-black text-amber-800 transition-all shadow-2xs"
                                            >
                                                Sinal R$ 100,00
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Histórico de Pagamentos Já Recebidos */}
                    {existingPayments.length > 0 && (
                        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                            <button
                                type="button"
                                onClick={() => setShowHistory(!showHistory)}
                                className="w-full p-3 flex items-center justify-between text-left text-[11px] font-black uppercase text-slate-700 bg-slate-50 hover:bg-slate-100 transition-all"
                            >
                                <span className="flex items-center gap-1.5 text-emerald-700">
                                    <History size={13} />
                                    Histórico de Baixas Anteriores ({existingPayments.length})
                                </span>
                                {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                            {showHistory && (
                                <div className="divide-y divide-slate-100 p-2 max-h-40 overflow-y-auto custom-scrollbar">
                                    {existingPayments.map((p, idx) => (
                                        <div key={p.id || idx} className="p-2 flex items-center justify-between text-xs">
                                            <div>
                                                <p className="font-bold text-slate-700">
                                                    {p.notes || 'Baixa registrada'}
                                                </p>
                                                <p className="text-[10px] text-slate-400">
                                                    {p.date ? new Date(p.date).toLocaleDateString('pt-BR') : 'Data não informada'} • Via {p.method?.toUpperCase()}
                                                </p>
                                            </div>
                                            <span className="font-black text-emerald-600 font-mono">
                                                +{formatCurrency(Number(p.amount || 0))}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Campo de Data Retroativa / Baixa */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-1.5 shadow-xs text-left">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                            <Calendar size={12} className="text-orange-500" />
                            Data do Recebimento (Baixa Retroativa ou Atual)
                        </label>
                        <input 
                            type="date"
                            value={paymentDate}
                            onChange={(e) => setPaymentDate(e.target.value)}
                            className="w-full bg-white border border-slate-250 rounded-xl px-4 py-2 font-bold text-slate-700 outline-none focus:ring-4 focus:ring-orange-50 focus:border-orange-500 transition-all text-xs"
                        />
                    </div>

                    {/* Observação Opcional */}
                    <div className="space-y-1 text-left">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                            Observação / Motivo da Baixa (Opcional)
                        </label>
                        <input
                            type="text"
                            value={paymentNotes}
                            onChange={(e) => setPaymentNotes(e.target.value)}
                            placeholder={checkoutMode === 'partial' ? "Ex: Sinal antecipado via Pix para garantia de vaga" : "Ex: Quitação presencial no balcão"}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 font-medium text-slate-700 text-xs outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-500 transition-all"
                        />
                    </div>

                    {/* Seleção de Categoria de Pagamento */}
                    <div className="grid grid-cols-4 gap-2">
                        {categories.map((cat) => (
                            <button
                                key={cat.id}
                                type="button"
                                onClick={() => setSelectedCategory(cat.id as any)}
                                className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all ${
                                    selectedCategory === cat.id ? 'border-orange-500 bg-orange-50' : 'bg-white border-slate-100 hover:border-slate-200'
                                }`}
                            >
                                <div className={`p-2 rounded-xl mb-1 ${cat.bg} ${cat.color}`}><cat.icon size={18} /></div>
                                <span className="text-[9px] font-black uppercase">{cat.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Seleção de Maquininha / Configuração & Parcelas */}
                    {filteredMethods.length > 0 && (
                        <div className="space-y-3">
                            <select 
                                value={selectedMethodId}
                                onChange={(e) => setSelectedMethodId(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none text-xs"
                            >
                                {filteredMethods.map(m => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                            </select>

                            {currentMethod?.type === 'credit' && currentMethod.allow_installments && (
                                <select 
                                    value={installments}
                                    onChange={(e) => setInstallments(parseInt(e.target.value))}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none text-xs"
                                >
                                    <option value={1}>À vista (1x)</option>
                                    {Array.from({ length: (currentMethod.max_installments || 1) - 1 }, (_, i) => i + 2).map(n => (
                                        <option key={n} value={n}>{n} Vezes</option>
                                    ))}
                                </select>
                            )}
                        </div>
                    )}
                </main>

                {/* Footer Fixo */}
                <footer className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 flex gap-3 shrink-0">
                    <button 
                        onClick={onClose} 
                        className="flex-1 py-3.5 text-slate-500 hover:text-slate-800 font-black uppercase text-xs transition-all"
                    >
                        Cancelar
                    </button>
                    
                    <button
                        onClick={handleConfirmPayment}
                        disabled={isLoading || !currentMethod || amountToPay <= 0}
                        className={`flex-[2] py-3.5 px-4 rounded-2xl font-black text-xs uppercase tracking-wider text-white shadow-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
                            isLoading || amountToPay <= 0 
                                ? 'bg-slate-300 cursor-not-allowed' 
                                : checkoutMode === 'partial' && !isCompleting
                                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 shadow-amber-500/20'
                                    : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                        }`}
                    >
                        {isLoading ? (
                            <Loader2 className="animate-spin" size={18} />
                        ) : (
                            <CheckCircle size={18} />
                        )}
                        <span>
                            {checkoutMode === 'partial' && !isCompleting
                                ? `Registrar Baixa Parcial (${formatCurrency(amountToPay)})`
                                : `Quitar Atendimento (${formatCurrency(amountToPay)})`}
                        </span>
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default CheckoutModal;
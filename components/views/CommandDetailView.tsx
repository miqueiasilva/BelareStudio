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
    
    const CommandDetailView: React.FC<{ commandId: string; onBack: () => void }> = ({ commandId, onBack }) => {
        const { activeStudioId } = useStudio();
        const [command, setCommand] = useState<any>(null);
        const [loading, setLoading] = useState(true);
        const [isFinishing, setIsFinishing] = useState(false);
        const [isLocked, setIsLocked] = useState(false);

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
                        id, studio_id, client_id, client_name, professional_id, status, created_at, closed_at,
                        clients:client_id (id, nome, name, photo_url)
                    `)
                    .eq('id', commandId)
                    .single();
    
                if (cmdError) throw cmdError;
    
                const { data: itemsData } = await supabase
                    .from('command_items')
                    .select('*')
                    .eq('command_id', commandId);
    
                const [configsRes, payHistoryRes] = await Promise.all([
                    supabase.from('payment_methods_config').select('*').eq('studio_id', activeStudioId).eq('is_active', true),
                    supabase.from('command_payments').select(`*, payment_methods_config (name, brand)`).eq('command_id', commandId)
                ]);
    
                setAvailableConfigs(configsRes.data || []);
                
                if (payHistoryRes.data && payHistoryRes.data.length > 0) {
                    setHistoryPayments(payHistoryRes.data);
                    if (payHistoryRes.data.some(p => p.status === 'paid')) setIsLocked(true);
                }
    
                setCommand({
                    ...cmdData,
                    command_items: itemsData || [],
                    display_client_name: cmdData.clients?.nome || cmdData.clients?.name || cmdData.client_name || "Consumidor Final"
                });

                if (cmdData.status === 'paid') setIsLocked(true);

            } catch (e: any) {
                console.error('[COMMAND_FETCH_ERROR]', e);
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
            const totalAfterDiscount = Math.max(0, subtotal - (parseFloat(discount) || 0));
            const currentPaid = addedPayments.reduce((acc, p) => acc + p.amount, 0);
            return { subtotal, total: totalAfterDiscount, paid: currentPaid, remaining: Math.max(0, totalAfterDiscount - currentPaid) };
        }, [command, discount, addedPayments]);

        const handleFinishCheckout = async () => {
            if (isProcessingRef.current || isLocked || addedPayments.length === 0) return;
            
            isProcessingRef.current = true;
            setIsFinishing(true);

            try {
                // 1. VERIFICAÇÃO PREVENTIVA (Idempotência)
                const { data: existingPay } = await supabase
                    .from('command_payments')
                    .select('id, status')
                    .eq('command_id', commandId)
                    .eq('status', 'paid')
                    .maybeSingle();

                if (existingPay) {
                    console.log('✅ Pagamento já liquidado.');
                } else {
                    // 2. REGISTRO FINANCEIRO VIA RPC
                    const mainPayment = addedPayments[0];
                    const totalAmount = addedPayments.reduce((acc, p) => acc + p.amount, 0);
                    const totalNet = addedPayments.reduce((acc, p) => acc + p.net_value, 0);
                    const totalFees = addedPayments.reduce((acc, p) => acc + p.fee_amount, 0);

                    // FIX: Passagem obrigatória de p_command_id e p_client_id para sanar erro de NULL no Postgres
                    const { data: financialTxId, error: rpcError } = await supabase.rpc('register_payment_transaction', {
                        p_studio_id: activeStudioId,
                        p_professional_id: command.professional_id || null,
                        p_client_id: command.client_id || null,
                        p_command_id: commandId,
                        p_amount: totalAmount,
                        p_method: mainPayment.method,
                        p_brand: mainPayment.brand || null,
                        p_installments: Math.max(...addedPayments.map(p => p.installments))
                    });

                    if (rpcError) throw new Error(`Falha no Registro Financeiro: ${rpcError.message}`);

                    // 3. REGISTRO AUDITADO
                    const { error: insError } = await supabase
                        .from('command_payments')
                        .insert([{
                            command_id: commandId,
                            studio_id: activeStudioId,
                            amount: totalAmount,
                            fee_amount: totalFees,
                            net_value: totalNet,
                            fee_applied: mainPayment.fee_rate,
                            installments: Math.max(...addedPayments.map(p => p.installments)),
                            method_id: mainPayment.method_id,
                            brand: addedPayments.length > 1 ? 'Misto' : mainPayment.brand,
                            financial_transaction_id: financialTxId,
                            status: 'paid'
                        }]);

                    if (insError && insError.code !== '23505') throw insError;
                }

                // 4. ATUALIZAÇÃO FINAL
                const { error: cmdUpdateErr } = await supabase
                    .from('commands')
                    .update({ 
                        status: 'paid', 
                        closed_at: new Date().toISOString(),
                        total_amount: totals.total 
                    })
                    .eq('id', commandId);

                if (cmdUpdateErr) throw cmdUpdateErr;

                setToast({ message: "Atendimento finalizado com sucesso! ✅", type: 'success' });
                setIsLocked(true);
                setTimeout(onBack, 1000);

            } catch (e: any) {
                console.error('[CHECKOUT_FATAL]', e);
                setToast({ message: e.message || "Erro ao encerrar.", type: 'error' });
                isProcessingRef.current = false;
                setIsFinishing(false);
            }
        };
    
        const filteredConfigs = useMemo(() => {
            if (!selectedType) return [];
            if (selectedType === 'parcelado') return availableConfigs.filter(c => c.type === 'credit' && c.allow_installments);
            return availableConfigs.filter(c => c.type === selectedType);
        }, [availableConfigs, selectedType]);

        const handleSelectType = (type: string) => {
            setSelectedType(type);
            setAmountToPay(totals.remaining.toFixed(2));
            setSelectedConfig(null);
            setInstallments(1);
            if (type === 'pix' || type === 'money') {
                const config = availableConfigs.find(c => c.type === (type === 'money' ? 'money' : 'pix'));
                setSelectedConfig(config || { type, name: type.toUpperCase(), rate_cash: 0 });
                setPaymentStep('confirm');
            } else { setPaymentStep('brand'); }
        };

        const handleConfirmPartialPayment = () => {
            if (!selectedConfig) return;
            const amount = parseFloat(amountToPay.replace(',', '.'));
            if (isNaN(amount) || amount <= 0) return;
            const feeRate = installments > 1 ? (selectedConfig.installment_rates?.[installments] || 0) : (selectedConfig.rate_cash || 0);
            const feeAmount = (amount * (Number(feeRate) / 100));
            setAddedPayments(prev => [...prev, {

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    X, CheckCircle, Wallet, CreditCard, Banknote, 
    Smartphone, Loader2, ShoppingCart, ArrowRight,
    ChevronDown, Info, Percent, Layers, AlertTriangle,
    User, Receipt, UserCheck, UserPlus
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

// Auxiliar para validar UUID antes de enviar para a RPC (Padrão 8-4-4-4-12)
const isSafeUUID = (str: any): boolean => {
    if (!str || typeof str !== 'string') return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
};

interface DBPaymentMethod {
    id: string; 
    name: string;
    type: 'credit' | 'debit' | 'pix' | 'money';
    brand: string | null;
    rate_cash: number;
    rate_installment?: number;
    allow_installments: boolean;
    max_installments: number;
    installment_rates: Record<string, number>;
}

interface CheckoutModalProps {
    isOpen: boolean;
    onClose: () => void;
    appointment: {
        id: number;
        command_id?: string;
        client_id?: number | string;
        client_name: string;
        service_name: string;
        price: number;
        professional_id?: number | string; 
        professional_name: string;
    };
    onSuccess: () => void;
}

const CheckoutModal: React.FC<CheckoutModalProps> = ({ isOpen, onClose, appointment, onSuccess }) => {
    const { activeStudioId } = useStudio();
    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    
    const isProcessingRef = useRef(false);

    const [dbPaymentMethods, setDbPaymentMethods] = useState<DBPaymentMethod[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<'pix' | 'money' | 'credit' | 'debit'>('pix');
    const [selectedMethodId, setSelectedMethodId] = useState<string>('');
    const [installments, setInstallments] = useState(1);

    const loadSystemData = async () => {
        setIsFetching(true);
        try {
            const { data: methodsRes } = await supabase
                .from('payment_methods_config')
                .select('*')
                .eq('is_active', true);

            setDbPaymentMethods(methodsRes || []);

            if (methodsRes?.length) {
                const firstPix = methodsRes.find((m: any) => m.type === 'pix');
                if (firstPix) setSelectedMethodId(firstPix.id);
            }
        } catch (err: any) {
            console.error('[CHECKOUT_INIT_ERROR]', err);
        } finally {
            setIsFetching(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            isProcessingRef.current = false;
            loadSystemData();
        }
    }, [isOpen]);

    const filteredMethods = useMemo(() => {
        return dbPaymentMethods.filter(m => m.type === selectedCategory);
    }, [dbPaymentMethods, selectedCategory]);

    const currentMethod = useMemo(() => {
        return dbPaymentMethods.find(m => m.id === selectedMethodId);
    }, [dbPaymentMethods, selectedMethodId]);

    const handleConfirmPayment = async () => {
        if (isProcessingRef.current || isLoading || !currentMethod || !activeStudioId) return;

        if (!appointment.client_id) {
            setToast({ message: "Identifique o cliente no agendamento antes de liquidar.", type: 'error' });
            return;
        }
        
        isProcessingRef.current = true;
        setIsLoading(true);

        const commandId = appointment.command_id;

        try {
            // [IDEMPOTENCY CHECK]
            if (commandId) {
                const { data: existing } = await supabase
                    .from('command_payments')
                    .select('id')
                    .eq('command_id', commandId)
                    .eq('status', 'paid')
                    .maybeSingle();

                if (existing) {
                    onSuccess();
                    onClose();
                    return;
                }
            }

            // Sanitização de IDs para a RPC
            const safeProfessionalId = isSafeUUID(appointment.professional_id) ? appointment.professional_id : null;
            const safeCommandId = isSafeUUID(commandId) ? commandId : null;
            const safeClientId = appointment.client_id ? Number(appointment.client_id) : null;

            console.log('🚀 Enviando RPC Checkout Rápido com:', {
                p_studio_id: activeStudioId,
                p_professional_id: safeProfessionalId,
                p_client_id: safeClientId, 
                p_command_id: safeCommandId,
                p_amount: appointment.price,
                p_method: currentMethod.type,
                p_brand: currentMethod.brand || "N/A",
                p_installments: installments
            });

            // [RPC_CALL] - Única via permitida para inserção de pagamentos
            const { error: rpcError } = await supabase.rpc('register_payment_transaction', {
                p_studio_id: activeStudioId,
                p_professional_id: safeProfessionalId,
                p_client_id: safeClientId, 
                p_command_id: safeCommandId,
                p_amount: parseFloat(appointment.price.toFixed(2)),
                p_method: currentMethod.type,
                p_brand: currentMethod.brand || "N/A",
                p_installments: parseInt(String(installments || 1))
            });

            if (rpcError && rpcError.code !== '23505') {
                throw new Error(rpcError.message);
            }

            // [STATUS_SYNC] Atualiza o status tanto no comando quanto no agendamento
            const updates = [];
            if (safeCommandId) {
                updates.push(supabase.from('commands').update({ 
                    status: 'paid', 
                    closed_at: new Date().toISOString()
                }).eq('id', safeCommandId));
            }
            updates.push(supabase.from('appointments').update({ status: 'concluido' }).eq('id', appointment.id));

            await Promise.all(updates);

            setToast({ message: "Recebimento confirmado! ✅", type: 'success' });
            onSuccess();
            onClose();

        } catch (error: any) {
            console.error("[CHECKOUT_EXCEPTION]", error);
            setToast({ message: `Erro no checkout: ${error.message}`, type: 'error' });
            isProcessingRef.current = false;
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
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-300">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <div className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden text-left">
                <header className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Checkout Direto</h2>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-200 rounded-full transition-all"><X size={24} /></button>
                </header>

                <main className="p-8 space-y-6">
                    {isFetching ? (
                        <div className="py-20 flex flex-col items-center justify-center">
                            <Loader2 className="animate-spin text-orange-500 mb-4" size={40} />
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Preparando...</p>
                        </div>
                    ) : (
                        <>
                            <div className="bg-slate-900 rounded-[32px] p-6 text-white text-center">
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">{appointment.service_name}</p>
                                <h3 className="text-3xl font-black text-emerald-400">{formatCurrency(appointment.price)}</h3>
                            </div>

                            <div className="grid grid-cols-4 gap-2">
                                {categories.map((cat) => (
                                    <button
                                        key={cat.id}
                                        disabled={isLoading}
                                        onClick={() => setSelectedCategory(cat.id as any)}
                                        className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all ${selectedCategory === cat.id ? 'border-orange-500 bg-orange-50' : 'bg-white border-slate-100'} disabled:opacity-50`}
                                    >
                                        <div className={`p-2 rounded-xl mb-1 ${cat.bg} ${cat.color}`}><cat.icon size={20} /></div>
                                        <span className="text-[9px] font-black uppercase">{cat.label}</span>
                                    </button>
                                ))}
                            </div>

                            {filteredMethods.length > 0 && (
                                <div className="space-y-4 animate-in slide-in-from-top-2">
                                    <select 
                                        disabled={isLoading}
                                        value={selectedMethodId}
                                        onChange={(e) => setSelectedMethodId(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 font-bold text-slate-700 outline-none"
                                    >
                                        {filteredMethods.map(m => (
                                            <option key={m.id} value={m.id}>{m.name}</option>
                                        ))}
                                    </select>
                                    {currentMethod?.type === 'credit' && currentMethod.allow_installments && (
                                        <select 
                                            disabled={isLoading}
                                            value={installments}
                                            onChange={(e) => setInstallments(parseInt(e.target.value))}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 font-bold text-slate-700 outline-none"
                                        >
                                            <option value={1}>À vista (1x)</option>
                                            {Array.from({ length: (currentMethod.max_installments || 1) - 1 }, (_, i) => i + 2).map(n => (
                                                <option key={n} value={n}>{n} Vezes</option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </main>

                <footer className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4">
                    <button onClick={onClose} disabled={isLoading} className="flex-1 py-4 text-slate-500 font-black uppercase text-xs disabled:opacity-50">Cancelar</button>
                    <button
                        onClick={handleConfirmPayment}
                        disabled={isLoading || isFetching || !currentMethod}
                        className="flex-[2] bg-slate-800 text-white py-4 rounded-2xl font-black shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                    >
                        {isLoading ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle size={20} />}
                        {isLoading ? 'CONFIRMANDO...' : 'Liquidar Agora'}
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default CheckoutModal;
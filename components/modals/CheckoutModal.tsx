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
    
    // BARREIRA CONTRA MÚLTIPLOS CLIQUES
    const isProcessingRef = useRef(false);

    const [dbProfessionals, setDbProfessionals] = useState<any[]>([]);
    const [dbPaymentMethods, setDbPaymentMethods] = useState<DBPaymentMethod[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<'pix' | 'money' | 'credit' | 'debit'>('pix');
    const [selectedMethodId, setSelectedMethodId] = useState<string>('');
    const [installments, setInstallments] = useState(1);

    const loadSystemData = async () => {
        setIsFetching(true);
        try {
            const [profsRes, methodsRes] = await Promise.all([
                supabase.from('team_members').select('id, name').order('name'),
                supabase.from('payment_methods_config').select('*').eq('is_active', true)
            ]);

            setDbProfessionals(profsRes.data || []);
            setDbPaymentMethods(methodsRes.data || []);

            if (methodsRes.data?.length) {
                const firstPix = methodsRes.data.find((m: any) => m.type === 'pix');
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
        // BLOQUEIO SÍNCRONO IMEDIATO
        if (isProcessingRef.current || isLoading || !currentMethod || !activeStudioId) {
            console.log('🚫 Bloqueado - Processamento ativo');
            return;
        }
        
        isProcessingRef.current = true;
        setIsLoading(true);

        const commandId = appointment.command_id;

        try {
            // 1. CÁLCULO DE VALORES
            const feeRate = installments > 1 
                ? Number(currentMethod.installment_rates?.[installments.toString()] || currentMethod.rate_installment || 0)
                : Number(currentMethod.rate_cash || 0);
            
            const feeAmount = (appointment.price * feeRate) / 100;
            const netValue = appointment.price - feeAmount;

            const paymentPayload = {
                command_id: commandId || null,
                studio_id: activeStudioId,
                amount: appointment.price,
                net_value: netValue,
                fee_amount: feeAmount,
                fee_applied: feeRate,
                method_id: currentMethod.id,
                brand: currentMethod.brand || null,
                installments: installments || 1,
                status: 'paid'
            };

            // 2. TENTATIVA DE INSERÇÃO COM RESILIÊNCIA 409
            if (commandId) {
                const { data: existing } = await supabase
                    .from('command_payments')
                    .select('id, status')
                    .eq('command_id', commandId)
                    .eq('status', 'paid')
                    .maybeSingle();

                if (!existing) {
                    const { error: insErr } = await supabase
                        .from('command_payments')
                        .insert([paymentPayload]);
                    
                    // Se 409, o pagamento já entrou por outro clique, então ignoramos
                    if (insErr && insErr.code !== '23505') {
                        console.error('payment error', { code: insErr.code, message: insErr.message });
                        throw insErr;
                    }
                }
            } else {
                // Sem comanda (venda direta simplificada)
                const { error: insErr } = await supabase.from('command_payments').insert([paymentPayload]);
                if (insErr) throw insErr;
            }

            // 3. ATUALIZAÇÃO DOS STATUS (SEMPRE APÓS GARANTIR O REGISTRO DO PAGAMENTO)
            if (commandId) {
                await supabase
                    .from('commands')
                    .update({ status: 'paid', closed_at: new Date().toISOString() })
                    .eq('id', commandId);
            }

            await supabase
                .from('appointments')
                .update({ status: 'concluido' })
                .eq('id', appointment.id);

            setToast({ message: "Recebimento confirmado! ✅", type: 'success' });
            onSuccess();
            onClose();

        } catch (error: any) {
            console.error("[CHECKOUT_EXCEPTION]", error);
            setToast({ message: `Erro no checkout: ${error.message}`, type: 'error' });
            // Destrava para permitir correção pelo usuário
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
            <div className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden">
                <header className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Recebimento Auditado</h2>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-200 rounded-full transition-all"><X size={24} /></button>
                </header>

                <main className="p-8 space-y-6">
                    {isFetching ? (
                        <div className="py-20 flex flex-col items-center justify-center">
                            <Loader2 className="animate-spin text-orange-500 mb-4" size={40} />
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Preparando Terminal...</p>
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
                        {isLoading ? 'PROCESSANDO...' : 'Confirmar Venda'}
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default CheckoutModal;
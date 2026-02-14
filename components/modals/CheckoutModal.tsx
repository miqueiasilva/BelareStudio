import React, { useState, useEffect, useMemo } from 'react';
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
    };
    onSuccess: () => void;
}

const CheckoutModal: React.FC<CheckoutModalProps> = ({ isOpen, onClose, appointment, onSuccess }) => {
    const { activeStudioId } = useStudio();
    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    const [dbProfessionals, setDbProfessionals] = useState<any[]>([]);
    const [dbPaymentMethods, setDbPaymentMethods] = useState<DBPaymentMethod[]>([]);
    const [selectedProfessionalId, setSelectedProfessionalId] = useState<string>('');
    const [selectedCategory, setSelectedCategory] = useState<'pix' | 'money' | 'credit' | 'debit'>('pix');
    const [selectedMethodId, setSelectedMethodId] = useState<string>('');
    const [installments, setInstallments] = useState(1);

    const isSafeUUID = (id: any): boolean => {
        if (!id) return false;
        const sid = String(id).trim();
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sid);
    };

    const resetLocalState = () => {
        setSelectedProfessionalId('');
        setSelectedCategory('pix');
        setSelectedMethodId('');
        setInstallments(1);
    };

    const loadSystemData = async () => {
        setIsFetching(true);
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
        } catch (err: any) {
            setToast({ message: "Erro ao sincronizar dados.", type: 'error' });
        } finally {
            setIsFetching(false);
        }
    };

    useEffect(() => {
        if (isOpen) loadSystemData();
        else resetLocalState();
    }, [isOpen]);

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
    }, [isOpen, appointment, dbProfessionals]);

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

    const handleConfirmPayment = async () => {
        if (!currentMethod || !activeStudioId) return;
        setIsLoading(true);

        try {
            // 1. LOCALIZAR COMANDA VINCULADA AO AGENDAMENTO
            const { data: command, error: cmdFindError } = await supabase
                .from('commands')
                .select('id, status')
                .eq('id', (appointment as any).command_id || '') // Assume que pode haver um command_id no objeto
                .maybeSingle();

            // Se não houver comanda direta, precisamos lidar com o cenário de agendamento simples
            // No BelaApp, o fluxo de agendamento concluído costuma gerar uma comanda.
            // Para esta correção, focaremos na gravação direta do pagamento.

            // 2. VERIFICAR DUPLICIDADE EM command_payments (Se aplicável)
            if (command?.id) {
                const { data: existing } = await supabase
                    .from('command_payments')
                    .select('id')
                    .eq('command_id', command.id)
                    .eq('status', 'paid')
                    .maybeSingle();
                
                if (existing) {
                    setToast({ message: "Este atendimento já possui pagamento registrado!", type: 'error' });
                    setIsLoading(false);
                    return;
                }
            }

            // 3. CÁLCULO DE TAXAS
            const feeRate = installments > 1 
                ? Number(currentMethod.installment_rates[installments.toString()] || 0)
                : Number(currentMethod.rate_cash || 0);
            
            const feeAmount = (appointment.price * feeRate) / 100;
            const netValue = appointment.price - feeAmount;

            // 4. GRAVAÇÃO DIRETA EM command_payments
            // Nota: Se não houver command_id (fluxo simplificado), o campo será null ou lidaremos com a falta.
            const { error: paymentError } = await supabase
                .from('command_payments')
                .insert({
                    command_id: (appointment as any).command_id || null,
                    studio_id: activeStudioId,
                    amount: appointment.price,
                    net_value: netValue,
                    fee_amount: feeAmount,
                    fee_applied: feeRate,
                    method_id: currentMethod.id,
                    brand: currentMethod.brand || null,
                    installments: installments || 1,
                    status: 'paid'
                });

            if (paymentError) throw paymentError;

            // 5. ATUALIZAR STATUS DA COMANDA (SE EXISTIR)
            if (command?.id) {
                await supabase
                    .from('commands')
                    .update({ 
                        status: 'paid',
                        closed_at: new Date().toISOString()
                    })
                    .eq('id', command.id);
            }

            // 6. ATUALIZAR STATUS DO AGENDAMENTO
            const { error: apptError } = await supabase
                .from('appointments')
                .update({ status: 'concluido' })
                .eq('id', appointment.id);
            
            if (apptError) throw apptError;

            setToast({ message: "Pagamento recebido e auditado!", type: 'success' });
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error("Erro no checkout direto:", error);
            setToast({ message: "Falha ao gravar pagamento: " + error.message, type: 'error' });
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
                                        onClick={() => setSelectedCategory(cat.id as any)}
                                        className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all ${selectedCategory === cat.id ? 'border-orange-500 bg-orange-50' : 'bg-white border-slate-100'}`}
                                    >
                                        <div className={`p-2 rounded-xl mb-1 ${cat.bg} ${cat.color}`}><cat.icon size={20} /></div>
                                        <span className="text-[9px] font-black uppercase">{cat.label}</span>
                                    </button>
                                ))}
                            </div>

                            {filteredMethods.length > 0 && (
                                <div className="space-y-4 animate-in slide-in-from-top-2">
                                    <select 
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
                    <button onClick={onClose} className="flex-1 py-4 text-slate-500 font-black uppercase text-xs">Cancelar</button>
                    <button
                        onClick={handleConfirmPayment}
                        disabled={isLoading || isFetching || !currentMethod}
                        className="flex-[2] bg-slate-800 text-white py-4 rounded-2xl font-black shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                    >
                        {isLoading ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle size={20} />}
                        Confirmar Venda
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default CheckoutModal;
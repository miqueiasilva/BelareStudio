
import React, { useState, useEffect, useMemo } from 'react';
import { 
    X, CheckCircle, Wallet, CreditCard, Banknote, 
    Smartphone, Loader2, ShoppingCart, ArrowRight,
    ChevronDown, Info, Percent, Layers, AlertTriangle,
    User, Receipt, UserCheck, UserPlus
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
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
    brand: string;
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
        // Regex básica para UUID v4
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

    const financialMetrics = useMemo(() => {
        if (!currentMethod) return { rate: 0, netValue: appointment.price };
        let rate = installments === 1 ? Number(currentMethod.rate_cash || 0) : Number(currentMethod.installment_rates[installments.toString()] || 0);
        const discount = (appointment.price * rate) / 100;
        return { rate, netValue: appointment.price - discount };
    }, [currentMethod, installments, appointment.price]);

    const handleConfirmPayment = async () => {
        if (!currentMethod) return;
        setIsLoading(true);

        try {
            const profId = isSafeUUID(selectedProfessionalId) ? selectedProfessionalId : null;
            const clientId = isSafeUUID(appointment.client_id) ? String(appointment.client_id) : null;

            const payload = {
                amount: appointment.price, 
                net_value: financialMetrics.netValue, 
                tax_rate: financialMetrics.rate, 
                description: `Venda: ${appointment.service_name} - ${appointment.client_name}`,
                type: 'income',
                category: 'servico',
                payment_method: selectedCategory,
                payment_method_id: currentMethod.id, 
                professional_id: profId,
                client_id: clientId,
                appointment_id: appointment.id,
                installments: installments,
                status: 'pago',
                date: new Date().toISOString()
            };

            const { error: finError } = await supabase.from('financial_transactions').insert([payload]);
            if (finError) throw finError;

            await supabase.from('appointments').update({ status: 'concluido' }).eq('id', appointment.id);

            setToast({ message: "Pagamento recebido!", type: 'success' });
            onSuccess();
            onClose();
        } catch (error: any) {
            setToast({ message: "Erro ao finalizar recebimento.", type: 'error' });
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
                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Recebimento</h2>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-200 rounded-full transition-all"><X size={24} /></button>
                </header>

                <main className="p-8 space-y-6">
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
                        <div className="space-y-4">
                            <select 
                                value={selectedMethodId}
                                onChange={(e) => setSelectedMethodId(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 font-bold text-slate-700 outline-none"
                            >
                                {filteredMethods.map(m => (
                                    <option key={m.id} value={m.id}>{m.name} {m.brand ? `(${m.brand})` : ''}</option>
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
                </main>

                <footer className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4">
                    <button onClick={onClose} className="flex-1 py-4 text-slate-500 font-black uppercase text-xs">Cancelar</button>
                    <button
                        onClick={handleConfirmPayment}
                        disabled={isLoading || !currentMethod}
                        className="flex-[2] bg-slate-800 text-white py-4 rounded-2xl font-black shadow-xl flex items-center justify-center gap-2"
                    >
                        {isLoading ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle size={20} />}
                        Finalizar Venda
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default CheckoutModal;

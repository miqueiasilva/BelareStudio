
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

    const isUUID = (id: any): boolean => {
        if (!id) return false;
        const sid = String(id).trim();
        return typeof id === 'string' && sid.length > 20;
    };

    const resetLocalState = () => {
        setSelectedProfessionalId('');
        setSelectedCategory('pix');
        setSelectedMethodId('');
        setInstallments(1);
        setIsLoading(false);
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
                if (firstPix) {
                    setSelectedCategory('pix');
                    setSelectedMethodId(firstPix.id);
                } else {
                    setSelectedCategory(methodsRes.data[0].type);
                    setSelectedMethodId(methodsRes.data[0].id);
                }
            }
        } catch (err: any) {
            console.error("[CHECKOUT] Erro na carga de taxas:", err);
            setToast({ message: "Erro ao sincronizar taxas.", type: 'error' });
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
            if (selectedProfessionalId && isUUID(selectedProfessionalId)) return;
            let targetId = '';
            if (isUUID(appointment.professional_id)) targetId = String(appointment.professional_id);
            else if (appointment.professional_name) {
                const nameRef = appointment.professional_name.trim().toLowerCase();
                const found = dbProfessionals.find(p => p.name.trim().toLowerCase() === nameRef);
                if (found && isUUID(found.id)) targetId = found.id;
            }
            if (targetId) setSelectedProfessionalId(targetId);
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
        let rate = (installments === 1) ? Number(currentMethod.rate_cash || 0) : Number(currentMethod.installment_rates?.[installments.toString()] || 0);
        const discount = (appointment.price * rate) / 100;
        return { rate, netValue: appointment.price - discount };
    }, [currentMethod, installments, appointment.price]);

    const handleConfirmPayment = async () => {
        if (!currentMethod) return;

        setIsLoading(true);

        try {
            // ATUALIZAÇÃO: Uso da RPC register_payment_transaction
            const methodMapping: Record<string, string> = {
                'pix': 'pix',
                'money': 'cash',
                'credit': 'credit',
                'debit': 'debit'
            };

            const { error: rpcError } = await supabase.rpc('register_payment_transaction', {
                p_studio_id: currentMethod.id ? null : null, // A RPC gerencia via auth ou enviaremos direto se necessário.
                // Na nossa estrutura, enviamos studio_id se for requerido pela assinatura da função
                p_professional_id: isUUID(selectedProfessionalId) ? selectedProfessionalId : null,
                p_amount: appointment.price,
                p_method: methodMapping[selectedCategory] || 'pix',
                p_brand: currentMethod?.brand?.toLowerCase() || 'default',
                p_installments: Math.floor(installments),
                p_description: `Recebimento: ${appointment.service_name} - ${appointment.client_name}`,
                p_command_id: null,
                p_client_id: isUUID(appointment.client_id) ? appointment.client_id : null
            });

            if (rpcError) throw rpcError;

            await supabase.from('appointments').update({ status: 'concluido' }).eq('id', appointment.id);

            setToast({ message: "Pagamento confirmado!", type: 'success' });
            
            setTimeout(() => {
                onSuccess(); 
                onClose(); 
            }, 1000);

        } catch (error: any) {
            console.error("[CHECKOUT] Erro:", error);
            setToast({ message: `Erro: ${error.message}`, type: 'error' });
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
            
            <div className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <header className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl"><CheckCircle size={24} /></div>
                        <div>
                            <h2 className="text-xl font-black text-slate-800 tracking-tighter uppercase leading-none">Checkout Zelda</h2>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-200 rounded-full transition-all"><X size={24} /></button>
                </header>

                <main className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    <div className="bg-slate-900 rounded-[32px] p-6 text-white shadow-xl relative overflow-hidden">
                        <div className="relative z-10 space-y-4 text-left">
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">{appointment.service_name}</p>
                            <p className="text-sm font-bold text-slate-300">{appointment.client_name}</p>
                            <div className="mt-4 pt-4 border-t border-white/5">
                                <p className="text-3xl font-black text-emerald-400 tracking-tighter">{formatCurrency(appointment.price)}</p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-1.5 text-left">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 flex items-center gap-1.5">
                            <UserCheck size={12} className="text-orange-500" />
                            Profissional do Recebimento
                        </label>
                        <select 
                            value={selectedProfessionalId}
                            onChange={(e) => setSelectedProfessionalId(e.target.value)}
                            className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-orange-100 font-bold text-slate-700"
                        >
                            <option value="">Selecionar Profissional...</option>
                            {dbProfessionals.map(prof => (
                                <option key={prof.id} value={prof.id}>{prof.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-3 text-left">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Forma de Pagamento</label>
                        <div className="grid grid-cols-4 gap-2">
                            {categories.map((cat) => (
                                <button
                                    key={cat.id}
                                    onClick={() => setSelectedCategory(cat.id as any)}
                                    className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all ${selectedCategory === cat.id ? 'border-orange-500 bg-orange-50/50 shadow-md ring-4 ring-orange-50' : 'border-slate-50 bg-white hover:border-slate-200'}`}
                                >
                                    <div className={`p-2 rounded-xl mb-1 ${cat.bg} ${cat.color}`}><cat.icon size={20} /></div>
                                    <span className="text-[9px] font-black text-slate-700 uppercase tracking-tighter">{cat.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {isFetching ? (
                        <div className="py-4 flex justify-center"><Loader2 className="animate-spin text-orange-500" /></div>
                    ) : filteredMethods.length > 0 ? (
                        <div className="space-y-4 text-left">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Operadora Selecionada</label>
                                <select 
                                    value={selectedMethodId}
                                    onChange={(e) => setSelectedMethodId(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 font-bold text-slate-700"
                                >
                                    {filteredMethods.map(m => (
                                        <option key={m.id} value={m.id}>{m.name} {m.brand ? `(${m.brand})` : ''}</option>
                                    ))}
                                </select>
                            </div>

                            {currentMethod?.type === 'credit' && (
                                <div className="space-y-1.5 animate-in slide-in-from-top-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Plano de Parcelas</label>
                                    <select 
                                        value={installments}
                                        onChange={(e) => setInstallments(parseInt(e.target.value))}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 font-bold text-slate-700"
                                    >
                                        <option value={1}>À vista (1x)</option>
                                        {Array.from({ length: (currentMethod.max_installments || 1) - 1 }, (_, i) => i + 2).map(n => (
                                            <option key={n} value={n}>{n} Vezes</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                    ) : null}

                    {currentMethod && (
                        <div className="p-5 bg-slate-50 border-2 border-slate-100 rounded-[28px] space-y-3 shadow-inner text-left">
                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                                <span>Taxa Calculada ({installments}x)</span>
                                <span className="text-rose-600">{financialMetrics.rate}%</span>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-slate-200/50">
                                <span className="text-xs font-bold text-slate-500">Líquido Estimado</span>
                                <span className="text-lg font-black text-emerald-600">{formatCurrency(financialMetrics.netValue)}</span>
                            </div>
                        </div>
                    )}
                </main>

                <footer className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4">
                    <button onClick={onClose} className="flex-1 py-4 text-slate-500 font-black uppercase tracking-widest text-xs hover:bg-slate-200 rounded-2xl">Cancelar</button>
                    <button
                        onClick={handleConfirmPayment}
                        disabled={isLoading || !currentMethod}
                        className="flex-[2] bg-slate-800 hover:bg-slate-900 text-white py-4 rounded-2xl font-black shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                    >
                        {isLoading ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle size={20} />}
                        Confirmar Recebimento
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default CheckoutModal;

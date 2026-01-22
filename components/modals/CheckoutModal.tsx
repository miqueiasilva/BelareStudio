
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
        id: number | string;
        client_id?: number | string;
        client_name: string;
        service_name: string;
        price: number;
        professional_id?: number | string; 
        professional_name: string;
        studio_id?: string;
    };
    onSuccess: () => void;
}

const CheckoutModal: React.FC<CheckoutModalProps> = ({ isOpen, onClose, appointment, onSuccess }) => {
    const { activeStudioId } = useStudio();
    const isMounted = useRef(true);
    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    const [dbProfessionals, setDbProfessionals] = useState<any[]>([]);
    const [dbPaymentMethods, setDbPaymentMethods] = useState<DBPaymentMethod[]>([]);
    const [selectedProfessionalId, setSelectedProfessionalId] = useState<string>('');
    const [selectedCategory, setSelectedCategory] = useState<'pix' | 'money' | 'credit' | 'debit'>('pix');
    const [selectedMethodId, setSelectedMethodId] = useState<string>('');
    const [installments, setInstallments] = useState(1);

    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);

    const resetLocalState = () => {
        setSelectedProfessionalId('');
        setSelectedCategory('pix');
        setSelectedMethodId('');
        setInstallments(1);
        setIsLoading(false);
    };

    const loadSystemData = async () => {
        if (!activeStudioId) return;
        setIsFetching(true);
        try {
            const [profsRes, methodsRes] = await Promise.all([
                supabase
                    .from('professionals')
                    .select('uuid_id, name, studio_id')
                    .eq('studio_id', activeStudioId)
                    .order('name'),
                supabase.from('payment_methods_config').select('*').eq('is_active', true)
            ]);

            if (profsRes.error) throw profsRes.error;
            if (methodsRes.error) throw methodsRes.error;

            if (isMounted.current) {
                setDbProfessionals(profsRes.data || []);
                setDbPaymentMethods(methodsRes.data || []);
                if (methodsRes.data && methodsRes.data.length > 0) {
                    const firstPix = methodsRes.data.find((m: any) => m.type === 'pix');
                    if (firstPix) { setSelectedCategory('pix'); setSelectedMethodId(firstPix.id); }
                    else { setSelectedCategory(methodsRes.data[0].type); setSelectedMethodId(methodsRes.data[0].id); }
                }
            }
        } catch (err: any) {
            console.error("Erro ao carregar dados do checkout:", err);
            if (isMounted.current) setToast({ message: "Erro ao sincronizar dados.", type: 'error' });
        } finally {
            if (isMounted.current) setIsFetching(false);
        }
    };

    useEffect(() => {
        if (isOpen) loadSystemData();
        else resetLocalState();
    }, [isOpen, activeStudioId]);

    const filteredMethods = useMemo(() => dbPaymentMethods.filter(m => m.type === selectedCategory), [dbPaymentMethods, selectedCategory]);

    useEffect(() => {
        if (filteredMethods.length > 0) { setSelectedMethodId(filteredMethods[0].id); setInstallments(1); }
        else setSelectedMethodId('');
    }, [selectedCategory, filteredMethods]);

    const currentMethod = useMemo(() => dbPaymentMethods.find(m => m.id === selectedMethodId), [dbPaymentMethods, selectedMethodId]);

    const handleConfirmPayment = async (e?: React.MouseEvent) => {
        if (e) { e.preventDefault(); e.stopPropagation(); }

        if (!currentMethod || !activeStudioId || isLoading) return;

        // TRAVA DE SEGURANÇA: Validar se professional_id pertence ao estúdio atual
        // Isso previne o Erro 400 se o agendamento estiver com dados obsoletos
        const targetProfId = appointment.professional_id ? String(appointment.professional_id) : null;
        if (targetProfId) {
            const isProfValid = dbProfessionals.some(p => String(p.uuid_id) === targetProfId);
            if (!isProfValid) {
                setToast({ message: "Sincronização necessária: Este profissional não pertence a esta unidade. Por favor, recarregue a página.", type: 'error' });
                return;
            }
        }

        setIsLoading(true);

        try {
            const methodMapping: Record<string, string> = { 'pix': 'pix', 'money': 'cash', 'credit': 'credit', 'debit': 'debit' };

            const payload = {
                p_studio_id: String(activeStudioId),
                p_professional_id: targetProfId,
                p_amount: Number(appointment.price),
                p_method: methodMapping[selectedCategory] || 'pix',
                p_brand: String(currentMethod.brand || 'default'),
                p_installments: Number(installments),
                p_command_id: null,
                p_client_id: appointment.client_id ? Number(appointment.client_id) : null,
                p_description: `Atendimento: ${appointment.service_name}`
            };

            const { error: rpcError } = await supabase.rpc('register_payment_transaction_v2', payload);

            if (rpcError) {
                console.error("Erro na liquidação:", rpcError);
                throw rpcError;
            }

            await supabase.from('appointments').update({ status: 'concluido' }).eq('id', appointment.id);
            
            if (isMounted.current) {
                setToast({ message: "Recebimento confirmado!", type: 'success' });
                setTimeout(() => { if (isMounted.current) { onSuccess(); onClose(); } }, 1000);
            }
        } catch (error: any) {
            if (isMounted.current) {
                setToast({ message: `Falha na Liquidação: ${error.message}`, type: 'error' });
                setIsLoading(false);
            }
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
                        <h2 className="text-xl font-black text-slate-800 tracking-tighter uppercase leading-none">Finalizar Atendimento</h2>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-200 rounded-full transition-all"><X size={24} /></button>
                </header>

                <main className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    <div className="bg-slate-900 rounded-[32px] p-6 text-white shadow-xl relative overflow-hidden">
                        <div className="relative z-10 space-y-4 text-left">
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">{appointment.service_name}</p>
                            <p className="text-sm font-bold text-slate-300">{appointment.client_name}</p>
                            <div className="mt-4 pt-4 border-t border-white/5"><p className="text-3xl font-black text-emerald-400 tracking-tighter">{formatCurrency(appointment.price)}</p></div>
                        </div>
                    </div>

                    <div className="space-y-3 text-left">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Forma de Pagamento</label>
                        <div className="grid grid-cols-4 gap-2">
                            {categories.map((cat) => (
                                <button key={cat.id} onClick={() => setSelectedCategory(cat.id as any)} className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all ${selectedCategory === cat.id ? 'border-orange-500 bg-orange-50/50 shadow-md ring-4 ring-orange-50' : 'border-slate-50 bg-white hover:border-slate-200'}`}><div className={`p-2 rounded-xl mb-1 ${cat.bg} ${cat.color}`}><cat.icon size={20} /></div><span className="text-[9px] font-black text-slate-700 uppercase tracking-tighter">{cat.label}</span></button>
                            ))}
                        </div>
                    </div>

                    {isFetching ? (<div className="py-4 flex justify-center"><Loader2 className="animate-spin text-orange-500" /></div>) : filteredMethods.length > 0 ? (
                        <div className="space-y-4 text-left">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Operadora Selecionada</label>
                                <select value={selectedMethodId} onChange={(e) => setSelectedMethodId(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 font-bold text-slate-700">
                                    {filteredMethods.map(m => (<option key={m.id} value={m.id}>{m.name} {m.brand ? `(${m.brand})` : ''}</option>))}
                                </select>
                            </div>
                            {selectedCategory === 'credit' && (
                                <div className="space-y-1.5 animate-in slide-in-from-top-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Plano de Parcelas</label>
                                    <select value={installments} onChange={(e) => setInstallments(parseInt(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 font-bold text-slate-700">
                                        <option value={1}>À vista (1x)</option>
                                        {Array.from({ length: (currentMethod?.max_installments || 1) - 1 }, (_, i) => i + 2).map(n => (<option key={n} value={n}>{n} Vezes</option>))}
                                    </select>
                                </div>
                            )}
                        </div>
                    ) : null}
                </main>

                <footer className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4">
                    <button onClick={onClose} className="flex-1 py-4 text-slate-500 font-black uppercase tracking-widest text-xs hover:bg-slate-200 rounded-2xl">Cancelar</button>
                    <button onClick={(e) => handleConfirmPayment(e)} disabled={isLoading || !currentMethod} className="flex-[2] bg-slate-800 hover:bg-slate-900 text-white font-black shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50">{isLoading ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle size={20} />} Confirmar Recebimento</button>
                </footer>
            </div>
        </div>
    );
};

export default CheckoutModal;

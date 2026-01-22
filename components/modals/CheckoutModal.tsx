
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, CheckCircle, Smartphone, CreditCard, Banknote, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { useStudio } from '../../contexts/StudioContext';
import Toast, { ToastType } from '../shared/Toast';

interface CheckoutModalProps {
    isOpen: boolean;
    onClose: () => void;
    appointment: {
        id: number | string;
        client_id?: number | string;
        client_name: string;
        service_name: string;
        price: number;
        professional_id?: string; 
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
    const [selectedCategory, setSelectedCategory] = useState<'pix' | 'money' | 'credit' | 'debit'>('pix');

    useEffect(() => {
        if (isOpen) {
            const loadValidationData = async () => {
                setIsFetching(true);
                try {
                    // Busca lista canônica de profissionais para validar ID
                    const { data } = await supabase
                        .from('professionals')
                        .select('uuid_id, name')
                        .eq('studio_id', activeStudioId);
                    setDbProfessionals(data || []);
                } catch (e) {
                    console.error("Erro ao validar profissionais:", e);
                } finally {
                    setIsFetching(false);
                }
            };
            loadValidationData();
        }
    }, [isOpen, activeStudioId]);

    const handleConfirmPayment = async () => {
        if (isLoading || !activeStudioId) return;

        // VALIDAÇÃO CANÔNICA DE PROFESSIONAL_ID
        const targetProfId = appointment.professional_id;
        const isValidProf = dbProfessionals.some(p => p.uuid_id === targetProfId);

        if (targetProfId && !isValidProf) {
            setToast({ 
                message: "Profissional inválido ou de outra unidade. Por favor, reatribua o atendimento.", 
                type: 'error' 
            });
            return;
        }

        setIsLoading(true);
        try {
            const methodMap = { 'pix': 'pix', 'money': 'cash', 'credit': 'credit', 'debit': 'debit' };
            
            // CHAMADA ÚNICA RPC OFICIAL
            const { data, error } = await supabase.rpc('register_payment_transaction_v2', {
                p_studio_id: activeStudioId,
                p_professional_id: targetProfId || null,
                p_amount: Number(appointment.price),
                p_method: methodMap[selectedCategory],
                p_brand: 'DIRETO',
                p_installments: 1,
                p_command_id: null,
                p_client_id: appointment.client_id ? Number(appointment.client_id) : null,
                p_description: `Checkout Direto: ${appointment.service_name}`
            });

            if (error) throw error;

            setToast({ message: "Pagamento processado com sucesso!", type: 'success' });
            setTimeout(() => {
                onSuccess();
                onClose();
            }, 1000);
        } catch (e: any) {
            setToast({ message: `Falha no Checkout: ${e.message}`, type: 'error' });
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden">
                <header className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h2 className="font-black text-slate-800 uppercase text-sm tracking-widest">Finalizar Atendimento</h2>
                    <button onClick={onClose}><X size={20} className="text-slate-400" /></button>
                </header>
                <div className="p-8 space-y-6">
                    <div className="bg-slate-900 p-6 rounded-2xl text-white">
                        <p className="text-[10px] font-black text-slate-400 uppercase">{appointment.service_name}</p>
                        <p className="text-3xl font-black mt-1">R$ {appointment.price.toFixed(2)}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        {(['pix', 'money', 'credit', 'debit'] as const).map(cat => (
                            <button 
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${selectedCategory === cat ? 'border-orange-500 bg-orange-50 text-orange-600' : 'border-slate-100 text-slate-400'}`}
                            >
                                {cat === 'pix' && <Smartphone size={20}/>}
                                {cat === 'money' && <Banknote size={20}/>}
                                {(cat === 'credit' || cat === 'debit') && <CreditCard size={20}/>}
                                <span className="text-[10px] font-black uppercase">{cat === 'money' ? 'Dinheiro' : cat}</span>
                            </button>
                        ))}
                    </div>
                    <button 
                        onClick={handleConfirmPayment}
                        disabled={isLoading || isFetching}
                        className="w-full bg-slate-800 hover:bg-slate-900 text-white font-black py-4 rounded-2xl shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                    >
                        {isLoading ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle size={20} />}
                        Confirmar Recebimento
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CheckoutModal;


import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    X, CheckCircle, Wallet, CreditCard, Banknote, 
    Smartphone, Loader2, ShoppingCart, ArrowRight
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { useStudio } from '../../contexts/StudioContext';
import Toast, { ToastType } from '../shared/Toast';

const CheckoutModal: React.FC<any> = ({ isOpen, onClose, appointment, onSuccess }) => {
    const { activeStudioId } = useStudio();
    const [isLoading, setIsLoading] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const isProcessingRef = useRef(false);

    const [dbPaymentMethods, setDbPaymentMethods] = useState<any[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string>('pix');
    const [selectedMethodId, setSelectedMethodId] = useState<string>('');

    useEffect(() => {
        if (isOpen) {
            isProcessingRef.current = false;
            supabase.from('payment_methods_config').select('*').eq('is_active', true).then(({ data }) => {
                if (data) {
                    setDbPaymentMethods(data);
                    const first = data.find(m => m.type === 'pix');
                    if (first) setSelectedMethodId(first.id);
                }
            });
        }
    }, [isOpen]);

    const handleConfirmPayment = async () => {
        if (isProcessingRef.current || isLoading || !activeStudioId) return;
        
        isProcessingRef.current = true;
        setIsLoading(true);

        try {
            const currentMethod = dbPaymentMethods.find(m => m.id === selectedMethodId);
            if (!currentMethod) throw new Error("Método de pagamento não selecionado");

            // Chamada RPC Atômica
            const { data, error: rpcError } = await supabase.rpc('register_payment_transaction', {
                p_studio_id: activeStudioId,
                p_professional_id: appointment.professional_id,
                p_client_id: Number(appointment.client_id),
                p_command_id: appointment.command_id,
                p_amount: Number(appointment.price),
                p_method: currentMethod.type === 'money' ? 'dinheiro' : currentMethod.type,
                p_brand: currentMethod.brand || "N/A",
                p_installments: 1
            });

            if (rpcError) throw rpcError;

            // Sincroniza status do agendamento apenas após sucesso da RPC financeira
            await supabase.from('appointments').update({ status: 'concluido' }).eq('id', appointment.id);

            setToast({ message: "Recebimento confirmado! ✅", type: 'success' });
            setTimeout(() => {
                onSuccess();
                onClose();
            }, 1000);

        } catch (error: any) {
            setToast({ message: `Erro no checkout: ${error.message}`, type: 'error' });
            isProcessingRef.current = false;
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <div className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden text-left">
                <header className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="text-xl font-black text-slate-800 uppercase">Checkout Direto</h2>
                    <button onClick={onClose} className="p-2 text-slate-400"><X size={24} /></button>
                </header>
                <main className="p-8 space-y-6">
                    <div className="bg-slate-900 rounded-[32px] p-6 text-white text-center">
                        <p className="text-[10px] font-black uppercase text-slate-400 mb-1">{appointment.service_name}</p>
                        <h3 className="text-3xl font-black text-emerald-400">R$ {Number(appointment.price).toFixed(2)}</h3>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                        {['pix', 'dinheiro', 'credit', 'debit'].map(cat => (
                            <button key={cat} onClick={() => setSelectedCategory(cat)} className={`p-4 rounded-2xl border-2 font-black text-[9px] uppercase ${selectedCategory === cat ? 'border-orange-500 bg-orange-50' : 'border-slate-100'}`}>{cat}</button>
                        ))}
                    </div>
                    <select value={selectedMethodId} onChange={e => setSelectedMethodId(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold">
                        {dbPaymentMethods.filter(m => m.type === (selectedCategory === 'dinheiro' ? 'money' : selectedCategory)).map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                    </select>
                </main>
                <footer className="p-8 bg-slate-50 border-t flex gap-4">
                    <button onClick={handleConfirmPayment} disabled={isLoading} className="flex-1 bg-slate-800 text-white py-4 rounded-2xl font-black shadow-xl flex items-center justify-center gap-2">
                        {isLoading ? <Loader2 className="animate-spin" /> : <CheckCircle size={20} />}
                        {isLoading ? 'CONFIRMANDO...' : 'Liquidar Agora'}
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default CheckoutModal;

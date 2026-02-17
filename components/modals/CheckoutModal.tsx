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
    
    // Trava para evitar múltiplos cliques
    const isProcessingRef = useRef(false);

    const [dbPaymentMethods, setDbPaymentMethods] = useState<any[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string>('pix');
    const [selectedMethodId, setSelectedMethodId] = useState<string>('');

    useEffect(() => {
        if (isOpen) {
            isProcessingRef.current = false;
            setIsLoading(true);
            supabase.from('payment_methods_config')
                .select('*')
                .eq('is_active', true)
                .then(({ data }) => {
                    if (data) {
                        setDbPaymentMethods(data);
                        const first = data.find(m => m.type === 'pix');
                        if (first) setSelectedMethodId(first.id);
                        else if (data.length > 0) setSelectedMethodId(data[0].id);
                    }
                    setIsLoading(false);
                });
        }
    }, [isOpen]);

    const handleConfirmPayment = async () => {
        if (isProcessingRef.current || isLoading || !activeStudioId) return;
        
        isProcessingRef.current = true;
        setIsLoading(true);

        try {
            const currentMethod = dbPaymentMethods.find(m => m.id === selectedMethodId);
            if (!currentMethod) throw new Error("Por favor, selecione um método de pagamento.");

            // Chamada RPC Atômica (Agora idempotente no Banco)
            const { data: rpcResponse, error: rpcError } = await supabase.rpc('register_payment_transaction', {
                p_studio_id: activeStudioId,
                p_professional_id: appointment.professional_id,
                p_client_id: appointment.client_id ? Number(appointment.client_id) : null,
                p_command_id: appointment.command_id,
                p_amount: Number(appointment.price),
                p_method: currentMethod.type === 'money' ? 'dinheiro' : currentMethod.type,
                p_brand: currentMethod.brand || "N/A",
                p_installments: 1
            });

            if (rpcError) {
                // Se for erro de conflito, verificamos se a comanda já foi paga
                if (rpcError.status === 409 || rpcError.code === '23505') {
                    const { data: check } = await supabase.from('commands').select('status').eq('id', appointment.command_id).single();
                    if (check?.status === 'paid') {
                         await supabase.from('appointments').update({ status: 'concluido' }).eq('id', appointment.id);
                         setToast({ message: "Venda já liquidada no sistema! ✅", type: 'success' });
                         setTimeout(() => { onSuccess(); onClose(); }, 1000);
                         return;
                    }
                }
                throw rpcError;
            }

            // Sincroniza status do agendamento apenas após sucesso da RPC financeira
            const { error: apptError } = await supabase.from('appointments').update({ status: 'concluido' }).eq('id', appointment.id);
            if (apptError) throw apptError;

            setToast({ message: "Recebimento confirmado! ✅", type: 'success' });
            setTimeout(() => {
                onSuccess();
                onClose();
            }, 1000);

        } catch (error: any) {
            console.error("[CHECKOUT_MODAL_ERROR]", error);
            setToast({ message: `Erro: ${error.message || 'Falha na liquidação'}`, type: 'error' });
            isProcessingRef.current = false;
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-300">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <div className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden text-left animate-in zoom-in-95">
                <header className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Checkout Direto</h2>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-200 rounded-full transition-all"><X size={24} /></button>
                </header>
                <main className="p-8 space-y-6">
                    <div className="bg-slate-900 rounded-[32px] p-6 text-white text-center shadow-xl">
                        <p className="text-[10px] font-black uppercase text-slate-400 mb-1 tracking-widest">{appointment.service_name}</p>
                        <h3 className="text-3xl font-black text-emerald-400 tracking-tighter">R$ {Number(appointment.price).toFixed(2)}</h3>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-2">
                        {['pix', 'dinheiro', 'credit', 'debit'].map(cat => (
                            <button 
                                key={cat} 
                                onClick={() => setSelectedCategory(cat)} 
                                className={`p-4 rounded-2xl border-2 font-black text-[9px] uppercase transition-all ${selectedCategory === cat ? 'border-orange-500 bg-orange-50 text-orange-600 shadow-md' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}
                            >
                                {cat === 'pix' && <Smartphone size={16} className="mx-auto mb-1"/>}
                                {cat === 'dinheiro' && <Banknote size={16} className="mx-auto mb-1"/>}
                                {cat === 'credit' && <CreditCard size={16} className="mx-auto mb-1"/>}
                                {cat === 'debit' && <CreditCard size={16} className="mx-auto mb-1"/>}
                                {cat}
                            </button>
                        ))}
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Opções de Maquininha/Banco</label>
                        <select 
                            value={selectedMethodId} 
                            onChange={e => setSelectedMethodId(e.target.value)} 
                            className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:border-orange-400 transition-all"
                        >
                            {dbPaymentMethods
                                .filter(m => m.type === (selectedCategory === 'dinheiro' ? 'money' : selectedCategory))
                                .map(m => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))
                            }
                            {dbPaymentMethods.filter(m => m.type === (selectedCategory === 'dinheiro' ? 'money' : selectedCategory)).length === 0 && (
                                <option value="">Nenhuma configuração ativa</option>
                            )}
                        </select>
                    </div>
                </main>
                <footer className="p-8 bg-slate-50 border-t flex gap-4">
                    <button 
                        onClick={handleConfirmPayment} 
                        disabled={isLoading || !selectedMethodId} 
                        className="flex-1 bg-slate-800 text-white py-5 rounded-[24px] font-black shadow-xl flex items-center justify-center gap-3 hover:bg-slate-900 transition-all active:scale-95 disabled:opacity-50"
                    >
                        {isLoading ? <Loader2 className="animate-spin" size={24} /> : <CheckCircle size={24} />}
                        {isLoading ? 'PROCESSANDO...' : 'CONFIRMAR RECEBIMENTO'}
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default CheckoutModal;
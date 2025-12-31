
import React, { useState } from 'react';
import { 
    X, CheckCircle, Wallet, CreditCard, Banknote, 
    Smartphone, Loader2, ShoppingCart, ArrowRight 
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { PaymentMethod } from '../../types';
import Toast, { ToastType } from '../shared/Toast';

interface CheckoutModalProps {
    isOpen: boolean;
    onClose: () => void;
    appointment: {
        id: number;
        client_id?: number;
        client_name: string;
        service_name: string;
        price: number;
    };
    onSuccess: () => void;
}

const CheckoutModal: React.FC<CheckoutModalProps> = ({ isOpen, onClose, appointment, onSuccess }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('pix');
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    if (!isOpen) return null;

    const paymentOptions = [
        { id: 'pix', label: 'Pix', icon: Smartphone, color: 'text-teal-600', bg: 'bg-teal-50' },
        { id: 'dinheiro', label: 'Dinheiro', icon: Banknote, color: 'text-green-600', bg: 'bg-green-50' },
        { id: 'cartao_credito', label: 'Crédito', icon: CreditCard, color: 'text-blue-600', bg: 'bg-blue-50' },
        { id: 'cartao_debito', label: 'Débito', icon: CreditCard, color: 'text-cyan-600', bg: 'bg-cyan-50' },
    ];

    const handleFinalize = async () => {
        setIsLoading(true);
        try {
            // FIX: Removido campo 'date' para usar o default 'created_at' do banco
            // Payload limpo conforme o schema da tabela 'financial_transactions'
            const financialUpdate = {
                amount: appointment.price,
                description: `${appointment.service_name} - ${appointment.client_name}`,
                type: 'income',
                category: 'servico',
                payment_method: selectedMethod,
                appointment_id: appointment.id,
                client_id: appointment.client_id || null
            };

            // Transação Atômica: Atualiza Agendamento + Cria Lançamento Financeiro
            const [apptResult, finResult] = await Promise.all([
                supabase
                    .from('appointments')
                    .update({ status: 'concluido' })
                    .eq('id', appointment.id),
                supabase
                    .from('financial_transactions')
                    .insert([financialUpdate])
            ]);

            if (apptResult.error) throw apptResult.error;
            if (finResult.error) throw finResult.error;

            setToast({ message: "Venda Registrada com Sucesso! 💰", type: 'success' });
            
            setTimeout(() => {
                onSuccess();
                onClose();
            }, 1000);

        } catch (error: any) {
            console.error("Erro no Checkout:", error);
            setToast({ 
                message: `Erro ao processar: ${error.message || "Tente novamente."}`, 
                type: 'error' 
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-300">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            <div className="bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <header className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
                            <CheckCircle size={24} />
                        </div>
                        <h2 className="text-xl font-black text-slate-800 tracking-tighter uppercase">Finalizar Venda</h2>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-200 rounded-full transition-colors">
                        <X size={24} />
                    </button>
                </header>

                <main className="p-8 space-y-8">
                    {/* Resumo do Pedido */}
                    <div className="bg-slate-50 rounded-[32px] p-6 border border-slate-100">
                        <div className="space-y-1 mb-4">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Procedimento</p>
                            <h4 className="font-bold text-slate-700">{appointment.service_name}</h4>
                        </div>
                        <div className="space-y-1 mb-6">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente</p>
                            <h4 className="font-bold text-slate-700">{appointment.client_name}</h4>
                        </div>
                        <div className="pt-4 border-t border-slate-200 flex justify-between items-end">
                            <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Total a Receber</p>
                            <p className="text-3xl font-black text-emerald-600">
                                R$ {appointment.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                        </div>
                    </div>

                    {/* Seletor de Pagamento */}
                    <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Escolha a Forma de Pagamento</label>
                        <div className="grid grid-cols-2 gap-3">
                            {paymentOptions.map((method) => (
                                <button
                                    key={method.id}
                                    onClick={() => setSelectedMethod(method.id as PaymentMethod)}
                                    className={`
                                        flex flex-col items-center justify-center p-5 rounded-[24px] border-2 transition-all duration-300
                                        ${selectedMethod === method.id 
                                            ? 'border-orange-500 bg-orange-50/30 ring-4 ring-orange-50 shadow-lg' 
                                            : 'border-slate-100 bg-white hover:border-slate-200'
                                        }
                                    `}
                                >
                                    <div className={`p-3 rounded-2xl mb-2 ${method.bg} ${method.color}`}>
                                        <method.icon size={24} />
                                    </div>
                                    <span className="text-xs font-black text-slate-700 uppercase tracking-tighter">
                                        {method.label}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </main>

                <footer className="p-8 bg-slate-50 border-t border-slate-100">
                    <button
                        onClick={handleFinalize}
                        disabled={isLoading}
                        className="w-full bg-orange-500 hover:bg-orange-600 text-white py-5 rounded-[24px] font-black shadow-xl shadow-orange-100 flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-70"
                    >
                        {isLoading ? (
                            <Loader2 className="animate-spin" size={24} />
                        ) : (
                            <>
                                <ShoppingCart size={24} />
                                Confirmar Recebimento
                            </>
                        )}
                    </button>
                    <p className="text-[9px] text-slate-400 font-bold uppercase text-center mt-4 tracking-widest">
                        O agendamento será marcado como concluído e lançado no caixa.
                    </p>
                </footer>
            </div>
        </div>
    );
};

export default CheckoutModal;


import React, { useState, useEffect, useMemo } from 'react';
import { 
    X, CheckCircle, Wallet, CreditCard, Banknote, 
    Smartphone, Loader2, ShoppingCart, ArrowRight,
    ChevronDown, Info, Percent, Layers, AlertTriangle
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { PaymentMethod as PaymentMethodType } from '../../types';
import Toast, { ToastType } from '../shared/Toast';

// Interface interna para métodos de pagamento configurados
interface DBPaymentMethod {
    id: number;
    name: string;
    type: 'credit' | 'debit' | 'pix' | 'money';
    brand: string;
    rate_cash: number;
    allow_installments: boolean;
    max_installments: number;
    installment_rates: Record<string, number>;
    is_active: boolean;
}

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
    const [isFetching, setIsFetching] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    // Estados de Seleção
    const [allMethods, setAllMethods] = useState<DBPaymentMethod[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<'pix' | 'money' | 'credit' | 'debit'>('pix');
    const [selectedMethodId, setSelectedMethodId] = useState<string>('');
    const [installments, setInstallments] = useState(1);

    // 1. Busca configurações reais do banco
    useEffect(() => {
        const fetchConfig = async () => {
            setIsFetching(true);
            try {
                const { data, error } = await supabase
                    .from('payment_methods_config')
                    .select('*')
                    .eq('is_active', true);

                if (error) throw error;
                if (data) {
                    setAllMethods(data);
                    // Pré-seleciona o primeiro método disponível para a categoria inicial (pix)
                    const firstPix = data.find(m => m.type === 'pix');
                    if (firstPix) setSelectedMethodId(firstPix.id.toString());
                }
            } catch (err: any) {
                console.error("Erro ao carregar taxas:", err);
            } finally {
                setIsFetching(false);
            }
        };

        if (isOpen) fetchConfig();
    }, [isOpen]);

    // 2. Filtra métodos baseados na categoria selecionada
    const filteredMethods = useMemo(() => {
        return allMethods.filter(m => m.type === selectedCategory);
    }, [allMethods, selectedCategory]);

    // Reseta seleção ao trocar categoria
    useEffect(() => {
        if (filteredMethods.length > 0) {
            setSelectedMethodId(filteredMethods[0].id.toString());
            setInstallments(1);
        } else {
            setSelectedMethodId('');
        }
    }, [selectedCategory, filteredMethods]);

    // 3. Método selecionado atual
    const currentMethod = useMemo(() => {
        return allMethods.find(m => m.id.toString() === selectedMethodId);
    }, [allMethods, selectedMethodId]);

    // 4. Cálculos Financeiros (Taxas e Líquido)
    const financialMetrics = useMemo(() => {
        if (!currentMethod) return { rate: 0, netValue: appointment.price };

        let rate = 0;
        if (installments === 1) {
            rate = currentMethod.rate_cash || 0;
        } else {
            const rates = currentMethod.installment_rates || {};
            rate = rates[installments.toString()] || 0;
        }

        const discount = (appointment.price * rate) / 100;
        return {
            rate,
            netValue: appointment.price - discount,
            installmentValue: appointment.price / installments
        };
    }, [currentMethod, installments, appointment.price]);

    const handleFinalize = async () => {
        if (!currentMethod) {
            setToast({ message: "Selecione um método de pagamento.", type: 'error' });
            return;
        }

        setIsLoading(true);
        try {
            // Payload enriquecido com dados de auditoria financeira
            const financialUpdate = {
                amount: appointment.price, // Valor Bruto
                net_value: financialMetrics.netValue, // Valor Líquido (Real que entra)
                description: `${appointment.service_name} - ${appointment.client_name}`,
                type: 'income',
                category: 'servico',
                payment_method: selectedCategory, // Slug legado ('pix', 'cartao_credito'...)
                payment_method_id: currentMethod.id, // ID real da configuração
                installments: installments,
                appointment_id: appointment.id,
                client_id: appointment.client_id || null
            };

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

            setToast({ message: "Venda Finalizada! Saldo atualizado.", type: 'success' });
            
            setTimeout(() => {
                onSuccess();
                onClose();
            }, 1000);

        } catch (error: any) {
            setToast({ message: `Erro: ${error.message}`, type: 'error' });
        } finally {
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
                {/* Header com Botão Fechar */}
                <header className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
                            <CheckCircle size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-800 tracking-tighter uppercase leading-none">Recebimento</h2>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Conclusão de atendimento</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-200 rounded-full transition-all hover:rotate-90">
                        <X size={24} />
                    </button>
                </header>

                <main className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    {/* Resumo Financeiro */}
                    <div className="bg-slate-900 rounded-[32px] p-6 text-white shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-5">
                            <ShoppingCart size={120} />
                        </div>
                        <div className="relative z-10 flex justify-between items-end">
                            <div>
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">{appointment.service_name}</p>
                                <p className="text-sm font-bold text-slate-300">{appointment.client_name}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Total</p>
                                <p className="text-3xl font-black text-emerald-400 tracking-tighter">
                                    R$ {appointment.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* 1. Seletor de Categoria */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">1. Forma de Pagamento</label>
                        <div className="grid grid-cols-4 gap-2">
                            {categories.map((cat) => (
                                <button
                                    key={cat.id}
                                    onClick={() => setSelectedCategory(cat.id as any)}
                                    className={`
                                        flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all duration-200
                                        ${selectedCategory === cat.id 
                                            ? 'border-orange-500 bg-orange-50/50 shadow-md ring-4 ring-orange-50' 
                                            : 'border-slate-50 bg-white hover:border-slate-200'
                                        }
                                    `}
                                >
                                    <div className={`p-2 rounded-xl mb-1 ${cat.bg} ${cat.color}`}>
                                        <cat.icon size={20} />
                                    </div>
                                    <span className="text-[9px] font-black text-slate-700 uppercase tracking-tighter">
                                        {cat.label}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 2. Seletor de Adquirente/Bandeira (Condicional) */}
                    {isFetching ? (
                        <div className="py-4 flex justify-center"><Loader2 className="animate-spin text-orange-500" /></div>
                    ) : filteredMethods.length > 0 ? (
                        <div className="space-y-4 animate-in slide-in-from-top-2">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">2. Operadora / Bandeira</label>
                                <div className="relative">
                                    <select 
                                        value={selectedMethodId}
                                        onChange={(e) => setSelectedMethodId(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 font-bold text-slate-700 outline-none appearance-none focus:ring-4 focus:ring-orange-50"
                                    >
                                        {filteredMethods.map(m => (
                                            <option key={m.id} value={m.id}>{m.name} {m.brand ? `(${m.brand})` : ''}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={18} />
                                </div>
                            </div>

                            {/* 3. Parcelamento (Apenas se permitido) */}
                            {currentMethod?.type === 'credit' && currentMethod.allow_installments && (
                                <div className="space-y-1.5 animate-in fade-in">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">3. Parcelamento</label>
                                    <div className="relative">
                                        <select 
                                            value={installments}
                                            onChange={(e) => setInstallments(parseInt(e.target.value))}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 font-bold text-slate-700 outline-none appearance-none focus:ring-4 focus:ring-orange-50"
                                        >
                                            <option value={1}>À vista (1x)</option>
                                            {Array.from({ length: currentMethod.max_installments - 1 }, (_, i) => i + 2).map(n => (
                                                <option key={n} value={n}>{n} Vezes</option>
                                            ))}
                                        </select>
                                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={18} />
                                    </div>
                                    {installments > 1 && (
                                        <p className="text-xs font-black text-orange-600 ml-2 mt-2">
                                            {installments}x de R$ {financialMetrics.installmentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-center gap-3">
                            <AlertTriangle className="text-amber-500" size={18} />
                            <p className="text-[10px] font-bold text-amber-700 uppercase leading-tight">Nenhum método de {selectedCategory} configurado. <br/>Vá em Configurações &gt; Pagamentos.</p>
                        </div>
                    )}

                    {/* Resumo de Taxas */}
                    {currentMethod && (
                        <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-2">
                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                                <span>Taxa Aplicada ({installments}x)</span>
                                <span className="text-slate-600">{financialMetrics.rate}%</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                    <span className="text-xs font-bold text-slate-500">Recebimento Líquido</span>
                                </div>
                                <span className="text-sm font-black text-slate-700">
                                    R$ {financialMetrics.netValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>
                    )}
                </main>

                <footer className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4">
                    <button 
                        onClick={onClose}
                        className="flex-1 py-4 text-slate-500 font-black uppercase tracking-widest text-xs hover:bg-slate-200 rounded-2xl transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleFinalize}
                        disabled={isLoading || !currentMethod}
                        className="flex-[2] bg-slate-800 hover:bg-slate-900 text-white py-4 rounded-2xl font-black shadow-xl shadow-slate-100 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
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

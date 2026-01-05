
import React, { useState, useEffect, useMemo } from 'react';
import { 
    X, CheckCircle, Wallet, CreditCard, Banknote, 
    Smartphone, Loader2, ShoppingCart, ArrowRight,
    ChevronDown, Info, Percent, Layers, AlertTriangle,
    User, Receipt, UserCheck, UserPlus
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import Toast, { ToastType } from '../shared/Toast';

// --- HELPERS DE FORMATAÇÃO ---
const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value);
};

// --- INTERFACES ---
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

    // --- ESTADOS DE SELEÇÃO ---
    const [dbProfessionals, setDbProfessionals] = useState<any[]>([]);
    const [dbPaymentMethods, setDbPaymentMethods] = useState<DBPaymentMethod[]>([]);
    const [selectedProfessionalId, setSelectedProfessionalId] = useState<string>('');
    const [selectedCategory, setSelectedCategory] = useState<'pix' | 'money' | 'credit' | 'debit'>('pix');
    const [selectedMethodId, setSelectedMethodId] = useState<string>('');
    const [installments, setInstallments] = useState(1);

    // 1. VALIDADOR ESTRITO DE UUID
    const isUUID = (id: any): boolean => {
        if (!id) return false;
        const sid = String(id).trim();
        return typeof id === 'string' && sid.length > 20 && sid !== 'undefined' && sid !== 'null';
    };

    // 2. RESET DE ESTADO (Obrigatório para UX de múltiplas vendas)
    const resetLocalState = () => {
        setSelectedProfessionalId('');
        setSelectedCategory('pix');
        setSelectedMethodId('');
        setInstallments(1);
    };

    // 3. FETCH DE DADOS REAIS
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
            console.error("[CHECKOUT] Erro na carga:", err);
            setToast({ message: "Erro ao sincronizar com o servidor.", type: 'error' });
        } finally {
            setIsFetching(false);
        }
    };

    useEffect(() => {
        if (isOpen) loadSystemData();
        else resetLocalState(); // Limpa ao fechar
    }, [isOpen]);

    // 4. SINCRONIZAÇÃO REATIVA
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
        let rate = installments === 1 ? Number(currentMethod.rate_cash || 0) : Number(currentMethod.installment_rates[installments.toString()] || 0);
        const discount = (appointment.price * rate) / 100;
        return { rate, netValue: appointment.price - discount };
    }, [currentMethod, installments, appointment.price]);

    // --- 5. CONFIRMAÇÃO DE PAGAMENTO (CÓDIGO BLINDADO) ---
    const handleConfirmPayment = async () => {
        if (!currentMethod) {
            setToast({ message: "Selecione o método de pagamento.", type: 'error' });
            return;
        }

        setIsLoading(true);

        // Busca JIT para garantir UUID
        let finalProfessionalId: any = selectedProfessionalId || appointment?.professional_id;
        if (!isUUID(finalProfessionalId) && appointment?.professional_name) {
            try {
                const { data: member } = await supabase.from('team_members').select('id').ilike('name', appointment.professional_name.trim()).maybeSingle();
                if (member?.id && isUUID(member.id)) finalProfessionalId = String(member.id);
                else finalProfessionalId = null;
            } catch (err) { finalProfessionalId = null; }
        }
        if (!isUUID(finalProfessionalId)) finalProfessionalId = null;

        try {
            await supabase.from('financial_transactions').delete().eq('appointment_id', appointment.id);

            const payload = {
                amount: appointment.price, 
                net_value: financialMetrics.netValue, 
                tax_rate: financialMetrics.rate, 
                description: `Venda: ${appointment.service_name} - ${appointment.client_name}`,
                type: 'income',
                category: 'servico',
                payment_method: selectedCategory,
                payment_method_id: currentMethod.id, 
                professional_id: finalProfessionalId,
                client_id: isUUID(appointment.client_id) ? appointment.client_id : null,
                appointment_id: appointment.id,
                installments: installments,
                status: 'paid',
                date: new Date().toISOString()
            };

            const { error: finError } = await supabase.from('financial_transactions').insert([payload]);
            if (finError) throw finError;

            await supabase.from('appointments').update({ status: 'concluido' }).eq('id', appointment.id);

            setToast({ message: "Recebimento concluído com sucesso! 💰", type: 'success' });
            
            // UX FEEDBACK LOOP: Aguarda 1s para o usuário ver o sucesso antes de resetar e fechar
            setTimeout(() => {
                resetLocalState();
                onSuccess(); 
                onClose(); 
            }, 1200);

        } catch (error: any) {
            console.error("[CHECKOUT] Erro:", error);
            setToast({ message: `Erro: ${error.message || "Tente novamente."}`, type: 'error' });
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
                            <h2 className="text-xl font-black text-slate-800 tracking-tighter uppercase leading-none">Recebimento</h2>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Check-out de Atendimento</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-200 rounded-full transition-all"><X size={24} /></button>
                </header>

                <main className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    <div className="bg-slate-900 rounded-[32px] p-6 text-white shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-5"><ShoppingCart size={120} /></div>
                        <div className="relative z-10 space-y-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">{appointment.service_name}</p>
                                    <p className="text-sm font-bold text-slate-300">{appointment.client_name}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Total</p>
                                    <p className="text-3xl font-black text-emerald-400 tracking-tighter">{formatCurrency(appointment.price)}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 flex items-center gap-1.5">
                            <UserCheck size={12} className="text-orange-500" />
                            1. Quem recebe a comissão?
                        </label>
                        <div className="relative group">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-orange-500 transition-colors pointer-events-none">
                                <User size={18} />
                            </div>
                            <select 
                                value={selectedProfessionalId}
                                onChange={(e) => setSelectedProfessionalId(e.target.value)}
                                className={`w-full pl-12 pr-10 py-4 bg-slate-50 border-2 rounded-2xl appearance-none outline-none focus:ring-4 focus:ring-orange-100 transition-all font-bold cursor-pointer shadow-sm ${!selectedProfessionalId ? 'border-slate-100 text-slate-400 italic' : 'border-slate-100 text-slate-700'}`}
                            >
                                <option value="">Auto-Detectar do Agendamento</option>
                                {dbProfessionals.map(prof => (
                                    <option key={prof.id} value={prof.id}>{prof.name}</option>
                                ))}
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300">
                                <ChevronDown size={18} />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">2. Método de Recebimento</label>
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
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">3. Operadora / Taxa</label>
                                <div className="relative">
                                    <select 
                                        value={selectedMethodId}
                                        onChange={(e) => setSelectedMethodId(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 font-bold text-slate-700 outline-none appearance-none focus:ring-4 focus:ring-orange-100"
                                    >
                                        {filteredMethods.map(m => (
                                            <option key={m.id} value={m.id}>{m.name} {m.brand ? `(${m.brand})` : ''}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={18} />
                                </div>
                            </div>

                            {currentMethod?.type === 'credit' && currentMethod.allow_installments && (
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">4. Parcelas</label>
                                    <div className="relative">
                                        <select 
                                            value={installments}
                                            onChange={(e) => setInstallments(parseInt(e.target.value))}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 font-bold text-slate-700 outline-none appearance-none focus:ring-4 focus:ring-orange-100"
                                        >
                                            <option value={1}>À vista (1x)</option>
                                            {Array.from({ length: (currentMethod.max_installments || 1) - 1 }, (_, i) => i + 2).map(n => (
                                                <option key={n} value={n}>{n} Vezes</option>
                                            ))}
                                        </select>
                                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={18} />
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-center gap-3">
                            <AlertTriangle className="text-amber-500" size={18} />
                            <p className="text-[10px] font-bold text-amber-700 uppercase leading-tight">Nenhum método configurado para {selectedCategory}.</p>
                        </div>
                    )}

                    {currentMethod && (
                        <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-2">
                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                                <span>Taxa Aplicada ({installments}x)</span>
                                <span className="text-slate-600">{financialMetrics.rate}%</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-slate-500">Recebimento Líquido</span>
                                <span className="text-sm font-black text-slate-700">{formatCurrency(financialMetrics.netValue)}</span>
                            </div>
                        </div>
                    )}
                </main>

                <footer className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4">
                    <button onClick={onClose} className="flex-1 py-4 text-slate-500 font-black uppercase tracking-widest text-xs hover:bg-slate-200 rounded-2xl transition-all">Cancelar</button>
                    <button
                        onClick={handleConfirmPayment}
                        disabled={isLoading || !currentMethod}
                        className="flex-[2] bg-slate-800 hover:bg-slate-900 text-white py-4 rounded-2xl font-black shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                    >
                        {isLoading ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle size={20} />}
                        Finalizar e Baixar
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default CheckoutModal;

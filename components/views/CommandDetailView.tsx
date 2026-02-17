
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    ChevronLeft, CreditCard, Smartphone, Banknote, 
    Plus, Loader2, CheckCircle,
    Phone, Scissors, ShoppingBag, Receipt,
    Percent, Calendar, ShoppingCart, X, Coins,
    ArrowRight, ShieldCheck, Tag, CreditCard as CardIcon,
    User, UserCheck, Trash2, Lock, MoreVertical, AlertTriangle,
    Clock, Landmark, ChevronRight, Calculator, Layers
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { useStudio } from '../../contexts/StudioContext';
import Toast, { ToastType } from '../shared/Toast';

const CommandDetailView: React.FC<{ commandId: string; onBack: () => void }> = ({ commandId, onBack }) => {
    const { activeStudioId } = useStudio();
    const [command, setCommand] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isFinishing, setIsFinishing] = useState(false);
    const [isLocked, setIsLocked] = useState(false);
    
    // Prevenção rigorosa de duplo clique
    const isProcessingRef = useRef(false);
    
    const [addedPayments, setAddedPayments] = useState<any[]>([]);
    const [historyPayments, setHistoryPayments] = useState<any[]>([]);
    const [paymentStep, setPaymentStep] = useState<'type' | 'brand' | 'installments' | 'confirm'>('type');
    const [selectedType, setSelectedType] = useState<string | null>(null);
    const [selectedConfig, setSelectedConfig] = useState<any | null>(null);
    const [installments, setInstallments] = useState<number>(1);
    const [amountToPay, setAmountToPay] = useState<string>('0');
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const [availableConfigs, setAvailableConfigs] = useState<any[]>([]);

    const fetchContext = async () => {
        if (!activeStudioId || !commandId) return;
        setLoading(true);
        try {
            const { data: cmdData, error: cmdError } = await supabase
                .from('commands')
                .select('*, clients:client_id (id, nome, name, photo_url)')
                .eq('id', commandId)
                .single();

            if (cmdError) throw cmdError;

            const { data: itemsData } = await supabase.from('command_items').select('*').eq('command_id', commandId);
            const [configsRes, payHistoryRes] = await Promise.all([
                supabase.from('payment_methods_config').select('*').eq('studio_id', activeStudioId).eq('is_active', true),
                supabase.from('command_payments').select(`*, method:method_id(name, brand)`).eq('command_id', commandId)
            ]);

            setAvailableConfigs(configsRes.data || []);
            setHistoryPayments(payHistoryRes.data || []);
            setCommand({ ...cmdData, command_items: itemsData || [] });
            
            if (cmdData.status === 'paid') {
                setIsLocked(true);
            }
        } catch (e: any) {
            setToast({ message: "Falha ao carregar comanda", type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { 
        isProcessingRef.current = false;
        fetchContext(); 
    }, [commandId, activeStudioId]);

    const totals = useMemo(() => {
        if (!command) return { total: 0, paid: 0, remaining: 0 };
        const total = command.command_items?.reduce((acc: number, i: any) => acc + (Number(i.price || 0) * Number(i.quantity || 1)), 0) || 0;
        const currentPaid = addedPayments.reduce((acc, p) => acc + p.amount, 0);
        return { total, paid: currentPaid, remaining: Math.max(0, total - currentPaid) };
    }, [command, addedPayments]);

    const handleFinishCheckout = async () => {
        if (isProcessingRef.current || isLocked) return;
        
        if (totals.remaining > 0 || addedPayments.length === 0) {
            setToast({ message: "Saldo pendente. Adicione o pagamento.", type: 'error' });
            return;
        }

        isProcessingRef.current = true;
        setIsFinishing(true);

        try {
            const mainPayment = addedPayments[0];
            const dbMethod = mainPayment.method === 'money' ? 'dinheiro' : mainPayment.method;

            const { data, error: rpcError } = await supabase.rpc('register_payment_transaction', {
                p_studio_id: activeStudioId,
                p_professional_id: command.professional_id,
                p_client_id: command.client_id,
                p_command_id: commandId,
                p_amount: totals.total,
                p_method: dbMethod,
                p_brand: mainPayment.brand || 'N/A',
                p_installments: Number(mainPayment.installments || 1)
            });

            if (rpcError) {
                // TRATAMENTO DE ERRO RESILIENTE (FIX MARIA/ZANEIDE)
                // Se o erro for de conflito ou duplicidade, verificamos se o banco já processou a comanda
                if (rpcError.status === 409 || rpcError.code === '23505' || rpcError.code === 'P0001') {
                    const { data: check } = await supabase.from('commands').select('status').eq('id', commandId).single();
                    if (check?.status === 'paid') {
                        setToast({ message: 'Venda processada com sucesso!', type: 'success' });
                        setIsLocked(true);
                        setTimeout(onBack, 1000);
                        return;
                    }
                }
                throw rpcError;
            }

            setToast({ message: 'Pagamento confirmado! ✅', type: 'success' });
            setIsLocked(true);
            setTimeout(onBack, 1500);

        } catch (e: any) {
            console.error('[FATAL_CHECKOUT]', e);
            setToast({ message: `Erro: ${e.message || 'Falha na comunicação'}`, type: 'error' });
            isProcessingRef.current = false;
            setIsFinishing(false);
        }
    };

    const handleSelectType = (type: string) => {
        setSelectedType(type);
        const dbType = type === 'money' ? 'dinheiro' : type;
        if (dbType === 'pix' || dbType === 'dinheiro') {
            const config = availableConfigs.find(c => c.type === dbType);
            setSelectedConfig(config || { type: dbType, name: dbType.toUpperCase(), rate_cash: 0 });
            setPaymentStep('confirm');
        } else { setPaymentStep('brand'); }
    };

    const handleConfirmPartialPayment = () => {
        if (!selectedConfig) return;
        const amount = parseFloat(amountToPay.replace(',', '.'));
        if (isNaN(amount) || amount <= 0) return;
        setAddedPayments(prev => [...prev, {
            id: Math.random().toString(36).substring(7),
            method: selectedConfig.type,
            amount: amount,
            installments: installments,
            brand: selectedConfig.brand || selectedConfig.name
        }]);
        setPaymentStep('type');
        setSelectedType(null);
    };

    if (loading) return <div className="h-full flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-orange-500" size={48} /></div>;

    return (
        <div className="h-full flex flex-col bg-slate-50 font-sans text-left overflow-hidden">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center z-20 shadow-sm">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400"><ChevronLeft size={24} /></button>
                    <div>
                        <h1 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Liquidação de Comanda</h1>
                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Status: {isLocked ? 'CONCLUÍDO' : 'PENDENTE'}</p>
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
                <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 pb-20">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
                            <header className="px-6 py-4 border-b border-slate-50 bg-slate-50/50">
                                <h3 className="font-black text-slate-800 text-[10px] uppercase tracking-widest flex items-center gap-2"><ShoppingCart size={16} /> Itens da Conta</h3>
                            </header>
                            <div className="divide-y divide-slate-50">
                                {command.command_items?.map((item: any) => (
                                    <div key={item.id} className="p-5 flex items-center justify-between">
                                        <div>
                                            <p className="font-bold text-slate-700">{item.title}</p>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase">{item.quantity} un x R$ {Number(item.price).toFixed(2)}</p>
                                        </div>
                                        <p className="font-black text-slate-800 text-lg">R$ {(item.quantity * item.price).toFixed(2)}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {(addedPayments.length > 0 || historyPayments.length > 0) && (
                            <div className="bg-white rounded-[32px] border border-slate-100 overflow-hidden shadow-sm">
                                <header className="px-6 py-4 border-b border-slate-50 bg-emerald-50/30">
                                    <h3 className="font-black text-emerald-800 text-[10px] uppercase tracking-widest">Pagamento Registrado</h3>
                                </header>
                                <div className="divide-y divide-slate-50">
                                    {(isLocked ? historyPayments : addedPayments).map(p => (
                                        <div key={p.id} className="px-6 py-4 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-500 flex items-center justify-center font-black text-[10px]">{p.installments}x</div>
                                                <span className="text-sm font-black text-slate-700 uppercase">{p.brand || p.method}</span>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className="font-black text-slate-800 text-lg">R$ {Number(p.amount).toFixed(2)}</span>
                                                {!isLocked && <button onClick={() => setAddedPayments(prev => prev.filter(i => i.id !== p.id))} className="text-rose-400 p-2 hover:bg-rose-50 rounded-lg"><X size={18} /></button>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="space-y-6">
                        <div className="bg-slate-900 rounded-[40px] p-8 text-white shadow-2xl relative overflow-hidden">
                            <p className="text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Total a Receber</p>
                            <h2 className="text-5xl font-black text-emerald-400 tracking-tighter">R$ {totals.total.toFixed(2)}</h2>
                        </div>

                        {!isLocked && (
                            <div className="bg-white rounded-[40px] p-6 border border-slate-100 shadow-sm space-y-6">
                                <div className="bg-slate-50 p-4 rounded-3xl min-h-[250px] flex flex-col">
                                    {paymentStep === 'type' && (
                                        <div className="grid grid-cols-2 gap-2">
                                            {[{id:'pix',label:'Pix',icon:Smartphone},{id:'money',label:'Dinheiro',icon:Banknote},{id:'debit',label:'Débito',icon:CreditCard},{id:'credit',label:'Crédito',icon:CardIcon}].map(pm => (
                                                <button key={pm.id} onClick={() => handleSelectType(pm.id)} className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white border border-slate-100 hover:border-orange-300 transition-all shadow-sm active:scale-95 group">
                                                    <pm.icon size={20} className="mb-2 text-slate-300 group-hover:text-orange-500 transition-colors" />
                                                    <span className="text-[9px] font-black uppercase">{pm.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {paymentStep === 'confirm' && (
                                        <div className="space-y-4 flex-1 flex flex-col">
                                            <header className="flex justify-between items-center"><span className="text-[9px] font-black uppercase text-orange-500">Valor</span><button onClick={() => setPaymentStep('type')}><X size={16} className="text-slate-300" /></button></header>
                                            <input type="number" autoFocus value={amountToPay} onChange={e => setAmountToPay(e.target.value)} className="w-full bg-white border-2 border-slate-100 rounded-2xl py-6 text-center text-2xl font-black text-slate-800 outline-none focus:border-orange-400" />
                                            <button onClick={handleConfirmPartialPayment} className="w-full bg-slate-800 text-white font-black py-4 rounded-2xl shadow-xl active:scale-95">Vincular</button>
                                        </div>
                                    )}

                                    {paymentStep === 'brand' && (
                                        <div className="grid grid-cols-1 gap-2">
                                            <header className="flex justify-between items-center px-1"><span className="text-[9px] font-black uppercase text-orange-500">Bandeira</span><button onClick={() => setPaymentStep('type')}><X size={16} className="text-slate-300" /></button></header>
                                            {availableConfigs.filter(c => c.type === selectedType).map(cfg => (
                                                <button key={cfg.id} onClick={() => { setSelectedConfig(cfg); setPaymentStep('confirm'); }} className="p-4 bg-white border border-slate-100 rounded-xl font-black text-xs uppercase text-left hover:border-orange-400 transition-all">{cfg.brand || cfg.name}</button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <button 
                                    onClick={handleFinishCheckout} 
                                    disabled={isFinishing || totals.remaining > 0 || addedPayments.length === 0} 
                                    className={`w-full py-5 rounded-[24px] font-black text-lg uppercase transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3 ${totals.remaining === 0 && !isFinishing ? 'bg-emerald-600 text-white shadow-emerald-100' : 'bg-slate-100 text-slate-300'}`}
                                >
                                    {isFinishing ? <Loader2 size={24} className="animate-spin" /> : <><CheckCircle size={24} /> LIQUIDAR CONTA</>}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CommandDetailView;

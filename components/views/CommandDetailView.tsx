
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronLeft, CreditCard, Smartphone, Banknote, Loader2, CheckCircle, User, Briefcase, ShoppingCart, X, Receipt, Coins, CheckCircle2, ArrowRight } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { useStudio } from '../../contexts/StudioContext';
import Toast, { ToastType } from '../shared/Toast';
// FIX: Added missing import for Card component
import Card from '../shared/Card';

interface CommandDetailViewProps {
    commandId: string;
    onBack: () => void;
}

const CommandDetailView: React.FC<CommandDetailViewProps> = ({ commandId, onBack }) => {
    const { activeStudioId } = useStudio();
    const isMounted = useRef(true);
    const [loading, setLoading] = useState(true);
    const [isFinishing, setIsFinishing] = useState(false);
    const [isSuccessfullyClosed, setIsSuccessfullyClosed] = useState(false);
    const [command, setCommand] = useState<any>(null);
    const [items, setItems] = useState<any[]>([]);
    const [dbMethods, setDbMethods] = useState<any[]>([]);
    const [addedPayments, setAddedPayments] = useState<any[]>([]);
    const [activeCategory, setActiveCategory] = useState<'credit' | 'debit' | 'pix' | 'money' | null>(null);
    const [amountToPay, setAmountToPay] = useState<string>('0');
    const [selectedMethodObj, setSelectedMethodObj] = useState<any>(null);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    useEffect(() => {
        const fetchContext = async () => {
            if (!activeStudioId || !commandId) return;
            setLoading(true);
            try {
                // RPC de Contexto (Busca Comanda + Itens + Métodos em uma única rede)
                const { data, error } = await supabase.rpc('get_checkout_context', { p_command_id: commandId });
                if (error) throw error;
                if (isMounted.current) {
                    setCommand(data.command);
                    setItems(data.items || []);
                    setDbMethods(data.methods || []);
                    if (data.command.status === 'paid') setIsSuccessfullyClosed(true);
                }
            } catch (e: any) {
                console.error(e);
                setToast({ message: "Erro ao carregar dados da comanda.", type: 'error' });
            } finally {
                setLoading(false);
            }
        };
        fetchContext();
    }, [commandId, activeStudioId]);

    const handleFinishPayment = async () => {
        if (!command || isFinishing || addedPayments.length === 0) return;
        setIsFinishing(true);
        try {
            const methodMap: Record<string, string> = { 'money': 'cash', 'credit': 'credit', 'debit': 'debit', 'pix': 'pix' };

            for (const p of addedPayments) {
                // ✅ CHAMADA OBRIGATÓRIA DA V2 (NORMALIZADA NO DB)
                const { error } = await supabase.rpc('register_payment_transaction_v2', {
                    p_studio_id: activeStudioId,
                    p_professional_id: command.professional_id, // Já normalizado via trigger no DB
                    p_amount: Number(p.amount),
                    p_method: methodMap[p.method as keyof typeof methodMap],
                    p_brand: p.brand || 'DIRETO',
                    p_installments: 1,
                    p_command_id: commandId,
                    p_client_id: command.client_id ? Number(command.client_id) : null,
                    p_description: `Liquidação Comanda #${commandId.split('-')[0].toUpperCase()}`
                });

                if (error) throw error;
            }

            setIsSuccessfullyClosed(true);
            setToast({ message: "Comanda liquidada e fechada!", type: 'success' });
        } catch (e: any) {
            setToast({ message: `Erro no Checkout: ${e.message}`, type: 'error' });
            setIsFinishing(false);
        }
    };

    if (loading) return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-orange-500" size={40} /></div>;

    return (
        <div className="h-full flex flex-col bg-slate-50 font-sans text-left overflow-hidden">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center z-20 shadow-sm">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors"><ChevronLeft size={24} /></button>
                    <h1 className="text-xl font-black text-slate-800">Checkout <span className="text-orange-500">#{commandId.split('-')[0].toUpperCase()}</span></h1>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                        {isSuccessfullyClosed && (
                            <div className="bg-emerald-600 rounded-[40px] p-10 text-white shadow-2xl animate-in zoom-in-95 flex flex-col items-center text-center">
                                <CheckCircle2 size={64} className="mb-4" />
                                <h2 className="text-3xl font-black uppercase tracking-widest">Pago com Sucesso</h2>
                                <p className="text-emerald-100 mt-2">Os valores foram creditados no seu fluxo de caixa.</p>
                            </div>
                        )}
                        
                        {/* FIX: Using Card component to wrap items list */}
                        <Card title="Itens do Atendimento" icon={<ShoppingCart size={20}/>}>
                            <div className="divide-y divide-slate-50">
                                {items.map((item: any) => (
                                    <div key={item.id} className="py-4 flex justify-between items-center">
                                        <div><p className="font-black text-slate-700">{item.title}</p><p className="text-[10px] text-slate-400 font-bold uppercase">{item.quantity}x R$ {item.price.toFixed(2)}</p></div>
                                        <p className="font-black text-slate-800">R$ {(item.price * item.quantity).toFixed(2)}</p>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-slate-900 rounded-[48px] p-10 text-white shadow-2xl">
                            <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Total da Comanda</p>
                            <h2 className="text-5xl font-black tracking-tighter text-emerald-400">R$ {Number(command?.total_amount || 0).toFixed(2)}</h2>
                        </div>

                        {!isSuccessfullyClosed && (
                            <div className="bg-white rounded-[40px] p-8 border border-slate-100 shadow-sm space-y-6">
                                {activeCategory ? (
                                    <div className="space-y-4 animate-in slide-in-from-top-2">
                                        <div className="flex justify-between items-center"><h4 className="text-[10px] font-black uppercase text-orange-600">Pagar com {activeCategory}</h4><button onClick={() => setActiveCategory(null)}><X size={18}/></button></div>
                                        <input type="number" value={amountToPay} onChange={e => setAmountToPay(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-6 text-2xl font-black text-slate-800 outline-none focus:border-orange-400" />
                                        <button onClick={() => { setAddedPayments([{method: activeCategory, amount: amountToPay}]); setActiveCategory(null); }} className="w-full bg-slate-800 text-white font-black py-4 rounded-2xl">Confirmar Valor</button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-3">
                                        {['pix', 'money', 'credit', 'debit'].map(cat => (
                                            <button key={cat} onClick={() => { setActiveCategory(cat as any); setAmountToPay(command.total_amount.toString()); }} className="p-6 rounded-3xl border-2 border-slate-50 bg-slate-50/50 hover:border-orange-200 transition-all flex flex-col items-center gap-2">
                                                {cat === 'pix' ? <Smartphone size={24}/> : <Coins size={24}/>}
                                                <span className="text-[9px] font-black uppercase">{cat}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                <button onClick={handleFinishPayment} disabled={isFinishing || addedPayments.length === 0} className="w-full py-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[32px] font-black uppercase tracking-widest transition-all disabled:opacity-50">
                                    {isFinishing ? <Loader2 className="animate-spin mx-auto" /> : 'Finalizar e Fechar'}
                                </button>
                            </div>
                        )}
                        {isSuccessfullyClosed && (
                            <button onClick={onBack} className="w-full py-6 bg-slate-800 text-white rounded-[32px] font-black uppercase flex items-center justify-center gap-2">Próximo <ArrowRight size={20}/></button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CommandDetailView;

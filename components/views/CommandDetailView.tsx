import React, { useState, useEffect, useMemo } from 'react';
import { 
    ChevronLeft, CreditCard, Smartphone, Banknote, 
    Plus, Loader2, CheckCircle,
    ShoppingBag, Receipt,
    Percent, Calendar, ShoppingCart, X,
    ArrowRight, Tag,
    User, UserCheck, Trash2, AlertTriangle,
    Clock, Landmark, ChevronRight, CheckCircle2,
    ArrowLeft,
    // Fix: Added missing Scissors import
    Scissors
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR as pt } from 'date-fns/locale/pt-BR';
import { supabase } from '../../services/supabaseClient';
import { useStudio } from '../../contexts/StudioContext';
import Toast, { ToastType } from '../shared/Toast';

interface CommandDetailViewProps {
    commandId: string;
    onBack: () => void;
}

interface PaymentEntry {
    id: string;
    method: string;
    amount: number;
    installments: number;
    fee_rate: number;
    fee_amount: number; 
    net_value: number;
    brand?: string;
    method_id?: string; 
    created_at?: string;
}

const formatBRL = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const isSafeUUID = (id: any): boolean => {
    if (!id) return false;
    const sid = String(id).trim();
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sid);
};

const CommandDetailView: React.FC<CommandDetailViewProps> = ({ commandId, onBack }) => {
    const { activeStudioId } = useStudio();
    const [command, setCommand] = useState<any>(null);
    const [items, setItems] = useState<any[]>([]);
    const [historyPayments, setHistoryPayments] = useState<PaymentEntry[]>([]);
    const [availableConfigs, setAvailableConfigs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFinishing, setIsFinishing] = useState(false);
    
    const [addedPayments, setAddedPayments] = useState<PaymentEntry[]>([]);
    const [paymentStep, setPaymentStep] = useState<'type' | 'brand' | 'installments' | 'confirm'>('type');
    const [selectedType, setSelectedType] = useState<string | null>(null);
    const [selectedConfig, setSelectedConfig] = useState<any | null>(null);
    const [installments, setInstallments] = useState<number>(1);
    const [amountToPay, setAmountToPay] = useState<string>('0');
    const [discount, setDiscount] = useState<string>('0');
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    const normalizeCommandData = (rawCommand: any) => {
        if (!rawCommand) return null;
        return {
            ...rawCommand,
            client_name: rawCommand.client_name || rawCommand.clients?.nome || rawCommand.clients?.name || "CONSUMIDOR FINAL",
            client_photo_url: rawCommand.client_photo_url || rawCommand.clients?.photo_url || null,
            discount_amount: Number(rawCommand.discount_amount || 0),
            total_amount: Number(rawCommand.total_amount || 0),
            status: rawCommand.status || 'open',
            created_at: rawCommand.created_at || new Date().toISOString(),
            professional_name: rawCommand.professional_name || "Geral"
        };
    };

    const fetchContext = async () => {
        if (!activeStudioId || !commandId) return;
        
        setLoading(true);
        try {
            const { data, error } = await supabase.rpc('get_command_full', { 
                p_command_id: commandId 
            });

            if (error) throw error;

            if (!data || !data.command) {
                setCommand(null);
                setLoading(false);
                return;
            }

            const { data: configs } = await supabase
                .from('payment_methods_config')
                .select('*')
                .eq('studio_id', activeStudioId)
                .eq('is_active', true);

            setAvailableConfigs(configs || []);
            setCommand(normalizeCommandData(data.command));
            setItems(data.items || []);
            
            const safePayments = (data.payments || []).map((p: any) => ({
                ...p,
                amount: Number(p.amount || 0),
                fee_rate: Number(p.fee_rate || 0),
                fee_amount: Number(p.fee_amount || 0),
                net_value: Number(p.net_value || p.amount || 0),
                installments: Number(p.installments || 1)
            }));
            setHistoryPayments(safePayments);

        } catch (e: any) {
            console.error('[COMMAND_ERROR]', e);
            setToast({ message: "Comanda não carregada.", type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchContext(); }, [commandId, activeStudioId]);

    const isPaid = command?.status === 'paid';

    const totals = useMemo(() => {
        if (!command) return { subtotal: 0, total: 0, paid: 0, remaining: 0 };
        const subtotal = items.reduce((acc, i) => acc + (Number(i.price || 0) * Number(i.quantity || 1)), 0);
        const discValue = parseFloat(discount) || 0;
        const totalAfterDiscount = Math.max(0, subtotal - discValue);
        
        const allPayments = [...historyPayments, ...addedPayments];
        const paid = allPayments.reduce((acc, p) => acc + Number(p.amount), 0);
        const remaining = Math.max(0, totalAfterDiscount - paid);
        
        return { subtotal, total: totalAfterDiscount, paid, remaining };
    }, [command, items, discount, addedPayments, historyPayments]);

    const handleFinishCheckout = async () => {
        if (isFinishing || isPaid || !command) return;
        setIsFinishing(true);

        try {
            const profId = isSafeUUID(command.professional_id) ? command.professional_id : null;

            for (const p of addedPayments) {
                const { data: txId, error: txErr } = await supabase.rpc('register_payment_transaction', {
                    p_studio_id: activeStudioId,
                    p_professional_id: profId,
                    p_amount: p.amount,
                    p_method: p.method,
                    p_brand: p.brand || null,
                    p_installments: p.installments,
                    p_command_id: command.id,
                    p_client_id: command.client_id
                });
                if (txErr) throw txErr;

                await supabase.from('command_payments').insert([{
                    command_id: command.id,
                    studio_id: activeStudioId,
                    financial_transaction_id: txId,
                    method_id: p.method_id || null,
                    amount: p.amount,
                    fee_amount: p.fee_amount,
                    net_value: p.net_value,
                    fee_rate: p.fee_rate,
                    installments: p.installments,
                    brand: p.brand || null,
                    status: 'paid'
                }]);
            }

            await supabase.from('commands').update({ 
                status: 'paid', 
                closed_at: new Date().toISOString(),
                total_amount: totals.total,
                discount_amount: parseFloat(discount) || 0
            }).eq('id', command.id);

            setToast({ message: "Venda finalizada!", type: 'success' });
            setTimeout(onBack, 800);
        } catch (e: any) {
            setToast({ message: "Erro ao liquidar comanda.", type: 'error' });
        } finally {
            setIsFinishing(false);
        }
    };

    if (loading) return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-orange-500" size={48} /></div>;

    if (!command) return (
        <div className="h-full flex flex-col items-center justify-center p-8 bg-slate-50">
            <AlertTriangle size={48} className="text-rose-500 mb-4" />
            <h2 className="text-xl font-black text-slate-800 uppercase">Comanda não encontrada</h2>
            <button onClick={onBack} className="mt-8 flex items-center gap-2 px-8 py-3 bg-slate-800 text-white font-bold rounded-2xl">
                <ArrowLeft size={18} /> Voltar para Lista
            </button>
        </div>
    );

    return (
        <div className="h-full flex flex-col bg-slate-50 font-sans text-left overflow-hidden">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm flex-shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 transition-all"><ChevronLeft size={24} /></button>
                    <div>
                        <h1 className="text-xl font-black text-slate-800 uppercase tracking-tighter">
                            {isPaid ? 'Comanda Liquidada' : 'Finalizar Atendimento'}
                        </h1>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Ref: {commandId.substring(0,8).toUpperCase()}</p>
                    </div>
                </div>
                <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase ${isPaid ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'}`}>
                    {isPaid ? 'Paga' : 'Aberta'}
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
                <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 pb-20">
                    <div className="lg:col-span-8 space-y-6">
                        <div className="bg-white rounded-[40px] p-8 border border-slate-100 shadow-sm flex items-center gap-6">
                            <div className="w-20 h-20 rounded-[24px] bg-orange-100 text-orange-600 flex items-center justify-center font-black text-2xl overflow-hidden flex-shrink-0">
                                {command.client_photo_url ? <img src={command.client_photo_url} className="w-full h-full object-cover" /> : (command.client_name || 'C').charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-2xl font-black text-slate-800 truncate">{command.client_name}</h3>
                                <div className="flex gap-4 mt-2">
                                    <span className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1.5"><Calendar size={12} /> {format(new Date(command.created_at), "dd/MM/yy")}</span>
                                    <span className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1.5"><UserCheck size={12} /> {command.professional_name}</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
                            <header className="px-8 py-6 border-b border-slate-50 bg-slate-50/30">
                                <h3 className="font-black text-slate-800 text-xs uppercase tracking-widest flex items-center gap-2"><ShoppingCart size={16} className="text-orange-500" /> Itens Lançados</h3>
                            </header>
                            <div className="divide-y divide-slate-50">
                                {items.map((item: any) => (
                                    <div key={item.id} className="p-8 flex items-center justify-between group">
                                        <div className="flex items-center gap-5">
                                            <div className={`p-4 rounded-3xl ${item.product_id ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                                                {item.product_id ? <ShoppingBag size={24} /> : <Scissors size={24} />}
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-800 text-lg leading-tight">{item.title || "Procedimento"}</p>
                                                <p className="text-[10px] text-slate-400 font-black uppercase mt-1">Qtde: {item.quantity || 1} • Unit: {formatBRL(Number(item.price))}</p>
                                            </div>
                                        </div>
                                        <p className="font-black text-slate-800 text-xl">{formatBRL(Number(item.quantity || 1) * Number(item.price || 0))}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-4 space-y-6">
                        <div className="bg-slate-900 rounded-[48px] p-8 text-white shadow-2xl relative overflow-hidden">
                            <div className="relative z-10 space-y-6">
                                <div className="space-y-3">
                                    <div className="flex justify-between text-xs font-black uppercase tracking-widest text-slate-400"><span>Subtotal</span><span>{formatBRL(totals.subtotal)}</span></div>
                                    <div className="flex justify-between items-center text-xs font-black uppercase tracking-widest text-orange-400"><span>Descontos</span><span>-{formatBRL(Number(discount))}</span></div>
                                </div>
                                <div className="pt-6 border-t border-white/10 flex justify-between items-end">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Total a Pagar</p>
                                        <h2 className="text-4xl font-black tracking-tighter text-orange-400">{formatBRL(totals.total)}</h2>
                                    </div>
                                    <Receipt size={32} className="text-white/10 mb-1" />
                                </div>
                            </div>
                        </div>

                        {!isPaid && (
                            <button 
                                onClick={handleFinishCheckout} 
                                disabled={isFinishing} 
                                className="w-full py-6 rounded-[32px] bg-emerald-600 text-white font-black flex items-center justify-center gap-3 text-lg uppercase transition-all shadow-2xl active:scale-95 disabled:opacity-50"
                            >
                                {isFinishing ? <Loader2 className="animate-spin" /> : <><CheckCircle size={24} /> Fechar Comanda</>}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CommandDetailView;
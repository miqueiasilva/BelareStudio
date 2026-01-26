
import React, { useState, useEffect, useMemo } from 'react';
import { 
    ChevronLeft, CreditCard, Smartphone, Banknote, 
    Plus, Loader2, CheckCircle,
    Phone, Scissors, ShoppingBag, Receipt,
    Percent, Calendar, ShoppingCart, X, Coins,
    ArrowRight, ShieldCheck, Tag, CreditCard as CardIcon,
    User, UserCheck, Trash2, Lock, MoreVertical, AlertTriangle,
    Clock, Landmark
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
    brand?: string;
    installments: number;
    fee_rate: number;
    fee_value: number;
    net_amount: number;
    created_at?: string;
}

const BRANDS = ['Visa', 'Master', 'Elo', 'Hiper', 'Amex', 'Outros'];

const isUUID = (str: any): boolean => {
    if (!str || typeof str !== 'string') return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str) || 
           /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
};

const CommandDetailView: React.FC<CommandDetailViewProps> = ({ commandId, onBack }) => {
    const { activeStudioId } = useStudio();
    const [command, setCommand] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isFinishing, setIsFinishing] = useState(false);
    const [isLocked, setIsLocked] = useState(false);
    
    const [addedPayments, setAddedPayments] = useState<PaymentEntry[]>([]);
    const [historyPayments, setHistoryPayments] = useState<any[]>([]);
    const [activeMethod, setActiveMethod] = useState<string | null>(null);
    const [selectedBrand, setSelectedBrand] = useState<string>('Visa');
    const [selectedInstallments, setSelectedInstallments] = useState<number>(1);
    const [amountToPay, setAmountToPay] = useState<string>('0');
    const [discount, setDiscount] = useState<string>('0');
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const [availableConfigs, setAvailableConfigs] = useState<any[]>([]);

    const fetchContext = async () => {
        if (!activeStudioId || !commandId || !isUUID(commandId)) {
            setLoading(false);
            return;
        }
        
        setLoading(true);
        try {
            // 1. Busca Comanda Básica
            const { data: cmdData, error: cmdError } = await supabase
                .from('commands')
                .select('*')
                .eq('id', commandId)
                .single();

            if (cmdError) throw cmdError;

            // 2. Busca Itens (Essencial para achar o appointment_id)
            const { data: itemsData } = await supabase
                .from('command_items')
                .select('*')
                .eq('command_id', commandId);

            // 3. Pega o ID do agendamento original para backup de nomes
            const firstApptId = itemsData?.find(i => i.appointment_id)?.appointment_id;

            // 4. Busca Pagamentos e Dados de Backup em paralelo
            const [transRes, configsRes, apptBackupRes] = await Promise.all([
                supabase.from('financial_transactions').select('*').eq('command_id', commandId).neq('status', 'cancelado'),
                supabase.from('payment_methods_config').select('*').eq('studio_id', activeStudioId).eq('is_active', true),
                firstApptId ? supabase.from('appointments').select('client_name, professional_name').eq('id', firstApptId).maybeSingle() : Promise.resolve({ data: null })
            ]);

            // 5. Busca Cadastro oficial do cliente se existir UUID
            const clientId = cmdData.client_id;
            const clientOfficialRes = isUUID(clientId) 
                ? await supabase.from('clients').select('nome, whatsapp, photo_url').eq('id', clientId).maybeSingle()
                : { data: null };

            // 6. Busca Profissional oficial
            const profId = cmdData.professional_id || itemsData?.[0]?.professional_id;
            const profOfficialRes = isUUID(profId)
                ? await supabase.from('team_members').select('name, photo_url').eq('id', profId).maybeSingle()
                : { data: null };

            setAvailableConfigs(configsRes.data || []);
            setHistoryPayments(transRes.data || []);
            
            const alreadyPaid = cmdData.status === 'paid';

            // 7. Montagem com hierarquia de nomes (Oficial > Agenda > Fallback)
            setCommand({
                ...cmdData,
                command_items: itemsData || [],
                display_client_name: clientOfficialRes.data?.nome || apptBackupRes.data?.client_name || cmdData.client_name || "Consumidor Final",
                display_client_phone: clientOfficialRes.data?.whatsapp || cmdData.client_phone || "S/ CONTATO",
                display_client_photo: clientOfficialRes.data?.photo_url || null,
                display_professional_name: profOfficialRes.data?.name || apptBackupRes.data?.professional_name || cmdData.professional_name || "Geral",
                display_professional_photo: profOfficialRes.data?.photo_url || null,
                professional_id: profId,
                client_id: clientId
            });

            setIsLocked(alreadyPaid);
        } catch (e: any) {
            console.error('[FETCH_CONTEXT_ERROR]', e);
            setToast({ message: "Erro ao carregar detalhes da comanda.", type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchContext(); }, [commandId, activeStudioId]);

    const totals = useMemo(() => {
        if (!command) return { subtotal: 0, total: 0, paid: 0, remaining: 0 };
        const subtotal = command.command_items?.reduce((acc: number, i: any) => acc + (Number(i.price || 0) * Number(i.quantity || 1)), 0) || 0;
        const discValue = parseFloat(discount) || 0;
        const totalAfterDiscount = Math.max(0, subtotal - discValue);
        
        const savedPaid = historyPayments.reduce((acc, p) => acc + Number(p.amount), 0);
        const currentPaid = addedPayments.reduce((acc, p) => acc + p.amount, 0);
        
        const paid = savedPaid + currentPaid;
        const remaining = Math.max(0, totalAfterDiscount - paid);
        
        return { subtotal, total: totalAfterDiscount, paid, remaining };
    }, [command, discount, addedPayments, historyPayments]);

    const handleConfirmPartialPayment = () => {
        if (!activeMethod || isLocked) return;
        const amount = parseFloat(amountToPay.replace(',', '.'));
        if (isNaN(amount) || amount <= 0) return;

        const typeMap: Record<string, string> = { 'pix': 'pix', 'dinheiro': 'money', 'cartao_credito': 'credit', 'cartao_debito': 'debit' };
        const config = availableConfigs.find(c => c.type === (typeMap[activeMethod] || activeMethod) && (c.type === 'pix' || c.type === 'money' || String(c.brand).toUpperCase() === selectedBrand.toUpperCase()));

        const feeRate = Number(config?.rate_cash || 0);
        const feeValue = Number((amount * (feeRate / 100)).toFixed(2));

        const newPayment: PaymentEntry = {
            id: Math.random().toString(36).substring(7),
            method: activeMethod,
            amount: amount,
            installments: selectedInstallments,
            brand: selectedBrand,
            fee_rate: feeRate,
            fee_value: feeValue,
            net_amount: Number((amount - feeValue).toFixed(2))
        };

        setAddedPayments(prev => [...prev, newPayment]);
        setActiveMethod(null);
    };

    const handleFinishCheckout = async () => {
        if (!command || isFinishing || isLocked || (addedPayments.length === 0 && historyPayments.length === 0)) return;
        setIsFinishing(true);

        try {
            for (const p of addedPayments) {
                const methodMap: Record<string, string> = { 'pix': 'pix', 'dinheiro': 'cash', 'cartao_credito': 'credit', 'cartao_debito': 'debit' };
                await supabase.rpc('register_payment_transaction', {
                    p_studio_id: activeStudioId,
                    p_professional_id: isUUID(command.professional_id) ? command.professional_id : null,
                    p_command_id: commandId,
                    p_amount: p.amount,
                    p_method: methodMap[p.method] || 'pix',
                    p_brand: p.brand || null,
                    p_installments: p.installments
                });
            }

            const { error: closeError } = await supabase
                .from('commands')
                .update({ 
                    status: 'paid', 
                    closed_at: new Date().toISOString(),
                    total_amount: totals.total,
                    payment_method: addedPayments[0]?.method || historyPayments[0]?.payment_method || 'misto'
                })
                .eq('id', commandId);

            if (closeError) throw closeError;

            setToast({ message: "Comanda liquidada com sucesso! 💳", type: 'success' });
            setIsLocked(true);
            setTimeout(onBack, 1500);
        } catch (e: any) {
            setToast({ message: `Erro ao fechar: ${e.message}`, type: 'error' });
        } finally {
            setIsFinishing(false);
        }
    };

    if (loading) return <div className="h-full flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-orange-500" size={48} /></div>;

    return (
        <div className="h-full flex flex-col bg-slate-50 font-sans text-left overflow-hidden">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center z-20 shadow-sm flex-shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 transition-all"><ChevronLeft size={24} /></button>
                    <div>
                        <h1 className="text-xl font-black text-slate-800">Comanda <span className="text-orange-500 font-mono">#{commandId.substring(0,8).toUpperCase()}</span></h1>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Responsável: {command.display_professional_name}</p>
                    </div>
                </div>
                <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${isLocked ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-orange-50 text-orange-600 border border-orange-100'}`}>
                    {isLocked ? 'Paga / Finalizada' : 'Em Aberto'}
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
                <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 pb-20">
                    <div className="lg:col-span-2 space-y-6">
                        {/* HEADER CLIENTE */}
                        <div className="bg-white rounded-[40px] border border-slate-100 p-8 shadow-sm flex flex-col md:flex-row items-center gap-6">
                            <div className="w-20 h-20 bg-orange-100 text-orange-600 rounded-3xl flex items-center justify-center font-black text-2xl overflow-hidden">
                                {command.display_client_photo ? <img src={command.display_client_photo} className="w-full h-full object-cover" /> : command.display_client_name.charAt(0)}
                            </div>
                            <div className="flex-1 text-center md:text-left">
                                <h3 className="text-2xl font-black text-slate-800 leading-tight">{command.display_client_name}</h3>
                                <div className="flex flex-wrap justify-center md:justify-start gap-4 mt-2">
                                    <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase"><Phone size={14} className="text-orange-500" /> {command.display_client_phone}</div>
                                    <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase"><UserCheck size={14} className="text-orange-500" /> {command.display_professional_name}</div>
                                    <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase"><Clock size={14} className="text-orange-500" /> {format(new Date(command.created_at), "HH:mm 'de' dd/MM")}</div>
                                </div>
                            </div>
                        </div>

                        {/* ITENS CONSUMIDOS */}
                        <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
                            <header className="px-8 py-6 border-b border-slate-50 bg-slate-50/30">
                                <h3 className="font-black text-slate-800 text-sm uppercase tracking-widest flex items-center gap-2"><ShoppingCart size={18} className="text-orange-500" /> Itens da Comanda</h3>
                            </header>
                            <div className="divide-y divide-slate-50">
                                {command.command_items?.map((item: any) => (
                                    <div key={item.id} className="p-8 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                                        <div className="flex items-center gap-5">
                                            <div className={`p-4 rounded-3xl ${item.product_id ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                                                {item.product_id ? <ShoppingBag size={24} /> : <Scissors size={24} />}
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-800 text-lg leading-tight">{item.title}</p>
                                                <p className="text-[10px] text-slate-400 font-black uppercase mt-1">{item.quantity} un x R$ {Number(item.price).toFixed(2)}</p>
                                            </div>
                                        </div>
                                        <p className="font-black text-slate-800 text-xl">R$ {(item.quantity * item.price).toFixed(2)}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* FLOW DE RECEBIMENTO */}
                        {(historyPayments.length > 0 || addedPayments.length > 0) && (
                            <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden animate-in slide-in-from-bottom-4">
                                <header className="px-8 py-5 border-b border-slate-50 bg-emerald-50/50 flex justify-between items-center">
                                    <h3 className="font-black text-emerald-800 text-xs uppercase tracking-widest flex items-center gap-2"><CheckCircle size={16} /> Fluxo de Recebimento</h3>
                                </header>
                                <div className="divide-y divide-slate-50">
                                    {historyPayments.map(p => (
                                        <div key={p.id} className="px-8 py-5 flex items-center justify-between bg-slate-50/30 opacity-80">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-emerald-500"><Landmark size={20} /></div>
                                                <div>
                                                    <p className="text-sm font-black text-slate-700 uppercase">{p.payment_method?.replace('_', ' ')}</p>
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Processado em {format(new Date(p.date), 'dd/MM HH:mm')}</p>
                                                </div>
                                            </div>
                                            <span className="font-black text-slate-800 text-lg">R$ {Number(p.amount).toFixed(2)}</span>
                                        </div>
                                    ))}
                                    {addedPayments.map(p => (
                                        <div key={p.id} className="px-8 py-5 flex items-center justify-between bg-white group">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center"><Coins size={20} /></div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-black text-slate-700 uppercase">{p.method.replace('_', ' ')}</span>
                                                        {p.brand && <span className="text-[10px] font-bold text-slate-400 uppercase">({p.brand})</span>}
                                                    </div>
                                                    <p className="text-[9px] font-black text-emerald-600 uppercase">Líquido: R$ {p.net_amount.toFixed(2)}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className="font-black text-slate-800 text-lg">R$ {p.amount.toFixed(2)}</span>
                                                {!isLocked && <button onClick={() => setAddedPayments(prev => prev.filter(i => i.id !== p.id))} className="p-2 text-slate-200 hover:text-rose-500 transition-colors"><X size={18} /></button>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="space-y-6">
                        <div className="bg-slate-900 rounded-[48px] p-10 text-white shadow-2xl relative overflow-hidden">
                            <div className="relative z-10 space-y-6">
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs font-black uppercase tracking-widest text-slate-400"><span>Subtotal</span><span>R$ {totals.subtotal.toFixed(2)}</span></div>
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-orange-400"><Percent size={14} /> Desconto</div>
                                        <input type="number" value={discount} disabled={isLocked} onChange={e => setDiscount(e.target.value)} className="w-24 bg-white/10 border border-white/10 rounded-xl px-3 py-1.5 text-right font-black text-white outline-none focus:ring-2 focus:ring-orange-500/50" />
                                    </div>
                                </div>
                                <div className="pt-6 border-t border-white/10">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Total a Receber</p>
                                    <h2 className="text-5xl font-black tracking-tighter text-emerald-400">R$ {totals.total.toFixed(2)}</h2>
                                </div>
                                {totals.paid > 0 && (
                                    <div className="bg-white/5 p-4 rounded-3xl border border-white/10 space-y-2">
                                        <div className="flex justify-between text-xs font-bold text-slate-400"><span>Pago:</span><span className="text-emerald-400">R$ {totals.paid.toFixed(2)}</span></div>
                                        <div className="flex justify-between items-center pt-2 border-t border-white/5">
                                            <span className="text-xs font-black uppercase tracking-widest text-orange-400">Restante:</span>
                                            <span className={`text-xl font-black ${totals.remaining === 0 ? 'text-emerald-400' : 'text-white'}`}>R$ {totals.remaining.toFixed(2)}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {!isLocked && (
                            <div className="bg-white rounded-[48px] p-8 border border-slate-100 shadow-sm space-y-6">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 flex items-center gap-2"><Tag size={14} className="text-orange-500" /> Método de Pagamento</h4>
                                
                                {activeMethod ? (
                                    <div className="bg-slate-50 p-6 rounded-[32px] border-2 border-orange-500 animate-in zoom-in-95 space-y-6">
                                        <div className="flex justify-between items-center"><span className="text-[10px] font-black uppercase text-orange-600 tracking-widest">{activeMethod.replace('_', ' ')}</span><button onClick={() => setActiveMethod(null)} className="text-slate-300"><X size={20}/></button></div>
                                        <div className="space-y-4">
                                            {(activeMethod === 'cartao_credito' || activeMethod === 'cartao_debito') && (
                                                <div className="grid grid-cols-3 gap-2">{BRANDS.map(b => (<button key={b} onClick={() => setSelectedBrand(b)} className={`py-2 rounded-xl text-[9px] font-black uppercase transition-all ${selectedBrand === b ? 'bg-orange-500 text-white' : 'bg-white border-slate-100 text-slate-400'}`}>{b}</button>))}</div>
                                            )}
                                            <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-300">R$</span><input type="number" value={amountToPay} onChange={e => setAmountToPay(e.target.value)} className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-2xl font-black text-slate-800 outline-none focus:border-orange-400 transition-all" /></div>
                                        </div>
                                        <button onClick={handleConfirmPartialPayment} className="w-full bg-slate-800 text-white font-black py-4 rounded-2xl shadow-lg active:scale-95 transition-all">Confirmar Valor</button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-3">
                                        {[
                                            { id: 'pix', label: 'Pix', icon: Smartphone },
                                            { id: 'dinheiro', label: 'Dinheiro', icon: Banknote },
                                            { id: 'cartao_credito', label: 'Crédito', icon: CreditCard },
                                            { id: 'cartao_debito', label: 'Débito', icon: CardIcon }
                                        ].map(pm => (
                                            <button key={pm.id} onClick={() => { setActiveMethod(pm.id); setAmountToPay(totals.remaining.toFixed(2)); }} className="flex flex-col items-center justify-center p-6 rounded-[32px] bg-slate-50 text-slate-400 hover:border-orange-200 hover:bg-white transition-all group">
                                                <pm.icon size={28} className="mb-3 text-slate-300 group-hover:text-orange-500 transition-colors" />
                                                <span className="text-[10px] font-black uppercase tracking-tighter">{pm.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                <button 
                                    onClick={handleFinishCheckout} 
                                    disabled={isFinishing || totals.remaining > 0 || (addedPayments.length === 0 && historyPayments.length === 0)} 
                                    className={`w-full mt-6 py-6 rounded-[32px] font-black flex items-center justify-center gap-3 text-lg uppercase transition-all shadow-2xl ${totals.remaining === 0 ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-300'}`}
                                >
                                    {isFinishing ? <Loader2 size={24} className="animate-spin" /> : <><CheckCircle size={24} /> FECHAR COMANDA</>}
                                </button>
                            </div>
                        )}

                        {isLocked && (
                            <div className="bg-emerald-50 p-8 rounded-[48px] border-2 border-emerald-100 text-center space-y-4 animate-in zoom-in-95">
                                <CheckCircle size={48} className="text-emerald-500 mx-auto" />
                                <h3 className="text-xl font-black text-emerald-800 uppercase tracking-tighter">Comanda Paga</h3>
                                <p className="text-xs text-emerald-600 font-medium leading-relaxed">Este registro está arquivado e seu faturamento foi consolidado no fluxo de caixa.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CommandDetailView;

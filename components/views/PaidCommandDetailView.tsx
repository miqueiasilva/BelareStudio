import React, { useState, useEffect, useMemo } from 'react';
import { 
    User, Receipt, Scissors, ShoppingBag, 
    CreditCard, Banknote, Smartphone, Loader2,
    Clock, Landmark, DollarSign,
    ChevronLeft, CheckCircle2,
    AlertTriangle, ShoppingCart, Info,
    X, Trash2, Edit2, UserCheck, Percent,
    Layers
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { format } from 'date-fns';
import { ptBR as pt } from 'date-fns/locale/pt-BR';
import Card from '../shared/Card';

interface PaidCommandDetailViewProps {
    commandId: string;
    onClose: () => void;
}

interface PaymentDetail {
    id: string;
    methodLabel: string;
    methodType: string;
    grossValue: number;
    feeValue: number;
    netValue: number;
    taxRate: number;
    installments: number;
    brand: string | null;
    date: string | null;
}

const PaidCommandDetailView: React.FC<PaidCommandDetailViewProps> = ({ commandId, onClose }) => {
    const [command, setCommand] = useState<any>(null);
    const [items, setItems] = useState<any[]>([]);
    const [payments, setPayments] = useState<PaymentDetail[]>([]);
    const [professionalName, setProfessionalName] = useState<string>("GERAL / BALCÃO");
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        if (!commandId) return;
        setLoading(true);
        
        try {
            // 1. Busca Comanda e Itens (Garante total_bruto independente do pagamento)
            const { data: cmdData, error: cmdError } = await supabase
                .from('commands')
                .select('*, clients:client_id (id, nome, name, photo_url)')
                .eq('id', commandId)
                .maybeSingle();

            if (cmdError) throw cmdError;
            setCommand(cmdData);

            const { data: itemsData } = await supabase
                .from('command_items')
                .select('*')
                .eq('command_id', commandId);
            setItems(itemsData || []);

            // 2. Resolver Profissional
            if (cmdData?.professional_id) {
                const { data: prof } = await supabase.from('team_members').select('name').eq('id', cmdData.professional_id).maybeSingle();
                if (prof) setProfessionalName(prof.name);
            }

            // 3. Busca Pagamentos com Left Join
            const { data: payData } = await supabase
                .from('command_payments')
                .select(`
                    id, amount, fee_amount, net_value, fee_rate, installments, brand, created_at,
                    method:method_id (name, type)
                `)
                .eq('command_id', commandId);

            if (payData && payData.length > 0) {
                setPayments(payData.map(p => ({
                    id: p.id,
                    methodLabel: (p.method as any)?.name || 'PAGAMENTO',
                    methodType: (p.method as any)?.type || 'other',
                    grossValue: Number(p.amount || 0),
                    feeValue: Number(p.fee_amount || 0),
                    netValue: Number(p.net_value || p.amount || 0),
                    taxRate: Number(p.fee_rate || 0),
                    installments: Number(p.installments || 1),
                    brand: p.brand || null,
                    date: p.created_at
                })));
            } else {
                // Tenta buscar em transações financeiras (Fallback para comandos antigos)
                const { data: transData } = await supabase
                    .from('financial_transactions')
                    .select('*')
                    .eq('command_id', commandId)
                    .eq('status', 'pago');
                
                if (transData && transData.length > 0) {
                    setPayments(transData.map(t => ({
                        id: String(t.id),
                        methodLabel: String(t.payment_method || 'RECEBIMENTO').toUpperCase(),
                        methodType: t.payment_method || 'other',
                        grossValue: Number(t.amount || 0),
                        feeValue: Number(t.amount || 0) - Number(t.net_value || t.amount || 0),
                        netValue: Number(t.net_value || t.amount || 0),
                        taxRate: Number(t.tax_rate || 0),
                        installments: Number(t.installments || 1),
                        brand: null,
                        date: t.date
                    })));
                }
            }

        } catch (e: any) {
            console.error('[PAID_DETAIL_ERROR]', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, [commandId]);

    // Cálculo Robusto de Totais
    const calculatedTotals = useMemo(() => {
        // Bruto vem SEMPRE dos itens para evitar zeros
        const grossFromItems = items.reduce((acc, i) => acc + (Number(i.price || 0) * Number(i.quantity || 1)), 0);
        
        // Dados financeiros vêm dos registros de pagamento
        const fees = payments.reduce((acc, p) => acc + p.feeValue, 0);
        const net = payments.length > 0 ? payments.reduce((acc, p) => acc + p.netValue, 0) : grossFromItems;

        return {
            gross: grossFromItems,
            fees: fees,
            net: net
        };
    }, [items, payments]);

    const formatBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

    if (loading) return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center">
            <Loader2 className="animate-spin text-white" size={40} />
        </div>
    );

    if (!command) return null;

    const displayClientName = command.clients?.nome || command.clients?.name || command.client_name || "CONSUMIDOR FINAL";

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[200] flex items-center justify-center p-4">
            <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <header className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 flex items-center gap-3">
                            <Receipt className="text-emerald-500" size={24} />
                            Resumo da Venda
                        </h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Auditado em tempo real • BelareStudio</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400"><X size={24} /></button>
                </header>

                <div className="p-8 space-y-8 max-h-[80vh] overflow-y-auto custom-scrollbar text-left">
                    <div className="flex items-center gap-6">
                        <div className="w-16 h-16 rounded-[24px] bg-orange-100 text-orange-600 flex items-center justify-center font-black text-xl overflow-hidden shadow-sm">
                            {command.clients?.photo_url ? <img src={command.clients.photo_url} className="w-full h-full object-cover" /> : displayClientName.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">{displayClientName}</h3>
                            <div className="flex gap-4 mt-1">
                                <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1"><Clock size={12} /> {command.closed_at ? format(new Date(command.closed_at), "dd/MM/yyyy HH:mm") : '---'}</span>
                                <span className="text-[10px] font-bold text-orange-600 uppercase flex items-center gap-1"><UserCheck size={12} /> {professionalName}</span>
                            </div>
                        </div>
                    </div>

                    <Card title="Detalhamento do Consumo" icon={<ShoppingCart size={16} className="text-orange-500" />}>
                        <div className="divide-y divide-slate-50">
                            {items.map((item: any) => (
                                <div key={item.id} className="py-4 flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${item.product_id ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                                            {item.product_id ? <ShoppingBag size={16} /> : <Scissors size={16} />}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-700">{item.title}</p>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase">{item.quantity} un x {formatBRL(Number(item.price))}</p>
                                        </div>
                                    </div>
                                    <span className="font-black text-slate-800">{formatBRL(item.quantity * item.price)}</span>
                                </div>
                            ))}
                        </div>
                    </Card>

                    <div className="space-y-4">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">
                            <Landmark size={14} /> Fluxo de Recebimento
                        </h4>
                        
                        {payments.length > 0 ? (
                            payments.map((p) => (
                                <div key={p.id} className="p-5 bg-slate-50 rounded-[32px] border border-slate-100 space-y-4">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-white rounded-xl shadow-sm text-slate-400">
                                                {(p.methodType === 'credit' || p.methodType === 'debit') ? <CreditCard size={16} /> : p.methodType === 'pix' ? <Smartphone size={16} /> : <Banknote size={16} />}
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">Método</p>
                                                <p className="text-xs font-black text-slate-700">
                                                    {p.methodLabel} {p.brand && <span className="opacity-50 text-[10px]">({p.brand})</span>}
                                                    {p.installments > 1 && <span className="text-orange-500 font-black ml-1">({p.installments}x)</span>}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">Valor Bruto</p>
                                            <p className="text-sm font-black text-slate-800">{formatBRL(p.grossValue)}</p>
                                        </div>
                                    </div>
                                    
                                    <div className="pt-3 border-t border-slate-200/50 flex justify-between items-center">
                                        <span className="text-[9px] font-bold text-rose-400 uppercase flex items-center gap-1">
                                            <Percent size={10} /> Taxa Retida ({p.taxRate}%)
                                        </span>
                                        <span className="text-[10px] font-black text-rose-500">- {formatBRL(p.feeValue)}</span>
                                    </div>

                                    <div className="flex justify-between items-center">
                                        <span className="text-[9px] font-black text-emerald-600 uppercase">Líquido Previsto</span>
                                        <span className="text-sm font-black text-emerald-700">{formatBRL(p.netValue)}</span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-10 text-center bg-slate-50 rounded-[32px] border-2 border-dashed border-slate-200">
                                <AlertTriangle className="mx-auto text-amber-500 mb-2" size={24} />
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Informações de recebimento indisponíveis no momento.</p>
                            </div>
                        )}
                    </div>

                    <div className="bg-slate-900 rounded-[40px] p-8 text-white shadow-2xl relative overflow-hidden">
                        <div className="relative z-10 space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Consumido</span>
                                <span className="font-bold text-slate-300 text-sm">{formatBRL(calculatedTotals.gross)}</span>
                            </div>
                            
                            {calculatedTotals.fees > 0 && (
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-rose-400">Taxas de Cartão</span>
                                    <span className="font-bold text-rose-300 text-sm">- {formatBRL(calculatedTotals.fees)}</span>
                                </div>
                            )}

                            <div className="pt-4 border-t border-white/10 flex justify-between items-end">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-1">Resultado Líquido</p>
                                    <p className="text-4xl font-black text-emerald-400 tracking-tighter">{formatBRL(calculatedTotals.net)}</p>
                                </div>
                                <div className="pb-1">
                                    <CheckCircle2 size={32} className="text-emerald-500/50" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <footer className="p-8 bg-slate-50 border-t border-slate-100">
                    <button onClick={onClose} className="w-full py-4 bg-slate-800 text-white font-black rounded-2xl shadow-xl hover:bg-slate-900 transition-all uppercase text-xs tracking-widest">Fechar Resumo</button>
                </footer>
            </div>
        </div>
    );
};

export default PaidCommandDetailView;
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
            // 1. Busca Comanda e Itens
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

            // 3. Busca Auditoria Financeira (command_payments)
            const { data: payData, error: payError } = await supabase
                .from('command_payments')
                .select(`
                    id, amount, fee_amount, net_value, fee_rate, installments, brand, created_at,
                    method:method_id (name, type)
                `)
                .eq('command_id', commandId);

            if (payError) throw payError;

            if (payData && payData.length > 0) {
                const formatted: PaymentDetail[] = payData.map(p => ({
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
                }));
                setPayments(formatted);
            } else {
                // FALLBACK: Busca em financial_transactions caso command_payments esteja vazio (legado)
                const { data: transData } = await supabase
                    .from('financial_transactions')
                    .select('id, amount, net_value, tax_rate, installments, date, payment_method')
                    .eq('command_id', commandId)
                    .eq('status', 'pago');

                if (transData && transData.length > 0) {
                    setPayments(transData.map(t => ({
                        id: String(t.id),
                        methodLabel: String(t.payment_method || 'RECEBIMENTO').toUpperCase(),
                        methodType: t.payment_method,
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

    // FIX: Import useMemo from react to resolve "Cannot find name 'useMemo'" error.
    const totals = useMemo(() => {
        return payments.reduce((acc, p) => ({
            gross: acc.gross + p.grossValue,
            fees: acc.fees + p.feeValue,
            net: acc.net + p.netValue
        }), { gross: 0, fees: 0, net: 0 });
    }, [payments]);

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
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Documento Fiscal • Auditoria de Recebimento</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400"><X size={24} /></button>
                </header>

                <div className="p-8 space-y-8 max-h-[80vh] overflow-y-auto custom-scrollbar">
                    {/* Header Cliente */}
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

                    {/* Itens do Consumo */}
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

                    {/* Fluxo de Recebimento */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center px-1">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Landmark size={14} /> Fluxo de Recebimento
                            </h4>
                        </div>
                        
                        {payments.length > 0 ? (
                            payments.map((p) => (
                                <div key={p.id} className="p-5 bg-slate-50 rounded-[32px] border border-slate-100 space-y-4 animate-in fade-in slide-in-from-bottom-2">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-white rounded-xl shadow-sm text-slate-400">
                                                {(p.methodType === 'credit' || p.methodType === 'debit') ? <CreditCard size={16} /> : p.methodType === 'pix' ? <Smartphone size={16} /> : <Banknote size={16} />}
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Método</p>
                                                <p className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                                                    {p.methodLabel} 
                                                    {p.brand && <span className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[8px]">{p.brand}</span>}
                                                    {p.installments > 1 && <span className="text-orange-500 font-black">({p.installments}x)</span>}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Valor Bruto</p>
                                            <p className="text-sm font-black text-slate-800">{formatBRL(p.grossValue)}</p>
                                        </div>
                                    </div>
                                    
                                    <div className="pt-3 border-t border-slate-200/50 flex justify-between items-center">
                                        <span className="text-[9px] font-bold text-rose-400 uppercase flex items-center gap-1">
                                            <Percent size={10} /> Taxa Adquirente ({p.taxRate}%)
                                        </span>
                                        <span className="text-[10px] font-black text-rose-500">- {formatBRL(p.feeValue)}</span>
                                    </div>

                                    <div className="flex justify-between items-center">
                                        <span className="text-[9px] font-black text-emerald-600 uppercase">Líquido Creditado</span>
                                        <span className="text-sm font-black text-emerald-700">{formatBRL(p.netValue)}</span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-12 text-center bg-slate-50 rounded-[40px] border-2 border-dashed border-slate-200">
                                <AlertTriangle className="mx-auto text-amber-500 mb-3" size={32} />
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Pagamento não localizado para esta comanda.</p>
                            </div>
                        )}
                    </div>

                    {/* Resumo Consolidado */}
                    <div className="bg-slate-900 rounded-[40px] p-8 text-white shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
                        
                        <div className="relative z-10 space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Bruto</span>
                                <span className="font-bold text-slate-300 text-sm">{formatBRL(totals.gross)}</span>
                            </div>
                            
                            {totals.fees > 0 && (
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-rose-400">Total Taxas Retidas</span>
                                    <span className="font-bold text-rose-300 text-sm">- {formatBRL(totals.fees)}</span>
                                </div>
                            )}

                            <div className="pt-4 border-t border-white/10 flex justify-between items-end">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-1">Faturamento Líquido</p>
                                    <p className="text-4xl font-black text-emerald-400 tracking-tighter">{formatBRL(totals.net)}</p>
                                </div>
                                <div className="text-right pb-1">
                                    <CheckCircle2 size={32} className="text-emerald-500/50" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <footer className="p-8 bg-slate-50 border-t border-slate-100">
                    <button onClick={onClose} className="w-full py-4 bg-slate-800 text-white font-black rounded-2xl shadow-xl hover:bg-slate-900 transition-all active:scale-95 uppercase text-xs tracking-widest">Fechar Resumo</button>
                </footer>
            </div>
        </div>
    );
};

export default PaidCommandDetailView;
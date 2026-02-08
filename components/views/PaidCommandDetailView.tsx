import React, { useState, useEffect } from 'react';
import { 
    User, Receipt, Scissors, ShoppingBag, 
    CreditCard, Banknote, Smartphone, Loader2,
    Clock, Landmark, DollarSign,
    ChevronLeft, CheckCircle2,
    AlertTriangle, ShoppingCart, Info,
    X, Trash2, Edit2, UserCheck, Percent
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { format } from 'date-fns';
import { ptBR as pt } from 'date-fns/locale/pt-BR';
import Card from '../shared/Card';

interface PaidCommandDetailViewProps {
    commandId: string;
    onClose: () => void;
}

// Estrutura consolidada para exibição baseada em transações financeiras
interface PaymentDetail {
    id: string;
    methodLabel: string;
    grossValue: number;
    feeValue: number;
    netValue: number;
    taxRate: number;
    installments: number;
    date: string | null;
}

const PaidCommandDetailView: React.FC<PaidCommandDetailViewProps> = ({ commandId, onClose }) => {
    const [command, setCommand] = useState<any>(null);
    const [items, setItems] = useState<any[]>([]);
    const [payments, setPayments] = useState<PaymentDetail[]>([]);
    const [professionalName, setProfessionalName] = useState<string>("GERAL / BALCÃO");
    const [loading, setLoading] = useState(true);

    const resolveProfessional = async (commandData: any, itemsData: any[], paymentsData: any[]) => {
        // 1. Prioridade: Professional retornado no snapshot da comanda
        if (commandData.responsible_professional_name) return commandData.responsible_professional_name;
        if (commandData.professional_name && commandData.professional_name !== "Geral") return commandData.professional_name;

        // 2. Buscar por professional_id da comanda
        if (commandData.professional_id) {
            const { data: prof } = await supabase.from('team_members').select('name').eq('id', commandData.professional_id).maybeSingle();
            if (prof) return prof.name;
        }

        // 3. Buscar pelo professional_id do primeiro pagamento
        const firstPayWithProf = paymentsData.find(p => p.professional_id);
        if (firstPayWithProf) {
            const { data: prof } = await supabase.from('team_members').select('name').eq('id', firstPayWithProf.professional_id).maybeSingle();
            if (prof) return prof.name;
        }

        // 4. Buscar pelo professional_id do primeiro item
        const firstItemWithProf = itemsData.find(i => i.professional_id);
        if (firstItemWithProf) {
            const { data: prof } = await supabase.from('team_members').select('name').eq('id', firstItemWithProf.professional_id).maybeSingle();
            if (prof) return prof.name;
        }

        // 5. Buscar do agendamento ligado ao item
        const firstItemWithAppt = itemsData.find(i => i.appointment_id);
        if (firstItemWithAppt) {
            const { data: appt } = await supabase.from('appointments').select('professional_name').eq('id', firstItemWithAppt.appointment_id).maybeSingle();
            if (appt?.professional_name) return appt.professional_name;
        }

        return "GERAL / BALCÃO";
    };

    const loadData = async () => {
        if (!commandId) return;
        setLoading(true);
        
        try {
            // 1. Carregar Comanda e Itens
            const [cmdRes, itemsRes, paymentsRes] = await Promise.all([
                supabase.from('commands').select('*, clients:client_id (id, nome, name, photo_url)').eq('id', commandId).maybeSingle(),
                supabase.from('command_items').select('*').eq('command_id', commandId),
                // CORREÇÃO DA QUERY (400 FIX): Join explícito com a tabela de configuração
                supabase.from('command_payments')
                    .select('*, payment_methods_config!command_payments_method_id_fkey(name, brand, rate_cash)')
                    .eq('command_id', commandId)
                    .order('created_at', { ascending: true })
            ]);

            if (cmdRes.error) throw cmdRes.error;
            const commandData = cmdRes.data;
            const itemsData = itemsRes.data || [];
            const paymentsDb = paymentsRes.data || [];
            
            setCommand(commandData);
            setItems(itemsData);

            // 2. Resolver Profissional Responsável
            const resolvedProf = await resolveProfessional(commandData, itemsData, paymentsDb);
            setProfessionalName(resolvedProf);

            // 3. Formatar Pagamentos de command_payments (Fonte de Auditoria)
            if (paymentsDb.length > 0) {
                const formatted: PaymentDetail[] = paymentsDb.map(p => {
                    const gross = Number(p.amount || 0);
                    const net = Number(p.net_amount || p.amount || 0);
                    const config = p.payment_methods_config as any;

                    return {
                        id: p.id,
                        methodLabel: (config?.name || 'PAGAMENTO').toUpperCase(),
                        grossValue: gross,
                        feeValue: gross - net,
                        netValue: net,
                        taxRate: Number(p.fee_rate || config?.rate_cash || 0),
                        installments: p.installments || 1,
                        date: p.created_at
                    };
                });
                setPayments(formatted);
            } else {
                // Caso extremo: tenta financial_transactions como fallback
                const { data: ftData } = await supabase
                    .from('financial_transactions')
                    .select('*, payment_methods_config:payment_method_id(name)')
                    .eq('command_id', commandId)
                    .limit(5);

                if (ftData && ftData.length > 0) {
                    setPayments(ftData.map(ft => ({
                        id: ft.id,
                        methodLabel: ((ft.payment_methods_config as any)?.name || ft.payment_method || 'RECEBIMENTO').toUpperCase(),
                        grossValue: Number(ft.amount || 0),
                        feeValue: Number(ft.amount || 0) - Number(ft.net_value || ft.amount),
                        netValue: Number(ft.net_value || ft.amount || 0),
                        taxRate: Number(ft.tax_rate || 0),
                        installments: ft.installments || 1,
                        date: ft.date || ft.created_at
                    })));
                }
            }

        } catch (e: any) {
            console.error('[PAID_DETAIL] Erro ao carregar auditoria:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [commandId]);

    if (loading) return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center">
            <Loader2 className="animate-spin text-white" size={40} />
        </div>
    );

    const displayClientName = command?.clients?.nome || command?.clients?.name || command?.client_name || "CONSUMIDOR FINAL";
    const totalGross = payments.reduce((acc, p) => acc + p.grossValue, 0);
    const totalNet = payments.reduce((acc, p) => acc + p.netValue, 0);
    const totalFees = totalGross - totalNet;

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[200] flex items-center justify-center p-4">
            <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <header className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 flex items-center gap-3">
                            <Receipt className="text-emerald-500" size={24} />
                            Resumo da Venda
                        </h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Comanda Liquidada • Auditoria Financeira</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400"><X size={24} /></button>
                </header>

                <div className="p-8 space-y-8 max-h-[80vh] overflow-y-auto custom-scrollbar">
                    {/* Cabeçalho Cliente */}
                    <div className="flex items-center gap-6">
                        <div className="w-16 h-16 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center font-black text-xl overflow-hidden shadow-sm">
                            {command?.clients?.photo_url ? <img src={command.clients.photo_url} className="w-full h-full object-cover" /> : displayClientName.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">{displayClientName}</h3>
                            <div className="flex gap-4 mt-1">
                                <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1"><Clock size={12} /> {command?.closed_at ? format(new Date(command.closed_at), "dd/MM/yyyy HH:mm") : '---'}</span>
                                <span className="text-[10px] font-bold text-orange-600 uppercase flex items-center gap-1"><UserCheck size={12} /> {professionalName}</span>
                            </div>
                        </div>
                    </div>

                    {/* Itens */}
                    <Card title="Composição do Consumo" icon={<ShoppingCart size={16} className="text-orange-500" />}>
                        <div className="divide-y divide-slate-50">
                            {items.map((item: any) => (
                                <div key={item.id} className="py-4 flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${item.product_id ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                                            {item.product_id ? <ShoppingBag size={16} /> : <Scissors size={16} />}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-700">{item.title}</p>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase">{item.quantity} un x R$ {Number(item.price).toFixed(2)}</p>
                                        </div>
                                    </div>
                                    <span className="font-black text-slate-800">R$ {(item.quantity * item.price).toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                    </Card>

                    {/* Detalhamento Financeiro */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center px-1">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Landmark size={14} /> Fluxo de Recebimento
                            </h4>
                        </div>
                        
                        {payments.map((p) => (
                            <div key={p.id} className="p-5 bg-slate-50 rounded-[32px] border border-slate-100 space-y-4">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-white rounded-xl shadow-sm text-slate-400">
                                            <CreditCard size={16} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Método</p>
                                            <p className="text-xs font-black text-slate-700">{p.methodLabel} {p.installments > 1 ? `(${p.installments}x)` : ''}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Valor Pago</p>
                                        <p className="text-sm font-black text-slate-800">R$ {p.grossValue.toFixed(2)}</p>
                                    </div>
                                </div>
                                
                                <div className="pt-3 border-t border-slate-200/50 flex justify-between items-center">
                                    <span className="text-[9px] font-bold text-rose-400 uppercase flex items-center gap-1">
                                        <Percent size={10} /> Taxa Retida ({p.taxRate}%)
                                    </span>
                                    <span className="text-[10px] font-black text-rose-500">- R$ {p.feeValue.toFixed(2)}</span>
                                </div>

                                <div className="flex justify-between items-center">
                                    <span className="text-[9px] font-black text-emerald-600 uppercase">Líquido em Conta</span>
                                    <span className="text-sm font-black text-emerald-700">R$ {p.netValue.toFixed(2)}</span>
                                </div>
                            </div>
                        ))}

                        {payments.length === 0 && (
                            <div className="p-10 text-center bg-slate-50 rounded-[32px] border-2 border-dashed border-slate-100">
                                <AlertTriangle className="mx-auto text-amber-500 mb-2" size={32} />
                                <p className="text-xs font-bold text-slate-400 uppercase">Nenhum dado financeiro vinculado.</p>
                            </div>
                        )}
                    </div>

                    {/* Resumo Final Consolidado */}
                    <div className="bg-slate-900 rounded-[40px] p-8 text-white shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
                        
                        <div className="relative z-10 space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Subtotal Bruto</span>
                                <span className="font-bold text-slate-300 text-sm">R$ {totalGross.toFixed(2)}</span>
                            </div>
                            
                            {totalFees > 0 && (
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-rose-400">Total Taxas Retidas</span>
                                    <span className="font-bold text-rose-300 text-sm">- R$ {totalFees.toFixed(2)}</span>
                                </div>
                            )}

                            <div className="pt-4 border-t border-white/10 flex justify-between items-end">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-1">Faturamento Líquido</p>
                                    <p className="text-4xl font-black text-emerald-400 tracking-tighter">R$ {totalNet.toFixed(2)}</p>
                                </div>
                                <div className="text-right pb-1">
                                    <CheckCircle2 size={32} className="text-emerald-500/50" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <footer className="p-8 bg-slate-50 border-t border-slate-100">
                    <button onClick={onClose} className="w-full py-4 bg-slate-800 text-white font-black rounded-2xl shadow-xl hover:bg-slate-900 transition-all active:scale-95 uppercase text-xs tracking-widest">Fechar Detalhamento</button>
                </footer>
            </div>
        </div>
    );
};

export default PaidCommandDetailView;

import React, { useState, useEffect, useMemo } from 'react';
import { 
    Receipt, Scissors, ShoppingBag, 
    CreditCard, Banknote, Smartphone, Loader2,
    Clock, Landmark, CheckCircle2,
    AlertTriangle, ShoppingCart,
    X, UserCheck, Percent
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { format } from 'date-fns';
import { ptBR as pt } from 'date-fns/locale/pt-BR';
import Card from '../shared/Card';

interface PaidCommandDetailViewProps {
    commandId: string;
    onClose: () => void;
}

const PaidCommandDetailView: React.FC<PaidCommandDetailViewProps> = ({ commandId, onClose }) => {
    const [command, setCommand] = useState<any>(null);
    const [items, setItems] = useState<any[]>([]);
    const [payment, setPayment] = useState<any>(null);
    const [professionalName, setProfessionalName] = useState<string>("GERAL");
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        if (!commandId) return;
        setLoading(true);
        
        try {
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

            if (cmdData?.professional_id) {
                const { data: prof } = await supabase.from('team_members').select('name').eq('id', cmdData.professional_id).maybeSingle();
                if (prof) setProfessionalName(prof.name);
            }

            // BUSCA DADOS REAIS DE PAGAMENTO PERSISTIDOS
            const { data: payData } = await supabase
                .from('command_payments')
                .select(`*, payment_methods_config (name, brand)`)
                .eq('command_id', commandId)
                .maybeSingle();

            setPayment(payData);

        } catch (e: any) {
            console.error('[PAID_DETAIL_ERROR]', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, [commandId]);

    const formatBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

    if (loading) return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center">
            <div className="bg-white p-8 rounded-[32px] flex flex-col items-center">
                <Loader2 className="animate-spin text-orange-500 mb-4" size={40} />
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Recuperando Financeiro...</p>
            </div>
        </div>
    );

    if (!command) return null;

    const displayClientName = command.clients?.nome || command.clients?.name || command.client_name || "CONSUMIDOR FINAL";
    const grossAmount = Number(payment?.amount || command.total_amount || 0);
    const feeAmount = Number(payment?.fee_amount || 0);
    const netValue = Number(payment?.net_value || grossAmount);

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[200] flex items-center justify-center p-4">
            <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <header className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 flex items-center gap-3 uppercase tracking-tighter">
                            <Receipt className="text-emerald-500" size={24} />
                            Relatório de Venda
                        </h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Conferência Auditada em command_payments</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400"><X size={24} /></button>
                </header>

                <div className="p-8 space-y-8 max-h-[75vh] overflow-y-auto custom-scrollbar text-left">
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

                    <Card title="Itens Vendidos" icon={<ShoppingCart size={16} className="text-orange-500" />}>
                        <div className="divide-y divide-slate-50">
                            {items.map((item: any) => (
                                <div key={item.id} className="py-4 flex justify-between items-center">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-2 rounded-xl ${item.product_id ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                                            {item.product_id ? <ShoppingBag size={18} /> : <Scissors size={18} />}
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-slate-700 leading-tight">{item.title}</p>
                                            <p className="text-[10px] text-slate-400 font-bold mt-0.5">{item.quantity} un x {formatBRL(Number(item.price))}</p>
                                        </div>
                                    </div>
                                    <span className="font-black text-slate-800">{formatBRL(item.quantity * item.price)}</span>
                                </div>
                            ))}
                        </div>
                    </Card>

                    <div className="space-y-4">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                            <Landmark size={14} /> Auditoria Financeira
                        </h4>
                        
                        {payment ? (
                            <div className="p-6 bg-slate-50 rounded-[32px] border-2 border-white shadow-sm space-y-4">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-white rounded-2xl text-orange-500 shadow-sm">
                                            <CreditCard size={20} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1.5">Forma de Recebimento</p>
                                            <p className="text-sm font-black text-slate-800">
                                                {payment.payment_methods_config?.name || payment.brand || 'Consolidado'}
                                                {payment.installments > 1 && <span className="text-orange-500"> ({payment.installments}x)</span>}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1.5">Bruto</p>
                                        <p className="text-lg font-black text-slate-800">{formatBRL(grossAmount)}</p>
                                    </div>
                                </div>
                                
                                <div className="pt-4 border-t border-slate-200/50 flex justify-between items-center">
                                    <span className="text-[10px] font-black text-rose-500 uppercase flex items-center gap-1.5">
                                        <Percent size={12} /> Taxa da Operação
                                    </span>
                                    <span className="text-sm font-black text-rose-500">- {formatBRL(feeAmount)}</span>
                                </div>

                                <div className="flex justify-between items-center bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100">
                                    <span className="text-[10px] font-black text-emerald-700 uppercase">Líquido Creditado</span>
                                    <span className="text-lg font-black text-emerald-700">{formatBRL(netValue)}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="p-10 text-center bg-amber-50 rounded-[40px] border-2 border-dashed border-amber-100">
                                <AlertTriangle className="mx-auto text-amber-400 mb-3" size={32} />
                                <p className="text-xs font-black text-amber-600 uppercase tracking-widest">
                                    Falha na auditoria direta: Registro command_payments ausente.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                <footer className="p-8 bg-slate-50 border-t border-slate-100">
                    <button onClick={onClose} className="w-full py-4 bg-slate-800 text-white font-black rounded-2xl shadow-xl hover:bg-slate-900 transition-all active:scale-95 uppercase text-xs tracking-widest">Fechar Relatório</button>
                </footer>
            </div>
        </div>
    );
};

export default PaidCommandDetailView;
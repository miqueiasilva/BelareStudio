import React, { useState, useEffect, useMemo } from 'react';
import { 
    Receipt, Clock, User, Landmark, DollarSign,
    X, ShoppingCart, Percent, CheckCircle2, Loader2,
    Scissors, ShoppingBag, Landmark as BankIcon
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
    const [payments, setPayments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        if (!commandId) return;
        setLoading(true);
        try {
            const { data: cmdData } = await supabase
                .from('commands')
                .select('*, clients:client_id(nome)')
                .eq('id', commandId)
                .single();
            
            const { data: itemsData } = await supabase.from('command_items').select('*').eq('command_id', commandId);
            
            // Busca da financial_transactions (fonte principal com tax_rate e net_value)
            const { data: ftData } = await supabase
                .from('financial_transactions')
                .select('*')
                .eq('command_id', commandId);

            // Fallback para command_payments se não houver dados em financial_transactions
            let payData = ftData && ftData.length > 0 ? ftData : [];
            if (payData.length === 0) {
                const { data: cpData } = await supabase.from('command_payments').select('*').eq('command_id', commandId);
                payData = cpData || [];
            }

            setCommand(cmdData);
            setItems(itemsData || []);
            setPayments(payData);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, [commandId]);

    const formatBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

    if (loading) return <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[250] flex items-center justify-center"><Loader2 className="animate-spin text-white" size={40} /></div>;
    if (!command) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[250] flex items-center justify-center p-4">
            <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300">
                <header className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl"><Receipt size={20} /></div>
                        <h2 className="text-lg font-black text-slate-800 uppercase tracking-tighter">Recibo de Venda</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400"><X size={24} /></button>
                </header>

                <div className="p-8 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar text-left">
                    <div className="text-center pb-6 border-b border-dashed border-slate-200">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Cliente</p>
                        <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">{command.clients?.nome || command.client_name || 'Consumidor Final'}</h3>
                        <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Finalizado em {format(new Date(command.closed_at), "dd/MM/yyyy 'às' HH:mm")}</p>
                    </div>

                    <div className="space-y-4">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1"><ShoppingCart size={14} /> Itens do Consumo</h4>
                        <div className="space-y-2">
                            {items.map(item => (
                                <div key={item.id} className="flex justify-between items-center text-sm">
                                    <span className="text-slate-600 font-bold">{item.quantity}x {item.title}</span>
                                    <span className="font-black text-slate-800">{formatBRL(item.price * item.quantity)}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-slate-900 rounded-[32px] p-6 text-white space-y-4 relative overflow-hidden">
                        <div className="flex justify-between items-center relative z-10">
                            <span className="text-xs font-bold text-slate-400 uppercase">Valor Total</span>
                            <span className="text-2xl font-black text-emerald-400">{formatBRL(Number(command.total_amount))}</span>
                        </div>
                        
                        {payments.map(p => (
                            <div key={p.id} className="pt-4 border-t border-white/10 space-y-2 relative z-10">
                                <div className="flex justify-between items-center">
                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Forma de Pagamento</p>
                                    <span className="text-[10px] font-black text-emerald-400 uppercase">
                                        {p.brand || p.payment_method || p.method}
                                        {p.installments > 1 ? ` — ${p.installments}x` : ''}
                                    </span>
                                </div>
                                
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-slate-400">Valor Bruto</span>
                                    <span className="text-sm font-bold text-white">{formatBRL(Number(p.amount))}</span>
                                </div>

                                {Number(p.tax_rate) > 0 && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs text-rose-400">Taxa ({Number(p.tax_rate)}%)</span>
                                        <span className="text-sm font-bold text-rose-400">- {formatBRL((Number(p.amount) * Number(p.tax_rate)) / 100)}</span>
                                    </div>
                                )}

                                <div className="flex justify-between items-center pt-2 border-t border-white/5">
                                    <span className="text-xs font-black text-slate-300 uppercase">Valor Líquido</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg font-black text-white">{formatBRL(Number(p.net_value || p.amount))}</span>
                                        <CheckCircle2 className="text-emerald-500" size={16} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <footer className="p-6 bg-slate-50 border-t border-slate-100">
                    <button onClick={onClose} className="w-full py-4 bg-slate-800 text-white font-black rounded-2xl shadow-xl hover:bg-slate-900 transition-all uppercase text-xs">Fechar Detalhamento</button>
                </footer>
            </div>
        </div>
    );
};

export default PaidCommandDetailView;

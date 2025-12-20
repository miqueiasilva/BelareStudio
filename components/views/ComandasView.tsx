
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
    FileText, User, DollarSign, Clock, RefreshCw, Loader2, CheckCircle, Search
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { Order, FinancialTransaction, PaymentMethod } from '../../types';
import Toast, { ToastType } from '../shared/Toast';
import { format } from 'date-fns';

const ComandasView: React.FC = () => {
    const [orders, setOrders] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const [closingOrderId, setClosingOrderId] = useState<number | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');

    const fetchOrders = useCallback(async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('orders')
                .select('*, clients(nome)')
                .eq('status', 'aberta')
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            setOrders(data || []);
        } catch (error: any) {
            setToast({ message: 'Erro ao buscar comandas.', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

    const handleCloseOrder = async (orderId: number, total: number, clientName: string) => {
        try {
            // 1. Mark Order as Paid
            const { error: oErr } = await supabase.from('orders').update({ status: 'fechada' }).eq('id', orderId);
            if (oErr) throw oErr;

            // 2. Create Transaction
            const { error: tErr } = await supabase.from('financial_transactions').insert([{
                description: `Fechamento Comanda #${orderId} - ${clientName}`,
                amount: total,
                type: 'receita',
                category: 'servico',
                payment_method: paymentMethod,
                date: new Date().toISOString(),
                status: 'pago'
            }]);
            if (tErr) throw tErr;

            setToast({ message: 'Comanda encerrada!', type: 'success' });
            setClosingOrderId(null);
            fetchOrders();
        } catch (e: any) {
            setToast({ message: 'Erro ao fechar conta.', type: 'error' });
        }
    };

    const filteredOrders = useMemo(() => {
        return orders.filter(o => 
            (o.clients?.nome || 'Cliente Balcão').toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [orders, searchTerm]);

    return (
        <div className="h-full flex flex-col bg-slate-50 relative font-sans">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <header className="bg-white border-b border-slate-200 px-6 py-5 flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <FileText className="text-orange-500" /> Comandas Abertas
                    </h1>
                    <p className="text-slate-500 text-sm">Contas pendentes de recebimento.</p>
                </div>
                <div className="flex gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <input type="text" placeholder="Filtrar por cliente..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 pr-4 py-2.5 bg-slate-100 border-none rounded-xl focus:bg-white focus:ring-2 focus:ring-orange-500 outline-none text-sm transition-all" />
                    </div>
                    <button onClick={fetchOrders} className="p-2.5 text-slate-400 hover:text-orange-500 hover:bg-orange-50 rounded-xl transition-all"><RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} /></button>
                </div>
            </header>

            <main className="flex-1 p-6 overflow-y-auto">
                {isLoading && orders.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400"><Loader2 className="animate-spin mb-4" /><p>Buscando contas...</p></div>
                ) : filteredOrders.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300 italic"><FileText size={64} className="mb-4 opacity-10" /><p>Nenhuma comanda pendente.</p></div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredOrders.map(order => (
                            <div key={order.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex flex-col hover:shadow-xl transition-all group">
                                <div className="flex justify-between items-start mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400"><User size={20} /></div>
                                        <div>
                                            <h3 className="font-bold text-slate-800 text-sm truncate max-w-[120px]">{order.clients?.nome || 'Balcão'}</h3>
                                            <p className="text-[10px] text-slate-400 font-black uppercase">COMANDA #{order.id}</p>
                                        </div>
                                    </div>
                                    <div className="bg-blue-50 text-blue-600 px-2 py-1 rounded-lg text-[9px] font-black uppercase">Aberta</div>
                                </div>

                                <div className="flex-1 space-y-3 mb-6">
                                    <div className="flex items-center justify-between text-xs text-slate-500">
                                        <div className="flex items-center gap-2"><Clock size={12}/> {format(new Date(order.created_at), 'HH:mm')}</div>
                                        <div className="font-bold">TOTAL</div>
                                    </div>
                                    <div className="text-3xl font-black text-slate-800 text-right">R$ {order.total.toFixed(2)}</div>
                                </div>

                                {closingOrderId === order.id ? (
                                    <div className="space-y-4 animate-in fade-in zoom-in-95">
                                        <select className="w-full bg-slate-100 border-none rounded-xl px-4 py-2.5 text-xs font-bold uppercase text-slate-600 outline-none" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as any)}>
                                            <option value="pix">Pix</option><option value="cartao_credito">Crédito</option><option value="cartao_debito">Débito</option><option value="dinheiro">Dinheiro</option>
                                        </select>
                                        <div className="flex gap-2">
                                            <button onClick={() => setClosingOrderId(null)} className="flex-1 py-2.5 rounded-xl font-bold text-xs text-slate-500 bg-slate-100">Cancelar</button>
                                            <button onClick={() => handleCloseOrder(order.id, order.total, order.clients?.nome || 'Balcão')} className="flex-[2] py-2.5 rounded-xl font-bold text-xs bg-green-600 text-white shadow-lg">Confirmar</button>
                                        </div>
                                    </div>
                                ) : (
                                    <button onClick={() => setClosingOrderId(order.id)} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-orange-100 transition-all active:scale-95">
                                        <DollarSign size={18} /> RECEBER CONTA
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
};

export default ComandasView;


import React, { useState, useEffect } from 'react';
import { 
    X, User, Receipt, Scissors, ShoppingBag, 
    CreditCard, Banknote, Smartphone, Loader2,
    Calendar, Clock, Landmark, DollarSign,
    ChevronLeft
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { format } from 'date-fns';
import { ptBR as pt } from 'date-fns/locale/pt-BR';

interface PaidCommandDetailViewProps {
    commandId: string;
    onClose: () => void;
}

const PaidCommandDetailView: React.FC<PaidCommandDetailViewProps> = ({ commandId, onClose }) => {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchFullCommand = async () => {
            setLoading(true);
            try {
                // Utilizando a RPC solicitada para obter dados consolidados
                const { data: fullData, error } = await supabase.rpc('get_command_full', { 
                    p_command_id: commandId 
                });

                if (error) throw error;
                setData(fullData);
            } catch (err) {
                console.error("Erro ao carregar detalhe da comanda paga:", err);
            } finally {
                setLoading(false);
            }
        };

        if (commandId) fetchFullCommand();
    }, [commandId]);

    const formatBRL = (val: number) => 
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

    if (loading) {
        return (
            <div className="fixed inset-0 bg-slate-50/90 backdrop-blur-sm z-[100] flex flex-col items-center justify-center">
                <Loader2 className="animate-spin text-orange-500 mb-4" size={40} />
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Recuperando Arquivo...</p>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="fixed inset-0 bg-white z-[100] flex flex-col items-center justify-center p-6 text-center">
                <X className="text-rose-500 mb-4" size={48} />
                <h3 className="font-black text-slate-800">Comanda não encontrada</h3>
                <button onClick={onClose} className="mt-6 px-8 py-3 bg-slate-800 text-white rounded-2xl font-black uppercase text-xs">Voltar</button>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-slate-100 z-[100] flex flex-col font-sans animate-in slide-in-from-right duration-300 text-left">
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm flex-shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 transition-all">
                        <ChevronLeft size={24} />
                    </button>
                    <div>
                        <h1 className="text-lg font-black text-slate-800 uppercase tracking-tighter">
                            Arquivo Histórico <span className="text-orange-500">#{commandId.substring(0, 8).toUpperCase()}</span>
                        </h1>
                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.2em]">Visualização Somente Leitura</p>
                    </div>
                </div>
                <div className="bg-emerald-50 text-emerald-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100 flex items-center gap-2">
                    <Landmark size={14} /> Liquidada em {data.closed_at ? format(new Date(data.closed_at), 'dd/MM/yy') : '---'}
                </div>
            </header>

            <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
                <div className="max-w-4xl mx-auto space-y-6">
                    
                    {/* INFO CLIENTE E PROFISSIONAL */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-4">
                            <div className="w-14 h-14 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center font-black text-xl overflow-hidden">
                                {data.client?.photo_url ? <img src={data.client.photo_url} className="w-full h-full object-cover" /> : (data.client?.nome || 'C').charAt(0)}
                            </div>
                            <div className="flex-1">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Cliente</p>
                                <h3 className="font-black text-slate-800 truncate uppercase">{data.client?.nome || 'Consumidor Final'}</h3>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-4">
                            <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center overflow-hidden">
                                {data.professional?.photo_url ? <img src={data.professional.photo_url} className="w-full h-full object-cover" /> : <User size={28} />}
                            </div>
                            <div className="flex-1">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Responsável</p>
                                <h3 className="font-black text-slate-800 truncate uppercase">{data.professional?.name || 'Geral'}</h3>
                            </div>
                        </div>
                    </div>

                    {/* ITENS E PAGAMENTOS */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 space-y-6">
                            <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
                                <header className="px-8 py-5 border-b border-slate-50 bg-slate-50/30">
                                    <h3 className="font-black text-slate-700 text-[10px] uppercase tracking-widest flex items-center gap-2">
                                        <Receipt size={16} className="text-orange-500" /> Detalhamento de Itens
                                    </h3>
                                </header>
                                <div className="divide-y divide-slate-50">
                                    {data.items?.map((item: any) => (
                                        <div key={item.id} className="px-8 py-4 flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className={`p-2 rounded-xl ${item.product_id ? 'bg-purple-50 text-purple-500' : 'bg-blue-50 text-blue-500'}`}>
                                                    {item.product_id ? <ShoppingBag size={18} /> : <Scissors size={18} />}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-800 text-sm">{item.title}</p>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase">{item.quantity} un x {formatBRL(item.price)}</p>
                                                </div>
                                            </div>
                                            <p className="font-black text-slate-800 text-sm">{formatBRL(item.quantity * item.price)}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="bg-slate-900 rounded-[32px] p-8 text-white shadow-xl relative overflow-hidden">
                                <div className="relative z-10">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Liquidado</p>
                                    <h2 className="text-4xl font-black text-emerald-400">{formatBRL(data.total_amount)}</h2>
                                    <div className="mt-6 pt-6 border-t border-white/10 space-y-3">
                                        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                                            <span>Subtotal</span>
                                            <span>{formatBRL(data.items?.reduce((acc: any, i: any) => acc + (i.price * i.quantity), 0))}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-orange-400">
                                            <span>Descontos</span>
                                            <span>-{formatBRL((data.items?.reduce((acc: any, i: any) => acc + (i.price * i.quantity), 0) || 0) - data.total_amount)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
                                <header className="px-6 py-4 border-b border-slate-50 bg-emerald-50/30">
                                    <h3 className="font-black text-emerald-800 text-[10px] uppercase tracking-widest flex items-center gap-2">
                                        <CreditCard size={14} /> Pagamento Efetuado
                                    </h3>
                                </header>
                                <div className="p-6 space-y-4">
                                    {data.
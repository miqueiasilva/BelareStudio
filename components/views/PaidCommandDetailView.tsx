import React, { useState, useEffect } from 'react';
import { 
    X, User, Receipt, Scissors, ShoppingBag, 
    CreditCard, Banknote, Smartphone, Loader2,
    Calendar, Clock, Landmark, DollarSign,
    ChevronLeft, CheckCircle2, Info,
    // FIX: Added AlertTriangle to imports
    AlertTriangle
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

    const getPaymentIcon = (method: string) => {
        switch (method?.toLowerCase()) {
            case 'pix': return <Smartphone className="text-teal-500" />;
            case 'money': case 'cash': case 'dinheiro': return <Banknote className="text-green-500" />;
            default: return <CreditCard className="text-blue-500" />;
        }
    };

    if (loading) {
        return (
            <div className="fixed inset-0 bg-slate-50/90 backdrop-blur-sm z-[100] flex flex-col items-center justify-center animate-in fade-in duration-300">
                <Loader2 className="animate-spin text-orange-500 mb-4" size={40} />
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Recuperando Registro...</p>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="fixed inset-0 bg-white z-[100] flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
                <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-[32px] flex items-center justify-center mb-6">
                    <X size={40} />
                </div>
                <h3 className="text-xl font-black text-slate-800">Comanda não localizada</h3>
                <p className="text-slate-400 text-sm mt-2 max-w-xs">O registro solicitado pode ter sido removido ou não está acessível no momento.</p>
                <button onClick={onClose} className="mt-8 px-10 py-4 bg-slate-800 text-white rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all">Voltar ao Balcão</button>
            </div>
        );
    }

    const itemsTotal = data.items?.reduce((acc: number, i: any) => acc + (Number(i.price) * Number(i.quantity)), 0) || 0;
    const discount = itemsTotal - (Number(data.total_amount) || 0);

    return (
        <div className="fixed inset-0 bg-slate-50 z-[100] flex flex-col font-sans animate-in slide-in-from-right duration-300 text-left">
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm flex-shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 transition-all active:scale-90">
                        <ChevronLeft size={24} />
                    </button>
                    <div>
                        <h1 className="text-lg font-black text-slate-800 uppercase tracking-tighter">
                            Comanda Arquivada <span className="text-orange-500">#{commandId.substring(0, 8).toUpperCase()}</span>
                        </h1>
                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.2em]">Registro Histórico Permanente</p>
                    </div>
                </div>
                <div className="bg-emerald-50 text-emerald-600 px-5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-emerald-100 flex items-center gap-2">
                    <CheckCircle2 size={14} /> Paga em {data.closed_at ? format(new Date(data.closed_at), 'dd/MM/yyyy HH:mm') : '---'}
                </div>
            </header>

            <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
                <div className="max-w-5xl mx-auto space-y-6 pb-20">
                    
                    {/* INFO CLIENTE E PROFISSIONAL */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-5">
                            <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-3xl flex items-center justify-center font-black text-2xl overflow-hidden shadow-inner">
                                {data.client?.photo_url ? <img src={data.client.photo_url} className="w-full h-full object-cover" /> : (data.client?.nome || 'C').charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Cliente Atendido</p>
                                <h3 className="font-black text-slate-800 truncate uppercase text-lg">{data.client?.nome || data.client_name || 'Consumidor Final'}</h3>
                                {data.client?.whatsapp && <p className="text-[10px] font-bold text-slate-400">{data.client.whatsapp}</p>}
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-5">
                            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center overflow-hidden shadow-inner">
                                {data.professional?.photo_url ? <img src={data.professional.photo_url} className="w-full h-full object-cover" /> : <User size={32} className="text-blue-200" />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Profissional Responsável</p>
                                <h3 className="font-black text-slate-800 truncate uppercase text-lg">{data.professional?.name || data.professional_name || 'Equipe Belare'}</h3>
                                {data.professional?.role && <p className="text-[10px] font-bold text-slate-400 uppercase">{data.professional.role}</p>}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* LISTA DE ITENS */}
                        <div className="lg:col-span-2 space-y-6">
                            <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
                                <header className="px-8 py-6 border-b border-slate-50 bg-slate-50/50">
                                    <h3 className="font-black text-slate-700 text-[10px] uppercase tracking-widest flex items-center gap-2">
                                        <Receipt size={18} className="text-orange-500" /> Detalhamento do Consumo
                                    </h3>
                                </header>
                                <div className="divide-y divide-slate-50">
                                    {data.items?.length > 0 ? data.items.map((item: any) => (
                                        <div key={item.id} className="p-8 flex items-center justify-between hover:bg-slate-50/30 transition-colors">
                                            <div className="flex items-center gap-5">
                                                <div className={`p-4 rounded-[24px] shadow-sm ${item.product_id ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                                                    {item.product_id ? <ShoppingBag size={24} /> : <Scissors size={24} />}
                                                </div>
                                                <div>
                                                    <p className="font-black text-slate-800 text-lg leading-tight uppercase tracking-tight">{item.title}</p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-[10px] font-black text-slate-400 uppercase bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                                                            {item.quantity} un
                                                        </span>
                                                        <span className="text-[10px] font-bold text-slate-400">x {formatBRL(item.price)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-black text-slate-800 text-xl">{formatBRL(item.quantity * item.price)}</p>
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="p-20 text-center text-slate-300 font-bold uppercase text-xs tracking-widest">Nenhum item registrado</div>
                                    )}
                                </div>
                                <footer className="p-8 bg-slate-50/50 border-t border-slate-100 flex justify-between items-center">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Soma dos Itens</span>
                                    <span className="font-black text-slate-600 text-lg">{formatBRL(itemsTotal)}</span>
                                </footer>
                            </div>
                        </div>

                        {/* RESUMO FINANCEIRO */}
                        <div className="space-y-6">
                            <div className="bg-slate-900 rounded-[48px] p-10 text-white shadow-2xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-6 opacity-10"><DollarSign size={80} /></div>
                                <div className="relative z-10">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Valor Total Liquidado</p>
                                    <h2 className="text-5xl font-black tracking-tighter text-emerald-400">{formatBRL(data.total_amount)}</h2>
                                    
                                    <div className="mt-8 pt-8 border-t border-white/10 space-y-4">
                                        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                                            <span>Subtotal</span>
                                            <span>{formatBRL(itemsTotal)}</span>
                                        </div>
                                        {discount > 0 && (
                                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-orange-400">
                                                <span>Descontos Aplicados</span>
                                                <span className="bg-orange-500/20 px-2 py-0.5 rounded">-{formatBRL(discount)}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-emerald-400 pt-2">
                                            <span>Líquido Recebido</span>
                                            <span className="text-sm">{formatBRL(data.total_amount)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
                                <header className="px-6 py-4 border-b border-slate-50 bg-emerald-50/30">
                                    <h3 className="font-black text-emerald-800 text-[10px] uppercase tracking-widest flex items-center gap-2">
                                        <CreditCard size={14} /> Detalhe do Pagamento
                                    </h3>
                                </header>
                                <div className="p-6 space-y-4">
                                    {data.payments?.length > 0 ? data.payments.map((p: any, idx: number) => (
                                        <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-3xl border border-slate-100">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shadow-sm">
                                                    {getPaymentIcon(p.method)}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-black text-slate-800 uppercase tracking-tighter">{p.method?.replace('_', ' ') || 'Outro'}</p>
                                                    {p.brand && <p className="text-[9px] font-bold text-slate-400 uppercase">{p.brand} {p.installments > 1 && `• ${p.installments}x`}</p>}
                                                </div>
                                            </div>
                                            <span className="font-black text-slate-800 text-sm">{formatBRL(p.amount)}</span>
                                        </div>
                                    )) : (
                                        <div className="p-4 bg-orange-50 border border-orange-100 rounded-2xl flex items-start gap-3">
                                            <AlertTriangle size={16} className="text-orange-500 flex-shrink-0 mt-0.5" />
                                            <p className="text-[10px] font-bold text-orange-700 leading-relaxed uppercase">Registro de pagamento manual ou migrado. Detalhes de taxa indisponíveis.</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="p-6 bg-blue-50 border border-blue-100 rounded-[32px] flex items-start gap-4">
                                <Info size={20} className="text-blue-500 flex-shrink-0 mt-1" />
                                <div>
                                    <h4 className="text-xs font-black text-blue-900 uppercase tracking-widest mb-1">Auditoria</h4>
                                    <p className="text-[10px] text-blue-700 leading-relaxed font-medium">Este documento é um comprovante interno de quitação. As taxas bancárias reais foram descontadas no fechamento do dia correspondente.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
            
            <footer className="p-6 bg-white border-t border-slate-100 flex justify-center flex-shrink-0">
                <button 
                    onClick={onClose}
                    className="px-12 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-200 transition-all active:scale-95"
                >
                    Fechar Arquivo
                </button>
            </footer>
        </div>
    );
};

export default PaidCommandDetailView;
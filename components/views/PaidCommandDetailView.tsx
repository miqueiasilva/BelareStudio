import React, { useState, useEffect } from 'react';
import { 
    X, User, Receipt, Scissors, ShoppingBag, 
    CreditCard, Banknote, Smartphone, Loader2,
    Calendar, Clock, Landmark, DollarSign,
    ChevronLeft, CheckCircle2, Info,
    AlertTriangle, ShoppingCart, UserCheck
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
            if (!commandId) return;
            setLoading(true);
            try {
                // Utilizando a RPC para obter dados consolidados (itens + pagamentos + perfis)
                const { data: fullData, error } = await supabase.rpc('get_command_full', { 
                    p_command_id: commandId 
                });

                if (error) throw error;
                
                const result = Array.isArray(fullData) ? fullData[0] : fullData;
                setData(result);
            } catch (err) {
                console.error("Erro ao carregar detalhe da comanda paga:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchFullCommand();
    }, [commandId]);

    const formatBRL = (val: number) => 
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

    const getPaymentIcon = (method: string) => {
        const m = method?.toLowerCase() || '';
        if (m.includes('pix')) return <Smartphone className="text-teal-500" />;
        if (m.includes('dinheiro') || m.includes('cash') || m.includes('money')) return <Banknote className="text-green-500" />;
        return <CreditCard className="text-blue-500" />;
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

    // Lógica de fallback para nome do cliente
    const displayClientName = data.client?.nome || data.client?.name || data.client_name || "Consumidor Final";
    
    // Cálculos do resumo
    const itemsTotal = data.items?.reduce((acc: number, i: any) => acc + (Number(i.price || 0) * Number(i.quantity || 1)), 0) || 0;
    const finalAmount = Number(data.total_amount) || 0;
    const discount = itemsTotal - finalAmount;

    return (
        <div className="fixed inset-0 bg-slate-50 z-[100] flex flex-col font-sans animate-in slide-in-from-right duration-300 text-left">
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm flex-shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 transition-all active:scale-90">
                        <ChevronLeft size={24} />
                    </button>
                    <div>
                        <h1 className="text-lg font-black text-slate-800 uppercase tracking-tighter">
                            Detalhamento <span className="text-orange-500">#{commandId.substring(0, 8).toUpperCase()}</span>
                        </h1>
                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Histórico de Arquivo • Somente Leitura</p>
                    </div>
                </div>
                <div className="bg-emerald-50 text-emerald-600 px-5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-emerald-100 flex items-center gap-2 shadow-sm">
                    <CheckCircle2 size={14} /> Liquidada em {data.closed_at ? format(new Date(data.closed_at), 'dd/MM/yyyy HH:mm') : '---'}
                </div>
            </header>

            <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
                <div className="max-w-6xl mx-auto space-y-6 pb-20">
                    
                    {/* INFO CARDS */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-5">
                            <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-3xl flex items-center justify-center font-black text-2xl overflow-hidden shadow-inner border-2 border-white">
                                {data.client?.photo_url ? <img src={data.client.photo_url} className="w-full h-full object-cover" /> : displayClientName.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Cliente</p>
                                <h3 className="font-black text-slate-800 truncate uppercase text-lg">{displayClientName}</h3>
                                {data.client?.whatsapp && <p className="text-[10px] font-bold text-slate-500 flex items-center gap-1"><Smartphone size={10} className="text-orange-400"/> {data.client.whatsapp}</p>}
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-5">
                            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center overflow-hidden shadow-inner border-2 border-white">
                                {data.professional?.photo_url ? <img src={data.professional.photo_url} className="w-full h-full object-cover" /> : <User size={32} className="text-blue-200" />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Responsável</p>
                                <h3 className="font-black text-slate-800 truncate uppercase text-lg">{data.professional?.name || data.professional_name || 'Geral'}</h3>
                                <p className="text-[10px] font-bold text-slate-500 flex items-center gap-1 uppercase"><UserCheck size={10} className="text-blue-400"/> Vendedor Técnico</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* CONSUMO */}
                        <div className="lg:col-span-2 space-y-6">
                            <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
                                <header className="px-8 py-6 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
                                    <h3 className="font-black text-slate-700 text-[10px] uppercase tracking-widest flex items-center gap-2">
                                        <ShoppingCart size={18} className="text-orange-500" /> Itens da Transação
                                    </h3>
                                    <span className="text-[10px] font-black text-slate-400 uppercase bg-white px-3 py-1 rounded-lg border border-slate-100">{data.items?.length || 0} Registros</span>
                                </header>
                                <div className="divide-y divide-slate-50">
                                    {data.items?.map((item: any) => (
                                        <div key={item.id} className="p-8 flex items-center justify-between hover:bg-slate-50/30 transition-colors">
                                            <div className="flex items-center gap-5">
                                                <div className={`p-4 rounded-[24px] shadow-sm ${item.product_id ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                                                    {item.product_id ? <ShoppingBag size={24} /> : <Scissors size={24} />}
                                                </div>
                                                <div>
                                                    <p className="font-black text-slate-800 text-lg leading-tight uppercase tracking-tight">{item.title}</p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-[10px] font-black text-slate-400 uppercase bg-slate-100 px-2 py-0.5 rounded border border-slate-100">
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
                                    ))}
                                </div>
                                <footer className="p-8 bg-slate-50/50 border-t border-slate-100 flex justify-between items-center">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Soma Bruta</span>
                                    <span className="font-black text-slate-600 text-lg">{formatBRL(itemsTotal)}</span>
                                </footer>
                            </div>
                        </div>

                        {/* RESUMO FINANCEIRO */}
                        <div className="space-y-6">
                            <div className="bg-slate-900 rounded-[48px] p-10 text-white shadow-2xl relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity"><DollarSign size={120} /></div>
                                <div className="relative z-10">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Faturamento Consolidado</p>
                                    <h2 className="text-5xl font-black tracking-tighter text-emerald-400">{formatBRL(finalAmount)}</h2>
                                    
                                    <div className="mt-8 pt-8 border-t border-white/10 space-y-4">
                                        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                                            <span>Subtotal</span>
                                            <span>{formatBRL(itemsTotal)}</span>
                                        </div>
                                        {discount > 0 && (
                                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-orange-400">
                                                <span>Ajustes / Descontos</span>
                                                <span className="bg-orange-500/20 px-2 py-0.5 rounded">-{formatBRL(discount)}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-emerald-400 pt-2 border-t border-white/5">
                                            <span>Valor em Caixa</span>
                                            <span className="text-sm font-bold">{formatBRL(finalAmount)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
                                <header className="px-6 py-4 border-b border-slate-50 bg-slate-50/50">
                                    <h3 className="font-black text-slate-700 text-[10px] uppercase tracking-widest flex items-center gap-2">
                                        <Receipt size={14} className="text-emerald-500" /> Fluxo de Pagamento
                                    </h3>
                                </header>
                                <div className="p-6 space-y-4">
                                    {data.payments?.map((p: any, idx: number) => (
                                        <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-3xl border border-slate-100 group hover:border-emerald-200 transition-all">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shadow-sm group-hover:shadow-md transition-all">
                                                    {getPaymentIcon(p.method)}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-black text-slate-800 uppercase tracking-tighter">{p.method?.replace('_', ' ') || 'Processamento'}</p>
                                                    {p.brand && <p className="text-[9px] font-bold text-slate-400 uppercase">{p.brand} {p.installments > 1 && `• ${p.installments}x`}</p>}
                                                </div>
                                            </div>
                                            <span className="font-black text-slate-800 text-sm">{formatBRL(p.amount)}</span>
                                        </div>
                                    ))}
                                    {(!data.payments || data.payments.length === 0) && (
                                        <div className="p-4 bg-orange-50 border border-orange-100 rounded-2xl flex items-start gap-3">
                                            <AlertTriangle size={16} className="text-orange-500 flex-shrink-0 mt-0.5" />
                                            <p className="text-[10px] font-bold text-orange-700 leading-relaxed uppercase">O detalhamento individual das taxas deste fechamento não está disponível no log atual.</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="p-6 bg-blue-50 border border-blue-100 rounded-[32px] flex items-start gap-4">
                                <Info size={20} className="text-blue-500 flex-shrink-0 mt-1" />
                                <div>
                                    <h4 className="text-xs font-black text-blue-900 uppercase tracking-widest mb-1">Auditoria Eletrônica</h4>
                                    <p className="text-[10px] text-blue-700 leading-relaxed font-medium">Este registro foi selado após a liquidação financeira. Alterações só são possíveis via estorno administrativo no módulo Financeiro.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
            
            <footer className="p-6 bg-white border-t border-slate-100 flex justify-center flex-shrink-0">
                <button 
                    onClick={onClose}
                    className="px-12 py-4 bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-900 transition-all active:scale-95 shadow-xl"
                >
                    Voltar ao Balcão
                </button>
            </footer>
        </div>
    );
};

export default PaidCommandDetailView;

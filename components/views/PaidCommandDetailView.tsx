import React, { useState, useEffect } from 'react';
import { 
    Receipt, Scissors, ShoppingBag, 
    CreditCard, Banknote, Smartphone, Loader2,
    Clock, Landmark, CheckCircle2,
    AlertTriangle, ShoppingCart,
    X, UserCheck, Percent, Hash
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
    const [error, setError] = useState<string | null>(null);

    const loadData = async () => {
        if (!commandId) return;
        setLoading(true);
        setError(null);
        
        try {
            console.log("[REPORT] Iniciando auditoria profunda para ID:", commandId);

            // 1. Busca dados básicos da comanda e cliente
            const { data: cmdData, error: cmdError } = await supabase
                .from('commands')
                .select('*, clients:client_id (id, nome, name, photo_url)')
                .eq('id', commandId)
                .maybeSingle();

            if (cmdError) throw cmdError;
            if (!cmdData) throw new Error("Comanda não localizada no sistema.");
            setCommand(cmdData);

            // 2. Busca itens consumidos
            const { data: itemsData } = await supabase
                .from('command_items')
                .select('*')
                .eq('command_id', commandId);
            const currentItems = itemsData || [];
            setItems(currentItems);

            // 3. Busca nome do profissional
            if (cmdData.professional_id) {
                const { data: prof } = await supabase.from('team_members').select('name').eq('id', cmdData.professional_id).maybeSingle();
                if (prof) setProfessionalName(prof.name);
            }

            // 4. MOTOR DE BUSCA DE PAGAMENTO (MULTI-ESTÁGIO)
            
            // ESTÁGIO A: Tabela de Auditoria Direta
            const { data: payData } = await supabase
                .from('command_payments')
                .select(`*, payment_methods_config (name, brand)`)
                .eq('command_id', commandId)
                .eq('status', 'paid')
                .maybeSingle();

            if (payData) {
                console.log("[REPORT_AUDIT_OK] Registro command_payments encontrado.");
                setPayment(payData);
                setLoading(false);
                return;
            }

            // ESTÁGIO B: Fallback via Vínculo de Comanda em Transações Financeiras
            console.warn("[REPORT_AUDIT] Registro direto ausente. Tentando vínculo em financial_transactions...");
            const { data: txByCommand } = await supabase
                .from('financial_transactions')
                .select('*')
                .eq('command_id', commandId)
                .maybeSingle();

            if (txByCommand) {
                console.log("[REPORT_FALLBACK_OK] Transação via command_id encontrada.");
                setPayment({
                    amount: txByCommand.amount,
                    net_value: txByCommand.net_value || txByCommand.amount,
                    fee_amount: (txByCommand.amount - (txByCommand.net_value || txByCommand.amount)),
                    payment_method: txByCommand.payment_method,
                    brand: txByCommand.payment_method?.toUpperCase() || 'N/A',
                    financial_transaction_id: txByCommand.id,
                    created_at: txByCommand.date
                });
                setLoading(false);
                return;
            }

            // ESTÁGIO C: Fallback via Appointment ID (Vínculo de Origem)
            // Útil para comandos gerados a partir da agenda que podem não ter herdado o command_id na transação
            const appointmentId = currentItems.find(i => i.appointment_id)?.appointment_id;
            if (appointmentId) {
                console.warn("[REPORT_AUDIT] Tentando fallback via Appointment ID:", appointmentId);
                const { data: txByApp } = await supabase
                    .from('financial_transactions')
                    .select('*')
                    .eq('appointment_id', appointmentId)
                    .maybeSingle();

                if (txByApp) {
                    console.log("[REPORT_FALLBACK_OK] Transação via appointment_id encontrada.");
                    setPayment({
                        amount: txByApp.amount,
                        net_value: txByApp.net_value || txByApp.amount,
                        fee_amount: (txByApp.amount - (txByApp.net_value || txByApp.amount)),
                        payment_method: txByApp.payment_method,
                        brand: txByApp.payment_method?.toUpperCase() || 'N/A',
                        financial_transaction_id: txByApp.id,
                        created_at: txByApp.date
                    });
                    setLoading(false);
                    return;
                }
            }

            // ESTÁGIO D: Fallback Final (Dados Nominais da Comanda)
            console.error("[REPORT_FAIL] Nenhum vínculo financeiro absoluto encontrado.");
            // Não bloqueamos, o componente renderizará com o aviso de dados parciais

        } catch (e: any) {
            console.error('[PAID_DETAIL_FATAL]', e);
            setError(e.message || "Falha crítica ao recuperar auditoria.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, [commandId]);

    const formatBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

    if (loading) return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center">
            <div className="bg-white p-10 rounded-[40px] flex flex-col items-center shadow-2xl">
                <div className="relative mb-6">
                    <Loader2 className="animate-spin text-orange-500 w-12 h-12" />
                    <div className="absolute inset-0 border-4 border-orange-100 rounded-full animate-ping opacity-20"></div>
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Rastreando Auditoria...</p>
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
            <div className="bg-white rounded-[48px] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-white/20 flex flex-col max-h-[90vh]">
                <header className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 flex-shrink-0">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3 uppercase tracking-tighter">
                            <Receipt className="text-emerald-500" size={28} />
                            Relatório de Venda
                        </h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Conferência Auditada Digitalmente</p>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-slate-200 rounded-full transition-colors text-slate-400"><X size={24} /></button>
                </header>

                <div className="flex-1 overflow-y-auto p-10 space-y-8 custom-scrollbar text-left">
                    
                    {error && (
                        <div className="p-5 bg-rose-50 border-2 border-rose-100 rounded-3xl flex items-center gap-4 text-rose-600 animate-in shake duration-500">
                            <AlertTriangle size={24} />
                            <p className="text-xs font-black uppercase tracking-tight">{error}</p>
                        </div>
                    )}

                    <div className="flex items-center gap-6">
                        <div className="w-20 h-20 rounded-[32px] bg-orange-100 text-orange-600 flex items-center justify-center font-black text-2xl overflow-hidden shadow-inner">
                            {command.clients?.photo_url ? <img src={command.clients.photo_url} className="w-full h-full object-cover" /> : displayClientName.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1">
                            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">{displayClientName}</h3>
                            <div className="flex flex-wrap gap-4 mt-1.5">
                                <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1.5">
                                    <Clock size={12} className="text-orange-500" /> 
                                    {command.closed_at ? format(new Date(command.closed_at), "dd/MM/yyyy HH:mm") : format(new Date(command.created_at), "dd/MM/yyyy HH:mm")}
                                </span>
                                <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
                                    <UserCheck size={12} className="text-orange-500" /> {professionalName}
                                </span>
                                <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100 uppercase tracking-widest">
                                    Liquidado
                                </span>
                            </div>
                        </div>
                    </div>

                    <Card title="Itens da Transação" icon={<ShoppingCart size={18} className="text-orange-500" />} className="rounded-[32px] border-slate-100">
                        <div className="divide-y divide-slate-50">
                            {items.map((item: any) => (
                                <div key={item.id} className="py-5 flex justify-between items-center group">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-3 rounded-2xl transition-colors ${item.product_id ? 'bg-purple-50 text-purple-600 group-hover:bg-purple-100' : 'bg-blue-50 text-blue-600 group-hover:bg-blue-100'}`}>
                                            {item.product_id ? <ShoppingBag size={20} /> : <Scissors size={20} />}
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-slate-700 leading-tight">{item.title}</p>
                                            <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase">
                                                {item.quantity} un <span className="mx-1">•</span> {formatBRL(Number(item.price))}
                                            </p>
                                        </div>
                                    </div>
                                    <span className="font-black text-slate-800 text-lg">{formatBRL(item.quantity * item.price)}</span>
                                </div>
                            ))}
                        </div>
                    </Card>

                    <div className="space-y-4">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                            <Landmark size={14} className="text-orange-500" /> Auditoria de Recebimento
                        </h4>
                        
                        {payment ? (
                            <div className="p-8 bg-slate-50 rounded-[40px] border-2 border-white shadow-inner space-y-6">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-4">
                                        <div className="p-4 bg-white rounded-3xl text-orange-500 shadow-sm border border-slate-100">
                                            <CreditCard size={24} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase leading-none mb-2">Forma de Ingresso</p>
                                            <p className="text-base font-black text-slate-800 uppercase tracking-tight">
                                                {payment.payment_methods_config?.name || payment.brand || payment.payment_method?.toUpperCase() || 'N/A'}
                                                {payment.installments > 1 && <span className="text-orange-600"> ({payment.installments}x)</span>}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-slate-400 uppercase leading-none mb-2">Valor Bruto</p>
                                        <p className="text-2xl font-black text-slate-800">{formatBRL(grossAmount)}</p>
                                    </div>
                                </div>
                                
                                {feeAmount > 0 && (
                                    <div className="pt-5 border-t border-slate-200/50 flex justify-between items-center">
                                        <span className="text-[10px] font-black text-rose-500 uppercase flex items-center gap-2">
                                            <Percent size={14} strokeWidth={3} /> Taxas Adquirente
                                        </span>
                                        <span className="text-base font-black text-rose-500">- {formatBRL(feeAmount)}</span>
                                    </div>
                                )}

                                <div className="flex justify-between items-center bg-emerald-500 text-white p-6 rounded-[32px] shadow-lg shadow-emerald-100 border-2 border-emerald-400">
                                    <span className="text-[11px] font-black uppercase tracking-widest">Saldo Líquido</span>
                                    <span className="text-2xl font-black">{formatBRL(netValue)}</span>
                                </div>
                                
                                {payment.financial_transaction_id && (
                                    <div className="mt-4 pt-4 border-t border-slate-200/50">
                                        <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] text-center flex items-center justify-center gap-2">
                                            <Hash size={12} /> Transação: {payment.financial_transaction_id}
                                        </p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="p-10 bg-amber-50 rounded-[48px] border-2 border-dashed border-amber-200 text-center animate-in fade-in duration-700">
                                <AlertTriangle className="mx-auto text-amber-500 mb-4" size={32} />
                                <h4 className="text-sm font-black text-amber-800 uppercase mb-2">Dados Parciais de Auditoria</h4>
                                <p className="text-[10px] font-bold text-amber-600/70 uppercase tracking-widest leading-relaxed max-w-sm mx-auto">
                                    O detalhamento de taxas deste registro não foi localizado.<br/>
                                    Valores baseados no fechamento nominal da comanda.
                                </p>
                                <div className="mt-6 pt-6 border-t border-amber-100 flex justify-between items-center px-4">
                                    <span className="text-[10px] font-black text-amber-800 uppercase">Valor Nominal</span>
                                    <span className="text-xl font-black text-amber-800">{formatBRL(command.total_amount)}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <footer className="p-10 bg-slate-50 border-t border-slate-100 flex-shrink-0">
                    <button onClick={onClose} className="w-full py-5 bg-slate-800 text-white font-black rounded-3xl shadow-2xl hover:bg-slate-900 transition-all active:scale-95 uppercase text-xs tracking-[0.2em]">Concluir Conferência</button>
                </footer>
            </div>
        </div>
    );
};

export default PaidCommandDetailView;
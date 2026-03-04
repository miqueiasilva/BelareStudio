
import React, { useState, useMemo, useEffect } from 'react';
import { 
    Archive, Lock, Unlock, ArrowUpCircle, ArrowDownCircle, 
    DollarSign, AlertTriangle, Calculator, Calendar, History,
    X, Receipt, User, ArrowRight, Loader2, FileDown, Filter
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { useStudio } from '../../contexts/StudioContext';
import { useAuth } from '../../contexts/AuthContext';
import Card from '../shared/Card';
import { 
    format, startOfDay, endOfDay, startOfWeek, endOfWeek, 
    startOfMonth, endOfMonth, startOfYear, endOfYear 
} from 'date-fns';
import { ptBR as pt } from 'date-fns/locale/pt-BR';
import Toast, { ToastType } from '../shared/Toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const StatCard = ({ title, value, icon: Icon, colorClass, textColor }: any) => (
    <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-md transition-all">
        <div>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">{title}</p>
            <p className={`text-xl font-black mt-1 ${textColor}`}>{value}</p>
        </div>
        <div className={`p-3 rounded-2xl ${colorClass} shadow-lg text-white`}>
            <Icon size={18} />
        </div>
    </div>
);

const ControledeCaixaView: React.FC = () => {
    const { activeStudioId } = useStudio();
    const { user } = useAuth();
    const [activeSession, setActiveSession] = useState<any>(null);
    const [sessionStatus, setSessionStatus] = useState<'aberto' | 'fechado'>('fechado');
    const [filterType, setFilterType] = useState<'day' | 'week' | 'month' | 'year'>('day');
    const [movements, setMovements] = useState<any[]>([]);
    const [cashMovements, setCashMovements] = useState<any[]>([]);
    const [sales, setSales] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    // Modals state
    const [showOpenModal, setShowOpenModal] = useState(false);
    const [showCloseModal, setShowCloseModal] = useState(false);
    const [showMovementModal, setShowMovementModal] = useState<{ type: 'sangria' | 'suprimento' } | null>(null);
    const [modalValue, setModalValue] = useState('');
    const [modalDesc, setModalDesc] = useState('');

    const fetchSession = async () => {
        if (!activeStudioId) return;
        try {
            const { data, error } = await supabase
                .from('cash_sessions')
                .select('*')
                .eq('studio_id', activeStudioId)
                .eq('status', 'aberto')
                .maybeSingle();
            
            if (error) throw error;
            
            if (data) {
                setActiveSession(data);
                setSessionStatus('aberto');
            } else {
                setActiveSession(null);
                setSessionStatus('fechado');
                setShowOpenModal(true);
            }
        } catch (e) {
            console.error("Erro ao buscar sessão de caixa:", e);
        }
    };

    const fetchData = async () => {
        if (!activeStudioId) return;
        setLoading(true);
        try {
            let startStr: string, endStr: string;

            if (activeSession && sessionStatus === 'aberto') {
                startStr = activeSession.data_abertura;
                endStr = new Date().toISOString();
            } else {
                const now = new Date();
                let start: Date, end: Date;

                switch (filterType) {
                    case 'week':
                        start = startOfWeek(now, { weekStartsOn: 1 });
                        end = endOfWeek(now, { weekStartsOn: 1 });
                        break;
                    case 'month':
                        start = startOfMonth(now);
                        end = endOfMonth(now);
                        break;
                    case 'year':
                        start = startOfYear(now);
                        end = endOfYear(now);
                        break;
                    default:
                        start = startOfDay(now);
                        end = endOfDay(now);
                }
                startStr = start.toISOString();
                endStr = end.toISOString();
            }

            // Busca transações financeiras do período
            const { data: trans, error } = await supabase
                .from('financial_transactions')
                .select('*, clients:client_id(nome)')
                .eq('studio_id', activeStudioId)
                .gte('created_at', startStr)
                .lte('created_at', endStr)
                .order('created_at', { ascending: false });
            
            if (error) throw error;

            // Busca movimentações de caixa (sangria/suprimento)
            let cashMovs: any[] = [];
            if (activeSession) {
                const { data: cm, error: cme } = await supabase
                    .from('cash_movements')
                    .select('*')
                    .eq('session_id', activeSession.id)
                    .order('created_at', { ascending: false });
                if (!cme) cashMovs = cm || [];
            }
            
            setMovements(trans || []);
            setCashMovements(cashMovs);
            setSales(trans?.filter(t => t.type === 'income') || []);

        } catch (e) {
            console.error("Erro ao buscar dados do caixa:", e);
            setToast({ message: "Erro ao sincronizar caixa", type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { 
        fetchSession();
    }, [activeStudioId]);

    useEffect(() => { 
        if (activeStudioId) fetchData(); 
    }, [activeStudioId, filterType, activeSession, sessionStatus]);

    const handleOpenCash = async () => {
        if (!activeStudioId || !user) return;
        const valor = parseFloat(modalValue.replace(',', '.'));
        if (isNaN(valor)) return setToast({ message: "Valor inválido", type: 'error' });

        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('cash_sessions')
                .insert([{
                    studio_id: activeStudioId,
                    responsavel_id: user.id,
                    data_abertura: new Date().toISOString(),
                    saldo_inicial: valor,
                    status: 'aberto'
                }])
                .select()
                .single();

            if (error) throw error;
            setActiveSession(data);
            setSessionStatus('aberto');
            setShowOpenModal(false);
            setModalValue('');
            setToast({ message: "Caixa aberto com sucesso!", type: 'success' });
        } catch (e) {
            console.error(e);
            setToast({ message: "Erro ao abrir caixa", type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleCloseCash = async () => {
        if (!activeSession) return;
        const valorFinal = parseFloat(modalValue.replace(',', '.'));
        if (isNaN(valorFinal)) return setToast({ message: "Valor inválido", type: 'error' });

        const esperado = (activeSession.saldo_inicial || 0) + totals.entradas - totals.saidas;
        const diferenca = valorFinal - esperado;

        setLoading(true);
        try {
            const { error } = await supabase
                .from('cash_sessions')
                .update({
                    data_fechamento: new Date().toISOString(),
                    saldo_final: valorFinal,
                    diferenca: diferenca,
                    status: 'fechado'
                })
                .eq('id', activeSession.id);

            if (error) throw error;
            setActiveSession(null);
            setSessionStatus('fechado');
            setShowCloseModal(false);
            setModalValue('');
            setToast({ message: "Caixa fechado com sucesso!", type: 'success' });
        } catch (e) {
            console.error(e);
            setToast({ message: "Erro ao fechar caixa", type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleAddMovement = async () => {
        if (!activeSession) return;
        const valor = parseFloat(modalValue.replace(',', '.'));
        if (isNaN(valor) || !modalDesc) return setToast({ message: "Dados inválidos", type: 'error' });

        setLoading(true);
        try {
            const { error } = await supabase
                .from('cash_movements')
                .insert([{
                    session_id: activeSession.id,
                    tipo: showMovementModal?.type,
                    valor: valor,
                    descricao: modalDesc,
                    studio_id: activeStudioId // assumindo que tem studio_id
                }]);

            if (error) throw error;
            
            // Também insere em financial_transactions para manter o histórico unificado se necessário
            // Mas o prompt pede especificamente cash_movements
            
            fetchData();
            setShowMovementModal(null);
            setModalValue('');
            setModalDesc('');
            setToast({ message: "Movimentação registrada!", type: 'success' });
        } catch (e) {
            console.error(e);
            setToast({ message: "Erro ao registrar movimentação", type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const exportToPDF = () => {
        if (movements.length === 0) {
            setToast({ message: "Não há dados para exportar", type: 'warning' });
            return;
        }

        setExporting(true);
        try {
            const doc = new jsPDF();
            const now = new Date();
            const dateStr = format(now, "dd/MM/yyyy HH:mm");
            
            // Título e Cabeçalho
            doc.setFontSize(18);
            doc.setTextColor(30, 41, 59); // slate-800
            doc.text("Extrato Financeiro - BelaStudio", 14, 20);
            
            doc.setFontSize(10);
            doc.setTextColor(100, 116, 139); // slate-500
            doc.text(`Período: ${filterType.toUpperCase()} | Gerado em: ${dateStr}`, 14, 28);

            // Resumo
            doc.setFontSize(12);
            doc.setTextColor(30, 41, 59);
            doc.text("Resumo do Período", 14, 40);
            
            autoTable(doc, {
                startY: 45,
                head: [['Total Entradas', 'Total Saídas', 'Saldo Final']],
                body: [[
                    `R$ ${totals.entradas.toFixed(2)}`,
                    `R$ ${totals.saidas.toFixed(2)}`,
                    `R$ ${totals.saldo.toFixed(2)}`
                ]],
                theme: 'grid',
                headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] }
            });

            // Detalhamento
            doc.text("Detalhamento das Transações", 14, (doc as any).lastAutoTable.finalY + 15);

            const tableData = movements.map(m => [
                format(new Date(m.date), "dd/MM/yy HH:mm"),
                m.description || (m.type === 'income' ? 'Venda' : 'Saída'),
                m.clients?.nome || '-',
                m.payment_method || '-',
                m.type === 'income' ? 'Entrada' : 'Saída',
                `R$ ${Number(m.type === 'income' ? (m.net_value || m.amount) : m.amount).toFixed(2)}`
            ]);

            autoTable(doc, {
                startY: (doc as any).lastAutoTable.finalY + 20,
                head: [['Data', 'Descrição', 'Cliente', 'Método', 'Tipo', 'Valor']],
                body: tableData,
                styles: { fontSize: 8 },
                headStyles: { fillColor: [71, 85, 105] }
            });

            doc.save(`extrato_caixa_${filterType}_${format(now, 'yyyyMMdd')}.pdf`);
            setToast({ message: "PDF gerado com sucesso!", type: 'success' });
        } catch (error) {
            console.error("Erro ao gerar PDF:", error);
            setToast({ message: "Falha ao gerar PDF", type: 'error' });
        } finally {
            setExporting(false);
        }
    };

    const totals = useMemo(() => {
        // Recebimentos: soma de net_value onde type = 'income' das financial_transactions
        const entradasVendas = movements
            .filter(m => m.type === 'income')
            .reduce((acc, m) => acc + Number(m.net_value || m.amount || 0), 0);
        
        // Suprimentos das cash_movements
        const suprimentos = cashMovements
            .filter(m => m.tipo === 'suprimento')
            .reduce((acc, m) => acc + Number(m.valor || 0), 0);

        // Sangrias das cash_movements
        const sangrias = cashMovements
            .filter(m => m.tipo === 'sangria')
            .reduce((acc, m) => acc + Number(m.valor || 0), 0);

        // Saídas das financial_transactions
        const saidasFinanceiras = movements
            .filter(m => m.type === 'expense')
            .reduce((acc, m) => acc + Number(m.amount || 0), 0);
            
        const totalEntradas = entradasVendas + suprimentos;
        const totalSaidas = sangrias + saidasFinanceiras;

        return { 
            entradas: totalEntradas, 
            saidas: totalSaidas, 
            saldo: totalEntradas - totalSaidas,
            vendas: entradasVendas,
            sangrias,
            suprimentos
        };
    }, [movements, cashMovements]);

    return (
        <div className="h-full flex flex-col bg-slate-50 font-sans text-left overflow-hidden">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4 z-30 shadow-sm flex-shrink-0">
                <div className="flex flex-col md:flex-row md:items-center gap-4 w-full md:w-auto">
                    <div>
                        <h1 className="text-xl font-black text-slate-800 flex items-center gap-2 uppercase tracking-tighter">
                            <Archive className="text-purple-500" /> Controle de Caixa
                        </h1>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">
                            <Calendar size={12}/>
                            <span>{format(new Date(), "dd 'de' MMMM, yyyy", { locale: pt })}</span>
                            <span className="text-slate-200">•</span>
                            <span className={`font-black ${sessionStatus === 'aberto' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {sessionStatus === 'aberto' ? 'CAIXA OPERANTE' : 'CAIXA ENCERRADO'}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center bg-slate-100 p-1 rounded-xl gap-1">
                        {[
                            { id: 'day', label: 'Hoje' },
                            { id: 'week', label: 'Semana' },
                            { id: 'month', label: 'Mês' },
                            { id: 'year', label: 'Ano' }
                        ].map((btn) => (
                            <button
                                key={btn.id}
                                onClick={() => setFilterType(btn.id as any)}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${filterType === btn.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                {btn.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    {sessionStatus === 'aberto' && (
                        <>
                            <button 
                                onClick={() => setShowMovementModal({ type: 'suprimento' })}
                                className="flex-1 md:flex-none bg-emerald-50 text-emerald-600 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-100 transition-all"
                            >
                                <ArrowUpCircle size={14} /> Suprimento
                            </button>
                            <button 
                                onClick={() => setShowMovementModal({ type: 'sangria' })}
                                className="flex-1 md:flex-none bg-rose-50 text-rose-600 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-rose-100 transition-all"
                            >
                                <ArrowDownCircle size={14} /> Sangria
                            </button>
                        </>
                    )}

                    <button 
                        onClick={exportToPDF}
                        disabled={exporting || loading}
                        className="flex-1 md:flex-none bg-white border border-slate-200 text-slate-600 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-50 transition-all disabled:opacity-50"
                    >
                        {exporting ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
                        Exportar PDF
                    </button>
                    
                    {sessionStatus === 'aberto' ? (
                        <button 
                            onClick={() => setShowCloseModal(true)}
                            className="flex-1 md:flex-none bg-slate-800 text-white px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-700 transition-all shadow-lg shadow-slate-200"
                        >
                            <Lock size={14} /> Fechar Caixa
                        </button>
                    ) : (
                        <button 
                            onClick={() => setShowOpenModal(true)}
                            className="flex-1 md:flex-none bg-emerald-600 text-white px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
                        >
                            <Unlock size={14} /> Abrir Caixa
                        </button>
                    )}
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard title="Total em Gaveta (Saldo)" value={`R$ ${(totals.saldo + (activeSession?.saldo_inicial || 0)).toFixed(2)}`} icon={Calculator} colorClass="bg-slate-800" textColor="text-slate-800" />
                    <StatCard title="Recebimentos" value={`+ R$ ${totals.entradas.toFixed(2)}`} icon={DollarSign} colorClass="bg-emerald-500" textColor="text-emerald-600" />
                    <StatCard title="Sangrias / Saídas" value={`- R$ ${totals.saidas.toFixed(2)}`} icon={ArrowDownCircle} colorClass="bg-rose-500" textColor="text-rose-600" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Lista Detalhada de Vendas para conferência da Maria/Zaneide */}
                    <Card title="Vendas do Turno (Conferência)" icon={<Receipt size={18} className="text-emerald-500" />}>
                        <div className="space-y-4 mt-2">
                            {loading ? (
                                <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-orange-500" /></div>
                            ) : sales.length === 0 ? (
                                <div className="py-20 text-center text-slate-400 italic font-bold text-[10px] uppercase">Sem vendas registradas hoje</div>
                            ) : (
                                sales.map((sale) => (
                                    <div key={sale.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between hover:border-emerald-300 transition-all group">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-emerald-500 transition-colors">
                                                <User size={20} />
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-700 text-sm uppercase tracking-tight">{sale.description || sale.clients?.nome || 'Venda'}</p>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                                    {format(new Date(sale.created_at || sale.date), 'HH:mm')} • {sale.payment_method}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-black text-slate-800 text-xs">Bruto: R$ {Number(sale.amount).toFixed(2)}</p>
                                            <p className="font-black text-emerald-600 text-sm">Líq: R$ {Number(sale.net_value || sale.amount).toFixed(2)}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </Card>

                    {/* Todos os movimentos (Suprimentos/Sangrias) */}
                    <Card title="Fluxo Analítico Completo" icon={<History size={18} className="text-orange-500" />}>
                        <div className="divide-y divide-slate-50">
                            {cashMovements.map((m) => (
                                <div key={m.id} className="py-3 flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-slate-700 truncate max-w-[200px]">{m.descricao}</span>
                                        <span className="text-[9px] text-slate-400 font-bold uppercase">{format(new Date(m.created_at), 'HH:mm')} • {m.tipo}</span>
                                    </div>
                                    <span className={`text-xs font-black ${m.tipo === 'suprimento' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                        {m.tipo === 'suprimento' ? '+' : '-'} R$ {Number(m.valor).toFixed(2)}
                                    </span>
                                </div>
                            ))}
                            {movements.map((m) => (
                                <div key={m.id} className="py-3 flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-slate-700 truncate max-w-[200px]">{m.description}</span>
                                        <span className="text-[9px] text-slate-400 font-bold uppercase">{format(new Date(m.created_at || m.date), 'HH:mm')}</span>
                                    </div>
                                    <span className={`text-xs font-black ${m.type === 'income' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                        {m.type === 'income' ? '+' : '-'} R$ {Number(m.type === 'income' ? (m.net_value || m.amount) : m.amount).toFixed(2)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            </div>

            {/* Modals */}
            {showOpenModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-8">
                            <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 mb-6">
                                <Unlock size={32} />
                            </div>
                            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Abrir Caixa</h2>
                            <p className="text-slate-500 text-sm mt-2">Informe o saldo inicial para começar o turno.</p>
                            
                            <div className="mt-8 space-y-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Saldo Inicial (R$)</label>
                                    <input 
                                        type="text"
                                        value={modalValue}
                                        onChange={(e) => setModalValue(e.target.value)}
                                        placeholder="0,00"
                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 mt-1 font-black text-slate-800 focus:border-emerald-500 focus:bg-white transition-all outline-none"
                                    />
                                </div>
                            </div>

                            <div className="mt-10 flex gap-3">
                                <button 
                                    onClick={() => setShowOpenModal(false)}
                                    className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px] tracking-widest hover:text-slate-600 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={handleOpenCash}
                                    disabled={loading}
                                    className="flex-[2] bg-emerald-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all disabled:opacity-50 uppercase text-[10px] tracking-widest"
                                >
                                    {loading ? 'Processando...' : 'Confirmar Abertura'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showCloseModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-8">
                            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-600 mb-6">
                                <Lock size={32} />
                            </div>
                            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Fechar Caixa</h2>
                            <p className="text-slate-500 text-sm mt-2">Confirme os valores finais do turno.</p>
                            
                            <div className="mt-8 p-6 bg-slate-50 rounded-3xl space-y-3">
                                <div className="flex justify-between text-xs font-bold text-slate-500">
                                    <span>Saldo Inicial:</span>
                                    <span className="text-slate-800">R$ {activeSession?.saldo_inicial?.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-xs font-bold text-slate-500">
                                    <span>Recebimentos (+):</span>
                                    <span className="text-emerald-600">R$ {totals.entradas.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-xs font-bold text-slate-500">
                                    <span>Saídas (-):</span>
                                    <span className="text-rose-600">R$ {totals.saidas.toFixed(2)}</span>
                                </div>
                                <div className="pt-3 border-t border-slate-200 flex justify-between text-sm font-black text-slate-800">
                                    <span>Saldo Esperado:</span>
                                    <span>R$ {(totals.saldo + (activeSession?.saldo_inicial || 0)).toFixed(2)}</span>
                                </div>
                            </div>

                            <div className="mt-8 space-y-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Saldo Final em Gaveta (R$)</label>
                                    <input 
                                        type="text"
                                        value={modalValue}
                                        onChange={(e) => setModalValue(e.target.value)}
                                        placeholder="0,00"
                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 mt-1 font-black text-slate-800 focus:border-slate-800 focus:bg-white transition-all outline-none"
                                    />
                                </div>
                            </div>

                            <div className="mt-10 flex gap-3">
                                <button 
                                    onClick={() => setShowCloseModal(false)}
                                    className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px] tracking-widest hover:text-slate-600 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={handleCloseCash}
                                    disabled={loading}
                                    className="flex-[2] bg-slate-800 text-white font-black py-4 rounded-2xl shadow-lg shadow-slate-200 hover:bg-slate-700 transition-all disabled:opacity-50 uppercase text-[10px] tracking-widest"
                                >
                                    {loading ? 'Processando...' : 'Encerrar Turno'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showMovementModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-8">
                            <div className={`w-16 h-16 ${showMovementModal.type === 'suprimento' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'} rounded-2xl flex items-center justify-center mb-6`}>
                                {showMovementModal.type === 'suprimento' ? <ArrowUpCircle size={32} /> : <ArrowDownCircle size={32} />}
                            </div>
                            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">
                                {showMovementModal.type === 'suprimento' ? 'Registrar Suprimento' : 'Registrar Sangria'}
                            </h2>
                            
                            <div className="mt-8 space-y-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Valor (R$)</label>
                                    <input 
                                        type="text"
                                        value={modalValue}
                                        onChange={(e) => setModalValue(e.target.value)}
                                        placeholder="0,00"
                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 mt-1 font-black text-slate-800 focus:border-slate-800 focus:bg-white transition-all outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descrição / Motivo</label>
                                    <input 
                                        type="text"
                                        value={modalDesc}
                                        onChange={(e) => setModalDesc(e.target.value)}
                                        placeholder="Ex: Troco inicial, Pagamento fornecedor..."
                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 mt-1 font-black text-slate-800 focus:border-slate-800 focus:bg-white transition-all outline-none"
                                    />
                                </div>
                            </div>

                            <div className="mt-10 flex gap-3">
                                <button 
                                    onClick={() => setShowMovementModal(null)}
                                    className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px] tracking-widest hover:text-slate-600 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={handleAddMovement}
                                    disabled={loading}
                                    className={`flex-[2] ${showMovementModal.type === 'suprimento' ? 'bg-emerald-600 shadow-emerald-200' : 'bg-rose-600 shadow-rose-200'} text-white font-black py-4 rounded-2xl shadow-lg hover:opacity-90 transition-all disabled:opacity-50 uppercase text-[10px] tracking-widest`}
                                >
                                    {loading ? 'Processando...' : 'Confirmar'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ControledeCaixaView;

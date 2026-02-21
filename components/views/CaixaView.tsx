
import React, { useState, useMemo, useEffect } from 'react';
import { 
    Archive, Lock, Unlock, ArrowUpCircle, ArrowDownCircle, 
    DollarSign, AlertTriangle, Calculator, Calendar, History,
    X, Receipt, User, ArrowRight, Loader2, FileDown, Filter
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { useStudio } from '../../contexts/StudioContext';
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

const CaixaView: React.FC = () => {
    const { activeStudioId } = useStudio();
    const [sessionStatus, setSessionStatus] = useState<'aberto' | 'fechado'>('aberto');
    const [filterType, setFilterType] = useState<'day' | 'week' | 'month' | 'year'>('day');
    const [movements, setMovements] = useState<any[]>([]);
    const [sales, setSales] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    const fetchData = async () => {
        if (!activeStudioId) return;
        setLoading(true);
        try {
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

            const startStr = start.toISOString();
            const endStr = end.toISOString();

            // Busca transações financeiras do período
            const { data: trans, error } = await supabase
                .from('financial_transactions')
                .select('*, clients:client_id(nome)')
                .eq('studio_id', activeStudioId)
                .gte('date', startStr)
                .lte('date', endStr)
                .order('date', { ascending: false });
            
            if (error) throw error;
            
            setMovements(trans || []);
            // Filtra apenas vendas para conferência de liquidação (Maria/Zaneide)
            setSales(trans?.filter(t => t.type === 'income' || t.type === 'receita') || []);

        } catch (e) {
            console.error("Erro ao buscar dados do caixa:", e);
            setToast({ message: "Erro ao sincronizar caixa", type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [activeStudioId, filterType]);

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
                m.description || (m.type === 'income' ? 'Venda/Receita' : 'Despesa/Saída'),
                m.clients?.nome || '-',
                m.payment_method || '-',
                m.type === 'income' || m.type === 'receita' ? 'Entrada' : 'Saída',
                `R$ ${Number(m.amount).toFixed(2)}`
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
        const entradas = movements.filter(m => m.type === 'income' || m.type === 'receita').reduce((acc, m) => acc + Number(m.amount), 0);
        const saidas = movements.filter(m => m.type === 'expense' || m.type === 'despesa').reduce((acc, m) => acc + Number(m.amount), 0);
        return { entradas, saidas, saldo: entradas - saidas };
    }, [movements]);

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
                    <button 
                        onClick={exportToPDF}
                        disabled={exporting || loading}
                        className="flex-1 md:flex-none bg-white border border-slate-200 text-slate-600 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-50 transition-all disabled:opacity-50"
                    >
                        {exporting ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
                        Exportar PDF
                    </button>
                    
                    <button className="flex-1 md:flex-none bg-slate-800 text-white px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-700 transition-all shadow-lg shadow-slate-200">
                        <Lock size={14} /> Fechar Caixa
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard title="Total em Gaveta (Saldo)" value={`R$ ${totals.saldo.toFixed(2)}`} icon={Calculator} colorClass="bg-slate-800" textColor="text-slate-800" />
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
                                                <p className="font-black text-slate-700 text-sm uppercase tracking-tight">{sale.clients?.nome || 'Consumidor Final'}</p>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{format(new Date(sale.date), 'HH:mm')} • {sale.payment_method}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-black text-slate-800">R$ {Number(sale.amount).toFixed(2)}</p>
                                            <span className="text-[8px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-black uppercase">Liquidado</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </Card>

                    {/* Todos os movimentos (Suprimentos/Sangrias) */}
                    <Card title="Fluxo Analítico Completo" icon={<History size={18} className="text-orange-500" />}>
                        <div className="divide-y divide-slate-50">
                            {movements.map((m) => (
                                <div key={m.id} className="py-3 flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-slate-700 truncate max-w-[200px]">{m.description}</span>
                                        <span className="text-[9px] text-slate-400 font-bold uppercase">{format(new Date(m.date), 'HH:mm')}</span>
                                    </div>
                                    <span className={`text-xs font-black ${m.type === 'income' || m.type === 'receita' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                        {m.type === 'income' || m.type === 'receita' ? '+' : '-'} R$ {Number(m.amount).toFixed(2)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default CaixaView;

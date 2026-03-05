
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
    FileDown, Calendar, TrendingUp, TrendingDown, 
    DollarSign, Percent, Loader2, ChevronLeft, ChevronRight,
    Landmark, Receipt, ArrowUpCircle, ArrowDownCircle
} from 'lucide-react';
import { 
    format, startOfMonth, endOfMonth, parseISO, 
    addMonths, subMonths 
} from 'date-fns';
import { ptBR as pt } from 'date-fns/locale/pt-BR';
import { supabase } from '../../services/supabaseClient';
import { useStudio } from '../../contexts/StudioContext';
import toast from 'react-hot-toast';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const formatBRL = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const DREReport: React.FC = () => {
    const { activeStudioId } = useStudio();
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [loading, setLoading] = useState(true);
    const [transactions, setTransactions] = useState<any[]>([]);

    const fetchData = useCallback(async () => {
        if (!activeStudioId) return;
        setLoading(true);
        try {
            const start = startOfMonth(selectedDate);
            const end = endOfMonth(selectedDate);

            const { data, error } = await supabase
                .from('financial_transactions')
                .select('*')
                .eq('studio_id', activeStudioId)
                .gte('date', start.toISOString())
                .lte('date', end.toISOString())
                .neq('status', 'cancelado');

            if (error) throw error;
            setTransactions(data || []);
        } catch (error) {
            console.error("Erro ao buscar dados da DRE:", error);
            toast.error("Erro ao carregar DRE.");
        } finally {
            setLoading(false);
        }
    }, [activeStudioId, selectedDate]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const dreData = useMemo(() => {
        const incomeTrans = transactions.filter(t => t.type === 'income' || t.type === 'receita');
        const expenseTrans = transactions.filter(t => t.type === 'expense' || t.type === 'despesa');

        const grossRevenue = incomeTrans.reduce((acc, t) => acc + Number(t.amount || 0), 0);
        const taxes = incomeTrans.reduce((acc, t) => {
            if (t.net_value !== null && t.net_value !== undefined) {
                return acc + (Number(t.amount || 0) - Number(t.net_value || 0));
            }
            return acc;
        }, 0);
        
        const netRevenue = incomeTrans.reduce((acc, t) => {
            return acc + Number(t.net_value !== null && t.net_value !== undefined ? t.net_value : (t.amount || 0));
        }, 0);

        const expensesByCategory: { [key: string]: number } = {};
        expenseTrans.forEach(t => {
            const cat = t.category || 'Outras';
            expensesByCategory[cat] = (expensesByCategory[cat] || 0) + Number(t.amount || 0);
        });

        const totalExpenses = expenseTrans.reduce((acc, t) => acc + Number(t.amount || 0), 0);
        const result = netRevenue - totalExpenses;
        const margin = grossRevenue > 0 ? (result / grossRevenue) * 100 : 0;

        return {
            grossRevenue,
            taxes,
            netRevenue,
            expensesByCategory,
            totalExpenses,
            result,
            margin
        };
    }, [transactions]);

    const handleExportPDF = () => {
        const doc = new jsPDF();
        const monthYear = format(selectedDate, 'MMMM / yyyy', { locale: pt });
        
        doc.setFontSize(18);
        doc.text("DRE Gerencial", 14, 22);
        doc.setFontSize(12);
        doc.text(`Período: ${monthYear}`, 14, 30);

        const tableData = [
            ['(+) RECEITA BRUTA DE SERVIÇOS E PRODUTOS', formatBRL(dreData.grossRevenue)],
            ['(-) TAXAS DE CARTÃO/MAQUININHA', formatBRL(dreData.taxes)],
            ['(=) RECEITA LÍQUIDA', formatBRL(dreData.netRevenue)],
            ['', ''],
            ['(-) DESPESAS OPERACIONAIS', ''],
            ...Object.entries(dreData.expensesByCategory).map(([cat, val]) => [`    ${cat}`, formatBRL(val)]),
            ['(=) TOTAL DESPESAS', formatBRL(dreData.totalExpenses)],
            ['', ''],
            ['(=) RESULTADO OPERACIONAL (EBITDA)', formatBRL(dreData.result)],
            ['(%) MARGEM LÍQUIDA', `${dreData.margin.toFixed(2)}%`]
        ];

        autoTable(doc, {
            startY: 40,
            head: [['Descrição', 'Valor']],
            body: tableData,
            theme: 'grid',
            headStyles: { fill: [30, 41, 59] },
            didParseCell: (data) => {
                if (data.row.index === 0 || data.row.index === 2 || data.row.index === 8) {
                    data.cell.styles.fontStyle = 'bold';
                    if (data.row.index === 8) {
                        data.cell.styles.fontSize = 14;
                    }
                }
            }
        });

        doc.save(`DRE_${format(selectedDate, 'MM_yyyy')}.pdf`);
    };

    const DRERow = ({ label, value, isSubtotal = false, isNegative = false, isPercentage = false }: any) => (
        <div className={`flex justify-between items-center py-4 px-6 ${isSubtotal ? 'bg-slate-800 text-white rounded-xl my-2 shadow-md' : 'border-b border-slate-50'}`}>
            <span className={`text-[11px] font-black uppercase tracking-widest ${isSubtotal ? 'text-slate-300' : 'text-slate-500'}`}>
                {label}
            </span>
            <span className={`text-sm font-black ${isSubtotal ? 'text-white' : (isNegative ? 'text-rose-500' : (value > 0 ? 'text-emerald-500' : 'text-slate-700'))}`}>
                {isPercentage ? `${value.toFixed(2)}%` : formatBRL(value)}
            </span>
        </div>
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-wrap items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => setSelectedDate(subMonths(selectedDate, 1))}
                        className="p-2 hover:bg-slate-100 rounded-xl transition-all"
                    >
                        <ChevronLeft size={20} className="text-slate-400" />
                    </button>
                    <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 rounded-2xl border border-slate-100">
                        <Calendar size={18} className="text-orange-500" />
                        <span className="text-sm font-black text-slate-700 uppercase tracking-tighter">
                            {format(selectedDate, 'MMMM yyyy', { locale: pt })}
                        </span>
                    </div>
                    <button 
                        onClick={() => setSelectedDate(addMonths(selectedDate, 1))}
                        className="p-2 hover:bg-slate-100 rounded-xl transition-all"
                    >
                        <ChevronRight size={20} className="text-slate-400" />
                    </button>
                </div>

                <div className="flex items-center gap-3">
                    <button 
                        onClick={handleExportPDF}
                        className="flex items-center gap-2 px-6 py-3 bg-slate-800 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-slate-900 transition-all active:scale-95"
                    >
                        <FileDown size={16} />
                        Exportar PDF
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[40px] border border-slate-100 shadow-sm">
                    <Loader2 className="animate-spin text-orange-500 mb-4" size={40} />
                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Processando DRE...</p>
                </div>
            ) : (
                <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
                    <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                        <div className="flex items-center gap-3">
                            <Landmark className="text-orange-500" size={24} />
                            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter">DRE Gerencial</h3>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Resultado do Mês</p>
                            <p className={`text-2xl font-black ${dreData.result >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {formatBRL(dreData.result)}
                            </p>
                        </div>
                    </div>

                    <div className="p-4">
                        <DRERow label="(+) RECEITA BRUTA DE SERVIÇOS E PRODUTOS" value={dreData.grossRevenue} />
                        <DRERow label="(-) TAXAS DE CARTÃO/MAQUININHA" value={dreData.taxes} isNegative />
                        <DRERow label="(=) RECEITA LÍQUIDA" value={dreData.netRevenue} isSubtotal />

                        <div className="mt-6 mb-2 px-6">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <TrendingDown size={14} className="text-rose-500" />
                                (-) DESPESAS OPERACIONAIS
                            </h4>
                        </div>

                        {Object.entries(dreData.expensesByCategory).length > 0 ? (
                            Object.entries(dreData.expensesByCategory).map(([cat, val]) => (
                                <DRERow key={cat} label={cat} value={val} isNegative />
                            ))
                        ) : (
                            <div className="px-6 py-4 text-xs font-bold text-slate-400 italic">Nenhuma despesa registrada.</div>
                        )}

                        <DRERow label="(=) TOTAL DESPESAS" value={dreData.totalExpenses} isNegative />
                        
                        <div className="mt-4">
                            <DRERow label="(=) RESULTADO OPERACIONAL (EBITDA)" value={dreData.result} isSubtotal />
                            <DRERow label="(%) MARGEM LÍQUIDA" value={dreData.margin} isPercentage />
                        </div>
                    </div>

                    <div className="p-8 bg-slate-50 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex items-center gap-4">
                            <div className={`p-4 rounded-2xl ${dreData.result >= 0 ? 'bg-emerald-500' : 'bg-rose-500'} text-white shadow-lg`}>
                                {dreData.result >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lucratividade Final</p>
                                <h4 className={`text-3xl font-black ${dreData.result >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {dreData.margin.toFixed(1)}%
                                </h4>
                            </div>
                        </div>
                        <div className="text-center md:text-right max-w-xs">
                            <p className="text-[10px] font-bold text-slate-400 uppercase leading-relaxed">
                                Este relatório reflete a performance operacional baseada nos lançamentos confirmados do período.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DREReport;


import React, { useState, useMemo, useEffect } from 'react';
import { 
    BarChart3, TrendingUp, TrendingDown, DollarSign, Calendar, 
    ChevronLeft, ChevronRight, FileSpreadsheet, FileText,
    Users, Scissors, Wallet, ArrowRight, Loader2, 
    AlertTriangle, FilePieChart, Table, CheckCircle2,
    BarChart, PieChart as PieChartIcon, Search, Printer
} from 'lucide-react';
import { format, addMonths, isSameMonth, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { ptBR as pt } from 'date-fns/locale/pt-BR';
import Card from '../shared/Card';
import SafePie from '../charts/SafePie';
import SafeBar from '../charts/SafeBar';
import { mockTransactions, initialAppointments, professionals } from '../../data/mockData';
import { supabase } from '../../services/supabaseClient';

// Bibliotecas de Exportação
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

type TabType = 'overview' | 'export';

interface ReportColumn {
    header: string;
    key: string;
    type: 'text' | 'currency' | 'date' | 'number';
    format?: (v: any) => string;
}

interface ReportDefinition {
    id: string;
    title: string;
    description: string;
    icon: any;
    color: string;
    bg: string;
    table: string; 
    columns: ReportColumn[];
    showTotal?: boolean;
}

const reportsRegistry: ReportDefinition[] = [
    { 
        id: 'financeiro', 
        title: 'Fluxo de Caixa Detalhado', 
        description: 'Extrato completo para contabilidade com todas as entradas e saídas.', 
        icon: DollarSign, 
        color: 'text-emerald-600', 
        bg: 'bg-emerald-50', 
        table: 'financial_transactions',
        showTotal: true,
        columns: [
            { header: 'Data', key: 'date', type: 'date', format: (v) => format(parseISO(v), 'dd/MM/yyyy HH:mm') },
            { header: 'Descrição', key: 'description', type: 'text' },
            { header: 'Categoria', key: 'category', type: 'text' },
            { header: 'Método', key: 'payment_method', type: 'text' },
            { header: 'Valor (R$)', key: 'amount', type: 'currency', format: (v) => Number(v).toFixed(2) }
        ]
    },
    { 
        id: 'comissoes', 
        title: 'Mapa de Comissões', 
        description: 'Cálculo de repasse e base de faturamento por profissional.', 
        icon: Wallet, 
        color: 'text-orange-600', 
        bg: 'bg-orange-50', 
        table: 'financial_transactions',
        showTotal: true,
        columns: [
            { header: 'Data', key: 'date', type: 'date', format: (v) => format(parseISO(v), 'dd/MM/yyyy') },
            { header: 'Profissional', key: 'professional_name', type: 'text' },
            { header: 'Serviço/Produto', key: 'description', type: 'text' },
            { header: 'Base Cálculo', key: 'net_value', type: 'currency', format: (v) => Number(v).toFixed(2) },
            { header: 'Taxa (%)', key: 'tax_rate', type: 'number', format: (v) => `${v}%` },
            { header: 'Comissão', key: 'amount', type: 'currency', format: (v) => Number(v).toFixed(2) }
        ]
    },
    { 
        id: 'agenda', 
        title: 'Histórico de Atendimentos', 
        description: 'Relatório de ocupação, taxas de cancelamento e no-show.', 
        icon: Calendar, 
        color: 'text-blue-600', 
        bg: 'bg-blue-50', 
        table: 'appointments',
        columns: [
            { header: 'Horário', key: 'date', type: 'date', format: (v) => format(parseISO(v), 'dd/MM/yyyy HH:mm') },
            { header: 'Cliente', key: 'client_name', type: 'text' },
            { header: 'Serviço', key: 'service_name', type: 'text' },
            { header: 'Profissional', key: 'professional_name', type: 'text' },
            { header: 'Status', key: 'status', type: 'text' }
        ]
    },
    { 
        id: 'clientes', 
        title: 'Relatório de Clientes', 
        description: 'Dados cadastrais, frequência de visitas e mailing list.', 
        icon: Users, 
        color: 'text-purple-600', 
        bg: 'bg-purple-50', 
        table: 'clients',
        columns: [
            { header: 'Nome', key: 'nome', type: 'text' },
            { header: 'WhatsApp', key: 'whatsapp', type: 'text' },
            { header: 'E-mail', key: 'email', type: 'text' },
            { header: 'Origem', key: 'referral_source', type: 'text' },
            { header: 'Última Visita', key: 'created_at', type: 'date', format: (v) => format(parseISO(v), 'dd/MM/yyyy') }
        ]
    }
];

const RelatoriosView: React.FC = () => {
    // --- Safe Hydration Check ---
    const [isMounted, setIsMounted] = useState(false);
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedReport, setSelectedReport] = useState<ReportDefinition | null>(null);
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Navegação Mensal
    const handlePrevMonth = () => setCurrentDate(prev => addMonths(prev, -1));
    const handleNextMonth = () => setCurrentDate(prev => addMonths(prev, 1));

    // Dashboard Stats (Mocks do período)
    const stats = useMemo(() => {
        const income = mockTransactions
            .filter(t => t.type === 'receita' && isSameMonth(new Date(t.date), currentDate))
            .reduce((sum, t) => sum + t.amount, 0);
        const expense = mockTransactions
            .filter(t => t.type === 'despesa' && isSameMonth(new Date(t.date), currentDate))
            .reduce((sum, t) => sum + t.amount, 0);
        return { income, expense, profit: income - expense };
    }, [currentDate]);

    // Busca de dados com prévia
    const handleSelectReport = async (report: ReportDefinition) => {
        setIsLoading(true);
        setSelectedReport(report);
        
        try {
            const start = startOfMonth(currentDate).toISOString();
            const end = endOfMonth(currentDate).toISOString();

            let query = supabase.from(report.table).select('*');

            if (report.table !== 'clients') {
                query = query.gte('date', start).lte('date', end).order('date');
            } else {
                query = query.order('nome');
            }

            const { data, error } = await query;
            if (error) throw error;
            setPreviewData(data || []);
        } catch (e: any) {
            console.error("Erro ao carregar relatório:", e.message);
            setPreviewData([]);
        } finally {
            setIsLoading(false);
        }
    };

    const previewTotals = useMemo(() => {
        if (!selectedReport?.showTotal || !previewData.length) return null;
        
        return selectedReport.columns.reduce((acc, col) => {
            if (col.type === 'currency' || col.type === 'number') {
                acc[col.key] = previewData.reduce((sum, row) => sum + (Number(row[col.key]) || 0), 0);
            }
            return acc;
        }, {} as any);
    }, [previewData, selectedReport]);

    const exportToExcel = () => {
        if (!previewData.length || !selectedReport) return;
        setIsExporting(true);
        try {
            const exportRows = previewData.map(row => {
                const entry: any = {};
                selectedReport.columns.forEach(col => {
                    const val = row[col.key];
                    entry[col.header] = col.format ? col.format(val) : val;
                });
                return entry;
            });
            const ws = XLSX.utils.json_to_sheet(exportRows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Relatório");
            XLSX.writeFile(wb, `BelareStudio_${selectedReport.id}_${format(currentDate, 'MM_yyyy')}.xlsx`);
        } finally {
            setIsExporting(false);
        }
    };

    const exportToPDF = () => {
        if (!previewData.length || !selectedReport) return;
        setIsExporting(true);
        try {
            const doc = new jsPDF('landscape');
            doc.setFontSize(20);
            doc.setTextColor(30, 41, 59);
            doc.text("BELARESTUDIO", 14, 15);
            doc.setFontSize(11);
            doc.setTextColor(100);
            doc.text(`RELATÓRIO: ${selectedReport.title.toUpperCase()}`, 14, 22);
            doc.text(`COMPETÊNCIA: ${format(currentDate, 'MMMM yyyy', { locale: pt }).toUpperCase()}`, 14, 27);
            doc.text(`GERADO EM: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 32);

            const headers = [selectedReport.columns.map(c => c.header)];
            const body = previewData.map(row => 
                selectedReport.columns.map(col => col.format ? col.format(row[col.key]) : String(row[col.key] ?? ''))
            );

            if (previewTotals) {
                const totalRow = selectedReport.columns.map(col => {
                    if (previewTotals[col.key] !== undefined) {
                        return col.type === 'currency' ? `R$ ${previewTotals[col.key].toFixed(2)}` : String(previewTotals[col.key]);
                    }
                    return col.key === selectedReport.columns[0].key ? 'TOTAIS' : '';
                });
                body.push(totalRow);
            }

            autoTable(doc, {
                startY: 40,
                head: headers,
                body: body,
                theme: 'striped',
                headStyles: { fillColor: [249, 115, 22], textColor: 255 },
                styles: { fontSize: 8, cellPadding: 2.5 },
                alternateRowStyles: { fillColor: [250, 250, 250] }
            });
            doc.save(`Relatorio_${selectedReport.id}_${format(currentDate, 'MM_yyyy')}.pdf`);
        } finally {
            setIsExporting(false);
        }
    };

    // --- Hydration Safety Check ---
    if (!isMounted) return null;

    return (
        <div className="h-full flex flex-col bg-slate-50 overflow-hidden font-sans text-left">
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4 z-30 shadow-sm flex-shrink-0">
                <div className="flex flex-col md:flex-row items-center gap-6">
                    <h1 className="text-xl md:text-2xl font-black text-slate-800 flex items-center gap-2">
                        <BarChart3 className="text-orange-500" size={28} />
                        Inteligência de Negócio
                    </h1>
                    
                    <div className="flex items-center bg-slate-100 rounded-xl border border-slate-200 p-1">
                        <button onClick={handlePrevMonth} className="p-1.5 hover:bg-white rounded-lg text-slate-400 transition-all">
                            <ChevronLeft size={18}/>
                        </button>
                        <div className="text-[10px] font-black text-slate-600 uppercase tracking-widest min-w-[140px] text-center px-4">
                            {format(currentDate, 'MMMM yyyy', { locale: pt })}
                        </div>
                        <button onClick={handleNextMonth} className="p-1.5 hover:bg-white rounded-lg text-slate-400 transition-all">
                            <ChevronRight size={18}/>
                        </button>
                    </div>
                </div>

                <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
                    <button 
                        onClick={() => { setActiveTab('overview'); setSelectedReport(null); }}
                        className={`flex items-center gap-2 px-6 py-2 text-[10px] font-black uppercase tracking-tighter rounded-xl transition-all ${activeTab === 'overview' ? 'bg-white shadow-md text-orange-600' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                        <FilePieChart size={14} /> Visão Geral
                    </button>
                    <button 
                        onClick={() => setActiveTab('export')}
                        className={`flex items-center gap-2 px-6 py-2 text-[10px] font-black uppercase tracking-tighter rounded-xl transition-all ${activeTab === 'export' ? 'bg-white shadow-md text-orange-600' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                        <Table size={14} /> Exportação & Listas
                    </button>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
                <div className="max-w-7xl mx-auto space-y-8 pb-20">
                    
                    {activeTab === 'overview' && (
                        <div className="space-y-8 animate-in fade-in duration-500">
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="bg-white p-5 border-l-4 border-l-emerald-500 rounded-2xl shadow-sm">
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Receita Líquida</div>
                                    <div className="text-xl font-black text-slate-800">R$ {stats.income.toLocaleString('pt-BR')}</div>
                                </div>
                                <div className="bg-white p-5 border-l-4 border-l-rose-500 rounded-2xl shadow-sm">
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Custos Fixos/Var.</div>
                                    <div className="text-xl font-black text-slate-800">R$ {stats.expense.toLocaleString('pt-BR')}</div>
                                </div>
                                <div className="bg-white p-5 border-l-4 border-l-blue-500 rounded-2xl shadow-sm">
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Lucro Real</div>
                                    <div className="text-xl font-black text-slate-800">R$ {stats.profit.toLocaleString('pt-BR')}</div>
                                </div>
                                <div className="bg-white p-5 border-l-4 border-l-orange-500 rounded-2xl shadow-sm">
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Margem Líquida</div>
                                    <div className="text-xl font-black text-slate-800">{stats.income > 0 ? ((stats.profit / stats.income) * 100).toFixed(1) : 0}%</div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                <Card title="Faturamento por Categoria" className="lg:col-span-1 rounded-[32px] shadow-sm">
                                    <div className="h-64 mt-4">
                                        <SafePie 
                                            data={[
                                                { name: 'Cílios', receita: 4500 },
                                                { name: 'Sobrancelhas', receita: 3200 },
                                                { name: 'Estética', receita: 1800 },
                                                { name: 'Produtos', receita: 950 }
                                            ]}
                                            colors={['#f97316', '#3b82f6', '#8b5cf6', '#10b981']}
                                        />
                                    </div>
                                </Card>
                                <Card title="Desempenho Semanal" className="lg:col-span-2 rounded-[32px] shadow-sm">
                                    <div className="h-64 mt-4">
                                        <SafeBar 
                                            data={professionals.map(p => ({
                                                name: p.name.split(' ')[0],
                                                minutosOcupados: 480,
                                                ocupacao: Math.floor(Math.random() * 40) + 50
                                            }))}
                                            color="#f97316"
                                        />
                                    </div>
                                </Card>
                            </div>
                        </div>
                    )}

                    {activeTab === 'export' && !selectedReport && (
                        <div className="space-y-6 animate-in slide-in-from-bottom-6 duration-500">
                            <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Selecione um relatório contábil</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                {reportsRegistry.map((report) => (
                                    <div
                                        key={report.id}
                                        onClick={() => handleSelectReport(report)}
                                        className="bg-white p-6 rounded-[32px] border-2 border-slate-100 hover:border-orange-500 hover:shadow-2xl transition-all text-left group flex flex-col h-full cursor-pointer active:scale-95"
                                        role="button"
                                        tabIndex={0}
                                    >
                                        <div className={`w-14 h-14 rounded-2xl ${report.bg} ${report.color} flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 transition-transform`}>
                                            <report.icon size={28} />
                                        </div>
                                        <h3 className="font-black text-slate-800 text-lg leading-tight mb-2 group-hover:text-orange-600 transition-colors">
                                            {report.title}
                                        </h3>
                                        <div className="text-[11px] text-slate-400 font-medium leading-relaxed mb-8 flex-1">
                                            {report.description}
                                        </div>
                                        <div className="mt-auto flex items-center justify-between text-orange-500 font-black text-[10px] uppercase tracking-widest">
                                            <span>Visualizar Dados</span>
                                            <ArrowRight size={16} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {selectedReport && (
                        <div className="space-y-6 animate-in zoom-in-95 duration-300">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
                                <div className="flex items-center gap-4">
                                    <button 
                                        onClick={() => setSelectedReport(null)}
                                        className="p-3 bg-slate-100 text-slate-500 rounded-2xl hover:bg-slate-200 transition-all"
                                    >
                                        <ChevronLeft size={20} />
                                    </button>
                                    <div>
                                        <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase leading-none">{selectedReport.title}</h2>
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{previewData.length} registros sincronizados</div>
                                    </div>
                                </div>
                                
                                <div className="flex gap-2 w-full sm:w-auto">
                                    <button 
                                        onClick={exportToExcel}
                                        disabled={isExporting}
                                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3.5 bg-emerald-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        <FileSpreadsheet size={18} /> Excel
                                    </button>
                                    <button 
                                        onClick={exportToPDF}
                                        disabled={isExporting}
                                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3.5 bg-slate-800 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-slate-900 shadow-lg shadow-slate-200 transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        <FileText size={18} /> Gerar PDF
                                    </button>
                                </div>
                            </div>

                            <div className="bg-white rounded-[40px] border border-slate-200 shadow-xl overflow-hidden min-h-[400px] flex flex-col">
                                {isLoading ? (
                                    <div className="py-32 flex flex-col items-center justify-center text-slate-400">
                                        <Loader2 className="animate-spin text-orange-500 mb-4" size={48} strokeWidth={3} />
                                        <div className="font-black uppercase tracking-widest text-[10px]">Lendo base de dados...</div>
                                    </div>
                                ) : previewData.length === 0 ? (
                                    <div className="py-32 text-center">
                                        <AlertTriangle size={64} className="text-slate-100 mx-auto mb-4" />
                                        <div className="text-slate-400 font-black uppercase tracking-widest text-xs">Sem dados para este período.</div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="overflow-x-auto flex-1 custom-scrollbar">
                                            <table className="w-full text-left border-collapse">
                                                <thead className="sticky top-0 bg-slate-900 text-white z-20">
                                                    <tr>
                                                        {selectedReport.columns.map(col => (
                                                            <th key={col.key} className="px-6 py-5 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
                                                                {col.header}
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {previewData.map((row, i) => (
                                                        <tr key={i} className="hover:bg-orange-50/20 transition-colors">
                                                            {selectedReport.columns.map(col => (
                                                                <td key={col.key} className="px-6 py-4 text-xs font-bold text-slate-600 whitespace-nowrap">
                                                                    {col.format ? col.format(row[col.key]) : String(row[col.key] ?? '---')}
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        
                                        {previewTotals && (
                                            <div className="bg-slate-50 border-t-2 border-slate-100 px-6 py-5 flex justify-end gap-12 items-center">
                                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Totais do Período:</span>
                                                {selectedReport.columns.map(col => {
                                                    if (previewTotals[col.key] !== undefined) {
                                                        return (
                                                            <div key={col.key} className="flex flex-col items-end">
                                                                <span className="text-[9px] font-black text-slate-400 uppercase">{col.header}</span>
                                                                <span className="text-lg font-black text-orange-600">
                                                                    {col.type === 'currency' ? `R$ ${previewTotals[col.key].toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : previewTotals[col.key]}
                                                                </span>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                })}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default RelatoriosView;

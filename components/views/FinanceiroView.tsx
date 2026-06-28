import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
    ArrowUpCircle, ArrowDownCircle, Wallet, TrendingUp, AlertTriangle, 
    CheckCircle, Plus, Loader2, Calendar, Search, Filter, Download,
    RefreshCw, ChevronLeft, ChevronRight, FileText, Clock, User,
    Coins, Banknote, Percent, Trash2, BarChart3, PieChart, ArrowUpRight,
    ArrowDownRight, Landmark, History, Smartphone, CreditCard,
    ChevronDown, FileDown, Target, LineChart, FileSpreadsheet,
    Sparkles, Check, X, HelpCircle, CheckSquare
} from 'lucide-react';
import { suggestTransactionCategories, PendingTransaction, CategorySuggestion } from '../../services/geminiService';
import { 
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
    CartesianGrid, Tooltip, Legend, PieChart as RechartsPieChart, Pie, Cell
} from 'recharts';
import Card from '../shared/Card';
import NewTransactionModal from '../modals/NewTransactionModal';
import { FinancialTransaction, TransactionType } from '../../types';
import { supabase } from '../../services/supabaseClient';
import { useStudio } from '../../contexts/StudioContext';
import { useConfirm } from '../../utils/useConfirm';
import toast from 'react-hot-toast';
import { 
    format, isSameDay, isAfter, 
    endOfDay, endOfMonth,
    eachDayOfInterval, addDays
} from 'date-fns';
import { ptBR as pt } from 'date-fns/locale/pt-BR';
import Toast, { ToastType } from '../shared/Toast';

// Libs para exportação
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// FIX: Manual replacement for startOfDay
const getStartOfDay = (d: Date) => {
    const nd = new Date(d);
    nd.setHours(0, 0, 0, 0);
    return nd;
};

// FIX: Manual replacement for startOfMonth
const getStartOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);

// Helper to parse dates safely preserving UTC midnight as local midnight (avoiding 1-day-off errors)
const parseSafeDate = (dateVal: any): Date => {
    if (!dateVal) return new Date();
    const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
    if (typeof dateVal === 'string' && (dateVal.endsWith('T00:00:00.000Z') || dateVal.includes('T00:00:00') || dateVal.endsWith('00:00:00+00'))) {
        const parts = dateVal.split('T')[0].split('-');
        if (parts.length === 3) {
            return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 12, 0, 0, 0);
        }
    }
    return d;
};

const parseLocalStartOfDay = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 0, 0, 0, 0);
    }
    return new Date(dateStr);
};

const parseLocalEndOfDay = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 23, 59, 59, 999);
    }
    return new Date(dateStr);
};

interface FinanceiroViewProps {
    transactions: FinancialTransaction[];
    onAddTransaction: (t: FinancialTransaction) => void;
}

const formatBRL = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const StatCard = ({ title, value, subtext, icon: Icon, colorClass, trend }: any) => (
    <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-md transition-all group">
        <div className="flex justify-between items-start mb-4">
            <div className={`p-3 rounded-2xl ${colorClass} text-white shadow-lg`}>
                <Icon size={20} />
            </div>
            {trend !== undefined && trend !== null && (
                <div className={`flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg ${trend > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                    {trend > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                    {Math.abs(trend)}%
                </div>
            )}
        </div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
        <h3 className="text-2xl font-black text-slate-800 mt-1">{value}</h3>
        {subtext && <p className="text-[9px] text-slate-400 font-bold uppercase mt-2 tracking-tighter">{subtext}</p>}
    </div>
);

const FinanceiroView: React.FC<FinanceiroViewProps> = ({ transactions: propsTransactions, onAddTransaction }) => {
    const { activeStudioId } = useStudio();
    const { confirm, ConfirmDialogComponent } = useConfirm();
    const [dbTransactions, setDbTransactions] = useState<any[]>([]);
    const [dbCategories, setDbCategories] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'fluxo' | 'conciliacao'>('fluxo');
    const [pendingTransactions, setPendingTransactions] = useState<PendingTransaction[]>(() => {
        const cached = localStorage.getItem(`bela_pending_bank_transactions_${activeStudioId}`);
        if (cached) {
            try { return JSON.parse(cached); } catch (e) {
                console.warn("Error parsing cached pending bank transactions:", e);
            }
        }
        return [
            { id: 'bank-1', description: 'ENEL DISTRIBUICAO S.A. - CONTA DE LUZ 05/26', amount: 342.80, date: '2026-06-25T14:30:00.000Z', type: 'expense' },
            { id: 'bank-2', description: 'PIX RECEBIDO DE BEATRIZ SILVA CARVALHO - MICROPIGMENTACAO', amount: 150.00, date: '2026-06-26T10:15:00.000Z', type: 'income' },
            { id: 'bank-3', description: 'COMPRA BELEZA NA WEB LTDA - SHAMPOOS E CREMES', amount: 589.90, date: '2026-06-26T16:45:00.000Z', type: 'expense' },
            { id: 'bank-4', description: 'TARIFA MENSALIDADE CONTA ITAU PJ', amount: 49.00, date: '2026-06-27T08:00:00.000Z', type: 'expense' },
            { id: 'bank-5', description: 'PIX RECEBIDO DE GUSTAVO ALMEIDA - DESIGNER DE SOBRANCELHAS', amount: 280.00, date: '2026-06-27T11:20:00.000Z', type: 'income' },
            { id: 'bank-6', description: 'FORNECEDOR WELLA PROFESSIONAL DO BRASIL - INSUMOS PREMIUM', amount: 1200.00, date: '2026-06-28T09:10:00.000Z', type: 'expense' }
        ];
    });

    const [aiSuggestions, setAiSuggestions] = useState<Record<string, CategorySuggestion>>({});
    const [analyzingPending, setAnalyzingPending] = useState(false);
    
    // Manual pending input
    const [newPendingDesc, setNewPendingDesc] = useState('');
    const [newPendingAmount, setNewPendingAmount] = useState('');
    const [newPendingType, setNewPendingType] = useState<'income' | 'expense'>('expense');

    useEffect(() => {
        if (activeStudioId) {
            localStorage.setItem(`bela_pending_bank_transactions_${activeStudioId}`, JSON.stringify(pendingTransactions));
        }
    }, [pendingTransactions, activeStudioId]);

    const handleSuggestCategoriesWithAI = async () => {
        if (pendingTransactions.length === 0) {
            toast.error("Nenhuma transação pendente para analisar.");
            return;
        }

        setAnalyzingPending(true);
        try {
            // Categories list (just names)
            const catNames = dbCategories.map(c => c.name);
            
            // Historical transactions for references
            const historyReferences = dbTransactions.map(t => ({
                description: t.description,
                category: t.category
            }));

            const suggestions = await suggestTransactionCategories(
                pendingTransactions,
                catNames,
                historyReferences
            );

            // Convert to a dictionary mapping id to suggestion
            const suggestionMap: Record<string, CategorySuggestion> = {};
            suggestions.forEach(s => {
                suggestionMap[s.id] = s;
            });

            setAiSuggestions(suggestionMap);
            toast.success("Categorias sugeridas com sucesso pelo JaciBot!");
        } catch (e) {
            console.error("Erro na sugestão de categorias:", e);
            toast.error("Erro ao obter sugestões da IA.");
        } finally {
            setAnalyzingPending(false);
        }
    };

    const handleApprovePending = async (item: PendingTransaction, selectedCat: string) => {
        try {
            // Save to database financial_transactions
            const payload = {
                studio_id: activeStudioId,
                description: item.description,
                amount: Number(item.amount),
                type: item.type === 'income' ? 'income' : 'expense',
                category: selectedCat,
                payment_method: item.type === 'income' ? 'pix' : 'transferencia', // default guess
                date: item.date,
                status: 'confirmado'
            };

            const { error } = await supabase.from('financial_transactions').insert([payload]);
            if (error) throw error;

            // Remove from pending
            setPendingTransactions(prev => prev.filter(p => p.id !== item.id));
            
            // Remove from suggestions
            setAiSuggestions(prev => {
                const copy = { ...prev };
                delete copy[item.id];
                return copy;
            });

            setToast({ message: "Transação conciliada e registrada com sucesso!", type: 'success' });
            fetchData();
        } catch (e: any) {
            console.error("Erro ao conciliar transação:", e);
            toast.error(`Erro ao conciliar transação: ${e.message}`);
        }
    };

    const handleApproveAllHighlyConfident = async () => {
        const highlyConfident = pendingTransactions.filter(item => {
            const sug = aiSuggestions[item.id];
            return sug && sug.confidence >= 80;
        });

        if (highlyConfident.length === 0) {
            toast.error("Nenhuma transação com sugestão confiável (>= 80%) para aprovação em massa.");
            return;
        }

        const isConfirmed = await confirm({
            title: 'Conciliação em Massa',
            message: `Deseja realmente aprovar e registrar as ${highlyConfident.length} transações identificadas com alta confiança (>80%) pelo JaciBot?`,
            confirmText: 'Aprovar Todas',
            cancelText: 'Cancelar',
            type: 'warning'
        });

        if (!isConfirmed) return;

        setLoading(true);
        try {
            const payloads = highlyConfident.map(item => {
                const sug = aiSuggestions[item.id];
                return {
                    studio_id: activeStudioId,
                    description: item.description,
                    amount: Number(item.amount),
                    type: item.type === 'income' ? 'income' : 'expense',
                    category: sug.category,
                    payment_method: item.type === 'income' ? 'pix' : 'transferencia',
                    date: item.date,
                    status: 'confirmado'
                };
            });

            const { error } = await supabase.from('financial_transactions').insert(payloads);
            if (error) throw error;

            // Remove approved from pending
            const approvedIds = highlyConfident.map(h => h.id);
            setPendingTransactions(prev => prev.filter(p => !approvedIds.includes(p.id)));
            
            // Remove from suggestions
            setAiSuggestions(prev => {
                const copy = { ...prev };
                approvedIds.forEach(id => delete copy[id]);
                return copy;
            });

            setToast({ message: `${highlyConfident.length} transações conciliadas automaticamente!`, type: 'success' });
            fetchData();
        } catch (e: any) {
            console.error("Erro na conciliação em massa:", e);
            toast.error("Erro ao realizar conciliação em massa.");
        } finally {
            setLoading(false);
        }
    };

    const handleAddManualPending = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newPendingDesc || !newPendingAmount) {
            toast.error("Por favor, preencha a descrição e o valor.");
            return;
        }

        const newTx: PendingTransaction = {
            id: `manual-${Date.now()}`,
            description: newPendingDesc.trim(),
            amount: parseFloat(newPendingAmount),
            date: new Date().toISOString(),
            type: newPendingType
        };

        setPendingTransactions(prev => [newTx, ...prev]);
        setNewPendingDesc('');
        setNewPendingAmount('');
        toast.success("Transação bancária adicionada à fila de conciliação.");
    };
    const [summaryCards, setSummaryCards] = useState<any>({
        gross_revenue: 0,
        net_revenue: 0,
        taxes: 0,
        total_expenses: 0,
        balance: 0,
        profit_margin: 0
    });
    const [projections, setProjections] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Filtros
    const [filterPeriod, setFilterPeriod] = useState<'hoje' | 'mes' | 'custom'>('hoje');
    // FIX: Used getStartOfDay helper
    const [startDate, setStartDate] = useState(format(getStartOfDay(new Date()), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(endOfDay(new Date()), 'yyyy-MM-dd'));
    
    const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState<TransactionType | null>(null);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    // --- FETCH DE DADOS ---
    const fetchData = useCallback(async () => {
        if (!activeStudioId) return;
        setLoading(true);
        try {
            let start, end;
            if (filterPeriod === 'hoje') {
                const todayStr = format(new Date(), 'yyyy-MM-dd');
                start = parseLocalStartOfDay(todayStr);
                end = parseLocalEndOfDay(todayStr);
            } else if (filterPeriod === 'mes') {
                const today = new Date();
                start = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0, 0);
                end = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
            } else {
                start = parseLocalStartOfDay(startDate);
                end = parseLocalEndOfDay(endDate);
            }

            // Fetch with a 1-day padding on both sides to be extremely safe against database timezone mismatches
            const startDb = new Date(start);
            startDb.setDate(startDb.getDate() - 1);
            const endDb = new Date(end);
            endDb.setDate(endDb.getDate() + 1);

            // 1. Buscar Lançamentos Reais da Tabela Base
            // IMPORTANTE: payment_method em snake_case
            const [transRes, catRes, appsRes] = await Promise.all([
                supabase
                    .from('financial_transactions')
                    .select('id,description,amount,net_value,type,category,date,payment_method,status,studio_id,source')
                    .eq('studio_id', activeStudioId)
                    .gte('date', startDb.toISOString())
                    .lte('date', endDb.toISOString())
                    .neq('status', 'cancelado')
                    .order('date', { ascending: false }),
                supabase
                    .from('financial_categories')
                    .select('name')
                    .eq('studio_id', activeStudioId)
                    .eq('active', true),
                supabase
                    .from('appointments')
                    .select('date,value')
                    .eq('studio_id', activeStudioId)
                    .in('status', ['agendado', 'confirmado', 'confirmado_whatsapp'])
                    .gte('date', getStartOfDay(new Date()).toISOString())
                    .lte('date', endOfDay(addDays(new Date(), 7)).toISOString())
            ]);
            
            if (transRes.error) throw transRes.error;
            if (catRes.error) throw catRes.error;
            if (appsRes.error) throw appsRes.error;

            const dbList = catRes.data || [];
            
            // Local custom categories
            const localCustomStr = localStorage.getItem(`bela_custom_categories_${activeStudioId}`);
            const localCustomList: any[] = localCustomStr ? JSON.parse(localCustomStr) : [];
            
            const mergedCustom = [...dbList];
            localCustomList.forEach(lc => {
                if (lc.active && !mergedCustom.some(mc => mc.name.toLowerCase() === lc.name.toLowerCase())) {
                    mergedCustom.push({ name: lc.name });
                }
            });

            // Default system categories
            const DEFAULT_SYSTEM_CATEGORIES_NAMES = [
                'Serviço', 'Venda de Produtos', 'Aluguel', 'Água/Luz/Internet', 'Produtos e Insumos', 'Marketing', 'Comissões', 'Outros'
            ];

            const localDeletedDefaultsStr = localStorage.getItem(`bela_deleted_defaults_${activeStudioId}`);
            const deletedDefaults: string[] = localDeletedDefaultsStr ? JSON.parse(localDeletedDefaultsStr) : [];

            DEFAULT_SYSTEM_CATEGORIES_NAMES.forEach(defName => {
                const defId = `default-${defName.toLowerCase().replace(/\s+/g, '-')}`;
                if (!deletedDefaults.includes(defId) && !mergedCustom.some(mc => mc.name.toLowerCase() === defName.toLowerCase())) {
                    const customOverride = localCustomList.find(lc => lc.name.toLowerCase() === defName.toLowerCase());
                    if (!customOverride || customOverride.active) {
                        mergedCustom.push({ name: defName });
                    }
                }
            });

            // Parse dates safely and filter strictly inside the local start/end boundaries
            const rawTransactions = transRes.data || [];
            const currentTrans = rawTransactions.map((t: any) => ({
                ...t,
                parsedDate: parseSafeDate(t.date)
            })).filter((t: any) => {
                return t.parsedDate >= start && t.parsedDate <= end;
            });

            setDbTransactions(currentTrans);
            setDbCategories(mergedCustom);
            setProjections(appsRes.data || []);

            // 2. Cálculo Manual dos Indicadores
            const gross = currentTrans
                .filter(t => t.type === 'income' || t.type === 'receita')
                .reduce((acc, t) => acc + Number(t.amount || 0), 0);
                
            const net = currentTrans
                .filter(t => t.type === 'income' || t.type === 'receita')
                .reduce((acc, t) => acc + Number(t.net_value !== null && t.net_value !== undefined ? t.net_value : (t.amount || 0)), 0);

            const taxes = currentTrans
                .filter(t => t.type === 'income' || t.type === 'receita')
                .filter(t => t.net_value !== null && t.net_value !== undefined)
                .reduce((acc, t) => acc + (Number(t.amount || 0) - Number(t.net_value || 0)), 0);

            const expenses = currentTrans
                .filter(t => t.type === 'expense' || t.type === 'despesa')
                .reduce((acc, t) => acc + Number(t.amount || 0), 0);

            const balance = net - expenses;
            const margin = gross > 0 ? (balance / gross) * 100 : 0;

            setSummaryCards({
                gross_revenue: gross,
                net_revenue: net,
                taxes: taxes,
                total_expenses: expenses,
                balance: balance,
                profit_margin: margin
            });

        } catch (error: any) {
            console.error("Erro Financeiro:", error);
            setToast({ message: "Erro ao sincronizar financeiro.", type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [activeStudioId, startDate, endDate, filterPeriod]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // --- BI E FILTROS EM MEMÓRIA ---
    const bi = useMemo(() => {
        const filtered = dbTransactions.filter(t => {
            const matchSearch = (t.description || '').toLowerCase().includes(searchTerm.toLowerCase());
            const matchCat = selectedCategory === 'Todas' || t.category === selectedCategory;
            return matchSearch && matchCat;
        });

        const categories = Array.from(new Set([
            ...dbCategories.map(c => c.name),
            ...dbTransactions.map(t => t.category).filter(Boolean)
        ]));

        const categoryMix = categories.map(cat => {
            const total = dbTransactions
                .filter(t => t.category === cat)
                .reduce((acc, t) => acc + Number(t.amount || 0), 0);
            return { name: cat, value: total };
        }).sort((a, b) => b.value - a.value).slice(0, 5);

        // FIX: Used helpers
        const rangeStart = filterPeriod === 'hoje' ? parseLocalStartOfDay(format(new Date(), 'yyyy-MM-dd')) : (filterPeriod === 'custom' ? parseLocalStartOfDay(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1, 0, 0, 0, 0));
        const rangeEnd = filterPeriod === 'hoje' ? parseLocalEndOfDay(format(new Date(), 'yyyy-MM-dd')) : (filterPeriod === 'custom' ? parseLocalEndOfDay(endDate) : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59, 999));
        
        const daysInPeriod = eachDayOfInterval({
            start: rangeStart,
            end: rangeEnd
        });

        const chartData = daysInPeriod.map(day => {
            const dayStr = format(day, 'yyyy-MM-dd');
            const dayTrans = dbTransactions.filter(t => format(t.parsedDate || parseSafeDate(t.date), 'yyyy-MM-dd') === dayStr);
            const dayProj = projections.filter(p => format(new Date(p.date), 'yyyy-MM-dd') === dayStr);
            
            const income = dayTrans.filter(t => t.type === 'income' || t.type === 'receita').reduce((acc, t) => acc + Number(t.amount || 0), 0);
            const projection = dayProj.reduce((acc, p) => acc + Number(p.value || 0), 0);

            return {
                name: format(day, 'dd/MM'),
                receita: income > 0 ? income : null,
                despesa: dayTrans.filter(t => t.type === 'expense' || t.type === 'despesa').reduce((acc, t) => acc + Number(t.amount || 0), 0),
                projecao: projection > 0 ? projection : null
            };
        });

        return { 
            filtered, 
            categories,
            categoryMix,
            chartData
        };
    }, [dbTransactions, dbCategories, projections, searchTerm, selectedCategory, startDate, endDate, filterPeriod]);

    const handleExportExcel = () => {
        const dataToExport = bi.filtered.map(t => ({
            Data: format(t.parsedDate || parseSafeDate(t.date), 'dd/MM/yyyy HH:mm'),
            Descrição: t.description,
            Categoria: t.category || 'Geral',
            Tipo: t.type === 'income' ? 'Entrada' : 'Saída',
            Pagamento: t.payment_method,
            Valor_Bruto: t.amount,
            Valor_Liquido: t.net_value || t.amount
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Extrato");
        XLSX.writeFile(wb, `Extrato_Financeiro_${format(new Date(), 'dd_MM_yy')}.xlsx`);
    };

    const handleExportPDF = () => {
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text("Relatório de Fluxo de Caixa", 14, 22);
        doc.setFontSize(10);
        doc.text(`Período: ${startDate} até ${endDate}`, 14, 30);

        const tableData = bi.filtered.map(t => [
            format(t.parsedDate || parseSafeDate(t.date), 'dd/MM/yy'),
            t.description,
            t.category || 'Geral',
            t.payment_method || 'Outro',
            t.type === 'income' ? `+ ${formatBRL(t.amount)}` : `- ${formatBRL(t.amount)}`
        ]);

        autoTable(doc, {
            startY: 40,
            head: [['Data', 'Descrição', 'Categoria', 'Pagamento', 'Valor']],
            body: tableData,
            theme: 'striped',
            headStyles: { fill: [249, 115, 22] }
        });

        doc.save(`Relatorio_Financeiro_${format(new Date(), 'dd_MM_yy')}.pdf`);
    };

    const handleDelete = async (id: number) => {
        const isConfirmed = await confirm({
            title: 'Excluir Lançamento',
            message: 'Deseja realmente excluir este lançamento?',
            confirmText: 'Excluir',
            cancelText: 'Cancelar',
            type: 'danger'
        });

        if (!isConfirmed) return;
        try {
            const { error } = await supabase.from('financial_transactions').delete().eq('id', id);
            if (error) throw error;
            toast.success("Lançamento removido.");
            fetchData();
        } catch (e) {
            toast.error("Erro ao excluir.");
        }
    };

    const handleSaveNewTransaction = async (t: any | any[]) => {
        try {
            const transactions = Array.isArray(t) ? t : [t];
            const payloads = transactions.map(item => ({
                studio_id: activeStudioId,
                description: item.description,
                amount: Number(item.amount),
                type: item.type === 'receita' ? 'income' : 'expense',
                category: item.category,
                payment_method: item.payment_method,
                date: item.date instanceof Date ? item.date.toISOString() : new Date(item.date).toISOString(),
                status: 'confirmado',
                installments: item.installments || null
            }));

            const { error } = await supabase.from('financial_transactions').insert(payloads);
            if (error) throw error;

            setToast({ 
                message: transactions.length > 1 
                    ? `${transactions.length} lançamentos registrados!` 
                    : "Lançamento registrado!", 
                type: 'success' 
            });
            fetchData();
            setShowModal(null);
        } catch (e: any) {
            console.error("Erro ao salvar:", e);
            setToast({ message: `Erro ao salvar transação: ${e.message}`, type: 'error' });
        }
    };

    return (
        <div className="h-full flex flex-col bg-slate-50 font-sans text-left overflow-hidden">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            <header className="bg-white border-b border-slate-200 px-4 py-3 shadow-sm z-20 flex-shrink-0">
                {/* Linha 1: Título/Abas + Botões de lançamento */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-orange-50 text-orange-600 rounded-xl">
                                <Landmark size={20} />
                            </div>
                            <div>
                                <h1 className="text-base font-black text-slate-800 tracking-tight">Financeiro</h1>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Gestão Inteligente</p>
                            </div>
                        </div>
                        
                        {/* Abas */}
                        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 gap-1 ml-0 sm:ml-4">
                            <button 
                                onClick={() => setActiveTab('fluxo')}
                                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-1.5 ${activeTab === 'fluxo' ? 'bg-orange-500 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <LineChart size={12} /> Fluxo de Caixa
                            </button>
                            <button 
                                onClick={() => setActiveTab('conciliacao')}
                                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-1.5 ${activeTab === 'conciliacao' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <Sparkles size={12} /> Conciliação IA
                                {pendingTransactions.length > 0 && (
                                    <span className="bg-rose-500 text-white text-[8px] w-4 h-4 rounded-full flex items-center justify-center font-black animate-pulse">
                                        {pendingTransactions.length}
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setShowModal('receita')} 
                            className="bg-emerald-500 text-white px-3 py-2 rounded-2xl text-[10px] font-black uppercase tracking-wider shadow-lg shadow-emerald-100 active:scale-95 transition-all flex items-center gap-1"
                        >
                            <ArrowUpCircle size={12} /> Entrada
                        </button>
                        <button 
                            onClick={() => setShowModal('despesa')} 
                            className="bg-rose-500 text-white px-3 py-2 rounded-2xl text-[10px] font-black uppercase tracking-wider shadow-lg shadow-rose-100 active:scale-95 transition-all flex items-center gap-1"
                        >
                            <ArrowDownCircle size={12} /> Saída
                        </button>
                    </div>
                </div>

                {/* Linha 2: Filtros de período (Apenas na aba Fluxo de Caixa) */}
                {activeTab === 'fluxo' ? (
                    <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner gap-1">
                        <button 
                            onClick={() => setFilterPeriod('hoje')}
                            className={`flex-1 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${filterPeriod === 'hoje' ? 'bg-orange-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-700'}`}
                        >Hoje</button>
                        <button 
                            onClick={() => setFilterPeriod('mes')}
                            className={`flex-1 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${filterPeriod === 'mes' ? 'bg-orange-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-700'}`}
                        >Mês</button>
                        <button 
                            onClick={() => setFilterPeriod('custom')}
                            className={`flex-1 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${filterPeriod === 'custom' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:text-slate-700'}`}
                        >Período</button>
                    </div>
                ) : (
                    <div className="bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles size={12} className="text-indigo-500 animate-pulse" />
                        JaciBot IA ativa • Analise e concilie transações bancárias pendentes de forma automatizada
                    </div>
                )}
            </header>

            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 custom-scrollbar">
                {activeTab === 'fluxo' ? (
                    <>
                        {filterPeriod === 'custom' && (
                    <div className="bg-white p-4 rounded-[32px] border border-orange-100 shadow-xl flex flex-col sm:flex-row items-stretch sm:items-center gap-3 animate-in slide-in-from-top-2 duration-300">
                        <div className="flex items-center gap-2 flex-1">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">De:</span>
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-orange-50 focus:border-orange-200" />
                        </div>
                        <div className="flex items-center gap-2 flex-1">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Até:</span>
                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-orange-50 focus:border-orange-200" />
                        </div>
                        <button onClick={fetchData} className="p-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-all shadow-lg shadow-orange-100 flex items-center justify-center">
                            <RefreshCw size={18} className={loading ? 'animate-spin' : ''}/>
                        </button>
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                    <StatCard 
                        title="Faturamento Bruto" 
                        value={formatBRL(summaryCards.gross_revenue)} 
                        icon={TrendingUp} 
                        colorClass="bg-blue-600" 
                        subtext="Entrada Total no Período"
                    />
                    <StatCard 
                        title="Taxas Deduzidas" 
                        value={formatBRL(summaryCards.taxes)} 
                        icon={Percent} 
                        colorClass="bg-orange-600" 
                        subtext="Diferença Bruto vs Líquido"
                    />
                    <StatCard 
                        title="Faturamento Líquido" 
                        value={formatBRL(summaryCards.net_revenue)} 
                        icon={CheckCircle} 
                        colorClass="bg-emerald-600" 
                        subtext="Líquido de Taxas Adquirentes"
                    />
                    <StatCard 
                        title="Despesas Totais" 
                        value={formatBRL(summaryCards.total_expenses)} 
                        icon={ArrowDownCircle} 
                        colorClass="bg-rose-600" 
                        subtext="Saídas e Custos Operacionais"
                    />
                    <StatCard 
                        title="Saldo em Conta" 
                        value={formatBRL(summaryCards.balance)} 
                        icon={Wallet} 
                        colorClass="bg-slate-800" 
                        subtext="Líquido - Despesas"
                    />
                    <StatCard 
                        title="Margem de Lucro" 
                        value={`${summaryCards.profit_margin.toFixed(1)}%`} 
                        icon={Target} 
                        colorClass="bg-indigo-600" 
                        subtext="Rentabilidade sobre Bruto"
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <Card title="Evolução de Fluxo" className="lg:col-span-2 rounded-[32px] overflow-hidden" icon={<LineChart size={18} className="text-orange-500" />}>
                        <div className="h-72 mt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={bi.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorRec" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                                    <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                                    <Area type="monotone" dataKey="receita" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRec)" name="Faturamento" />
                                    <Area type="monotone" dataKey="despesa" stroke="#f43f5e" strokeWidth={2} fillOpacity={0} name="Saídas" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>

                    <Card title="Categorias" icon={<PieChart size={18} className="text-orange-500" />}>
                        <div className="h-64 mt-2">
                            <ResponsiveContainer width="100%" height="100%">
                                <RechartsPieChart>
                                    <Pie
                                        data={bi.categoryMix}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {bi.categoryMix.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={['#f97316', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6'][index % 5]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </RechartsPieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="space-y-2 mt-4">
                            {bi.categoryMix.map((cat, i) => (
                                <div key={i} className="flex justify-between items-center text-[10px] font-black uppercase">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ['#f97316', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6'][i % 5] }}></div>
                                        <span className="text-slate-600">{cat.name}</span>
                                    </div>
                                    <span className="text-slate-400">{formatBRL(cat.value)}</span>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>

                <Card className="rounded-[40px] border-slate-200 shadow-xl overflow-hidden">
                    <header className="flex flex-col gap-3 mb-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <History className="text-orange-500" size={20} />
                                <h2 className="text-base font-black text-slate-800 uppercase tracking-tighter">Extrato Analítico</h2>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={handleExportExcel} className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 shadow-sm" title="Excel"><FileSpreadsheet size={16}/></button>
                                <button onClick={handleExportPDF} className="p-2 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 shadow-sm" title="PDF"><FileDown size={16}/></button>
                            </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <select 
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-orange-100 outline-none transition-all"
                            >
                                <option value="Todas">Todas Categorias</option>
                                {bi.categories.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                                <input 
                                    type="text" 
                                    placeholder="Pesquisar extrato..." 
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-orange-100 outline-none transition-all"
                                />
                            </div>
                        </div>
                    </header>

                    <div>
                        {/* Mobile: cards */}
                        <div className="md:hidden divide-y divide-slate-50">
                            {loading ? (
                                <div className="p-16 flex justify-center"><Loader2 className="animate-spin text-orange-500" /></div>
                            ) : bi.filtered.length === 0 ? (
                                <div className="p-16 text-center text-slate-400 font-bold uppercase text-xs italic">Nenhum registro no período.</div>
                            ) : bi.filtered.map(t => (
                                <div key={t.id} className="px-2 py-3 hover:bg-orange-50/20 transition-colors group">
                                    <div className="flex items-start justify-between mb-1">
                                        <div className="flex-1 min-w-0 mr-2">
                                            <p className="text-sm font-black text-slate-700 truncate">{t.description}</p>
                                            <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-black uppercase mt-0.5">{t.category || 'Geral'}</span>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <p className={`text-sm font-black ${t.type === 'income' || t.type === 'receita' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {t.type === 'income' || t.type === 'receita' ? '+' : '-'} {formatBRL(t.amount)}
                                            </p>
                                            {(t.type === 'income' || t.type === 'receita') && t.net_value && t.net_value !== t.amount && (
                                                <p className="text-[10px] font-bold text-orange-500">Líq: {formatBRL(t.net_value)}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                            {t.payment_method === 'pix' && <Smartphone size={12} className="text-teal-500" />}
                                            {(t.payment_method === 'cash' || t.payment_method === 'dinheiro') && <Banknote size={12} className="text-green-500" />}
                                            {t.payment_method?.includes('cartao') || t.payment_method?.includes('credit') || t.payment_method?.includes('debit') ? <CreditCard size={12} className="text-blue-500" /> : null}
                                            <span className="text-[10px] font-black text-slate-400 uppercase">{t.payment_method?.replace('_', ' ') || 'Processamento'}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-slate-400">{format(t.parsedDate || parseSafeDate(t.date), 'dd/MM/yy HH:mm')}</span>
                                            <button onClick={() => handleDelete(t.id)} className="p-1.5 text-slate-300 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Desktop: tabela */}
                        <div className="hidden md:block overflow-x-auto -mx-6">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50/50 border-y border-slate-100">
                                    <tr>
                                        <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data</th>
                                        <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Descrição</th>
                                        <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Pagamento</th>
                                        <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Valor</th>
                                        <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ação</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {loading ? (
                                        <tr><td colSpan={5} className="p-20 text-center"><Loader2 className="animate-spin text-orange-500 mx-auto" /></td></tr>
                                    ) : bi.filtered.length === 0 ? (
                                        <tr><td colSpan={5} className="p-20 text-center text-slate-400 font-bold uppercase text-xs italic">Nenhum registro no período.</td></tr>
                                    ) : (
                                        bi.filtered.map(t => (
                                            <tr key={t.id} className="hover:bg-orange-50/20 transition-colors group">
                                                <td className="px-8 py-5">
                                                    <p className="text-xs font-bold text-slate-700">{format(t.parsedDate || parseSafeDate(t.date), 'dd/MM/yy')}</p>
                                                    <p className="text-[10px] text-slate-400 font-medium">{format(t.parsedDate || parseSafeDate(t.date), 'HH:mm')}</p>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <p className="text-sm font-black text-slate-700 truncate max-w-xs">{t.description}</p>
                                                    <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-black uppercase tracking-wider mt-1">{t.category || 'Geral'}</span>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <div className="flex items-center gap-2">
                                                        {t.payment_method === 'pix' && <Smartphone size={14} className="text-teal-500" />}
                                                        {(t.payment_method === 'cash' || t.payment_method === 'dinheiro' || t.payment_method === 'money') && <Banknote size={14} className="text-green-500" />}
                                                        {(t.payment_method?.includes('cartao') || t.payment_method?.includes('credit') || t.payment_method?.includes('debit')) && <CreditCard size={14} className="text-blue-500" />}
                                                        <span className="text-[10px] font-black text-slate-500 uppercase">{t.payment_method?.replace('_', ' ') || 'Processamento'}</span>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5 text-right">
                                                    <p className={`text-sm font-black ${t.type === 'income' || t.type === 'receita' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                        {t.type === 'income' || t.type === 'receita' ? '+' : '-'} {formatBRL(t.amount)}
                                                    </p>
                                                    {(t.type === 'income' || t.type === 'receita') && t.net_value && t.net_value !== t.amount && (
                                                        <div className="flex flex-col items-end mt-1">
                                                            <p className="text-[10px] font-bold text-orange-500">Líquido: {formatBRL(t.net_value)}</p>
                                                            <p className="text-[9px] text-slate-400">Taxa: -{formatBRL(t.amount - t.net_value)}</p>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-8 py-5 text-right">
                                                    <button onClick={() => handleDelete(t.id)} className="p-2 text-slate-300 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </Card>
                </>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-300">
                        {/* Coluna da Esquerda: Lista de Transações Pendentes */}
                        <div className="lg:col-span-2 space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-sm font-black text-slate-800 tracking-tight">Extrato Bancário Importado</h2>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Lançamentos Pendentes de Conciliação</p>
                                </div>
                                <span className="px-3 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-black rounded-full">
                                    {pendingTransactions.length} {pendingTransactions.length === 1 ? 'pendente' : 'pendentes'}
                                </span>
                            </div>

                            {pendingTransactions.length === 0 ? (
                                <div className="bg-emerald-50/50 border border-emerald-100 rounded-[32px] p-12 text-center flex flex-col items-center justify-center space-y-4">
                                    <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                                        <CheckCircle size={32} />
                                    </div>
                                    <h3 className="text-base font-black text-slate-800">Tudo Conciliado!</h3>
                                    <p className="text-xs text-slate-500 max-w-sm">
                                        Excelente! Não existem transações bancárias pendentes no extrato. O histórico do BelareStudio está 100% atualizado.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {pendingTransactions.map((item) => {
                                        const sug = aiSuggestions[item.id];
                                        const categoriesList = dbCategories.length > 0 
                                            ? dbCategories.map(c => c.name) 
                                            : ["Serviço", "Venda de Produtos", "Aluguel", "Água/Luz/Internet", "Produtos e Insumos", "Marketing", "Comissões", "Outros"];
                                        
                                        const currentSelected = selectedCategories[item.id] || sug?.category || 'Outros';

                                        return (
                                            <div 
                                                key={item.id} 
                                                className="bg-white border border-slate-100 rounded-[32px] p-6 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all duration-300 flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
                                            >
                                                {/* Detalhes da transação */}
                                                <div className="flex items-start gap-4 flex-1">
                                                    <div className={`p-3 rounded-2xl ${item.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'} flex-shrink-0`}>
                                                        {item.type === 'income' ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className="text-sm font-black text-slate-800 tracking-tight">{item.description}</p>
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="text-[10px] font-mono text-slate-400 font-bold">
                                                                {format(new Date(item.date), "dd 'de' MMMM 'às' HH:mm", { locale: pt })}
                                                            </span>
                                                            <span className="text-[9px] px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full font-black uppercase tracking-wider">
                                                                {item.id.startsWith('manual-') ? 'Importado Manual' : 'Extrato API'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Caixa Central de Sugestão IA */}
                                                <div className="w-full md:w-64 bg-slate-50/50 border border-slate-100 rounded-2xl p-3 space-y-1 flex-shrink-0">
                                                    {sug ? (
                                                        <div className="space-y-1.5 animate-in fade-in duration-300 text-left">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-[9px] font-black uppercase tracking-wider text-indigo-500 flex items-center gap-1">
                                                                    <Sparkles size={10} className="text-indigo-500 animate-pulse" /> JaciBot Sugere
                                                                </span>
                                                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${
                                                                    sug.confidence >= 80 
                                                                        ? 'bg-emerald-100 text-emerald-700' 
                                                                        : sug.confidence >= 50 
                                                                            ? 'bg-amber-100 text-amber-700' 
                                                                            : 'bg-rose-100 text-rose-700'
                                                                }`}>
                                                                    {sug.confidence}% Confiança
                                                                </span>
                                                            </div>
                                                            <p className="text-xs font-bold text-slate-700">{sug.category}</p>
                                                            <p className="text-[9px] text-slate-500 italic font-mono leading-relaxed font-medium">{sug.reasoning}</p>
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col items-center justify-center py-2 text-slate-400 text-center">
                                                            <HelpCircle size={16} className="text-slate-300 mb-1 animate-bounce" />
                                                            <p className="text-[9px] font-black uppercase tracking-wider">Aguardando IA</p>
                                                            <p className="text-[8px] leading-snug">Clique em 'Sugerir com IA'</p>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Lado Direito: Ações */}
                                                <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto border-t md:border-t-0 pt-4 md:pt-0">
                                                    <div className="space-y-1 text-left md:text-right">
                                                        <p className={`text-sm font-black ${item.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                            {item.type === 'income' ? '+' : '-'} {formatBRL(item.amount)}
                                                        </p>
                                                        
                                                        {/* Seletor de categoria real */}
                                                        <select 
                                                            value={currentSelected}
                                                            onChange={(e) => setSelectedCategories(prev => ({ ...prev, [item.id]: e.target.value }))}
                                                            className="text-[10px] font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-indigo-100"
                                                        >
                                                            {categoriesList.map(cat => (
                                                                <option key={cat} value={cat}>{cat}</option>
                                                            ))}
                                                            {!categoriesList.includes('Outros') && <option value="Outros">Outros</option>}
                                                        </select>
                                                    </div>

                                                    <div className="flex gap-2">
                                                        <button 
                                                            onClick={() => handleApprovePending(item, currentSelected)}
                                                            className="p-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl shadow-lg shadow-emerald-100 transition-all hover:scale-105 active:scale-95 flex items-center justify-center"
                                                            title="Aprovar e Lançar no Caixa"
                                                        >
                                                            <Check size={16} />
                                                        </button>
                                                        <button 
                                                            onClick={() => {
                                                                setPendingTransactions(prev => prev.filter(p => p.id !== item.id));
                                                                setAiSuggestions(prev => {
                                                                    const copy = { ...prev };
                                                                    delete copy[item.id];
                                                                    return copy;
                                                                });
                                                            }}
                                                            className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 rounded-2xl transition-all flex items-center justify-center"
                                                            title="Ignorar Lançamento"
                                                        >
                                                            <X size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Coluna da Direita: Painel JaciBot & Simulador */}
                        <div className="space-y-6 text-left">
                            {/* Painel de Controle JaciBot */}
                            <div className="bg-gradient-to-br from-indigo-950 to-slate-900 text-white rounded-[32px] p-6 shadow-xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-8 opacity-10">
                                    <Sparkles size={120} className="text-white" />
                                </div>
                                <div className="relative z-10 space-y-6">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="px-2.5 py-1 bg-indigo-500/30 text-indigo-300 text-[8px] font-black uppercase tracking-widest rounded-full flex items-center gap-1">
                                                <Sparkles size={10} className="animate-pulse" /> JaciBot Finanças
                                            </span>
                                        </div>
                                        <h3 className="text-base font-black tracking-tight mt-2">Classificação de Extratos por IA</h3>
                                        <p className="text-[10px] text-indigo-200/80 leading-relaxed font-bold">
                                            JaciBot analisa cada descrição de entrada ou saída, compara com o histórico de transações reais e sugere a categoria ideal em segundos.
                                        </p>
                                    </div>

                                    <div className="space-y-3 bg-white/5 border border-white/10 rounded-2xl p-4">
                                        <div className="flex justify-between text-[10px] font-bold">
                                            <span className="text-indigo-200">Pendentes no Extrato:</span>
                                            <span>{pendingTransactions.length} itens</span>
                                        </div>
                                        <div className="flex justify-between text-[10px] font-bold">
                                            <span className="text-indigo-200">Analisados pela IA:</span>
                                            <span>{Object.keys(aiSuggestions).length} de {pendingTransactions.length}</span>
                                        </div>
                                    </div>

                                    <div className="space-y-2 pt-2">
                                        <button 
                                            onClick={handleSuggestCategoriesWithAI}
                                            disabled={analyzingPending || pendingTransactions.length === 0}
                                            className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 disabled:opacity-50 text-white font-black uppercase text-[9px] tracking-wider py-3 px-4 rounded-2xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                                        >
                                            {analyzingPending ? (
                                                <>
                                                    <Loader2 size={14} className="animate-spin" /> JaciBot Analisando...
                                                </>
                                            ) : (
                                                <>
                                                    <Sparkles size={14} /> Sugerir Categorias com IA
                                                </>
                                            )}
                                        </button>

                                        {Object.keys(aiSuggestions).length > 0 && (
                                            <button 
                                                onClick={handleApproveAllHighlyConfident}
                                                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black uppercase text-[9px] tracking-wider py-3 px-4 rounded-2xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                                            >
                                                <CheckSquare size={14} /> Conciliar Confiáveis {"(>=80%)"}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Simulador de Lançamentos Bancários */}
                            <div className="bg-white border border-slate-100 rounded-[32px] p-6 shadow-sm space-y-4">
                                <div>
                                    <h3 className="text-xs font-black text-slate-800">Simular Importação Bancária</h3>
                                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Adicione transações pendentes fictícias para testar</p>
                                </div>

                                <form onSubmit={handleAddManualPending} className="space-y-3">
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Descrição do Lançamento</label>
                                        <input 
                                            type="text" 
                                            placeholder="Ex: PGTO FORNECEDOR L'OREAL DO BRASIL" 
                                            value={newPendingDesc}
                                            onChange={(e) => setNewPendingDesc(e.target.value)}
                                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-indigo-200"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Valor (R$)</label>
                                            <input 
                                                type="number" 
                                                step="0.01"
                                                placeholder="0.00" 
                                                value={newPendingAmount}
                                                onChange={(e) => setNewPendingAmount(e.target.value)}
                                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-indigo-200"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Tipo</label>
                                            <select 
                                                value={newPendingType}
                                                onChange={(e) => setNewPendingType(e.target.value as 'income' | 'expense')}
                                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-700 outline-none focus:border-indigo-200"
                                            >
                                                <option value="expense">Saída / Débito</option>
                                                <option value="income">Entrada / Crédito</option>
                                            </select>
                                        </div>
                                    </div>

                                    <button 
                                        type="submit"
                                        className="w-full bg-slate-800 hover:bg-slate-900 text-white font-black uppercase text-[9px] tracking-wider py-2.5 rounded-xl transition-all cursor-pointer"
                                    >
                                        Adicionar à Fila do Extrato
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {showModal && (
                <NewTransactionModal 
                    type={showModal} 
                    onClose={() => setShowModal(null)} 
                    onSave={handleSaveNewTransaction} 
                />
            )}
            <ConfirmDialogComponent />
        </div>
    );
};

export default FinanceiroView;
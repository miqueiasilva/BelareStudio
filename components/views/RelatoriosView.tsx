
import React, { useState, useMemo, useEffect } from 'react';
import { 
    BarChart3, TrendingUp, TrendingDown, DollarSign, Calendar, 
    ChevronLeft, ChevronRight, FileSpreadsheet, FileText,
    Users, Scissors, Wallet, ArrowRight, Loader2, 
    AlertTriangle, FilePieChart, Table, CheckCircle2,
    BarChart, PieChart as PieChartIcon, Search, Printer, 
    Download, Filter, CalendarDays, Clock, CreditCard, Banknote, Smartphone,
    RefreshCw, Info, UserCheck, Zap, RotateCcw, MessageCircle
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, parseISO, differenceInDays, subDays } from 'date-fns';
import { ptBR as pt } from 'date-fns/locale/pt-BR';
import Card from '../shared/Card';
import SafePie from '../charts/SafePie';
import SafeBar from '../charts/SafeBar';
import { supabase } from '../../services/supabaseClient';

// Bibliotecas de Exportação
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

type TabType = 'overview' | 'financeiro' | 'clientes' | 'recuperacao' | 'export';

interface ClientMetric {
    id: string | number;
    nome: string;
    whatsapp: string;
    totalSpent: number;
    visitCount: number;
    avgTicket: number;
    lastVisit: string | null;
    daysAbsent: number;
    riskLevel: 'low' | 'medium' | 'high';
}

const RelatoriosView: React.FC = () => {
    const [isMounted, setIsMounted] = useState(false);
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [isLoading, setIsLoading] = useState(false);
    
    // Filtros
    const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
    const [churnThreshold, setChurnThreshold] = useState(45);
    
    // Dados
    const [transactions, setTransactions] = useState<any[]>([]);
    const [clientMetrics, setClientMetrics] = useState<ClientMetric[]>([]);
    const [prevBalance, setPrevBalance] = useState(0);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        if (isMounted) {
            if (activeTab === 'financeiro' || activeTab === 'overview') fetchFinancialData();
            if (activeTab === 'clientes' || activeTab === 'recuperacao') fetchClientMetrics();
        }
    }, [isMounted, activeTab, startDate, endDate]);

    const fetchFinancialData = async () => {
        setIsLoading(true);
        try {
            const { data: oldTrans } = await supabase.from('financial_transactions').select('amount, type').lt('date', startDate).neq('status', 'cancelado');
            const prev = (oldTrans || []).reduce((acc, t) => t.type === 'income' ? acc + Number(t.amount) : acc - Number(t.amount), 0);
            setPrevBalance(prev);

            let query = supabase.from('financial_transactions').select('*').gte('date', startDate).lte('date', `${endDate}T23:59:59`).neq('status', 'cancelado').order('date', { ascending: false });
            const { data } = await query;
            setTransactions(data || []);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchClientMetrics = async () => {
        setIsLoading(true);
        try {
            // 1. Busca Clientes e Agendamentos simultaneamente
            const [clientsRes, apptsRes, transRes] = await Promise.all([
                supabase.from('clients').select('id, nome, whatsapp'),
                supabase.from('appointments').select('client_id, date').eq('status', 'concluido'),
                supabase.from('financial_transactions').select('client_id, amount').eq('type', 'income').neq('status', 'cancelado')
            ]);

            const clients = clientsRes.data || [];
            const appts = apptsRes.data || [];
            const trans = transRes.data || [];

            const metrics: ClientMetric[] = clients.map(c => {
                const clientTrans = trans.filter(t => t.client_id === c.id);
                const clientAppts = appts.filter(a => a.client_id === c.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                
                const totalSpent = clientTrans.reduce((acc, t) => acc + Number(t.amount), 0);
                const visitCount = clientAppts.length;
                const lastVisitDate = clientAppts.length > 0 ? clientAppts[0].date : null;
                const daysAbsent = lastVisitDate ? differenceInDays(new Date(), parseISO(lastVisitDate)) : 999;

                let risk: 'low' | 'medium' | 'high' = 'low';
                if (daysAbsent > 90) risk = 'high';
                else if (daysAbsent > 45) risk = 'medium';

                return {
                    id: c.id,
                    nome: c.nome,
                    whatsapp: c.whatsapp || '',
                    totalSpent,
                    visitCount,
                    avgTicket: visitCount > 0 ? totalSpent / visitCount : 0,
                    lastVisit: lastVisitDate,
                    daysAbsent,
                    riskLevel: risk
                };
            });

            setClientMetrics(metrics.sort((a, b) => b.totalSpent - a.totalSpent));
        } finally {
            setIsLoading(false);
        }
    };

    const handleSendRescueMsg = (client: ClientMetric) => {
        const msg = `Oi ${client.nome.split(' ')[0]}! 🌸 Tudo bem? Notamos que faz um tempinho que você não vem nos visitar (${client.daysAbsent} dias). Estamos com saudades! Que tal agendar um horário para esta semana? Temos novidades te esperando. ✨`;
        const phone = client.whatsapp.replace(/\D/g, '');
        window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`, '_blank');
    };

    const summary = useMemo(() => {
        const income = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + Number(t.amount), 0);
        const expense = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + Number(t.amount), 0);
        return { income, expense, balance: income - expense, final: prevBalance + (income - expense) };
    }, [transactions, prevBalance]);

    const churnList = useMemo(() => {
        return clientMetrics.filter(c => c.daysAbsent >= churnThreshold && c.visitCount > 0);
    }, [clientMetrics, churnThreshold]);

    if (!isMounted) return null;

    return (
        <div className="h-full flex flex-col bg-slate-50 overflow-hidden font-sans text-left">
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4 z-30 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-orange-50 text-orange-600 rounded-xl">
                        <BarChart3 size={24} />
                    </div>
                    <h1 className="text-xl font-black text-slate-800 tracking-tight">CENTRAL DE INTELIGÊNCIA</h1>
                </div>

                <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 overflow-x-auto scrollbar-hide max-w-full">
                    <button onClick={() => setActiveTab('overview')} className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all whitespace-nowrap ${activeTab === 'overview' ? 'bg-white shadow-md text-orange-600' : 'text-slate-500 hover:text-slate-800'}`}>Dashboard</button>
                    <button onClick={() => setActiveTab('financeiro')} className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all whitespace-nowrap ${activeTab === 'financeiro' ? 'bg-white shadow-md text-orange-600' : 'text-slate-500 hover:text-slate-800'}`}>Financeiro</button>
                    <button onClick={() => setActiveTab('clientes')} className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all whitespace-nowrap ${activeTab === 'clientes' ? 'bg-white shadow-md text-orange-600' : 'text-slate-500 hover:text-slate-800'}`}>Ranking VIP</button>
                    <button onClick={() => setActiveTab('recuperacao')} className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all whitespace-nowrap ${activeTab === 'recuperacao' ? 'bg-white shadow-md text-rose-600' : 'text-slate-500 hover:text-slate-800'}`}>Recuperação</button>
                </div>
            </header>

            {/* Barra de Filtros para Financeiro */}
            {(activeTab === 'financeiro' || activeTab === 'overview') && (
                <div className="bg-white border-b border-slate-200 p-4">
                    <div className="max-w-7xl mx-auto flex flex-wrap items-end gap-4">
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Início</label>
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Fim</label>
                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none" />
                        </div>
                        <button onClick={fetchFinancialData} className="p-2.5 bg-slate-800 text-white rounded-xl shadow-md"><RefreshCw size={16} className={isLoading ? 'animate-spin' : ''}/></button>
                    </div>
                </div>
            )}

            <main className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                <div className="max-w-7xl mx-auto space-y-8 pb-20">
                    
                    {/* VIEW: RANKING VIP / LTV */}
                    {activeTab === 'clientes' && (
                        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-4">
                                    <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center"><UserCheck size={24}/></div>
                                    <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Base Ativa</p><h3 className="text-2xl font-black text-slate-800">{clientMetrics.length} Clientes</h3></div>
                                </div>
                                <div className="bg-slate-900 p-6 rounded-[32px] text-white shadow-xl flex items-center gap-4">
                                    <div className="w-12 h-12 bg-white/10 text-orange-400 rounded-2xl flex items-center justify-center"><Zap size={24}/></div>
                                    <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ticket Médio Geral</p><h3 className="text-2xl font-black text-orange-400">R$ {(clientMetrics.reduce((acc, c) => acc + c.avgTicket, 0) / (clientMetrics.length || 1)).toFixed(2)}</h3></div>
                                </div>
                            </div>

                            <div className="bg-white rounded-[32px] border border-slate-200 shadow-xl overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-slate-900 text-white sticky top-0 z-10">
                                            <tr>
                                                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest">Cliente</th>
                                                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-center">Visitas</th>
                                                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-right">Ticket Médio</th>
                                                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-right">LTV Total</th>
                                                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-center">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {clientMetrics.map((c, i) => (
                                                <tr key={c.id} className="hover:bg-slate-50 transition-colors group">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center font-black text-xs">{i+1}</div>
                                                            <span className="font-bold text-slate-700">{c.nome}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-black">{c.visitCount}x</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right font-bold text-slate-500">R$ {c.avgTicket.toFixed(2)}</td>
                                                    <td className="px-6 py-4 text-right">
                                                        <span className="font-black text-emerald-600 text-sm tracking-tighter">R$ {c.totalSpent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <button 
                                                            onClick={() => window.open(`https://wa.me/55${c.whatsapp.replace(/\D/g, '')}`, '_blank')}
                                                            className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all"
                                                        >
                                                            <MessageCircle size={18} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* VIEW: RECUPERAÇÃO DE CLIENTES */}
                    {activeTab === 'recuperacao' && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                            <div className="bg-rose-50 border border-rose-100 p-8 rounded-[40px] flex flex-col md:flex-row items-center justify-between gap-8">
                                <div className="flex items-center gap-6">
                                    <div className="w-16 h-16 bg-white rounded-3xl text-rose-500 flex items-center justify-center shadow-lg shadow-rose-100"><RotateCcw size={32} /></div>
                                    <div>
                                        <h2 className="text-xl font-black text-rose-900 leading-tight">Plano de Recuperação</h2>
                                        <p className="text-sm text-rose-700 font-medium">Clientes que não retornam há mais de 45 dias.</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 bg-white p-2 rounded-2xl shadow-inner border border-rose-100">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3">Dias de Ausência:</label>
                                    <input 
                                        type="number" 
                                        value={churnThreshold} 
                                        onChange={e => setChurnThreshold(Number(e.target.value))}
                                        className="w-16 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-center font-black text-rose-600 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {churnList.map(c => (
                                    <div key={c.id} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-xl hover:border-rose-200 transition-all group">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 font-black">{c.nome.charAt(0)}</div>
                                            <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${c.daysAbsent > 90 ? 'bg-rose-500 text-white' : 'bg-amber-100 text-amber-700'}`}>
                                                {c.daysAbsent} dias ausente
                                            </span>
                                        </div>
                                        <h3 className="font-black text-slate-800 text-lg leading-tight truncate">{c.nome}</h3>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Última visita: {c.lastVisit ? format(parseISO(c.lastVisit), 'dd/MM/yy') : '---'}</p>
                                        
                                        <div className="mt-6 pt-6 border-t border-slate-50 flex items-center justify-between">
                                            <div className="text-left">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Histórico</p>
                                                <p className="text-xs font-bold text-slate-600">{c.visitCount} atendimentos</p>
                                            </div>
                                            <button 
                                                onClick={() => handleSendRescueMsg(c)}
                                                className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-emerald-100 transition-all active:scale-95"
                                            >
                                                <MessageCircle size={14} /> Resgatar
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {churnList.length === 0 && (
                                <div className="py-32 text-center flex flex-col items-center">
                                    <CheckCircle2 size={64} className="text-emerald-100 mb-4" />
                                    <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Todos os clientes estão com as visitas em dia!</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* MANTÉM OS OUTROS RELATÓRIOS JÁ EXISTENTES ABAIXO... */}
                    {activeTab === 'overview' && (
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in duration-500">
                             <div className="bg-white p-5 border-l-4 border-l-emerald-500 rounded-2xl shadow-sm">
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Entradas</div>
                                <div className="text-xl font-black text-slate-800">R$ {summary.income.toLocaleString('pt-BR')}</div>
                            </div>
                            <div className="bg-white p-5 border-l-4 border-l-rose-500 rounded-2xl shadow-sm">
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Saídas</div>
                                <div className="text-xl font-black text-slate-800">R$ {summary.expense.toLocaleString('pt-BR')}</div>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default RelatoriosView;

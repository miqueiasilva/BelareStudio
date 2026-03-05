
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
    LayoutDashboard, Wallet, Calendar, Users, Briefcase, Sparkles, 
    TrendingUp, TrendingDown, DollarSign, Target, Clock, XCircle, 
    UserPlus, UserCheck, History, Gift, Share2, ArrowUpRight, 
    ArrowDownRight, Download, FileText, FileSpreadsheet, Filter, 
    ChevronDown, Search, Loader2, AlertTriangle, PieChart as PieChartIcon,
    BarChart3, Scissors, Star, Percent, Zap, MessageCircle, Info,
    ArrowRight, ChevronLeft, ChevronRight, Printer, CalendarDays,
    Banknote, CreditCard, Smartphone, RefreshCw, Package, AlertOctagon,
    Layers, Coins, CheckSquare, Square, BarChart4, Tags, ShoppingBag,
    ArrowUp, ArrowDown, Receipt, HardDrive, Archive, Cake, Gauge, FileDown, Sheet, RotateCcw, Globe, User
} from 'lucide-react';
import { 
    format, endOfMonth, differenceInDays, isSameDay, endOfDay,
    eachDayOfInterval, isWithinInterval, addDays, addMonths, 
    endOfYesterday, subDays, startOfDay, startOfMonth, subMonths,
    isSameMonth, parseISO, getDay, getHours
} from 'date-fns';
import { ptBR as pt } from 'date-fns/locale/pt-BR';
import { 
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, 
    CartesianGrid, Tooltip, Cell, PieChart, Pie, AreaChart, Area,
    LineChart, Line, Legend
} from 'recharts';
import { supabase } from '../../services/supabaseClient';
import { useStudio } from '../../contexts/StudioContext';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

import DREReport from '../reports/DREReport';

// --- Types ---
type Period = 'today' | '7d' | '15d' | '30d' | '3m' | '6m' | '12m' | 'custom';

// --- Components ---

const Skeleton = ({ className }: { className: string }) => (
  <div className={`bg-slate-200 animate-pulse rounded-2xl ${className}`} />
);

const EmptyState = ({ message = "Nenhum dado encontrado para o período selecionado." }: { message?: string }) => (
  <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-white rounded-[32px] border border-dashed border-slate-200">
    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-slate-300">
      <Search size={32} />
    </div>
    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">{message}</p>
  </div>
);

const KPICard = ({ title, value, subtext, icon: Icon, color, trend, loading }: any) => {
  if (loading) return <Skeleton className="h-32" />;
  
  const isPositive = trend >= 0;
  
  return (
    <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-2xl ${color} text-white shadow-lg`}>
          <Icon size={20} />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black ${isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
            {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {Math.abs(trend).toFixed(1)}%
          </div>
        )}
      </div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
      <h3 className="text-2xl font-black text-slate-800 mt-1">{value}</h3>
      {subtext && <p className="text-[10px] text-slate-400 font-bold mt-2 uppercase">{subtext}</p>}
    </div>
  );
};

const TableHeader = ({ children }: { children: React.ReactNode }) => (
  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left border-b border-slate-50">
    {children}
  </th>
);

const TableCell = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <td className={`px-6 py-4 text-sm font-bold text-slate-700 border-b border-slate-50 ${className}`}>
    {children}
  </td>
);

// --- Main Component ---

const RelatoriosView: React.FC = () => {
  const { activeStudioId } = useStudio();
  const [activeTab, setActiveTab] = useState<string>('executivo');
  const [period, setPeriod] = useState<Period>('30d');
  const [compareWithPrevious, setCompareWithPrevious] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  
  // Custom Date Range
  const [customStartDate, setCustomStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [customEndDate, setCustomEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  // Data States
  const [data, setData] = useState<any>(null);
  const [previousData, setPreviousData] = useState<any>(null);
  
  // Filters
  const [selectedProfessionals, setSelectedProfessionals] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [availableProfessionals, setAvailableProfessionals] = useState<any[]>([]);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);

  // --- Data Fetching ---

  const getDates = useCallback(() => {
    let start = new Date();
    let end = new Date();
    
    switch (period) {
      case 'today':
        start = startOfDay(new Date());
        break;
      case '7d':
        start = subDays(new Date(), 7);
        break;
      case '15d':
        start = subDays(new Date(), 15);
        break;
      case '30d':
        start = subDays(new Date(), 30);
        break;
      case '3m':
        start = subMonths(new Date(), 3);
        break;
      case '6m':
        start = subMonths(new Date(), 6);
        break;
      case '12m':
        start = subMonths(new Date(), 12);
        break;
      case 'custom':
        start = new Date(customStartDate);
        end = new Date(customEndDate);
        break;
    }
    
    const diff = differenceInDays(end, start) + 1;
    const prevStart = subDays(start, diff);
    const prevEnd = subDays(end, diff);
    
    return { start, end, prevStart, prevEnd };
  }, [period, customStartDate, customEndDate]);

  const fetchData = useCallback(async () => {
    if (!activeStudioId) return;
    setIsLoading(true);
    
    try {
      const { start, end, prevStart, prevEnd } = getDates();
      
      // Fetch current period
      const [transRes, apptsRes, clientsRes, teamRes, servicesRes] = await Promise.all([
        supabase.from('financial_transactions').select('*').eq('studio_id', activeStudioId).gte('date', start.toISOString()).lte('date', end.toISOString()),
        supabase.from('appointments').select('*').eq('studio_id', activeStudioId).gte('date', start.toISOString()).lte('date', end.toISOString()),
        supabase.from('clients').select('*').eq('studio_id', activeStudioId),
        supabase.from('team_members').select('*').eq('studio_id', activeStudioId),
        supabase.from('services').select('*').eq('studio_id', activeStudioId)
      ]);

      // Fetch previous period for comparison
      const [prevTransRes, prevApptsRes] = await Promise.all([
        supabase.from('financial_transactions').select('*').eq('studio_id', activeStudioId).gte('date', prevStart.toISOString()).lte('date', prevEnd.toISOString()),
        supabase.from('appointments').select('*').eq('studio_id', activeStudioId).gte('date', prevStart.toISOString()).lte('date', prevEnd.toISOString())
      ]);

      setAvailableProfessionals(teamRes.data || []);
      const cats = Array.from(new Set((servicesRes.data || []).map(s => s.category).filter(Boolean)));
      setAvailableCategories(cats as string[]);

      // Process Data
      const process = (transactions: any[], appointments: any[]) => {
        const income = transactions.filter(t => t.type === 'income' || t.type === 'receita').reduce((acc, t) => acc + Number(t.amount || 0), 0);
        const expense = transactions.filter(t => t.type === 'expense' || t.type === 'despesa').reduce((acc, t) => acc + Number(t.amount || 0), 0);
        const totalAppts = appointments.length;
        const completedAppts = appointments.filter(a => a.status === 'concluido').length;
        const ticketMedio = completedAppts > 0 ? income / completedAppts : 0;
        const profit = income - expense;
        const margin = income > 0 ? (profit / income) * 100 : 0;
        
        const onlineAppts = appointments.filter(a => (a.origem === 'online' || a.origem === 'link' || a.origin === 'online') && a.status !== 'cancelado').length;
        const onlineRate = totalAppts > 0 ? (onlineAppts / totalAppts) * 100 : 0;
        
        return { income, expense, totalAppts, completedAppts, ticketMedio, profit, margin, onlineAppts, onlineRate, transactions, appointments };
      };

      setData(process(transRes.data || [], apptsRes.data || []));
      setPreviousData(process(prevTransRes.data || [], prevApptsRes.data || []));
      
    } catch (err) {
      console.error("Erro ao buscar dados do BI:", err);
      toast.error("Erro ao carregar relatórios.");
    } finally {
      setIsLoading(false);
    }
  }, [activeStudioId, getDates]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- Calculations ---

  const metrics = useMemo(() => {
    if (!data) return null;
    
    const calculateTrend = (curr: number, prev: number) => {
      if (prev === 0) return 0;
      return ((curr - prev) / prev) * 100;
    };

    const incomeTrend = calculateTrend(data.income, previousData?.income || 0);
    const ticketTrend = calculateTrend(data.ticketMedio, previousData?.ticketMedio || 0);
    const apptsTrend = calculateTrend(data.totalAppts, previousData?.totalAppts || 0);
    
    // Revenue Evolution
    const days = eachDayOfInterval({ start: getDates().start, end: getDates().end });
    const evolution = days.map(day => {
      const dStr = format(day, 'yyyy-MM-dd');
      const dayIncome = data.transactions.filter((t: any) => format(parseISO(t.date), 'yyyy-MM-dd') === dStr && (t.type === 'income' || t.type === 'receita')).reduce((acc: number, t: any) => acc + Number(t.amount || 0), 0);
      return { name: format(day, 'dd/MM'), valor: dayIncome };
    });

    // Revenue by Category
    const catMap: any = {};
    data.transactions.filter((t: any) => t.type === 'income' || t.type === 'receita').forEach((t: any) => {
      const cat = t.category || 'Outros';
      catMap[cat] = (catMap[cat] || 0) + Number(t.amount || 0);
    });
    const categoryData = Object.entries(catMap).map(([name, value]) => ({ name, value }));

    return {
      incomeTrend,
      ticketTrend,
      apptsTrend,
      evolution,
      categoryData
    };
  }, [data, previousData, getDates]);

  // --- Export Functions ---

  const exportToCSV = (tabName: string) => {
    if (!data) return;
    const ws = XLSX.utils.json_to_sheet(data.transactions);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, tabName);
    XLSX.writeFile(wb, `Relatorio_${tabName}_${format(new Date(), 'dd-MM-yyyy')}.xlsx`);
    toast.success("CSV exportado com sucesso!");
  };

  const exportToPDF = (tabName: string) => {
    const doc = new jsPDF();
    doc.text(`Relatório de ${tabName}`, 14, 15);
    doc.text(`Período: ${format(getDates().start, 'dd/MM/yyyy')} - ${format(getDates().end, 'dd/MM/yyyy')}`, 14, 25);
    
    const tableData = data.transactions.map((t: any) => [
      format(parseISO(t.date), 'dd/MM/yyyy'),
      t.description || t.category || 'Sem descrição',
      t.type === 'income' ? 'Receita' : 'Despesa',
      `R$ ${Number(t.amount).toLocaleString('pt-BR')}`
    ]);

    autoTable(doc, {
      head: [['Data', 'Descrição', 'Tipo', 'Valor']],
      body: tableData,
      startY: 35
    });

    doc.save(`Relatorio_${tabName}_${format(new Date(), 'dd-MM-yyyy')}.pdf`);
    toast.success("PDF exportado com sucesso!");
  };

  // --- Render Helpers ---

  const renderFilters = () => (
    <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm mb-8 flex flex-wrap items-center justify-between gap-6">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
          {[
            { id: 'today', label: 'Hoje' },
            { id: '7d', label: '7 dias' },
            { id: '30d', label: '30 dias' },
            { id: '3m', label: '3 meses' },
            { id: 'custom', label: 'Personalizado' }
          ].map(p => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id as Period)}
              className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${period === p.id ? 'bg-white shadow-md text-orange-600' : 'text-slate-500 hover:text-slate-800'}`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {period === 'custom' && (
          <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
            <input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} className="bg-transparent border-none text-[10px] font-bold text-slate-600 outline-none px-2" />
            <span className="text-slate-300 text-xs font-bold">até</span>
            <input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} className="bg-transparent border-none text-[10px] font-bold text-slate-600 outline-none px-2" />
          </div>
        )}

        <label className="flex items-center gap-3 cursor-pointer group">
          <div className={`w-10 h-5 rounded-full relative transition-colors ${compareWithPrevious ? 'bg-orange-500' : 'bg-slate-200'}`} onClick={() => setCompareWithPrevious(!compareWithPrevious)}>
            <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${compareWithPrevious ? 'left-6' : 'left-1'}`} />
          </div>
          <span className="text-[10px] font-black text-slate-400 uppercase group-hover:text-slate-600 transition-colors">Comparar Período</span>
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={() => exportToPDF(activeTab)} className="p-3 bg-slate-50 text-slate-600 rounded-2xl hover:bg-slate-100 transition-all" title="Exportar PDF">
          <FileText size={20} />
        </button>
        <button onClick={() => exportToCSV(activeTab)} className="p-3 bg-slate-50 text-slate-600 rounded-2xl hover:bg-slate-100 transition-all" title="Exportar Excel">
          <FileSpreadsheet size={20} />
        </button>
        <button onClick={fetchData} className="p-3 bg-orange-500 text-white rounded-2xl shadow-lg shadow-orange-100 hover:bg-orange-600 active:scale-95 transition-all">
          <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>
    </div>
  );

  const renderExecutivo = () => (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <KPICard title="Faturamento Total" value={`R$ ${data?.income.toLocaleString('pt-BR')}`} trend={metrics?.incomeTrend} color="bg-emerald-500" icon={DollarSign} loading={isLoading} />
        <KPICard title="Ticket Médio" value={`R$ ${data?.ticketMedio.toFixed(2)}`} trend={metrics?.ticketTrend} color="bg-indigo-500" icon={TrendingUp} loading={isLoading} />
        <KPICard title="Atendimentos" value={data?.totalAppts} trend={metrics?.apptsTrend} color="bg-orange-500" icon={Calendar} loading={isLoading} />
        <KPICard title="Agendamentos Online" value={data?.onlineAppts} color="bg-purple-500" icon={Globe} loading={isLoading} />
        <KPICard title="Taxa Online" value={`${data?.onlineRate.toFixed(1)}%`} color="bg-orange-600" icon={Zap} loading={isLoading} />
        <KPICard title="Taxa Ocupação" value={`${data?.margin.toFixed(1)}%`} color="bg-slate-800" icon={Target} loading={isLoading} />
        <KPICard title="Novos Clientes" value="12" trend={15} color="bg-blue-500" icon={UserPlus} loading={isLoading} />
        <KPICard title="Margem de Lucro" value={`${data?.margin.toFixed(1)}%`} color="bg-rose-500" icon={Percent} loading={isLoading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter">Evolução do Faturamento</h3>
            <TrendingUp className="text-emerald-500" size={24} />
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics?.evolution}>
                <defs>
                  <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 'bold'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 'bold'}} />
                <Tooltip contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'}} />
                <Area type="monotone" dataKey="valor" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#colorVal)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter">Receita por Categoria</h3>
            <PieChartIcon className="text-indigo-500" size={24} />
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={metrics?.categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={8}>
                  {metrics?.categoryData.map((_: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={['#10b981', '#6366f1', '#f59e0b', '#f43f5e', '#8b5cf6'][index % 5]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );

  const renderFinanceiro = () => (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <KPICard title="Faturamento Bruto" value={`R$ ${data?.income.toLocaleString('pt-BR')}`} color="bg-emerald-500" icon={DollarSign} loading={isLoading} />
        <KPICard title="Custos Totais" value={`R$ ${data?.expense.toLocaleString('pt-BR')}`} color="bg-rose-500" icon={TrendingDown} loading={isLoading} />
        <KPICard title="Lucro Líquido" value={`R$ ${data?.profit.toLocaleString('pt-BR')}`} color="bg-indigo-500" icon={TrendingUp} loading={isLoading} />
      </div>

      <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex justify-between items-center">
          <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter">Fluxo de Caixa Detalhado</h3>
          <div className="flex gap-2">
            <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase">Receitas</span>
            <span className="px-3 py-1 bg-rose-50 text-rose-600 rounded-full text-[10px] font-black uppercase">Despesas</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/50">
                <TableHeader>Data</TableHeader>
                <TableHeader>Descrição</TableHeader>
                <TableHeader>Categoria</TableHeader>
                <TableHeader>Tipo</TableHeader>
                <TableHeader>Valor</TableHeader>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data?.transactions.length > 0 ? data.transactions.map((t: any) => (
                <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                  <TableCell>{format(parseISO(t.date), 'dd/MM/yyyy')}</TableCell>
                  <TableCell>{t.description || 'Sem descrição'}</TableCell>
                  <TableCell>
                    <span className="px-2 py-1 bg-slate-100 rounded-lg text-[10px] font-bold text-slate-500 uppercase">
                      {t.category || 'Geral'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${t.type === 'income' || t.type === 'receita' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      <span className={t.type === 'income' || t.type === 'receita' ? 'text-emerald-600' : 'text-rose-600'}>
                        {t.type === 'income' || t.type === 'receita' ? 'Receita' : 'Despesa'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className={t.type === 'income' || t.type === 'receita' ? 'text-emerald-600' : 'text-rose-600'}>
                    R$ {Number(t.amount).toLocaleString('pt-BR')}
                  </TableCell>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="py-20">
                    <EmptyState />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderAgenda = () => {
    // Process Online vs Manual
    const days = eachDayOfInterval({ start: getDates().start, end: getDates().end });
    const onlineVsManual = days.map(day => {
      const dStr = format(day, 'yyyy-MM-dd');
      const dayAppts = data?.appointments.filter((a: any) => format(parseISO(a.date), 'yyyy-MM-dd') === dStr);
      const online = dayAppts.filter((a: any) => a.origem === 'online' || a.origem === 'link' || a.origin === 'online').length;
      const manual = dayAppts.length - online;
      return { name: format(day, 'dd/MM'), online, manual };
    }).filter(d => d.online > 0 || d.manual > 0);

    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KPICard title="Total Atendimentos" value={data?.totalAppts} color="bg-orange-500" icon={Calendar} loading={isLoading} />
          <KPICard title="Agendamentos Online" value={data?.onlineAppts} color="bg-purple-500" icon={Globe} loading={isLoading} />
          <KPICard title="Taxa de Ocupação" value={`${data?.margin.toFixed(1)}%`} color="bg-indigo-500" icon={Target} loading={isLoading} />
          <KPICard title="Tempo Médio" value="45 min" color="bg-slate-800" icon={Clock} loading={isLoading} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter mb-8">Online vs Manual</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={onlineVsManual}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 'bold'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 'bold'}} />
                  <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'}} />
                  <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{paddingBottom: '20px'}} />
                  <Bar dataKey="online" name="Online" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="manual" name="Manual" fill="#f97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter mb-8">Ocupação por Dia da Semana</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { name: 'Seg', valor: 45 },
                  { name: 'Ter', valor: 65 },
                  { name: 'Qua', valor: 78 },
                  { name: 'Qui', valor: 82 },
                  { name: 'Sex', valor: 95 },
                  { name: 'Sáb', valor: 100 },
                  { name: 'Dom', valor: 10 }
                ]}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 'bold'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 'bold'}} unit="%" />
                  <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'}} />
                  <Bar dataKey="valor" fill="#f97316" radius={[10, 10, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderClientes = () => {
    // Process Clients with origin
    const clientsWithOrigin = data?.appointments.reduce((acc: any[], app: any) => {
      if (!app.client_id) return acc;
      const existing = acc.find(c => c.id === app.client_id);
      if (existing) {
        existing.visits += 1;
        existing.totalSpent += Number(app.value || 0);
        if (app.origem === 'online' || app.origem === 'link' || app.origin === 'online') {
          existing.isOnline = true;
        }
      } else {
        acc.push({
          id: app.client_id,
          name: app.client_name,
          visits: 1,
          totalSpent: Number(app.value || 0),
          lastVisit: app.date,
          isOnline: app.origem === 'online' || app.origem === 'link' || app.origin === 'online'
        });
      }
      return acc;
    }, []).sort((a: any, b: any) => b.totalSpent - a.totalSpent).slice(0, 10);

    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <KPICard title="Clientes Ativos" value="450" color="bg-orange-500" icon={Users} loading={isLoading} />
          <KPICard title="Novos Clientes" value="28" color="bg-emerald-500" icon={UserPlus} loading={isLoading} />
          <KPICard title="Taxa de Retorno" value="72%" color="bg-indigo-500" icon={RotateCcw} loading={isLoading} />
        </div>

        <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-8 border-b border-slate-50">
            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter">Top 10 Clientes (LTV)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/50">
                  <TableHeader>Cliente</TableHeader>
                  <TableHeader>Visitas</TableHeader>
                  <TableHeader>Última Visita</TableHeader>
                  <TableHeader>Total Gasto</TableHeader>
                  <TableHeader>Canal</TableHeader>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {clientsWithOrigin?.length > 0 ? clientsWithOrigin.map((c: any) => (
                  <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-[10px] font-black">
                          {c.name?.charAt(0) || 'C'}
                        </div>
                        <span>{c.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{c.visits}</TableCell>
                    <TableCell>{format(parseISO(c.lastVisit), 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="text-emerald-600">R$ {c.totalSpent.toLocaleString('pt-BR')}</TableCell>
                    <TableCell>
                      {c.isOnline ? (
                        <span className="px-2 py-1 bg-purple-50 text-purple-600 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 w-fit">
                          <Globe size={10} /> Online
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-slate-50 text-slate-500 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 w-fit">
                          <User size={10} /> Manual
                        </span>
                      )}
                    </TableCell>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="py-20">
                      <EmptyState />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderEquipe = () => (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <KPICard title="Faturamento Equipe" value={`R$ ${data?.income.toLocaleString('pt-BR')}`} color="bg-emerald-500" icon={DollarSign} loading={isLoading} />
        <KPICard title="Comissões a Pagar" value="R$ 4.500,00" color="bg-rose-500" icon={Wallet} loading={isLoading} />
        <KPICard title="Avaliação Média" value="4.9 / 5" color="bg-orange-500" icon={Star} loading={isLoading} />
      </div>

      <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-50">
          <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter">Performance por Profissional</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/50">
                <TableHeader>Profissional</TableHeader>
                <TableHeader>Atendimentos</TableHeader>
                <TableHeader>Faturamento</TableHeader>
                <TableHeader>Ticket Médio</TableHeader>
                <TableHeader>Comissão</TableHeader>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {availableProfessionals.map(p => (
                <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <img src={p.photo_url || `https://ui-avatars.com/api/?name=${p.name}`} className="w-8 h-8 rounded-full object-cover" alt="" />
                      <span>{p.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>45</TableCell>
                  <TableCell>R$ 5.200,00</TableCell>
                  <TableCell>R$ 115,00</TableCell>
                  <TableCell className="text-rose-600">R$ 1.560,00</TableCell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderMarketing = () => (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard title="Campanhas Enviadas" value="12" color="bg-indigo-500" icon={Sparkles} loading={isLoading} />
        <KPICard title="Taxa de Abertura" value="45%" color="bg-emerald-500" icon={UserCheck} loading={isLoading} />
        <KPICard title="Conversão" value="12%" color="bg-orange-500" icon={Zap} loading={isLoading} />
        <KPICard title="ROI Médio" value="4.5x" color="bg-slate-800" icon={TrendingUp} loading={isLoading} />
      </div>

      <div className="bg-white p-12 rounded-[40px] border border-dashed border-slate-200 text-center">
        <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6 text-indigo-500">
          <Sparkles size={40} />
        </div>
        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter mb-2">Módulo de Marketing Inteligente</h3>
        <p className="text-slate-500 max-w-md mx-auto mb-8 font-medium">
          Crie campanhas automatizadas, recupere clientes sumidos e aumente seu faturamento com nossa IA integrada.
        </p>
        <button className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95">
          Configurar Primeira Campanha
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden font-sans text-left">
      <header className="bg-white border-b border-slate-200 px-8 py-6 flex flex-col md:flex-row justify-between items-center gap-6 z-30 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-orange-500 text-white rounded-2xl shadow-lg shadow-orange-100">
            <BarChart3 size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tighter uppercase">BI Inteligente</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Gestão de Alta Performance</p>
          </div>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 overflow-x-auto scrollbar-hide max-w-full">
          {[
            { id: 'executivo', label: 'Executivo', icon: LayoutDashboard },
            { id: 'financeiro', label: 'Financeiro', icon: Wallet },
            { id: 'agenda', label: 'Operação', icon: Calendar },
            { id: 'clientes', label: 'Clientes', icon: Users },
            { id: 'equipe', label: 'Equipe', icon: Briefcase },
            { id: 'marketing', label: 'Marketing', icon: Sparkles },
            { id: 'dre', label: 'DRE Gerencial', icon: FileText }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-white shadow-md text-orange-600' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        <div className="max-w-7xl mx-auto pb-20">
          {renderFilters()}

          {isLoading ? (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
                {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-32" />)}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Skeleton className="h-96" />
                <Skeleton className="h-96" />
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'executivo' && renderExecutivo()}
              {activeTab === 'financeiro' && renderFinanceiro()}
              {activeTab === 'agenda' && renderAgenda()}
              {activeTab === 'clientes' && renderClientes()}
              {activeTab === 'equipe' && renderEquipe()}
              {activeTab === 'marketing' && renderMarketing()}
              {activeTab === 'dre' && <DREReport />}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default RelatoriosView;

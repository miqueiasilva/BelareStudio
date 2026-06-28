
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
    LayoutDashboard, Wallet, Calendar, Users, Briefcase, Sparkles, 
    TrendingUp, TrendingDown, DollarSign, Target, Clock, XCircle, X,
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
import { D3RevenueEvolutionChart, D3TeamPerformanceChart } from '../reports/D3Charts';

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

const guessCategory = (name: string, existingCategory?: string): string => {
  if (existingCategory && existingCategory !== 'Sem Categoria' && existingCategory.trim() !== '') {
    return existingCategory;
  }
  const n = (name || '').toLowerCase();
  if (n.includes('design') || n.includes('henna') || n.includes('sobrancelha') || n.includes('brow') || n.includes('micropigmentação') || n.includes('micro')) {
    return 'Sobrancelhas';
  }
  if (n.includes('cílios') || n.includes('cilios') || n.includes('lash') || n.includes('fio a fio') || n.includes('olhar')) {
    return 'Cílios & Olhar';
  }
  if (n.includes('epilação') || n.includes('epilacao')) {
    return 'Epilação Facial';
  }
  if (n.includes('depilação') || n.includes('depilacao')) {
    if (n.includes('masc')) return 'Depilação Masculina';
    return 'Depilação Feminina';
  }
  if (n.includes('pele') || n.includes('facial') || n.includes('corporal') || n.includes('limpeza') || n.includes('estética') || n.includes('estetica')) {
    return 'Estética Facial & Corporal';
  }
  if (n.includes('massagem') || n.includes('bem-estar') || n.includes('terapia') || n.includes('relax')) {
    return 'Massagem & Bem-Estar';
  }
  if (n.includes('lábio') || n.includes('labial') || n.includes('labio')) {
    return 'Lábios';
  }
  if (n.includes('curso') || n.includes('especialização') || n.includes('especializacao') || n.includes('aula')) {
    return 'Cursos';
  }
  return 'Sobrancelhas'; // fallback beauty/salon default if not matched
};

const getServicesForAppointment = (a: any, servicesList: any[]) => {
  const servicesMap = new Map((servicesList || []).map(s => [String(s.id), s]));
  const servicesByNameMap = new Map();
  (servicesList || []).forEach(s => {
    if (s.nome) {
      servicesByNameMap.set(s.nome.trim().toLowerCase(), s);
    }
  });

  let parsedSvcs: any[] = [];
  if (a.notes && a.notes.includes('---SERVICES_JSON---')) {
    const servicesMatch = a.notes.match(/---SERVICES_JSON---[\r\n\s]*([\s\S]*?)[\r\n\s]*---END_SERVICES_JSON---/);
    if (servicesMatch?.[1]) {
      try {
        parsedSvcs = JSON.parse(servicesMatch[1]);
      } catch (e) {
        console.error("Error parsing services JSON in helper:", e);
      }
    }
  }

  const resolvedServices: any[] = [];

  if (Array.isArray(parsedSvcs) && parsedSvcs.length > 0) {
    parsedSvcs.forEach((ps: any) => {
      let found = servicesMap.get(String(ps.id || ''));
      if (!found && ps.name) {
        found = servicesByNameMap.get(ps.name.trim().toLowerCase());
      }
      if (found) {
        resolvedServices.push({
          ...found,
          categoria: guessCategory(found.nome, found.categoria)
        });
      } else {
        resolvedServices.push({
          id: ps.id || 0,
          nome: ps.name || 'Serviço',
          preco: Number(ps.price || ps.preco || 0),
          categoria: guessCategory(ps.name || 'Serviço')
        });
      }
    });
  } else {
    let found = a.service_id ? servicesMap.get(String(a.service_id)) : null;
    if (!found && a.service_name) {
      found = servicesByNameMap.get(a.service_name.trim().toLowerCase());
    }

    if (found) {
      resolvedServices.push({
        ...found,
        categoria: guessCategory(found.nome, found.categoria)
      });
    } else {
      resolvedServices.push({
        id: a.service_id || 0,
        nome: a.service_name || 'Serviço não cadastrado',
        preco: Number(a.value || a.price || 0),
        categoria: guessCategory(a.service_name || 'Serviço não cadastrado')
      });
    }
  }

  return resolvedServices;
};

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

const statusMeta: { [key: string]: { label: string, bg: string, text: string } } = {
  agendado: { label: 'Agendado', bg: 'bg-amber-50 text-amber-700 border border-amber-200/50', text: 'text-amber-700' },
  confirmado: { label: 'Confirmado', bg: 'bg-emerald-50 text-emerald-700 border border-emerald-200/50', text: 'text-emerald-700' },
  confirmado_whatsapp: { label: 'Confirmado Whats', bg: 'bg-green-50 text-green-700 border border-green-200/50', text: 'text-green-700' },
  chegou: { label: 'Chegou', bg: 'bg-blue-50 text-blue-700 border border-blue-200/50', text: 'text-blue-700' },
  em_atendimento: { label: 'Atendimento', bg: 'bg-indigo-50 text-indigo-700 border border-indigo-200/50', text: 'text-indigo-700' },
  concluido: { label: 'Concluído', bg: 'bg-sky-50 text-sky-700 border border-sky-200/50', text: 'text-sky-700' },
  faltou: { label: 'Faltou', bg: 'bg-rose-50 text-rose-700 border border-rose-200/50', text: 'text-rose-700' },
  cancelado: { label: 'Cancelado', bg: 'bg-slate-100 text-slate-500 border border-slate-200', text: 'text-slate-500' },
  bloqueado: { label: 'Bloqueado', bg: 'bg-slate-200 text-slate-700 border border-slate-300', text: 'text-slate-700' },
  em_espera: { label: 'Em Espera', bg: 'bg-purple-50 text-purple-700 border border-purple-200/50', text: 'text-purple-700' },
};

// --- Main Component ---

const RelatoriosView: React.FC = () => {
  const { activeStudioId, studios } = useStudio();
  const [activeTab, setActiveTab] = useState<string>('executivo');
  const [period, setPeriod] = useState<Period>('30d');
  const [compareWithPrevious, setCompareWithPrevious] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  
  // Custom Date Range
  const [customStartDate, setCustomStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [customEndDate, setCustomEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  // Data States
  const [rawReceivedData, setRawReceivedData] = useState<any>(null);
  const [rawPreviousData, setRawPreviousData] = useState<any>(null);
  const [rawUpcomingData, setRawUpcomingData] = useState<any[]>([]);
  
  // Filters
  const [selectedProfessionals, setSelectedProfessionals] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [availableProfessionals, setAvailableProfessionals] = useState<any[]>([]);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [services, setServices] = useState<any[]>([]);

  // Derived filtered data states based on selected professional filter
  const displayData = useMemo(() => {
    if (!rawReceivedData) return null;
    if (selectedProfessionals.length === 0) return rawReceivedData;
    
    const profId = String(selectedProfessionals[0]).trim();
    
    const appointments = rawReceivedData.appointments.filter((a: any) => {
      const aProfId = String(a.professional_id || a.professional?.id || '').trim();
      return aProfId === profId;
    });

    const transactions = rawReceivedData.transactions.filter((t: any) => {
      const tProfId = String(t.professionalId || t.professional_id || '').trim();
      if (tProfId) {
        return tProfId === profId;
      }
      if (t.appointment_id) {
        const matchingAppt = rawReceivedData.appointments.find((a: any) => String(a.id) === String(t.appointment_id));
        if (matchingAppt) {
          const aProfId = String(matchingAppt.professional_id || matchingAppt.professional?.id || '').trim();
          return aProfId === profId;
        }
      }
      return false;
    });

    const income = transactions.filter(t => t.type === 'income' || t.type === 'receita').reduce((acc, t) => acc + Number(t.amount || 0), 0);
    const expense = transactions.filter(t => t.type === 'expense' || t.type === 'despesa').reduce((acc, t) => acc + Number(t.amount || 0), 0);
    const totalAppts = appointments.length;
    const completedAppts = appointments.filter(a => a.status === 'concluido').length;
    const ticketMedio = completedAppts > 0 ? income / completedAppts : 0;
    const profit = income - expense;
    const margin = income > 0 ? (profit / income) * 100 : 0;
    
    const potentialIncome = appointments.filter(a => a.status !== 'cancelado').reduce((acc, a) => {
      const resolved = getServicesForAppointment(a, services);
      const valFromServices = resolved.reduce((sum: number, s: any) => sum + (s.preco || 0), 0);
      return acc + (a.value || a.price || valFromServices || 0);
    }, 0);

    const onlineAppts = appointments.filter(a => (a.origin === 'online' || a.origin === 'link') && a.status !== 'cancelado').length;
    const onlineRate = totalAppts > 0 ? (onlineAppts / totalAppts) * 100 : 0;

    return {
      ...rawReceivedData,
      income,
      expense,
      totalAppts,
      completedAppts,
      ticketMedio,
      profit,
      margin,
      onlineAppts,
      onlineRate,
      transactions,
      appointments,
      potentialIncome
    };
  }, [rawReceivedData, selectedProfessionals, services]);

  const displayPreviousData = useMemo(() => {
    if (!rawPreviousData) return null;
    if (selectedProfessionals.length === 0) return rawPreviousData;
    
    const profId = String(selectedProfessionals[0]).trim();
    
    const appointments = rawPreviousData.appointments.filter((a: any) => {
      const aProfId = String(a.professional_id || a.professional?.id || '').trim();
      return aProfId === profId;
    });

    const transactions = rawPreviousData.transactions.filter((t: any) => {
      const tProfId = String(t.professionalId || t.professional_id || '').trim();
      if (tProfId) {
        return tProfId === profId;
      }
      if (t.appointment_id) {
        const matchingAppt = rawPreviousData.appointments.find((a: any) => String(a.id) === String(t.appointment_id));
        if (matchingAppt) {
          const aProfId = String(matchingAppt.professional_id || matchingAppt.professional?.id || '').trim();
          return aProfId === profId;
        }
      }
      return false;
    });

    const income = transactions.filter(t => t.type === 'income' || t.type === 'receita').reduce((acc, t) => acc + Number(t.amount || 0), 0);
    const expense = transactions.filter(t => t.type === 'expense' || t.type === 'despesa').reduce((acc, t) => acc + Number(t.amount || 0), 0);
    const totalAppts = appointments.length;
    const completedAppts = appointments.filter(a => a.status === 'concluido').length;
    const ticketMedio = completedAppts > 0 ? income / completedAppts : 0;
    const profit = income - expense;
    const margin = income > 0 ? (profit / income) * 100 : 0;
    
    const potentialIncome = appointments.filter(a => a.status !== 'cancelado').reduce((acc, a) => {
      const resolved = getServicesForAppointment(a, services);
      const valFromServices = resolved.reduce((sum: number, s: any) => sum + (s.preco || 0), 0);
      return acc + (a.value || a.price || valFromServices || 0);
    }, 0);

    const onlineAppts = appointments.filter(a => (a.origin === 'online' || a.origin === 'link') && a.status !== 'cancelado').length;
    const onlineRate = totalAppts > 0 ? (onlineAppts / totalAppts) * 100 : 0;

    return {
      ...rawPreviousData,
      income,
      expense,
      totalAppts,
      completedAppts,
      ticketMedio,
      profit,
      margin,
      onlineAppts,
      onlineRate,
      transactions,
      appointments,
      potentialIncome
    };
  }, [rawPreviousData, selectedProfessionals, services]);

  const upcomingData = useMemo(() => {
    if (!rawUpcomingData) return { projectedIncome: 0, count: 0 };
    
    let filtered = rawUpcomingData;
    if (selectedProfessionals.length > 0) {
      const profId = String(selectedProfessionals[0]).trim();
      filtered = rawUpcomingData.filter((a: any) => {
        const aProfId = String(a.professional_id || a.professional?.id || '').trim();
        return aProfId === profId;
      });
    }

    const projectedIncome = filtered.reduce((acc: number, a: any) => {
      const resolved = getServicesForAppointment(a, services);
      const valFromServices = resolved.reduce((sum: number, s: any) => sum + (s.preco || 0), 0);
      return acc + (a.value || a.price || valFromServices || 0);
    }, 0);

    return { projectedIncome, count: filtered.length };
  }, [rawUpcomingData, selectedProfessionals, services]);

  const data = displayData;
  const previousData = displayPreviousData;

  // Detalhamento de Equipe states
  const [selectedProfDetails, setSelectedProfDetails] = useState<any | null>(null);
  const [modalSearch, setModalSearch] = useState('');
  const [modalStatusFilter, setModalStatusFilter] = useState('todos');

  // Serviços & Categorias states
  const [serviceStatusFilter, setServiceStatusFilter] = useState<'only_completed' | 'all_active'>('only_completed');
  const [serviceSearchQuery, setServiceSearchQuery] = useState('');

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
        start = startOfDay(parseISO(customStartDate));
        end = endOfDay(parseISO(customEndDate));
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
      const [transRes, apptsRes, teamRes, categoriesRes, servicesRes] = await Promise.all([
        supabase.from('financial_transactions').select('*').eq('studio_id', activeStudioId).gte('date', start.toISOString()).lte('date', end.toISOString()),
        supabase.from('appointments').select('*').eq('studio_id', activeStudioId).gte('date', start.toISOString()).lte('date', end.toISOString()),
        supabase.from('team_members').select('*').eq('studio_id', activeStudioId),
        supabase.from('financial_categories').select('name').eq('studio_id', activeStudioId).eq('active', true),
        supabase.from('services').select('id, preco, nome, categoria').eq('studio_id', activeStudioId)
      ]);

      // Fetch upcoming appointments for projection (next 30 days)
      const upcomingStart = endOfMonth(new Date() > end ? new Date() : end);
      const upcomingEnd = addDays(upcomingStart, 30);
      const { data: upcomingAppts } = await supabase
        .from('appointments')
        .select('*')
        .eq('studio_id', activeStudioId)
        .gte('date', new Date().toISOString())
        .lte('date', upcomingEnd.toISOString())
        .neq('status', 'cancelado');

      // Fetch previous period for comparison
      const [prevTransRes, prevApptsRes] = await Promise.all([
        supabase.from('financial_transactions').select('*').eq('studio_id', activeStudioId).gte('date', prevStart.toISOString()).lte('date', prevEnd.toISOString()),
        supabase.from('appointments').select('*').eq('studio_id', activeStudioId).gte('date', prevStart.toISOString()).lte('date', prevEnd.toISOString())
      ]);

      setAvailableProfessionals(teamRes.data || []);
      const cats = Array.from(new Set((categoriesRes.data || []).map(c => c.name).filter(Boolean)));
      setAvailableCategories(cats as string[]);

      const servicesMap = new Map((servicesRes.data || []).map(s => [s.id, s.preco]));
      setServices(servicesRes.data || []);

      // Process Data
      const process = (transactions: any[], appointments: any[]) => {
        const income = transactions.filter(t => t.type === 'income' || t.type === 'receita').reduce((acc, t) => acc + Number(t.amount || 0), 0);
        const expense = transactions.filter(t => t.type === 'expense' || t.type === 'despesa').reduce((acc, t) => acc + Number(t.amount || 0), 0);
        const totalAppts = appointments.length;
        const completedAppts = appointments.filter(a => a.status === 'concluido').length;
        const ticketMedio = completedAppts > 0 ? income / completedAppts : 0;
        const profit = income - expense;
        const margin = income > 0 ? (profit / income) * 100 : 0;
        
        // potential value calculation
        const potentialIncome = appointments.filter(a => a.status !== 'cancelado').reduce((acc, a) => {
            const resolved = getServicesForAppointment(a, servicesRes.data || []);
            const valFromServices = resolved.reduce((sum: number, s: any) => sum + (s.preco || 0), 0);
            return acc + (a.value || a.price || valFromServices || 0);
        }, 0);

        const onlineAppts = appointments.filter(a => (a.origin === 'online' || a.origin === 'link') && a.status !== 'cancelado').length;
        const onlineRate = totalAppts > 0 ? (onlineAppts / totalAppts) * 100 : 0;
        
        return { income, expense, totalAppts, completedAppts, ticketMedio, profit, margin, onlineAppts, onlineRate, transactions, appointments, potentialIncome };
      };

      setRawReceivedData(process(transRes.data || [], apptsRes.data || []));
      setRawPreviousData(process(prevTransRes.data || [], prevApptsRes.data || []));
      
      setRawUpcomingData(upcomingAppts || []);
      
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

    // Revenue by Category (Service Categories)
    const catMap: any = {};
    data.appointments.forEach((a: any) => {
      if (a.type === 'block' || a.status === 'cancelado') return;
      const resolved = getServicesForAppointment(a, services);
      if (resolved.length > 0) {
        const sumPrices = resolved.reduce((sum: number, s: any) => sum + (s.preco || 0), 0);
        const appointmentValue = a.value || a.price || sumPrices || 0;
        resolved.forEach((s: any) => {
          const sPrice = s.preco || 0;
          const sCat = s.categoria || 'Sobrancelhas';
          const attributedVal = sumPrices > 0 ? (sPrice / sumPrices) * appointmentValue : appointmentValue / resolved.length;
          catMap[sCat] = (catMap[sCat] || 0) + attributedVal;
        });
      }
    });

    // Fallback if no appointments are present but we have transactions
    if (Object.keys(catMap).length === 0) {
      data.transactions.filter((t: any) => t.type === 'income' || t.type === 'receita').forEach((t: any) => {
        const cat = t.category || 'Outros';
        catMap[cat] = (catMap[cat] || 0) + Number(t.amount || 0);
      });
    }

    const categoryData = Object.entries(catMap).map(([name, value]) => ({ 
      name, 
      value: Number(Number(value).toFixed(2)) 
    })).sort((a: any, b: any) => b.value - a.value);

    return {
      incomeTrend,
      ticketTrend,
      apptsTrend,
      evolution,
      categoryData
    };
  }, [data, previousData, getDates, services]);

  // --- Export Functions ---

  const exportToCSV = (tabName: string) => {
    if (!data) return;
    
    const wb = XLSX.utils.book_new();
    
    if (tabName === 'servicos') {
      const servicesData = serviceStats.services.map((s, index) => ({
        'Ranking': index + 1,
        'Serviço': s.name,
        'Categoria': s.category,
        'Atendimentos': s.quantity,
        'Faturamento (R$)': Number(s.revenue.toFixed(2)),
        'Participação (%)': Number(s.percentage.toFixed(2))
      }));
      
      const categoriesData = serviceStats.categories.map((c, index) => ({
        'Ranking': index + 1,
        'Categoria': c.name,
        'Atendimentos': c.quantity,
        'Faturamento (R$)': Number(c.revenue.toFixed(2)),
        'Ticket Médio (R$)': Number((c.quantity > 0 ? c.revenue / c.quantity : 0).toFixed(2)),
        'Participação (%)': Number(c.percentage.toFixed(2))
      }));
      
      const wsServices = XLSX.utils.json_to_sheet(servicesData);
      const wsCategories = XLSX.utils.json_to_sheet(categoriesData);
      
      XLSX.utils.book_append_sheet(wb, wsServices, "Serviços");
      XLSX.utils.book_append_sheet(wb, wsCategories, "Categorias");
    } else if (tabName === 'executivo') {
      const kpis = [
        { 'Métrica': 'Período Inicial', 'Valor': format(getDates().start, 'dd/MM/yyyy') },
        { 'Métrica': 'Período Final', 'Valor': format(getDates().end, 'dd/MM/yyyy') },
        { 'Métrica': 'Faturamento Realizado (Pago - R$)', 'Valor': Number((data.income || 0).toFixed(2)) },
        { 'Métrica': 'Faturamento Projetado (Agenda/Comandas - R$)', 'Valor': Number((data.potentialIncome || 0).toFixed(2)) },
        { 'Métrica': 'Despesas Totais (R$)', 'Valor': Number((data.expense || 0).toFixed(2)) },
        { 'Métrica': 'Lucro Líquido Realizado (R$)', 'Valor': Number((data.profit || 0).toFixed(2)) },
        { 'Métrica': 'Margem de Lucro (%)', 'Valor': `${(data.margin || 0).toFixed(2)}%` },
        { 'Métrica': 'Ticket Médio (R$)', 'Valor': Number((data.ticketMedio || 0).toFixed(2)) },
        { 'Métrica': 'Total de Agendamentos', 'Valor': data.totalAppts || 0 },
        { 'Métrica': 'Agendamentos Concluídos', 'Valor': data.completedAppts || 0 },
        { 'Métrica': 'Agendamentos via Canal Online', 'Valor': data.onlineAppts || 0 },
        { 'Métrica': 'Taxa de Agendamento Online (%)', 'Valor': `${(data.onlineRate || 0).toFixed(2)}%` },
        { 'Métrica': 'Projeção (Próximos 30 dias - R$)', 'Valor': Number((upcomingData.projectedIncome || 0).toFixed(2)) }
      ];
      const wsKpis = XLSX.utils.json_to_sheet(kpis);
      XLSX.utils.book_append_sheet(wb, wsKpis, "Faturamento & KPIs");

      const transData = (data.transactions || []).map((t: any) => ({
        'Data': t.date ? format(parseISO(t.date), 'dd/MM/yyyy') : '',
        'Descrição': t.description || 'Sem descrição',
        'Tipo': t.type === 'income' ? 'Receita' : 'Despesa',
        'Categoria': t.category || 'Sem categoria',
        'Valor (R$)': Number((t.amount || 0).toFixed(2)),
        'Status': t.status || 'pago'
      }));
      const wsTrans = XLSX.utils.json_to_sheet(transData);
      XLSX.utils.book_append_sheet(wb, wsTrans, "Fluxo de Caixa");

      const apptsData = (data.appointments || []).map((a: any) => ({
        'Data': a.date ? format(parseISO(a.date), 'dd/MM/yyyy') : '',
        'Hora': a.date ? format(parseISO(a.date), 'HH:mm') : '',
        'Cliente': a.client_name || 'Sem cliente',
        'Profissional': a.professional_name || 'Sem profissional',
        'Serviço': a.service_name || 'Sem serviço',
        'Valor (R$)': Number((a.value || a.price || 0).toFixed(2)),
        'Status': a.status || 'confirmado',
        'Origem': a.origin || 'interno'
      }));
      const wsAppts = XLSX.utils.json_to_sheet(apptsData);
      XLSX.utils.book_append_sheet(wb, wsAppts, "Agendamentos");

    } else if (tabName === 'financeiro') {
      const summary = [
        { 'Métrica': 'Faturamento Realizado (Pago - R$)', 'Valor': Number((data.income || 0).toFixed(2)) },
        { 'Métrica': 'Despesas Totais (R$)', 'Valor': Number((data.expense || 0).toFixed(2)) },
        { 'Métrica': 'Lucro Líquido Realizado (R$)', 'Valor': Number((data.profit || 0).toFixed(2)) },
        { 'Métrica': 'Margem Líquida (%)', 'Valor': `${(data.margin || 0).toFixed(2)}%` }
      ];
      const wsSum = XLSX.utils.json_to_sheet(summary);
      XLSX.utils.book_append_sheet(wb, wsSum, "Resumo");

      const transData = (data.transactions || []).map((t: any) => ({
        'Data': t.date ? format(parseISO(t.date), 'dd/MM/yyyy') : '',
        'Descrição': t.description || 'Sem descrição',
        'Categoria': t.category || 'Sem categoria',
        'Tipo': t.type === 'income' ? 'Receita' : 'Despesa',
        'Valor (R$)': Number((t.amount || 0).toFixed(2)),
        'Status': t.status || 'pago',
        'Método de Pagamento': t.payment_method || 'Não inf.'
      }));
      const wsTrans = XLSX.utils.json_to_sheet(transData);
      XLSX.utils.book_append_sheet(wb, wsTrans, "Transações Detalhadas");

    } else if (tabName === 'agenda') {
      const summary = [
        { 'Métrica': 'Total de Atendimentos', 'Valor': data.totalAppts || 0 },
        { 'Métrica': 'Agendamentos via Canal Online', 'Valor': data.onlineAppts || 0 },
        { 'Métrica': 'Agendamentos Manuais (Internos)', 'Valor': (data.totalAppts || 0) - (data.onlineAppts || 0) },
        { 'Métrica': 'Taxa de Ocupação/Margem (%)', 'Valor': `${(data.margin || 0).toFixed(2)}%` }
      ];
      const wsSum = XLSX.utils.json_to_sheet(summary);
      XLSX.utils.book_append_sheet(wb, wsSum, "Métricas da Agenda");

      const apptsData = (data.appointments || []).map((a: any) => ({
        'Data': a.date ? format(parseISO(a.date), 'dd/MM/yyyy') : '',
        'Hora': a.date ? format(parseISO(a.date), 'HH:mm') : '',
        'Cliente': a.client_name || 'Sem cliente',
        'Profissional': a.professional_name || 'Sem profissional',
        'Serviço': a.service_name || 'Sem serviço',
        'Valor (R$)': Number((a.value || a.price || 0).toFixed(2)),
        'Status': a.status || 'confirmado',
        'Origem': a.origin || 'interno'
      }));
      const wsAppts = XLSX.utils.json_to_sheet(apptsData);
      XLSX.utils.book_append_sheet(wb, wsAppts, "Lista de Atendimentos");

    } else if (tabName === 'clientes') {
      const clientsWithOrigin = (data.appointments || []).reduce((acc: any[], app: any) => {
        if (!app.client_id) return acc;
        const existing = acc.find(c => c.id === app.client_id);
        if (existing) {
          existing.visits += 1;
          existing.totalSpent += Number(app.value || 0);
          if (app.origin === 'online' || app.origin === 'link') {
            existing.isOnline = true;
          }
        } else {
          acc.push({
            id: app.client_id,
            name: app.client_name,
            visits: 1,
            totalSpent: Number(app.value || 0),
            lastVisit: app.date,
            isOnline: app.origin === 'online' || app.origin === 'link'
          });
        }
        return acc;
      }, []).sort((a: any, b: any) => b.totalSpent - a.totalSpent);

      const clientsData = clientsWithOrigin.map((c: any, index: number) => ({
        'Rank LTV': index + 1,
        'Cliente': c.name || 'Sem nome',
        'ID': c.id,
        'Nº de Visitas (no período)': c.visits,
        'Faturamento Gerado LTV (R$)': Number((c.totalSpent || 0).toFixed(2)),
        'Último Atendimento': c.lastVisit ? format(parseISO(c.lastVisit), 'dd/MM/yyyy') : '',
        'Agendou Online?': c.isOnline ? 'Sim' : 'Não'
      }));

      const wsClients = XLSX.utils.json_to_sheet(clientsData);
      XLSX.utils.book_append_sheet(wb, wsClients, "Ranking LTV Clientes");

    } else if (tabName === 'equipe') {
      const teamData = teamStats.map((p: any, index: number) => ({
        'Rank': index + 1,
        'Colaborador': p.name,
        'E-mail': p.email || 'Não informado',
        'Cargo/Especialidade': p.role || 'Profissional',
        'Atendimentos Realizados': p.count,
        'Faturamento Realizado Pago (R$)': Number((p.revenue || 0).toFixed(2)),
        'Faturamento Projetado (R$)': Number((p.projectedRevenue || 0).toFixed(2)),
        'Ticket Médio Individual (R$)': Number((p.ticket || 0).toFixed(2)),
        'Comissão Gerada (R$)': Number((p.commission || 0).toFixed(2))
      }));
      const wsTeam = XLSX.utils.json_to_sheet(teamData);
      XLSX.utils.book_append_sheet(wb, wsTeam, "Performance Individual");

    } else {
      const ws = XLSX.utils.json_to_sheet(data.transactions);
      XLSX.utils.book_append_sheet(wb, ws, tabName);
    }
    
    const formattedTabName = tabName.charAt(0).toUpperCase() + tabName.slice(1);
    XLSX.writeFile(wb, `Relatorio_Faturamento_${formattedTabName}_${format(new Date(), 'dd-MM-yyyy')}.xlsx`);
    toast.success("Excel exportado com sucesso!");
  };

  const exportToPDF = (tabName: string) => {
    const doc = new jsPDF() as any;
    const formattedTabName = tabName.charAt(0).toUpperCase() + tabName.slice(1);
    const dateRangeStr = `Período: ${format(getDates().start, 'dd/MM/yyyy')} - ${format(getDates().end, 'dd/MM/yyyy')}`;
    
    // Header styling
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(249, 115, 22); // Orange primary
    doc.text("BelareStudio - BI Inteligente", 14, 20);
    
    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59); // Slate-800
    doc.text(`Relatório de Faturamento: ${formattedTabName}`, 14, 28);
    
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184); // Slate-400
    doc.text(`${dateRangeStr}  |  Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 34);
    
    doc.setDrawColor(241, 245, 249);
    doc.line(14, 38, 196, 38);
    
    if (tabName === 'servicos') {
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
      doc.text(`Faturamento Total de Serviços: R$ ${serviceStats.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 14, 46);
      doc.text(`Total de Atendimentos Realizados: ${serviceStats.totalQuantity}`, 14, 52);
      
      doc.setFontSize(12);
      doc.text("Faturamento por Categoria", 14, 62);
      
      const categoryRows = serviceStats.categories.map((c, index) => [
        `#${index + 1}`,
        c.name,
        String(c.quantity),
        `R$ ${Number(c.revenue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        `R$ ${(c.quantity > 0 ? c.revenue / c.quantity : 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        `${c.percentage.toFixed(1)}%`
      ]);
      
      autoTable(doc, {
        head: [['Posição', 'Categoria', 'Atendimentos', 'Faturamento', 'Ticket Médio', 'Participação']],
        body: categoryRows,
        startY: 66,
        theme: 'striped',
        headStyles: { fillColor: [30, 41, 59] },
        styles: { fontSize: 9 }
      });
      
      const finalY = (doc as any).lastAutoTable.finalY + 12;
      doc.setFontSize(12);
      doc.text("Ranking de Serviços", 14, finalY);
      
      const serviceRows = serviceStats.services.map((s, index) => [
        `#${index + 1}`,
        s.name,
        s.category,
        String(s.quantity),
        `R$ ${Number(s.revenue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        `${s.percentage.toFixed(1)}%`
      ]);
      
      autoTable(doc, {
        head: [['Posição', 'Serviço', 'Categoria', 'Atendimentos', 'Faturamento', 'Participação']],
        body: serviceRows,
        startY: finalY + 4,
        theme: 'striped',
        headStyles: { fillColor: [249, 115, 22] },
        styles: { fontSize: 8 }
      });
      
    } else if (tabName === 'executivo') {
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(30, 41, 59);
      doc.text("Resumo Estratégico do Período", 14, 46);

      const kpiRows = [
        ['Faturamento Realizado (Pago)', `R$ ${(data.income || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Porcentagem de Margem', `${(data.margin || 0).toFixed(2)}%`],
        ['Faturamento Projetado (Agenda/Comandas)', `R$ ${(data.potentialIncome || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Ticket Médio', `R$ ${(data.ticketMedio || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
        ['Despesas Totais do Período', `R$ ${(data.expense || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Total de Atendimentos', String(data.totalAppts || 0)],
        ['Lucro Líquido Realizado', `R$ ${(data.profit || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Atendimentos Concluídos', String(data.completedAppts || 0)],
        ['Agendamentos Online', String(data.onlineAppts || 0), 'Taxa Online', `${(data.onlineRate || 0).toFixed(1)}%`],
        ['Projeção Futura (Próximos 30 dias)', `R$ ${(upcomingData.projectedIncome || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Atendimentos Projetados', String(upcomingData.count || 0)]
      ];

      autoTable(doc, {
        head: [['Métrica Financeira', 'Valor', 'Métrica de Operação', 'Valor']],
        body: kpiRows,
        startY: 50,
        theme: 'grid',
        headStyles: { fillColor: [30, 41, 59] },
        styles: { fontSize: 9 }
      });

      const nextY = (doc as any).lastAutoTable.finalY + 12;
      doc.setFontSize(12);
      doc.text("Últimas Transações Financeiras", 14, nextY);

      const transRows = (data.transactions || []).slice(0, 15).map((t: any) => [
        t.date ? format(parseISO(t.date), 'dd/MM/yyyy') : '',
        t.description || 'Sem descrição',
        t.category || 'Sem categoria',
        t.type === 'income' ? 'Receita' : 'Despesa',
        `R$ ${(t.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      ]);

      autoTable(doc, {
        head: [['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor']],
        body: transRows,
        startY: nextY + 4,
        theme: 'striped',
        headStyles: { fillColor: [249, 115, 22] },
        styles: { fontSize: 8 }
      });

    } else if (tabName === 'financeiro') {
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(30, 41, 59);
      doc.text("Resumo Financeiro", 14, 46);

      const finKpis = [
        ['Faturamento Realizado (Receitas)', `R$ ${(data.income || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
        ['Custos / Despesas Totais', `R$ ${(data.expense || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
        ['Lucro Líquido Realizado', `R$ ${(data.profit || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
        ['Margem Líquida (%)', `${(data.margin || 0).toFixed(2)}%`]
      ];

      autoTable(doc, {
        head: [['Métrica Financeira', 'Valor']],
        body: finKpis,
        startY: 50,
        theme: 'grid',
        headStyles: { fillColor: [30, 41, 59] },
        styles: { fontSize: 9, fontStyle: 'bold' }
      });

      const finalFinY = (doc as any).lastAutoTable.finalY + 12;
      doc.setFontSize(12);
      doc.text("Faturamento Relacionado - fluxo de Transações", 14, finalFinY);

      const transRows = (data.transactions || []).map((t: any) => [
        t.date ? format(parseISO(t.date), 'dd/MM/yyyy') : '',
        t.description || 'Sem descrição',
        t.category || 'Sem categoria',
        t.type === 'income' ? 'Receita' : 'Despesa',
        t.payment_method || 'Não inf.',
        `R$ ${(t.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      ]);

      autoTable(doc, {
        head: [['Data', 'Descrição', 'Categoria', 'Tipo', 'Atendimento/Método', 'Valor']],
        body: transRows,
        startY: finalFinY + 4,
        theme: 'striped',
        headStyles: { fillColor: [249, 115, 22] },
        styles: { fontSize: 8 }
      });

    } else if (tabName === 'agenda') {
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(30, 41, 59);
      doc.text("Métricas de Agendamento", 14, 46);

      const agendaKpis = [
        ['Total de Atendimentos', String(data.totalAppts || 0), 'Agendamentos Online (Link)', String(data.onlineAppts || 0)],
        ['Taxa de Ocupação', `${(data.margin || 0).toFixed(1)}%`, 'Agendamentos Manuais', String((data.totalAppts || 0) - (data.onlineAppts || 0))]
      ];

      autoTable(doc, {
        head: [['Operação', 'Quantidade', 'Canal de Aquisição', 'Quantidade']],
        body: agendaKpis,
        startY: 50,
        theme: 'grid',
        headStyles: { fillColor: [30, 41, 59] },
        styles: { fontSize: 9 }
      });

      const finalAgendaY = (doc as any).lastAutoTable.finalY + 12;
      doc.setFontSize(12);
      doc.text("Lista de Atendimentos Detalhada", 14, finalAgendaY);

      const apptsRows = (data.appointments || []).map((a: any) => [
        a.date ? format(parseISO(a.date), 'dd/MM/yyyy HH:mm') : '',
        a.client_name || 'Sem cliente',
        a.professional_name || 'Sem profissional',
        a.service_name || 'Sem serviço',
        a.origin || 'interno',
        `R$ ${(a.value || a.price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        a.status || 'agendado'
      ]);

      autoTable(doc, {
        head: [['Data/Hora', 'Cliente', 'Colaborador', 'Serviço', 'Origem', 'Valor', 'Status']],
        body: apptsRows,
        startY: finalAgendaY + 4,
        theme: 'striped',
        headStyles: { fillColor: [249, 115, 22] },
        styles: { fontSize: 8 }
      });

    } else if (tabName === 'clientes') {
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(30, 41, 59);
      doc.text("LTV e Fidelidade de Clientes", 14, 46);

      const clientsWithOrigin = (data.appointments || []).reduce((acc: any[], app: any) => {
        if (!app.client_id) return acc;
        const existing = acc.find(c => c.id === app.client_id);
        if (existing) {
          existing.visits += 1;
          existing.totalSpent += Number(app.value || 0);
          if (app.origin === 'online' || app.origin === 'link') {
            existing.isOnline = true;
          }
        } else {
          acc.push({
            id: app.client_id,
            name: app.client_name,
            visits: 1,
            totalSpent: Number(app.value || 0),
            lastVisit: app.date,
            isOnline: app.origin === 'online' || app.origin === 'link'
          });
        }
        return acc;
      }, []).sort((a: any, b: any) => b.totalSpent - a.totalSpent);

      const clientRows = clientsWithOrigin.map((c: any, index: number) => [
        `#${index + 1}`,
        c.name || 'Sem nome',
        String(c.visits),
        `R$ ${(c.totalSpent || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        c.lastVisit ? format(parseISO(c.lastVisit), 'dd/MM/yyyy') : '',
        c.isOnline ? 'Sim' : 'Não'
      ]);

      autoTable(doc, {
        head: [['Rank', 'Cliente', 'Visitas no Período', 'LTV no Período', 'Último Atendimento', 'Agendou Online?']],
        body: clientRows,
        startY: 50,
        theme: 'striped',
        headStyles: { fillColor: [30, 41, 59] },
        styles: { fontSize: 9 }
      });

    } else if (tabName === 'equipe') {
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(30, 41, 59);
      doc.text("Performance por Colaborador", 14, 46);

      const teamRows = teamStats.map((p: any, index: number) => [
        `#${index + 1}`,
        p.name,
        String(p.count),
        `R$ ${(p.revenue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        `R$ ${(p.projectedRevenue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        `R$ ${(p.ticket || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        `R$ ${(p.commission || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      ]);

      autoTable(doc, {
        head: [['Rank', 'Colaborador', 'Atendimentos', 'Faturamento Realizado', 'Faturamento Projetado', 'Ticket Médio', 'Comissão Estimada']],
        body: teamRows,
        startY: 50,
        theme: 'striped',
        headStyles: { fillColor: [30, 41, 59] },
        styles: { fontSize: 8 }
      });

    } else {
      doc.setFontSize(14);
      doc.text(`Relatório de ${formattedTabName}`, 14, 45);
      
      const tableData = data.transactions.map((t: any) => [
        format(parseISO(t.date), 'dd/MM/yyyy'),
        t.description || t.category || 'Sem descrição',
        t.type === 'income' ? 'Receita' : 'Despesa',
        `R$ ${Number(t.amount).toLocaleString('pt-BR')}`
      ]);

      autoTable(doc, {
        head: [['Data', 'Descrição', 'Tipo', 'Valor']],
        body: tableData,
        startY: 55
      });
    }

    doc.save(`Relatorio_Faturamento_${formattedTabName}_${format(new Date(), 'dd-MM-yyyy')}.pdf`);
    toast.success("PDF exportado com sucesso!");
  };

  // --- Render Helpers ---

  const teamStats = useMemo(() => {
    if (!data || !availableProfessionals) return [];
    
    const servicesMap = new Map(services.map(s => [s.id, s.preco]));

    return availableProfessionals.map(p => {
      const pAppts = data.appointments.filter((a: any) => {
        const aProfId = String(a.professional_id || a.professional?.id || '').trim();
        const pId = String(p.id || '').trim();
        return aProfId === pId && a.status !== 'bloqueado';
      });

      const pTrans = data.transactions.filter((t: any) => {
        const tProfId = String(t.professionalId || t.professional_id || '').trim();
        const pId = String(p.id || '').trim();
        return tProfId === pId && (t.type === 'income' || t.type === 'receita');
      });
      
      // Calculate revenue (Realizado) from completed (concluido) appointments
      const completedRevenue = pAppts.filter((a: any) => {
        const s = String(a.status || '').toLowerCase().trim();
        return s === 'concluido';
      }).reduce((acc: number, a: any) => {
        const resolved = getServicesForAppointment(a, services);
        const valFromServices = resolved.reduce((sum: number, s: any) => sum + (s.preco || 0), 0);
        return acc + (a.value || a.price || valFromServices || 0);
      }, 0);

      // Support transactional income directly mapped to this professional (direct product sales, etc.)
      const transRevenue = pTrans.reduce((acc: number, t: any) => acc + Number(t.amount || 0), 0);
      
      const revenue = Math.max(completedRevenue, transRevenue);
      
      // Calculate projected revenue for this professional based on their appointments
      const projectedRevenue = pAppts.filter((a: any) => {
        const s = String(a.status || '').toLowerCase().trim();
        return s !== 'cancelado';
      }).reduce((acc: number, a: any) => {
        const resolved = getServicesForAppointment(a, services);
        const valFromServices = resolved.reduce((sum: number, s: any) => sum + (s.preco || 0), 0);
        return acc + (a.value || a.price || valFromServices || 0);
      }, 0);

      const count = pAppts.length;
      const ticket = count > 0 ? revenue / count : 0;
      const rate = Number(p.commission_rate ?? p.commission_percent ?? 30);
      const commission = revenue * (rate / 100);

      return {
        ...p,
        count,
        revenue,
        projectedRevenue,
        ticket,
        commission
      };
    }).sort((a: any, b: any) => b.revenue - a.revenue);
  }, [data, availableProfessionals, services]);

  const serviceStats = useMemo(() => {
    if (!data?.appointments || !services) {
      return { 
        services: [], 
        categories: [], 
        totalRevenue: 0, 
        totalQuantity: 0, 
        topCategory: null, 
        topService: null 
      };
    }
    
    const statsMap: { [id_or_name: string]: { id: number | string; name: string; category: string; quantity: number; revenue: number } } = {};
    const categoryStatsMap: { [catName: string]: { name: string; quantity: number; revenue: number } } = {};

    let totalServiceRevenue = 0;
    let totalServiceQuantity = 0;

    // Base with all active services so everything displays properly with 0 if no scheduling
    services.forEach((s: any) => {
      statsMap[s.id] = {
        id: s.id,
        name: s.nome,
        category: s.categoria || 'Sem Categoria',
        quantity: 0,
        revenue: 0
      };
    });

    const servicesMap = new Map(services.map(s => [s.id, s]));

    data.appointments.forEach((a: any) => {
      if (a.type === 'block' || a.status === 'cancelado') return;
      
      // Filter for status toggle
      if (serviceStatusFilter === 'only_completed' && a.status !== 'concluido') return;

      const resolved = getServicesForAppointment(a, services);

      if (resolved.length > 0) {
        const sumPrices = resolved.reduce((sum: number, s: any) => sum + (s.preco || 0), 0);
        const appointmentValue = a.value || a.price || sumPrices || 0;

        resolved.forEach((s: any) => {
          const sPrice = s.preco || 0;
          const sId = s.id || s.nome;
          const sName = s.nome;
          const sCat = s.categoria || 'Sem Categoria';

          const attributedVal = sumPrices > 0 ? (sPrice / sumPrices) * appointmentValue : appointmentValue / resolved.length;

          if (!statsMap[sId]) {
            statsMap[sId] = { id: sId, name: sName, category: sCat, quantity: 0, revenue: 0 };
          }

          statsMap[sId].quantity += 1;
          statsMap[sId].revenue += attributedVal;
          totalServiceRevenue += attributedVal;
          totalServiceQuantity += 1;

          if (!categoryStatsMap[sCat]) {
            categoryStatsMap[sCat] = { name: sCat, quantity: 0, revenue: 0 };
          }
          categoryStatsMap[sCat].quantity += 1;
          categoryStatsMap[sCat].revenue += attributedVal;
        });
      }
    });

    const servicesList = Object.values(statsMap)
      .map(s => ({
        ...s,
        percentage: totalServiceRevenue > 0 ? (s.revenue / totalServiceRevenue) * 100 : 0
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const categoriesList = Object.values(categoryStatsMap)
      .map(c => ({
        ...c,
        percentage: totalServiceRevenue > 0 ? (c.revenue / totalServiceRevenue) * 100 : 0
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const topCategory = categoriesList.length > 0 ? categoriesList[0] : null;
    const topService = servicesList.length > 0 ? (servicesList.filter(s => s.revenue > 0)[0] || servicesList[0]) : null;

    return {
      services: servicesList,
      categories: categoriesList,
      totalRevenue: totalServiceRevenue,
      totalQuantity: totalServiceQuantity,
      topCategory,
      topService
    };
  }, [data, services, serviceStatusFilter]);

  const handleCloseModal = () => {
    setSelectedProfDetails(null);
    setModalSearch('');
    setModalStatusFilter('todos');
  };

  const exportCollaboratorExcel = () => {
    if (!selectedProfDetails || modalAppointments.length === 0) {
      toast.error('Nenhum dado para exportar.');
      return;
    }
    
    const activeStudio = studios?.find(s => s.id === activeStudioId);
    const studioName = activeStudio?.name || 'BelareStudio';

    // 1. Prepare data rows
    const rows = modalAppointments.map((a: any) => {
      const clientName = a.client_name || a.client?.nome || 'Cliente Avulso';
      const parsedDate = typeof a.date === 'string' ? parseISO(a.date) : new Date(a.date);
      const formattedDate = format(parsedDate, "dd/MM/yyyy HH:mm");
      
      const resolved = getServicesForAppointment(a, services);
      const serviceNames = resolved.map((s: any) => s.nome).filter(Boolean).join(', ') || 'Serviço';
      
      const valFromServices = resolved.reduce((sum: number, s: any) => sum + (s.preco || 0), 0);
      const appointmentValue = a.value || a.price || valFromServices || 0;
      const statusLabel = statusMeta[a.status]?.label || a.status || 'Agendado';
      
      return {
        'Cliente': clientName,
        'Data / Horário': formattedDate,
        'Serviço(s)': serviceNames,
        'Status': statusLabel,
        'Valor (R$)': appointmentValue
      };
    });

    const summaryData = [
      { 'Cliente': 'RELATÓRIO DE ATENDIMENTOS' },
      { 'Cliente': `Unidade: ${studioName}` },
      { 'Cliente': `Colaborador(a): ${selectedProfDetails.name}` },
      { 'Cliente': `Período: ${format(getDates().start, 'dd/MM/yyyy')} até ${format(getDates().end, 'dd/MM/yyyy')}` },
      { 'Cliente': '' },
      { 'Cliente': 'RESUMO FINANCEIRO' },
      { 'Cliente': 'Atendimentos Totais', 'Data / Horário': selectedProfDetails.count },
      { 'Cliente': 'Realizado (Pago)', 'Data / Horário': selectedProfDetails.revenue },
      { 'Cliente': 'Projetado (Agenda)', 'Data / Horário': selectedProfDetails.projectedRevenue },
      { 'Cliente': 'Comissão Est.', 'Data / Horário': selectedProfDetails.commission },
      { 'Cliente': '' },
      { 'Cliente': 'LISTAGEM DE ATENDIMENTOS' },
      ...rows
    ];

    const ws = XLSX.utils.json_to_sheet(summaryData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Relatório');
    
    // Set widths
    const wscols = [
      {wch: 35}, // Cliente / Campo
      {wch: 22}, // Data / Valor resumo
      {wch: 35}, // Serviço
      {wch: 15}, // Status
      {wch: 15}, // Valor
    ];
    ws['!cols'] = wscols;

    const fileName = `Relatorio_${selectedProfDetails.name.replace(/\s+/g, '_')}_${format(new Date(), 'dd-MM-yyyy')}.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast.success('Excel exportado com sucesso!');
  };

  const exportCollaboratorPDF = () => {
    if (!selectedProfDetails || modalAppointments.length === 0) {
      toast.error('Nenhum dado para exportar.');
      return;
    }

    const doc = new jsPDF() as any;
    const activeStudio = studios?.find(s => s.id === activeStudioId);
    const studioName = activeStudio?.name || 'BelareStudio';

    // Title / Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(studioName.toUpperCase(), 14, 18);
    
    doc.setFontSize(13);
    doc.setFont("helvetica", "normal");
    doc.text('Relatório de Atendimentos de Colaborador', 14, 25);
    
    // Period & Name info
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`Colaborador(a):`, 14, 34);
    doc.setFont("helvetica", "normal");
    doc.text(selectedProfDetails.name, 43, 34);

    doc.setFont("helvetica", "bold");
    doc.text(`Período:`, 14, 39);
    doc.setFont("helvetica", "normal");
    doc.text(`${format(getDates().start, 'dd/MM/yyyy')} até ${format(getDates().end, 'dd/MM/yyyy')}`, 32, 39);

    doc.setFont("helvetica", "bold");
    doc.text(`Filtro de Status:`, 14, 44);
    doc.setFont("helvetica", "normal");
    const statusLabels: Record<string, string> = { todos: 'Todos', concluidos: 'Concluídos', pendentes: 'Não Finalizados', cancelados: 'Cancelados' };
    doc.text(statusLabels[modalStatusFilter] || 'Todos', 44, 44);

    // Mini Stats Box
    doc.setFillColor(248, 250, 252); // bg-slate-50
    doc.rect(14, 49, 182, 22, "F");
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text("ATENDIMENTOS", 18, 55);
    doc.text("REALIZADO (PAGO)", 62, 55);
    doc.text("PROJETADO (AGENDA)", 110, 55);
    doc.text("COMISSÃO EST.", 158, 55);

    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59); // slate-800
    doc.text(String(selectedProfDetails.count), 18, 63);
    
    doc.setTextColor(16, 185, 129); // emerald-600
    doc.text(`R$ ${selectedProfDetails.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 62, 63);
    
    doc.setTextColor(37, 99, 235); // blue-600
    doc.text(`R$ ${selectedProfDetails.projectedRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 110, 63);
    
    doc.setTextColor(225, 29, 72); // rose-600
    doc.text(`R$ ${selectedProfDetails.commission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 158, 63);

    // Prepare table lines
    const tableData = modalAppointments.map((a: any) => {
      const clientName = a.client_name || a.client?.nome || 'Cliente Avulso';
      const parsedDate = typeof a.date === 'string' ? parseISO(a.date) : new Date(a.date);
      const formattedDate = format(parsedDate, "dd/MM/yyyy HH:mm");
      
      const resolved = getServicesForAppointment(a, services);
      const serviceNames = resolved.map((s: any) => s.nome).filter(Boolean).join(', ') || 'Serviço';
      
      const valFromServices = resolved.reduce((sum: number, s: any) => sum + (s.preco || 0), 0);
      const appointmentValue = a.value || a.price || valFromServices || 0;
      const statusLabel = statusMeta[a.status]?.label || a.status || 'Agendado';

      return [
        clientName,
        formattedDate,
        serviceNames,
        statusLabel,
        `R$ ${appointmentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      ];
    });

    autoTable(doc, {
      head: [['Cliente', 'Data / Horário', 'Serviço(s)', 'Status', 'Valor']],
      body: tableData,
      startY: 77,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 41, 59], // slate-800
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
        halign: 'left'
      },
      columnStyles: {
        0: { cellWidth: 42 },
        1: { cellWidth: 32 },
        2: { cellWidth: 55 },
        3: { cellWidth: 28, halign: 'center' },
        4: { cellWidth: 25, halign: 'right' }
      },
      styles: {
        fontSize: 8.5,
        font: "helvetica",
        cellPadding: 3
      },
      alternateRowStyles: {
        fillColor: [250, 251, 252]
      }
    });

    const fileName = `Relatorio_${selectedProfDetails.name.replace(/\s+/g, '_')}_${format(new Date(), 'dd-MM-yyyy')}.pdf`;
    doc.save(fileName);
    toast.success('PDF exportado com sucesso!');
  };

  const modalAppointments = useMemo(() => {
    if (!selectedProfDetails || !data) return [];
    
    // 1. Get all appointments for this professional (excluding blocked slots/blocks)
    let appts = data.appointments.filter((a: any) => {
      const aProfId = String(a.professional_id || a.professional?.id || '').trim();
      const sProfId = String(selectedProfDetails.id || '').trim();
      return aProfId === sProfId && a.status !== 'bloqueado';
    });
    
    // 2. Filter by status
    if (modalStatusFilter !== 'todos') {
      appts = appts.filter((a: any) => {
        const s = String(a.status || '').toLowerCase().trim();
        if (modalStatusFilter === 'concluidos') {
          return s === 'concluido';
        } else if (modalStatusFilter === 'confirmados') {
          return s === 'confirmado' || s === 'confirmado_whatsapp';
        } else if (modalStatusFilter === 'cancelados') {
          return s === 'cancelado';
        } else if (modalStatusFilter === 'pendentes') {
          return s !== 'concluido' && s !== 'cancelado' && s !== 'confirmado' && s !== 'confirmado_whatsapp';
        }
        return true;
      });
    }
    
    // 3. Filter by search query (client name or service name)
    if (modalSearch.trim()) {
      const q = modalSearch.toLowerCase();
      appts = appts.filter((a: any) => {
        const clientName = (a.client_name || a.client?.nome || '').toLowerCase();
        
        // resolve service names
        const resolved = getServicesForAppointment(a, services);
        const serviceNames = (resolved.map((s: any) => s.nome).join(' ')).toLowerCase();
        
        return clientName.includes(q) || serviceNames.includes(q);
      });
    }
    
    // Sort chronologically (latest to earliest, i.e., date descending to see most recent first)
    return appts.sort((a: any, b: any) => {
      const d1 = typeof a.date === 'string' ? parseISO(a.date) : new Date(a.date);
      const d2 = typeof b.date === 'string' ? parseISO(b.date) : new Date(b.date);
      return d2.getTime() - d1.getTime();
    });
  }, [selectedProfDetails, data, modalStatusFilter, modalSearch, services]);

  const renderFilters = () => (
    <div className="bg-white p-4 md:p-6 rounded-[32px] border border-slate-100 shadow-sm mb-8 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 md:gap-6">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 overflow-x-auto scrollbar-hide">
          <div className="flex gap-1">
            {[
              { id: 'today', label: 'Hoje' },
              { id: '7d', label: '7d' },
              { id: '30d', label: '30d' },
              { id: '3m', label: '3m' },
              { id: 'custom', label: 'Personalizado' }
            ].map(p => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id as Period)}
                className={`px-3 md:px-4 py-2 text-[9px] md:text-[10px] font-black uppercase tracking-widest rounded-xl transition-all whitespace-nowrap ${period === p.id ? 'bg-white shadow-md text-orange-600' : 'text-slate-500 hover:text-slate-800'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {period === 'custom' && (
          <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
            <input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} className="bg-transparent border-none text-[10px] font-bold text-slate-600 outline-none px-2 flex-1" />
            <span className="text-slate-300 text-[10px] font-bold">até</span>
            <input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} className="bg-transparent border-none text-[10px] font-bold text-slate-600 outline-none px-2 flex-1" />
          </div>
        )}

        <div className="flex items-center justify-between sm:justify-start gap-4">
          <label className="flex items-center gap-3 cursor-pointer group">
            <div className={`w-10 h-5 rounded-full relative transition-colors ${compareWithPrevious ? 'bg-orange-500' : 'bg-slate-200'}`} onClick={() => setCompareWithPrevious(!compareWithPrevious)}>
              <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${compareWithPrevious ? 'left-6' : 'left-1'}`} />
            </div>
            <span className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase group-hover:text-slate-600 transition-colors">Comparar</span>
          </label>

          {/* Filtro de Profissional */}
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-2xl border border-slate-200">
            <span className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase">Profissional:</span>
            <select
              value={selectedProfessionals[0] || 'all'}
              onChange={e => {
                const val = e.target.value;
                setSelectedProfessionals(val === 'all' ? [] : [val]);
              }}
              className="bg-transparent border-none text-[10px] font-bold text-slate-700 outline-none cursor-pointer focus:ring-0 py-0.5"
            >
              <option value="all">TODOS</option>
              {availableProfessionals.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 md:gap-3">
        <button onClick={() => exportToPDF(activeTab)} className="flex-1 sm:flex-none p-2.5 md:p-3 bg-slate-50 text-slate-600 rounded-2xl hover:bg-slate-100 transition-all flex items-center justify-center gap-2" title="Exportar PDF">
          <FileText size={18} className="md:w-5 md:h-5" />
          <span className="text-[9px] font-black uppercase sm:hidden">PDF</span>
        </button>
        <button onClick={() => exportToCSV(activeTab)} className="flex-1 sm:flex-none p-2.5 md:p-3 bg-slate-50 text-slate-600 rounded-2xl hover:bg-slate-100 transition-all flex items-center justify-center gap-2" title="Exportar Excel">
          <FileSpreadsheet size={18} className="md:w-5 md:h-5" />
          <span className="text-[9px] font-black uppercase sm:hidden">Excel</span>
        </button>
        <button onClick={fetchData} className="flex-1 sm:flex-none p-2.5 md:p-3 bg-orange-500 text-white rounded-2xl shadow-lg shadow-orange-100 hover:bg-orange-600 active:scale-95 transition-all flex items-center justify-center gap-2">
          <RefreshCw size={18} className={`${isLoading ? 'animate-spin' : ''} md:w-5 md:h-5`} />
          <span className="text-[9px] font-black uppercase sm:hidden">Atualizar</span>
        </button>
      </div>
    </div>
  );

  const renderExecutivo = () => (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
      {/* AI Health Check Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-[32px] md:rounded-[40px] p-6 md:p-10 text-white relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 p-12 opacity-10 group-hover:scale-110 transition-transform">
          <Zap size={150} />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="space-y-4 text-center md:text-left">
            <div className="inline-flex items-center gap-2 bg-orange-500/20 text-orange-400 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.3em] border border-orange-500/30">
              <Sparkles size={14} fill="currentColor" /> Monitoramento de Saúde do Negócio
            </div>
            <h2 className="text-3xl md:text-5xl font-black tracking-tighter leading-none">
              Seu estúdio está <span className="text-emerald-400">crescendo 12%</span> acima da média.
            </h2>
            <p className="text-slate-400 font-medium max-w-xl text-sm md:text-base">
              A Jaci detectou que sua retenção de clientes aumentou 5.4% este mês. <br className="hidden md:block" /> Recomendo focar no Ticket Médio nas próximas duas semanas.
            </p>
          </div>
          <div className="flex gap-4">
            <button className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-orange-500/20">Ver Estratégia</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
        <KPICard title="Faturamento Realizado (Pago)" value={`R$ ${data?.income.toLocaleString('pt-BR')}`} trend={metrics?.incomeTrend} color="bg-emerald-500" icon={DollarSign} loading={isLoading} />
        <KPICard title="Faturamento Projetado (Agenda)" value={`R$ ${data?.potentialIncome.toLocaleString('pt-BR')}`} color="bg-blue-600" icon={Target} subtext="Total da agenda no período" loading={isLoading} />
        <KPICard title="Projeção Futura (30 dias)" value={`R$ ${upcomingData?.projectedIncome.toLocaleString('pt-BR') || '0'}`} color="bg-indigo-600" icon={TrendingUp} subtext={`${upcomingData?.count || 0} agendamentos futuros`} loading={isLoading} />
        <KPICard title="Ticket Médio" value={`R$ ${data?.ticketMedio.toFixed(2)}`} trend={metrics?.ticketTrend} color="bg-slate-700" icon={Layers} loading={isLoading} />
        <KPICard title="Atendimentos Total" value={data?.totalAppts} trend={metrics?.apptsTrend} color="bg-orange-500" icon={Calendar} loading={isLoading} />
        <KPICard title="Taxa Ocupação" value={`${data?.margin.toFixed(1)}%`} color="bg-slate-800" icon={Target} loading={isLoading} />
        <KPICard title="Novos Clientes" value="12" trend={15} color="bg-cyan-500" icon={UserPlus} loading={isLoading} />
        <KPICard title="Margem de Lucro" value={`${data?.margin.toFixed(1)}%`} color="bg-rose-500" icon={Percent} loading={isLoading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
        <div className="bg-white p-6 md:p-8 rounded-[32px] md:rounded-[40px] border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-6 md:mb-8">
            <h3 className="text-base md:text-lg font-black text-slate-800 uppercase tracking-tighter">Evolução do Faturamento</h3>
            <TrendingUp className="text-emerald-500" size={20} />
          </div>
          <div className="h-64 md:h-80">
            {metrics?.evolution && metrics.evolution.length > 0 ? (
              <D3RevenueEvolutionChart data={metrics.evolution} />
            ) : (
              <div className="h-full flex items-center justify-center">
                <EmptyState />
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-6 md:p-8 rounded-[32px] md:rounded-[40px] border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-6 md:mb-8">
            <h3 className="text-base md:text-lg font-black text-slate-800 uppercase tracking-tighter">Receita por Categoria</h3>
            <PieChartIcon className="text-indigo-500" size={20} />
          </div>
          <div className="h-64 md:h-80">
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
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        <KPICard title="Faturamento Bruto" value={`R$ ${data?.income.toLocaleString('pt-BR')}`} color="bg-emerald-500" icon={DollarSign} loading={isLoading} />
        <KPICard title="Custos Totais" value={`R$ ${data?.expense.toLocaleString('pt-BR')}`} color="bg-rose-500" icon={TrendingDown} loading={isLoading} />
        <KPICard title="Lucro Líquido" value={`R$ ${data?.profit.toLocaleString('pt-BR')}`} color="bg-indigo-500" icon={TrendingUp} loading={isLoading} />
      </div>

      <div className="bg-white rounded-[32px] md:rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 md:p-8 border-b border-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h3 className="text-base md:text-lg font-black text-slate-800 uppercase tracking-tighter">Fluxo de Caixa Detalhado</h3>
          <div className="flex gap-2">
            <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[9px] md:text-[10px] font-black uppercase">Receitas</span>
            <span className="px-3 py-1 bg-rose-50 text-rose-600 rounded-full text-[9px] md:text-[10px] font-black uppercase">Despesas</span>
          </div>
        </div>

        {/* Mobile: cards */}
        <div className="md:hidden divide-y divide-slate-50">
          {data?.transactions.length > 0 ? data.transactions.map((t: any) => (
            <div key={t.id} className="p-4 hover:bg-slate-50/50 transition-colors">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-sm font-black text-slate-800">{t.description || 'Sem descrição'}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">{format(parseISO(t.date), 'dd/MM/yyyy')}</p>
                </div>
                <p className={`text-sm font-black ${t.type === 'income' || t.type === 'receita' ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {t.type === 'income' || t.type === 'receita' ? '+' : '-'} R$ {Number(t.amount).toLocaleString('pt-BR')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-slate-100 rounded-lg text-[9px] font-black text-slate-500 uppercase">
                  {t.category || 'Geral'}
                </span>
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${t.type === 'income' || t.type === 'receita' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  <span className={`text-[9px] font-black uppercase ${t.type === 'income' || t.type === 'receita' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {t.type === 'income' || t.type === 'receita' ? 'Receita' : 'Despesa'}
                  </span>
                </div>
              </div>
            </div>
          )) : (
            <div className="py-12"><EmptyState /></div>
          )}
        </div>

        {/* Desktop: table */}
        <div className="hidden md:block overflow-x-auto">
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
      const online = dayAppts.filter((a: any) => a.origin === 'online' || a.origin === 'link').length;
      const manual = dayAppts.length - online;
      return { name: format(day, 'dd/MM'), online, manual };
    }).filter(d => d.online > 0 || d.manual > 0);

    return (
      <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <KPICard title="Total Atendimentos" value={data?.totalAppts} color="bg-orange-500" icon={Calendar} loading={isLoading} />
          <KPICard title="Agendamentos Online" value={data?.onlineAppts} color="bg-purple-500" icon={Globe} loading={isLoading} />
          <KPICard title="Taxa de Ocupação" value={`${data?.margin.toFixed(1)}%`} color="bg-indigo-500" icon={Target} loading={isLoading} />
          <KPICard title="Tempo Médio" value="45 min" color="bg-slate-800" icon={Clock} loading={isLoading} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
          <div className="bg-white p-6 md:p-8 rounded-[32px] md:rounded-[40px] border border-slate-100 shadow-sm">
            <h3 className="text-base md:text-lg font-black text-slate-800 uppercase tracking-tighter mb-6 md:mb-8">Online vs Manual</h3>
            <div className="h-64 md:h-80">
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

          <div className="bg-white p-6 md:p-8 rounded-[32px] md:rounded-[40px] border border-slate-100 shadow-sm">
            <h3 className="text-base md:text-lg font-black text-slate-800 uppercase tracking-tighter mb-6 md:mb-8">Ocupação por Dia da Semana</h3>
            <div className="h-64 md:h-80">
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
        if (app.origin === 'online' || app.origin === 'link') {
          existing.isOnline = true;
        }
      } else {
        acc.push({
          id: app.client_id,
          name: app.client_name,
          visits: 1,
          totalSpent: Number(app.value || 0),
          lastVisit: app.date,
          isOnline: app.origin === 'online' || app.origin === 'link'
        });
      }
      return acc;
    }, []).sort((a: any, b: any) => b.totalSpent - a.totalSpent).slice(0, 10);

    return (
      <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          <KPICard title="Clientes Ativos" value="450" color="bg-orange-500" icon={Users} loading={isLoading} />
          <KPICard title="Novos Clientes" value="28" color="bg-emerald-500" icon={UserPlus} loading={isLoading} />
          <KPICard title="Taxa de Retorno" value="72%" color="bg-indigo-500" icon={RotateCcw} loading={isLoading} />
        </div>

        <div className="bg-white rounded-[32px] md:rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 md:p-8 border-b border-slate-50">
            <h3 className="text-base md:text-lg font-black text-slate-800 uppercase tracking-tighter">Top 10 Clientes (LTV)</h3>
          </div>

          {/* Mobile: cards */}
          <div className="md:hidden divide-y divide-slate-50">
            {clientsWithOrigin?.length > 0 ? clientsWithOrigin.map((c: any) => (
              <div key={c.id} className="p-4 hover:bg-slate-50/50 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-[10px] font-black">
                      {c.name?.charAt(0) || 'C'}
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-800">{c.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">{c.visits} visitas • {format(parseISO(c.lastVisit), 'dd/MM/yy')}</p>
                    </div>
                  </div>
                  <p className="text-sm font-black text-emerald-600">R$ {c.totalSpent.toLocaleString('pt-BR')}</p>
                </div>
                <div>
                  {c.isOnline ? (
                    <span className="px-2 py-0.5 bg-purple-50 text-purple-600 rounded-lg text-[9px] font-black uppercase flex items-center gap-1 w-fit">
                      <Globe size={10} /> Online
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-slate-50 text-slate-500 rounded-lg text-[9px] font-black uppercase flex items-center gap-1 w-fit">
                      <User size={10} /> Manual
                    </span>
                  )}
                </div>
              </div>
            )) : (
              <div className="py-12"><EmptyState /></div>
            )}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block overflow-x-auto">
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

  const renderServicos = () => {
    // Filter services based on serviceSearchQuery
    const filteredServices = serviceStats.services.filter(s => {
      const q = serviceSearchQuery.toLowerCase().trim();
      return s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q);
    });

    const categoriesByTicketMedio = [...serviceStats.categories]
      .map(c => ({
        ...c,
        ticketMedio: c.quantity > 0 ? c.revenue / c.quantity : 0
      }))
      .sort((a, b) => b.ticketMedio - a.ticketMedio);

    const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4', '#14b8a6', '#6366f1', '#f43f5e', '#a855f7'];

    // Slices for Pie Chart - categories with revenue > 0
    const pieData = serviceStats.categories
      .filter(c => c.revenue > 0)
      .map(c => ({
        name: c.name,
        value: Number(c.revenue.toFixed(2)),
        percentage: c.percentage
      }));

    // Data for bar chart: top 8 services with revenue > 0
    const barData = serviceStats.services
      .filter(s => s.revenue > 0)
      .slice(0, 8)
      .map(s => ({
        name: s.name.length > 18 ? s.name.substring(0, 16) + '...' : s.name,
        fullName: s.name,
        'Faturamento': Number(s.revenue.toFixed(2))
      }));

    return (
      <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
        
        {/* Sub-header Controls specific to Services view */}
        <div className="bg-white p-4 md:p-6 rounded-[24px] md:rounded-[32px] border border-slate-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none self-center">Base de Cálculo:</span>
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => setServiceStatusFilter('only_completed')}
                className={`px-3 py-1.5 text-[9px] md:text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${serviceStatusFilter === 'only_completed' ? 'bg-white shadow-sm text-slate-900 border border-slate-200/50' : 'text-slate-400 hover:text-slate-700'}`}
              >
                Concluídos (Real)
              </button>
              <button
                onClick={() => setServiceStatusFilter('all_active')}
                className={`px-3 py-1.5 text-[9px] md:text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${serviceStatusFilter === 'all_active' ? 'bg-white shadow-sm text-slate-900 border border-slate-200/50' : 'text-slate-400 hover:text-slate-700'}`}
              >
                Ativos (Previsão)
              </button>
            </div>
          </div>
          
          <div className="relative w-full md:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search size={16} />
            </div>
            <input
              type="text"
              placeholder="Pesquisar serviço ou categoria..."
              value={serviceSearchQuery}
              onChange={e => setServiceSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 placeholder-slate-400"
            />
            {serviceSearchQuery && (
              <button onClick={() => setServiceSearchQuery('')} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Highlight KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <KPICard 
            title="Receita de Serviços" 
            value={`R$ ${serviceStats.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
            color="bg-emerald-500" 
            icon={Coins} 
            loading={isLoading} 
          />
          <KPICard 
            title="Total de Serviços" 
            value={serviceStats.totalQuantity} 
            subtext="Atendimentos contabilizados" 
            color="bg-blue-500" 
            icon={Scissors} 
            loading={isLoading} 
          />
          <KPICard 
            title="Categoria Líder" 
            value={serviceStats.topCategory ? serviceStats.topCategory.name : 'N/A'} 
            subtext={serviceStats.topCategory ? `R$ ${serviceStats.topCategory.revenue.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} (${serviceStats.topCategory.percentage.toFixed(1)}%)` : 'Sem registros'} 
            color="bg-indigo-500" 
            icon={Layers} 
            loading={isLoading} 
          />
          <KPICard 
            title="Serviço Campeão" 
            value={serviceStats.topService ? serviceStats.topService.name : 'N/A'} 
            subtext={serviceStats.topService ? `R$ ${serviceStats.topService.revenue.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} (${serviceStats.topService.percentage.toFixed(1)}%)` : 'Sem registros'} 
            color="bg-orange-500" 
            icon={Zap} 
            loading={isLoading} 
          />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Pie Chart: Categories */}
          <div className="bg-white p-6 md:p-8 rounded-[32px] md:rounded-[40px] border border-slate-100 shadow-sm">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight mb-6">FATURAMENTO POR CATEGORIA (%)</h3>
            {pieData.length > 0 ? (
              <div className="h-80 flex flex-col md:flex-row items-center justify-center gap-4">
                <div className="w-full md:w-1/2 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: any) => [`R$ ${Number(value).toLocaleString('pt-BR')}`, 'Faturamento']}
                        contentStyle={{ borderRadius: '16px', border: '1px solid #f1f5f9', fontWeight: 'bold' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full md:w-1/2 overflow-y-auto max-h-64 space-y-1.5 pr-2 custom-scrollbar">
                  {pieData.map((entry, index) => (
                    <div key={entry.name} className="flex items-center justify-between text-xs font-bold text-slate-600 p-2 rounded-xl hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-2 truncate">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                        <span className="truncate">{entry.name}</span>
                      </div>
                      <span className="shrink-0 font-black text-slate-800 ml-2">
                        {entry.percentage.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-80 flex items-center justify-center"><EmptyState /></div>
            )}
          </div>

          {/* Bar Chart: Services */}
          <div className="bg-white p-6 md:p-8 rounded-[32px] md:rounded-[40px] border border-slate-100 shadow-sm">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight mb-6">TOP 8 SERVIÇOS MAIS FATURADOS</h3>
            {barData.length > 0 ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} fontWeight="bold" tickLine={false} axisLine={false} />
                    <YAxis 
                      stroke="#94a3b8" 
                      fontSize={9} 
                      fontWeight="bold" 
                      tickLine={false} 
                      axisLine={false}
                      tickFormatter={(value) => `R$ ${value}`}
                    />
                    <Tooltip 
                      formatter={(value: any) => [`R$ ${Number(value).toLocaleString('pt-BR')}`, 'Faturamento']}
                      contentStyle={{ borderRadius: '16px', border: '1px solid #f1f5f9', fontWeight: 'bold' }}
                    />
                    <Bar dataKey="Faturamento" radius={[8, 8, 0, 0]}>
                      {barData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-80 flex items-center justify-center"><EmptyState /></div>
            )}
          </div>
        </div>

        {/* Detailed Lists */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-8">
          
          {/* Left / Column 1: Categories Breakdown List */}
          <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden lg:col-span-1 xl:col-span-1 h-fit">
            <div className="p-6 md:p-8 border-b border-slate-50 flex items-center justify-between">
              <h3 className="font-black text-slate-800 text-sm uppercase">Faturamento de Categorias</h3>
              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-black uppercase">
                {serviceStats.categories.length} Grupos
              </span>
            </div>
            <div className="divide-y divide-slate-50 max-h-[500px] overflow-y-auto custom-scrollbar">
              {serviceStats.categories.length > 0 ? serviceStats.categories.map((c, index) => (
                <div key={c.name} className="p-4 md:p-5 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-center gap-3 truncate pr-2">
                    <span className={`w-6 h-6 rounded-lg text-[10px] font-black flex items-center justify-center border ${index === 0 ? 'bg-orange-50 border-orange-200 text-orange-600' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                      {index + 1}
                    </span>
                    <div className="truncate">
                      <p className="text-xs font-black text-slate-800 truncate">{c.name}</p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase">{c.quantity} atendimentos</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-black text-slate-800">R$ {c.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    <p className="text-[9px] text-emerald-600 font-black tracking-widest">{c.percentage.toFixed(1)}%</p>
                  </div>
                </div>
              )) : (
                <div className="py-12"><EmptyState /></div>
              )}
            </div>
          </div>

          {/* Center / Column 2: Ticket Médio por Categoria List */}
          <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden lg:col-span-1 xl:col-span-1 h-fit animate-in fade-in duration-300">
            <div className="p-6 md:p-8 border-b border-slate-50 flex items-center justify-between">
              <div>
                <h3 className="font-black text-slate-800 text-sm uppercase">Ticket Médio</h3>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Por categoria de serviço</p>
              </div>
              <span className="p-1 px-2.5 bg-indigo-50 text-indigo-600 rounded-full text-[9px] font-black uppercase tracking-wider">
                Consumo
              </span>
            </div>
            <div className="divide-y divide-slate-50 max-h-[500px] overflow-y-auto custom-scrollbar">
              {categoriesByTicketMedio.length > 0 ? categoriesByTicketMedio.map((c, index) => (
                <div key={c.name} className="p-4 md:p-5 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-center gap-3 truncate pr-2">
                    <span className={`w-6 h-6 rounded-lg text-[10px] font-black flex items-center justify-center border ${index === 0 ? 'bg-indigo-50 border-indigo-200 text-indigo-600 shadow-sm' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                      {index + 1}
                    </span>
                    <div className="truncate">
                      <p className="text-xs font-black text-slate-800 truncate">{c.name}</p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase">{c.quantity} serviços</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-black text-indigo-600">R$ {c.ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    <p className="text-[9px] text-slate-400 font-bold">valor médio</p>
                  </div>
                </div>
              )) : (
                <div className="py-12"><EmptyState /></div>
              )}
            </div>
          </div>

          {/* Right / Column 3 & 4: Ranking of Services */}
          <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden lg:col-span-2 xl:col-span-2">
            <div className="p-6 md:p-8 border-b border-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="font-black text-slate-800 text-sm uppercase">Ranking de Serviços</h3>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Ordenado por volume total faturado no período</p>
              </div>
              <span className="px-3.5 py-1 bg-orange-50 text-orange-600 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-wider">
                {filteredServices.filter(s => s.revenue > 0).length} de {filteredServices.length} Ativos com Faturamento
              </span>
            </div>

            {/* Table */}
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto custom-scrollbar">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-white z-10 border-b border-slate-100">
                  <tr className="bg-slate-50/50">
                    <TableHeader>Rank</TableHeader>
                    <TableHeader>Serviço</TableHeader>
                    <TableHeader>Categoria</TableHeader>
                    <TableHeader className="text-center">Qtd</TableHeader>
                    <TableHeader className="text-right">Faturamento</TableHeader>
                    <TableHeader className="text-right">Part.</TableHeader>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredServices.length > 0 ? filteredServices.map((s, index) => (
                    <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="w-16">
                        <span className={`w-6 h-6 rounded-lg text-[10px] font-black flex items-center justify-center border ${index === 0 ? 'bg-orange-50 border-orange-200 text-orange-600 shadow-sm' : index === 1 ? 'bg-indigo-50 border-indigo-100 text-indigo-600' : index === 2 ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                          {index + 1}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="font-black text-slate-850 block leading-tight">{s.name}</span>
                      </TableCell>
                      <TableCell>
                        <span className="px-2 py-0.5 bg-slate-100 rounded text-[9px] font-extrabold text-slate-500 uppercase tracking-wide">
                          {s.category}
                        </span>
                      </TableCell>
                      <TableCell className="text-center font-mono">
                        {s.quantity}
                      </TableCell>
                      <TableCell className="text-right font-black text-slate-800">
                        R$ {s.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${s.revenue > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                          {s.percentage.toFixed(1)}%
                        </span>
                      </TableCell>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={6} className="py-20">
                        <EmptyState message="Nenhum serviço correspondente encontrado." />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    );
  };

  const renderDetailModal = () => {
    if (!selectedProfDetails) return null;

    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-[32px] md:rounded-[40px] border border-slate-100 shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 font-sans text-left">
          
          {/* Header */}
          <div className="p-6 md:p-8 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src={selectedProfDetails.photo_url || `https://ui-avatars.com/api/?name=${selectedProfDetails.name}`} className="w-14 h-14 rounded-full object-cover shadow-sm ring-4 ring-orange-500/10" alt="" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-black text-orange-500 uppercase tracking-widest bg-orange-50 px-2 py-0.5 rounded-full">Colaborador(a)</span>
                </div>
                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter mt-1">{selectedProfDetails.name}</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                  Período: {format(getDates().start, 'dd/MM/yyyy')} até {format(getDates().end, 'dd/MM/yyyy')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={exportCollaboratorPDF}
                title="Exportar como PDF"
                className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all cursor-pointer border border-rose-100"
              >
                <FileText size={14} className="sm:w-4 sm:h-4 text-rose-600" />
                <span className="hidden sm:inline">PDF</span>
              </button>
              <button
                onClick={exportCollaboratorExcel}
                title="Exportar para Excel"
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 hover:text-emerald-800 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all cursor-pointer border border-emerald-100"
              >
                <FileSpreadsheet size={14} className="sm:w-4 sm:h-4 text-emerald-600" />
                <span className="hidden sm:inline">Excel</span>
              </button>
              <button 
                onClick={handleCloseModal}
                className="p-2 sm:p-3 bg-slate-200/50 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded-xl sm:rounded-2xl transition-all cursor-pointer ml-1"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Mini Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-slate-100 border-b border-slate-100 text-center bg-slate-50/20">
            <div className="p-4">
              <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Atendimentos</p>
              <p className="text-base font-black text-slate-800 mt-1">{selectedProfDetails.count}</p>
            </div>
            <div className="p-4">
              <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Realizado (Pago)</p>
              <p className="text-base font-black text-emerald-600 mt-1">R$ {selectedProfDetails.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="p-4">
              <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Projetado (Agenda)</p>
              <p className="text-base font-black text-blue-600 mt-1">R$ {selectedProfDetails.projectedRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="p-4">
              <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Comissão Est.</p>
              <p className="text-base font-black text-rose-600 mt-1">R$ {selectedProfDetails.commission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>

          {/* Filters bar inside modal */}
          <div className="p-4 lg:p-6 bg-white border-b border-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input 
                type="text" 
                placeholder="Buscar por cliente ou serviço..." 
                value={modalSearch}
                onChange={e => setModalSearch(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/30 transition-all font-sans"
              />
              {modalSearch && (
                <button onClick={() => setModalSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Status buttons */}
            <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 self-start md:self-auto overflow-x-auto max-w-full scrollbar-hide">
              {[
                { id: 'todos', label: 'Todos' },
                { id: 'concluidos', label: 'Concluídos' },
                { id: 'confirmados', label: 'Confirmados' },
                { id: 'cancelados', label: 'Cancelados' },
                { id: 'pendentes', label: 'Não Finalizados' },
              ].map((st) => (
                <button
                  key={st.id}
                  onClick={() => setModalStatusFilter(st.id)}
                  className={`px-3 py-1.5 text-[9px] md:text-[10px] font-black uppercase tracking-widest rounded-xl transition-all whitespace-nowrap ${modalStatusFilter === st.id ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content list */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar bg-slate-50/30">
            {modalAppointments.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-slate-400 font-bold uppercase tracking-wider text-xs">Nenhum atendimento neste período com os filtros selecionados.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Desktop Table */}
                <div className="hidden md:block bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100">
                        <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Cliente</th>
                        <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Data / Horário</th>
                        <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Serviço(s)</th>
                        <th className="px-6 py-4 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                        <th className="px-6 py-4 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {modalAppointments.map((a: any) => {
                        const clientName = a.client_name || a.client?.nome || 'Cliente Avulso';
                        const parsedDate = typeof a.date === 'string' ? parseISO(a.date) : new Date(a.date);
                        const formattedDate = format(parsedDate, "dd 'de' MMM 'às' HH:mm", { locale: pt });
                        
                        const resolved = getServicesForAppointment(a, services);
                        const serviceNames = resolved.map((s: any) => s.nome).filter(Boolean).join(', ') || 'Serviço';
                        
                        const valFromServices = resolved.reduce((sum: number, s: any) => sum + (s.preco || 0), 0);
                        const appointmentValue = a.value || a.price || valFromServices || 0;
                        
                        const st = statusMeta[a.status] || { label: a.status || 'Agendado', bg: 'bg-amber-50 text-amber-700 border border-amber-200', text: 'text-amber-700' };

                        return (
                          <tr key={a.id} className="hover:bg-slate-50/30 transition-colors">
                            <td className="px-6 py-4 text-xs font-black text-slate-800">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 font-bold text-[10px] flex items-center justify-center">
                                  {clientName.charAt(0).toUpperCase()}
                                </div>
                                <span className="font-extrabold">{clientName}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">
                              {formattedDate}
                            </td>
                            <td className="px-6 py-4 text-xs font-bold text-slate-600">
                              {serviceNames}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className={`inline-flex px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-lg ${st.bg} ${st.text}`}>
                                {st.label}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right text-xs font-black text-slate-800">
                              R$ {appointmentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile List cards */}
                <div className="md:hidden space-y-3">
                  {modalAppointments.map((a: any) => {
                    const clientName = a.client_name || a.client?.nome || 'Cliente Avulso';
                    const parsedDate = typeof a.date === 'string' ? parseISO(a.date) : new Date(a.date);
                    const formattedDate = format(parsedDate, "dd 'de' MMM 'às' HH:mm", { locale: pt });
                    
                    const resolved = getServicesForAppointment(a, services);
                    const serviceNames = resolved.map((s: any) => s.nome).filter(Boolean).join(', ') || 'Serviço';
                    
                    const valFromServices = resolved.reduce((sum: number, s: any) => sum + (s.preco || 0), 0);
                    const appointmentValue = a.value || a.price || valFromServices || 0;
                    
                    const st = statusMeta[a.status] || { label: a.status || 'Agendado', bg: 'bg-amber-50 text-amber-700 border border-amber-200', text: 'text-amber-700' };

                    return (
                      <div key={a.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-2 text-left">
                        <div className="flex justify-between items-center animate-in fade-in duration-250">
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 font-bold text-[9px] flex items-center justify-center">
                              {clientName.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-xs font-black text-slate-800">{clientName}</span>
                          </div>
                          <span className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-widest rounded-md ${st.bg} ${st.text}`}>
                            {st.label}
                          </span>
                        </div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase">
                          {formattedDate}
                        </div>
                        <div className="text-xs font-bold text-slate-600 pt-1 border-t border-slate-50 flex justify-between items-end">
                          <span className="flex-1 pr-2 line-clamp-1">{serviceNames}</span>
                          <span className="font-black text-slate-800 text-right whitespace-nowrap">
                            R$ {appointmentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderEquipe = () => (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        <KPICard title="Faturamento Realizado (Equipe)" value={`R$ ${data?.income.toLocaleString('pt-BR')}`} color="bg-emerald-500" icon={DollarSign} loading={isLoading} />
        <KPICard title="Projeção Equipe (Agenda)" value={`R$ ${data?.potentialIncome.toLocaleString('pt-BR')}`} color="bg-blue-500" icon={Target} loading={isLoading} />
        <KPICard title="Ticket Médio Geral" value={`R$ ${data?.ticketMedio.toFixed(2)}`} color="bg-orange-500" icon={Star} loading={isLoading} />
      </div>

      {/* D3 Team Performance Chart */}
      <div className="bg-white p-6 md:p-8 rounded-[32px] md:rounded-[40px] border border-slate-100 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-base md:text-lg font-black text-slate-800 uppercase tracking-tighter">Desempenho da Equipe (Receita)</h3>
          <BarChart4 className="text-indigo-500" size={20} />
        </div>
        <div className="h-80 w-full">
          {teamStats && teamStats.length > 0 ? (
            <D3TeamPerformanceChart data={teamStats} />
          ) : (
            <div className="h-full flex items-center justify-center">
              <EmptyState message="Sem dados de desempenho para o período." />
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-[32px] md:rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 md:p-8 border-b border-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="text-base md:text-lg font-black text-slate-800 uppercase tracking-tighter">Performance por Profissional</h3>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-100 px-3 py-1 rounded-full">
            💡 Dica: Clique em um colaborador para ver detalhes de atendimentos
          </span>
        </div>

        {/* Mobile: cards */}
        <div className="md:hidden divide-y divide-slate-50">
          {teamStats.map(p => (
            <div 
              key={p.id} 
              className="p-4 hover:bg-orange-50/10 active:bg-orange-50/20 transition-all cursor-pointer"
              onClick={() => setSelectedProfDetails(p)}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <img src={p.photo_url || `https://ui-avatars.com/api/?name=${p.name}`} className="w-10 h-10 rounded-full object-cover shadow-sm animate-in fade-in" alt="" />
                  <div>
                    <p className="text-sm font-black text-slate-800">{p.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{p.count} atendimentos</p>
                    <span className="inline-block text-[9px] font-black uppercase text-orange-500 mt-1">Ver todos &rarr;</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black text-slate-800">Realizado: R$ {p.revenue.toLocaleString('pt-BR')}</p>
                  <p className="text-[10px] text-blue-600 font-black uppercase">Projetado: R$ {p.projectedRevenue.toLocaleString('pt-BR')}</p>
                  <p className="text-[10px] text-rose-600 font-black uppercase">Comissão: R$ {p.commission.toLocaleString('pt-BR')}</p>
                </div>
              </div>
              <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl">
                <div className="text-center flex-1 border-r border-slate-200">
                  <p className="text-[9px] text-slate-400 font-bold uppercase">Ticket Médio</p>
                  <p className="text-[11px] font-black text-slate-700">R$ {p.ticket.toFixed(2)}</p>
                </div>
                <div className="text-center flex-1">
                  <p className="text-[9px] text-slate-400 font-bold uppercase">Meta</p>
                  <p className="text-[11px] font-black text-emerald-600">85%</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop: table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/50">
                <TableHeader>Profissional</TableHeader>
                <TableHeader>Atendimentos</TableHeader>
                <TableHeader>Realizado</TableHeader>
                <TableHeader>Projetado</TableHeader>
                <TableHeader>Ticket Médio</TableHeader>
                <TableHeader>Comissão Est.</TableHeader>
                <TableHeader>Ações</TableHeader>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {teamStats.map(p => (
                <tr 
                  key={p.id} 
                  className="hover:bg-orange-50/10 transition-colors cursor-pointer"
                  onClick={() => setSelectedProfDetails(p)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <img src={p.photo_url || `https://ui-avatars.com/api/?name=${p.name}`} className="w-8 h-8 rounded-full object-cover animate-in fade-in" alt="" />
                      <span className="font-extrabold">{p.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{p.count}</TableCell>
                  <TableCell className="text-emerald-600">R$ {p.revenue.toLocaleString('pt-BR')}</TableCell>
                  <TableCell className="text-blue-600">R$ {p.projectedRevenue.toLocaleString('pt-BR')}</TableCell>
                  <TableCell>R$ {p.ticket.toFixed(2)}</TableCell>
                  <TableCell className="text-rose-600">R$ {p.commission.toLocaleString('pt-BR')}</TableCell>
                  <TableCell>
                    <button 
                      className="px-3 py-1.5 bg-orange-50 text-orange-600 hover:bg-orange-100 hover:text-orange-700 font-black text-[10px] uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedProfDetails(p);
                      }}
                    >
                      Detalhamento
                    </button>
                  </TableCell>
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
      <header className="bg-white border-b border-slate-200 px-4 py-4 md:px-8 md:py-6 flex flex-col lg:flex-row justify-between items-center gap-4 md:gap-6 z-30 shadow-sm">
        <div className="flex items-center gap-3 md:gap-4 w-full lg:w-auto">
          <div className="p-2 md:p-3 bg-orange-500 text-white rounded-2xl shadow-lg shadow-orange-100">
            <BarChart3 size={20} className="md:w-6 md:h-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tighter uppercase leading-none">BI Inteligente</h1>
            <p className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Gestão de Alta Performance</p>
          </div>
        </div>

        <div className="flex bg-slate-100 p-1.5 rounded-[24px] border border-slate-200 overflow-x-auto scrollbar-hide w-full lg:w-auto shadow-inner">
          <div className="flex gap-1">
            {[
              { id: 'executivo', label: 'Estratégico', icon: LayoutDashboard },
              { id: 'financeiro', label: 'Financeiro', icon: Wallet },
              { id: 'servicos', label: 'Serviços', icon: Scissors },
              { id: 'agenda', label: 'Operação', icon: Calendar },
              { id: 'clientes', label: 'Clientes', icon: Users },
              { id: 'equipe', label: 'Time', icon: Briefcase },
              { id: 'marketing', label: 'Marketing', icon: Sparkles },
              { id: 'dre', label: 'DRE Real', icon: FileText }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 md:px-6 py-3 md:py-3.5 text-[9px] md:text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-slate-900 shadow-xl text-white scale-105' : 'text-slate-400 hover:text-slate-700 hover:bg-white'}`}
              >
                <tab.icon size={14} className={activeTab === tab.id ? 'text-orange-400' : ''} />
                {tab.label}
              </button>
            ))}
          </div>
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
              {activeTab === 'servicos' && renderServicos()}
              {activeTab === 'agenda' && renderAgenda()}
              {activeTab === 'clientes' && renderClientes()}
              {activeTab === 'equipe' && renderEquipe()}
              {activeTab === 'marketing' && renderMarketing()}
              {activeTab === 'dre' && <DREReport />}
            </>
          )}
        </div>
      </main>

      {/* Detail Modal for selected professional appointments */}
      {renderDetailModal()}
    </div>
  );
};

export default RelatoriosView;

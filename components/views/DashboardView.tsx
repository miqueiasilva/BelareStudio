
import React, { useMemo, useState, useEffect } from 'react';
import Card from '../shared/Card';
import JaciBotAssistant from '../shared/JaciBotAssistant';
import TodayScheduleWidget from '../dashboard/TodayScheduleWidget';
import { getDashboardInsight } from '../../services/geminiService';
import { DollarSign, Calendar, Users, TrendingUp, TrendingDown, PlusCircle, UserPlus, ShoppingBag, Clock, Globe, Loader2, BarChart3, Zap, UserCircle, Sparkles, Pencil, Wallet, Target, Award, CheckCircle2 } from 'lucide-react';
// FIX: Grouping date-fns imports and removing problematic members startOfDay, subDays, startOfMonth.
import { 
    format, addDays, endOfDay, endOfMonth, eachDayOfInterval, parseISO
} from 'date-fns';
import { 
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip 
} from 'recharts';
import { ptBR as pt } from 'date-fns/locale/pt-BR';
import { ViewState } from '../../types';
import { supabase } from '../../services/supabaseClient';
import { useStudio } from '../../contexts/StudioContext';
import toast from 'react-hot-toast';

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        maximumFractionDigits: 0
    }).format(value);
};

const FaturamentoTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-slate-900/95 backdrop-blur-md border border-slate-800 p-4 rounded-2xl shadow-2xl text-left">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
                <p className="text-sm font-black text-white">
                    Faturamento: {formatCurrency(payload[0].value)}
                </p>
            </div>
        );
    }
    return null;
};

const OcupacaoTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-slate-900/95 backdrop-blur-md border border-slate-800 p-4 rounded-2xl shadow-2xl text-left">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
                <p className="text-sm font-black text-white">
                    Ocupação: {payload[0].value}%
                </p>
                <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-wider">
                    Capacidade da Equipe
                </p>
            </div>
        );
    }
    return null;
};

const containerVariants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.05
        }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { 
        opacity: 1, 
        y: 0,
        transition: {
            type: "spring",
            stiffness: 100,
            damping: 15
        }
    }
};

const StatCard = ({ title, value, icon: Icon, colorClass, subtext, trend }: any) => (
    <div 
        className="bg-white p-5 rounded-[32px] border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-[0_20px_50px_rgba(0,0,0,0.05)] transition-all hover:-translate-y-1 text-left h-full group"
    >
        <div className="flex items-start justify-between mb-4">
            <div className={`p-3.5 rounded-2xl flex-shrink-0 ${colorClass} shadow-lg transition-transform group-hover:scale-110`}>
                <Icon className="w-5 h-5 text-white" />
            </div>
            {trend && (
                <div className={`flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-full ${trend > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                    {trend > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                    {Math.abs(trend)}%
                </div>
            )}
        </div>
        <div className="min-w-0">
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-1">{title}</p>
            <h3 className="text-2xl font-black text-slate-800 tracking-tighter truncate">{value}</h3>
            {subtext && <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase truncate opacity-60 tracking-wider">{subtext}</p>}
        </div>
    </div>
);

const QuickAction = ({ icon: Icon, label, color, onClick }: any) => (
    <button 
        onClick={onClick}
        className="flex flex-col items-center justify-center p-5 rounded-[32px] border border-slate-100 bg-white hover:border-orange-200 hover:bg-orange-50/30 transition-all group active:scale-95 w-full shadow-sm hover:shadow-md"
    >
        <div className={`w-14 h-14 rounded-2xl mb-3 transition-all flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 shadow-lg ${color}`}>
            <Icon className="w-6 h-6 text-white" />
        </div>
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover:text-orange-700">{label}</span>
    </button>
);

const DashboardView: React.FC<{onNavigate: (view: ViewState) => void}> = ({ onNavigate }) => {
    const { activeStudioId } = useStudio();
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [appointments, setAppointments] = useState<any[]>([]);
    const [financialGoal, setFinancialGoal] = useState(0);
    const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
    const [tempGoal, setTempGoal] = useState('');
    const [isSavingGoal, setIsSavingGoal] = useState(false);
    const [activeTab, setActiveTab] = useState<'faturamento' | 'ocupacao'>('faturamento');
    const [dailyGoal, setDailyGoal] = useState(500);
    const [todayRevenue, setTodayRevenue] = useState(0);
    const [isDailyGoalModalOpen, setIsDailyGoalModalOpen] = useState(false);
    const [tempDailyGoal, setTempDailyGoal] = useState('');
    const [isSavingDailyGoal, setIsSavingDailyGoal] = useState(false);

    const handleSaveDailyGoal = async (val: number) => {
        if (!activeStudioId) return;
        setIsSavingDailyGoal(true);
        try {
            try {
                window.safeLocalStorage?.setItem(`daily_revenue_goal_${activeStudioId}`, String(val));
            } catch (storageErr) {
                console.warn("Falha ao salvar meta diária no safeLocalStorage:", storageErr);
            }

            try {
                const { error } = await supabase
                    .from('studio_settings')
                    .upsert({
                        studio_id: activeStudioId,
                        daily_revenue_goal: val,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'studio_id' });

                if (error) {
                    console.warn("Aviso ao persistir meta diária no Supabase (coluna 'daily_revenue_goal' pode estar ausente):", error);
                }
            } catch (dbErr) {
                console.warn("Erro ao tentar persistir meta diária no banco:", dbErr);
            }

            setDailyGoal(val);
            toast.success("Meta faturamento diária atualizada com sucesso!");
            setIsDailyGoalModalOpen(false);
        } catch (err: any) {
            console.warn("Erro ao salvar meta financeira diária:", err);
            toast.error("Erro ao salvar meta financeira diária: " + (err.message || 'tente novamente'));
        } finally {
            setIsSavingDailyGoal(false);
        }
    };

    const handleSaveGoal = async (val: number) => {
        if (!activeStudioId) return;
        setIsSavingGoal(true);
        try {
            // Salva em safeLocalStorage como fallback imediato
            try {
                window.safeLocalStorage?.setItem(`revenue_goal_${activeStudioId}`, String(val));
            } catch (storageErr) {
                console.warn("Falha ao salvar meta no safeLocalStorage:", storageErr);
            }

            // Tenta salvar no Supabase, mas de forma segura se a coluna não existir
            try {
                const { error } = await supabase
                    .from('studio_settings')
                    .upsert({
                        studio_id: activeStudioId,
                        revenue_goal: val,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'studio_id' });

                if (error) {
                    console.warn("Aviso ao persistir no Supabase (coluna 'revenue_goal' pode estar ausente):", error);
                }
            } catch (dbErr) {
                console.warn("Erro ao tentar persistir meta no banco:", dbErr);
            }

            setFinancialGoal(val);
            toast.success("Meta faturamento atualizada com sucesso!");
            setIsGoalModalOpen(false);
        } catch (err: any) {
            console.warn("Erro ao salvar meta financeira:", err);
            toast.error("Erro ao salvar meta financeira: " + (err.message || 'tente novamente'));
        } finally {
            setIsSavingGoal(false);
        }
    };

    const [monthRevenueTotal, setMonthRevenueTotal] = useState(0);
    const [monthCommissionsTotal, setMonthCommissionsTotal] = useState(0);
    const [last24hReminders, setLast24hReminders] = useState(0);
    
    // Filtro de Período
    const [filter, setFilter] = useState<'hoje' | 'semana' | 'mes' | 'custom'>('hoje');
    const [customStart] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [customEnd] = useState(format(new Date(), 'yyyy-MM-dd'));
    
    const dateRange = useMemo(() => {
        const now = new Date();
        switch (filter) {
            case 'hoje': {
                // FIX: Manual startOfDay replacement.
                const startToday = new Date(now);
                startToday.setHours(0, 0, 0, 0);
                return { 
                    start: startToday.toISOString(), 
                    end: endOfDay(now).toISOString(),
                    label: 'Hoje'
                };
            }
            case 'semana': {
                // FIX: Manual subDays and startOfDay replacement.
                const startWeek = addDays(now, -7);
                startWeek.setHours(0, 0, 0, 0);
                return { 
                    start: startWeek.toISOString(), 
                    end: endOfDay(now).toISOString(),
                    label: 'Últimos 7 dias'
                };
            }
            case 'mes': {
                // FIX: Manual startOfMonth replacement.
                const startMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
                return { 
                    start: startMonth.toISOString(), 
                    end: endOfMonth(now).toISOString(),
                    label: 'Este Mês'
                };
            }
            case 'custom': {
                // FIX: Manual startOfDay replacement.
                const startCustom = new Date(customStart);
                startCustom.setHours(0, 0, 0, 0);
                const endCustom = new Date(customEnd);
                endCustom.setHours(23, 59, 59, 999);
                return {
                    start: startCustom.toISOString(),
                    end: endCustom.toISOString(),
                    label: `Período: ${format(new Date(customStart), 'dd/MM')} a ${format(new Date(customEnd), 'dd/MM')}`
                };
            }
            default: {
                const sToday = new Date(now);
                sToday.setHours(0, 0, 0, 0);
                return { 
                    start: sToday.toISOString(), 
                    end: endOfDay(now).toISOString(),
                    label: 'Hoje'
                };
            }
        }
    }, [filter, customStart, customEnd]);

    // --- CARREGAMENTO DE DADOS ---
    useEffect(() => {
        if (!activeStudioId) return;
        let mounted = true;

        const fetchDashboardData = async (isBackground = false) => {
            try {
                if (mounted) {
                    if (!isBackground) {
                        setIsLoading(true);
                    } else {
                        setIsRefreshing(true);
                    }
                }

                const { data: appts, error: apptsError } = await supabase
                    .from('appointments')
                    .select('*')
                    .eq('studio_id', activeStudioId)
                    .gte('date', dateRange.start)
                    .lte('date', dateRange.end)
                    .order('date', { ascending: true });

                if (apptsError) throw apptsError;

                const rawAppts = appts || [];
                // Exibe os agendamentos imediatamente
                if (mounted) setAppointments(rawAppts);

                // Enriquesse depois de forma assíncrona e segura com o apelido/whatsapp do cliente
                if (rawAppts.length > 0) {
                    const clientIds = Array.from(new Set(rawAppts.map(r => r.client_id).filter(Boolean)));
                    if (clientIds.length > 0) {
                        try {
                            const { data: cData, error: cError } = await supabase
                                .from('clients')
                                .select('id, nome, apelido, whatsapp, email')
                                .in('id', clientIds);
                            
                            if (!cError && cData && cData.length > 0) {
                                const clientsMap = new Map(cData.map(c => [c.id, c]));
                                const enrichedAppts = rawAppts.map(row => ({
                                    ...row,
                                    clients: row.client_id ? clientsMap.get(row.client_id) : undefined
                                }));
                                if (mounted) setAppointments(enrichedAppts);
                            }
                        } catch (enrichError) {
                            console.warn("Falha silenciosa ao enriquecer clientes no dashboard:", enrichError);
                        }
                    }
                }

                const now = new Date();
                // FIX: Manual startOfMonth replacement.
                const startMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
                const startMonthStr = startMonth.toISOString();
                const endMonthStr = endOfMonth(now).toISOString();
                
                try {
                    const { data: monthData, error: monthError } = await supabase
                        .from('appointments')
                        .select('*')
                        .eq('studio_id', activeStudioId)
                        .eq('status', 'concluido')
                        .gte('date', startMonthStr)
                        .lte('date', endMonthStr);
                    
                    if (monthError) {
                        console.warn("Erro detalhado do Supabase para faturamento mensal:", monthError);
                        throw monthError;
                    }
                    
                    const totalMonthRev = monthData?.reduce((acc, curr) => acc + (Number(curr.value || curr.price || 0) || 0), 0) || 0;
                    if (mounted) setMonthRevenueTotal(totalMonthRev);
                } catch (monthErr: any) {
                    console.warn("Erro ao buscar faturamento mensal no dashboard (pode ser offline ou Failed to fetch):", monthErr?.message || monthErr);
                }

                // Fetch today's completed appointments for real-time daily goal progress
                try {
                    const todayStart = new Date();
                    todayStart.setHours(0, 0, 0, 0);
                    const todayEnd = new Date();
                    todayEnd.setHours(23, 59, 59, 999);

                    const { data: todayData, error: todayError } = await supabase
                        .from('appointments')
                        .select('*')
                        .eq('studio_id', activeStudioId)
                        .eq('status', 'concluido')
                        .gte('date', todayStart.toISOString())
                        .lte('date', todayEnd.toISOString());

                    if (todayError) {
                        console.warn("Erro ao buscar faturamento diário:", todayError);
                        throw todayError;
                    }

                    const totalTodayRev = todayData?.reduce((acc, curr) => acc + (Number(curr.value || curr.price || 0) || 0), 0) || 0;
                    if (mounted) setTodayRevenue(totalTodayRev);
                } catch (todayErr: any) {
                    console.warn("Erro ao buscar faturamento diário no dashboard:", todayErr?.message || todayErr);
                }

                // Fetch and calculate total commissions for the current month
                try {
                    const [teamRes, commandsRes] = await Promise.all([
                        supabase.from('team_members')
                            .select('id, commission_rate, commission_percent')
                            .eq('studio_id', activeStudioId)
                            .eq('active', true),
                        supabase.from('commands')
                            .select(`
                                closed_at, status,
                                command_items (
                                    price, quantity, professional_id
                                )
                            `)
                            .eq('studio_id', activeStudioId)
                            .in('status', ['pago', 'paid'])
                            .not('closed_at', 'is', null)
                            .gte('closed_at', startMonthStr)
                            .lte('closed_at', endMonthStr)
                    ]);

                    if (!teamRes.error && !commandsRes.error && teamRes.data && commandsRes.data) {
                        const members = teamRes.data;
                        const commands = commandsRes.data;
                        
                        const ratesMap = new Map();
                        members.forEach(m => {
                            const rate = Number(m.commission_rate ?? m.commission_percent ?? 0);
                            ratesMap.set(String(m.id), rate);
                        });

                        let calculatedCommissions = 0;
                        commands.forEach(cmd => {
                            const items = cmd.command_items || [];
                            items.forEach((item: any) => {
                                const profId = String(item.professional_id);
                                const rate = ratesMap.get(profId) || 0;
                                const itemPrice = Number(item.price || 0) * Number(item.quantity || 1);
                                calculatedCommissions += itemPrice * (rate / 100);
                            });
                        });
                        
                        if (mounted) setMonthCommissionsTotal(calculatedCommissions);
                    }
                } catch (commError) {
                    console.warn("Erro ao calcular comissões no dashboard:", commError);
                }

                // Busca de meta de faturamento com fallback seguro
                let dbGoal = 5000;
                let dbDailyGoal = 500;
                try {
                    const { data: settings, error: settingsError } = await supabase
                        .from('studio_settings')
                        .select('revenue_goal, daily_revenue_goal')
                        .eq('studio_id', activeStudioId)
                        .maybeSingle();
                    
                    if (settingsError) throw settingsError;
                    if (settings) {
                        if ('revenue_goal' in settings) {
                            dbGoal = (settings as any).revenue_goal || 5000;
                        }
                        if ('daily_revenue_goal' in settings) {
                            dbDailyGoal = (settings as any).daily_revenue_goal || 500;
                        }
                    }
                } catch (settingsError) {
                    console.warn("Erro ao buscar metas do banco, usando fallback local:", settingsError);
                }

                if (mounted) {
                    let localGoal = 5000;
                    try {
                        const saved = window.safeLocalStorage?.getItem(`revenue_goal_${activeStudioId}`);
                        if (saved) {
                            localGoal = Number(saved) || 5000;
                        } else {
                            localGoal = dbGoal;
                        }
                    } catch (err) {
                        localGoal = dbGoal;
                    }
                    setFinancialGoal(localGoal);

                    let localDailyGoal = 500;
                    try {
                        const savedDaily = window.safeLocalStorage?.getItem(`daily_revenue_goal_${activeStudioId}`);
                        if (savedDaily) {
                            localDailyGoal = Number(savedDaily) || 500;
                        } else {
                            localDailyGoal = dbDailyGoal;
                        }
                    } catch (err) {
                        localDailyGoal = dbDailyGoal;
                    }
                    setDailyGoal(localDailyGoal);
                }

                // Busca dinâmica de disparos de lembrete da Jaci IA nas últimas 24h
                const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
                try {
                    if ((window as any).__hasRemindersLogTable !== false) {
                        const { count: reminderCount, error: countError } = await supabase
                            .from('whatsapp_reminders_log')
                            .select('*', { count: 'exact', head: true })
                            .eq('studio_id', activeStudioId)
                            .gte('sent_at', twentyFourHoursAgo);

                        if (countError) {
                            if (countError.code === 'PGRST205' || countError.status === 404) {
                                (window as any).__hasRemindersLogTable = false;
                            }
                            throw countError;
                        }

                        if (!countError && mounted) {
                            setLast24hReminders(reminderCount || 0);
                        }
                    }
                } catch (err) {
                    console.warn("Erro ao buscar lembretes 24h:", err);
                }

            } catch (e: any) {
                console.warn("Erro crítico/conexão ao sincronizar dashboard (pode ser offline ou Failed to fetch):", e?.message || e);
            } finally {
                if (mounted) {
                    setIsLoading(false);
                    setIsRefreshing(false);
                }
            }
        };

        fetchDashboardData(false);

        // Atualização automática a cada 30 segundos
        const intervalId = setInterval(() => {
            fetchDashboardData(true);
        }, 30000);

        return () => {
            mounted = false;
            clearInterval(intervalId);
        };
    }, [dateRange, activeStudioId]);

    // KPIs Dinâmicos
    const kpis = useMemo(() => {
        const revenue = appointments
            .filter(a => a.status === 'concluido')
            .reduce((acc, a) => acc + (Number(a.value) || 0), 0);
        
        const scheduled = appointments.filter(a => a.status !== 'cancelado').length;
        const completed = appointments.filter(a => a.status === 'concluido').length;
        
        const onlineCount = appointments.filter(a => 
            (a.origin === 'online' || a.origin === 'link') && 
            a.status !== 'cancelado'
        ).length;
        
        const onlineRate = scheduled > 0 ? (onlineCount / scheduled) * 100 : 0;

        return { revenue, scheduled, completed, onlineCount, onlineRate };
    }, [appointments]);

    // Lógica de Meta Financeira
    const goalMetrics = useMemo(() => {
        const goalProgress = financialGoal > 0 ? (monthRevenueTotal / financialGoal) * 100 : 0;
        const displayGoal = financialGoal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        return {
            progress: goalProgress,
            display: displayGoal,
            visual: Math.min(goalProgress, 100)
        };
    }, [monthRevenueTotal, financialGoal]);

    // Lógica de Meta Financeira Diária
    const dailyGoalMetrics = useMemo(() => {
        const goalProgress = dailyGoal > 0 ? (todayRevenue / dailyGoal) * 100 : 0;
        const displayGoal = dailyGoal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const displayRevenue = todayRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const remaining = Math.max(0, dailyGoal - todayRevenue);
        const displayRemaining = remaining.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        return {
            progress: goalProgress,
            display: displayGoal,
            displayRevenue,
            displayRemaining,
            isAchieved: todayRevenue >= dailyGoal,
            visual: Math.min(goalProgress, 100)
        };
    }, [todayRevenue, dailyGoal]);

    // Dados de Faturamento Diário e Ocupação da Agenda para os Gráficos
    const chartData = useMemo(() => {
        const activeProfsCount = Math.max(1, new Set(appointments.map(a => a.professional_id).filter(Boolean)).size);

        if (filter === 'hoje') {
            // Group by hour (08:00 to 20:00 with 1-hour increments)
            const hours = Array.from({ length: 13 }, (_, i) => i + 8); // 8 to 20
            return hours.map(h => {
                const hourStr = `${String(h).padStart(2, '0')}:00`;
                
                const apptsInHour = appointments.filter(a => {
                    if (!a.date) return false;
                    const d = new Date(a.date);
                    return d.getHours() === h;
                });

                const faturamento = apptsInHour
                    .filter(a => a.status === 'concluido')
                    .reduce((acc, a) => acc + (Number(a.value) || 0), 0);

                const minutosOcupados = apptsInHour
                    .filter(a => a.status !== 'cancelado')
                    .reduce((acc, a) => acc + (Number(a.duration) || 30), 0);

                const capacity = activeProfsCount * 60; // 60 minutes capacity per hour for active professionals
                const ocupacao = Math.min(100, (minutosOcupados / capacity) * 100);

                return {
                    name: hourStr,
                    faturamento,
                    ocupacao: parseFloat(ocupacao.toFixed(1))
                };
            });
        } else {
            // Group by day using eachDayOfInterval
            try {
                const days = eachDayOfInterval({
                    start: new Date(dateRange.start),
                    end: new Date(dateRange.end)
                });

                return days.map(day => {
                    const dStr = format(day, 'yyyy-MM-dd');
                    const label = format(day, 'dd/MM');

                    const apptsInDay = appointments.filter(a => {
                        if (!a.date) return false;
                        const aDateStr = a.date.substring(0, 10);
                        return aDateStr === dStr;
                    });

                    const faturamento = apptsInDay
                        .filter(a => a.status === 'concluido')
                        .reduce((acc, a) => acc + (Number(a.value) || 0), 0);

                    const minutosOcupados = apptsInDay
                        .filter(a => a.status !== 'cancelado')
                        .reduce((acc, a) => acc + (Number(a.duration) || 30), 0);

                    const capacity = activeProfsCount * 480; // 8 hours (480 mins) capacity per professional per day
                    const ocupacao = Math.min(100, (minutosOcupados / capacity) * 100);

                    return {
                        name: label,
                        faturamento,
                        ocupacao: parseFloat(ocupacao.toFixed(1))
                    };
                });
            } catch (err) {
                console.warn("Erro ao gerar dados do gráfico:", err);
                return [];
            }
        }
    }, [appointments, filter, dateRange]);

    const totalFaturamentoPeriodo = useMemo(() => {
        return chartData.reduce((acc, curr) => acc + curr.faturamento, 0);
    }, [chartData]);

    const mediaOcupacaoPeriodo = useMemo(() => {
        return chartData.length > 0 ? chartData.reduce((acc, curr) => acc + curr.ocupacao, 0) / chartData.length : 0;
    }, [chartData]);

    if (isLoading) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-white">
                <div className="relative">
                    <Loader2 className="animate-spin text-orange-500 mb-4" size={48} />
                    <div className="absolute inset-0 animate-ping rounded-full border-4 border-orange-100"></div>
                </div>
                <p className="text-xs font-black uppercase tracking-[0.3em] mt-4">Sincronizando {dateRange.label}...</p>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-8 h-full overflow-y-auto bg-slate-50/30 custom-scrollbar font-sans text-left">
            <header className="flex flex-col xl:flex-row justify-between items-start xl:items-end mb-10 gap-6">
                <div>
                    <div className="flex flex-wrap items-center gap-3 text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mb-2">
                        <div className="flex items-center gap-1.5">
                            <Zap size={14} className="text-orange-500 animate-pulse" />
                            <span>Insight do Sistema • {format(new Date(), "dd 'de' MMMM", { locale: pt })}</span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-600 px-2.5 py-0.5 rounded-full border border-emerald-100 text-[9px] font-bold tracking-wider">
                            {isRefreshing ? (
                                <Loader2 className="w-2.5 h-2.5 animate-spin text-emerald-500" />
                            ) : (
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                            )}
                            <span>Tempo Real (30s)</span>
                        </div>
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-black text-slate-800 leading-none tracking-tighter">
                        Olá, <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-orange-400">Time Belare</span>
                    </h1>
                    <p className="text-slate-400 text-sm mt-2 font-medium">Seu estúdio está com <span className="text-emerald-500 font-black">94% de produtividade</span> hoje.</p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full xl:w-auto">
                    <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <button onClick={() => setFilter('hoje')} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filter === 'hoje' ? 'bg-slate-800 text-white shadow-xl' : 'text-slate-400 hover:bg-slate-50'}`}>Hoje</button>
                        <button onClick={() => setFilter('semana')} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filter === 'semana' ? 'bg-slate-800 text-white shadow-xl' : 'text-slate-400 hover:bg-slate-50'}`}>7 Dias</button>
                        <button onClick={() => setFilter('mes')} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filter === 'mes' ? 'bg-slate-800 text-white shadow-xl' : 'text-slate-400 hover:bg-slate-50'}`}>Mês</button>
                    </div>
                    <button onClick={() => onNavigate('agenda')} className="px-6 py-4 bg-orange-500 text-white font-black rounded-2xl hover:bg-orange-600 focus:ring-4 focus:ring-orange-100 transition-all shadow-xl shadow-orange-500/20 flex items-center justify-center gap-2 text-xs uppercase tracking-widest active:scale-95">
                        <PlusCircle size={18} /> Novo Agendamento
                    </button>
                </div>
            </header>

            <div 
                className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4 lg:gap-6 mb-10"
            >
                <StatCard title="Faturamento" value={formatCurrency(kpis.revenue)} icon={DollarSign} colorClass="bg-emerald-500" subtext={dateRange.label} trend={12} />
                <StatCard title="Agendados" value={kpis.scheduled} icon={Calendar} colorClass="bg-blue-500" subtext={dateRange.label} trend={8} />
                <StatCard title="Online" value={kpis.onlineCount} icon={Globe} colorClass="bg-orange-500" subtext={`${kpis.onlineRate.toFixed(1)}% do total`} trend={22} />
                <StatCard title="Ticket Médio" value={formatCurrency(kpis.revenue / (kpis.completed || 1))} icon={TrendingUp} colorClass="bg-purple-500" subtext="Por cliente" />
                <StatCard title="Lembretes Jaci IA" value={`${last24hReminders} ${last24hReminders === 1 ? 'disparo' : 'disparos'}`} icon={Sparkles} colorClass="bg-orange-500" subtext="Últimas 24 horas" />
                
                {/* Visual Widget: Month commissions with link to Remuneracoes module */}
                <div 
                    onClick={() => onNavigate('remuneracoes')}
                    className="bg-white p-5 rounded-[32px] border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-[0_20px_50px_rgba(249,115,22,0.08)] hover:border-orange-200 transition-all hover:-translate-y-1 cursor-pointer text-left h-full group relative overflow-hidden"
                    title="Ver detalhamento de remunerações"
                >
                    <div className="absolute -right-2 -bottom-2 opacity-[0.03] text-orange-500 group-hover:scale-110 transition-transform">
                        <Wallet size={90} />
                    </div>
                    <div className="flex items-start justify-between mb-4">
                        <div className="p-3 bg-orange-50 text-orange-500 rounded-xl flex-shrink-0 shadow-sm transition-transform group-hover:scale-110">
                            <Wallet className="w-5 h-5" />
                        </div>
                        <div className="flex items-center gap-1 bg-orange-50 text-orange-600 text-[8px] font-black uppercase tracking-wider px-2 py-1 rounded-full">
                            <Zap size={8} className="animate-pulse" /> Ver tudo
                        </div>
                    </div>
                    <div className="min-w-0 z-10">
                        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Comissões do Mês</p>
                        <h3 className="text-2xl font-black text-orange-600 tracking-tighter truncate">{formatCurrency(monthCommissionsTotal)}</h3>
                        <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-wider group-hover:text-orange-500 transition-colors">
                            Remunerações →
                        </p>
                    </div>
                </div>

                <div 
                    onClick={() => { setTempGoal(financialGoal ? financialGoal.toString() : ''); setIsGoalModalOpen(true); }}
                    className="bg-slate-900 p-6 rounded-[32px] text-white flex flex-col justify-between shadow-2xl relative overflow-hidden group h-full cursor-pointer hover:bg-slate-800 transition-all active:scale-98 border border-white/5"
                    title="Clique para editar a meta mensal"
                >
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                        <Zap size={120} />
                    </div>
                    <div className="flex justify-between items-start z-10 font-bold">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-400">FOCO NA META</p>
                        <div className="flex items-center gap-1 bg-orange-500/20 border border-orange-500/10 px-2.5 py-0.5 rounded-full text-orange-400 text-[8px] tracking-wider uppercase font-black">
                            <Pencil size={8} /> Alterar
                        </div>
                    </div>
                    <div className="mt-4 z-10 text-left">
                        <div className="flex items-end justify-between mb-3">
                            <h3 className="text-3xl font-black tracking-tighter">{goalMetrics.progress.toFixed(0)}%</h3>
                            <span className="text-[10px] font-bold text-slate-400 mb-1">ALVO: {goalMetrics.display}</span>
                        </div>
                        <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden mb-1">
                            <div className="h-full bg-gradient-to-r from-orange-600 to-orange-400 transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(249,115,22,0.5)]" style={{ width: `${goalMetrics.visual}%` }} />
                        </div>
                        <p className="text-[8px] text-slate-500 font-bold uppercase mt-1 tracking-wider text-right">Toque para configurar</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <div 
                        className="grid grid-cols-2 sm:grid-cols-5 gap-4"
                    >
                        <QuickAction icon={UserCircle} label="Clientes" color="bg-blue-600" onClick={() => onNavigate('clientes')} />
                        <QuickAction icon={Globe} label="Portal" color="bg-purple-600" onClick={() => onNavigate('agenda_online')} />
                        <QuickAction icon={ShoppingBag} label="PDV" color="bg-emerald-600" onClick={() => onNavigate('vendas')} />
                        <QuickAction icon={BarChart3} label="DRE" color="bg-slate-800" onClick={() => onNavigate('relatorios')} />
                        <QuickAction icon={Calendar} label="Agenda" color="bg-orange-600" onClick={() => onNavigate('agenda')} />
                    </div>

                    {/* Seção de Meta Diária de Faturamento */}
                    <div 
                        className="bg-white rounded-[32px] p-6 sm:p-8 border border-slate-100 shadow-sm text-left relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-8 opacity-[0.03] text-orange-500 pointer-events-none">
                            <Target size={150} />
                        </div>
                        
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="p-1.5 rounded-lg bg-orange-100 text-orange-600">
                                        <Target size={18} />
                                    </div>
                                    <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">Meta Diária de Faturamento</h2>
                                </div>
                                <p className="text-xs text-slate-400 font-medium">Acompanhe e configure a meta de faturamento para o dia de hoje</p>
                            </div>
                            <button 
                                onClick={() => { 
                                    setTempDailyGoal(dailyGoal ? dailyGoal.toString() : ''); 
                                    setIsDailyGoalModalOpen(true); 
                                }}
                                className="px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                            >
                                <Pencil size={12} /> Definir Meta
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                            <div className="space-y-1">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Realizado Hoje</span>
                                <div className="flex items-baseline gap-1.5">
                                    <span className="text-3xl font-black text-slate-800 tracking-tight">{dailyGoalMetrics.displayRevenue}</span>
                                    {dailyGoalMetrics.isAchieved && (
                                        <span className="text-emerald-500 font-black text-xs flex items-center gap-1 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100 uppercase tracking-wider animate-bounce">
                                            <Award size={12} /> Batida!
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-1">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Meta Diária</span>
                                <p className="text-2xl font-black text-slate-600 tracking-tight">{dailyGoalMetrics.display}</p>
                            </div>

                            <div className="space-y-1">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status / Restante</span>
                                {dailyGoalMetrics.isAchieved ? (
                                    <div className="flex items-center gap-1.5 text-emerald-600 font-bold text-sm">
                                        <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                                        <span>Meta superada por {((todayRevenue - dailyGoal) > 0 ? (todayRevenue - dailyGoal) : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}! 🎉</span>
                                    </div>
                                ) : (
                                    <p className="text-sm font-bold text-orange-600">
                                        Faltam <span className="font-black text-base">{dailyGoalMetrics.displayRemaining}</span> para atingir o objetivo
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Barra de Progresso Real-time */}
                        <div className="mt-6 space-y-2">
                            <div className="flex justify-between items-center text-xs">
                                <span className="font-black text-slate-500 uppercase tracking-wider">{dailyGoalMetrics.progress.toFixed(1)}% Concluído</span>
                                <span className="font-bold text-slate-400">{dailyGoalMetrics.displayRevenue} / {dailyGoalMetrics.display}</span>
                            </div>
                            <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200 shadow-inner">
                                <div 
                                    className={`h-full rounded-full transition-all duration-500 shadow-sm ${
                                        dailyGoalMetrics.isAchieved 
                                            ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_12px_rgba(16,185,129,0.4)]' 
                                            : 'bg-gradient-to-r from-orange-500 to-amber-400 shadow-[0_0_12px_rgba(249,115,22,0.4)]'
                                    }`}
                                    style={{ width: `${dailyGoalMetrics.visual}%` }}
                                />
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-white rounded-[40px] p-2 border border-slate-100 shadow-sm overflow-hidden">
                        <JaciBotAssistant fetchInsight={getDashboardInsight} />
                    </div>
                    
                    <Card title="Desempenho" icon={<BarChart3 size={18} className="text-orange-500" />}>
                        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 mb-6 border-b border-slate-100 pb-4">
                            <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-200/50">
                                <button 
                                    onClick={() => setActiveTab('faturamento')}
                                    className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${
                                        activeTab === 'faturamento' 
                                            ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' 
                                            : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100/50'
                                    }`}
                                >
                                    <DollarSign size={12} /> Faturamento ({formatCurrency(totalFaturamentoPeriodo)})
                                </button>
                                <button 
                                    onClick={() => setActiveTab('ocupacao')}
                                    className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${
                                        activeTab === 'ocupacao' 
                                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                                            : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100/50'
                                    }`}
                                >
                                    <Clock size={12} /> Ocupação Média ({mediaOcupacaoPeriodo.toFixed(0)}%)
                                </button>
                            </div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-full flex items-center gap-1.5 self-start sm:self-auto">
                                <Calendar size={12} /> {dateRange.label}
                            </div>
                        </div>

                        {/* Chart Render */}
                        {chartData.length === 0 ? (
                            <div className="py-16 text-center text-slate-400 flex flex-col items-center">
                                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-slate-200">
                                    <TrendingUp size={30} />
                                </div>
                                <p className="text-xs font-black uppercase tracking-[0.3em]">Nenhum agendamento</p>
                                <p className="text-[10px] font-bold mt-2 text-slate-300">Não há dados suficientes no período para exibir o gráfico</p>
                            </div>
                        ) : activeTab === 'faturamento' ? (
                            <div className="h-72 w-full animate-in fade-in duration-300">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorFaturamento" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                                                <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis 
                                            dataKey="name" 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }}
                                            dy={10}
                                        />
                                        <YAxis 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fill: '#94a3b8', fontSize: 10 }}
                                            tickFormatter={(val) => `R$${val}`}
                                        />
                                        <Tooltip content={<FaturamentoTooltip />} />
                                        <Area 
                                            type="monotone" 
                                            dataKey="faturamento" 
                                            stroke="#f97316" 
                                            strokeWidth={4}
                                            fillOpacity={1} 
                                            fill="url(#colorFaturamento)" 
                                            animationDuration={1500}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="h-72 w-full animate-in fade-in duration-300">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorOcupacao" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3}/>
                                                <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis 
                                            dataKey="name" 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }}
                                            dy={10}
                                        />
                                        <YAxis 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fill: '#94a3b8', fontSize: 10 }}
                                            tickFormatter={(val) => `${val}%`}
                                            domain={[0, 100]}
                                        />
                                        <Tooltip content={<OcupacaoTooltip />} />
                                        <Area 
                                            type="monotone" 
                                            dataKey="ocupacao" 
                                            stroke="#2563eb" 
                                            strokeWidth={4}
                                            fillOpacity={1} 
                                            fill="url(#colorOcupacao)" 
                                            animationDuration={1500}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </Card>
                </div>
                <div className="lg:col-span-1">
                    <div className="sticky top-6">
                        <TodayScheduleWidget onNavigate={onNavigate} appointments={appointments} dateLabel={dateRange.label} />
                    </div>
                </div>
            </div>

            {isGoalModalOpen && (
                <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div 
                        className="bg-white rounded-[32px] p-8 max-w-sm w-full border border-slate-100 shadow-[0_20px_50px_rgba(0,0,0,0.15)] animate-in zoom-in-95 duration-200 relative overflow-hidden text-center"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center mx-auto mb-4 border border-orange-500/5">
                            <Zap size={22} className="animate-pulse" />
                        </div>
                        <h3 className="font-black text-slate-800 uppercase tracking-tighter text-lg leading-tight">Meta de Faturamento</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 mb-6">Defina o objetivo financeiro mensal do estúdio</p>
                        
                        <div className="relative mb-6">
                            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-black text-sm">R$</span>
                            <input 
                                type="number" 
                                value={tempGoal} 
                                onChange={e => {
                                    const val = e.target.value;
                                    if (val === '' || parseFloat(val) >= 0) {
                                        setTempGoal(val);
                                    }
                                }}
                                placeholder="5000"
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-5 py-4 font-black text-slate-700 text-lg outline-none focus:ring-4 focus:ring-orange-100 focus:border-orange-500/30 transition-all shadow-inner text-left"
                                autoFocus
                            />
                        </div>

                        <div className="flex gap-3">
                            <button 
                                onClick={() => setIsGoalModalOpen(false)} 
                                disabled={isSavingGoal}
                                className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold rounded-2xl text-[10px] uppercase tracking-widest transition-all active:scale-95"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={async () => {
                                    const val = parseFloat(tempGoal) || 0;
                                    await handleSaveGoal(val);
                                }} 
                                disabled={isSavingGoal}
                                className="flex-1 py-4 bg-slate-800 hover:bg-slate-900 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
                            >
                                {isSavingGoal ? <Loader2 size={16} className="animate-spin text-white" /> : 'Salvar Meta'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isDailyGoalModalOpen && (
                <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div 
                        className="bg-white rounded-[32px] p-8 max-w-sm w-full border border-slate-100 shadow-[0_20px_50px_rgba(0,0,0,0.15)] animate-in zoom-in-95 duration-200 relative overflow-hidden text-center"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center mx-auto mb-4 border border-orange-500/5">
                            <Target size={22} className="animate-pulse" />
                        </div>
                        <h3 className="font-black text-slate-800 uppercase tracking-tighter text-lg leading-tight">Meta Diária de Faturamento</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 mb-6">Defina o objetivo financeiro diário do estúdio</p>
                        
                        <div className="relative mb-6">
                            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-black text-sm">R$</span>
                            <input 
                                type="number" 
                                value={tempDailyGoal} 
                                onChange={e => {
                                    const val = e.target.value;
                                    if (val === '' || parseFloat(val) >= 0) {
                                        setTempDailyGoal(val);
                                    }
                                }}
                                placeholder="500"
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-5 py-4 font-black text-slate-700 text-lg outline-none focus:ring-4 focus:ring-orange-100 focus:border-orange-500/30 transition-all shadow-inner text-left"
                                autoFocus
                            />
                        </div>

                        <div className="flex gap-3">
                            <button 
                                onClick={() => setIsDailyGoalModalOpen(false)} 
                                disabled={isSavingDailyGoal}
                                className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold rounded-2xl text-[10px] uppercase tracking-widest transition-all active:scale-95"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={async () => {
                                    const val = parseFloat(tempDailyGoal) || 0;
                                    await handleSaveDailyGoal(val);
                                }} 
                                disabled={isSavingDailyGoal}
                                className="flex-1 py-4 bg-slate-800 hover:bg-slate-900 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
                            >
                                {isSavingDailyGoal ? <Loader2 size={16} className="animate-spin text-white" /> : 'Salvar Meta'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DashboardView;

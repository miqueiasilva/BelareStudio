import React, { useMemo, useState } from 'react';
import Card from '../shared/Card';
import JaciBotAssistant from '../shared/JaciBotAssistant';
import { getDashboardInsight } from '../../services/geminiService';
import { initialAppointments, professionals } from '../../data/mockData';
import { DollarSign, Calendar, Users, TrendingUp, PlusCircle, UserPlus, ShoppingBag, ArrowRight, Clock, Globe } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR as pt } from 'date-fns/locale/pt-BR';
import { safe, toNumber } from '../../utils/normalize';
import SafePie from '../charts/SafePie';
import SafeBar from '../charts/SafeBar';
import { ViewState } from '../../types';

const StatCard = ({ title, value, trend, icon: Icon, colorClass }: any) => (
    <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-sm flex items-start justify-between hover:shadow-md transition-shadow">
        <div className="min-w-0">
            <p className="text-slate-500 text-[10px] sm:text-xs font-black uppercase tracking-wider truncate">{title}</p>
            <h3 className="text-xl sm:text-2xl font-black text-slate-800 mt-1 truncate">{value}</h3>
            {trend && (
                <div className="flex items-center gap-1 mt-2">
                    <span className={`text-[10px] font-bold ${trend > 0 ? 'text-green-600' : 'text-red-600'} bg-opacity-10 py-0.5 px-1.5 rounded`}>
                        {trend > 0 ? '+' : ''}{trend}%
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">vs. ontem</span>
                </div>
            )}
        </div>
        <div className={`p-2.5 sm:p-3 rounded-xl flex-shrink-0 ${colorClass}`}>
            <Icon className="w-5 h-5 text-white" />
        </div>
    </div>
);

const QuickAction = ({ icon: Icon, label, color, onClick }: any) => (
    <button 
        onClick={onClick}
        className="flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl border border-slate-100 bg-white hover:border-orange-200 hover:bg-orange-50 transition-all group active:scale-95"
    >
        <div className={`p-3 rounded-full mb-2 transition-colors group-hover:bg-white ${color} shadow-sm`}>
            <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white group-hover:text-orange-500" />
        </div>
        <span className="text-[10px] sm:text-xs font-black text-slate-600 uppercase tracking-tighter group-hover:text-orange-700">{label}</span>
    </button>
);

const DashboardView: React.FC<{onNavigate: (view: ViewState) => void}> = ({ onNavigate }) => {
    const today = new Date();

    const kpis = useMemo(() => {
        const apps = safe(initialAppointments);
        const done = apps.filter(a => a.status === 'concluido');
        const revenue = done.reduce((sum, a) => sum + toNumber(a.service?.price), 0);
        return { revenue, count: done.length, scheduled: apps.filter(a => ['agendado', 'confirmado'].includes(a.status)).length };
    }, []);

    return (
        <div className="p-4 sm:p-6 h-full overflow-y-auto bg-slate-50/50 custom-scrollbar font-sans">
            {/* Header: Melhorado para Mobile */}
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 sm:mb-8 gap-4">
                <div>
                    <div className="flex items-center gap-2 text-slate-400 text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-1">
                        <Calendar size={14} className="text-orange-500" />
                        <span className="capitalize">{format(today, "EEEE, dd 'de' MMMM", { locale: pt })}</span>
                    </div>
                    <h1 className="text-xl sm:text-3xl font-black text-slate-800 leading-tight">
                        Olá, <span className="text-orange-500">Jacilene!</span>
                    </h1>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <button onClick={() => onNavigate('agenda')} className="flex-1 sm:flex-none justify-center px-4 py-2.5 bg-orange-500 text-white font-black rounded-xl hover:bg-orange-600 transition shadow-lg shadow-orange-100 flex items-center gap-2 text-sm active:scale-95">
                        <PlusCircle size={18} /> Novo Agendamento
                    </button>
                </div>
            </header>

            {/* KPI Grid: 2 colunas no mobile, 4 no desktop */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
                <StatCard title="Faturamento" value={`R$ ${kpis.revenue.toFixed(0)}`} trend={12} icon={DollarSign} colorClass="bg-green-500" />
                <StatCard title="Concluídos" value={kpis.count} trend={5} icon={Users} colorClass="bg-blue-500" />
                <StatCard title="Agendados" value={kpis.scheduled} icon={Calendar} colorClass="bg-purple-500" />
                <div className="bg-slate-800 p-4 sm:p-5 rounded-2xl text-white flex flex-col justify-between shadow-lg">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Meta</p>
                    <div className="flex items-end justify-between mt-1">
                        <h3 className="text-xl font-black">75%</h3>
                        <div className="w-8 h-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin-slow"></div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    {/* Quick Actions: Grid adaptável */}
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-4">
                        <QuickAction icon={UserPlus} label="Cliente" color="bg-blue-500" onClick={() => onNavigate('clientes')} />
                        <QuickAction icon={Globe} label="Link" color="bg-purple-500" onClick={() => onNavigate('agenda_online')} />
                        <QuickAction icon={ShoppingBag} label="Venda" color="bg-green-500" onClick={() => onNavigate('vendas')} />
                        <QuickAction icon={TrendingUp} label="Caixa" color="bg-slate-700" onClick={() => onNavigate('financeiro')} />
                        <QuickAction icon={Clock} label="Agenda" color="bg-orange-500" onClick={() => onNavigate('agenda')} />
                    </div>

                    <JaciBotAssistant fetchInsight={getDashboardInsight} />
                </div>
            </div>
        </div>
    );
};

export default DashboardView;
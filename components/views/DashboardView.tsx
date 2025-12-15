
import React, { useMemo, useState } from 'react';
import Card from '../shared/Card';
import JaciBotAssistant from '../shared/JaciBotAssistant';
import { getDashboardInsight } from '../../services/geminiService';
import { initialAppointments, professionals } from '../../data/mockData';
import { DollarSign, Calendar, Users, TrendingUp, PlusCircle, UserPlus, ShoppingBag, ArrowRight, Clock, Globe } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { safe, toNumber } from '../../utils/normalize';
import SafePie from '../charts/SafePie';
import SafeBar from '../charts/SafeBar';
import { ViewState } from '../../types';

interface DashboardViewProps {
    onNavigate: (view: ViewState) => void;
}

// --- Helper Components for Dashboard ---

const StatCard = ({ title, value, trend, icon: Icon, colorClass }: any) => (
    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-start justify-between hover:shadow-md transition-shadow">
        <div>
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">{title}</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-1">{value}</h3>
            {trend && (
                <div className="flex items-center gap-1 mt-2">
                    <span className={`text-xs font-bold ${trend > 0 ? 'text-green-600' : 'text-red-600'} bg-opacity-10 py-0.5 px-1.5 rounded`}>
                        {trend > 0 ? '+' : ''}{trend}%
                    </span>
                    <span className="text-[10px] text-slate-400">vs. ontem</span>
                </div>
            )}
        </div>
        <div className={`p-3 rounded-xl ${colorClass}`}>
            <Icon className="w-5 h-5 text-white" />
        </div>
    </div>
);

const GoalRing = ({ current, target }: { current: number, target: number }) => {
    const percentage = Math.min(100, Math.max(0, (current / target) * 100));
    const circumference = 2 * Math.PI * 40;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 text-white relative overflow-hidden flex flex-col justify-between h-full shadow-lg">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10 blur-2xl"></div>
            
            <div className="flex justify-between items-start z-10">
                <div>
                    <p className="text-slate-400 text-xs font-bold uppercase">Meta Diária</p>
                    <p className="text-2xl font-bold mt-1">R$ {current.toFixed(2)}</p>
                    <p className="text-slate-400 text-xs">de R$ {target.toFixed(2)}</p>
                </div>
                <div className="relative w-16 h-16">
                    <svg className="w-full h-full transform -rotate-90">
                        <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-slate-700" />
                        <circle cx="32" cy="32" r="28" stroke="#f97316" strokeWidth="6" fill="transparent" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">{Math.round(percentage)}%</span>
                </div>
            </div>
            
            <div className="z-10 mt-4">
                <p className="text-xs text-slate-300 mb-1">Progresso atual</p>
                <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-orange-500 h-full rounded-full transition-all duration-1000" style={{ width: `${percentage}%` }}></div>
                </div>
                {percentage >= 100 && <p className="text-xs text-green-400 mt-2 font-bold">🎉 Meta batida! Parabéns!</p>}
            </div>
        </div>
    );
};

const QuickAction = ({ icon: Icon, label, color, onClick }: any) => (
    <button 
        onClick={onClick}
        className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-100 bg-white hover:border-orange-200 hover:bg-orange-50 transition-all group"
    >
        <div className={`p-3 rounded-full mb-2 transition-colors group-hover:bg-white ${color}`}>
            <Icon className="w-6 h-6 text-white group-hover:text-orange-500" />
        </div>
        <span className="text-xs font-semibold text-slate-600 group-hover:text-orange-700">{label}</span>
    </button>
);

const TeamPulse = () => {
    const team = safe(professionals).map(p => ({
        ...p,
        status: Math.random() > 0.4 ? 'busy' : 'free' // Mock status
    }));

    return (
        <Card title="Status da Equipe" className="h-full">
            <div className="space-y-4 mt-2">
                {team.map(member => (
                    <div key={member.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <img src={member.avatarUrl} alt={member.name} className="w-10 h-10 rounded-full object-cover border border-slate-100" />
                                <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${member.status === 'free' ? 'bg-green-500' : 'bg-amber-500'}`}></span>
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-slate-800">{member.name}</p>
                                <p className="text-xs text-slate-500">{member.status === 'free' ? 'Disponível' : 'Em atendimento'}</p>
                            </div>
                        </div>
                        {member.status === 'free' && (
                            <button className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded font-medium transition">
                                Alocar
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </Card>
    );
};

const UpcomingTimeline = ({ appointments }: { appointments: any[] }) => {
    const nextApps = appointments
        .filter(a => ['agendado', 'confirmado'].includes(a.status) && new Date(a.start) > new Date())
        .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
        .slice(0, 4);

    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 h-full">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800">Próximos Clientes</h3>
                <button className="text-xs text-orange-600 font-semibold hover:underline">Ver Agenda</button>
            </div>
            
            {nextApps.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-slate-400 text-sm">
                    <Clock className="w-8 h-8 mb-2 opacity-50"/>
                    Sem próximos agendamentos hoje.
                </div>
            ) : (
                <div className="space-y-0 relative">
                    {/* Line */}
                    <div className="absolute left-[21px] top-2 bottom-2 w-0.5 bg-slate-100"></div>
                    
                    {nextApps.map((app, i) => (
                        <div key={app.id} className="flex gap-4 relative mb-4 last:mb-0">
                            <div className={`relative z-10 w-11 h-11 rounded-full flex flex-col items-center justify-center border-4 border-white shadow-sm flex-shrink-0 ${
                                i === 0 ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-500'
                            }`}>
                                <span className="text-xs font-bold leading-none">{format(app.start, 'HH')}</span>
                                <span className="text-[10px] font-medium leading-none">{format(app.start, 'mm')}</span>
                            </div>
                            <div className="flex-1 bg-slate-50 p-3 rounded-xl border border-slate-100 hover:border-orange-200 transition-colors">
                                <p className="font-bold text-sm text-slate-800">{app.client?.nome}</p>
                                <p className="text-xs text-slate-500 mb-1">{app.service?.name}</p>
                                <div className="flex items-center gap-2">
                                    <img src={app.professional?.avatarUrl} className="w-4 h-4 rounded-full" alt="" />
                                    <span className="text-[10px] text-slate-400">{app.professional?.name?.split(' ')[0]}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
    const [userName] = useState("Jacilene"); // Would come from auth
    const today = new Date();

    // Calculate Data
    const kpis = useMemo(() => {
        const apps = safe(initialAppointments);
        const done = apps.filter(a => a.status === 'concluido');
        const revenue = done.reduce((sum, a) => sum + toNumber(a.service?.price), 0);
        const count = done.length;
        const scheduled = apps.filter(a => ['agendado', 'confirmado'].includes(a.status)).length;
        
        return {
            revenue,
            count,
            scheduled
        };
    }, []);

    const dailyGoal = 2000.00;

    return (
        <div className="p-6 h-full overflow-y-auto bg-slate-50/50">
            {/* Header Section */}
            <header className="flex flex-col md:flex-row justify-between items-end md:items-center mb-8 gap-4">
                <div>
                    <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                        <Calendar className="w-4 h-4" />
                        <span className="capitalize">{format(today, "EEEE, dd 'de' MMMM", { locale: ptBR })}</span>
                    </div>
                    <h1 className="text-2xl md:text-3xl font-bold text-slate-800">
                        Bom dia, <span className="text-orange-500">{userName}!</span>
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Aqui está o resumo operacional do seu estúdio hoje.</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => onNavigate('agenda')} className="px-4 py-2 bg-white border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition shadow-sm flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Ver Agenda
                    </button>
                    <button onClick={() => onNavigate('agenda')} className="px-4 py-2 bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 transition shadow-lg shadow-orange-200 flex items-center gap-2">
                        <PlusCircle className="w-5 h-5" />
                        Novo Agendamento
                    </button>
                </div>
            </header>

            {/* Top Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard 
                    title="Faturamento Hoje" 
                    value={`R$ ${kpis.revenue.toFixed(2)}`} 
                    trend={12} 
                    icon={DollarSign} 
                    colorClass="bg-green-500" 
                />
                <StatCard 
                    title="Atendimentos" 
                    value={kpis.count} 
                    trend={5} 
                    icon={Users} 
                    colorClass="bg-blue-500" 
                />
                <StatCard 
                    title="Agendados" 
                    value={kpis.scheduled} 
                    icon={Calendar} 
                    colorClass="bg-purple-500" 
                />
                 {/* Goal Ring takes up 1 slot */}
                <GoalRing current={kpis.revenue} target={dailyGoal} />
            </div>

            {/* Middle Section: Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {/* Left Column: Actions & Assistant */}
                <div className="space-y-6 lg:col-span-2">
                    {/* Smart Actions Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                        <QuickAction icon={PlusCircle} label="Agendar" color="bg-orange-500" onClick={() => onNavigate('agenda')} />
                        <QuickAction icon={UserPlus} label="Novo Cliente" color="bg-blue-500" onClick={() => onNavigate('clientes')} />
                        <QuickAction icon={Globe} label="Agenda Online" color="bg-purple-500" onClick={() => onNavigate('agenda_online')} />
                        <QuickAction icon={ShoppingBag} label="Venda Rápida" color="bg-green-500" onClick={() => onNavigate('vendas')} />
                        <QuickAction icon={TrendingUp} label="Fechar Caixa" color="bg-slate-800" onClick={() => onNavigate('financeiro')} />
                    </div>

                    {/* AI Assistant */}
                    <JaciBotAssistant fetchInsight={getDashboardInsight} />
                    
                    {/* Charts Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card title="Ocupação da Equipe">
                            <SafeBar 
                                data={safe(professionals).map(p => ({
                                    name: p.name.split(' ')[0],
                                    ocupacao: Math.floor(Math.random() * 40) + 40,
                                    minutosOcupados: 300
                                }))} 
                                color="#f97316" 
                            />
                        </Card>
                        <Card title="Receita por Categoria">
                             <SafePie 
                                data={[
                                    { name: 'Cabelo', receita: 1200 },
                                    { name: 'Unhas', receita: 450 },
                                    { name: 'Estética', receita: 800 },
                                    { name: 'Produtos', receita: 200 }
                                ]} 
                                colors={['#f97316', '#fb923c', '#fdba74', '#fed7aa']} 
                             />
                        </Card>
                    </div>
                </div>

                {/* Right Column: Timeline & Team */}
                <div className="space-y-6">
                    <UpcomingTimeline appointments={initialAppointments} />
                    <TeamPulse />
                    
                    {/* Mini Ad / Promo / Tip */}
                    <div className="bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-2xl p-6 text-white relative overflow-hidden">
                        <div className="relative z-10">
                            <h4 className="font-bold text-lg mb-2">Dica do dia</h4>
                            <p className="text-sm text-indigo-100 mb-4">Clientes que retornam em até 15 dias gastam 30% a mais. Envie lembretes hoje!</p>
                            <button className="text-xs bg-white text-indigo-600 px-3 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-indigo-50 transition">
                                Enviar Campanhas <ArrowRight size={14}/>
                            </button>
                        </div>
                        <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white/20 rounded-full blur-xl"></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardView;

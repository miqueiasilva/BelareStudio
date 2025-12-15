
import React, { useState, useMemo } from 'react';
import { 
    BarChart3, TrendingUp, TrendingDown, DollarSign, Calendar, 
    ChevronLeft, ChevronRight, Download
} from 'lucide-react';
import { format, addMonths, isSameMonth } from 'date-fns';
import { pt } from 'date-fns/locale';
import Card from '../shared/Card';
import SafePie from '../charts/SafePie';
import SafeBar from '../charts/SafeBar';
import { mockTransactions, initialAppointments, professionals } from '../../data/mockData';

const RelatoriosView: React.FC = () => {
    const [currentDate, setCurrentDate] = useState(new Date());

    // --- Actions ---
    const handlePrevMonth = () => setCurrentDate(prev => addMonths(prev, -1));
    const handleNextMonth = () => setCurrentDate(prev => addMonths(prev, 1));

    // --- Data Processing ---

    // 1. Filter Transactions for Financial KPIs
    const financialStats = useMemo(() => {
        const income = mockTransactions
            .filter(t => t.type === 'receita' && isSameMonth(new Date(t.date), currentDate))
            .reduce((sum, t) => sum + t.amount, 0);
            
        const expense = mockTransactions
            .filter(t => t.type === 'despesa' && isSameMonth(new Date(t.date), currentDate))
            .reduce((sum, t) => sum + t.amount, 0);
            
        const profit = income - expense;
        const margin = income > 0 ? (profit / income) * 100 : 0;
        return { income, expense, profit, margin };
    }, [currentDate]);

    // 2. Filter Appointments for Operational KPIs & Charts
    const monthAppointments = useMemo(() => {
        return initialAppointments.filter(a => 
            isSameMonth(new Date(a.start), currentDate) && 
            a.status === 'concluido'
        );
    }, [currentDate]);

    const operationalStats = useMemo(() => {
        const count = monthAppointments.length;
        const serviceRevenue = monthAppointments.reduce((sum, a) => sum + a.service.price, 0);
        const avgTicket = count > 0 ? serviceRevenue / count : 0;
        
        return { count, avgTicket, serviceRevenue };
    }, [monthAppointments]);

    // 3. Chart Data: Revenue by Service Category
    const servicePieData = useMemo(() => {
        const data: Record<string, number> = {};
        monthAppointments.forEach(app => {
            // Use category if available, fallback to name
            const name = app.service.category || app.service.name;
            data[name] = (data[name] || 0) + app.service.price;
        });

        return Object.entries(data)
            .map(([name, value]) => ({ name, receita: value }))
            .sort((a, b) => b.receita - a.receita)
            .slice(0, 5); 
    }, [monthAppointments]);

    // 4. Chart Data: Professional Performance
    const professionalRanking = useMemo(() => {
        return professionals.map(prof => {
            const profApps = monthAppointments.filter(a => a.professional.id === prof.id);
            const revenue = profApps.reduce((sum, a) => sum + a.service.price, 0);
            const totalDuration = profApps.reduce((acc, curr) => acc + curr.service.duration, 0);
            
            return {
                id: prof.id,
                name: prof.name,
                avatar: prof.avatarUrl,
                revenue,
                count: profApps.length,
                ocupacao: Math.min(100, (profApps.length / 40) * 100), // Mock calc
                minutosOcupados: totalDuration
            };
        }).sort((a, b) => b.revenue - a.revenue);
    }, [monthAppointments]);

    return (
        <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4 flex-shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <BarChart3 className="text-orange-500" />
                        Relatórios Gerenciais
                    </h1>
                    <p className="text-slate-500 text-sm">Análise detalhada do desempenho do seu estúdio.</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200">
                        <button onClick={handlePrevMonth} className="p-2 hover:bg-white hover:shadow-sm rounded-md transition-all text-slate-600">
                            <ChevronLeft size={18} />
                        </button>
                        <div className="px-4 font-bold text-slate-700 w-40 text-center capitalize">
                            {format(currentDate, 'MMMM yyyy', { locale: pt })}
                        </div>
                        <button onClick={handleNextMonth} className="p-2 hover:bg-white hover:shadow-sm rounded-md transition-all text-slate-600">
                            <ChevronRight size={18} />
                        </button>
                    </div>
                    <button className="p-2.5 bg-white border border-slate-200 text-slate-600 hover:text-orange-600 hover:border-orange-200 rounded-lg transition-colors shadow-sm" title="Exportar PDF">
                        <Download size={20} />
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Faturamento</p>
                            <div className="p-2 bg-green-50 rounded-lg text-green-600">
                                <DollarSign size={18} />
                            </div>
                        </div>
                        <h3 className="text-2xl font-bold text-slate-800">
                            {financialStats.income.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </h3>
                        <div className="flex items-center gap-1 mt-2 text-xs font-medium text-green-600">
                            <TrendingUp size={14} />
                            <span>+12% vs mês anterior</span>
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Lucro Líquido</p>
                            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                                <TrendingUp size={18} />
                            </div>
                        </div>
                        <h3 className="text-2xl font-bold text-slate-800">
                            {financialStats.profit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </h3>
                        <div className="mt-2 w-full bg-slate-100 rounded-full h-1.5">
                            <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, Math.max(0, financialStats.margin))}%` }}></div>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">Margem: {financialStats.margin.toFixed(1)}%</p>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Atendimentos</p>
                            <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
                                <Calendar size={18} />
                            </div>
                        </div>
                        <h3 className="text-2xl font-bold text-slate-800">
                            {operationalStats.count}
                        </h3>
                        <p className="text-xs text-slate-400 mt-2">Ticket Médio: {operationalStats.avgTicket.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Despesas</p>
                            <div className="p-2 bg-red-50 rounded-lg text-red-600">
                                <TrendingDown size={18} />
                            </div>
                        </div>
                        <h3 className="text-2xl font-bold text-slate-800">
                            {financialStats.expense.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </h3>
                        <div className="flex items-center gap-1 mt-2 text-xs font-medium text-red-500">
                            <span>{((financialStats.expense / (financialStats.income || 1)) * 100).toFixed(1)}% do faturamento</span>
                        </div>
                    </div>
                </div>

                {/* Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <Card title="Desempenho por Profissional" className="h-full">
                            <div className="h-80 w-full">
                                <SafeBar 
                                    data={professionalRanking.map(p => ({
                                        name: p.name.split(' ')[0],
                                        ocupacao: p.ocupacao,
                                        minutosOcupados: p.minutosOcupados
                                    }))}
                                    color="#8b5cf6"
                                />
                            </div>
                        </Card>
                    </div>
                    <div>
                        <Card title="Receita por Categoria" className="h-full">
                            <div className="h-80 w-full">
                                <SafePie 
                                    data={servicePieData} 
                                    colors={['#f97316', '#fb923c', '#fdba74', '#fed7aa', '#cbd5e1']}
                                />
                            </div>
                        </Card>
                    </div>
                </div>

                {/* Top Professionals List */}
                <Card title="Ranking de Profissionais">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs border-b border-slate-100">
                                <tr>
                                    <th className="px-6 py-4">Profissional</th>
                                    <th className="px-6 py-4 text-center">Atendimentos</th>
                                    <th className="px-6 py-4 text-right">Faturamento</th>
                                    <th className="px-6 py-4 text-center">Ocupação Est.</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {professionalRanking.map((prof, index) => (
                                    <tr key={prof.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${index < 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-500'}`}>
                                                    {index + 1}
                                                </span>
                                                <img src={prof.avatar} alt={prof.name} className="w-10 h-10 rounded-full border border-slate-200" />
                                                <span className="font-semibold text-slate-700">{prof.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center text-slate-600 font-medium">
                                            {prof.count}
                                        </td>
                                        <td className="px-6 py-4 text-right font-bold text-slate-800">
                                            {prof.revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 bg-slate-200 h-2 rounded-full overflow-hidden">
                                                    <div 
                                                        className="bg-blue-500 h-full rounded-full" 
                                                        style={{ width: `${prof.ocupacao}%` }}
                                                    ></div>
                                                </div>
                                                <span className="text-xs text-slate-500 w-8 text-right">{prof.ocupacao.toFixed(0)}%</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default RelatoriosView;
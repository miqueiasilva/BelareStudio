
import React, { useState, useMemo } from 'react';
import { initialAppointments, professionals } from '../../data/mockData';
import { format, isSameMonth, addMonths } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Wallet, ChevronDown, ChevronUp, Download, CheckCircle } from 'lucide-react';

const DEFAULT_COMMISSION_RATE = 0.5; // 50%

const RemuneracoesView: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const handlePrevMonth = () => setCurrentDate(prev => addMonths(prev, -1));
  const handleNextMonth = () => setCurrentDate(prev => addMonths(prev, 1));

  const filteredAppointments = useMemo(() => {
    return initialAppointments.filter(app => 
      app.status === 'concluido' && 
      isSameMonth(app.start, currentDate)
    );
  }, [currentDate]);

  const reportData = useMemo(() => {
    return professionals.map(prof => {
      const apps = filteredAppointments.filter(a => a.professional.id === prof.id);
      const totalRevenue = apps.reduce((acc, curr) => acc + curr.service.price, 0);
      const commission = totalRevenue * DEFAULT_COMMISSION_RATE;
      return {
        professional: prof,
        appointments: apps,
        totalRevenue,
        commission,
        count: apps.length
      };
    }).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [filteredAppointments]);

  const totalMonthRevenue = reportData.reduce((acc, curr) => acc + curr.totalRevenue, 0);
  const totalMonthCommission = reportData.reduce((acc, curr) => acc + curr.commission, 0);

  return (
    <div className="p-6 h-full overflow-y-auto bg-slate-50/50">
       {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Wallet className="text-orange-500" />
            Remunerações & Comissões
          </h1>
          <p className="text-slate-500 text-sm mt-1">Gestão de pagamentos por desempenho profissional.</p>
        </div>
        
        <div className="flex items-center bg-white rounded-lg border border-slate-200 shadow-sm p-1">
          <button onClick={handlePrevMonth} className="p-2 hover:bg-slate-100 rounded-md text-slate-600">
            <ChevronDown className="w-5 h-5 rotate-90" />
          </button>
          <div className="px-4 font-semibold text-slate-700 min-w-[160px] text-center capitalize">
            {format(currentDate, 'MMMM yyyy', { locale: pt })}
          </div>
          <button onClick={handleNextMonth} className="p-2 hover:bg-slate-100 rounded-md text-slate-600">
            <ChevronDown className="w-5 h-5 -rotate-90" />
          </button>
        </div>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Faturamento Total (Mês)</p>
          <p className="text-2xl font-bold text-slate-800 mt-2">
            {totalMonthRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-orange-200 bg-orange-50 shadow-sm">
          <p className="text-xs font-bold text-orange-700/70 uppercase tracking-wider">Total a Pagar (Comissões)</p>
          <p className="text-2xl font-bold text-orange-600 mt-2">
            {totalMonthCommission.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
             <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Profissionais Ativos</p>
             <p className="text-2xl font-bold text-slate-800 mt-2">{professionals.length}</p>
          </div>
          <button className="text-sm text-blue-600 font-semibold hover:underline flex items-center gap-1">
             <Download size={16}/> Exportar
          </button>
        </div>
      </div>

      {/* Report List */}
      <div className="space-y-4">
        {reportData.map((item) => (
            <div key={item.professional.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm transition-all hover:shadow-md">
                <div 
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50"
                    onClick={() => setExpandedId(expandedId === item.professional.id ? null : item.professional.id)}
                >
                    <div className="flex items-center gap-4">
                        <img src={item.professional.avatarUrl} alt={item.professional.name} className="w-12 h-12 rounded-full border-2 border-white shadow-sm" />
                        <div>
                            <h3 className="font-bold text-slate-800">{item.professional.name}</h3>
                            <p className="text-xs text-slate-500">{item.count} serviços realizados</p>
                        </div>
                    </div>
                    
                     <div className="flex items-center gap-8 md:gap-12">
                        <div className="hidden md:block text-right">
                            <p className="text-xs text-slate-400 uppercase font-semibold">Produção</p>
                            <p className="font-semibold text-slate-700">{item.totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                        </div>
                        
                        <div className="text-right min-w-[120px]">
                            <p className="text-xs text-slate-400 uppercase font-semibold">A Pagar (50%)</p>
                            <p className="text-lg font-bold text-green-600">{item.commission.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                        </div>

                        <div className="text-slate-400">
                            {expandedId === item.professional.id ? <ChevronUp /> : <ChevronDown />}
                        </div>
                    </div>
                </div>
                
                {expandedId === item.professional.id && (
                     <div className="bg-slate-50 border-t border-slate-100 p-4 animate-in slide-in-from-top-2 duration-200">
                        {item.appointments.length > 0 ? (
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-slate-500 uppercase bg-slate-100/50">
                                    <tr>
                                        <th className="px-4 py-2">Data</th>
                                        <th className="px-4 py-2">Cliente</th>
                                        <th className="px-4 py-2">Serviço</th>
                                        <th className="px-4 py-2 text-right">Valor</th>
                                        <th className="px-4 py-2 text-right">Comissão</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {item.appointments.map(app => (
                                        <tr key={app.id}>
                                            <td className="px-4 py-2 text-slate-600">{format(app.start, 'dd/MM HH:mm')}</td>
                                            <td className="px-4 py-2 font-medium text-slate-700">{app.client?.nome}</td>
                                            <td className="px-4 py-2 text-slate-600">{app.service.name}</td>
                                            <td className="px-4 py-2 text-right font-medium text-slate-700">
                                                {app.service.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                            </td>
                                            <td className="px-4 py-2 text-right text-green-600 font-medium">
                                                + {(app.service.price * DEFAULT_COMMISSION_RATE).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <p className="text-center text-slate-500 py-4 italic">Nenhum serviço concluído neste mês.</p>
                        )}
                         <div className="flex justify-end mt-4 pt-4 border-t border-slate-200 gap-3">
                            <button className="px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 shadow-sm flex items-center gap-2">
                                <CheckCircle size={16} />
                                Marcar como Pago
                            </button>
                        </div>
                     </div>
                )}
            </div>
        ))}
      </div>
    </div>
  );
};

export default RemuneracoesView;

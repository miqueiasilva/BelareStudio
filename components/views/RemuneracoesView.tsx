import React, { useState, useMemo, useEffect, useRef } from 'react';
import { initialAppointments } from '../../data/mockData';
import { format, isSameMonth, addMonths } from 'date-fns';
import { ptBR as pt } from 'date-fns/locale/pt-BR';
import { Wallet, ChevronDown, ChevronUp, Download, CheckCircle, Loader2, User, AlertCircle, RefreshCw } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';

const RemuneracoesView: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const isMounted = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchStaff = async () => {
    if (!isMounted.current) return;
    
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    // Safety Timeout (8s)
    const safetyTimeout = setTimeout(() => {
        if (isLoading && isMounted.current) {
            setIsLoading(false);
            setError("O servidor de dados demorou muito para responder. Tente carregar novamente.");
        }
    }, 8000);

    try {
        const { data, error: sbError } = await supabase
            .from('professionals')
            .select('*')
            .order('name')
            .abortSignal(abortControllerRef.current.signal);

        if (sbError) throw sbError;
        if (isMounted.current) {
            setProfessionals(data || []);
        }
    } catch (e: any) {
        if (isMounted.current && e.name !== 'AbortError') {
            setError(e.message || "Erro ao conectar com o banco de dados.");
        }
    } finally {
        clearTimeout(safetyTimeout);
        if (isMounted.current) setIsLoading(false);
    }
  };

  useEffect(() => {
    isMounted.current = true;
    fetchStaff();
    return () => {
        isMounted.current = false;
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
    };
  }, []);

  const filteredAppointments = useMemo(() => {
    return initialAppointments.filter(app => app.status === 'concluido' && isSameMonth(app.start, currentDate));
  }, [currentDate]);

  const reportData = useMemo(() => {
    return professionals.map(prof => {
      const apps = filteredAppointments.filter(a => Number(a.professional.id) === Number(prof.id));
      const totalRevenue = apps.reduce((acc, curr) => acc + curr.service.price, 0);
      const commission = totalRevenue * ((prof.commission_rate || 50) / 100);
      return { professional: prof, appointments: apps, totalRevenue, commission, count: apps.length };
    }).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [filteredAppointments, professionals]);

  const totalMonthRevenue = reportData.reduce((acc, curr) => acc + curr.totalRevenue, 0);
  const totalMonthCommission = reportData.reduce((acc, curr) => acc + curr.commission, 0);

  if (isLoading) {
    return (
        <div className="h-full flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="animate-spin w-10 h-10 mb-4 text-orange-500" />
            <p className="font-medium animate-pulse">Calculando faturamento e comissões...</p>
        </div>
    );
  }

  if (error) {
    return (
        <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-slate-50">
            <div className="bg-white p-10 rounded-[32px] shadow-xl border border-slate-100 max-w-md w-full animate-in zoom-in-95">
                <AlertCircle className="w-16 h-16 text-rose-500 mx-auto mb-6" />
                <h3 className="font-extrabold text-slate-800 text-xl mb-2">Ops! Algo deu errado</h3>
                <p className="text-slate-500 text-sm mb-8 leading-relaxed">{error}</p>
                <button 
                    onClick={fetchStaff} 
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg shadow-orange-100"
                >
                    <RefreshCw size={20} /> Tentar Carregar Agora
                </button>
            </div>
        </div>
    );
  }

  return (
    <div className="p-6 h-full overflow-y-auto bg-slate-50/50 font-sans">
      <header className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div><h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Wallet className="text-orange-500" /> Remunerações</h1></div>
        <div className="flex items-center bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
          <button onClick={() => setCurrentDate(prev => addMonths(prev, -1))} className="p-2 hover:bg-slate-50 text-slate-600 rounded-lg"><ChevronDown className="w-5 h-5 rotate-90" /></button>
          <div className="px-6 font-bold text-slate-700 min-w-[180px] text-center capitalize">{format(currentDate, 'MMMM yyyy', { locale: pt })}</div>
          <button onClick={() => setCurrentDate(prev => addMonths(prev, 1))} className="p-2 hover:bg-slate-50 text-slate-600 rounded-lg"><ChevronDown className="w-5 h-5 -rotate-90" /></button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Produção Bruta Total</p>
            <p className="text-2xl font-black text-slate-800">{totalMonthRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
        </div>
        <div className="bg-orange-50 p-6 rounded-2xl border border-orange-200 shadow-sm">
            <p className="text-[10px] font-black text-orange-700 uppercase tracking-widest mb-1">Total Comissões (A Pagar)</p>
            <p className="text-2xl font-black text-orange-600">{totalMonthCommission.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Profissionais Pagos</p>
                <p className="text-2xl font-black text-slate-800">{professionals.length}</p>
            </div>
            <button className="bg-blue-50 text-blue-600 p-3 rounded-xl hover:bg-blue-100 transition-colors" title="Exportar Relatório PDF">
                <Download size={24}/>
            </button>
        </div>
      </div>

      <div className="space-y-4">
        {reportData.map((item) => (
            <div key={item.professional.id} className="bg-white border border-slate-200 rounded-[24px] overflow-hidden shadow-sm transition-all hover:shadow-md hover:border-orange-200">
                <div className="flex items-center justify-between p-5 cursor-pointer hover:bg-slate-50/50" onClick={() => setExpandedId(expandedId === item.professional.id ? null : item.professional.id)}>
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-full border-4 border-white bg-slate-100 flex items-center justify-center overflow-hidden shadow-sm">
                            {item.professional.photo_url ? (
                                <img src={item.professional.photo_url} className="w-full h-full object-cover" alt={item.professional.name} />
                            ) : (
                                <User size={28} className="text-slate-300" />
                            )}
                        </div>
                        <div>
                            <h3 className="font-extrabold text-slate-800">{item.professional.name}</h3>
                            <p className="text-xs text-slate-500 font-medium">{item.count} serviços concluídos</p>
                        </div>
                    </div>
                     <div className="flex items-center gap-8">
                        <div className="text-right min-w-[120px]">
                            <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest mb-0.5">Líquido Profissional</p>
                            <p className="text-xl font-black text-green-600">{item.commission.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                        </div>
                        <div className="p-2 bg-slate-50 rounded-lg text-slate-400 group-hover:text-orange-500 transition-colors">
                            {expandedId === item.professional.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </div>
                    </div>
                </div>
                {expandedId === item.professional.id && (
                     <div className="bg-slate-50/50 border-t border-slate-100 p-6 animate-in slide-in-from-top-2 duration-300">
                        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm mb-6">
                            <table className="w-full text-sm text-left">
                                <thead className="text-[10px] text-slate-400 uppercase font-black bg-slate-50 tracking-widest border-b border-slate-100">
                                    <tr>
                                        <th className="px-6 py-4">Data/Hora</th>
                                        <th className="px-6 py-4">Serviço Realizado</th>
                                        <th className="px-6 py-4 text-right">Preço Bruto</th>
                                        <th className="px-6 py-4 text-right">Comissão ({item.professional.commission_rate || 50}%)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {item.appointments.map(app => (
                                        <tr key={app.id} className="hover:bg-slate-50/50">
                                            <td className="px-6 py-4 text-slate-500 font-medium">{format(app.start, 'dd/MM HH:mm')}</td>
                                            <td className="px-6 py-4 font-bold text-slate-700">{app.service.name}</td>
                                            <td className="px-6 py-4 text-right text-slate-600">{app.service.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                            <td className="px-6 py-4 text-right text-green-600 font-black">+ {(app.service.price * ((item.professional.commission_rate || 50) / 100)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="flex justify-end items-center gap-4">
                            <button className="text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors">Gerar Recibo Detalhado</button>
                            <button className="px-8 py-3 text-sm font-black text-white bg-green-600 rounded-2xl flex items-center gap-2 hover:bg-green-700 shadow-lg shadow-green-100 transition-all active:scale-95">
                                <CheckCircle size={18} /> Marcar como Pago
                            </button>
                        </div>
                     </div>
                )}
            </div>
        ))}
      </div>
      
      {reportData.length === 0 && !isLoading && !error && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Wallet size={48} className="opacity-20 mb-4" />
            <p>Nenhum dado financeiro para o período selecionado.</p>
        </div>
      )}
    </div>
  );
};

export default RemuneracoesView;
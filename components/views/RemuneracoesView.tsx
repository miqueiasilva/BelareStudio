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

    const safetyTimeout = setTimeout(() => {
        if (isLoading && isMounted.current) {
            setIsLoading(false);
            setError("O servidor demorou muito para responder (8s).");
        }
    }, 8000);

    try {
        const { data, error } = await supabase.from('professionals').select('*').order('name');
        if (error) throw error;
        if (isMounted.current) setProfessionals(data || []);
    } catch (e: any) {
        if (isMounted.current && e.name !== 'AbortError') setError(e.message || "Erro ao carregar dados.");
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
        if (abortControllerRef.current) abortControllerRef.current.abort();
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
            <p className="font-medium animate-pulse">Calculando remunerações...</p>
        </div>
    );
  }

  if (error) {
    return (
        <div className="h-full flex flex-col items-center justify-center p-8 text-center">
            <div className="bg-red-50 p-6 rounded-3xl mb-4 border border-red-100 max-w-sm">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h3 className="font-bold text-red-800 text-lg mb-2">Ops!</h3>
                <p className="text-red-600 text-sm mb-6">{error}</p>
                <button onClick={fetchStaff} className="w-full bg-red-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2">
                    <RefreshCw size={18} /> Tentar Novamente
                </button>
            </div>
        </div>
    );
  }

  return (
    <div className="p-6 h-full overflow-y-auto bg-slate-50/50 font-sans">
      <header className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div><h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Wallet className="text-orange-500" /> Remunerações</h1></div>
        <div className="flex items-center bg-white rounded-lg border border-slate-200 p-1">
          <button onClick={() => setCurrentDate(prev => addMonths(prev, -1))} className="p-2 hover:bg-slate-100 text-slate-600"><ChevronDown className="w-5 h-5 rotate-90" /></button>
          <div className="px-4 font-semibold text-slate-700 min-w-[160px] text-center capitalize">{format(currentDate, 'MMMM yyyy', { locale: pt })}</div>
          <button onClick={() => setCurrentDate(prev => addMonths(prev, 1))} className="p-2 hover:bg-slate-100 text-slate-600"><ChevronDown className="w-5 h-5 -rotate-90" /></button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm"><p className="text-xs font-bold text-slate-400 uppercase">Produção Total</p><p className="text-2xl font-bold text-slate-800 mt-2">{totalMonthRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p></div>
        <div className="bg-orange-50 p-6 rounded-xl border border-orange-200 shadow-sm"><p className="text-xs font-bold text-orange-700 uppercase">A Pagar</p><p className="text-2xl font-bold text-orange-600 mt-2">{totalMonthCommission.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p></div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between"><div><p className="text-xs font-bold text-slate-400 uppercase">Ativos</p><p className="text-2xl font-bold text-slate-800 mt-2">{professionals.length}</p></div><button className="text-blue-600 font-bold flex items-center gap-1"><Download size={16}/> PDF</button></div>
      </div>

      <div className="space-y-4">
        {reportData.map((item) => (
            <div key={item.professional.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm transition-all hover:shadow-md">
                <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50" onClick={() => setExpandedId(expandedId === item.professional.id ? null : item.professional.id)}>
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center overflow-hidden">
                            {item.professional.photo_url ? <img src={item.professional.photo_url} className="w-full h-full object-cover" /> : <User size={24} className="text-slate-300" />}
                        </div>
                        <div><h3 className="font-bold text-slate-800">{item.professional.name}</h3><p className="text-xs text-slate-500">{item.count} serviços</p></div>
                    </div>
                     <div className="flex items-center gap-8"><div className="text-right min-w-[120px]"><p className="text-xs text-slate-400 uppercase font-semibold">Ganhos</p><p className="text-lg font-bold text-green-600">{item.commission.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p></div><div>{expandedId === item.professional.id ? <ChevronUp /> : <ChevronDown />}</div></div>
                </div>
                {expandedId === item.professional.id && (
                     <div className="bg-slate-50 border-t p-4">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-500 uppercase bg-slate-100/50"><tr><th className="px-4 py-2">Data</th><th className="px-4 py-2">Serviço</th><th className="px-4 py-2 text-right">Valor</th><th className="px-4 py-2 text-right">Comissão</th></tr></thead>
                            <tbody className="divide-y">
                                {item.appointments.map(app => (
                                    <tr key={app.id}><td className="px-4 py-2">{format(app.start, 'dd/MM HH:mm')}</td><td className="px-4 py-2">{app.service.name}</td><td className="px-4 py-2 text-right">{app.service.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td><td className="px-4 py-2 text-right text-green-600">+ {(app.service.price * ((item.professional.commission_rate || 50) / 100)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td></tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="flex justify-end mt-4"><button className="px-4 py-2 text-sm font-bold text-white bg-green-600 rounded-lg flex items-center gap-2"><CheckCircle size={16} /> Pagar Agora</button></div>
                     </div>
                )}
            </div>
        ))}
      </div>
    </div>
  );
};

export default RemuneracoesView;
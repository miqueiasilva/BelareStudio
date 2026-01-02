
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { format, isSameMonth, addMonths, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR as pt } from 'date-fns/locale/pt-BR';
import { 
    Wallet, ChevronDown, ChevronUp, Download, CheckCircle, 
    Loader2, User, AlertCircle, RefreshCw, TrendingUp, Scissors,
    ShieldCheck
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import Card from '../shared/Card';

const RemuneracoesView: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const isMounted = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchData = async () => {
    if (!isMounted.current) return;
    
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
        const start = startOfMonth(currentDate).toISOString();
        const end = endOfMonth(currentDate).toISOString();

        // 1. Busca Profissionais com as colunas reais do banco
        const { data: profData, error: profError } = await supabase
            .from('professionals')
            .select('*, commission_rate, receives_commission')
            .order('name');

        if (profError) throw profError;

        // 2. Busca Agendamentos CONCLUÍDOS no período
        const { data: apptData, error: apptError } = await supabase
            .from('appointments')
            .select('*')
            .eq('status', 'concluido')
            .gte('date', start)
            .lte('date', end);

        if (apptError) throw apptError;

        if (isMounted.current) {
            setProfessionals(profData || []);
            setAppointments(apptData || []);
        }
    } catch (e: any) {
        if (isMounted.current && e.name !== 'AbortError') {
            setError(e.message || "Erro ao carregar dados financeiros.");
        }
    } finally {
        if (isMounted.current) setIsLoading(false);
    }
  };

  useEffect(() => {
    isMounted.current = true;
    fetchData();
    return () => {
        isMounted.current = false;
        if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [currentDate]);

  // --- Lógica de Processamento de Comissões Reais ---
  const payroll = useMemo(() => {
    return professionals.map(prof => {
      const myApps = appointments.filter(a => Number(a.resource_id) === Number(prof.id));
      const totalRevenue = myApps.reduce((acc, curr) => acc + (Number(curr.value) || 0), 0);
      
      // Regra de Negócio: Se não recebe comissão (gestores), o repasse é zero
      const canReceive = !!prof.receives_commission;
      const commissionRate = canReceive ? (Number(prof.commission_rate) || 0) : 0;
      const netCommission = canReceive ? (totalRevenue * (commissionRate / 100)) : 0;

      return {
        professional: prof,
        appointments: myApps,
        totalRevenue,
        netCommission,
        count: myApps.length,
        rate: commissionRate,
        canReceive
      };
    }).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [professionals, appointments]);

  const totals = useMemo(() => {
    return payroll.reduce((acc, curr) => ({
      revenue: acc.revenue + curr.totalRevenue,
      commission: acc.commission + curr.netCommission
    }), { revenue: 0, commission: 0 });
  }, [payroll]);

  const formatBRL = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  if (isLoading) {
    return (
        <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50">
            <Loader2 className="animate-spin w-12 h-12 mb-4 text-orange-500" />
            <p className="font-black uppercase tracking-[0.2em] text-[10px] animate-pulse">Auditando Ganhos Reais...</p>
        </div>
    );
  }

  return (
    <div className="p-6 h-full overflow-y-auto bg-slate-50/50 font-sans text-left">
      <header className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
            <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                <Wallet className="text-orange-500" /> Remunerações
            </h1>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Cálculo individual de repasses e produção</p>
        </div>
        <div className="flex items-center bg-white rounded-2xl border border-slate-200 p-1.5 shadow-sm">
          <button onClick={() => setCurrentDate(prev => addMonths(prev, -1))} className="p-2 hover:bg-slate-50 text-slate-400 rounded-xl transition-colors"><ChevronDown className="w-5 h-5 rotate-90" /></button>
          <div className="px-6 font-black text-slate-700 min-w-[200px] text-center capitalize text-sm">
              {format(currentDate, 'MMMM yyyy', { locale: pt })}
          </div>
          <button onClick={() => setCurrentDate(prev => addMonths(prev, 1))} className="p-2 hover:bg-slate-50 text-slate-400 rounded-xl transition-colors"><ChevronDown className="w-5 h-5 -rotate-90" /></button>
        </div>
      </header>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Produção Bruta Equipe</p>
            <div className="flex items-center justify-between">
                <h3 className="text-2xl font-black text-slate-800">{formatBRL(totals.revenue)}</h3>
                <TrendingUp size={20} className="text-emerald-500" />
            </div>
        </div>
        <div className="bg-slate-900 p-6 rounded-[32px] text-white shadow-xl shadow-slate-200">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total de Repasses</p>
            <div className="flex items-center justify-between">
                <h3 className="text-2xl font-black text-orange-400">{formatBRL(totals.commission)}</h3>
                <Wallet size={20} className="text-orange-500" />
            </div>
        </div>
        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center justify-between">
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Ticket Médio p/ Profissional</p>
                <p className="text-2xl font-black text-slate-800">{formatBRL(payroll.length > 0 ? totals.revenue / payroll.length : 0)}</p>
            </div>
            <button className="bg-orange-50 text-orange-600 p-4 rounded-2xl hover:bg-orange-100 transition-all active:scale-95">
                <Download size={24}/>
            </button>
        </div>
      </div>

      {/* Lista de Profissionais */}
      <div className="space-y-4">
        {payroll.map((item) => (
            <div key={item.professional.id} className="bg-white border border-slate-100 rounded-[32px] overflow-hidden shadow-sm transition-all hover:shadow-md">
                <div 
                    className="flex items-center justify-between p-6 cursor-pointer hover:bg-slate-50/50" 
                    onClick={() => setExpandedId(expandedId === item.professional.id ? null : item.professional.id)}
                >
                    <div className="flex items-center gap-5">
                        <div className="w-16 h-16 rounded-[24px] border-4 border-white bg-slate-100 flex items-center justify-center overflow-hidden shadow-sm">
                            {item.professional.photo_url ? (
                                <img src={item.professional.photo_url} className="w-full h-full object-cover" alt={item.professional.name} />
                            ) : (
                                <User size={32} className="text-slate-300" />
                            )}
                        </div>
                        <div>
                            <h3 className="font-black text-slate-800 text-lg leading-tight">{item.professional.name}</h3>
                            <div className="flex items-center gap-2 mt-1">
                                {item.canReceive ? (
                                    <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg border border-slate-200 uppercase tracking-widest">
                                        Taxa: {item.rate}%
                                    </span>
                                ) : (
                                    <span className="text-[9px] font-black bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-lg border border-indigo-100 uppercase tracking-widest flex items-center gap-1">
                                        <ShieldCheck size={10} /> Gestão
                                    </span>
                                )}
                                <span className="text-[9px] font-black bg-orange-50 text-orange-600 px-2 py-0.5 rounded-lg border border-orange-100 uppercase tracking-widest">
                                    {item.count} Atendimentos
                                </span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-10">
                        <div className="text-right">
                            <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-0.5">Produção Bruta</p>
                            <p className="text-sm font-bold text-slate-400">{formatBRL(item.totalRevenue)}</p>
                        </div>
                        <div className="text-right min-w-[140px]">
                            <p className={`text-[9px] font-black uppercase tracking-widest mb-0.5 ${item.canReceive ? 'text-orange-500' : 'text-slate-400'}`}>
                                {item.canReceive ? 'Comissão Líquida' : 'Repasse'}
                            </p>
                            <p className={`text-2xl font-black ${item.canReceive ? 'text-orange-600' : 'text-slate-300 italic'}`}>
                                {item.canReceive ? formatBRL(item.netCommission) : "Gestão"}
                            </p>
                        </div>
                        <div className={`p-3 rounded-2xl transition-all ${expandedId === item.professional.id ? 'bg-orange-500 text-white' : 'bg-slate-50 text-slate-400'}`}>
                            {expandedId === item.professional.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </div>
                    </div>
                </div>

                {expandedId === item.professional.id && (
                     <div className="bg-slate-50/50 border-t border-slate-100 p-8 animate-in slide-in-from-top-4 duration-300">
                        <div className="flex items-center gap-2 mb-6">
                            <Scissors size={18} className="text-slate-400" />
                            <h4 className="text-xs font-black text-slate-600 uppercase tracking-[0.2em]">Detalhamento de Atividades</h4>
                        </div>

                        {item.appointments.length > 0 ? (
                            <div className="bg-white rounded-[24px] border border-slate-200 overflow-hidden shadow-sm mb-8">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-[10px] text-slate-400 uppercase font-black bg-slate-50/50 tracking-widest border-b border-slate-100">
                                        <tr>
                                            <th className="px-8 py-5">Data e Cliente</th>
                                            <th className="px-8 py-5">Serviço</th>
                                            <th className="px-8 py-5 text-right">Valor Bruto</th>
                                            {item.canReceive && <th className="px-8 py-5 text-right text-orange-600">Comissão ({item.rate}%)</th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {item.appointments.map((app: any) => (
                                            <tr key={app.id} className="hover:bg-slate-50 transition-colors group">
                                                <td className="px-8 py-4">
                                                    <p className="font-bold text-slate-700">{app.client_name || 'Cliente'}</p>
                                                    <p className="text-[10px] text-slate-400 font-medium">{format(new Date(app.date), 'dd/MM HH:mm')}</p>
                                                </td>
                                                <td className="px-8 py-4">
                                                    <span className="text-xs font-bold text-slate-500 uppercase">{app.service_name}</span>
                                                </td>
                                                <td className="px-8 py-4 text-right text-slate-400 font-mono">
                                                    {formatBRL(Number(app.value))}
                                                </td>
                                                {item.canReceive && (
                                                    <td className="px-8 py-4 text-right text-orange-600 font-black font-mono">
                                                        + {formatBRL(Number(app.value) * (item.rate / 100))}
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="p-10 text-center bg-white rounded-[24px] border border-dashed border-slate-200 mb-8">
                                <p className="text-slate-400 text-sm font-medium">Nenhum agendamento concluído por este profissional no período.</p>
                            </div>
                        )}

                        <div className="flex justify-end items-center gap-4">
                            <button className="text-xs font-black text-slate-400 uppercase tracking-widest hover:text-slate-800 transition-colors">Visualizar Comprovante</button>
                            <button 
                                disabled={item.appointments.length === 0 || !item.canReceive}
                                className="px-10 py-4 text-xs font-black text-white bg-emerald-600 rounded-2xl flex items-center gap-3 hover:bg-emerald-700 shadow-xl shadow-emerald-100 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale"
                            >
                                <CheckCircle size={20} /> Marcar como Pago
                            </button>
                        </div>
                     </div>
                )}
            </div>
        ))}
      </div>
      
      {payroll.length === 0 && !isLoading && (
        <div className="flex flex-col items-center justify-center py-24 text-slate-300">
            <AlertCircle size={64} className="opacity-20 mb-4" />
            <p className="font-black uppercase tracking-[0.2em] text-xs">Sem movimentações financeiras para exibir</p>
        </div>
      )}
    </div>
  );
};

export default RemuneracoesView;

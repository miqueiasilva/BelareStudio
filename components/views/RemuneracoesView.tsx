
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
    Wallet, ChevronDown, ChevronUp, Download, CheckCircle, 
    RefreshCw, Loader2, DollarSign, User as UserIcon, Calendar, Briefcase
} from 'lucide-react';
import { format, isSameMonth, addMonths, startOfMonth, endOfMonth } from 'date-fns';
import { pt } from 'date-fns/locale';
import { supabase } from '../../services/supabaseClient';
import { LegacyProfessional, LegacyAppointment } from '../../types';
import Card from '../shared/Card';
import Toast, { ToastType } from '../shared/Toast';

const RemuneracoesView: React.FC = () => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [professionals, setProfessionals] = useState<LegacyProfessional[]>([]);
    const [appointments, setAppointments] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    const abortControllerRef = useRef<AbortController | null>(null);

    const fetchData = useCallback(async () => {
        if (abortControllerRef.current) abortControllerRef.current.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;

        setIsLoading(true);
        try {
            const mStart = startOfMonth(currentDate).toISOString();
            const mEnd = endOfMonth(currentDate).toISOString();

            const [pRes, aRes] = await Promise.all([
                supabase.from('professionals').select('*').order('name').abortSignal(controller.signal),
                supabase.from('appointments')
                    .select('*, clients(nome)')
                    .eq('status', 'concluido')
                    .gte('date', mStart)
                    .lte('date', mEnd)
                    .abortSignal(controller.signal)
            ]);

            setProfessionals(pRes.data || []);
            setAppointments(aRes.data || []);
        } catch (e: any) {
            if (e.name === 'AbortError' || e.message?.includes('aborted')) return;
            setToast({ message: 'Erro ao sincronizar remunerações: ' + e.message, type: 'error' });
        } finally {
            if (abortControllerRef.current === controller) {
                setIsLoading(false);
            }
        }
    }, [currentDate]);

    useEffect(() => {
        fetchData();
        return () => abortControllerRef.current?.abort();
    }, [fetchData]);

    const handlePrevMonth = () => setCurrentDate(prev => addMonths(prev, -1));
    const handleNextMonth = () => setCurrentDate(prev => addMonths(prev, 1));

    const reportData = useMemo(() => {
        return professionals.map(prof => {
            const profApps = appointments.filter(a => Number(a.resource_id) === prof.id);
            const totalProduction = profApps.reduce((acc, a) => acc + (parseFloat(a.value) || 0), 0);
            
            // Usa a taxa configurada no profissional ou padrão de 30%
            const rate = (prof as any).commission_rate ? (prof as any).commission_rate / 100 : 0.3;
            const commission = totalProduction * rate;

            return {
                professional: prof,
                appointments: profApps,
                totalProduction,
                commission,
                count: profApps.length,
                ratePercent: (rate * 100).toFixed(0)
            };
        }).sort((a, b) => b.totalProduction - a.totalProduction);
    }, [professionals, appointments]);

    const totals = useMemo(() => {
        const prod = reportData.reduce((acc, r) => acc + r.totalProduction, 0);
        const comm = reportData.reduce((acc, r) => acc + r.commission, 0);
        return { prod, comm };
    }, [reportData]);

    return (
        <div className="h-full flex flex-col bg-slate-50 overflow-hidden font-sans">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <header className="bg-white border-b border-slate-200 px-6 py-5 flex flex-col md:flex-row justify-between items-center gap-4 flex-shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Wallet className="text-orange-500" /> Remunerações Equipe
                    </h1>
                    <p className="text-slate-500 text-sm font-medium">Cálculo automático de comissões por produtividade.</p>
                </div>
                
                <div className="flex items-center gap-3">
                    <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200 shadow-inner">
                        <button onClick={handlePrevMonth} className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-500">
                             <ChevronDown className="w-5 h-5 rotate-90" />
                        </button>
                        <div className="px-4 font-black text-slate-800 min-w-[150px] text-center capitalize text-sm">
                            {format(currentDate, 'MMMM yyyy', { locale: pt })}
                        </div>
                        <button onClick={handleNextMonth} className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-500">
                             <ChevronDown className="w-5 h-5 -rotate-90" />
                        </button>
                    </div>
                    <button onClick={fetchData} className="p-2.5 text-slate-400 hover:text-orange-500 hover:bg-orange-50 rounded-xl transition-all bg-white border border-slate-100"><RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} /></button>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
                {/* Resumo Gerencial */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
                        <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Produção Total Bruta</p>
                        <h3 className="text-3xl font-black text-slate-900 mt-2 tracking-tighter">
                            R$ {totals.prod.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </h3>
                    </div>
                    <div className="bg-white p-6 rounded-[32px] border border-orange-200 bg-orange-50/30 shadow-sm">
                        <p className="text-orange-600 text-[10px] font-black uppercase tracking-widest">Total Comissões Devidas</p>
                        <h3 className="text-3xl font-black text-orange-600 mt-2 tracking-tighter">
                            R$ {totals.comm.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </h3>
                    </div>
                    <div className="bg-slate-900 p-6 rounded-[32px] shadow-xl text-white flex items-center justify-between">
                        <div>
                             <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Margem Contribuição</p>
                             <h3 className="text-3xl font-black text-orange-500 mt-2 tracking-tighter">
                                R$ {(totals.prod - totals.comm).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                             </h3>
                        </div>
                        <div className="p-4 bg-white/10 rounded-2xl"><Briefcase size={24} className="text-orange-400" /></div>
                    </div>
                </div>

                {/* Lista por Profissional */}
                <div className="space-y-4">
                    {isLoading && reportData.length === 0 ? (
                        <div className="py-20 text-center text-slate-400 animate-pulse">
                            <Loader2 className="animate-spin mx-auto mb-4" size={40} />
                            <p className="font-bold uppercase tracking-widest text-xs">Calculando produtividade...</p>
                        </div>
                    ) : reportData.length === 0 ? (
                        <div className="py-20 text-center text-slate-300 italic">Nenhum serviço concluído no período selecionado.</div>
                    ) : reportData.map((item) => (
                        <div key={item.professional.id} className="bg-white border border-slate-200 rounded-[32px] overflow-hidden shadow-sm transition-all hover:shadow-xl group">
                            <div 
                                className="flex flex-col md:flex-row items-center justify-between p-6 cursor-pointer hover:bg-slate-50 gap-6"
                                onClick={() => setExpandedId(expandedId === item.professional.id ? null : item.professional.id)}
                            >
                                <div className="flex items-center gap-4 w-full md:w-auto">
                                    <div className="relative">
                                        <img src={item.professional.avatarUrl || `https://ui-avatars.com/api/?name=${item.professional.name}`} alt="" className="w-14 h-14 rounded-2xl object-cover border-2 border-slate-100 shadow-sm" />
                                        <div className="absolute -bottom-1 -right-1 bg-green-500 w-4 h-4 rounded-full border-2 border-white shadow-sm"></div>
                                    </div>
                                    <div>
                                        <h3 className="font-black text-slate-800 text-lg leading-tight">{item.professional.name}</h3>
                                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">{item.count} serviços concluídos</p>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-10 w-full md:w-auto justify-between md:justify-end">
                                    <div className="text-right">
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Produção Bruta</p>
                                        <p className="font-bold text-slate-600 text-sm">R$ {item.totalProduction.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                    </div>
                                    
                                    <div className="text-right min-w-[130px] bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Comissão ({item.ratePercent}%)</p>
                                        <p className="text-xl font-black text-emerald-600 tracking-tighter">R$ {item.commission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                    </div>

                                    <div className={`p-2 rounded-full transition-transform duration-300 ${expandedId === item.professional.id ? 'rotate-180 bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-400'}`}>
                                        <ChevronDown size={20} />
                                    </div>
                                </div>
                            </div>
                            
                            {expandedId === item.professional.id && (
                                <div className="bg-slate-50/50 border-t border-slate-100 p-6 animate-in slide-in-from-top-4 duration-300">
                                    <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-inner">
                                        <table className="w-full text-xs text-left">
                                            <thead className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 border-b">
                                                <tr>
                                                    <th className="px-6 py-4">Data/Hora</th>
                                                    <th className="px-6 py-4">Cliente</th>
                                                    <th className="px-6 py-4">Procedimento</th>
                                                    <th className="px-6 py-4 text-right">Valor Total</th>
                                                    <th className="px-6 py-4 text-right">Comissão</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {item.appointments.map((app: any) => (
                                                    <tr key={app.id} className="hover:bg-slate-50 transition-colors">
                                                        <td className="px-6 py-4 text-slate-500 font-bold whitespace-nowrap">{format(new Date(app.date), 'dd/MM HH:mm')}</td>
                                                        <td className="px-6 py-4 font-black text-slate-700">{app.clients?.nome || 'Balcão'}</td>
                                                        <td className="px-6 py-4 text-slate-600 italic">{app.service_name}</td>
                                                        <td className="px-6 py-4 text-right font-bold text-slate-800">
                                                            R$ {parseFloat(app.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                        </td>
                                                        <td className="px-6 py-4 text-right text-emerald-600 font-black">
                                                            + R$ {(parseFloat(app.value) * (parseFloat(item.ratePercent)/100)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="flex justify-end mt-6">
                                        <button className="bg-slate-900 hover:bg-black text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg transition-all active:scale-95">
                                            <CheckCircle size={16} /> Confirmar Lote de Pagamento
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
};

export default RemuneracoesView;

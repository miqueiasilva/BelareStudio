import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { format, addMonths, endOfMonth } from 'date-fns';
import { ptBR as pt } from 'date-fns/locale/pt-BR';
import { 
    Wallet, ChevronDown, ChevronUp, Download, CheckCircle, 
    Loader2, User, TrendingUp,
    DollarSign, Info, Calculator, Percent, Layers, ShieldCheck,
    FileText
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { useStudio } from '../../contexts/StudioContext';
import Toast, { ToastType } from '../shared/Toast';

const getStartOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);

const RemuneracoesView: React.FC = () => {
  const { activeStudioId } = useStudio();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [expandedId, setExpandedId] = useState<string | number | null>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [commandItems, setCommandItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [calculationBase, setCalculationBase] = useState<'bruto' | 'liquido'>('bruto');
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  
  const isMounted = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    if (!isMounted.current || !activeStudioId) return;
    
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    setIsLoading(true);

    try {
        const start = format(getStartOfMonth(currentDate), "yyyy-MM-dd'T'00:00:00");
        const end = format(endOfMonth(currentDate), "yyyy-MM-dd'T'23:59:59");

        const [teamRes, itemsRes] = await Promise.all([
            // FIX 1: Filtra apenas membros ATIVOS — remove "Geral/Studio" e inativos
            supabase.from('team_members')
                .select('id, name, photo_url, commission_rate, commission_percent')
                .eq('studio_id', activeStudioId)
                .eq('active', true)
                .order('name')
                .abortSignal(abortControllerRef.current.signal),

            // FIX 2: Aceita status 'pago' E 'paid' (banco tem os dois)
            // FIX 3: Puxa payment_data (JSONB) que já contém tax_rate e net_value
            supabase.from('command_items')
                .select(`
                    id, title, price, quantity, professional_id,
                    commands!inner(
                        id, closed_at, status, payment_method, payment_data
                    )
                `)
                .eq('studio_id', activeStudioId)
                .in('commands.status', ['pago', 'paid'])
                .not('commands.closed_at', 'is', null)
                .gte('commands.closed_at', start)
                .lte('commands.closed_at', end)
                .abortSignal(abortControllerRef.current.signal),
        ]);

        if (teamRes.error) throw teamRes.error;
        if (itemsRes.error) throw itemsRes.error;

        if (isMounted.current) {
            // FIX 4: Exclui o gestor (commission_rate = 0 E commission_percent = 0)
            // da lista de remunerações (sem serviços vinculados eles ficam zerados de qualquer forma,
            // mas filtramos membros que nunca terão comissão = gestor sem taxa definida)
            const activeProfessionals = (teamRes.data || []).filter(m => {
                const rate = Number(m.commission_rate ?? m.commission_percent ?? 0);
                // Mantém na lista mesmo com rate=0 se for profissional (pode ter sido zerado por engano)
                // O gestor (Miqueias) tem role gestor mas não temos role aqui — filtramos por ter serviços
                return true; // Mantém todos os ativos; o gestor vai aparecer com R$0 mas sem serviços
            });
            setTeamMembers(activeProfessionals);
            setCommandItems(itemsRes.data || []);
        }
    } catch (e: any) {
        const isAbortError = e.name === 'AbortError' || e.message?.includes('aborted');
        if (isMounted.current && !isAbortError) {
            console.error("[REMUNERATIONS] Erro ao buscar dados:", e);
        }
    } finally {
        if (isMounted.current) setIsLoading(false);
    }
  }, [activeStudioId, currentDate]);

  useEffect(() => {
    isMounted.current = true;
    fetchData();
    return () => {
        isMounted.current = false;
        if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [fetchData]);

  const payroll = useMemo(() => {
    return teamMembers.map(member => {
      const memberIdStr = String(member.id);
      
      const myItems = commandItems.filter(item => 
          String(item.professional_id) === memberIdStr
      );
      
      const totalBase = myItems.reduce((acc, item) => {
          const rawPrice = Number(item.price || 0) * Number(item.quantity || 1);
          
          if (calculationBase === 'liquido') {
              // FIX 5: Usa payment_data.tax_rate que já está salvo na comanda
              // Isso é muito mais preciso do que tentar mapear payment_methods_config
              const paymentData = item.commands?.payment_data;
              let taxRate = 0;

              if (paymentData) {
                  // payment_data é JSONB: {"tax_rate": 1.37, "net_value": 98.63, "gross_value": 100}
                  taxRate = Number(paymentData.tax_rate ?? 0);
              }

              const discountMultiplier = 1 - (taxRate / 100);
              return acc + (rawPrice * discountMultiplier);
          }
          return acc + rawPrice;
      }, 0);

      // FIX 6: commission_rate é o campo correto no banco — commission_percent é legado/zerado
      const rate = Number(member.commission_rate ?? member.commission_percent ?? 0);
      const commissionValue = totalBase * (rate / 100);
      
      return { 
          member, 
          items: myItems, 
          totalBase, 
          commissionValue, 
          count: myItems.length, 
          rate 
      };
    })
    // FIX 7: Oculta membros sem nenhum serviço E sem comissão definida (ex: gestor)
    .filter(item => item.count > 0 || item.rate > 0)
    .sort((a, b) => b.totalBase - a.totalBase);
  }, [teamMembers, commandItems, calculationBase]);

  const totals = useMemo(() => {
    return payroll.reduce((acc, curr) => ({
      base: acc.base + curr.totalBase,
      payout: acc.payout + curr.commissionValue
    }), { base: 0, payout: 0 });
  }, [payroll]);

  const formatBRL = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Retorna a taxa aplicada para exibição no detalhamento
  const getTaxRate = (item: any): number => {
      const paymentData = item.commands?.payment_data;
      if (!paymentData) return 0;
      return Number(paymentData.tax_rate ?? 0);
  };

  if (isLoading) return (
    <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50">
        <Loader2 className="animate-spin w-12 h-12 mb-4 text-orange-500" />
        <p className="font-black uppercase tracking-[0.2em] text-[10px] animate-pulse">Calculando Comissões da Unidade...</p>
    </div>
  );

  return (
    <div className="p-6 h-full overflow-y-auto bg-slate-50/50 font-sans text-left">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-8 gap-6">
        <div>
            <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                <div className="p-2 bg-orange-50 text-orange-600 rounded-xl">
                    <Wallet size={24} />
                </div>
                Remunerações
            </h1>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
                Baseado em Comandas Liquidadas
            </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto">
            <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <button 
                    onClick={() => setCalculationBase('bruto')}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${calculationBase === 'bruto' ? 'bg-orange-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                    <Layers size={14} /> Base Bruta
                </button>
                <button 
                    onClick={() => setCalculationBase('liquido')}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${calculationBase === 'liquido' ? 'bg-orange-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                    <ShieldCheck size={14} /> Base Líquida
                </button>
            </div>

            <div className="flex items-center bg-white rounded-2xl border border-slate-200 p-1 shadow-sm">
                <button onClick={() => setCurrentDate(prev => addMonths(prev, -1))} className="p-2 hover:bg-slate-50 text-slate-400 rounded-xl"><ChevronDown className="w-4 h-4 rotate-90" /></button>
                <div className="px-4 font-black text-slate-700 min-w-[140px] text-center capitalize text-xs">{format(currentDate, 'MMMM yyyy', { locale: pt })}</div>
                <button onClick={() => setCurrentDate(prev => addMonths(prev, 1))} className="p-2 hover:bg-slate-50 text-slate-400 rounded-xl"><ChevronDown className="w-4 h-4 -rotate-90" /></button>
            </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm relative overflow-hidden group">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                {calculationBase === 'liquido' ? <ShieldCheck size={12} className="text-emerald-500"/> : <Layers size={12} className="text-blue-500"/>}
                Produção Registrada ({calculationBase})
            </p>
            <div className="flex items-center justify-between relative z-10">
                <h3 className="text-3xl font-black text-slate-800">{formatBRL(totals.base)}</h3>
                <TrendingUp size={24} className="text-emerald-500" />
            </div>
            <div className="absolute -right-2 -bottom-2 opacity-5 group-hover:scale-110 transition-transform">
                <Calculator size={100} />
            </div>
        </div>
        <div className="bg-slate-900 p-6 rounded-[32px] text-white shadow-xl shadow-slate-200 relative overflow-hidden">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total a Repassar em Comissões</p>
            <div className="flex items-center justify-between relative z-10">
                <h3 className="text-3xl font-black text-orange-400">{formatBRL(totals.payout)}</h3>
                <Wallet size={24} className="text-orange-500" />
            </div>
            <div className="absolute -right-4 -bottom-4 opacity-10">
                <Percent size={120} strokeWidth={3} />
            </div>
        </div>
      </div>

      <div className="space-y-4">
        {payroll.map((item) => (
            <div key={item.member.id} className="bg-white border border-slate-100 rounded-[32px] overflow-hidden shadow-sm transition-all hover:shadow-md">
                <div 
                    className="flex flex-col md:flex-row items-center justify-between p-6 cursor-pointer hover:bg-slate-50/50 gap-6" 
                    onClick={() => setExpandedId(expandedId === item.member.id ? null : item.member.id)}
                >
                    <div className="flex items-center gap-5 w-full md:w-auto">
                        <div className="w-16 h-16 rounded-[24px] border-4 border-white bg-slate-100 flex items-center justify-center overflow-hidden shadow-sm flex-shrink-0">
                            {item.member.photo_url ? (
                                <img src={item.member.photo_url} className="w-full h-full object-cover" alt={item.member.name} />
                            ) : (
                                <User size={32} className="text-slate-300" />
                            )}
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-black text-slate-800 text-lg leading-tight truncate">{item.member.name}</h3>
                            <div className="flex items-center gap-2 mt-1">
                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg border uppercase tracking-widest ${item.rate > 0 ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-rose-50 text-rose-500 border-rose-100'}`}>
                                    Contrato: {item.rate}%
                                </span>
                                <span className="text-[9px] font-black bg-orange-50 text-orange-600 px-2 py-0.5 rounded-lg border border-orange-100 uppercase tracking-widest">{item.count} Serviços</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex items-center justify-between md:justify-end gap-4 md:gap-10 w-full md:w-auto">
                        <div className="text-right">
                            <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-0.5">Produção ({calculationBase})</p>
                            <p className="text-sm font-bold text-slate-400">{formatBRL(item.totalBase)}</p>
                        </div>
                        <div className="text-right min-w-[120px]">
                            <p className="text-[9px] font-black uppercase tracking-widest mb-0.5 text-orange-500">Repasse Líquido</p>
                            <p className="text-2xl font-black text-orange-600">{formatBRL(item.commissionValue)}</p>
                        </div>
                        <div className={`p-3 rounded-2xl transition-all flex-shrink-0 ${expandedId === item.member.id ? 'bg-orange-500 text-white' : 'bg-slate-50 text-slate-400'}`}>
                            {expandedId === item.member.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </div>
                    </div>
                </div>

                {expandedId === item.member.id && (
                     <div className="bg-slate-50/50 border-t border-slate-100 p-6 md:p-8 animate-in slide-in-from-top-4 duration-300">
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
                            <h4 className="text-xs font-black text-slate-600 uppercase tracking-[0.2em] flex items-center gap-2">
                                <FileText size={16} className="text-orange-500" /> Detalhamento de Atendimentos
                            </h4>
                            <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border border-blue-100">
                                <Info size={14} /> Cálculo sobre base {calculationBase}
                            </div>
                        </div>

                        {item.items.length > 0 ? (
                            <div className="bg-white rounded-[24px] border border-slate-200 overflow-hidden shadow-sm mb-8 overflow-x-auto">
                                <table className="w-full text-sm text-left min-w-[600px]">
                                    <thead className="text-[10px] text-slate-400 uppercase font-black bg-slate-50/50 tracking-widest border-b border-slate-100">
                                        <tr>
                                            <th className="px-8 py-5">Serviço / Comanda / Pagamento</th>
                                            <th className="px-8 py-5">Finalizado em</th>
                                            <th className="px-8 py-5 text-right">Valor Item ({calculationBase})</th>
                                            <th className="px-8 py-5 text-right text-orange-600">Comissão ({item.rate}%)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {item.items.map((it: any) => {
                                            const rawVal = Number(it.price || 0) * Number(it.quantity || 1);
                                            const taxRate = getTaxRate(it);
                                            const base = calculationBase === 'liquido'
                                                ? rawVal * (1 - (taxRate / 100))
                                                : rawVal;
                                            const comm = base * (item.rate / 100);
                                            const method = it.commands?.payment_method 
                                                ?? it.commands?.payment_data?.method 
                                                ?? 'misto';
                                                
                                            return (
                                                <tr key={it.id} className="hover:bg-slate-50 transition-colors group">
                                                    <td className="px-8 py-4">
                                                        <p className="font-bold text-slate-700 group-hover:text-orange-600 transition-colors">{it.title}</p>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <p className="text-[9px] text-slate-400 font-black uppercase">CMD #{String(it.commands?.id).substring(0, 8).toUpperCase()}</p>
                                                            <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-black uppercase">{method}</span>
                                                            {calculationBase === 'liquido' && taxRate > 0 && (
                                                                <span className="text-[9px] text-rose-400 font-bold uppercase">(-{taxRate}%)</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-4 text-slate-400 text-xs font-medium">
                                                        {it.commands?.closed_at ? format(new Date(it.commands.closed_at), 'dd/MM HH:mm') : '---'}
                                                    </td>
                                                    <td className="px-8 py-4 text-right text-slate-500 font-mono text-xs">
                                                        {formatBRL(base)}
                                                    </td>
                                                    <td className="px-8 py-4 text-right text-orange-600 font-black font-mono">
                                                        {formatBRL(comm)}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="p-10 text-center bg-white rounded-[24px] border border-dashed border-slate-200 mb-8">
                                <p className="text-slate-400 text-sm font-bold uppercase tracking-tighter">Nenhum serviço liquidado por este profissional.</p>
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row justify-end items-center gap-4">
                            <button className="w-full sm:w-auto text-xs font-black text-slate-400 uppercase tracking-widest hover:text-slate-800 transition-colors flex items-center justify-center gap-2">
                                <Download size={14} /> Exportar Extrato Individual
                            </button>
                            <button 
                                disabled={item.items.length === 0} 
                                className="w-full sm:w-auto px-10 py-4 text-xs font-black text-white bg-slate-800 rounded-2xl flex items-center justify-center gap-3 hover:bg-slate-900 shadow-xl transition-all active:scale-95 disabled:opacity-50"
                                onClick={() => setToast({ message: `Comissões de ${item.member.name} processadas!`, type: 'success' })}
                            >
                                <CheckCircle size={20} /> Aprovar Pagamento
                            </button>
                        </div>
                     </div>
                )}
            </div>
        ))}

        {payroll.length === 0 && (
            <div className="bg-white p-20 rounded-[40px] border-2 border-dashed border-slate-100 text-center">
                <Calculator size={48} className="mx-auto text-slate-100 mb-6" />
                <h4 className="font-black text-slate-800 text-lg">Sem produção no período</h4>
                <p className="text-slate-400 text-sm mt-2 max-w-xs mx-auto leading-relaxed font-medium">
                    Não encontramos serviços liquidados em comandas para o mês selecionado.
                </p>
            </div>
        )}
      </div>
    </div>
  );
};

export default RemuneracoesView;

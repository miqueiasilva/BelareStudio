
import React, { useState, useMemo, useEffect, useRef } from 'react';
// FIX: Reorganizing date-fns imports and removing non-exported member startOfMonth.
import { format, addMonths, endOfMonth } from 'date-fns';
import { ptBR as pt } from 'date-fns/locale/pt-BR';
import { 
    Wallet, ChevronDown, ChevronUp, Download, CheckCircle, 
    Loader2, User, AlertCircle, TrendingUp, Scissors,
    ShieldCheck, DollarSign, Info
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { useStudio } from '../../contexts/StudioContext';
import Card from '../shared/Card';

const RemuneracoesView: React.FC = () => {
  const { activeStudioId } = useStudio();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [expandedId, setExpandedId] = useState<string | number | null>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const isMounted = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchData = async () => {
    if (!isMounted.current || !activeStudioId) return;
    
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
        // FIX: Manual startOfMonth replacement.
        const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1, 0, 0, 0, 0).toISOString();
        const end = endOfMonth(currentDate).toISOString();

        const [teamRes, transRes] = await Promise.all([
            // Selecionando ambos campos de comissão possíveis por segurança
            supabase.from('team_members').select('id, name, photo_url, commission_rate, commission_percent').eq('studio_id', activeStudioId).order('name'),
            supabase.from('financial_transactions').select('*').eq('studio_id', activeStudioId).eq('type', 'income').neq('status', 'cancelado').gte('date', start).lte('date', end).not('professional_id', 'is', null)
        ]);

        if (teamRes.error) throw teamRes.error;
        if (transRes.error) throw transRes.error;

        if (isMounted.current) {
            setTeamMembers(teamRes.data || []);
            setTransactions(transRes.data || []);
        }
    } catch (e: any) {
        if (isMounted.current && e.name !== 'AbortError') {
            console.error("[REMUNERATIONS] Erro:", e);
            setError("Não foi possível carregar os dados financeiros.");
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
  }, [currentDate, activeStudioId]);

  const payroll = useMemo(() => {
    return teamMembers.map(member => {
      const myTrans = transactions.filter(t => String(t.professional_id) === String(member.id));
      const totalBase = myTrans.reduce((acc, t) => {
          const baseValue = (t.net_value !== null && t.net_value !== undefined && Number(t.net_value) > 0) 
            ? Number(t.net_value) 
            : Number(t.amount);
          return acc + (baseValue || 0);
      }, 0);
      // FALLBACK: Tenta commission_rate, depois commission_percent, senão 0
      const rate = Number(member.commission_rate || member.commission_percent || 0);
      const commissionValue = totalBase * (rate / 100);
      return { member, transactions: myTrans, totalBase, commissionValue, count: myTrans.length, rate };
    }).sort((a, b) => b.totalBase - a.totalBase);
  }, [teamMembers, transactions]);

  const totals = useMemo(() => {
    return payroll.reduce((acc, curr) => ({
      base: acc.base + curr.totalBase,
      payout: acc.payout + curr.commissionValue
    }), { base: 0, payout: 0 });
  }, [payroll]);

  const formatBRL = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  if (isLoading) return <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50"><Loader2 className="animate-spin w-12 h-12 mb-4 text-orange-500" /><p className="font-black uppercase tracking-[0.2em] text-[10px] animate-pulse">Processando Comissões...</p></div>;

  return (
    <div className="p-6 h-full overflow-y-auto bg-slate-50/50 font-sans text-left">
      <header className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div><h1 className="text-2xl font-black text-slate-800 flex items-center gap-2"><Wallet className="text-orange-500" /> Remunerações</h1><p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Cálculo de repasse baseado em vendas liquidadas da unidade ativa</p></div>
        <div className="flex items-center bg-white rounded-2xl border border-slate-200 p-1.5 shadow-sm">
          <button onClick={() => setCurrentDate(prev => addMonths(prev, -1))} className="p-2 hover:bg-slate-50 text-slate-400 rounded-xl transition-colors"><ChevronDown className="w-5 h-5 rotate-90" /></button>
          <div className="px-6 font-black text-slate-700 min-w-[200px] text-center capitalize text-sm">{format(currentDate, 'MMMM yyyy', { locale: pt })}</div>
          <button onClick={() => setCurrentDate(prev => addMonths(prev, 1))} className="p-2 hover:bg-slate-50 text-slate-400 rounded-xl transition-colors"><ChevronDown className="w-5 h-5 -rotate-90" /></button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm relative overflow-hidden group">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Base de Cálculo Total (Líquido)</p>
            <div className="flex items-center justify-between relative z-10"><h3 className="text-3xl font-black text-slate-800">{formatBRL(totals.base)}</h3><TrendingUp size={24} className="text-emerald-500" /></div>
            <div className="absolute -right-2 -bottom-2 opacity-5 group-hover:scale-110 transition-transform"><Scissors size={100} /></div>
        </div>
        <div className="bg-slate-900 p-6 rounded-[32px] text-white shadow-xl shadow-slate-200">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total de Comissões (Provisionado)</p>
            <div className="flex items-center justify-between"><h3 className="text-3xl font-black text-orange-400">{formatBRL(totals.payout)}</h3><Wallet size={24} className="text-orange-500" /></div>
        </div>
      </div>

      <div className="space-y-4">
        {payroll.map((item) => (
            <div key={item.member.id} className="bg-white border border-slate-100 rounded-[32px] overflow-hidden shadow-sm transition-all hover:shadow-md">
                <div className="flex items-center justify-between p-6 cursor-pointer hover:bg-slate-50/50" onClick={() => setExpandedId(expandedId === item.member.id ? null : item.member.id)}>
                    <div className="flex items-center gap-5">
                        <div className="w-16 h-16 rounded-[24px] border-4 border-white bg-slate-100 flex items-center justify-center overflow-hidden shadow-sm">{item.member.photo_url ? (<img src={item.member.photo_url} className="w-full h-full object-cover" alt={item.member.name} />) : (<User size={32} className="text-slate-300" />)}</div>
                        <div><h3 className="font-black text-slate-800 text-lg leading-tight">{item.member.name}</h3><div className="flex items-center gap-2 mt-1"><span className="text-[9px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg border border-slate-200 uppercase tracking-widest">Taxa: {item.rate}%</span><span className="text-[9px] font-black bg-orange-50 text-orange-600 px-2 py-0.5 rounded-lg border border-orange-100 uppercase tracking-widest">{item.count} Lançamentos</span></div></div>
                    </div>
                    <div className="flex items-center gap-10">
                        <div className="text-right"><p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-0.5">Base de Cálculo</p><p className="text-sm font-bold text-slate-400">{formatBRL(item.totalBase)}</p></div>
                        <div className="text-right min-w-[140px]"><p className="text-[9px] font-black uppercase tracking-widest mb-0.5 text-orange-500">A Receber</p><p className="text-2xl font-black text-orange-600">{formatBRL(item.commissionValue)}</p></div>
                        <div className={`p-3 rounded-2xl transition-all ${expandedId === item.member.id ? 'bg-orange-500 text-white' : 'bg-slate-50 text-slate-400'}`}>{expandedId === item.member.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}</div>
                    </div>
                </div>
                {expandedId === item.member.id && (
                     <div className="bg-slate-50/50 border-t border-slate-100 p-8 animate-in slide-in-from-top-4 duration-300">
                        <div className="flex items-center justify-between mb-6"><h4 className="text-xs font-black text-slate-600 uppercase tracking-[0.2em]">Detalhamento das Vendas</h4><div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border border-blue-100"><Info size={14} /> Base líquida de taxas administrativas</div></div>
                        {item.transactions.length > 0 ? (
                            <div className="bg-white rounded-[24px] border border-slate-200 overflow-hidden shadow-sm mb-8">
                                <table className="w-full text-sm text-left"><thead className="text-[10px] text-slate-400 uppercase font-black bg-slate-50/50 tracking-widest border-b border-slate-100"><tr><th className="px-8 py-5">Item / Serviço</th><th className="px-8 py-5">Data</th><th className="px-8 py-5 text-right">Valor Final (Líquido)</th><th className="px-8 py-5 text-right text-orange-600">Comissão ({item.rate}%)</th></tr></thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {item.transactions.map((t: any) => {
                                            const base = (t.net_value !== null && t.net_value !== undefined && Number(t.net_value) > 0) ? Number(t.net_value) : Number(t.amount);
                                            return (<tr key={t.id} className="hover:bg-slate-50 transition-colors group"><td className="px-8 py-4"><p className="font-bold text-slate-700 group-hover:text-orange-600 transition-colors">{t.description}</p></td><td className="px-8 py-4 text-slate-400 text-xs">{format(new Date(t.date), 'dd/MM HH:mm')}</td><td className="px-8 py-4 text-right text-slate-400 font-mono text-xs">{formatBRL(base)}</td><td className="px-8 py-4 text-right text-orange-600 font-black font-mono">{formatBRL(base * (item.rate / 100))}</td></tr>);
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (<div className="p-10 text-center bg-white rounded-[24px] border border-dashed border-slate-200 mb-8"><p className="text-slate-400 text-sm font-medium">Sem vendas vinculadas no período.</p></div>)}
                        <div className="flex justify-end items-center gap-4"><button className="text-xs font-black text-slate-400 uppercase tracking-widest hover:text-slate-800 transition-colors flex items-center gap-2"><Download size={14} /> Baixar PDF Individual</button><button disabled={item.transactions.length === 0} className="px-10 py-4 text-xs font-black text-white bg-slate-800 rounded-2xl flex items-center gap-3 hover:bg-slate-900 shadow-xl transition-all active:scale-95 disabled:opacity-50"><CheckCircle size={20} /> Marcar como Pago</button></div>
                     </div>
                )}
            </div>
        ))}
      </div>
    </div>
  );
};

export default RemuneracoesView;

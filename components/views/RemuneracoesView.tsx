
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { format, addMonths, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR as pt } from 'date-fns/locale/pt-BR';
import { 
    Wallet, ChevronDown, ChevronUp, Download, CheckCircle, 
    // FIX: Added 'Info' to the imports from lucide-react to resolve "Cannot find name 'Info'" error on line 237.
    Loader2, User, AlertCircle, TrendingUp, Scissors,
    ShieldCheck, DollarSign, Info
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import Card from '../shared/Card';

const RemuneracoesView: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
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

        // 1. Busca Profissionais reais
        const { data: profData, error: profError } = await supabase
            .from('professionals')
            .select('*, commission_rate, receives_commission')
            .order('name');

        if (profError) throw profError;

        // 2. Busca Transações LIQUIDADAS no período associadas a profissionais
        const { data: transData, error: transError } = await supabase
            .from('financial_transactions')
            .select('*')
            .eq('status', 'paid')
            .eq('type', 'income')
            .gte('date', start)
            .lte('date', end)
            .not('professional_id', 'is', null); // Filtra transações de serviços

        if (transError) throw transError;

        if (isMounted.current) {
            setProfessionals(profData || []);
            setTransactions(transData || []);
        }
    } catch (e: any) {
        if (isMounted.current && e.name !== 'AbortError') {
            setError(e.message || "Erro ao carregar remunerações.");
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

  // --- Lógica de Processamento de Comissões Baseadas em Valor Líquido (Real Entrado) ---
  const payroll = useMemo(() => {
    return professionals.map(prof => {
      const myTrans = transactions.filter(t => Number(t.professional_id) === Number(prof.id));
      
      // Produção Bruta (O que o cliente pagou)
      const grossProduction = myTrans.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
      
      // Produção Líquida (O que o estúdio recebeu após taxas de cartão)
      const netProduction = myTrans.reduce((acc, t) => acc + (Number(t.net_value) || 0), 0);
      
      // Cálculo da Comissão sobre o LÍQUIDO (Justo para o estúdio)
      const canReceive = !!prof.receives_commission;
      const commissionRate = canReceive ? (Number(prof.commission_rate) || 0) : 0;
      const netPayout = canReceive ? (netProduction * (commissionRate / 100)) : 0;

      return {
        professional: prof,
        transactions: myTrans,
        grossProduction,
        netProduction,
        netPayout,
        count: myTrans.length,
        rate: commissionRate,
        canReceive
      };
    }).sort((a, b) => b.grossProduction - a.grossProduction);
  }, [professionals, transactions]);

  const totals = useMemo(() => {
    return payroll.reduce((acc, curr) => ({
      gross: acc.gross + curr.grossProduction,
      net: acc.net + curr.netProduction,
      payout: acc.payout + curr.netPayout
    }), { gross: 0, net: 0, payout: 0 });
  }, [payroll]);

  const formatBRL = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  if (isLoading) {
    return (
        <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50">
            <Loader2 className="animate-spin w-12 h-12 mb-4 text-orange-500" />
            <p className="font-black uppercase tracking-[0.2em] text-[10px] animate-pulse">Calculando Repasses Reais...</p>
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
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Cálculo de repasse sobre recebimento líquido</p>
        </div>
        <div className="flex items-center bg-white rounded-2xl border border-slate-200 p-1.5 shadow-sm">
          <button onClick={() => setCurrentDate(prev => addMonths(prev, -1))} className="p-2 hover:bg-slate-50 text-slate-400 rounded-xl transition-colors"><ChevronDown className="w-5 h-5 rotate-90" /></button>
          <div className="px-6 font-black text-slate-700 min-w-[200px] text-center capitalize text-sm">
              {format(currentDate, 'MMMM yyyy', { locale: pt })}
          </div>
          <button onClick={() => setCurrentDate(prev => addMonths(prev, 1))} className="p-2 hover:bg-slate-50 text-slate-400 rounded-xl transition-colors"><ChevronDown className="w-5 h-5 -rotate-90" /></button>
        </div>
      </header>

      {/* Cards de Resumo Consolidado */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm relative overflow-hidden group">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Faturamento Bruto</p>
            <div className="flex items-center justify-between relative z-10">
                <h3 className="text-2xl font-black text-slate-800">{formatBRL(totals.gross)}</h3>
                <TrendingUp size={20} className="text-emerald-500" />
            </div>
            <div className="absolute -right-2 -bottom-2 opacity-5 group-hover:scale-110 transition-transform">
                <Scissors size={80} />
            </div>
        </div>
        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Recebido Líquido (Pós-Taxas)</p>
            <div className="flex items-center justify-between">
                <h3 className="text-2xl font-black text-blue-600">{formatBRL(totals.net)}</h3>
                <CheckCircle size={20} className="text-blue-500" />
            </div>
        </div>
        <div className="bg-slate-900 p-6 rounded-[32px] text-white shadow-xl shadow-slate-200">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total de Repasses</p>
            <div className="flex items-center justify-between">
                <h3 className="text-2xl font-black text-orange-400">{formatBRL(totals.payout)}</h3>
                <Wallet size={20} className="text-orange-500" />
            </div>
        </div>
      </div>

      {/* Lista de Profissionais e Seus Ganhos */}
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
                                    {item.count} Lançamentos
                                </span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-10">
                        <div className="text-right">
                            <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-0.5">Produção Bruta</p>
                            <p className="text-sm font-bold text-slate-400">{formatBRL(item.grossProduction)}</p>
                        </div>
                        <div className="text-right min-w-[140px]">
                            <p className={`text-[9px] font-black uppercase tracking-widest mb-0.5 ${item.canReceive ? 'text-orange-500' : 'text-slate-400'}`}>
                                {item.canReceive ? 'A Receber' : 'Status'}
                            </p>
                            <p className={`text-2xl font-black ${item.canReceive ? 'text-orange-600' : 'text-slate-300 italic'}`}>
                                {item.canReceive ? formatBRL(item.netPayout) : "Gestão"}
                            </p>
                        </div>
                        <div className={`p-3 rounded-2xl transition-all ${expandedId === item.professional.id ? 'bg-orange-500 text-white' : 'bg-slate-50 text-slate-400'}`}>
                            {expandedId === item.professional.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </div>
                    </div>
                </div>

                {expandedId === item.professional.id && (
                     <div className="bg-slate-50/50 border-t border-slate-100 p-8 animate-in slide-in-from-top-4 duration-300">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-2">
                                <Scissors size={18} className="text-slate-400" />
                                <h4 className="text-xs font-black text-slate-600 uppercase tracking-[0.2em]">Detalhamento de Transações</h4>
                            </div>
                            <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border border-blue-100">
                                <Info size={14} /> Base de Cálculo: Valor Líquido (Após taxas de adquirente)
                            </div>
                        </div>

                        {item.transactions.length > 0 ? (
                            <div className="bg-white rounded-[24px] border border-slate-200 overflow-hidden shadow-sm mb-8">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-[10px] text-slate-400 uppercase font-black bg-slate-50/50 tracking-widest border-b border-slate-100">
                                        <tr>
                                            <th className="px-8 py-5">Serviço e Data</th>
                                            <th className="px-8 py-5 text-right">Valor Bruto</th>
                                            <th className="px-8 py-5 text-right">Valor Líquido</th>
                                            {item.canReceive && <th className="px-8 py-5 text-right text-orange-600">Sua Parte ({item.rate}%)</th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {item.transactions.map((t: any) => (
                                            <tr key={t.id} className="hover:bg-slate-50 transition-colors group">
                                                <td className="px-8 py-4">
                                                    <p className="font-bold text-slate-700 group-hover:text-orange-600">{t.description.replace('Recebimento: ', '')}</p>
                                                    <p className="text-[10px] text-slate-400 font-medium uppercase">{format(new Date(t.date), 'dd/MM HH:mm')}</p>
                                                </td>
                                                <td className="px-8 py-4 text-right text-slate-400 font-mono text-xs">
                                                    {formatBRL(Number(t.amount))}
                                                </td>
                                                <td className="px-8 py-4 text-right text-slate-800 font-black font-mono">
                                                    {formatBRL(Number(t.net_value))}
                                                </td>
                                                {item.canReceive && (
                                                    <td className="px-8 py-4 text-right text-orange-600 font-black font-mono bg-orange-50/20">
                                                        + {formatBRL(Number(t.net_value) * (item.rate / 100))}
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="p-10 text-center bg-white rounded-[24px] border border-dashed border-slate-200 mb-8">
                                <p className="text-slate-400 text-sm font-medium">Sem transações financeiras liquidadas no período.</p>
                            </div>
                        )}

                        <div className="flex justify-end items-center gap-4">
                            <button className="text-xs font-black text-slate-400 uppercase tracking-widest hover:text-slate-800 transition-colors flex items-center gap-2">
                                <Download size={14} /> Gerar PDF do Profissional
                            </button>
                            <button 
                                disabled={item.transactions.length === 0 || !item.canReceive}
                                className="px-10 py-4 text-xs font-black text-white bg-slate-800 rounded-2xl flex items-center gap-3 hover:bg-slate-900 shadow-xl transition-all active:scale-95 disabled:opacity-50"
                            >
                                <CheckCircle size={20} /> Fechar Mês / Liquidar
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
            <p className="font-black uppercase tracking-[0.2em] text-xs">Sem dados para calcular no período</p>
        </div>
      )}
    </div>
  );
};

export default RemuneracoesView;

import React from 'react';
import { 
  ArrowLeft, 
  CreditCard, 
  CheckCircle2, 
  Zap, 
  Clock, 
  ShieldCheck, 
  ArrowUpRight,
  TrendingUp,
  Package
} from 'lucide-react';

interface BillingSettingsProps {
  onBack: () => void;
}

const BillingSettings: React.FC<BillingSettingsProps> = ({ onBack }) => {
  const currentPlan = {
    name: "Plano Prata",
    status: "Ativo",
    price: "R$ 89,90",
    renewalDate: "12 de Junho, 2026",
    features: [
      "Agendamentos Ilimitados",
      "Sincronização WhatsApp",
      "Gestão de Comissões",
      "Até 3 Profissionais"
    ]
  };

  const usageStats = [
    { label: "Agendamentos", used: 145, limit: "∞", percent: 0 },
    { label: "SMS/WhatsApp", used: 890, limit: 1000, percent: 89 },
    { label: "Armazenamento", used: "1.2GB", limit: "5GB", percent: 24 }
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors font-bold text-sm group"
      >
        <div className="w-8 h-8 rounded-full bg-white shadow-sm border border-slate-100 flex items-center justify-center group-hover:-translate-x-1 transition-transform">
          <ArrowLeft size={16} />
        </div>
        Voltar para Ajustes
      </button>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Current Plan Summary */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-8 space-y-8">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-black text-slate-800">Seu Plano Atual</h2>
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase rounded-full tracking-widest border border-emerald-100">
                    {currentPlan.status}
                  </span>
                </div>
                <p className="text-slate-400 font-medium tracking-tight">O que está incluso na sua assinatura</p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-black text-slate-800 tracking-tighter">{currentPlan.price}</div>
                <p className="text-[10px] font-black text-slate-400 uppercase">por mês</p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {currentPlan.features.map((feature, i) => (
                <div key={i} className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <CheckCircle2 size={18} className="text-emerald-500 flex-shrink-0" />
                  <span className="text-sm font-bold text-slate-600">{feature}</span>
                </div>
              ))}
            </div>

            <div className="pt-6 border-t border-slate-50 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-2 text-slate-400">
                <Clock size={16} />
                <span className="text-xs font-bold">Próxima renovação: {currentPlan.renewalDate}</span>
              </div>
              <button className="bg-slate-900 text-white px-6 py-3 rounded-xl font-black text-sm shadow-xl hover:shadow-slate-200 transition-all active:scale-95 flex items-center gap-2">
                Fazer Upgrade <Zap size={16} fill="currentColor" />
              </button>
            </div>
          </div>

          <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-8 space-y-6">
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
              <TrendingUp size={20} className="text-orange-500" />
              Monitoramento de Uso
            </h3>
            <div className="space-y-6">
              {usageStats.map((stat, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between items-end">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{stat.label}</span>
                    <span className="text-xs font-bold text-slate-800">{stat.used} / {stat.limit}</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ${stat.percent > 90 ? 'bg-rose-500' : stat.percent > 70 ? 'bg-amber-500' : 'bg-orange-500'}`}
                      style={{ width: `${stat.percent === 0 ? 100 : stat.percent}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Payment Methods & Billing History */}
        <div className="space-y-6">
          <div className="bg-slate-900 rounded-[32px] p-8 text-white space-y-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl"></div>
            <div className="flex justify-between items-center">
              <CreditCard size={24} className="text-orange-500" />
              <button className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors">Editar</button>
            </div>
            <div className="space-y-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cartão Final</p>
              <div className="text-xl font-bold tracking-widest">•••• •••• •••• 4242</div>
            </div>
            <div className="flex justify-between items-end">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Expira em</p>
                <p className="text-sm font-bold">12/28</p>
              </div>
              <ShieldCheck size={20} className="text-emerald-500" />
            </div>
          </div>

          <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-6 space-y-6">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest border-b border-slate-50 pb-4">Histórico</h3>
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center justify-between group cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-orange-50 group-hover:text-orange-500 transition-colors">
                      <Package size={18} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-700">Fatura Maio/2026</p>
                      <p className="text-[10px] text-slate-400 font-medium">Pago em 12/05</p>
                    </div>
                  </div>
                  <ArrowUpRight size={16} className="text-slate-200 group-hover:text-slate-400 transition-colors" />
                </div>
              ))}
            </div>
            <button className="w-full py-3 text-xs font-black text-slate-400 uppercase tracking-widest hover:text-slate-800 transition-colors">Ver todas faturas</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillingSettings;

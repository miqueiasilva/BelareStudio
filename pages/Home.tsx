import React, { useEffect, useState } from "react";
import { CalendarDays, Plus, Wallet, Users, Clock, TriangleAlert } from "lucide-react";

const fmtBRL = (v:number) => v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});

function KPI({icon:Icon,label,value,bg}:{icon:any;label:string;value:string|number;bg?:string}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border bg-white p-4 shadow-sm">
      <div className={`rounded-xl p-2 ${bg ?? "bg-slate-100"}`}>
        <Icon className="h-5 w-5 text-slate-700" />
      </div>
      <div>
        <div className="text-xs text-slate-500">{label}</div>
        <div className="text-lg font-semibold text-slate-800">{value}</div>
      </div>
    </div>
  );
}

export default function Home() {
  // mocks seguros (substitua depois pelos dados reais)
  const [revenue] = useState(1980);
  const [appts] = useState(18);
  const [occ] = useState(82);
  const [noshow] = useState(5.6);
  const [ticket] = useState(198);

  return (
    <div className="mx-auto max-w-[1200px] p-4">
      {/* topo */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-700">
          <CalendarDays className="h-5 w-5" />
          <span className="text-sm">
            Hoje – {new Date().toLocaleDateString("pt-BR",{weekday:"short",day:"2-digit",month:"short"})}
          </span>
        </div>
        <button className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-3 py-2 text-sm font-semibold text-white shadow hover:bg-orange-600">
          <Plus className="h-4 w-4" /> Agendar
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <KPI icon={Wallet} label="Receita do Dia" value={fmtBRL(revenue)} bg="bg-blue-100"/>
        <KPI icon={Users} label="Atendimentos do Dia" value={appts} bg="bg-indigo-100"/>
        <KPI icon={Clock} label="Ocupação" value={`${occ}%`} bg={occ>80?"bg-emerald-100":occ>=60?"bg-amber-100":"bg-rose-100"} />
        <KPI icon={TriangleAlert} label="No-show" value={`${noshow}%`} bg={noshow<8?"bg-emerald-100":noshow<=15?"bg-amber-100":"bg-rose-100"} />
        <KPI icon={Wallet} label="Ticket Médio" value={fmtBRL(ticket)} bg="bg-teal-100"/>
      </div>

      <div className="mt-6 rounded-2xl border bg-white p-4 shadow-sm text-sm text-slate-600">
        Página inicial carregada com layout mínimo (sem gráficos).<br/>
        Se aparecer, o seu problema era <i>gráfico/dado indefinido/import</i>. No próximo passo ativamos Recharts e Supabase com segurança.
      </div>
    </div>
  );
}

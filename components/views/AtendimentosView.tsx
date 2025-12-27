import React, { useEffect, useMemo, useState, useRef } from "react";
import { format, startOfDay, addMinutes, setHours, setMinutes, isSameDay, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, 
  Clock, User, Check, X, Plus, MoreHorizontal, Loader2
} from 'lucide-react';
import { supabase } from "../../services/supabaseClient";

// --- Tipos ---
type Professional = { id: string; name: string; avatar_url?: string | null; active?: boolean | null; color?: string };
type Service = { id: string; name: string; duration_min: number; price: number };
type Appointment = {
  id: string;
  client_name: string;
  professional_id: string;
  service_id: string | null;
  starts_at: string;
  ends_at: string;
  status: "scheduled" | "done" | "canceled";
  notes?: string | null;
};

// --- Configurações Visuais ---
const START_HOUR = 8;
const END_HOUR = 20;
const PIXELS_PER_MINUTE = 2; // Zoom vertical (120px por hora)
const COL_WIDTH = 240; // Largura da coluna do profissional

// Cores para profissionais (simulação de identidade visual)
const PROF_COLORS = [
  'border-l-blue-500 bg-blue-50 text-blue-700',
  'border-l-purple-500 bg-purple-50 text-purple-700',
  'border-l-pink-500 bg-pink-50 text-pink-700',
  'border-l-teal-500 bg-teal-50 text-teal-700',
];

export default function AtendimentosView() {
  // --- Estados ---
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);

  // Memos de Data
  const dayStart = useMemo(() => startOfDay(currentDate), [currentDate]);
  const dayEnd = useMemo(() => addMinutes(dayStart, 24 * 60 - 1), [dayStart]);

  // Labels de Hora (Linhas do Grid)
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let h = START_HOUR; h <= END_HOUR; h++) {
      slots.push(setMinutes(setHours(dayStart, h), 0));
    }
    return slots;
  }, [dayStart]);

  // --- Carregamento de Dados ---
  async function loadBase() {
    setLoading(true);
    try {
      const [proRes, svcRes, apRes] = await Promise.all([
        supabase.from("professionals").select("*").eq("active", true).order("name"),
        supabase.from("services").select("*").order("name"),
        supabase
          .from("appointments")
          .select("*")
          .gte("starts_at", dayStart.toISOString())
          .lte("starts_at", dayEnd.toISOString())
          .neq("status", "canceled") // Opcional: não trazer cancelados ou tratar visualmente
          .order("starts_at"),
      ]);

      if (proRes.error) throw proRes.error;
      setProfessionals(proRes.data || []);
      setServices(svcRes.data || []);
      setAppointments(apRes.data || []);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBase();
  }, [dayStart]);

  // --- Realtime ---
  useEffect(() => {
    const channel = supabase
      .channel("appointments-day-update")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => loadBase())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [dayStart]);

  // --- Otimização: Agrupamento (Big O Reduction) ---
  const appointmentsByProf = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    professionals.forEach(p => map[p.id] = []);
    appointments.forEach(ap => {
      if (map[ap.professional_id]) map[ap.professional_id].push(ap);
    });
    return map;
  }, [appointments, professionals]);

  const servicesById = useMemo(() => {
    return new Map(services.map(s => [s.id, s]));
  }, [services]);

  // --- Helpers Visuais ---
  const getPositionStyles = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    const startMinutes = (s.getHours() - START_HOUR) * 60 + s.getMinutes();
    const durationMinutes = (e.getTime() - s.getTime()) / 60000;
    
    return {
      top: `${Math.max(0, startMinutes * PIXELS_PER_MINUTE)}px`,
      height: `${Math.max(20, durationMinutes * PIXELS_PER_MINUTE)}px`,
    };
  };

  // --- Handlers ---
  function handleGridDoubleClick(e: React.MouseEvent, profId: string) {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top + e.currentTarget.scrollTop; // Ajuste para scroll se necessário
    
    // Matemática reversa: Pixels -> Minutos
    const minutesClicked = y / PIXELS_PER_MINUTE;
    const hour = Math.floor(minutesClicked / 60) + START_HOUR;
    const min = Math.round((minutesClicked % 60) / 15) * 15; // Snap de 15 min

    const start = setMinutes(setHours(new Date(dayStart), hour), min);
    
    openNewAt(start, profId);
  }

  function openNewAt(start = new Date(), profId = professionals[0]?.id) {
    // Default: Próximo intervalo de 30min se não passado
    const s = start < new Date() && isSameDay(start, new Date()) ? new Date() : start;
    
    setEditing({
      id: "",
      client_name: "",
      professional_id: profId || "",
      service_id: services[0]?.id || null,
      starts_at: s.toISOString(),
      ends_at: addMinutes(s, 60).toISOString(), // 1h default
      status: "scheduled",
      notes: ""
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!editing) return;
    if (!editing.client_name || !editing.professional_id) return alert("Preencha os campos obrigatórios");

    const payload = {
      client_name: editing.client_name,
      professional_id: editing.professional_id,
      service_id: editing.service_id,
      starts_at: editing.starts_at,
      ends_at: editing.ends_at,
      status: editing.status,
      notes: editing.notes
    };

    const { error } = editing.id 
      ? await supabase.from("appointments").update(payload).eq("id", editing.id)
      : await supabase.from("appointments").insert(payload);

    if (error) alert("Erro ao salvar: " + error.message);
    else {
      setModalOpen(false);
      setEditing(null);
      loadBase();
    }
  }

  // --- RENDER ---
  return (
    <div className="flex flex-col h-screen bg-white text-slate-800 font-sans">
      
      {/* 1. Header Toolbar */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Agenda</h1>
          <div className="h-6 w-px bg-gray-300 mx-2"></div>
          <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-lg border border-slate-200">
            <button onClick={() => setCurrentDate(d => addDays(d, -1))} className="p-1 hover:bg-white hover:shadow-sm rounded-md transition"><ChevronLeft size={18}/></button>
            <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1 text-sm font-semibold text-slate-700 hover:bg-white hover:shadow-sm rounded-md transition">Hoje</button>
            <button onClick={() => setCurrentDate(d => addDays(d, 1))} className="p-1 hover:bg-white hover:shadow-sm rounded-md transition"><ChevronRight size={18}/></button>
          </div>
          <span className="text-lg font-medium text-slate-600 capitalize ml-2">
            {format(currentDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </span>
        </div>

        <button 
          onClick={() => openNewAt()}
          className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl font-semibold transition shadow-sm"
        >
          <Plus size={18} /> Novo Agendamento
        </button>
      </header>

      {/* 2. Main Grid Layout */}
      <div className="flex-1 overflow-hidden relative flex">
        
        {loading && (
          <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-sm flex items-center justify-center">
            <Loader2 className="animate-spin text-slate-900" size={32} />
          </div>
        )}

        {/* Scroll Container */}
        <div className="flex-1 overflow-auto relative flex">
          
          {/* Coluna Horários (Sticky Left) */}
          <div className="sticky left-0 z-30 bg-white border-r border-gray-100 w-16 flex-shrink-0 pt-[70px]">
            {timeSlots.map((time, i) => (
              <div 
                key={i} 
                className="relative border-b border-gray-100 text-xs font-medium text-gray-400 text-center"
                style={{ height: `${60 * PIXELS_PER_MINUTE}px` }} // Altura fixa de 1h
              >
                <span className="-top-2.5 relative bg-white px-1">{format(time, 'HH:mm')}</span>
              </div>
            ))}
          </div>

          {/* Colunas Profissionais */}
          <div className="flex min-w-max">
            {professionals.map((prof, idx) => (
              <div 
                key={prof.id} 
                className="border-r border-gray-100 flex flex-col relative group"
                style={{ width: COL_WIDTH }}
              >
                {/* Header Profissional (Sticky Top) */}
                <div className="sticky top-0 z-20 bg-white/95 backdrop-blur h-[70px] border-b border-gray-200 flex items-center gap-3 px-4 shadow-sm">
                  <div className="relative">
                    <img 
                      src={prof.avatar_url || `https://ui-avatars.com/api/?name=${prof.name}&background=random`} 
                      alt={prof.name} 
                      className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm" 
                    />
                    <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full"></div>
                  </div>
                  <span className="font-semibold text-slate-700 truncate">{prof.name}</span>
                </div>

                {/* Canvas de Agendamento */}
                <div 
                  className="relative flex-1 bg-[linear-gradient(to_bottom,transparent_49%,rgba(0,0,0,0.03)_50%,transparent_51%)] bg-[size:100%_60px]"
                  style={{ height: `${(END_HOUR - START_HOUR + 1) * 60 * PIXELS_PER_MINUTE}px` }}
                  onDoubleClick={(e) => handleGridDoubleClick(e, prof.id)}
                >
                   {/* Linhas de Hora Sutis */}
                   {timeSlots.map((_, i) => (
                    <div key={i} className="border-b border-dashed border-gray-100 absolute w-full" style={{ top: i * 60 * PIXELS_PER_MINUTE }}></div>
                   ))}

                   {/* Cards de Agendamento */}
                   {appointmentsByProf[prof.id]?.map(appt => {
                     const style = getPositionStyles(appt.starts_at, appt.ends_at);
                     const colorClass = PROF_COLORS[idx % PROF_COLORS.length]; // Cicla cores
                     
                     return (
                       <div
                         key={appt.id}
                         onClick={(e) => { e.stopPropagation(); setEditing(appt); setModalOpen(true); }}
                         className={`absolute left-1 right-1 rounded-md border-l-4 p-2 cursor-pointer shadow-sm hover:shadow-md transition-all group/card overflow-hidden ${colorClass}`}
                         style={style}
                       >
                         <div className="flex justify-between items-start">
                           <span className="font-bold text-xs truncate pr-4">{appt.client_name}</span>
                           {appt.status === 'done' && <Check size={12} className="text-emerald-600"/>}
                         </div>
                         <div className="text-[10px] opacity-80 truncate font-medium mt-0.5">
                           {servicesById.get(appt.service_id || "")?.name || "Serviço diverso"}
                         </div>
                         <div className="flex items-center gap-1 text-[10px] mt-1 opacity-70">
                           <Clock size={10} />
                           {format(new Date(appt.starts_at), 'HH:mm')} - {format(new Date(appt.ends_at), 'HH:mm')}
                         </div>
                       </div>
                     )
                   })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Modal de Agendamento */}
      {modalOpen && editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" onClick={() => setModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-lg text-slate-800">{editing.id ? 'Editar Agendamento' : 'Novo Agendamento'}</h3>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
            </div>

            <div className="p-6 space-y-4">
              {/* Cliente */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cliente</label>
                <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-slate-900 focus-within:border-transparent transition">
                  <User size={16} className="text-gray-400"/>
                  <input 
                    className="flex-1 outline-none text-sm text-slate-700 placeholder:text-gray-300"
                    placeholder="Nome do cliente"
                    value={editing.client_name}
                    onChange={e => setEditing({...editing, client_name: e.target.value})}
                    autoFocus
                  />
                </div>
              </div>

              {/* Grid: Profissional & Serviço */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Profissional</label>
                  <select 
                    className="w-full text-sm border border-gray-200 rounded-lg p-2.5 bg-white outline-none focus:ring-2 focus:ring-slate-900"
                    value={editing.professional_id}
                    onChange={e => setEditing({...editing, professional_id: e.target.value})}
                  >
                    {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Serviço</label>
                  <select 
                    className="w-full text-sm border border-gray-200 rounded-lg p-2.5 bg-white outline-none focus:ring-2 focus:ring-slate-900"
                    value={editing.service_id || ""}
                    onChange={e => {
                       const sId = e.target.value;
                       const svc = servicesById.get(sId);
                       const end = svc ? addMinutes(new Date(editing.starts_at), svc.duration_min) : new Date(editing.ends_at);
                       setEditing({...editing, service_id: sId, ends_at: end.toISOString()});
                    }}
                  >
                    <option value="">Selecione...</option>
                    {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Grid: Horários */}
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Início</label>
                    <input 
                      type="datetime-local" 
                      className="w-full text-sm border border-gray-200 rounded-lg p-2 outline-none focus:ring-2 focus:ring-slate-900"
                      value={toLocalInput(editing.starts_at)}
                      onChange={e => {
                        const start = new Date(e.target.value);
                        const oldDur = new Date(editing.ends_at).getTime() - new Date(editing.starts_at).getTime();
                        setEditing({...editing, starts_at: start.toISOString(), ends_at: new Date(start.getTime() + oldDur).toISOString() })
                      }}
                    />
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Fim</label>
                    <input 
                      type="datetime-local" 
                      className="w-full text-sm border border-gray-200 rounded-lg p-2 outline-none focus:ring-2 focus:ring-slate-900"
                      value={toLocalInput(editing.ends_at)}
                      onChange={e => setEditing({...editing, ends_at: new Date(e.target.value).toISOString()})}
                    />
                 </div>
              </div>

              {/* Notas */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Notas Internas</label>
                <textarea 
                  className="w-full text-sm border border-gray-200 rounded-lg p-3 outline-none focus:ring-2 focus:ring-slate-900 resize-none h-20"
                  placeholder="Alergias, preferências..."
                  value={editing.notes || ""}
                  onChange={e => setEditing({...editing, notes: e.target.value})}
                />
              </div>
            </div>

            {/* Footer Modal */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
              {editing.id && (
                <button 
                  onClick={async () => {
                     if(!confirm('Excluir?')) return;
                     await supabase.from("appointments").delete().eq('id', editing.id);
                     setModalOpen(false); loadBase();
                  }} 
                  className="text-red-600 text-sm font-semibold hover:bg-red-50 px-3 py-2 rounded-lg transition"
                >
                  Excluir
                </button>
              )}
              <div className="flex gap-3 ml-auto">
                 <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-200 rounded-lg transition">Cancelar</button>
                 <button onClick={handleSave} className="px-6 py-2 text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-lg hover:shadow-xl transition transform active:scale-95">Salvar Agendamento</button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

// Helper de Data Input
function toLocalInput(iso: string) {
  if(!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}import React, { useEffect, useMemo, useState, useRef } from "react";
import { format, startOfDay, addMinutes, setHours, setMinutes, isSameDay, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, 
  Clock, User, Check, X, Plus, MoreHorizontal, Loader2
} from 'lucide-react';
import { supabase } from "../../services/supabaseClient";

// --- Tipos ---
type Professional = { id: string; name: string; avatar_url?: string | null; active?: boolean | null; color?: string };
type Service = { id: string; name: string; duration_min: number; price: number };
type Appointment = {
  id: string;
  client_name: string;
  professional_id: string;
  service_id: string | null;
  starts_at: string;
  ends_at: string;
  status: "scheduled" | "done" | "canceled";
  notes?: string | null;
};

// --- Configurações Visuais ---
const START_HOUR = 8;
const END_HOUR = 20;
const PIXELS_PER_MINUTE = 2; // Zoom vertical (120px por hora)
const COL_WIDTH = 240; // Largura da coluna do profissional

// Cores para profissionais (simulação de identidade visual)
const PROF_COLORS = [
  'border-l-blue-500 bg-blue-50 text-blue-700',
  'border-l-purple-500 bg-purple-50 text-purple-700',
  'border-l-pink-500 bg-pink-50 text-pink-700',
  'border-l-teal-500 bg-teal-50 text-teal-700',
];

export default function AtendimentosView() {
  // --- Estados ---
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);

  // Memos de Data
  const dayStart = useMemo(() => startOfDay(currentDate), [currentDate]);
  const dayEnd = useMemo(() => addMinutes(dayStart, 24 * 60 - 1), [dayStart]);

  // Labels de Hora (Linhas do Grid)
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let h = START_HOUR; h <= END_HOUR; h++) {
      slots.push(setMinutes(setHours(dayStart, h), 0));
    }
    return slots;
  }, [dayStart]);

  // --- Carregamento de Dados ---
  async function loadBase() {
    setLoading(true);
    try {
      const [proRes, svcRes, apRes] = await Promise.all([
        supabase.from("professionals").select("*").eq("active", true).order("name"),
        supabase.from("services").select("*").order("name"),
        supabase
          .from("appointments")
          .select("*")
          .gte("starts_at", dayStart.toISOString())
          .lte("starts_at", dayEnd.toISOString())
          .neq("status", "canceled") // Opcional: não trazer cancelados ou tratar visualmente
          .order("starts_at"),
      ]);

      if (proRes.error) throw proRes.error;
      setProfessionals(proRes.data || []);
      setServices(svcRes.data || []);
      setAppointments(apRes.data || []);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBase();
  }, [dayStart]);

  // --- Realtime ---
  useEffect(() => {
    const channel = supabase
      .channel("appointments-day-update")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => loadBase())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [dayStart]);

  // --- Otimização: Agrupamento (Big O Reduction) ---
  const appointmentsByProf = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    professionals.forEach(p => map[p.id] = []);
    appointments.forEach(ap => {
      if (map[ap.professional_id]) map[ap.professional_id].push(ap);
    });
    return map;
  }, [appointments, professionals]);

  const servicesById = useMemo(() => {
    return new Map(services.map(s => [s.id, s]));
  }, [services]);

  // --- Helpers Visuais ---
  const getPositionStyles = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    const startMinutes = (s.getHours() - START_HOUR) * 60 + s.getMinutes();
    const durationMinutes = (e.getTime() - s.getTime()) / 60000;
    
    return {
      top: `${Math.max(0, startMinutes * PIXELS_PER_MINUTE)}px`,
      height: `${Math.max(20, durationMinutes * PIXELS_PER_MINUTE)}px`,
    };
  };

  // --- Handlers ---
  function handleGridDoubleClick(e: React.MouseEvent, profId: string) {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top + e.currentTarget.scrollTop; // Ajuste para scroll se necessário
    
    // Matemática reversa: Pixels -> Minutos
    const minutesClicked = y / PIXELS_PER_MINUTE;
    const hour = Math.floor(minutesClicked / 60) + START_HOUR;
    const min = Math.round((minutesClicked % 60) / 15) * 15; // Snap de 15 min

    const start = setMinutes(setHours(new Date(dayStart), hour), min);
    
    openNewAt(start, profId);
  }

  function openNewAt(start = new Date(), profId = professionals[0]?.id) {
    // Default: Próximo intervalo de 30min se não passado
    const s = start < new Date() && isSameDay(start, new Date()) ? new Date() : start;
    
    setEditing({
      id: "",
      client_name: "",
      professional_id: profId || "",
      service_id: services[0]?.id || null,
      starts_at: s.toISOString(),
      ends_at: addMinutes(s, 60).toISOString(), // 1h default
      status: "scheduled",
      notes: ""
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!editing) return;
    if (!editing.client_name || !editing.professional_id) return alert("Preencha os campos obrigatórios");

    const payload = {
      client_name: editing.client_name,
      professional_id: editing.professional_id,
      service_id: editing.service_id,
      starts_at: editing.starts_at,
      ends_at: editing.ends_at,
      status: editing.status,
      notes: editing.notes
    };

    const { error } = editing.id 
      ? await supabase.from("appointments").update(payload).eq("id", editing.id)
      : await supabase.from("appointments").insert(payload);

    if (error) alert("Erro ao salvar: " + error.message);
    else {
      setModalOpen(false);
      setEditing(null);
      loadBase();
    }
  }

  // --- RENDER ---
  return (
    <div className="flex flex-col h-screen bg-white text-slate-800 font-sans">
      
      {/* 1. Header Toolbar */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Agenda</h1>
          <div className="h-6 w-px bg-gray-300 mx-2"></div>
          <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-lg border border-slate-200">
            <button onClick={() => setCurrentDate(d => addDays(d, -1))} className="p-1 hover:bg-white hover:shadow-sm rounded-md transition"><ChevronLeft size={18}/></button>
            <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1 text-sm font-semibold text-slate-700 hover:bg-white hover:shadow-sm rounded-md transition">Hoje</button>
            <button onClick={() => setCurrentDate(d => addDays(d, 1))} className="p-1 hover:bg-white hover:shadow-sm rounded-md transition"><ChevronRight size={18}/></button>
          </div>
          <span className="text-lg font-medium text-slate-600 capitalize ml-2">
            {format(currentDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </span>
        </div>

        <button 
          onClick={() => openNewAt()}
          className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl font-semibold transition shadow-sm"
        >
          <Plus size={18} /> Novo Agendamento
        </button>
      </header>

      {/* 2. Main Grid Layout */}
      <div className="flex-1 overflow-hidden relative flex">
        
        {loading && (
          <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-sm flex items-center justify-center">
            <Loader2 className="animate-spin text-slate-900" size={32} />
          </div>
        )}

        {/* Scroll Container */}
        <div className="flex-1 overflow-auto relative flex">
          
          {/* Coluna Horários (Sticky Left) */}
          <div className="sticky left-0 z-30 bg-white border-r border-gray-100 w-16 flex-shrink-0 pt-[70px]">
            {timeSlots.map((time, i) => (
              <div 
                key={i} 
                className="relative border-b border-gray-100 text-xs font-medium text-gray-400 text-center"
                style={{ height: `${60 * PIXELS_PER_MINUTE}px` }} // Altura fixa de 1h
              >
                <span className="-top-2.5 relative bg-white px-1">{format(time, 'HH:mm')}</span>
              </div>
            ))}
          </div>

          {/* Colunas Profissionais */}
          <div className="flex min-w-max">
            {professionals.map((prof, idx) => (
              <div 
                key={prof.id} 
                className="border-r border-gray-100 flex flex-col relative group"
                style={{ width: COL_WIDTH }}
              >
                {/* Header Profissional (Sticky Top) */}
                <div className="sticky top-0 z-20 bg-white/95 backdrop-blur h-[70px] border-b border-gray-200 flex items-center gap-3 px-4 shadow-sm">
                  <div className="relative">
                    <img 
                      src={prof.avatar_url || `https://ui-avatars.com/api/?name=${prof.name}&background=random`} 
                      alt={prof.name} 
                      className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm" 
                    />
                    <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full"></div>
                  </div>
                  <span className="font-semibold text-slate-700 truncate">{prof.name}</span>
                </div>

                {/* Canvas de Agendamento */}
                <div 
                  className="relative flex-1 bg-[linear-gradient(to_bottom,transparent_49%,rgba(0,0,0,0.03)_50%,transparent_51%)] bg-[size:100%_60px]"
                  style={{ height: `${(END_HOUR - START_HOUR + 1) * 60 * PIXELS_PER_MINUTE}px` }}
                  onDoubleClick={(e) => handleGridDoubleClick(e, prof.id)}
                >
                   {/* Linhas de Hora Sutis */}
                   {timeSlots.map((_, i) => (
                    <div key={i} className="border-b border-dashed border-gray-100 absolute w-full" style={{ top: i * 60 * PIXELS_PER_MINUTE }}></div>
                   ))}

                   {/* Cards de Agendamento */}
                   {appointmentsByProf[prof.id]?.map(appt => {
                     const style = getPositionStyles(appt.starts_at, appt.ends_at);
                     const colorClass = PROF_COLORS[idx % PROF_COLORS.length]; // Cicla cores
                     
                     return (
                       <div
                         key={appt.id}
                         onClick={(e) => { e.stopPropagation(); setEditing(appt); setModalOpen(true); }}
                         className={`absolute left-1 right-1 rounded-md border-l-4 p-2 cursor-pointer shadow-sm hover:shadow-md transition-all group/card overflow-hidden ${colorClass}`}
                         style={style}
                       >
                         <div className="flex justify-between items-start">
                           <span className="font-bold text-xs truncate pr-4">{appt.client_name}</span>
                           {appt.status === 'done' && <Check size={12} className="text-emerald-600"/>}
                         </div>
                         <div className="text-[10px] opacity-80 truncate font-medium mt-0.5">
                           {servicesById.get(appt.service_id || "")?.name || "Serviço diverso"}
                         </div>
                         <div className="flex items-center gap-1 text-[10px] mt-1 opacity-70">
                           <Clock size={10} />
                           {format(new Date(appt.starts_at), 'HH:mm')} - {format(new Date(appt.ends_at), 'HH:mm')}
                         </div>
                       </div>
                     )
                   })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Modal de Agendamento */}
      {modalOpen && editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" onClick={() => setModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-lg text-slate-800">{editing.id ? 'Editar Agendamento' : 'Novo Agendamento'}</h3>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
            </div>

            <div className="p-6 space-y-4">
              {/* Cliente */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cliente</label>
                <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-slate-900 focus-within:border-transparent transition">
                  <User size={16} className="text-gray-400"/>
                  <input 
                    className="flex-1 outline-none text-sm text-slate-700 placeholder:text-gray-300"
                    placeholder="Nome do cliente"
                    value={editing.client_name}
                    onChange={e => setEditing({...editing, client_name: e.target.value})}
                    autoFocus
                  />
                </div>
              </div>

              {/* Grid: Profissional & Serviço */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Profissional</label>
                  <select 
                    className="w-full text-sm border border-gray-200 rounded-lg p-2.5 bg-white outline-none focus:ring-2 focus:ring-slate-900"
                    value={editing.professional_id}
                    onChange={e => setEditing({...editing, professional_id: e.target.value})}
                  >
                    {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Serviço</label>
                  <select 
                    className="w-full text-sm border border-gray-200 rounded-lg p-2.5 bg-white outline-none focus:ring-2 focus:ring-slate-900"
                    value={editing.service_id || ""}
                    onChange={e => {
                       const sId = e.target.value;
                       const svc = servicesById.get(sId);
                       const end = svc ? addMinutes(new Date(editing.starts_at), svc.duration_min) : new Date(editing.ends_at);
                       setEditing({...editing, service_id: sId, ends_at: end.toISOString()});
                    }}
                  >
                    <option value="">Selecione...</option>
                    {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Grid: Horários */}
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Início</label>
                    <input 
                      type="datetime-local" 
                      className="w-full text-sm border border-gray-200 rounded-lg p-2 outline-none focus:ring-2 focus:ring-slate-900"
                      value={toLocalInput(editing.starts_at)}
                      onChange={e => {
                        const start = new Date(e.target.value);
                        const oldDur = new Date(editing.ends_at).getTime() - new Date(editing.starts_at).getTime();
                        setEditing({...editing, starts_at: start.toISOString(), ends_at: new Date(start.getTime() + oldDur).toISOString() })
                      }}
                    />
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Fim</label>
                    <input 
                      type="datetime-local" 
                      className="w-full text-sm border border-gray-200 rounded-lg p-2 outline-none focus:ring-2 focus:ring-slate-900"
                      value={toLocalInput(editing.ends_at)}
                      onChange={e => setEditing({...editing, ends_at: new Date(e.target.value).toISOString()})}
                    />
                 </div>
              </div>

              {/* Notas */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Notas Internas</label>
                <textarea 
                  className="w-full text-sm border border-gray-200 rounded-lg p-3 outline-none focus:ring-2 focus:ring-slate-900 resize-none h-20"
                  placeholder="Alergias, preferências..."
                  value={editing.notes || ""}
                  onChange={e => setEditing({...editing, notes: e.target.value})}
                />
              </div>
            </div>

            {/* Footer Modal */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
              {editing.id && (
                <button 
                  onClick={async () => {
                     if(!confirm('Excluir?')) return;
                     await supabase.from("appointments").delete().eq('id', editing.id);
                     setModalOpen(false); loadBase();
                  }} 
                  className="text-red-600 text-sm font-semibold hover:bg-red-50 px-3 py-2 rounded-lg transition"
                >
                  Excluir
                </button>
              )}
              <div className="flex gap-3 ml-auto">
                 <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-200 rounded-lg transition">Cancelar</button>
                 <button onClick={handleSave} className="px-6 py-2 text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-lg hover:shadow-xl transition transform active:scale-95">Salvar Agendamento</button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

// Helper de Data Input
function toLocalInput(iso: string) {
  if(!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

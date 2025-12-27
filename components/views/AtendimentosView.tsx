import React, { useState, useMemo } from 'react';
import { 
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, 
  Settings, Filter, Plus, Minus, User, Clock, CheckSquare 
} from 'lucide-react';
import { format, addDays, startOfDay, addMinutes, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// --- Tipos Simulados (Baseado no seu contexto) ---
type Professional = { id: string; name: string; avatar?: string; color: string };
type Appointment = { 
  id: string; 
  profId: string; 
  clientName: string; 
  serviceName: string; 
  startTime: Date; 
  duration: number; // em minutos
  status: 'agendado' | 'concluido' | 'cancelado';
};

// --- Dados Mockados para Visualização Imediata ---
const MOCK_PROFS: Professional[] = [
  { id: '1', name: 'Jacilene Félix', color: 'bg-blue-100 border-blue-200', avatar: 'https://i.pravatar.cc/150?u=1' },
  { id: '2', name: 'Graziela Oliveira', color: 'bg-purple-100 border-purple-200', avatar: 'https://i.pravatar.cc/150?u=2' },
  { id: '3', name: 'Jéssica Félix', color: 'bg-pink-100 border-pink-200', avatar: 'https://i.pravatar.cc/150?u=3' },
  { id: '4', name: 'Gleizia', color: 'bg-green-100 border-green-200', avatar: 'https://i.pravatar.cc/150?u=4' },
];

const MOCK_APPTS: Appointment[] = [
  { 
    id: '101', profId: '1', clientName: 'Mércia Nova Cruz', serviceName: 'Design Com Henna', 
    startTime: new Date(new Date().setHours(9, 20, 0, 0)), duration: 40, status: 'agendado' 
  },
  { 
    id: '102', profId: '1', clientName: 'Flavya Roberta', serviceName: 'Micropigmentação', 
    startTime: new Date(new Date().setHours(10, 0, 0, 0)), duration: 180, status: 'agendado' 
  },
  { 
    id: '103', profId: '2', clientName: 'Amanda Almeida', serviceName: 'Volume Brasileiro', 
    startTime: new Date(new Date().setHours(13, 30, 0, 0)), duration: 150, status: 'agendado' 
  },
];

// --- Configurações de Layout ---
const PIXELS_PER_MINUTE = 2; // Zoom vertical
const START_HOUR = 8;
const END_HOUR = 20;

export const AtendimentosView: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [columnWidth, setColumnWidth] = useState(200); // Slider de largura
  const [slotInterval, setSlotInterval] = useState(30); // 30 min padrão
  const [selectedProfs, setSelectedProfs] = useState<string[]>(MOCK_PROFS.map(p => p.id));

  // Gera os slots de tempo (linhas)
  const timeSlots = useMemo(() => {
    const slots = [];
    let current = new Date(currentDate);
    current.setHours(START_HOUR, 0, 0, 0);
    const end = new Date(currentDate);
    end.setHours(END_HOUR, 0, 0, 0);

    while (current < end) {
      slots.push(new Date(current));
      current = addMinutes(current, slotInterval);
    }
    return slots;
  }, [currentDate, slotInterval]);

  // Função para calcular posição absoluta e altura do card
  const getAppointmentStyle = (appt: Appointment) => {
    const startHour = appt.startTime.getHours();
    const startMin = appt.startTime.getMinutes();
    const minutesFromStart = (startHour - START_HOUR) * 60 + startMin;
    
    return {
      top: `${minutesFromStart * PIXELS_PER_MINUTE}px`,
      height: `${appt.duration * PIXELS_PER_MINUTE}px`,
      width: '94%', // Margem lateral
      left: '3%',
    };
  };

  return (
    <div className="flex h-screen bg-gray-50 text-gray-800 font-sans overflow-hidden">
      
      {/* --- SIDEBAR DE CONFIGURAÇÕES (Esquerda) --- */}
      <aside className="w-72 bg-white border-r border-gray-200 flex flex-col z-20 shadow-sm shrink-0">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-800">Atendimentos</h2>
          
          {/* Navegação de Data */}
          <div className="flex items-center justify-between mt-6 bg-gray-50 p-2 rounded-lg">
            <button onClick={() => setCurrentDate(d => addDays(d, -1))} className="p-1 hover:bg-gray-200 rounded">
              <ChevronLeft size={20} />
            </button>
            <div className="text-sm font-semibold text-center">
              <span className="block text-xs text-gray-500 uppercase">{format(currentDate, 'EEEE', { locale: ptBR })}</span>
              <span className="text-orange-600">{format(currentDate, "d/MMM/yyyy", { locale: ptBR })}</span>
            </div>
            <button onClick={() => setCurrentDate(d => addDays(d, 1))} className="p-1 hover:bg-gray-200 rounded">
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Seção Configurações */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-700">Configurações</h3>
              <ChevronLeft size={16} className="text-gray-400 rotate-270" />
            </div>

            {/* Slider Largura */}
            <div className="mb-6">
              <label className="text-xs text-gray-500 mb-2 block">Largura das colunas</label>
              <div className="flex items-center gap-2">
                <input 
                  type="range" 
                  min="150" 
                  max="400" 
                  value={columnWidth} 
                  onChange={(e) => setColumnWidth(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-800"
                />
                <span className="text-xs font-bold text-gray-700">Auto</span>
              </div>
            </div>

            {/* Intervalo de Tempo */}
            <div className="mb-6">
              <label className="text-xs text-gray-500 mb-2 block">Intervalo de tempo</label>
              <div className="flex items-center justify-between bg-gray-50 p-2 rounded-md">
                <span className="text-sm font-medium">{slotInterval} minutos (Padrão)</span>
                <div className="flex gap-1">
                  <button onClick={() => setSlotInterval(Math.max(15, slotInterval - 15))} className="p-1 hover:bg-gray-200 rounded"><Minus size={14}/></button>
                  <button onClick={() => setSlotInterval(Math.min(60, slotInterval + 15))} className="p-1 hover:bg-gray-200 rounded"><Plus size={14}/></button>
                </div>
              </div>
            </div>

            {/* Filtro Profissionais */}
            <div>
              <label className="text-xs text-gray-500 mb-2 block">Profissionais</label>
              <div className="space-y-2">
                {MOCK_PROFS.map(prof => (
                  <label key={prof.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                    <input 
                      type="checkbox" 
                      checked={selectedProfs.includes(prof.id)}
                      onChange={(e) => {
                        if(e.target.checked) setSelectedProfs([...selectedProfs, prof.id]);
                        else setSelectedProfs(selectedProfs.filter(id => id !== prof.id));
                      }}
                      className="w-4 h-4 text-gray-900 rounded border-gray-300 focus:ring-gray-900" 
                    />
                    <span className="text-sm text-gray-700">{prof.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* --- GRID DE AGENDAMENTO (Direita) --- */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        
        {/* Header Superior (Botão Agendar) */}
        <header className="h-16 border-b border-gray-200 bg-white flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
             {/* Breadcrumbs ou Status aqui */}
          </div>
          <div className="flex items-center gap-3">
             <button className="text-gray-500 hover:bg-gray-100 p-2 rounded-full"><Settings size={20}/></button>
             <button className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-md font-medium shadow-sm transition-colors">
               Agendar
             </button>
          </div>
        </header>

        {/* Área de Scroll do Grid */}
        <div className="flex-1 overflow-auto relative bg-white" style={{ scrollBehavior: 'smooth' }}>
          <div className="flex min-w-max">
            
            {/* Coluna de Horários (Sticky Left) */}
            <div className="sticky left-0 z-30 bg-white border-r border-gray-100 pt-[70px] w-16 flex flex-col shadow-[4px_0_10px_-5px_rgba(0,0,0,0.1)]">
               {timeSlots.map((time, i) => (
                 <div key={i} className="flex items-start justify-center text-xs text-gray-400 font-medium border-b border-dashed border-gray-100 box-border" 
                      style={{ height: `${slotInterval * PIXELS_PER_MINUTE}px` }}>
                   <span className="-mt-2 bg-white px-1">{format(time, 'HH:mm')}</span>
                 </div>
               ))}
            </div>

            {/* Colunas dos Profissionais */}
            {MOCK_PROFS.filter(p => selectedProfs.includes(p.id)).map(prof => (
              <div key={prof.id} className="flex flex-col border-r border-gray-100 shrink-0 transition-all duration-300" style={{ width: columnWidth }}>
                
                {/* Header do Profissional (Sticky Top) */}
                <div className="sticky top-0 z-20 bg-white h-[70px] border-b border-gray-200 flex items-center gap-3 px-4 shadow-sm">
                   <div className="relative">
                      <img src={prof.avatar} alt={prof.name} className="w-10 h-10 rounded-full object-cover border border-gray-200" />
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                   </div>
                   <span className="text-sm font-semibold text-gray-700 truncate">{prof.name.split(' ')[0]}</span>
                </div>

                {/* Corpo da Agenda (Slots + Cards) */}
                <div className="relative bg-[linear-gradient(to_bottom,#f9fafb_1px,transparent_1px)] bg-[size:100%_30px]"> 
                  {/* Grid Lines de Fundo */}
                  {timeSlots.map((_, i) => (
                     <div key={i} className="border-b border-gray-100" style={{ height: `${slotInterval * PIXELS_PER_MINUTE}px` }}></div>
                  ))}

                  {/* Cards de Agendamento (Absolute Positioning) */}
                  {MOCK_APPTS.filter(a => a.profId === prof.id).map(appt => (
                    <div 
                      key={appt.id}
                      className={`absolute rounded-md border-l-4 p-2 text-xs shadow-sm cursor-pointer hover:shadow-md transition-shadow overflow-hidden flex flex-col justify-center ${prof.color}`}
                      style={getAppointmentStyle(appt)}
                    >
                      <div className="font-bold text-gray-800 truncate">{appt.clientName}</div>
                      <div className="text-gray-600 truncate">{appt.serviceName}</div>
                      <div className="flex items-center gap-1 mt-1 text-[10px] text-gray-500 font-medium">
                         <Clock size={10} />
                         {format(appt.startTime, 'HH:mm')} - {format(addMinutes(appt.startTime, appt.duration), 'HH:mm')}
                      </div>
                      
                      {/* Ícones de ação (hover style seria melhor aqui) */}
                      <div className="absolute top-1 right-1 opacity-50">
                        {/* Status icon placeholder */}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AtendimentosView;


import React from 'react';
import { Clock, MessageCircle, ChevronRight, CalendarX, Plus, Scissors } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { AppointmentStatus } from '../../types';

const statusMap: Record<AppointmentStatus, { label: string; color: string; bg: string }> = {
    agendado: { label: 'Pendente', color: 'text-amber-700', bg: 'bg-amber-100' },
    confirmado: { label: 'Confirmado', color: 'text-emerald-700', bg: 'bg-emerald-100' },
    confirmado_whatsapp: { label: 'Confirmado WA', color: 'text-teal-700', bg: 'bg-teal-100' },
    chegou: { label: 'Na Recepção', color: 'text-purple-700', bg: 'bg-purple-100' },
    em_atendimento: { label: 'Em Atendimento', color: 'text-blue-700', bg: 'bg-blue-100' },
    concluido: { label: 'Concluído', color: 'text-slate-500', bg: 'bg-slate-100' },
    cancelado: { label: 'Cancelado', color: 'text-rose-700', bg: 'bg-rose-100' },
    bloqueado: { label: 'Bloqueado', color: 'text-slate-400', bg: 'bg-slate-200' },
    faltou: { label: 'Faltou', color: 'text-orange-700', bg: 'bg-orange-100' },
    em_espera: { label: 'Em Espera', color: 'text-slate-600', bg: 'bg-slate-100' }
};

interface TodayScheduleWidgetProps {
    onNavigate: (view: any) => void;
    appointments: any[];
    dateLabel?: string;
}

const TodayScheduleWidget: React.FC<TodayScheduleWidgetProps> = ({ onNavigate, appointments, dateLabel = 'Hoje' }) => {
    
    // Filtrando e Ordenando (Lógica Crítica para Dashboard)
    const activeApps = [...appointments]
        .filter(app => app.status !== 'cancelado' && app.status !== 'bloqueado')
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, 10);

    return (
        <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm overflow-hidden flex flex-col h-full min-h-[400px]">
            <header className="p-5 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                <div>
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Timeline {dateLabel === 'Hoje' ? 'de Hoje' : 'do Período'}</h3>
                </div>
                <button onClick={() => onNavigate('agenda')} className="text-[10px] font-black text-orange-500 uppercase tracking-widest hover:text-orange-600 transition-colors flex items-center gap-1">
                    Agenda <ChevronRight size={12} />
                </button>
            </header>

            <div className="flex-1 p-5 overflow-y-auto custom-scrollbar text-left">
                {activeApps.length > 0 ? (
                    <div className="space-y-6 relative before:absolute before:left-[15px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                        {activeApps.map((app) => (
                            <div key={app.id} className="relative flex items-start gap-4 group animate-in fade-in slide-in-from-left-2 duration-300">
                                <div className="z-10 mt-1.5 w-8 h-8 rounded-full bg-white border-2 border-slate-100 flex items-center justify-center flex-shrink-0 group-hover:border-orange-200 transition-colors">
                                    <div className={`w-2.5 h-2.5 rounded-full ${app.status === 'em_atendimento' ? 'bg-indigo-500 animate-pulse' : app.status === 'concluido' ? 'bg-slate-300' : 'bg-orange-500'}`}></div>
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-0.5">
                                        <span className="text-xs font-black text-slate-800">{format(parseISO(app.date), 'HH:mm')}</span>
                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${statusMap[app.status as AppointmentStatus]?.bg} ${statusMap[app.status as AppointmentStatus]?.color}`}>
                                            {statusMap[app.status as AppointmentStatus]?.label}
                                        </span>
                                    </div>
                                    
                                    <h4 className="text-sm font-bold text-slate-700 truncate">
                                        {app.clients?.name || 'Cliente'}
                                    </h4>
                                    
                                    <p className="text-[11px] text-slate-400 font-medium truncate">
                                        {app.services?.name || 'Serviço'} • {app.team_members?.name || 'Profissional'}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center py-10">
                        <CalendarX className="text-slate-200 mb-4" size={32} />
                        <h4 className="text-sm font-bold text-slate-800 uppercase tracking-tighter">Agenda Livre</h4>
                        <p className="text-xs text-slate-400 mt-1">Nenhum agendamento ativo.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TodayScheduleWidget;

import React from 'react';
import { Clock, User, MessageCircle, ChevronRight, CalendarX, Plus } from 'lucide-react';
import { format, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { initialAppointments } from '../../data/mockData';
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
}

const TodayScheduleWidget: React.FC<TodayScheduleWidgetProps> = ({ onNavigate }) => {
    const today = new Date();
    
    const todaysApps = initialAppointments
        .filter(app => isSameDay(app.start, today))
        .sort((a, b) => a.start.getTime() - b.start.getTime())
        .slice(0, 4); // Mostra apenas os próximos 4

    return (
        <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm overflow-hidden flex flex-col h-full">
            <header className="p-5 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                <div>
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Agenda de Hoje</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{todaysApps.length} Atendimentos</p>
                </div>
                <button 
                    onClick={() => onNavigate('agenda')}
                    className="text-[10px] font-black text-orange-500 uppercase tracking-widest hover:text-orange-600 transition-colors flex items-center gap-1"
                >
                    Ver Tudo <ChevronRight size={12} />
                </button>
            </header>

            <div className="flex-1 p-5">
                {todaysApps.length > 0 ? (
                    <div className="space-y-6 relative before:absolute before:left-[15px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                        {todaysApps.map((app) => (
                            <div key={app.id} className="relative flex items-start gap-4 group">
                                {/* Dot Indicator */}
                                <div className="z-10 mt-1.5 w-8 h-8 rounded-full bg-white border-2 border-slate-100 flex items-center justify-center flex-shrink-0 group-hover:border-orange-200 transition-colors">
                                    <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-0.5">
                                        <span className="text-xs font-black text-slate-800">
                                            {format(app.start, 'HH:mm')}
                                        </span>
                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${statusMap[app.status]?.bg} ${statusMap[app.status]?.color}`}>
                                            {statusMap[app.status]?.label}
                                        </span>
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                        <h4 className="text-sm font-bold text-slate-700 truncate">
                                            {app.client?.nome || 'Bloqueado'}
                                        </h4>
                                    </div>
                                    
                                    <p className="text-[11px] text-slate-400 font-medium truncate">
                                        {app.service.name} • {app.professional.name}
                                    </p>
                                </div>

                                <button 
                                    className="p-2 text-slate-300 hover:text-green-500 hover:bg-green-50 rounded-xl transition-all"
                                    title="Enviar WhatsApp"
                                >
                                    <MessageCircle size={18} />
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center py-10">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                            <CalendarX className="text-slate-200" size={32} />
                        </div>
                        <h4 className="text-sm font-bold text-slate-800">Nenhum agendamento</h4>
                        <p className="text-xs text-slate-400 mt-1 mb-6">Sua agenda está livre por enquanto.</p>
                        <button 
                            onClick={() => onNavigate('agenda')}
                            className="flex items-center gap-2 px-4 py-2 bg-orange-50 text-orange-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-orange-100 transition-all"
                        >
                            <Plus size={14} /> Novo Agendamento
                        </button>
                    </div>
                )}
            </div>

            {todaysApps.length > 0 && (
                <footer className="p-4 bg-slate-50/50 border-t border-slate-50">
                    <button 
                        onClick={() => onNavigate('agenda')}
                        className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest hover:bg-white hover:border-slate-300 transition-all"
                    >
                        Abrir Agenda Completa
                    </button>
                </footer>
            )}
        </div>
    );
};

export default TodayScheduleWidget;
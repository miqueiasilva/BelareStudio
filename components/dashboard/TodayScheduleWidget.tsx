
import React from 'react';
import { Clock, MessageCircle, ChevronRight, CalendarX, Plus, Scissors } from 'lucide-react';
import { format } from 'date-fns';
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
    
    // LOGICA DE ORDENAÇÃO: Cronológica Decrescente (O mais futuro/recente primeiro)
    const activeApps = [...appointments]
        .filter(app => app.status !== 'cancelado' && app.status !== 'bloqueado')
        .sort((a, b) => {
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            return dateB - dateA; // B - A = Ordem Decrescente
        })
        .slice(0, 10);

    return (
        <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm overflow-hidden flex flex-col h-full min-h-[400px]">
            <header className="p-5 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                <div>
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Timeline {dateLabel === 'Hoje' ? 'de Hoje' : 'do Período'}</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{appointments.filter(a => a.status !== 'cancelado').length} Atendimentos</p>
                </div>
                <button 
                    onClick={() => onNavigate('agenda')}
                    className="text-[10px] font-black text-orange-500 uppercase tracking-widest hover:text-orange-600 transition-colors flex items-center gap-1"
                >
                    Agenda <ChevronRight size={12} />
                </button>
            </header>

            <div className="flex-1 p-5 overflow-y-auto custom-scrollbar text-left">
                {activeApps.length > 0 ? (
                    <div className="space-y-6 relative before:absolute before:left-[15px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                        {activeApps.map((app) => (
                            <div key={app.id} className="relative flex items-start gap-4 group animate-in fade-in slide-in-from-left-2 duration-300">
                                {/* Dot Indicator */}
                                <div className="z-10 mt-1.5 w-8 h-8 rounded-full bg-white border-2 border-slate-100 flex items-center justify-center flex-shrink-0 group-hover:border-orange-200 transition-colors">
                                    <div className={`w-2.5 h-2.5 rounded-full ${
                                        app.status === 'em_atendimento' ? 'bg-indigo-500 animate-pulse' : 
                                        app.status === 'concluido' ? 'bg-slate-300' : 
                                        'bg-orange-500'
                                    }`}></div>
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-0.5">
                                        <span className="text-xs font-black text-slate-800">
                                            {format(new Date(app.date), 'HH:mm')}
                                            {dateLabel !== 'Hoje' && <span className="ml-1 opacity-40 text-[9px]">({format(new Date(app.date), 'dd/MM')})</span>}
                                        </span>
                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${statusMap[app.status as AppointmentStatus]?.bg} ${statusMap[app.status as AppointmentStatus]?.color}`}>
                                            {statusMap[app.status as AppointmentStatus]?.label}
                                        </span>
                                    </div>
                                    
                                    <h4 className="text-sm font-bold text-slate-700 truncate flex items-center gap-2">
                                        {app.client_name || 'Bloqueado'}
                                        {app.status === 'em_atendimento' && <Scissors size={10} className="text-indigo-600 animate-bounce" />}
                                    </h4>
                                    
                                    <p className="text-[11px] text-slate-400 font-medium truncate">
                                        {app.service_name} • {app.professional_name}
                                    </p>
                                </div>

                                <button 
                                    className="p-2 text-slate-300 hover:text-green-500 hover:bg-green-50 rounded-xl transition-all"
                                    title="Enviar WhatsApp"
                                    onClick={() => window.open(`https://wa.me/55${app.client_whatsapp?.replace(/\D/g, '')}`, '_blank')}
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
                        <h4 className="text-sm font-bold text-slate-800 uppercase tracking-tighter">Agenda Livre</h4>
                        <p className="text-xs text-slate-400 mt-1 mb-6">Nenhum agendamento para este período.</p>
                        <button 
                            onClick={() => onNavigate('agenda')}
                            className="flex items-center gap-2 px-4 py-2 bg-orange-50 text-orange-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-orange-100 transition-all shadow-sm"
                        >
                            <Plus size={14} /> Agendar Agora
                        </button>
                    </div>
                )}
            </div>

            {activeApps.length > 0 && (
                <footer className="p-4 bg-slate-50/50 border-t border-slate-50">
                    <button 
                        onClick={() => onNavigate('agenda')}
                        className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest hover:bg-white hover:border-slate-300 transition-all"
                    >
                        Ver agenda completa
                    </button>
                </footer>
            )}
        </div>
    );
};

export default TodayScheduleWidget;

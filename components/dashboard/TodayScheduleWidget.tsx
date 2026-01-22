
import React from 'react';
import { Clock, MessageCircle, ChevronRight, CalendarX, Plus, Scissors, RefreshCw } from 'lucide-react';
// FIX: Removed parseISO as it may not be exported in this version of date-fns
import { format, isValid } from 'date-fns';
import { AppointmentStatus } from '../../types';

const statusMap: Record<string, { label: string; color: string; bg: string }> = {
    agendado: { label: 'Pendente', color: 'text-amber-700', bg: 'bg-amber-100' },
    pendente: { label: 'Pendente', color: 'text-amber-700', bg: 'bg-amber-100' },
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

/**
 * ✅ BLINDAGEM: Função de formatação segura para prevenir "RangeError: Invalid time value"
 * Lida com strings de horário, datas nulas e formatos inconsistentes.
 */
const safeFormat = (dateValue: any, fmt: string) => {
    if (!dateValue) return '--:--';
    try {
        if (typeof dateValue === 'string' && /^\d{2}:\d{2}$/.test(dateValue)) {
            return dateValue;
        }

        // FIX: Replaced parseISO with native new Date() for compatibility
        const d = (typeof dateValue === 'string') ? new Date(dateValue) : new Date(dateValue);
        
        if (!isValid(d)) {
            const fallback = new Date(dateValue.toString().replace(' ', 'T'));
            if (isValid(fallback)) return format(fallback, fmt);
            return '--:--';
        }
        return format(d, fmt);
    } catch (e) {
        return '--:--';
    }
};

interface TodayScheduleWidgetProps {
    onNavigate: (view: any) => void;
    appointments: any[];
    dateLabel?: string;
}

const TodayScheduleWidget: React.FC<TodayScheduleWidgetProps> = ({ onNavigate, appointments, dateLabel = 'Hoje' }) => {
    
    // ✅ LOGICA DE ORDENAÇÃO: Cronológica Decrescente (O mais futuro/recente primeiro)
    const activeApps = [...appointments]
        .filter(app => app.status !== 'cancelado' && app.status !== 'bloqueado')
        .sort((a, b) => {
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            return dateB - dateA; 
        })
        .slice(0, 10);

    return (
        <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm overflow-hidden flex flex-col h-full min-h-[400px]">
            <header className="p-5 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                <div>
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Timeline {dateLabel === 'Hoje' ? 'de Hoje' : 'do Período'}</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Monitoramento em Tempo Real</p>
                </div>
                <button 
                    onClick={() => onNavigate('agenda')}
                    className="p-2 hover:bg-white rounded-xl transition-all group"
                >
                    <ChevronRight size={20} className="text-slate-300 group-hover:text-orange-50 group-hover:translate-x-1 transition-all" />
                </button>
            </header>

            <div className="flex-1 p-5 overflow-y-auto custom-scrollbar text-left relative bg-slate-50/10">
                {activeApps.length > 0 ? (
                    <div className="space-y-6 relative before:absolute before:left-[15px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                        {activeApps.map((app) => {
                            const statusInfo = statusMap[app.status] || { label: app.status || 'Status', color: 'text-slate-500', bg: 'bg-slate-100' };
                            const appTime = safeFormat(app.date, 'HH:mm');
                            
                            return (
                                <div key={app.id} className="relative flex items-start gap-4 group animate-in fade-in slide-in-from-left-2 duration-300">
                                    <div className="z-10 mt-1.5 w-8 h-8 rounded-full bg-white border-2 border-slate-100 flex items-center justify-center flex-shrink-0 group-hover:border-orange-200 transition-colors shadow-sm">
                                        <div className={`w-2.5 h-2.5 rounded-full ${
                                            app.status === 'em_atendimento' ? 'bg-indigo-500 animate-pulse' : 
                                            app.status === 'concluido' ? 'bg-slate-300' : 
                                            'bg-orange-500'
                                        }`}></div>
                                    </div>

                                    <div className="flex-1 min-w-0 bg-white p-3 rounded-2xl border border-transparent group-hover:border-slate-100 group-hover:shadow-sm transition-all">
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-1.5">
                                                <Clock size={12} className="text-slate-300" />
                                                <span className="text-xs font-black text-slate-800">
                                                    {appTime}
                                                    {dateLabel !== 'Hoje' && <span className="ml-1 opacity-40 text-[9px]">({safeFormat(app.date, 'dd/MM')})</span>}
                                                </span>
                                            </div>
                                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${statusInfo.bg} ${statusInfo.color}`}>
                                                {statusInfo.label}
                                            </span>
                                        </div>
                                        
                                        <h4 className="text-sm font-bold text-slate-700 truncate flex items-center gap-2">
                                            {app.client_name || 'Bloqueado'}
                                            {app.status === 'em_atendimento' && <RefreshCw size={10} className="text-indigo-600 animate-spin" />}
                                        </h4>
                                        
                                        <p className="text-[10px] text-slate-400 font-black uppercase mt-1 truncate">
                                            {app.service_name} <span className="mx-1 opacity-20">•</span> {app.professional_name}
                                        </p>
                                    </div>

                                    <button 
                                        className="mt-2 p-2.5 bg-white text-slate-300 hover:text-green-500 hover:bg-green-50 rounded-xl transition-all border border-slate-50 shadow-sm"
                                        title="WhatsApp"
                                        onClick={() => {
                                            const phone = app.client_whatsapp?.replace(/\D/g, '');
                                            if (phone) window.open(`https://wa.me/55${phone}`, '_blank');
                                        }}
                                    >
                                        <MessageCircle size={16} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center py-10">
                        <div className="w-16 h-16 bg-slate-50 rounded-[28px] flex items-center justify-center mb-4 border-2 border-dashed border-slate-200">
                            <CalendarX className="text-slate-200" size={32} />
                        </div>
                        <h4 className="text-sm font-bold text-slate-800 uppercase tracking-tighter">Fluxo Vazio</h4>
                        <p className="text-xs text-slate-400 mt-1 mb-6 max-w-[180px] mx-auto leading-relaxed">Nenhum atendimento ativo identificado no radar.</p>
                        <button 
                            onClick={() => onNavigate('agenda')}
                            className="flex items-center gap-2 px-6 py-2.5 bg-orange-500 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-orange-600 transition-all shadow-lg shadow-orange-100 active:scale-95"
                        >
                            <Plus size={14} /> Novo Agendamento
                        </button>
                    </div>
                )}
            </div>

            {activeApps.length > 0 && (
                <footer className="p-4 bg-slate-50/50 border-t border-slate-50">
                    <button 
                        onClick={() => onNavigate('agenda')}
                        className="w-full py-3 rounded-xl border-2 border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white hover:border-orange-500 hover:text-orange-600 transition-all active:scale-95"
                    >
                        Abrir Agenda Completa
                    </button>
                </footer>
            )}
        </div>
    );
};

export default TodayScheduleWidget;

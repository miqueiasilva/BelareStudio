
import React, { useRef, useEffect, useState } from 'react';
import { LegacyAppointment, AppointmentStatus } from '../../types';
import { 
    Calendar, Tag, DollarSign, Send, Edit, Trash2, 
    User, MoreVertical, X, CheckCircle2, Receipt, Lock
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR as pt } from 'date-fns/locale/pt-BR';
import StatusUpdatePopover from './StatusUpdatePopover';
import CheckoutModal from '../modals/CheckoutModal';

interface AppointmentDetailPopoverProps {
  appointment: LegacyAppointment;
  targetElement: HTMLElement | null;
  onClose: () => void;
  onEdit: (appointment: LegacyAppointment) => void;
  onDelete: (id: number) => void;
  onUpdateStatus: (appointmentId: number, newStatus: AppointmentStatus) => void;
}

const statusLabels: { [key in AppointmentStatus]: string } = {
    agendado: 'Horário Marcado',
    confirmado: 'Confirmado',
    confirmado_whatsapp: 'Confirmado via WhatsApp',
    chegou: 'Cliente Chegou',
    em_atendimento: 'Em Atendimento',
    concluido: 'Concluído',
    faltou: 'Cliente Faltou',
    cancelado: 'Cancelado',
    bloqueado: 'Bloqueado',
    em_espera: 'Em Espera',
};

const AppointmentDetailPopover: React.FC<AppointmentDetailPopoverProps> = ({
  appointment,
  targetElement,
  onClose,
  onEdit,
  onDelete,
  onUpdateStatus,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0, opacity: 0 });
  const [isStatusPopoverOpen, setIsStatusPopoverOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        if (!isCheckoutOpen) onClose();
      }
    };

    const handlePositioning = () => {
        if (!targetElement || !popoverRef.current) return;

        const targetRect = targetElement.getBoundingClientRect();
        const popoverRect = popoverRef.current.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        
        let top = targetRect.top;
        let left = targetRect.right + 12;

        if (left + popoverRect.width > viewportWidth) {
            left = targetRect.left - popoverRect.width - 12;
        }
        
        top = targetRect.top + (targetRect.height / 2) - (popoverRect.height / 2);

        if (top < 16) top = 16;
        if (top + popoverRect.height > window.innerHeight - 16) {
            top = window.innerHeight - popoverRect.height - 16;
        }
        if (left < 16) left = 16;

        setPosition({ top, left, opacity: 1 });
    };
    
    const timer = setTimeout(handlePositioning, 0);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose, targetElement, isCheckoutOpen]);

  const handleStatusUpdateWrapper = (id: number, status: AppointmentStatus) => {
    onUpdateStatus(id, status);
    setIsStatusPopoverOpen(false);
    onClose();
  };

  const isFinished = ['concluido', 'cancelado', 'bloqueado'].includes(appointment.status);
  const canCheckout = !isFinished;
  
  // SEGURANÇA: Bloqueio de exclusão para agendamentos pagos ou bloqueados
  const isLockedForDelete = ['concluido', 'bloqueado'].includes(appointment.status?.toLowerCase());

  return (
    <>
        <div
            ref={popoverRef}
            className={`fixed z-40 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col transition-all duration-150 ${isCheckoutOpen ? 'opacity-0 pointer-events-none scale-95' : 'scale-100'}`}
            style={{ top: position.top, left: position.left, opacity: isCheckoutOpen ? 0 : position.opacity }}
            onClick={(e) => e.stopPropagation()}
        >
            <header className="flex items-center p-3 border-b border-slate-100 bg-slate-50/50">
                <div className="flex-1 flex items-center gap-1.5">
                    <button 
                        onClick={() => { onEdit(appointment); onClose(); }} 
                        className="p-2 text-slate-500 hover:bg-slate-100 rounded-xl" 
                        title="Editar"
                    >
                        <Edit size={18} />
                    </button>
                    
                    <button 
                        onClick={() => { if (!isLockedForDelete) onDelete(appointment.id); }} 
                        disabled={isLockedForDelete}
                        className={`p-2 rounded-xl transition-all ${isLockedForDelete ? 'text-slate-300 cursor-not-allowed opacity-50' : 'text-rose-500 hover:bg-rose-50'}`} 
                        title={isLockedForDelete ? "Pagamento baixado: Exclusão bloqueada" : "Excluir Agendamento"}
                    >
                        {isLockedForDelete ? <Lock size={18} /> : <Trash2 size={18} />}
                    </button>

                    <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-xl" title="Ver Perfil"><User size={18} /></button>
                </div>
                <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full"><X size={18}/></button>
            </header>
            
            <main className="p-5 space-y-4">
                <div>
                    <h3 className="font-black text-lg text-slate-800 leading-tight">{appointment.client?.nome || 'Horário Bloqueado'}</h3>
                    <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest mt-0.5">{appointment.service.name}</p>
                </div>
                
                <div className="space-y-3">
                    <div className="flex items-start gap-3 text-xs font-bold text-slate-600">
                        <Calendar size={14} className="mt-0.5 text-slate-400" />
                        <div>
                            <span className="capitalize">{format(appointment.start, "EEEE, dd 'de' MMMM", { locale: pt })}</span>
                            <br/>
                            <span className="text-slate-400">{format(appointment.start, "HH:mm")} às {format(appointment.end, "HH:mm")}</span>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3 text-xs font-bold text-slate-600">
                        <DollarSign size={14} className="text-slate-400" />
                        <span className="text-emerald-600 font-black text-base">R$ {appointment.service.price.toFixed(2)}</span>
                    </div>
                </div>

                <div className="border-t border-slate-100 pt-4 flex flex-col gap-3 pb-2">
                    <div className="mb-2">
                        <button
                            ref={statusRef}
                            onClick={() => setIsStatusPopoverOpen(true)}
                            className="w-full flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-500 bg-slate-50 hover:bg-slate-100 p-3 rounded-xl transition-all border border-slate-100"
                        >
                            <div className="flex items-center gap-2">
                                <CheckCircle2 size={14} className="text-slate-400" />
                                <span>{statusLabels[appointment.status]}</span>
                            </div>
                            <MoreVertical size={14} />
                        </button>
                    </div>

                    {canCheckout && (
                        <button
                            onClick={() => setIsCheckoutOpen(true)}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-[0.1em] py-4 rounded-2xl shadow-xl shadow-emerald-100 transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                            <Receipt size={16} />
                            Finalizar Atendimento
                        </button>
                    )}

                    {appointment.status === 'concluido' && (
                        <div className="flex items-center justify-center gap-2 py-3 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-100">
                            <CheckCircle2 size={16} />
                            <span className="text-[10px] font-black uppercase tracking-widest">Pagamento Recebido</span>
                        </div>
                    )}
                </div>
            </main>
        </div>

        {isStatusPopoverOpen && (
            <StatusUpdatePopover
                appointment={appointment}
                targetElement={statusRef.current}
                onClose={() => setIsStatusPopoverOpen(false)}
                onUpdateStatus={handleStatusUpdateWrapper}
            />
        )}

        {isCheckoutOpen && (
            <CheckoutModal 
                isOpen={isCheckoutOpen}
                onClose={() => { 
                    setIsCheckoutOpen(false); 
                }}
                appointment={{
                    id: appointment.id,
                    client_id: appointment.client?.id,
                    client_name: appointment.client?.nome || 'Cliente',
                    service_name: appointment.service.name,
                    price: appointment.service.price
                }}
                onSuccess={() => {
                    onUpdateStatus(appointment.id, 'concluido');
                    setIsCheckoutOpen(false);
                    onClose();
                }}
            />
        )}
    </>
  );
};

export default AppointmentDetailPopover;

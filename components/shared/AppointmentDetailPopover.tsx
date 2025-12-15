
import React, { useRef, useEffect, useState } from 'react';
import { LegacyAppointment, AppointmentStatus } from '../../types';
import { Calendar, Tag, DollarSign, Send, Edit, Trash2, User, MoreVertical, X } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import StatusUpdatePopover from './StatusUpdatePopover';

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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handlePositioning = () => {
        if (!targetElement || !popoverRef.current) return;

        const targetRect = targetElement.getBoundingClientRect();
        const popoverRect = popoverRef.current.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        
        let top = targetRect.top;
        let left = targetRect.right + 12; // Position to the right of the appointment

        // If it overflows right, position to the left
        if (left + popoverRect.width > viewportWidth) {
            left = targetRect.left - popoverRect.width - 12;
        }
        
        // Basic vertical centering attempt
        top = targetRect.top + (targetRect.height / 2) - (popoverRect.height / 2);

        // Prevent overflow top/bottom
        if (top < 16) top = 16;
        if (top + popoverRect.height > window.innerHeight - 16) {
            top = window.innerHeight - popoverRect.height - 16;
        }
        // Ensure left is not off-screen
        if (left < 16) left = 16;

        setPosition({ top, left, opacity: 1 });
    };
    
    // Use a timeout to ensure the element has been rendered and has dimensions
    const timer = setTimeout(handlePositioning, 0);

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resize', onClose);
    window.addEventListener('scroll', onClose, true);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', onClose);
      window.removeEventListener('scroll', onClose, true);
    };
  }, [onClose, targetElement]);

  const handleStatusUpdateWrapper = (id: number, status: AppointmentStatus) => {
    onUpdateStatus(id, status);
    setIsStatusPopoverOpen(false); // Close nested popover
    onClose(); // Close main popover after status change
  };

  return (
    <>
        <div
            ref={popoverRef}
            className="fixed z-40 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col transition-opacity duration-150"
            style={{ top: position.top, left: position.left, opacity: position.opacity }}
            onClick={(e) => e.stopPropagation()}
        >
            <header className="flex items-center p-3 border-b border-slate-100">
                <div className="flex-1 flex items-center gap-3">
                    <button className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-md"><Send size={18} /></button>
                    <button onClick={() => { onEdit(appointment); onClose(); }} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-md"><Edit size={18} /></button>
                    <button onClick={() => { onDelete(appointment.id); onClose(); }} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-md"><Trash2 size={18} /></button>
                    <button className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-md"><User size={18} /></button>
                    <button className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-md"><MoreVertical size={18} /></button>
                </div>
                <button onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-full"><X size={18}/></button>
            </header>
            <main className="p-4 space-y-3">
                <h3 className="font-bold text-lg text-slate-800">{appointment.client?.nome || 'Horário Bloqueado'}</h3>
                
                <div className="flex items-start gap-3 text-sm text-slate-600">
                    <Calendar size={16} className="mt-0.5 text-slate-400" />
                    <div>
                        {format(appointment.start, "EEEE, dd 'de' MMMM", { locale: pt })}
                        <br/>
                        {format(appointment.start, "HH:mm")} até {format(appointment.end, "HH:mm")}
                    </div>
                </div>

                <div className="flex items-start gap-3 text-sm text-slate-600">
                    <Tag size={16} className="mt-0.5 text-slate-400" />
                    <span>{appointment.service.name}</span>
                </div>
                
                 <div className="flex items-start gap-3 text-sm text-slate-600">
                    <DollarSign size={16} className="mt-0.5 text-slate-400" />
                    <span className="font-semibold">R$ {appointment.service.price.toFixed(2)}</span>
                </div>

                <div className="border-t my-2"></div>
                
                <button
                    ref={statusRef}
                    onClick={() => setIsStatusPopoverOpen(true)}
                    className="w-full flex items-start gap-3 text-sm text-slate-600 hover:bg-slate-50 p-2 rounded-md"
                >
                    <Calendar size={16} className="mt-0.5 text-slate-400" />
                    <span>{statusLabels[appointment.status]}</span>
                </button>
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
    </>
  );
};

export default AppointmentDetailPopover;

import React, { useRef, useEffect, useState } from 'react';
import { LegacyAppointment, AppointmentStatus } from '../../types';
import { Calendar, ThumbsUp, UserCheck, Smile, CheckCheck, Frown, XCircle, Check, MessageCircle, Clock } from 'lucide-react';

interface StatusUpdatePopoverProps {
  appointment: LegacyAppointment;
  targetElement: HTMLElement | null;
  onClose: () => void;
  onUpdateStatus: (appointmentId: number, newStatus: AppointmentStatus) => void;
}

const statusOptions: { key: AppointmentStatus; label: string; icon: React.ReactNode }[] = [
    { key: 'agendado', label: 'Horário Marcado', icon: <Calendar size={18} className="text-blue-500" /> },
    { key: 'confirmado_whatsapp', label: 'Confirmado via WhatsApp', icon: <MessageCircle size={18} className="text-teal-500" /> },
    { key: 'confirmado', label: 'Confirmado Manualmente', icon: <ThumbsUp size={18} className="text-cyan-500" /> },
    { key: 'em_espera', label: 'Em Espera / Lista', icon: <Clock size={18} className="text-stone-500" /> },
    { key: 'chegou', label: 'Cliente Chegou', icon: <UserCheck size={18} className="text-purple-500" /> },
    { key: 'em_atendimento', label: 'Em Atendimento', icon: <Smile size={18} className="text-indigo-500" /> },
    { key: 'concluido', label: 'Concluído', icon: <CheckCheck size={18} className="text-green-500" /> },
    { key: 'faltou', label: 'Cliente Faltou', icon: <Frown size={18} className="text-orange-500" /> },
    { key: 'cancelado', label: 'Cancelado', icon: <XCircle size={18} className="text-rose-500" /> },
];

const StatusUpdatePopover: React.FC<StatusUpdatePopoverProps> = ({
  appointment,
  targetElement,
  onClose,
  onUpdateStatus,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

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
        const viewportHeight = window.innerHeight;

        let top = targetRect.bottom + 8;
        let left = targetRect.left + targetRect.width / 2 - popoverRect.width / 2;

        // Adjust if it overflows the bottom
        if (top + popoverRect.height > viewportHeight) {
            top = targetRect.top - popoverRect.height - 8;
        }

        // Adjust if it overflows right
        if (left + popoverRect.width > viewportWidth) {
            left = viewportWidth - popoverRect.width - 16;
        }
        
        // Adjust if it overflows left
        if (left < 0) {
            left = 16;
        }
        
        setPosition({ top, left });
    };

    // Delay positioning to allow the popover to render and get its dimensions
    requestAnimationFrame(handlePositioning);

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resize', onClose);
    window.addEventListener('scroll', onClose, true); // Listen on capture phase for parent scroll

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', onClose);
      window.removeEventListener('scroll', onClose, true);
    };
  }, [onClose, targetElement]);

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-2 animate-in fade-in zoom-in-95 duration-100"
      style={{ top: position.top, left: position.left }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="text-xs text-slate-500 px-3 py-2 font-bold uppercase tracking-wider border-b mb-1">Alterar status para:</div>
      <ul className="max-h-64 overflow-y-auto">
        {statusOptions.map(({ key, label, icon }) => (
          <li key={key}>
            <button
              onClick={() => onUpdateStatus(appointment.id, key)}
              className={`w-full flex items-center justify-between px-3 py-2.5 text-sm rounded-lg transition-colors mb-1 ${appointment.status === key ? 'bg-slate-100 font-semibold text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <div className="flex items-center gap-3">
                {icon}
                <span>{label}</span>
              </div>
              {appointment.status === key && <Check size={16} className="text-slate-800" />}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default StatusUpdatePopover;
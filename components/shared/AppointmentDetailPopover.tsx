
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
  // FIX: Updated id type to string | number
  onDelete: (id: string | number) => void;
  // FIX: Updated appointmentId type to string | number
  onUpdateStatus: (appointmentId: string | number, newStatus: AppointmentStatus) => void;
  onConvertToCommand?: (appointment: LegacyAppointment) => void;
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
  onConvertToCommand
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
        const viewportHeight = window.innerHeight;
        
        const SAFE_ZONE_TOP = 112; 
        
        let top = targetRect.top + (targetRect.height / 2) - (popoverRect.height / 2);
        let left = targetRect.right + 12;

        if (left + popoverRect.width > viewportWidth) {
            left = targetRect.left - popoverRect.width - 12;
        }
        
        if (top < SAFE_ZONE_TOP) {
            top = SAFE_ZONE_TOP;
        }

        if (top + popoverRect.height > viewportHeight - 16) {
            top = viewportHeight - popoverRect.height - 16;
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

  // FIX: Updated id type to string | number
  const handleStatusUpdateWrapper = (id: string | number, status: AppointmentStatus) => {
    onUpdateStatus(id, status);
    setIsStatusPopoverOpen(false);
    onClose();
  };

  const isFinished = ['concluido', 'cancelado', 'bloqueado'].includes(appointment.status);
  const canCheckout = !isFinished;
  
  const isLockedForDelete = ['concluido', 'bloqueado'].includes(appointment.status?.toLowerCase());

  // --- NOVO HANDLER DE FINALIZAÇÃO ---
  const handleFinalize = () => {
      if (onConvertToCommand) {
          onConvertToCommand(appointment);
      } else {
          // Fallback para o modal antigo caso a função não seja passada
          setIsCheckoutOpen(true);
      }
  };

  return (
    <>
        <div
            ref={popoverRef}
            className={`fixed z-[100] w-80 bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-slate-200 flex flex-col transition-all duration-200 ${isCheckoutOpen ? 'opacity-0 pointer-events-none scale-95' : 'scale-100'}`}
            style={{ top: position.top, left: position.left, opacity: isCheckoutOpen ? 0 : position.opacity }}
            onClick={(e) => e.stopPropagation()}
        >
            <header className="flex items-center p-3 border-b border-slate-100 bg-slate-50/50">
                <div className="flex-1 flex items-center gap-1.5">
                    <button 
                        onClick={() => { onEdit(appointment); onClose(); }} 
                        className="p-2 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors" 
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

                    <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors" title="Ver Perfil"><User size={18} /></button>
                </div>
                <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"><X size={18}/></button>
            </header>
            
            <main className="p-6 space-y-4">
                <div>
                    <h3 className="font-black text-xl text-slate-800 leading-tight">{appointment.client?.nome || 'Horário Bloqueado'}</h3>
                    <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest mt-1">{appointment.service.name}</p>
                </div>
                
                <div className="space-y-3 pt-2">
                    <div className="flex items-start gap-3 text-xs font-bold text-slate-600">
                        <div className="p-2 bg-slate-50 rounded-lg"><Calendar size={14} className="text-slate-400" /></div>
                        <div>
                            <span className="capitalize">{format(appointment.start, "EEEE, dd 'de' MMMM", { locale: pt })}</span>
                            <br/>
                            <span className="text-slate-400">{format(appointment.start, "HH:mm")} às {format(appointment.end, "HH:mm")}</span>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3 text-xs font-bold text-slate-600">
                        <div className="p-2 bg-emerald-50 rounded-lg"><DollarSign size={14} className="text-emerald-500" /></div>
                        <span className="text-emerald-600 font-black text-lg">R$ {appointment.service.price.toFixed(2)}</span>
                    </div>
                </div>

                <div className="border-t border-slate-100 pt-5 flex flex-col gap-3">
                    <div className="mb-1">
                        <button
                            ref={statusRef}
                            onClick={() => setIsStatusPopoverOpen(true)}
                            className="w-full flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-500 bg-slate-50 hover:bg-slate-100 p-4 rounded-2xl transition-all border border-slate-100"
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
                            onClick={handleFinalize}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-[0.1em] py-5 rounded-[24px] shadow-xl shadow-emerald-100 transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                            <Receipt size={18} />
                            Finalizar Atendimento
                        </button>
                    )}

                    {appointment.status === 'concluido' && (
                        <div className="flex items-center justify-center gap-2 py-4 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-100">
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
                    price: appointment.service.price,
                    professional_id: appointment.professional.id,
                    professional_name: appointment.professional.name
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

import React, { useRef, useEffect, useState } from 'react';
import { LegacyAppointment, AppointmentStatus } from '../../types';
import { 
    Calendar, DollarSign, Edit, Trash2, 
    User, MoreVertical, X, CheckCircle2, Receipt, MessageCircle, AlignLeft
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR as pt } from 'date-fns/locale/pt-BR';
import StatusUpdatePopover from './StatusUpdatePopover';
import CheckoutModal from '../modals/CheckoutModal';
import { supabase } from '../../services/supabaseClient';
import { useStudio } from '../../contexts/StudioContext';

interface AppointmentDetailPopoverProps {
  appointment: LegacyAppointment;
  targetElement: HTMLElement | null;
  onClose: () => void;
  onEdit: (appointment: LegacyAppointment) => void;
  onDelete: (id: number) => void;
  onUpdateStatus: (appointmentId: number, newStatus: AppointmentStatus) => void;
  onConvertToCommand?: (appointment: LegacyAppointment, sameDayApptIds?: number[]) => void;
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
  const [statusTarget, setStatusTarget] = useState<HTMLElement | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [clientPhone, setClientPhone] = useState<string | null>(null);
  const [sameDayAppointments, setSameDayAppointments] = useState<any[]>([]);
  const [sendAllTogether, setSendAllTogether] = useState<boolean>(true);

  const { activeStudioId } = useStudio();
  const [reminderTemplate, setReminderTemplate] = useState<string | null>(null);
  const [studioName, setStudioName] = useState<string>('Studio Jacilene Félix');

  useEffect(() => {
    const fetchStudioSettings = async () => {
      if (!activeStudioId) return;
      try {
        const { data } = await supabase
          .from('business_settings')
          .select('*')
          .eq('studio_id', activeStudioId)
          .maybeSingle();
        if (data) {
          if (data.whatsapp_reminder_template) {
            setReminderTemplate(data.whatsapp_reminder_template);
          }
          if (data.business_name) {
            setStudioName(data.business_name);
          }
        }
      } catch (e) {
        // silencioso
      }
    };
    fetchStudioSettings();
  }, [activeStudioId]);

  useEffect(() => {
    const fetchClientPhone = async () => {
      if (!appointment.client?.id) return;
      try {
        const { data } = await supabase
          .from('clients')
          .select('whatsapp, telefone')
          .eq('id', appointment.client.id)
          .maybeSingle();
        if (data) {
          setClientPhone(data.whatsapp || data.telefone || null);
        }
      } catch (e) {
        // silencioso
      }
    };
    fetchClientPhone();
  }, [appointment.client?.id]);

  useEffect(() => {
    const fetchSameDayAppointments = async () => {
      const clientId = appointment.client?.id;
      const clientName = appointment.client_name || appointment.client?.nome;
      if ((!clientId && !clientName) || !activeStudioId) return;
      
      try {
        const appointmentDate = new Date(appointment.start);
        const startOfDay = new Date(appointmentDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(appointmentDate);
        endOfDay.setHours(23, 59, 59, 999);

        let query = supabase
          .from('appointments')
          .select('id, date, service_name, professional_name, status, value')
          .eq('studio_id', activeStudioId)
          .gte('date', startOfDay.toISOString())
          .lte('date', endOfDay.toISOString())
          .neq('status', 'cancelado');

        if (clientId) {
          query = query.eq('client_id', clientId);
        } else if (clientName) {
          query = query.eq('client_name', clientName);
        } else {
          return;
        }

        const { data, error } = await query;
        if (data && data.length > 1) {
          const sorted = data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          setSameDayAppointments(sorted);
        } else {
          setSameDayAppointments([]);
        }
      } catch (e) {
        console.error("Erro ao buscar agendamentos do mesmo dia:", e);
      }
    };
    fetchSameDayAppointments();
  }, [appointment.client?.id, appointment.client_name, appointment.start, activeStudioId]);

  const handleSendWhatsAppReminder = () => {
    if (!clientPhone) return;
    const cleanPhone = clientPhone.replace(/\D/g, '');
    const clientName = appointment.client?.nome || appointment.client_name || 'Cliente';
    
    let serviceName: string;
    let timeStr: string;
    let profName: string;

    if (sameDayAppointments.length > 1 && sendAllTogether) {
      // Formata a lista agrupando todos os procedimentos de forma elegante
      serviceName = '\n' + sameDayAppointments.map((app, idx) => {
        const t = format(new Date(app.date), "HH:mm");
        const prof = app.professional_name ? ` (com ${app.professional_name})` : '';
        return `${idx + 1}. *${app.service_name}* às *${t}*${prof}`;
      }).join('\n');

      const firstAppt = sameDayAppointments[0];
      timeStr = `A partir das ${format(new Date(firstAppt.date), "HH:mm")} (Múltiplos procedimentos)`;
      profName = '';
    } else {
      serviceName = appointment.services && appointment.services.length > 0
        ? appointment.services.map(s => s.name).join(' + ')
        : appointment.service?.name || appointment.service_name || 'Procedimento';
      timeStr = format(appointment.start, "HH:mm");
      profName = appointment.professional?.name || appointment.professional_name || '';
    }

    const dateStr = format(appointment.start, "EEEE, dd/MM", { locale: pt });
    const fallbackLink = `${window.location.origin}/#/public-preview?sid=${activeStudioId}&apid=${appointment.id}`;

    const template = reminderTemplate || 
      'Olá, {cliente}! 😊\n\n' +
      'Passando para confirmar seu horário no *{empresa}*:\n\n' +
      '📅 *{data}*\n' +
      '⏰ *{horario}*\n' +
      '✂️ *{servico}*\n' +
      (profName ? '👩🎨 Com: *{profissional}*\n' : '') +
      '\nPor favor, confirme sua presença clicando no link abaixo: 👇\n' +
      '{link_confirmacao}\n\n' +
      '⚠️ Caso precise cancelar ou reagendar, avise com pelo menos 24h de antecedência.\n\n' +
      'Te esperamos! 💜\n' +
      '*{empresa}*';

    const finalMessage = template
      .replace(/{cliente}/g, clientName)
      .replace(/{servico}/g, serviceName)
      .replace(/{profissional}/g, profName)
      .replace(/{data}/g, dateStr)
      .replace(/{horario}/g, timeStr)
      .replace(/{link_confirmacao}/g, fallbackLink)
      .replace(/{empresa}/g, studioName);

    const logReminder = async () => {
      if (!activeStudioId) return;
      try {
        await supabase.from('whatsapp_reminders_log').insert([{
          studio_id: activeStudioId,
          appointment_id: appointment.id,
          client_name: clientName,
          phone: cleanPhone,
          sender: 'Jaci IA'
        }]);
      } catch (err) {
        console.error("Erro ao registrar envio do lembrete:", err);
      }
    };
    logReminder();

    window.open(`https://wa.me/55${cleanPhone}?text=${encodeURIComponent(finalMessage)}`, '_blank');
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (popoverRef.current && !popoverRef.current.contains(target)) {
        // Ignora se estiver clicando dentro do popover de alteração de status
        const isStatusClick = document.querySelector('.status-update-popover')?.contains(target);
        if (isStatusClick) return;

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
      if (left + popoverRect.width > viewportWidth) left = targetRect.left - popoverRect.width - 12;
      if (top < SAFE_ZONE_TOP) top = SAFE_ZONE_TOP;
      if (top + popoverRect.height > viewportHeight - 16) top = viewportHeight - popoverRect.height - 16;
      if (left < 16) left = 16;
      setPosition({ top, left, opacity: 1 });
    };

    const timer = setTimeout(handlePositioning, 0);
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resize', handlePositioning);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', handlePositioning);
    };
  }, [onClose, targetElement, isCheckoutOpen]);

  const handleStatusUpdateWrapper = (id: number, status: AppointmentStatus) => {
    onUpdateStatus(id, status);
    setIsStatusPopoverOpen(false);
    onClose();
  };

  const handleOpenStatus = () => {
    setStatusTarget(statusRef.current);
    setIsStatusPopoverOpen(true);
  };

  const isFinished = ['concluido', 'cancelado', 'bloqueado'].includes(appointment.status);
  const canCheckout = !isFinished;

  const handleFinalize = () => {
    if (onConvertToCommand) {
      onConvertToCommand(appointment);
    } else {
      setIsCheckoutOpen(true);
    }
  };

  return (
    <>
      <div
        ref={popoverRef}
        className={`fixed z-[100] w-80 max-h-[calc(100vh-140px)] bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-slate-200 flex flex-col transition-all duration-200 ${isCheckoutOpen ? 'opacity-0 pointer-events-none scale-95' : 'scale-100'}`}
        style={{ top: position.top, left: position.left, opacity: isCheckoutOpen ? 0 : position.opacity }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center p-3 border-b border-slate-100 bg-slate-50/50 flex-shrink-0">
          <div className="flex-1 flex items-center gap-1.5">
            <button
              onClick={() => { onEdit(appointment); onClose(); }}
              className="p-2 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
              title="Editar"
            >
              <Edit size={18} />
            </button>
            <button
              onClick={() => onDelete(appointment.id)}
              className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
              title="Excluir"
            >
              <Trash2 size={18} />
            </button>
            <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors" title="Ver Perfil">
              <User size={18} />
            </button>
            {clientPhone && !isFinished && (
              <button
                onClick={handleSendWhatsAppReminder}
                className="p-2 text-white bg-green-500 hover:bg-green-600 rounded-xl transition-all shadow-sm shadow-green-200 ml-1"
                title="Enviar Lembrete via WhatsApp"
              >
                <MessageCircle size={18} />
              </button>
            )}
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors">
            <X size={18} />
          </button>
        </header>

        <main className="p-6 space-y-4 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
          <div>
            <h3 className="font-black text-xl text-slate-800 leading-tight flex flex-col gap-1">
              <span>{appointment.type === 'block' ? (appointment.notas || 'Bloqueio de Horário') : (appointment.client?.nome || 'Horário Bloqueado')}</span>
              {appointment.client?.apelido && appointment.type !== 'block' && (
                <span className="text-xs font-black text-orange-600 bg-orange-50 border border-orange-100 rounded-lg px-2 py-0.5 w-fit uppercase tracking-tight">
                  "{appointment.client.apelido}"
                </span>
              )}
            </h3>
            {appointment.type === 'block' ? (
              <p className="text-[10px] font-black text-rose-500 bg-rose-50 border border-rose-100 rounded-lg px-2.5 py-1 w-fit uppercase tracking-wider mt-2">
                BLOQUEADO / INDISPONÍVEL
              </p>
            ) : appointment.services && appointment.services.length > 0 ? (
              <div className="mt-3 space-y-2 max-h-36 overflow-y-auto pr-1">
                <p className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">Procedimentos Marcados:</p>
                {appointment.services.map((s, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-slate-50 border border-slate-100 p-2.5 rounded-2xl shadow-sm">
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-bold text-slate-700 truncate leading-tight">{s.name}</p>
                      <p className="text-[9px] text-slate-400 font-semibold mt-0.5">{s.duration} min</p>
                    </div>
                    <span className="text-xs font-black text-slate-600 flex-shrink-0 bg-slate-100 px-2 py-1 rounded-lg">
                      R$ {Number(s.price).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest mt-1">{appointment.service.name}</p>
            )}
          </div>

          {sameDayAppointments.length > 1 && (
            <div className="bg-orange-50/70 border border-orange-100 rounded-[20px] p-3 space-y-2 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-orange-850">
                <MessageCircle size={14} className="text-orange-600 flex-shrink-0" />
                <span>Múltiplos horários hoje!</span>
              </div>
              <p className="text-[10px] text-slate-500 font-semibold leading-tight0">
                Esse cliente possui <b>{sameDayAppointments.length} agendamentos</b> no mesmo dia. Como prefere enviar o lembrete?
              </p>
              <div className="flex gap-2 pt-1 text-center">
                <button 
                  type="button"
                  onClick={() => setSendAllTogether(true)}
                  className={`flex-1 py-1.5 px-2 rounded-xl text-[9px] font-black uppercase tracking-tight transition-all border ${
                    sendAllTogether 
                      ? 'bg-orange-500 text-white border-orange-600 shadow-sm shadow-orange-100' 
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Tudo Junto ✅
                </button>
                <button 
                  type="button"
                  onClick={() => setSendAllTogether(false)}
                  className={`flex-1 py-1.5 px-2 rounded-xl text-[9px] font-black uppercase tracking-tight transition-all border ${
                    !sendAllTogether 
                      ? 'bg-orange-500 text-white border-orange-600 shadow-sm shadow-orange-100' 
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Separado 📲
                </button>
              </div>
            </div>
          )}

          <div className="space-y-3 pt-2">
            <div className="flex items-start gap-3 text-xs font-bold text-slate-600">
              <div className="p-2 bg-slate-50 rounded-lg"><Calendar size={14} className="text-slate-400" /></div>
              <div>
                <span className="capitalize">{format(appointment.start, "EEEE, dd 'de' MMMM", { locale: pt })}</span>
                <br />
                <span className="text-slate-400">{format(appointment.start, "HH:mm")} às {format(appointment.end, "HH:mm")}</span>
              </div>
            </div>
            {appointment.type !== 'block' && (
              <div className="flex items-center gap-3 text-xs font-bold text-slate-600">
                <div className="p-2 bg-emerald-50 rounded-lg"><DollarSign size={14} className="text-emerald-500" /></div>
                <div>
                  <p className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider leading-none mb-0.5">Valor Total</p>
                  <span className="text-emerald-600 font-black text-lg">R$ {appointment.service.price.toFixed(2)}</span>
                </div>
              </div>
            )}
            {appointment.notas ? (
              <div className="flex items-start gap-3 text-xs font-bold text-slate-600">
                <div className="p-2 bg-rose-50 rounded-lg"><AlignLeft size={14} className="text-rose-500" /></div>
                <div>
                  <p className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider leading-none mb-1">
                    {appointment.type === 'block' ? 'Motivo do Bloqueio' : 'Observações'}
                  </p>
                  <span className="text-slate-700 font-medium whitespace-pre-wrap">{appointment.notas}</span>
                </div>
              </div>
            ) : appointment.type === 'block' ? (
              <div className="flex items-start gap-3 text-xs font-bold text-slate-600">
                <div className="p-2 bg-rose-50 rounded-lg"><AlignLeft size={14} className="text-rose-500" /></div>
                <div>
                  <p className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider leading-none mb-1">Motivo do Bloqueio</p>
                  <span className="text-slate-400 italic font-medium">Sem detalhes informados</span>
                </div>
              </div>
            ) : null}
          </div>

          <div className="border-t border-slate-100 pt-5 flex flex-col gap-3">
            <div className="mb-1">
              <button
                ref={statusRef}
                onClick={handleOpenStatus}
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
              sameDayAppointments.filter(app => !['concluido', 'cancelado', 'bloqueado'].includes(app.status)).length > 1 ? (
                <div className="flex flex-col gap-2 bg-amber-50/50 border border-amber-200 p-3.5 rounded-[24px]">
                  <p className="text-[10px] font-bold text-amber-800 text-center uppercase tracking-wider mb-1">
                    Múltiplos agendamentos pendentes hoje!
                  </p>
                  <button
                    onClick={() => {
                      const pending = sameDayAppointments.filter(app => !['concluido', 'cancelado', 'bloqueado'].includes(app.status));
                      const ids = pending.map(app => app.id);
                      if (onConvertToCommand) {
                        onConvertToCommand(appointment, ids);
                      } else {
                        setIsCheckoutOpen(true);
                      }
                    }}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white font-black text-xs uppercase tracking-[0.05em] py-4 rounded-[20px] shadow-md shadow-amber-100 transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Receipt size={16} />
                    Finalizar Todos Juntos (R$ {sameDayAppointments.filter(app => !['concluido', 'cancelado', 'bloqueado'].includes(app.status)).reduce((sum, item) => sum + Number(item.value || 0), 0).toFixed(2)})
                  </button>
                  <button
                    onClick={handleFinalize}
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] uppercase tracking-[0.05em] py-2.5 rounded-[16px] transition-all active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    Finalizar Apenas Este
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleFinalize}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-[0.1em] py-5 rounded-[24px] shadow-xl shadow-emerald-100 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <Receipt size={18} />
                  Finalizar Atendimento
                </button>
              )
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
          targetElement={statusTarget}
          onClose={() => setIsStatusPopoverOpen(false)}
          onUpdateStatus={handleStatusUpdateWrapper}
        />
      )}

      {isCheckoutOpen && (
        <CheckoutModal
          isOpen={isCheckoutOpen}
          onClose={() => setIsCheckoutOpen(false)}
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

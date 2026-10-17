import React, { useRef, useEffect, useState } from 'react';
import { LegacyAppointment, AppointmentStatus } from '../../types';
import { 
    Calendar, DollarSign, Edit, Trash2, 
    User, MoreVertical, X, CheckCircle2, Receipt, MessageCircle, AlignLeft, CheckCheck, Loader2,
    Split, ChevronDown, RotateCcw
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { ptBR as pt } from 'date-fns/locale/pt-BR';
import StatusUpdatePopover from './StatusUpdatePopover';
import CheckoutModal from '../modals/CheckoutModal';
import { supabase } from '../../services/supabaseClient';
import { useStudio } from '../../contexts/StudioContext';
import { isPartnerOr100Discount, getEffectiveAppointmentValue } from '../../utils/commissionRules';

interface AppointmentDetailPopoverProps {
  appointment: LegacyAppointment;
  targetElement: HTMLElement | null;
  onClose: () => void;
  onEdit: (appointment: LegacyAppointment) => void;
  onDelete: (id: number) => void;
  onUpdateStatus: (appointmentId: number, newStatus: AppointmentStatus) => void;
  onConvertToCommand?: (appointment: LegacyAppointment, sameDayApptIds?: number[]) => void;
  onSendReminder?: (appointmentId: number) => void;
  onRefresh?: () => void;
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
  onConvertToCommand,
  onSendReminder,
  onRefresh
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0, maxHeight: 'calc(100vh - 24px)', opacity: 0 });
  const [isStatusPopoverOpen, setIsStatusPopoverOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<HTMLElement | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [checkoutInitialMode, setCheckoutInitialMode] = useState<'full' | 'partial'>('full');
  const [paymentsHistory, setPaymentsHistory] = useState<any[]>(appointment.payments || []);
  const [showPaymentsBreakdown, setShowPaymentsBreakdown] = useState<boolean>(false);
  const [clientPhone, setClientPhone] = useState<string | null>(null);
  const [sameDayAppointments, setSameDayAppointments] = useState<any[]>([]);
  const [sendAllTogether, setSendAllTogether] = useState<boolean>(true);
  const [isReminderSent, setIsReminderSent] = useState<boolean>(!!appointment.reminder_sent);
  const [prevId, setPrevId] = useState<number>(appointment.id);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  if (appointment.id !== prevId) {
    setPrevId(appointment.id);
    setIsReminderSent(!!appointment.reminder_sent);
    setPaymentsHistory(appointment.payments || []);
  }

  const { activeStudioId } = useStudio();
  const [reminderTemplate, setReminderTemplate] = useState<string | null>(null);
  const [studioName, setStudioName] = useState<string>('Studio Jacilene Félix');
  const [studioSettings, setStudioSettings] = useState<any>(null);

  useEffect(() => {
    const fetchPayments = async () => {
      if (!appointment.id) return;
      try {
        const { data: trans } = await supabase
          .from('financial_transactions')
          .select('id, date, amount, payment_method, description, net_value, created_at')
          .eq('appointment_id', appointment.id)
          .neq('status', 'cancelado')
          .order('date', { ascending: true });

        if (trans && trans.length > 0) {
          setPaymentsHistory(trans.map((t: any) => ({
            id: t.id,
            date: t.date || t.created_at,
            amount: Number(t.amount || 0),
            method: t.payment_method || 'pix',
            notes: t.description || 'Pagamento',
            net_value: Number(t.net_value || t.amount || 0)
          })));
        } else if (appointment.payments && appointment.payments.length > 0) {
          setPaymentsHistory(appointment.payments);
        } else if (appointment.notas) {
          const payMatch = appointment.notas.match(/---PAYMENTS_JSON---[\r\n\s]*([\s\S]*?)[\r\n\s]*---END_PAYMENTS_JSON---/);
          if (payMatch) {
            try {
              setPaymentsHistory(JSON.parse(payMatch[1]));
            } catch (_e) {
              console.warn("Falha ao analisar JSON de pagamentos:", _e);
            }
          }
        }
      } catch (err) {
        console.error("Erro ao buscar histórico de pagamentos do agendamento:", err);
      }
    };
    fetchPayments();
  }, [appointment.id, appointment.payments, appointment.notas]);

  useEffect(() => {
    const fetchStudioSettings = async () => {
      if (!activeStudioId) return;
      try {
        const { data } = await supabase
          .from('business_settings')
          .select('*')
          .eq('studio_id', activeStudioId)
          .maybeSingle();

        // Tenta carregar as configurações locais de lembretes e WhatsApp
        let localReminders: any = {};
        try {
          const localStr = window.safeLocalStorage?.getItem(`business_reminders_settings_${activeStudioId}`);
          if (localStr) {
            localReminders = JSON.parse(localStr);
          }
        } catch (localErr) {
          console.warn("Erro ao carregar configurações locais de lembrete:", localErr);
        }

        let localMeta: any = {};
        try {
          const localStr = window.safeLocalStorage?.getItem(`meta_whatsapp_settings_${activeStudioId}`);
          if (localStr) {
            localMeta = JSON.parse(localStr);
          }
        } catch (localErr) {
          console.warn("Erro ao carregar configurações locais de Meta:", localErr);
        }

        const mergedSettings = { ...localMeta, ...localReminders, ...data };

        setStudioSettings(mergedSettings);

        if (mergedSettings.whatsapp_reminder_template) {
          setReminderTemplate(mergedSettings.whatsapp_reminder_template);
        }
        if (mergedSettings.business_name) {
          setStudioName(mergedSettings.business_name);
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

  const handleSendWhatsAppReminder = async () => {
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

    // 1. Verifica se a API Oficial da Meta está ativa
    const tokenClean = studioSettings?.meta_whatsapp_token?.trim();
    const phoneIdClean = studioSettings?.meta_whatsapp_phone_number_id?.trim();
    const templateNameClean = studioSettings?.meta_whatsapp_template_name?.trim();
    const isMetaActive = studioSettings?.meta_whatsapp_active && !!tokenClean && !!phoneIdClean;

    if (isMetaActive) {
      setIsProcessing(true);
      const loadingToastId = toast.loading("Enviando lembrete automático via API Oficial da Meta...");
      try {
        let recipientPhone = cleanPhone;
        if (recipientPhone.length === 10 || recipientPhone.length === 11) {
          recipientPhone = '55' + recipientPhone;
        }

        const url = `https://graph.facebook.com/v21.0/${phoneIdClean}/messages`;

        const hasTemplate = !!templateNameClean;

        const customParamsStr = studioSettings?.meta_whatsapp_template_params;
        let finalParameters = [
          { type: "text", text: clientName },
          { type: "text", text: serviceName },
          { type: "text", text: profName || 'Profissional' },
          { type: "text", text: dateStr },
          { type: "text", text: timeStr },
          { type: "text", text: fallbackLink }
        ];

        if (customParamsStr) {
          const expectedCount = customParamsStr.split(',').map((x: string) => x.trim()).filter(Boolean).length;
          if (expectedCount > 0 && expectedCount < 6) {
            finalParameters = finalParameters.slice(0, expectedCount);
          }
        }

        const body = hasTemplate ? {
          messaging_product: "whatsapp",
          to: recipientPhone,
          type: "template",
          template: {
            name: templateNameClean,
            language: {
              code: studioSettings.meta_whatsapp_language || 'pt_BR'
            },
            components: [
              {
                type: "body",
                parameters: finalParameters
              }
            ]
          }
        } : {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: recipientPhone,
          type: "text",
          text: {
            preview_url: false,
            body: `Olá, ${clientName}! Passando para lembrar do seu agendamento de ${serviceName} com ${profName || 'nosso estúdio'} no dia ${dateStr} às ${timeStr}. Confirme clicando em: ${fallbackLink}`
          }
        };

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${tokenClean}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        });

        const resData = await response.json();
        if (!response.ok) {
          let errMsg = resData?.error?.message || "Erro desconhecido na API da Meta.";
          const errCode = resData?.error?.code;
          if (errCode === 132001 || errMsg.includes("132001") || errMsg.includes("does not exist in the translation")) {
            errMsg = `Erro (#132001): O modelo '${templateNameClean}' não pôde ser disparado. Certifique-se de que o nome está idêntico e o idioma '${studioSettings.meta_whatsapp_language || 'pt_BR'}' é o mesmo cadastrado no Meta. Além disso, verifique se o seu modelo possui exatamente ${finalParameters.length} variáveis cadastradas no Facebook. (Retorno original da Meta: ${resData?.error?.message || errMsg})`;
          }
          throw new Error(errMsg);
        }

        // Se deu tudo certo!
        toast.success("Lembrete automático enviado via API Oficial!", { id: loadingToastId });
        
        setIsReminderSent(true);
        if (onSendReminder) {
          onSendReminder(appointment.id);
        }

        // Atualiza banco de dados de forma segura
        try {
          await supabase.from('appointments').update({ reminder_sent: true }).eq('id', appointment.id);
        } catch (dbErr) {
          console.error("Erro ao atualizar status de reminder_sent no agendamento:", dbErr);
        }

        try {
          await supabase.from('whatsapp_reminders_log').insert([{
            studio_id: activeStudioId,
            appointment_id: appointment.id,
            client_name: clientName,
            phone: recipientPhone,
            sender: 'API Oficial Meta'
          }]);
        } catch (logErr) {
          console.error("Erro ao registrar log do lembrete:", logErr);
        }

        setIsProcessing(false);
        return; // Sai da função com sucesso!

      } catch (err: any) {
        console.error("Erro ao enviar por Meta Cloud API. Usando fallback para WhatsApp Web...", err);
        toast.error(`Falha na API da Meta: ${err.message}. Abrindo envio manual...`, { id: loadingToastId, duration: 4000 });
        // O código continua abaixo para abrir o WhatsApp Web como fallback!
      } finally {
        setIsProcessing(false);
      }
    }

    // --- FALLBACK / DISPARO MANUAL ORIGINAL ---
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
      setIsReminderSent(true);
      if (onSendReminder) {
        onSendReminder(appointment.id);
      }
      
      if (!activeStudioId) return;
      try {
        await supabase.from('appointments').update({ reminder_sent: true }).eq('id', appointment.id);
        
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
    const updatePosition = () => {
      if (!targetElement || !popoverRef.current) return;
      const targetRect = targetElement.getBoundingClientRect();
      const popoverEl = popoverRef.current;
      const popoverRect = popoverEl.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      const MARGIN = 12;
      const maxAvailableHeight = Math.max(200, viewportHeight - (MARGIN * 2));

      // 1. Calculate top: center vertically relative to the targetElement
      let top = targetRect.top + (targetRect.height / 2) - (popoverRect.height / 2);

      // Clamp vertical position strictly within screen margins
      if (top + popoverRect.height > viewportHeight - MARGIN) {
        top = viewportHeight - popoverRect.height - MARGIN;
      }
      if (top < MARGIN) {
        top = MARGIN;
      }

      // 2. Calculate left
      const popoverWidth = popoverRect.width || 390;
      let left = targetRect.right + 12;

      // On mobile or narrow screen, center horizontally
      if (viewportWidth < 640 || popoverWidth >= viewportWidth - (MARGIN * 2)) {
        left = Math.max(MARGIN, (viewportWidth - popoverWidth) / 2);
      } else {
        // If overflowing on the right, position to the left of target
        if (left + popoverWidth > viewportWidth - MARGIN) {
          left = targetRect.left - popoverWidth - 12;
        }
        // If still overflowing on the left, clamp within safe boundaries
        if (left < MARGIN) {
          left = Math.max(MARGIN, Math.min(viewportWidth - popoverWidth - MARGIN, (viewportWidth - popoverWidth) / 2));
        }
      }

      setPosition({
        top: Math.round(top),
        left: Math.round(left),
        maxHeight: `${maxAvailableHeight}px`,
        opacity: 1
      });
    };

    updatePosition();
    const frameId = requestAnimationFrame(updatePosition);

    let resizeObserver: ResizeObserver | null = null;
    if (popoverRef.current && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        updatePosition();
      });
      resizeObserver.observe(popoverRef.current);
    }

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (popoverRef.current && !popoverRef.current.contains(target)) {
        const isStatusClick = document.querySelector('.status-update-popover')?.contains(target);
        if (isStatusClick) return;
        if (!isCheckoutOpen) onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      cancelAnimationFrame(frameId);
      if (resizeObserver) resizeObserver.disconnect();
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [onClose, targetElement, isCheckoutOpen, sameDayAppointments.length]);

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

  const pendingSameDay = sameDayAppointments.filter(app => !['concluido', 'cancelado', 'bloqueado'].includes(app.status));
  const pendingTotalValue = pendingSameDay.reduce((sum, item) => sum + Number(item.service?.price ?? item.value ?? 0), 0);

  const isPartner = isPartnerOr100Discount(appointment);
  const rawTotal = appointment.value !== undefined && appointment.value !== null
    ? Number(appointment.value)
    : (appointment.service?.price !== undefined && appointment.service.price !== null ? Number(appointment.service.price) : 0);

  const servicesSum = appointment.services && appointment.services.length > 0
    ? appointment.services.reduce((sum, s) => sum + Number(s.price || 0), 0)
    : rawTotal;

  const appointmentTotalValue = isPartner 
    ? 0 
    : (appointment.value !== undefined && appointment.value !== null 
        ? Number(appointment.value) 
        : (rawTotal > 0 ? rawTotal : servicesSum));

  const alreadyPaidTotal = paymentsHistory.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  const remainingValue = Math.max(0, appointmentTotalValue - alreadyPaidTotal);
  const hasPartialPayments = alreadyPaidTotal > 0 && remainingValue > 0.01;

  const handleFinalizeAllTogether = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    const ids = pendingSameDay.map(app => app.id);
    if (onConvertToCommand) {
      try {
        await onConvertToCommand(appointment, ids);
      } catch (err) {
        console.error("Erro ao converter agendamentos para comanda consolidada:", err);
      } finally {
        setIsProcessing(false);
      }
    } else {
      setIsCheckoutOpen(true);
      setIsProcessing(false);
    }
  };

  const handleFinalizeSingle = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    if (onConvertToCommand) {
      try {
        await onConvertToCommand(appointment, [appointment.id]);
      } catch (err) {
        console.error("Erro ao converter para comanda:", err);
      } finally {
        setIsProcessing(false);
      }
    } else {
      setIsCheckoutOpen(true);
      setIsProcessing(false);
    }
  };

  const [isDeletingPayment, setIsDeletingPayment] = useState<boolean>(false);

  const handleEstornarPayment = async (targetPayment: any) => {
    const paymentAmount = Number(targetPayment.amount || 0);
    const confirmMsg = `Deseja realmente estornar/remover esta baixa parcial de R$ ${paymentAmount.toFixed(2)}?\n\n` +
      `Isso irá:\n` +
      `• Remover o registro desta baixa parcial do atendimento.\n` +
      `• Restaurar o saldo a pagar para o valor total.\n` +
      `• Excluir o lançamento financeiro caso ainda conste no caixa.`;

    if (!window.confirm(confirmMsg)) return;

    setIsDeletingPayment(true);
    try {
      if (targetPayment.id) {
        await supabase
          .from('financial_transactions')
          .delete()
          .eq('id', targetPayment.id);
      }

      const updatedPayments = paymentsHistory.filter(p => (p.id ? p.id !== targetPayment.id : p !== targetPayment));

      const { data: apptData } = await supabase
        .from('appointments')
        .select('notes, status')
        .eq('id', appointment.id)
        .maybeSingle();

      let currentNotes = apptData?.notes || appointment.notas || '';
      const pIdx = currentNotes.indexOf('---PAYMENTS_JSON---');
      if (pIdx !== -1) {
        const pEnd = currentNotes.indexOf('---END_PAYMENTS_JSON---');
        if (pEnd !== -1) {
          currentNotes = (currentNotes.substring(0, pIdx) + currentNotes.substring(pEnd + '---END_PAYMENTS_JSON---'.length)).trim();
        } else {
          currentNotes = currentNotes.substring(0, pIdx).trim();
        }
      }

      const paymentsMetadata = updatedPayments.length > 0
        ? `\n---PAYMENTS_JSON---\n${JSON.stringify(updatedPayments)}\n---END_PAYMENTS_JSON---`
        : '';

      const finalNotes = (currentNotes ? currentNotes + '\n' : '') + paymentsMetadata;

      const { error: updateError } = await supabase
        .from('appointments')
        .update({
          notes: finalNotes.trim(),
          status: appointment.status === 'concluido' ? 'agendado' : appointment.status
        })
        .eq('id', appointment.id);

      if (updateError) throw updateError;

      setPaymentsHistory(updatedPayments);
      toast.success(`Baixa parcial de R$ ${paymentAmount.toFixed(2)} estornada com sucesso!`);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error("Erro ao estornar pagamento:", err);
      toast.error("Erro ao estornar pagamento: " + (err.message || 'Tente novamente'));
    } finally {
      setIsDeletingPayment(false);
    }
  };

  const handleEstornarTodosPayments = async () => {
    const confirmMsg = `Deseja realmente estornar TODAS as baixas parciais deste atendimento (R$ ${alreadyPaidTotal.toFixed(2)})?\n\n` +
      `Isso irá zerar as antecipações salvas e restaurar o valor integral de R$ ${appointmentTotalValue.toFixed(2)} a pagar.`;

    if (!window.confirm(confirmMsg)) return;

    setIsDeletingPayment(true);
    try {
      await supabase
        .from('financial_transactions')
        .delete()
        .eq('appointment_id', appointment.id);

      const { data: apptData } = await supabase
        .from('appointments')
        .select('notes')
        .eq('id', appointment.id)
        .maybeSingle();

      let currentNotes = apptData?.notes || appointment.notas || '';
      const pIdx = currentNotes.indexOf('---PAYMENTS_JSON---');
      if (pIdx !== -1) {
        const pEnd = currentNotes.indexOf('---END_PAYMENTS_JSON---');
        if (pEnd !== -1) {
          currentNotes = (currentNotes.substring(0, pIdx) + currentNotes.substring(pEnd + '---END_PAYMENTS_JSON---'.length)).trim();
        } else {
          currentNotes = currentNotes.substring(0, pIdx).trim();
        }
      }

      const { error: updateError } = await supabase
        .from('appointments')
        .update({
          notes: currentNotes.trim(),
          status: appointment.status === 'concluido' ? 'agendado' : appointment.status
        })
        .eq('id', appointment.id);

      if (updateError) throw updateError;

      setPaymentsHistory([]);
      toast.success("Baixas parciais estornadas! O valor total voltou a ficar pendente.");
      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error("Erro ao estornar pagamentos:", err);
      toast.error("Erro ao estornar pagamentos: " + (err.message || 'Tente novamente'));
    } finally {
      setIsDeletingPayment(false);
    }
  };

  return (
    <>
      {/* Backdrop suave para sobrepor a agenda inteira com foco no card */}
      <div 
        className={`fixed inset-0 z-[95] bg-slate-900/35 backdrop-blur-[1.5px] transition-opacity duration-200 ${
          isCheckoutOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Popover Card */}
      <div
        ref={popoverRef}
        className={`fixed z-[100] w-[390px] max-w-[calc(100vw-24px)] bg-white rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.35)] border border-slate-200 flex flex-col transition-all duration-150 overflow-hidden ${
          isCheckoutOpen ? 'opacity-0 pointer-events-none scale-95' : 'scale-100'
        }`}
        style={{ 
          top: `${position.top}px`, 
          left: `${position.left}px`, 
          maxHeight: position.maxHeight,
          opacity: isCheckoutOpen ? 0 : position.opacity 
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho Fixo */}
        <header className="flex items-center justify-between p-3 border-b border-slate-100 bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => { onEdit(appointment); onClose(); }}
              className="p-2 text-slate-500 hover:bg-slate-200/60 rounded-xl transition-colors"
              title="Editar Agendamento"
            >
              <Edit size={17} />
            </button>
            <button
              onClick={() => onDelete(appointment.id)}
              className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
              title="Excluir Agendamento"
            >
              <Trash2 size={17} />
            </button>
            {appointment.client?.id && (
              <button className="p-2 text-slate-500 hover:bg-slate-200/60 rounded-xl transition-colors" title="Ver Perfil do Cliente">
                <User size={17} />
              </button>
            )}
            {clientPhone && !isFinished && (
              <div className="relative inline-block ml-0.5">
                <button
                  onClick={handleSendWhatsAppReminder}
                  className={`p-2 text-white rounded-xl transition-all shadow-sm ${
                    isReminderSent ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
                  }`}
                  title={isReminderSent ? "Lembrete já enviado. Clique para reenviar" : "Enviar Lembrete via WhatsApp"}
                >
                  <MessageCircle size={17} />
                </button>
                {isReminderSent && (
                  <span className="absolute -top-1 -right-1 bg-emerald-500 text-white rounded-full p-0.5 border-2 border-white flex items-center justify-center shadow-xs animate-pulse" title="Lembrete já enviado">
                    <CheckCheck size={10} className="w-2.5 h-2.5 font-black" />
                  </span>
                )}
              </div>
            )}
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-full transition-colors"
            title="Fechar Detalhes"
          >
            <X size={18} />
          </button>
        </header>

        {/* Corpo com Rolagem Limpa */}
        <main className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
          {/* Identificação do Cliente */}
          <div>
            <h3 className="font-black text-xl text-slate-900 leading-snug flex flex-col gap-1">
              <span>{appointment.type === 'block' ? (appointment.notas || 'Bloqueio de Horário') : (appointment.client?.nome || 'Horário Bloqueado')}</span>
              {appointment.client?.apelido && appointment.type !== 'block' && (
                <span className="text-xs font-black text-orange-600 bg-orange-50 border border-orange-200/70 rounded-lg px-2 py-0.5 w-fit uppercase tracking-tight">
                  "{appointment.client.apelido}"
                </span>
              )}
            </h3>

            {isReminderSent && appointment.type !== 'block' && (
              <div className="mt-2.5 flex items-center justify-center gap-1.5 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2 text-indigo-700">
                <CheckCheck size={14} className="text-indigo-600 shrink-0" />
                <span className="text-[10px] font-black uppercase tracking-wider">Lembrete manual já enviado</span>
              </div>
            )}

            {appointment.type === 'block' && (
              <p className="text-[10px] font-black text-rose-500 bg-rose-50 border border-rose-100 rounded-lg px-2.5 py-1 w-fit uppercase tracking-wider mt-2">
                BLOQUEADO / INDISPONÍVEL
              </p>
            )}
          </div>

          {/* Procedimentos Marcados */}
          {appointment.type !== 'block' && (
            appointment.services && appointment.services.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    Procedimentos ({appointment.services.length}):
                  </p>
                  <span className="text-[11px] font-black text-slate-700">
                    Total: R$ {appointmentTotalValue.toFixed(2)}
                  </span>
                </div>
                <div className="space-y-1.5 max-h-44 overflow-y-auto pr-0.5 custom-scrollbar">
                  {appointment.services.map((s, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-slate-50 border border-slate-100 p-2.5 rounded-xl shadow-2xs">
                      <div className="min-w-0 pr-2">
                        <p className="text-xs font-bold text-slate-800 truncate leading-tight">{s.name}</p>
                        <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{s.duration} min</p>
                      </div>
                      <span className="text-xs font-black text-slate-700 shrink-0 bg-white border border-slate-200/80 px-2 py-0.5 rounded-lg shadow-2xs">
                        R$ {Number(s.price).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-orange-50/70 border border-orange-100/80 rounded-xl p-2.5 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[9px] font-black uppercase tracking-wider text-orange-500">Procedimento</p>
                    {isPartner && (
                      <span className="text-[9px] font-black uppercase bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                        🌟 Parceiro 100%
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-bold text-slate-800">{appointment.service?.name || 'Serviço'}</p>
                </div>
                <span className="text-xs font-black text-slate-800 bg-white border border-orange-200 px-2 py-1 rounded-lg">
                  R$ {Number(appointmentTotalValue).toFixed(2)}
                </span>
              </div>
            )
          )}

          {/* Múltiplos Horários Hoje (Comanda Consolidada) */}
          {sameDayAppointments.length > 1 && (
            <div className="bg-gradient-to-br from-amber-50 to-orange-50/60 border border-amber-200/80 rounded-2xl p-3.5 space-y-2.5 text-xs shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-amber-950">
                  <Receipt size={15} className="text-amber-600 shrink-0" />
                  <span className="text-xs font-black uppercase tracking-tight text-amber-900">
                    Múltiplos horários hoje!
                  </span>
                </div>
                <span className="bg-amber-200/80 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300">
                  {sameDayAppointments.length} horários
                </span>
              </div>

              {/* Lista dos agendamentos do dia */}
              <div className="space-y-1.5 pt-0.5 max-h-36 overflow-y-auto pr-0.5 custom-scrollbar">
                {sameDayAppointments.map((appItem) => {
                  const isCurrent = appItem.id === appointment.id;
                  const itemTime = appItem.time ? appItem.time.substring(0, 5) : (appItem.start ? format(new Date(appItem.start), 'HH:mm') : '');
                  return (
                    <div 
                      key={appItem.id} 
                      className={`flex items-center justify-between p-2 rounded-xl text-[11px] transition-all border ${
                        isCurrent 
                          ? 'bg-amber-100/90 border-amber-300 font-bold text-amber-950 shadow-2xs' 
                          : 'bg-white/80 border-amber-100 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <span className="text-[10px] font-black bg-white px-1.5 py-0.5 rounded border border-amber-200 shrink-0">
                          {itemTime}
                        </span>
                        <div className="truncate">
                          <p className="truncate font-semibold text-slate-800 leading-tight">
                            {appItem.service_name || appItem.service?.name || 'Serviço'}
                          </p>
                          <p className="text-[9px] text-slate-400 font-medium">
                            {appItem.professional_name || appItem.professional?.name || ''}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-black text-slate-800">
                          R$ {Number(appItem.value || appItem.service?.price || 0).toFixed(2)}
                        </span>
                        {isCurrent && (
                          <span className="block text-[8px] font-black uppercase tracking-wider text-amber-700">
                            Atual
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Opção de Envio do Lembrete */}
              <div className="pt-1 border-t border-amber-200/60">
                <p className="text-[10px] text-amber-900 font-semibold mb-1.5">
                  Como prefere enviar o lembrete de WhatsApp?
                </p>
                <div className="flex gap-2 text-center">
                  <button 
                    type="button"
                    onClick={() => setSendAllTogether(true)}
                    className={`flex-1 py-1.5 px-2 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all border ${
                      sendAllTogether 
                        ? 'bg-amber-500 text-white border-amber-600 shadow-xs' 
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Tudo Junto ✅
                  </button>
                  <button 
                    type="button"
                    onClick={() => setSendAllTogether(false)}
                    className={`flex-1 py-1.5 px-2 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all border ${
                      !sendAllTogether 
                        ? 'bg-amber-500 text-white border-amber-600 shadow-xs' 
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Separado 📲
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Dados de Horário, Profissional e Notas */}
          <div className="space-y-2.5 pt-1 text-xs font-bold text-slate-600">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-slate-100/70 rounded-xl text-slate-500 shrink-0">
                <Calendar size={15} />
              </div>
              <div>
                <span className="capitalize text-slate-800">{format(appointment.start, "EEEE, dd 'de' MMMM", { locale: pt })}</span>
                <br />
                <span className="text-slate-400 font-medium">{format(appointment.start, "HH:mm")} às {format(appointment.end, "HH:mm")}</span>
              </div>
            </div>

            {appointment.professional?.name && (
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100/70 rounded-xl text-slate-500 shrink-0">
                  <User size={15} />
                </div>
                <div>
                  <p className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider leading-none mb-0.5">Profissional</p>
                  <span className="text-slate-800">{appointment.professional.name}</span>
                </div>
              </div>
            )}

            {appointment.type !== 'block' && (
              <div className="flex flex-col gap-2 p-3 bg-slate-50 border border-slate-200/80 rounded-2xl">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">Valor do Procedimento</span>
                  <span className="text-slate-800 font-black text-sm">R$ {appointmentTotalValue.toFixed(2)}</span>
                </div>

                {alreadyPaidTotal > 0 && (
                  <>
                    <div className="flex items-center justify-between text-emerald-600">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1">
                        <CheckCircle2 size={12} />
                        Já Pago (Antecipações)
                      </span>
                      <span className="font-black text-sm">R$ {alreadyPaidTotal.toFixed(2)}</span>
                    </div>

                    <div className="flex items-center justify-between text-amber-600 border-t border-slate-200/60 pt-1.5">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider">Saldo Restante a Pagar</span>
                      <span className="font-black text-base">R$ {remainingValue.toFixed(2)}</span>
                    </div>

                    {/* Barra de Progresso */}
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-0.5">
                      <div 
                        className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.round((alreadyPaidTotal / (appointmentTotalValue || 1)) * 100))}%` }}
                      />
                    </div>

                    {/* Histórico das Baixas */}
                    {paymentsHistory.length > 0 && (
                      <div className="pt-0.5">
                        <div className="flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => setShowPaymentsBreakdown(!showPaymentsBreakdown)}
                            className="text-[9.5px] font-black text-slate-500 hover:text-slate-800 uppercase flex items-center gap-1 transition-all"
                          >
                            <span>Histórico ({paymentsHistory.length} baixa{paymentsHistory.length > 1 ? 's' : ''})</span>
                            <ChevronDown size={11} className={`transition-transform ${showPaymentsBreakdown ? 'rotate-180' : ''}`} />
                          </button>
                          <button
                            type="button"
                            disabled={isDeletingPayment}
                            onClick={handleEstornarTodosPayments}
                            className="text-[9px] font-extrabold text-rose-500 hover:text-rose-700 hover:underline uppercase flex items-center gap-1 transition-all disabled:opacity-50"
                            title="Estornar todas as baixas e cobrar valor integral"
                          >
                            {isDeletingPayment ? <Loader2 size={10} className="animate-spin" /> : <RotateCcw size={10} />}
                            <span>Zerar / Estornar</span>
                          </button>
                        </div>
                        {showPaymentsBreakdown && (
                          <div className="mt-1 space-y-1.5 pt-1 border-t border-slate-200/60 max-h-36 overflow-y-auto custom-scrollbar">
                            {paymentsHistory.map((p, idx) => (
                              <div key={p.id || idx} className="text-[9.5px] flex items-center justify-between text-slate-600 font-medium bg-white p-2 rounded-xl border border-slate-200/70 shadow-2xs">
                                <div className="min-w-0 pr-1">
                                  <div className="font-bold text-slate-800">
                                    {p.date ? format(new Date(p.date), 'dd/MM/yyyy HH:mm') : 'Data não informada'}
                                  </div>
                                  <div className="text-[8.5px] text-slate-400 uppercase font-semibold">
                                    {p.method?.toUpperCase()} • {p.notes || 'Baixa Parcial'}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="font-extrabold text-emerald-600 font-mono text-xs">+R$ {Number(p.amount || 0).toFixed(2)}</span>
                                  <button
                                    type="button"
                                    disabled={isDeletingPayment}
                                    onClick={() => handleEstornarPayment(p)}
                                    className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                    title="Estornar esta baixa"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {appointment.notas ? (
              <div className="flex items-start gap-3">
                <div className="p-2 bg-rose-50 rounded-xl text-rose-500 shrink-0">
                  <AlignLeft size={15} />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider leading-none mb-1">
                    {appointment.type === 'block' ? 'Motivo do Bloqueio' : 'Observações'}
                  </p>
                  <span className="text-slate-700 font-medium whitespace-pre-wrap break-words">{appointment.notas}</span>
                </div>
              </div>
            ) : appointment.type === 'block' ? (
              <div className="flex items-start gap-3">
                <div className="p-2 bg-rose-50 rounded-xl text-rose-500 shrink-0">
                  <AlignLeft size={15} />
                </div>
                <div>
                  <p className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider leading-none mb-1">Motivo do Bloqueio</p>
                  <span className="text-slate-400 italic font-medium">Sem detalhes informados</span>
                </div>
              </div>
            ) : null}
          </div>
        </main>

        {/* Rodapé Fixo */}
        <footer className="p-3.5 sm:p-4 bg-slate-50/95 border-t border-slate-100 flex flex-col gap-2 shrink-0 rounded-b-3xl">
          {/* Seletor de Status */}
          <button
            ref={statusRef}
            onClick={handleOpenStatus}
            className="w-full flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-600 bg-white hover:bg-slate-100/80 px-3.5 py-2.5 rounded-xl transition-all border border-slate-200/80 shadow-2xs"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-slate-400 shrink-0" />
              <span>Status: {statusLabels[appointment.status] || appointment.status}</span>
            </div>
            <MoreVertical size={14} className="text-slate-400 shrink-0" />
          </button>

          {/* Ações de Comanda / Fechamento / Baixa Parcial */}
          {canCheckout && (
            pendingSameDay.length > 1 ? (
              <div className="flex flex-col gap-2 pt-0.5">
                <button
                  disabled={isProcessing}
                  onClick={handleFinalizeAllTogether}
                  className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider py-3.5 px-4 rounded-2xl shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Receipt size={16} />}
                  <span>{isProcessing ? 'Processando...' : `Finalizar Todos Juntos (R$ ${pendingTotalValue.toFixed(2)})`}</span>
                </button>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    disabled={isProcessing}
                    onClick={() => {
                      setCheckoutInitialMode('full');
                      setIsCheckoutOpen(true);
                    }}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-[10px] uppercase tracking-wider py-2.5 px-2 rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <CheckCircle2 size={13} />
                    <span>Quitar Este</span>
                  </button>
                  <button
                    disabled={isProcessing}
                    onClick={() => {
                      setCheckoutInitialMode('partial');
                      setIsCheckoutOpen(true);
                    }}
                    className="w-full bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 font-black text-[10px] uppercase tracking-wider py-2.5 px-2 rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Split size={13} className="text-amber-600" />
                    <span>Baixa Parcial</span>
                  </button>
                </div>
              </div>
            ) : hasPartialPayments ? (
              <div className="flex flex-col gap-2 pt-0.5">
                <button
                  disabled={isProcessing}
                  onClick={() => {
                    setCheckoutInitialMode('full');
                    setIsCheckoutOpen(true);
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider py-3.5 px-4 rounded-2xl shadow-lg shadow-emerald-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Receipt size={16} />
                  <span>Quitar Restante (R$ {remainingValue.toFixed(2)})</span>
                </button>
                <button
                  disabled={isProcessing}
                  onClick={() => {
                    setCheckoutInitialMode('partial');
                    setIsCheckoutOpen(true);
                  }}
                  className="w-full bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 font-black text-xs uppercase tracking-wider py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Split size={14} className="text-amber-600" />
                  <span>Nova Baixa Parcial / Sinal</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2 pt-0.5">
                <button
                  disabled={isProcessing}
                  onClick={() => {
                    setCheckoutInitialMode('full');
                    setIsCheckoutOpen(true);
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider py-3.5 px-4 rounded-2xl shadow-lg shadow-emerald-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Receipt size={16} />}
                  <span>{isProcessing ? 'Processando...' : `Finalizar Atendimento (R$ ${appointmentTotalValue.toFixed(2)})`}</span>
                </button>
                <button
                  disabled={isProcessing}
                  onClick={() => {
                    setCheckoutInitialMode('partial');
                    setIsCheckoutOpen(true);
                  }}
                  className="w-full bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 font-black text-xs uppercase tracking-wider py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Split size={14} className="text-amber-600" />
                  <span>Dar Baixa Parcial / Antecipação</span>
                </button>
              </div>
            )
          )}

          {appointment.status === 'concluido' && (
            <div className="flex items-center justify-center gap-2 py-2.5 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100 font-black text-[11px] uppercase tracking-wider">
              <CheckCircle2 size={15} />
              <span>Procedimento Quitado / Concluído</span>
            </div>
          )}
        </footer>
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
          initialMode={checkoutInitialMode}
          onClose={() => setIsCheckoutOpen(false)}
          appointment={{
            id: appointment.id,
            client_id: appointment.client?.id,
            client_name: appointment.client?.nome || 'Cliente',
            service_name: appointment.service?.name || 'Serviço',
            price: appointmentTotalValue,
            professional_id: appointment.professional?.id,
            professional_name: appointment.professional?.name,
            payments: paymentsHistory,
            paid_amount: alreadyPaidTotal,
            remaining_amount: remainingValue,
            notes: (appointment as any).notes || appointment.notas
          }}
          onSuccess={(info) => {
            if (info?.isPartial) {
              if (onRefresh) onRefresh();
              setIsCheckoutOpen(false);
              onClose();
            } else {
              onUpdateStatus(appointment.id, 'concluido');
              if (onRefresh) onRefresh();
              setIsCheckoutOpen(false);
              onClose();
            }
          }}
        />
      )}
    </>
  );
};

export default AppointmentDetailPopover;

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    console.log('📦 [PAYLOAD] Recebido:', JSON.stringify(body, null, 2))

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    
    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY não configurada' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { 
      client_name, 
      client_email, 
      professional_name, 
      professional_email,
      service_name, 
      appointment_date,
      appointment_time,
      total_amount,
      notes,
      date,
      start_time,
      start_at,
      value
    } = body

    // FORMATAÇÃO DA DATA (BRASIL/RECIFE)
    let displayDate = 'Não informada'
    const rawDate = appointment_date || date || start_at
    
    if (rawDate) {
      try {
        // Se a data for apenas YYYY-MM-DD, tratamos para evitar erro de fuso
        const dateToParse = (typeof rawDate === 'string' && rawDate.length === 10) 
          ? `${rawDate}T12:00:00` 
          : rawDate
          
        displayDate = new Date(dateToParse).toLocaleDateString('pt-BR', {
          timeZone: 'America/Recife',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        })
      } catch (e) {
        displayDate = String(rawDate)
      }
    }

    const displayTime = appointment_time || start_time || (start_at ? new Date(start_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'Não informado')
    
    const displayValue = value || total_amount
    const numericValue = (displayValue !== undefined && displayValue !== null) ? Number(displayValue) : null

    // Limpeza das observações
    // Limpeza das observações
    let cleanNotes = notes || ''
    if (cleanNotes.includes('---SERVICES_JSON---')) {
      cleanNotes = cleanNotes.split('---END_SERVICES_JSON---').pop()?.trim() || ''
    }

    const notification_type = body.notification_type || (body.status === 'cancelado' ? 'cancellation' : 'confirmation')
    const isCancellation = notification_type === 'cancellation' || notification_type === 'cancelado'

    const emailsToSend = []

    // 1. E-mail para o CLIENTE
    if (client_email) {
      if (isCancellation) {
        emailsToSend.push({
          from: 'Belare Gestão <notificacoes@belaregestao.com.br>',
          to: [client_email],
          subject: 'Atualização de Agendamento (Cancelado) - BelareStudio',
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px; border-left: 5px solid #ef4444;">
              <h2 style="color: #ef4444;">Olá, ${client_name || 'Cliente'}!</h2>
              <p>Confirmamos o seu cancelamento de agendamento no sistema.</p>
              <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
              <p><strong>Serviço:</strong> ${service_name || 'Não informado'}</p>
              <p><strong>Profissional:</strong> ${professional_name || 'Não informado'}</p>
              <p><strong>Data Original:</strong> ${displayDate}</p>
              <p><strong>Horário Original:</strong> ${displayTime}</p>
              ${cleanNotes ? `<p><strong>Motivo / Observações:</strong> ${cleanNotes}</p>` : ''}
              <div style="margin-top: 30px; padding: 15px; background-color: #fafafa; border-radius: 8px; text-align: center;">
                <p style="margin: 0; font-size: 14px; color: #4b5563;">Esperamos ver você em breve para uma próxima oportunidade! 😊</p>
              </div>
              <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="font-size: 12px; color: #666;">Este é um e-mail automático. Por favor, não responda.</p>
            </div>
          `,
        })
      } else {
        emailsToSend.push({
          from: 'Belare Gestão <notificacoes@belaregestao.com.br>',
          to: [client_email],
          subject: 'Confirmação de Agendamento - BelareStudio',
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
              <h2 style="color: #f97316;">Olá, ${client_name || 'Cliente'}!</h2>
              <p>Seu agendamento foi confirmado com sucesso.</p>
              <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
              <p><strong>Serviço:</strong> ${service_name || 'Não informado'}</p>
              <p><strong>Profissional:</strong> ${professional_name || 'Não informado'}</p>
              <p><strong>Data:</strong> ${displayDate}</p>
              <p><strong>Horário:</strong> ${displayTime}</p>
              ${(numericValue !== null && !isNaN(numericValue)) ? `<p><strong>Valor:</strong> R$ ${numericValue.toFixed(2)}</p>` : ''}
              ${cleanNotes ? `<p><strong>Observações:</strong> ${cleanNotes}</p>` : ''}
              <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="font-size: 12px; color: #666;">Este é um e-mail automático. Por favor, não responda.</p>
            </div>
          `,
        })
      }
    }

    // 2. E-mail para o PROFISSIONAL
    if (professional_email) {
      if (isCancellation) {
        emailsToSend.push({
          from: 'Belare Gestão <notificacoes@belaregestao.com.br>',
          to: [professional_email],
          subject: `Agendamento CANCELADO: ${client_name || 'Cliente'} - ${displayDate}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px; border-left: 5px solid #ef4444;">
              <h2 style="color: #ef4444;">Atenção: Horário Desmarcado</h2>
              <p>O cliente <strong>${client_name || 'Cliente'}</strong> cancelou o agendamento.</p>
              <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
              <p><strong>Cliente:</strong> ${client_name || 'Não informado'}</p>
              <p><strong>Serviço:</strong> ${service_name || 'Não informado'}</p>
              <p><strong>Data:</strong> ${displayDate}</p>
              <p><strong>Horário:</strong> ${displayTime}</p>
              ${cleanNotes ? `<p><strong>Motivo / Observações do Cancelamento:</strong> ${cleanNotes}</p>` : ''}
              <div style="margin-top: 30px; padding: 15px; background-color: #fef2f2; border-radius: 8px;">
                <p style="margin: 0; font-size: 14px; color: #991b1b; font-weight: bold;">Este horário agora está liberado para nova reserva na sua agenda.</p>
              </div>
              <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="font-size: 12px; color: #666;">Notificação automática de BelareStudio.</p>
            </div>
          `,
        })
      } else {
        emailsToSend.push({
          from: 'Belare Gestão <notificacoes@belaregestao.com.br>',
          to: [professional_email],
          subject: `Novo Agendamento: ${client_name || 'Cliente'} - ${displayDate}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px; border-left: 5px solid #f97316;">
              <h2 style="color: #334155;">Olá, ${professional_name}!</h2>
              <p>Você tem um <strong>novo agendamento</strong> no sistema.</p>
              <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
              <p><strong>Cliente:</strong> ${client_name || 'Não informado'}</p>
              <p><strong>Serviço:</strong> ${service_name || 'Não informado'}</p>
              <p><strong>Data:</strong> ${displayDate}</p>
              <p><strong>Horário:</strong> ${displayTime}</p>
              ${(numericValue !== null && !isNaN(numericValue)) ? `<p><strong>Valor:</strong> R$ ${numericValue.toFixed(2)}</p>` : ''}
              ${cleanNotes ? `<p><strong>Observações:</strong> ${cleanNotes}</p>` : ''}
              <div style="margin-top: 30px; padding: 15px; background-color: #f8fafc; border-radius: 8px;">
                <p style="margin: 0; font-size: 14px; color: #475569;">Acesse o painel para ver mais detalhes.</p>
              </div>
              <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="font-size: 12px; color: #666;">Notificação automática de BelareStudio.</p>
            </div>
          `,
        })
      }
    }

    // Enviar e-mails
    for (const email of emailsToSend) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify(email),
      })
    }

    return new Response(JSON.stringify({ success: true, sent_count: emailsToSend.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Erro na função:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})


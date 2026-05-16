import { corsHeaders } from '../_shared/cors.ts'

console.log('✨ [INIT] send-appointment-notification function loaded')

Deno.serve(async (req) => {
  // 1. Handle CORS preflight requests immediately
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200, 
      headers: corsHeaders 
    })
  }

  console.log(`🚀 [START] ${req.method} request received`)

  try {
    // 2. Parse request body
    const body = await req.json().catch(() => null)
    
    if (!body) {
      console.error('❌ [ERROR] Corpo da requisição inválido ou vazio')
      return new Response(
        JSON.stringify({ success: false, error: 'Corpo da requisição inválido ou vazio' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Log do payload recebido
    console.log('📦 [PAYLOAD] Recebido:', JSON.stringify(body, null, 2))

    const resendApiKey = Deno.env.get('RESEND_API_KEY')

    const { 
      client_name, 
      client_email, 
      professional_name, 
      professional_email,
      service_name, 
      start_at,
      total_amount,
      notes,
      date, 
      start_time,
      appointment_date,
      appointment_time,
      value 
    } = body

    // Preparação de dados para o e-mail
    // Prioriza os campos específicos do payload se existirem
    let displayDate = 'Não informada'
    const rawDate = appointment_date || date
    
    if (rawDate) {
      if (rawDate.includes('-')) {
        // Formato YYYY-MM-DD para DD/MM/YYYY
        const [year, month, day] = rawDate.split('-')
        displayDate = `${day}/${month}/${year}`
      } else {
        displayDate = rawDate
      }
    } else if (start_at) {
      displayDate = new Date(start_at).toLocaleDateString('pt-BR')
    }

    const displayTime = appointment_time || start_time || (start_at ? new Date(start_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'Não informado')
    
    const displayValue = value || total_amount
    const numericValue = (displayValue !== undefined && displayValue !== null) ? Number(displayValue) : null

    // Limpeza das observações: remover JSON bruto de serviços se presente
    let cleanNotes = notes || ''
    if (cleanNotes.includes('---SERVICES_JSON---')) {
      cleanNotes = cleanNotes.split('---END_SERVICES_JSON---').pop()?.trim() || ''
    }

    const notificationStatus = {
      client_sent: false,
      professional_sent: false,
      error: null as string | null,
      warning: null as string | null,
      resend_responses: [] as any[]
    }

    if (!resendApiKey) {
      console.warn('⚠️ [WARN] RESEND_API_KEY não configurada. Operando em modo simulação.')
      notificationStatus.warning = 'RESEND_API_KEY não configurada. Modo simulação ativo.'
    } else {
      // 1. Enviar para o CLIENTE
      if (client_email) {
        console.log(`📧 [RESEND] Tentando enviar e-mail para o CLIENTE: ${client_email}`)
        try {
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${resendApiKey}`,
            },
            body: JSON.stringify({
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
                  <p style="font-size: 12px; color: #666;">Este é um e-mail automático enviado por BelareStudio. Por favor, não responda.</p>
                </div>
              `,
            }),
          })
          
          notificationStatus.client_sent = res.ok
          notificationStatus.resend_responses.push({ type: 'client', status: res.status })
        } catch (e) {
          console.error('❌ Erro ao enviar e-mail para cliente:', e)
        }
      }

      // 2. Enviar para o PROFISSIONAL
      if (professional_email) {
        console.log(`📧 [RESEND] Tentando enviar e-mail para o PROFISSIONAL: ${professional_email}`)
        try {
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${resendApiKey}`,
            },
            body: JSON.stringify({
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
                    <p style="margin: 0; font-size: 14px; color: #475569;">Acesse o painel administrativo para ver mais detalhes.</p>
                  </div>
                  <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                  <p style="font-size: 12px; color: #666;">Notificação automática de BelareStudio.</p>
                </div>
              `,
            }),
          })
          
          notificationStatus.professional_sent = res.ok
          notificationStatus.resend_responses.push({ type: 'professional', status: res.status })
        } catch (e) {
          console.error('❌ Erro ao enviar e-mail para profissional:', e)
        }
      }
    }

    // 3. Sucesso (ou falha parcial tratada)
    const totalSent = (notificationStatus.client_sent ? 1 : 0) + (notificationStatus.professional_sent ? 1 : 0)
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: totalSent > 0 ? `Agendamento processado e ${totalSent} notificação(ões) enviada(s).` : 'Agendamento processado (notificações falharam ou simuladas).',
        client_notification_sent: notificationStatus.client_sent,
        professional_notification_sent: notificationStatus.professional_sent,
        warning: notificationStatus.warning,
        details: {
          resend_info: notificationStatus.resend_responses
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('❌ [CRITICAL_ERROR] Erro inesperado na Edge Function:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro interno crítico',
        warning: 'Ocorreu um erro inesperado ao processar a notificação.'
      }),
      {
        status: 200, // Retornamos 200 com success: false para não quebrar o fluxo do frontend
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

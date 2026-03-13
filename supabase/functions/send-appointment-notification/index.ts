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
      service_name, 
      start_at,
      total_amount,
      notes,
      date, 
      start_time, 
      value 
    } = body

    // Preparação de dados para o e-mail
    const displayDate = date || (start_at ? new Date(start_at).toLocaleDateString('pt-BR') : 'Não informada')
    const displayTime = start_time || (start_at ? new Date(start_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'Não informado')
    const displayValue = value || total_amount
    const numericValue = (displayValue !== undefined && displayValue !== null) ? Number(displayValue) : null

    const notificationStatus = {
      sent: false,
      error: null as string | null,
      warning: null as string | null,
      resend_response: null as any
    }

    if (!resendApiKey) {
      console.warn('⚠️ [WARN] RESEND_API_KEY não configurada. Operando em modo simulação.')
      notificationStatus.warning = 'RESEND_API_KEY não configurada. Modo simulação ativo.'
    } else if (!client_email) {
      console.warn('⚠️ [WARN] client_email não fornecido. Notificação não enviada.')
      notificationStatus.warning = 'E-mail do cliente não fornecido.'
    } else {
      console.log(`📧 [RESEND] Tentando enviar e-mail para: ${client_email}`)
      
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: 'BelaFlow <notificacoes@belaflow.com.br>',
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
                ${notes ? `<p><strong>Observações:</strong> ${notes}</p>` : ''}
                <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="font-size: 12px; color: #666;">Este é um e-mail automático enviado por BelareStudio. Por favor, não responda.</p>
              </div>
            `,
          }),
        })

        const resStatus = res.status
        const resText = await res.text()
        let resData = null
        try {
          resData = JSON.parse(resText)
        } catch (e) {
          resData = { raw: resText }
        }

        console.log(`📡 [RESEND_RESPONSE] Status: ${resStatus}`)
        notificationStatus.resend_response = { status: resStatus, data: resData }

        if (res.ok) {
          console.log('✅ [RESEND_SUCCESS] E-mail enviado com sucesso!')
          notificationStatus.sent = true
        } else {
          console.error('❌ [RESEND_ERROR] Falha na API do Resend')
          notificationStatus.error = `Resend API Error: ${resStatus}`
          notificationStatus.warning = 'O agendamento foi salvo, mas a notificação por e-mail falhou.'
        }
      } catch (fetchError) {
        console.error('❌ [FETCH_ERROR] Erro ao chamar API do Resend:', fetchError)
        notificationStatus.error = fetchError instanceof Error ? fetchError.message : 'Erro de conexão com Resend'
        notificationStatus.warning = 'O agendamento foi salvo, mas a notificação por e-mail falhou devido a um erro de conexão.'
      }
    }

    // 3. Sucesso (ou falha parcial tratada)
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: notificationStatus.sent ? 'Agendamento processado e notificação enviada.' : 'Agendamento processado (notificação falhou ou simulada).',
        notification_sent: notificationStatus.sent,
        warning: notificationStatus.warning,
        details: {
          notification_error: notificationStatus.error,
          resend_info: notificationStatus.resend_response
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

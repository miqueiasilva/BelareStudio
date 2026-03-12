import { corsHeaders } from '../_shared/cors.ts'

// Mock de corsHeaders caso o import acima falhe no ambiente local
const localCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: localCorsHeaders })
  }

  try {
    const body = await req.json().catch(() => null)
    
    if (!body) {
      return new Response(
        JSON.stringify({ success: false, error: 'Corpo da requisição inválido ou vazio' }),
        { status: 400, headers: { ...localCorsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY')

    if (!resendApiKey) {
      console.warn('⚠️ RESEND_API_KEY não configurada. Operando em modo simulação.')
    }

    const { 
      client_name, 
      client_email, 
      professional_name, 
      service_name, 
      date, 
      start_time, 
      value 
    } = body

    // Ensure value is a number
    const numericValue = (value !== undefined && value !== null) ? Number(value) : null

    if (resendApiKey && client_email) {
      console.log(`📧 Enviando e-mail para ${client_email} via Resend...`)
      
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
              <p><strong>Data:</strong> ${date || 'Não informada'}</p>
              <p><strong>Horário:</strong> ${start_time || 'Não informado'}</p>
              ${(numericValue !== null && !isNaN(numericValue)) ? `<p><strong>Valor:</strong> R$ ${numericValue.toFixed(2)}</p>` : ''}
              <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="font-size: 12px; color: #666;">Este é um e-mail automático enviado por BelareStudio. Por favor, não responda.</p>
            </div>
          `,
        }),
      })

      if (!res.ok) {
        const errorText = await res.text()
        let errorDetail = errorText
        try {
          const errorJson = JSON.parse(errorText)
          errorDetail = errorJson.message || errorJson.error || errorText
        } catch (e) {
          // keep original text
        }
        console.error('Erro na API do Resend:', errorText)
        throw new Error(`Resend API Error: ${res.status} - ${errorDetail}`)
      }

      const resData = await res.json()
      console.log('✅ E-mail enviado com sucesso via Resend:', resData.id)
    } else {
      console.log(`✅ Simulação: Notificação processada para ${client_name} (${client_email || 'sem email'})`)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: resendApiKey ? 'Notificação enviada com sucesso.' : 'Notificação processada em modo simulação.',
        data: { client_name, service_name, date, start_time }
      }),
      {
        status: 200,
        headers: {
          ...localCorsHeaders,
          'Content-Type': 'application/json',
        },
      }
    )
  } catch (error) {
    console.error('Erro na Edge Function:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro interno',
      }),
      {
        status: 400,
        headers: {
          ...localCorsHeaders,
          'Content-Type': 'application/json',
        },
      }
    )
  }
})

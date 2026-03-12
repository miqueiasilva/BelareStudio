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
    const body = await req.json()
    console.log('Recebido pedido de notificação:', body)

    const { 
      client_name, 
      client_email, 
      client_whatsapp, 
      professional_name, 
      service_name, 
      date, 
      start_time, 
      value 
    } = body

    // Aqui você integraria com Resend, SendGrid, Twilio ou Evolution API
    // Exemplo com Resend (comentado):
    /*
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      },
      body: JSON.stringify({
        from: 'BelaFlow <notificacoes@belaflow.com.br>',
        to: [client_email],
        subject: 'Confirmação de Agendamento - BelareStudio',
        html: `<h1>Olá, ${client_name}!</h1><p>Seu agendamento para <strong>${service_name}</strong> com <strong>${professional_name}</strong> foi confirmado para o dia <strong>${date}</strong> às <strong>${start_time}</strong>.</p>`,
      }),
    })
    */

    console.log(`✅ Simulação: Notificação enviada para ${client_name} (${client_email || 'sem email'})`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Notificação processada com sucesso (Simulação).',
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

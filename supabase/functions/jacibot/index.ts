import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { prompt, context, model, config, contents } = body

    const apiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY is not configured in Supabase Secrets' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Default to the correct non-deprecated text model gemini-3.5-flash
    const targetModel = model || 'gemini-3.5-flash'
    
    // Construct Google Gemini REST API URL
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`

    // Format content appropriately
    let apiContents = contents
    if (!apiContents) {
      let textContent = prompt || ''
      if (context) {
        textContent = `Contexto:\n${typeof context === 'string' ? context : JSON.stringify(context)}\n\nPrompt: ${textContent}`
      }
      apiContents = {
        parts: [{ text: textContent }]
      }
    }

    // Format generation config
    const generationConfig: any = {}
    if (config) {
      if (config.responseMimeType) {
        generationConfig.responseMimeType = config.responseMimeType
      }
      if (config.responseSchema) {
        generationConfig.responseSchema = config.responseSchema
      }
      if (config.imageConfig) {
        if (config.imageConfig.aspectRatio) {
          generationConfig.aspectRatio = config.imageConfig.aspectRatio
        }
        if (config.imageConfig.imageSize) {
          generationConfig.imageSize = config.imageConfig.imageSize
        }
      }
    }

    const payload = {
      contents: apiContents,
      generationConfig: Object.keys(generationConfig).length > 0 ? generationConfig : undefined
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json()
    
    if (data.error) {
      return new Response(JSON.stringify({ error: data.error }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Extract text logic
    let text = ''
    if (data.candidates?.[0]?.content?.parts) {
      for (const part of data.candidates[0].content.parts) {
        if (part.text) {
          text += part.text
        }
      }
    }

    return new Response(JSON.stringify({ ...data, text }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    console.error('Edge Function Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

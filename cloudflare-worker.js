export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, x-api-key'
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers });
    if (url.pathname.endsWith('/health')) return new Response(JSON.stringify({ ok: true, service: 'ruta-escolar-worker', version: '1.0.0' }), { headers });
    if (request.method !== 'POST') return new Response(JSON.stringify({ ok:false, error:'Metodo no permitido' }), { status:405, headers });

    const key = request.headers.get('x-api-key');
    if ((env.VERIFY_KEY || '') && key !== env.VERIFY_KEY) return new Response(JSON.stringify({ ok:false, error:'No autorizado' }), { status:401, headers });

    try {
      const body = await request.json();
      const messages = Array.isArray(body.messages) ? body.messages : [];
      if (!messages.length) return new Response(JSON.stringify({ ok:false, error:'Sin mensajes' }), { status:400, headers });

      const results = [];
      for (const item of messages) {
        const phone = String(item.phone || '').replace(/\D/g,'');
        const payload = {
          messaging_product: 'whatsapp',
          to: phone,
          type: 'text',
          text: { body: item.message }
        };
        const resp = await fetch(`https://graph.facebook.com/v23.0/${env.PHONE_NUMBER_ID}/messages`, {
          method:'POST',
          headers:{ 'Authorization': `Bearer ${env.WHATSAPP_TOKEN}`, 'Content-Type':'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await resp.json();
        if (!resp.ok) return new Response(JSON.stringify({ ok:false, error:data }), { status:500, headers });
        results.push({ phone, id: data.messages?.[0]?.id || null });
      }

      return new Response(JSON.stringify({ ok:true, sent:results.length, results }), { headers });
    } catch (error) {
      return new Response(JSON.stringify({ ok:false, error:error.message || 'Error interno' }), { status:500, headers });
    }
  }
};
# Ruta Escolar Montenegro PRO

Versión móvil mejorada con:
- interfaz total más limpia
- GPS del celular
- detección automática de ingreso al barrio
- mensajes individuales y masivos
- cola de WhatsApp
- IA local para mejorar textos
- orden de recogida y dejada
- backend para WhatsApp Business

## Publicación
Sube la carpeta al repositorio GitHub Pages.

## WhatsApp Business
Para envío automático real usa `backend/cloudflare-worker.js` en Cloudflare Workers y configura:
- `WHATSAPP_TOKEN`
- `PHONE_NUMBER_ID`
- `VERIFY_KEY`

Luego en la web:
- pega la URL del worker en Config
- pega la VERIFY_KEY pública en la web
- cambia el modo a `WhatsApp Business`

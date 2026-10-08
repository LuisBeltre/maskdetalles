# Tienda BaitX

Sitio de venta de BaitX: landing + ofertas + checkout dentro del sitio (sin
redirigir a otra página), pago contra entrega funcionando desde ya, y la
opción de tarjeta lista para activarse en cuanto tengas una pasarela
dominicana afiliada (Azul, CardNET o PortalDom — **Stripe no admite
comercios de República Dominicana**, no es una opción aquí).

## Qué incluye

- **Landing de una sola página**: héroe, cómo actúa el producto (secuencia
  de aplicación), ofertas, FAQ y llamado final.
- **Checkout en modal**: el cliente nunca sale del sitio. Pide nombre,
  apellido, teléfono, provincia/ciudad (desplegables dependientes con los
  municipios de RD), dirección, punto de referencia y método de pago.
- **Aviso automático por WhatsApp**: cada pedido te llega a tu número
  personal (`OWNER_PHONE`) con todos los datos — reutiliza las mismas
  credenciales (`WHATSAPP_TOKEN`, `PHONE_NUMBER_ID`) del bot de BaitX que ya
  tienes funcionando.
- **Panel de pedidos** en `/admin` (usuario y contraseña), para ver el
  historial sin depender solo del aviso de WhatsApp.

## Lo que tienes que editar antes de publicar

- **Precios reales**: en `server.js`, busca el objeto `OFERTAS` y pon tus
  precios de verdad (ahora mismo son de ejemplo).
- **Fotos del producto**: agrega tus imágenes reales en `public/img/` y
  reemplaza el gráfico de jeringa (hecho con CSS) en `index.html` por una
  foto real si prefieres — está marcado con un comentario `<!-- HERO -->`.
- **Textos**: ajusta el texto del héroe, la FAQ y el "cómo actúa" si quieres
  afinar el tono o agregar lo que te diferencia de la competencia.
- **Número de WhatsApp** en `public/js/app.js` (`WHATSAPP_NUMERO`), si
  cambia.

## Pago con tarjeta (pendiente del trámite bancario)

El checkout ya muestra la opción "Tarjeta en línea" pero deshabilitada
("próximamente"), porque falta afiliarse a una pasarela dominicana:

1. **Azul** (Banco Popular) es la más usada/reconocida — tiene integración
   vía API, página de pago redirigida, o "Link de Pagos" (sin programar
   nada, generas un link y se lo mandas al cliente).
2. **CardNET** y **PortalDom** son las otras dos opciones serias en RD.
3. Cualquiera de las tres requiere firmar un contrato de afiliación como
   comercio con el banco (documentos, Registro Mercantil si es persona
   jurídica — Acra SRL ya debería tenerlo).

**Mientras tramitas eso**, una salida rápida sin tocar código: usa el
**Link de Pagos de Azul** manualmente — cuando alguien pida pagar con
tarjeta por WhatsApp, le generas el link desde el panel de Azul y se lo
envías. No es automático, pero funciona desde el día uno de la afiliación.

Cuando tengas las credenciales de la API, avísame y conectamos el botón de
tarjeta de verdad, sin rehacer el resto del sitio.

## Instalación (mismo flujo que el bot: GitHub + Render)

1. Sube esta carpeta a un repositorio de GitHub (como hicimos con el bot).
2. Crea un nuevo **Web Service** en Render conectado a ese repositorio.
   - Build Command: `npm install`
   - Start Command: `npm start`
3. En Render > Environment, agrega las variables de `.env.example`:
   - `WHATSAPP_TOKEN` y `PHONE_NUMBER_ID`: los mismos del bot de BaitX.
   - `OWNER_PHONE`: tu WhatsApp personal.
   - `ADMIN_USER` / `ADMIN_PASSWORD`: para entrar a `/admin`.
4. Despliega. Tu tienda queda en `https://<tu-servicio>.onrender.com`.
5. (Opcional) Conecta un dominio propio tipo `tienda.baitx.com` desde la
   configuración de Render.

## Limitaciones a tener en cuenta

- **Los pedidos se guardan en un archivo** (`orders_data/orders.json`) en el
  mismo servidor. En el plan gratuito de Render, el disco se reinicia con
  cada redeploy — así que un redeploy puede borrar el historial de pedidos
  viejos (el aviso de WhatsApp de cada pedido sí queda, porque ya se envió).
  Si el volumen de pedidos crece, conviene mover esto a una base de datos
  real (puedo ayudarte con eso cuando llegue el momento).
- **El aviso de WhatsApp a `OWNER_PHONE`** depende de que le hayas escrito
  al número del bot en las últimas 24 horas (la misma regla de Meta que ya
  vimos con el chatbot). Si quieres evitar esa dependencia, se puede usar
  una plantilla aprobada, igual que hicimos para el aviso de "asesor" del
  bot.
- **La lista de ciudades** (`data/provincias.json`) cubre las 32 provincias
  con sus municipios principales, no cada pueblo pequeño. Es fácil de
  ampliar si algún cliente no encuentra su ciudad — solo agrega la línea
  correspondiente al archivo.

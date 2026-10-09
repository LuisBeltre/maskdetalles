import express from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const {
  PORT = 3000,
  WHATSAPP_TOKEN, // el mismo token permanente del bot de BaitX
  PHONE_NUMBER_ID, // el mismo Phone Number ID del bot
  GRAPH_VERSION = "v26.0",
  OWNER_PHONE, // tu WhatsApp personal, con código de país, sin "+"
  ADMIN_USER = "admin",
  ADMIN_PASSWORD, // contraseña para ver los pedidos en /admin — sin esto, /admin queda bloqueado
} = process.env;

if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID || !OWNER_PHONE) {
  console.warn("⚠️ Faltan WHATSAPP_TOKEN, PHONE_NUMBER_ID u OWNER_PHONE: los pedidos no te avisarán por WhatsApp (revisa .env.example).");
}
if (!ADMIN_PASSWORD) {
  console.warn("⚠️ No pusiste ADMIN_PASSWORD: el panel de pedidos (/admin) queda deshabilitado.");
}

/* ============================================================
   OFERTAS — EDITA AQUÍ TUS PRECIOS REALES
   ============================================================ */
const OFERTAS = {
  "1": { unidades: 1, precio: 1400, etiqueta: "2 Jeringa BaitX" },
  "2": { unidades: 2, precio: 2600, etiqueta: "4 jeringas BaitX (más vendida)" },
  "3": { unidades: 3, precio: 3300, etiqueta: "6 jeringas BaitX" },
};

/* ============================================================
   WHATSAPP — aviso de pedido nuevo al dueño del negocio
   ============================================================ */
async function avisarPorWhatsApp(pedido) {
  if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID || !OWNER_PHONE) return;

  const texto =
    `🛒 *Nuevo pedido BaitX — Tienda web*\n\n` +
    `Oferta: ${pedido.ofertaEtiqueta}\n` +
    `Total: RD$${pedido.total}\n` +
    `Pago: ${pedido.metodoPago === "contra_entrega" ? "Contra entrega" : pedido.metodoPago}\n\n` +
    `Cliente: ${pedido.nombre} ${pedido.apellido}\n` +
    `Tel/WhatsApp: ${pedido.telefono}\n` +
    `Provincia: ${pedido.provincia}\n` +
    `Ciudad: ${pedido.ciudad}\n` +
    `Dirección: ${pedido.direccion}\n` +
    `Referencia: ${pedido.referencia || "—"}\n\n` +
    `N.º de pedido: ${pedido.id}`;

  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: OWNER_PHONE,
        type: "text",
        text: { body: texto },
      }),
    });
    if (!res.ok) console.error("Error avisando pedido por WhatsApp:", res.status, await res.text());
  } catch (e) {
    console.error("Error de red avisando pedido:", e);
  }
}

/* ============================================================
   ALMACENAMIENTO DE PEDIDOS (archivo JSON simple)
   NOTA: en Render el disco se reinicia con cada redeploy. Para
   un historial que nunca se pierda, cambia esto por una base de
   datos (ver README).
   ============================================================ */
const ORDERS_FILE = path.join(__dirname, "orders_data", "orders.json");

function leerPedidos() {
  try {
    return JSON.parse(fs.readFileSync(ORDERS_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function guardarPedido(pedido) {
  const pedidos = leerPedidos();
  pedidos.unshift(pedido);
  fs.mkdirSync(path.dirname(ORDERS_FILE), { recursive: true });
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(pedidos, null, 2));
}

/* ============================================================
   VALIDACIÓN
   ============================================================ */
const PROVINCIAS = JSON.parse(fs.readFileSync(path.join(__dirname, "data", "provincias.json"), "utf-8"));

function validarPedido(body) {
  const errores = [];
  const { oferta, nombre, apellido, telefono, provincia, ciudad, direccion, metodoPago } = body;

  if (!OFERTAS[oferta]) errores.push("Oferta inválida.");
  if (!nombre?.trim()) errores.push("Falta el nombre.");
  if (!apellido?.trim()) errores.push("Falta el apellido.");
  if (!/^[0-9+\s-]{10,}$/.test(telefono || "")) errores.push("Teléfono inválido.");
  if (!PROVINCIAS[provincia]) {
    errores.push("Provincia inválida.");
  } else if (!PROVINCIAS[provincia].includes(ciudad)) {
    errores.push("Ciudad inválida para esa provincia.");
  }
  if (!direccion?.trim()) errores.push("Falta la dirección.");
  if (metodoPago !== "contra_entrega") errores.push("Método de pago no disponible todavía.");

  return errores;
}

/* ============================================================
   SERVIDOR
   ============================================================ */
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/provincias", (_req, res) => res.json(PROVINCIAS));
app.get("/api/ofertas", (_req, res) => res.json(OFERTAS));

app.post("/api/orders", async (req, res) => {
  const errores = validarPedido(req.body);
  if (errores.length) return res.status(400).json({ ok: false, errores });

  const oferta = OFERTAS[req.body.oferta];
  const pedido = {
    id: crypto.randomUUID().slice(0, 8),
    fecha: new Date().toISOString(),
    ofertaId: req.body.oferta,
    ofertaEtiqueta: oferta.etiqueta,
    total: oferta.precio,
    nombre: req.body.nombre.trim(),
    apellido: req.body.apellido.trim(),
    telefono: req.body.telefono.trim(),
    provincia: req.body.provincia,
    ciudad: req.body.ciudad,
    direccion: req.body.direccion.trim(),
    referencia: (req.body.referencia || "").trim(),
    metodoPago: req.body.metodoPago,
    estado: "nuevo",
  };

  guardarPedido(pedido);
  avisarPorWhatsApp(pedido).catch((e) => console.error(e));

  res.json({ ok: true, id: pedido.id });
});

/* ============================================================
   PANEL DE PEDIDOS (/admin) — protegido con usuario y contraseña
   ============================================================ */
function requireLogin(req, res, next) {
  if (!ADMIN_PASSWORD) return res.status(503).send("Configura ADMIN_PASSWORD en las variables de entorno para ver los pedidos.");
  const header = req.get("authorization") || "";
  const [scheme, encoded] = header.split(" ");
  let ok = false;
  if (scheme === "Basic" && encoded) {
    const [user, pass] = Buffer.from(encoded, "base64").toString().split(":");
    const userOk = user?.length === ADMIN_USER.length && crypto.timingSafeEqual(Buffer.from(user), Buffer.from(ADMIN_USER));
    const passOk = pass?.length === ADMIN_PASSWORD.length && crypto.timingSafeEqual(Buffer.from(pass), Buffer.from(ADMIN_PASSWORD));
    ok = userOk && passOk;
  }
  if (!ok) {
    res.set("WWW-Authenticate", 'Basic realm="Pedidos BaitX"');
    return res.status(401).send("Acceso requerido");
  }
  next();
}

function esc(s = "") {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

app.get("/admin", requireLogin, (_req, res) => {
  const pedidos = leerPedidos();
  const filas = pedidos
    .map(
      (p) => `
      <tr>
        <td>${esc(p.id)}</td>
        <td>${new Date(p.fecha).toLocaleString("es-DO")}</td>
        <td>${esc(p.nombre)} ${esc(p.apellido)}<br><small>${esc(p.telefono)}</small></td>
        <td>${esc(p.ofertaEtiqueta)}<br><strong>RD$${p.total}</strong></td>
        <td>${esc(p.ciudad)}, ${esc(p.provincia)}<br><small>${esc(p.direccion)}${p.referencia ? " — " + esc(p.referencia) : ""}</small></td>
        <td>${esc(p.metodoPago)}</td>
      </tr>`
    )
    .join("");

  res.set("Content-Type", "text/html; charset=utf-8").send(`<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pedidos BaitX</title>
<style>
  body { font-family: system-ui, sans-serif; background: #f4f4f4; margin: 0; padding: 16px; }
  h1 { font-size: 1.2rem; }
  table { width: 100%; border-collapse: collapse; background: #fff; }
  th, td { text-align: left; padding: 10px; border-bottom: 1px solid #eee; font-size: .9rem; vertical-align: top; }
  th { background: #fafafa; }
  .empty { color: #777; }
</style></head><body>
  <h1>📋 Pedidos BaitX (${pedidos.length})</h1>
  ${pedidos.length ? `<table><tr><th>ID</th><th>Fecha</th><th>Cliente</th><th>Pedido</th><th>Entrega</th><th>Pago</th></tr>${filas}</table>` : '<p class="empty">Todavía no hay pedidos.</p>'}
</body></html>`);
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`Tienda BaitX escuchando en puerto ${PORT}`));

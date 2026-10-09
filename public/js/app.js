const WHATSAPP_NUMERO = "18295652391"; // EDITAR si cambia el número del negocio

let OFERTAS = {};
let PROVINCIAS = {};
let ofertaSeleccionada = null;

const money = (n) => `RD$${Number(n).toLocaleString("es-DO")}`;

/* ---------- Carga inicial ---------- */
async function init() {
  document.getElementById("footer-whatsapp").href = `https://wa.me/${WHATSAPP_NUMERO}`;

  const [ofertasRes, provinciasRes] = await Promise.all([
    fetch("/api/ofertas"),
    fetch("/api/provincias"),
  ]);
  OFERTAS = await ofertasRes.json();
  PROVINCIAS = await provinciasRes.json();

  renderOfertas();
  renderProvincias();
  initStickyBuy();
  initModal();
}

/* ---------- Tarjetas de oferta ---------- */
function renderOfertas() {
  const grid = document.getElementById("ofertas-grid");
  const ids = Object.keys(OFERTAS);
  const destacadaId = ids[ids.length - 1]; // la última oferta se resalta (ajústalo si quieres otra)

  grid.innerHTML = ids
    .map((id) => {
      const o = OFERTAS[id];
      const destacada = id === destacadaId;
      return `
      <div class="oferta-card${destacada ? " oferta-card--destacada" : ""}">
        ${destacada ? '<span class="oferta-tag">Más pedida</span>' : ""}
        <p class="oferta-unidades">${o.unidades} ${o.unidades === 1 ? "jeringa" : "jeringas"} de 30g</p>
        <p class="oferta-precio">${money(o.precio)}</p>
        <button class="btn btn-primary btn-full" data-oferta="${id}">Pedir esta oferta</button>
      </div>`;
    })
    .join("");

  grid.querySelectorAll("[data-oferta]").forEach((btn) => {
    btn.addEventListener("click", () => abrirCheckout(btn.dataset.oferta));
  });
}

/* ---------- Provincias / ciudades ---------- */
function renderProvincias() {
  const select = document.getElementById("provincia");
  Object.keys(PROVINCIAS).forEach((prov) => {
    const opt = document.createElement("option");
    opt.value = prov;
    opt.textContent = prov;
    select.appendChild(opt);
  });

  select.addEventListener("change", () => {
    const ciudadSelect = document.getElementById("ciudad");
    const ciudades = PROVINCIAS[select.value] || [];
    ciudadSelect.innerHTML = ciudades.length
      ? `<option value="">Selecciona…</option>` + ciudades.map((c) => `<option value="${c}">${c}</option>`).join("")
      : `<option value="">Primero elige provincia</option>`;
    ciudadSelect.disabled = ciudades.length === 0;
  });
}

/* ---------- Botón flotante ---------- */
function initStickyBuy() {
  const btn = document.getElementById("sticky-buy");
  const ofertasSection = document.getElementById("ofertas");

  btn.addEventListener("click", () => ofertasSection.scrollIntoView({ behavior: "smooth" }));

  window.addEventListener("scroll", () => {
    const afterHero = window.scrollY > window.innerHeight * 0.6;
    const beforeOfertas = window.scrollY + window.innerHeight < ofertasSection.offsetTop;
    btn.classList.toggle("visible", afterHero);
  });
}

/* ---------- Modal de checkout ---------- */
function initModal() {
  const overlay = document.getElementById("checkout-overlay");
  const closeBtn = document.getElementById("checkout-close");
  const doneBtn = document.getElementById("checkout-done");
  const form = document.getElementById("checkout-form");

  closeBtn.addEventListener("click", cerrarCheckout);
  doneBtn.addEventListener("click", cerrarCheckout);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) cerrarCheckout(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !overlay.hidden) cerrarCheckout(); });

  form.addEventListener("submit", enviarPedido);
}

function abrirCheckout(ofertaId) {
  ofertaSeleccionada = ofertaId;
  const o = OFERTAS[ofertaId];
  document.getElementById("checkout-resumen").textContent = `${o.unidades} ${o.unidades === 1 ? "jeringa" : "jeringas"} — ${money(o.precio)}`;

  document.getElementById("checkout-form-wrap").hidden = false;
  document.getElementById("checkout-success").hidden = true;
  document.getElementById("checkout-error").hidden = true;
  document.getElementById("checkout-overlay").hidden = false;
  document.body.style.overflow = "hidden";
}

function cerrarCheckout() {
  document.getElementById("checkout-overlay").hidden = true;
  document.body.style.overflow = "";
}

async function enviarPedido(e) {
  e.preventDefault();
  const form = e.target;
  const submitBtn = document.getElementById("checkout-submit");
  const errorBox = document.getElementById("checkout-error");
  errorBox.hidden = true;

  const data = Object.fromEntries(new FormData(form).entries());
  data.oferta = ofertaSeleccionada;

  submitBtn.disabled = true;
  submitBtn.textContent = "Enviando…";

  try {
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await res.json();

    if (!result.ok) {
      errorBox.textContent = result.errores?.join(" ") || "No se pudo procesar el pedido.";
      errorBox.hidden = false;
      return;
    }

    document.getElementById("checkout-form-wrap").hidden = true;
    document.getElementById("checkout-success").hidden = false;
    document.querySelector(".checkout-order-id").textContent = `N.º de pedido: ${result.id}`;
    form.reset();
  } catch {
    errorBox.textContent = "Hubo un problema de conexión. Intenta de nuevo.";
    errorBox.hidden = false;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Confirmar pedido";
  }
}

init();

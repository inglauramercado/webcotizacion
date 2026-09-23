const currency = new Intl.NumberFormat("es-CO", {
  style: "currency", currency: "COP", maximumFractionDigits: 0
});

let products = [];
let backendRecords = [];
let selectedRecordId = null;
let initialLoadTimer = null;
let dataReady = false;

const byId = (id) => document.getElementById(id);
const money = (value) => currency.format(Number(value || 0));
const rawNumber = (value) => {
  const n = parseFloat(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

function showToast(message) {
  byId("toast-text").textContent = message;
  byId("toast").classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => byId("toast").classList.remove("show"), 4200);
}

function formatDate(dateValue) {
  if (!dateValue) return "Fecha por definir";
  const parts = dateValue.split("-");
  return parts.length === 3 ? parts[2] + "/" + parts[1] + "/" + parts[0] : dateValue;
}

function generateQuoteNumber() {
  const now = new Date();
  return "LULA-" + now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + String(now.getDate()).padStart(2, "0") + "-" + Math.floor(100 + Math.random() * 900);
}

function defaultProduct() {
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
    name: "",
    description: "",
    quantity: 1,
    price: ""
  };
}

function initialProduct() {
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    name: "",
    description: "",
    quantity: "",
    price: ""
  };
}

function productSubtotal(product) {
  return rawNumber(product.quantity) * rawNumber(product.price);
}

function renderProducts() {
  const list = byId("products-list");
  list.innerHTML = "";
  products.forEach((product, index) => {
    const row = document.createElement("div");
    row.className = "product-row";
    row.dataset.productId = product.id;
    row.innerHTML = `
          <div class="wide">
            <input id="product-name-${product.id}" class="field product-input" data-field="name" type="text" placeholder="Describe el producto" value="${escapeHtml(product.name)}">
          </div>
          <div class="wide">
            <input id="product-description-${product.id}" class="field product-input" data-field="description" type="text" placeholder="Detalles, acabados o medidas" value="${escapeHtml(product.description)}">
          </div>
          <div>
            <input id="product-quantity-${product.id}" class="field product-input" data-field="quantity" type="number" min="0" step="1" value="${escapeHtml(String(product.quantity))}">
          </div>
          <div>
            <input id="product-price-${product.id}" class="field product-input" data-field="price" type="number" min="0" step="0.01" placeholder="Editar precio" value="${escapeHtml(String(product.price))}">
          </div>
          <div>
            <output class="money-output product-subtotal">${money(productSubtotal(product))}</output>
          </div>
          <div class="remove-wrap">
            <button type="button" class="remove-product min-h-11 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 focus:outline-none focus:ring-4 focus:ring-rose-100" aria-label="Eliminar producto ${index + 1}">
              <i data-lucide="trash-2" class="w-4 h-4 mx-auto" aria-hidden="true"></i>
            </button>
          </div>
        `;
    list.appendChild(row);
  });
  if (window.lucide) lucide.createIcons();
  updateTotals();
}

function escapeHtml(value) {
  return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function validateProducts() {
  let invalid = false;
  products.forEach(product => {
    if (String(product.quantity).trim() !== "" && rawNumber(product.quantity) !== Number(product.quantity)) invalid = true;
    if (String(product.price).trim() !== "" && Number(product.price) < 0) invalid = true;
  });
  const note = byId("product-validation");
  note.classList.toggle("hidden", !invalid);
  note.textContent = invalid ? "Revisa las cantidades y precios: deben ser valores iguales o mayores que cero." : "";
  return !invalid;
}

function calculate() {
  const subtotal = products.reduce((sum, product) => sum + productSubtotal(product), 0);
  const discountRate = Math.min(100, rawNumber(byId("discount").value));
  const shipping = rawNumber(byId("shipping").value);
  const taxRate = Math.min(100, rawNumber(byId("taxes").value));
  const discountAmount = subtotal * (discountRate / 100);
  const taxableBase = Math.max(0, subtotal - discountAmount + shipping);
  const taxAmount = taxableBase * (taxRate / 100);
  return {
    subtotal, discountRate, shipping, taxRate, discountAmount, taxAmount,
    total: taxableBase + taxAmount
  };
}

function updateTotals() {
  const totals = calculate();
  byId("subtotal-general").textContent = money(totals.subtotal);
  byId("discount-amount").textContent = "− " + money(totals.discountAmount);
  byId("tax-amount").textContent = "+ " + money(totals.taxAmount);
  byId("final-total").textContent = money(totals.total);
  byId("summary-total").textContent = money(totals.total);
  byId("summary-number").textContent = "Cotización " + (byId("quote-number").value || "nueva");
  document.querySelectorAll(".product-row").forEach(row => {
    const item = products.find(p => p.id === row.dataset.productId);
    const output = row.querySelector(".product-subtotal");
    if (item && output) output.textContent = money(productSubtotal(item));
  });
  updatePrintPreview();
}

function getFormData() {
  const totals = calculate();
  return {
    quote_number: byId("quote-number").value,
    quote_date: byId("quote-date").value,
    client_name: byId("client-name").value.trim(),
    client_identification: byId("client-identification").value.trim(),
    client_phone: byId("client-phone").value.trim(),
    client_email: byId("client-email").value.trim(),
    client_address: byId("client-address").value.trim(),
    products: JSON.stringify(products),
    discount: rawNumber(byId("discount").value),
    shipping: rawNumber(byId("shipping").value),
    taxes: rawNumber(byId("taxes").value),
    advance: rawNumber(byId("advance").value),
    total: totals.total,
    production_time: byId("production-time").value.trim(),
    offer_validity: byId("offer-validity").value.trim(),
    payment_method: byId("payment-method").value.trim(),
    notes: byId("notes").value.trim(),
    business_contact: byId("business-contact").value.trim(),
    updated_at: new Date().toISOString()
  };
}

function setFormData(record) {
  selectedRecordId = record.__backendId || null;
  byId("quote-number").value = record.quote_number || generateQuoteNumber();
  byId("quote-date").value = record.quote_date || "";
  byId("client-name").value = record.client_name || "";
  byId("client-identification").value = record.client_identification || "";
  byId("client-phone").value = record.client_phone || "";
  byId("client-email").value = record.client_email || "";
  byId("client-address").value = record.client_address || "";
  byId("discount").value = record.discount || "";
  byId("shipping").value = record.shipping || "";
  byId("taxes").value = record.taxes || "";
  byId("advance").value = record.advance || "";
  byId("production-time").value = record.production_time || "";
  byId("offer-validity").value = record.offer_validity || "";
  byId("payment-method").value = record.payment_method || "";
  byId("notes").value = record.notes || "";
  byId("business-contact").value = record.business_contact || "";
  try {
    const parsed = JSON.parse(record.products || "[]");
    products = Array.isArray(parsed) && parsed.length ? parsed.map(p => ({
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
      name: p.name || "", description: p.description || "",
      quantity: p.quantity ?? 1, price: p.price ?? ""
    })) : [defaultProduct()];
  } catch {
    products = [defaultProduct()];
  }
  byId("save-state").textContent = selectedRecordId ? "Editando una cotización guardada" : "Nueva cotización";
  renderProducts();
  renderSavedList();
}

function resetQuote() {
  selectedRecordId = null;
  byId("quote-number").value = generateQuoteNumber();
  byId("quote-date").value = new Date().toISOString().slice(0, 10);
  ["client-name", "client-identification", "client-phone", "client-email", "client-address", "discount", "shipping", "taxes", "advance", "production-time", "offer-validity", "payment-method", "notes", "business-contact"].forEach(id => byId(id).value = "");
  products = [initialProduct()];
  byId("save-state").textContent = "Nueva cotización sin guardar";
  renderProducts();
  renderSavedList();
}

function renderSavedList() {
  const list = byId("saved-list");
  list.innerHTML = "";
  byId("quote-count").textContent = backendRecords.length + " / 999";
  if (!dataReady) {
    byId("data-message").textContent = "Cargando cotizaciones guardadas…";
    return;
  }
  if (!backendRecords.length) {
    byId("data-message").textContent = "Aún no hay cotizaciones guardadas. Cuando guardes una, aparecerá aquí.";
    return;
  }
  byId("data-message").textContent = "";
  backendRecords.slice().sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at))).forEach(record => {
    const card = document.createElement("article");
    card.className = "saved-item border-2 border-purple-100 rounded-2xl p-4 bg-white " + (record.__backendId === selectedRecordId ? "active" : "");
    card.innerHTML = `
          <p class="font-extrabold text-purple-900">${escapeHtml(record.quote_number || "Sin número")}</p>
          <p class="text-xs mt-1 text-purple-700">${escapeHtml(record.client_name || "Cliente por definir")} · ${escapeHtml(formatDate(record.quote_date))}</p>
          <p class="font-bold mt-3">${money(record.total)}</p>
          <div class="grid grid-cols-2 gap-2 mt-4">
            <button type="button" class="load-record min-h-10 rounded-xl bg-purple-100 text-purple-800 text-sm font-bold hover:bg-purple-200">Abrir</button>
            <button type="button" class="delete-record min-h-10 rounded-xl border border-rose-200 text-rose-700 text-sm font-bold hover:bg-rose-50">Eliminar</button>
          </div>
          <div class="delete-confirm hidden mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">
            <p class="font-semibold">¿Eliminar esta cotización?</p>
            <div class="flex gap-2 mt-2">
              <button type="button" class="confirm-delete px-3 py-1.5 bg-rose-700 text-white rounded-lg font-bold">Sí, eliminar</button>
              <button type="button" class="cancel-delete px-3 py-1.5 border border-rose-200 rounded-lg font-bold">Cancelar</button>
            </div>
          </div>
        `;
    card.querySelector(".load-record").addEventListener("click", () => {
      setFormData(record);
      document.getElementById("editor-area").scrollIntoView({ behavior: "smooth", block: "start" });
      showToast("Cotización cargada para editar.");
    });
    card.querySelector(".delete-record").addEventListener("click", () => card.querySelector(".delete-confirm").classList.remove("hidden"));
    card.querySelector(".cancel-delete").addEventListener("click", () => card.querySelector(".delete-confirm").classList.add("hidden"));
    card.querySelector(".confirm-delete").addEventListener("click", async (event) => deleteRecord(event.currentTarget, record));
    list.appendChild(card);
  });
}

function updateClientPreview() {
  const data = getFormData();
  const totals = calculate();
  byId("preview-client").innerHTML = `<div><b>CLIENTE:</b> ${escapeHtml(data.client_name || "Por definir")}<br>${data.client_identification ? `<b>IDENTIFICACIÓN:</b> ${escapeHtml(data.client_identification)}<br>` : ""}<b>CORREO:</b> ${escapeHtml(data.client_email || "Por definir")}<br><b>CONTACTO:</b> ${escapeHtml(data.client_phone || "Por definir")}</div><div><b>Cotización N.º</b> ${escapeHtml(data.quote_number || "Nueva")}<br><b>Fecha:</b> ${escapeHtml(formatDate(data.quote_date))}</div>`;
  byId("preview-products").innerHTML = products.map(p => `<tr><td>${escapeHtml(p.name || "Producto por definir")}<br><small>${escapeHtml(p.description || "")}</small></td><td>${escapeHtml(String(p.quantity || 0))}</td><td>${money(p.price)}</td><td>${money(productSubtotal(p))}</td></tr>`).join("");
  const pending = Math.max(0, totals.total - rawNumber(data.advance));
  byId("preview-values").innerHTML = `<div class="flex justify-between"><span>TOTAL</span><strong>${money(totals.total)}</strong></div>${totals.discountAmount ? `<div class="flex justify-between text-sm"><span>Descuento</span><strong>− ${money(totals.discountAmount)}</strong></div>` : ""}${totals.shipping ? `<div class="flex justify-between text-sm"><span>Envío</span><strong>${money(totals.shipping)}</strong></div>` : ""}${totals.taxAmount ? `<div class="flex justify-between text-sm"><span>Impuestos</span><strong>${money(totals.taxAmount)}</strong></div>` : ""}<div class="flex justify-between"><span>ANTICIPO RECIBIDO</span><strong>${money(data.advance)}</strong></div><div class="flex justify-between border-t border-purple-200 pt-3"><span>PENDIENTE</span><strong>${money(pending)}</strong></div>`;
}

function summaryText() {
  return byId("preview-client").innerText + "\n" + byId("preview-products").innerText + "\n" + byId("preview-values").innerText;
}

function showCopySummary() {
  const panel = byId("copy-summary-panel");
  panel.classList.remove("hidden");
  byId("copy-summary-text").value = summaryText();
  byId("copy-summary-text").focus();
}

function createBackupDownload() {
  try {
    const blob = new Blob([JSON.stringify(getFormData(), null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = byId("backup-download");
    link.href = url;
    link.download = `cotizacion-${(getFormData().quote_number || "respaldo").replace(/[^a-z0-9_-]/gi, "-")}.json`;
    byId("backup-panel").classList.remove("hidden");
  } catch (error) {
    byId("backup-panel").classList.remove("hidden");
  }
}

function updatePrintPreview() {
  updateClientPreview();
  const data = getFormData();
  const totals = calculate();
  byId("print-number").textContent = "Cotización N.º " + (data.quote_number || "Sin número");
  byId("print-client-name").textContent = data.client_name || " ";
  byId("print-client-id").textContent = data.client_identification || " ";
  byId("print-client-email").textContent = data.client_email || " ";
  byId("print-client-phone").textContent = data.client_phone || " ";
  byId("print-date").textContent = "Fecha: " + formatDate(data.quote_date);
  byId("print-conditions").textContent = [
    data.production_time && "Elaboración: " + data.production_time,
    data.offer_validity && "Vigencia: " + data.offer_validity,
    data.payment_method && "Pago: " + data.payment_method
  ].filter(Boolean).join("\n") || "Condiciones por definir";
  byId("print-products").innerHTML = products.map(p => `
        <tr><td>${escapeHtml((p.name || "Producto por definir") + (p.description ? " — " + p.description : ""))}</td><td>${escapeHtml(String(p.quantity || 0))}</td><td>${money(p.price)}</td><td>${money(productSubtotal(p))}</td></tr>
      `).join("");
  byId("print-total").textContent = money(totals.total);
  byId("print-advance").textContent = money(data.advance);
  byId("print-pending").textContent = money(Math.max(0, totals.total - data.advance));
  byId("print-notes").textContent = data.notes ? "Observaciones: " + data.notes : "";
  byId("print-contact").textContent = data.business_contact || "";
}

const STORAGE_KEY = "lula-cotizaciones-v1";
const LOGO_KEY = "lula-logo-v1";
function persistRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(backendRecords));
  renderSavedList();
}
function initializeDataSdk() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    backendRecords = Array.isArray(parsed) ? parsed.filter(r => r && typeof r === "object") : [];
    dataReady = true;
    renderSavedList();
  } catch (error) {
    dataReady = false;
    byId("data-message").textContent = "No se pudieron leer los datos guardados. Descarga un respaldo antes de continuar.";
  }
}
function saveQuote(button) {
  if (!validateProducts()) return;
  if (!dataReady) { showToast("No se puede acceder al almacenamiento de este navegador."); return; }
  const record = getFormData();
  const editing = !!selectedRecordId;
  const id = selectedRecordId || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
  if (!editing && backendRecords.length >= 999) { showToast("Llegaste al límite de 999 cotizaciones."); return; }
  const next = backendRecords.filter(r => r.__backendId !== id);
  next.push({ ...record, __backendId: id });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    backendRecords = next;
    selectedRecordId = id;
    byId("save-state").textContent = "Cotización guardada en este navegador";
    renderSavedList();
    showToast(editing ? "Cotización actualizada." : "Cotización guardada.");
  } catch (error) {
    byId("save-state").textContent = "No se pudo guardar; descarga una copia como respaldo";
    createBackupDownload();
    showToast("El navegador no tiene espacio suficiente o bloqueó el guardado.");
  }
}
function deleteRecord(button, record) {
  try {
    const next = backendRecords.filter(r => r.__backendId !== record.__backendId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    backendRecords = next;
    if (selectedRecordId === record.__backendId) resetQuote();
    renderSavedList();
    showToast("Cotización eliminada.");
  } catch (error) { showToast("No se pudo eliminar la cotización."); }
}
function downloadBlob(contents, filename, type) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const a = document.createElement("a"); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
function refreshLogo() {
  const logo = localStorage.getItem(LOGO_KEY) || "logo.svg";
  document.querySelectorAll(".canva-image").forEach(image => image.src = logo);
}
document.addEventListener("DOMContentLoaded", () => {
  const hiddenNumber = document.createElement("input");
  hiddenNumber.type = "hidden";
  hiddenNumber.id = "quote-number";
  document.body.appendChild(hiddenNumber);

  resetQuote();
  initializeDataSdk();
  if (window.lucide) lucide.createIcons();

  byId("add-product").addEventListener("click", () => {
    products.push(defaultProduct());
    renderProducts();
    const inputs = document.querySelectorAll("#products-list .product-row:last-child input");
    if (inputs[0]) inputs[0].focus();
  });

  byId("products-list").addEventListener("input", (event) => {
    const input = event.target;
    if (!input.classList.contains("product-input")) return;
    const row = input.closest(".product-row");
    const product = products.find(p => p.id === row.dataset.productId);
    if (!product) return;
    product[input.dataset.field] = input.value;
    if ((input.dataset.field === "quantity" || input.dataset.field === "price") && Number(input.value) < 0) input.classList.add("field-invalid");
    else input.classList.remove("field-invalid");
    updateTotals();
  });

  byId("products-list").addEventListener("click", (event) => {
    const button = event.target.closest(".remove-product");
    if (!button) return;
    if (products.length === 1) {
      products[0] = defaultProduct();
    } else {
      products = products.filter(p => p.id !== button.closest(".product-row").dataset.productId);
    }
    renderProducts();
  });

  ["discount", "shipping", "taxes", "advance", "quote-date", "client-name", "client-identification", "client-phone", "client-email", "client-address", "production-time", "offer-validity", "payment-method", "notes", "business-contact"].forEach(id => {
    byId(id).addEventListener("input", updateTotals);
    byId(id).addEventListener("change", updateTotals);
  });

  byId("new-quote").addEventListener("click", () => {
    resetQuote();
    showToast("Nueva cotización lista para editar.");
  });
  byId("save-quote").addEventListener("click", (event) => saveQuote(event.currentTarget));
  byId("print-quote").addEventListener("click", () => window.print());
  byId("preview-print").addEventListener("click", () => window.print());
  byId("preview-pdf").addEventListener("click", () => { byId("download-note").textContent = "En Destino selecciona Guardar como PDF y pulsa Guardar."; window.print(); });
  byId("preview-copy").addEventListener("click", showCopySummary);
  byId("preview-edit").addEventListener("click", () => byId("editor-area").scrollIntoView({ behavior: "smooth" }));

  byId("export-data").addEventListener("click", () => downloadBlob(JSON.stringify({ version: 1, quotes: backendRecords }, null, 2), "respaldo-cotizaciones-lula.json", "application/json"));
  byId("import-data").addEventListener("change", async event => {
    const file = event.target.files[0]; if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.quotes) || data.quotes.length > 999 || !data.quotes.every(q => q && typeof q === "object" && typeof q.quote_number === "string" && typeof q.products === "string" && Array.isArray(JSON.parse(q.products)))) throw Error("Formato incorrecto");
      const next = data.quotes.map(q => ({ ...q, __backendId: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()) }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      backendRecords = next; selectedRecordId = null; renderSavedList();
      showToast("Respaldo importado correctamente.");
    } catch { showToast("No se pudo importar. Comprueba que sea un respaldo de este cotizador y que haya espacio disponible."); }
    event.target.value = "";
  });
});

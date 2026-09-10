const state = {
  screen: "dashboard",
  loading: false,
  filters: { materials: "", inventory: "", orders: "" },
};

const screens = {
  dashboard: ["Centro empresarial", "Órdenes, inventario y ejecución logística"],
  materials: ["Maestro de materiales", "10.000 productos normalizados y sus lotes"],
  inventory: ["Disponibilidad de inventario", "Existencia física, reservas y saldo disponible"],
  orders: ["Órdenes empresariales", "Transferencias internas y control formal de estados"],
  movements: ["Documentos de material", "Entradas, salidas y transferencias de inventario"],
  integration: ["Monitor de integración", "Eventos para LOGISTPULSE y trazabilidad completa"],
};

const statusNames = {
  DRAFT: "Borrador", VALIDATED: "Validada", RESERVED: "Reservada", RELEASED: "Liberada",
  IN_EXECUTION: "En ejecución", COMPLETED: "Completada", CANCELLED: "Cancelada",
  PENDING: "Pendiente", PUBLISHED: "Publicado", FAILED: "Fallido",
};

const flow = ["DRAFT", "VALIDATED", "RESERVED", "RELEASED", "IN_EXECUTION", "COMPLETED"];
const actionByStatus = {
  DRAFT: ["validate", "Validar datos"],
  VALIDATED: ["reserve", "Reservar inventario"],
  RESERVED: ["release", "Liberar a logística"],
  RELEASED: ["start", "Iniciar ejecución"],
  IN_EXECUTION: ["confirm", "Confirmar movimiento 311"],
};

const content = document.querySelector("#content");
const modal = document.querySelector("#modal-backdrop");
const modalTitle = document.querySelector("#modal-title");
const modalBody = document.querySelector("#modal-body");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function number(value, maximumFractionDigits = 0) {
  return new Intl.NumberFormat("es-EC", { maximumFractionDigits }).format(Number(value ?? 0));
}

function dateTime(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function badge(status) {
  return `<span class="badge ${escapeHtml(status)}">${escapeHtml(statusNames[status] ?? status)}</span>`;
}

function showToast(message, isError = false) {
  const item = document.createElement("div");
  item.className = `toast${isError ? " error" : ""}`;
  item.textContent = message;
  document.querySelector("#toast-container").append(item);
  setTimeout(() => item.remove(), 3600);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", "X-Actor": "roberto@pulse.local", ...(options.headers ?? {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message ?? `Error HTTP ${response.status}`);
  return payload;
}

function loading() {
  content.innerHTML = `<div class="loading"><div><div class="spinner"></div><p>Cargando información empresarial…</p></div></div>`;
}

function metric(label, value, detail, icon, color, wash) {
  return `<article class="metric" style="--metric-color:${color};--metric-wash:${wash}">
    <div class="metric-icon">${icon}</div><div class="metric-label">${label}</div>
    <div class="metric-value">${value}</div><div class="metric-detail">${detail}</div></article>`;
}

function pipeline(status) {
  const current = flow.indexOf(status);
  return `<div class="pipeline">${flow.map((step, index) => {
    const klass = status === "CANCELLED" ? "" : index < current ? "complete" : index === current ? "current" : "";
    return `<div class="pipeline-step ${klass}"><div><span>${index < current ? "✓" : index + 1}</span>${statusNames[step]}</div></div>`;
  }).join("")}</div>`;
}

function orderAction(orderNumber, status, dark = false) {
  const action = actionByStatus[status];
  if (!action) return "";
  return `<button class="button ${dark ? "primary" : "primary"} order-action" data-order="${escapeHtml(orderNumber)}" data-action="${action[0]}">${action[1]}</button>`;
}

async function renderDashboard() {
  const data = await api("/api/dashboard");
  let focus;
  try { focus = await api("/api/orders/ORD-000001"); } catch { focus = data.recentOrders?.[0]; }
  const openOrders = Object.entries(data.orders ?? {}).filter(([key]) => !["COMPLETED", "CANCELLED"].includes(key)).reduce((sum, [, value]) => sum + Number(value), 0);
  const inventory = data.inventory ?? {};
  const recentRows = (data.recentOrders ?? []).map((order) => `<tr>
    <td><button class="link-button order-detail" data-order="${escapeHtml(order.order_number)}">${escapeHtml(order.order_number)}</button></td>
    <td>${badge(order.status)}</td><td><span class="priority ${escapeHtml(order.priority)}">${escapeHtml(order.priority)}</span></td>
    <td>${number(order.item_count)}</td><td>${number(order.total_quantity, 3)}</td><td>${dateTime(order.due_at)}</td></tr>`).join("");
  const activities = (focus?.audit ?? []).slice(0, 5).map((entry) => `<div class="activity"><i></i><div><strong>${escapeHtml(entry.action.replaceAll("_", " "))}</strong><small>${escapeHtml(entry.actor)} · ${dateTime(entry.occurred_at)}</small></div></div>`).join("");
  content.innerHTML = `<div class="section-stack">
    <section class="metrics">
      ${metric("Órdenes abiertas", number(openOrders), "requieren procesamiento", "O", "#1456d9", "#eaf1ff")}
      ${metric("Inventario disponible", number(inventory.available_units), `${number(inventory.reserved_units)} unidades reservadas`, "I", "#15805d", "#e9f8f1")}
      ${metric("Tareas logísticas", number(data.openTasks), "liberadas o en ejecución", "T", "#b86a00", "#fff6e5")}
      ${metric("Movimientos de hoy", number(data.movementsToday), "documentos contabilizados", "311", "#6d4bd2", "#f1edff")}
    </section>
    ${focus ? `<section class="order-focus">
      <div class="order-focus-top"><div><p class="eyebrow">PULSE VERTICAL SLICE V1</p><h2>${escapeHtml(focus.order_number)}</h2><p>Transferencia interna · ${escapeHtml(focus.items?.[0]?.material_code ?? "Material")} · ${number(focus.items?.[0]?.quantity ?? 0)} unidades</p></div>${badge(focus.status)}</div>
      ${pipeline(focus.status)}
      <div class="focus-actions">${orderAction(focus.order_number, focus.status, true)}<button class="button secondary order-detail" data-order="${escapeHtml(focus.order_number)}">Ver trazabilidad</button></div>
    </section>` : ""}
    <section class="grid-main">
      <article class="card"><div class="card-header"><div><h2>Órdenes recientes</h2><p>Estado empresarial y compromiso de entrega</p></div><button class="button secondary compact nav-jump" data-screen="orders">Ver todas</button></div><div class="table-wrap"><table><thead><tr><th>Orden</th><th>Estado</th><th>Prioridad</th><th>Líneas</th><th>Cantidad</th><th>Fecha requerida</th></tr></thead><tbody>${recentRows}</tbody></table></div></article>
      <article class="card"><div class="card-header"><div><h2>Auditoría de ORD-000001</h2><p>Últimas transiciones registradas</p></div></div><div class="card-body"><div class="activity-list">${activities || '<div class="empty"><strong>Orden sin transiciones</strong>Ejecute el siguiente paso del flujo.</div>'}</div></div></article>
    </section>
  </div>`;
}

async function renderMaterials() {
  const q = encodeURIComponent(state.filters.materials);
  const data = await api(`/api/materials?q=${q}&limit=50`);
  const rows = data.items.map((item) => `<tr><td><strong>${escapeHtml(item.material_code)}</strong></td><td>${escapeHtml(item.description)}</td><td>${escapeHtml(item.category)}</td><td>${escapeHtml(item.uom_code)}</td><td>${number(item.weight_kg, 3)} kg</td><td>${number(item.batch_count)}</td><td>${item.active ? '<span class="badge COMPLETED">Activo</span>' : '<span class="badge CANCELLED">Inactivo</span>'}</td></tr>`).join("");
  content.innerHTML = `<div class="section-stack"><div class="toolbar"><input class="search" id="material-search" value="${escapeHtml(state.filters.materials)}" placeholder="Buscar código o descripción…"><div class="plant-chip">${number(data.total)} materiales registrados</div></div>
  <article class="card"><div class="card-header"><div><h2>Catálogo de materiales</h2><p>Dependencia funcional: materialCode → descripción, unidad, categoría y peso</p></div></div><div class="table-wrap"><table><thead><tr><th>Código</th><th>Descripción</th><th>Categoría</th><th>Unidad</th><th>Peso</th><th>Lotes</th><th>Estado</th></tr></thead><tbody>${rows}</tbody></table></div></article></div>`;
}

async function renderInventory() {
  const q = encodeURIComponent(state.filters.inventory);
  const data = await api(`/api/inventory?q=${q}&limit=50`);
  const maximum = Math.max(...data.summary.map((item) => Number(item.available_units)), 1);
  const summaries = data.summary.map((item) => `<div><div class="inventory-bar-label"><span>${escapeHtml(item.location_code)} · ${number(item.sku_count)} SKU</span><strong>${number(item.available_units)} disponibles</strong></div><div class="bar-track"><div class="bar-fill" style="width:${Math.max(4, Number(item.available_units) / maximum * 100)}%"></div></div></div>`).join("");
  const rows = data.items.map((item) => `<tr><td><strong>${escapeHtml(item.material_code)}</strong><br><small>${escapeHtml(item.description)}</small></td><td>${escapeHtml(item.location_code)}</td><td>${escapeHtml(item.batch_number)}</td><td>${number(item.quantity_on_hand, 3)}</td><td>${number(item.quantity_reserved, 3)}</td><td><strong>${number(item.quantity_available, 3)}</strong></td><td>${badge(item.quality_status === "RELEASED" ? "COMPLETED" : item.quality_status)}</td></tr>`).join("");
  content.innerHTML = `<div class="section-stack"><div class="toolbar"><input class="search" id="inventory-search" value="${escapeHtml(state.filters.inventory)}" placeholder="Buscar material en inventario…"><span class="plant-chip">Disponible = físico − reservado</span></div><section class="grid-main"><article class="card"><div class="card-header"><div><h2>Inventario por lote</h2><p>El material se obtiene mediante material_batch</p></div></div><div class="table-wrap"><table><thead><tr><th>Material</th><th>Ubicación</th><th>Lote</th><th>Físico</th><th>Reservado</th><th>Disponible</th><th>Calidad</th></tr></thead><tbody>${rows}</tbody></table></div></article><article class="card"><div class="card-header"><div><h2>Distribución por ubicación</h2><p>Unidades disponibles</p></div></div><div class="card-body"><div class="inventory-bars">${summaries}</div></div></article></section></div>`;
}

async function renderOrders() {
  const q = encodeURIComponent(state.filters.orders);
  const data = await api(`/api/orders?q=${q}`);
  const rows = data.items.map((order) => `<tr><td><button class="link-button order-detail" data-order="${escapeHtml(order.order_number)}">${escapeHtml(order.order_number)}</button></td><td>${escapeHtml(order.order_type.replaceAll("_", " "))}</td><td>${badge(order.status)}</td><td><span class="priority ${escapeHtml(order.priority)}">${escapeHtml(order.priority)}</span></td><td>${number(order.item_count)}</td><td>${number(order.total_quantity, 3)}</td><td>${dateTime(order.due_at)}</td><td>${orderAction(order.order_number, order.status)}</td></tr>`).join("");
  content.innerHTML = `<div class="section-stack"><div class="toolbar"><input class="search" id="order-search" value="${escapeHtml(state.filters.orders)}" placeholder="Buscar orden o creador…"><div class="filter-group">${["Todas","DRAFT","VALIDATED","RESERVED","RELEASED","IN_EXECUTION","COMPLETED"].map((item) => `<button class="filter-button${item === "Todas" ? " active" : ""}" data-order-filter="${item}">${statusNames[item] ?? item}</button>`).join("")}</div></div><article class="card"><div class="card-header"><div><h2>Órdenes de transferencia</h2><p>Cada transición valida reglas, genera auditoría y conserva consistencia</p></div></div><div class="table-wrap"><table><thead><tr><th>Orden</th><th>Tipo</th><th>Estado</th><th>Prioridad</th><th>Líneas</th><th>Cantidad</th><th>Requerida</th><th>Acción</th></tr></thead><tbody>${rows || '<tr><td colspan="8"><div class="empty">No existen órdenes para el filtro.</div></td></tr>'}</tbody></table></div></article></div>`;
}

async function renderMovements() {
  const data = await api("/api/movements");
  const rows = data.items.map((item) => `<tr><td><strong>${escapeHtml(item.document_number)}</strong></td><td><span class="badge IN_EXECUTION">${escapeHtml(item.movement_type)}</span></td><td>${escapeHtml(item.order_number ?? "—")}</td><td>${escapeHtml(item.material_code)}</td><td>${escapeHtml(item.batch_number ?? "—")}</td><td>${number(item.quantity, 3)}</td><td>${escapeHtml(item.source_location ?? "—")} → ${escapeHtml(item.destination_location ?? "—")}</td><td>${dateTime(item.posted_at)}<br><small>${escapeHtml(item.posted_by)}</small></td></tr>`).join("");
  content.innerHTML = `<div class="section-stack"><section class="metrics">${metric("Transferencia", "311", "movimiento entre ubicaciones", "⇄", "#1456d9", "#eaf1ff")}${metric("Documentos", number(new Set(data.items.map(i => i.document_number)).size), "documentos consultados", "D", "#15805d", "#e9f8f1")}${metric("Líneas", number(data.items.length), "movimientos registrados", "L", "#6d4bd2", "#f1edff")}${metric("Auditoría", "100%", "usuario y fecha de registro", "✓", "#b86a00", "#fff6e5")}</section><article class="card"><div class="card-header"><div><h2>Historial de movimientos</h2><p>Documento de material y afectación de inventario</p></div></div><div class="table-wrap"><table><thead><tr><th>Documento</th><th>Tipo</th><th>Orden</th><th>Material</th><th>Lote</th><th>Cantidad</th><th>Movimiento</th><th>Contabilizado</th></tr></thead><tbody>${rows}</tbody></table></div></article></div>`;
}

async function renderIntegration() {
  const [events, audit] = await Promise.all([api("/api/integration/events"), api("/api/integration/audit")]);
  const eventRows = events.items.map((item) => `<tr><td>${badge(item.status)}</td><td><strong>${escapeHtml(item.event_type)}</strong></td><td><button class="link-button order-detail" data-order="${escapeHtml(item.aggregate_id)}">${escapeHtml(item.aggregate_id)}</button></td><td>${dateTime(item.occurred_at)}</td><td>${number(item.retry_count)}</td><td><details><summary>Ver JSON</summary><pre class="json">${escapeHtml(JSON.stringify(item.payload, null, 2))}</pre></details></td></tr>`).join("");
  const auditRows = audit.items.slice(0, 30).map((item) => `<tr><td>${dateTime(item.occurred_at)}</td><td><strong>${escapeHtml(item.action.replaceAll("_", " "))}</strong></td><td>${escapeHtml(item.entity_id)}</td><td>${escapeHtml(item.actor)}</td><td><code>${escapeHtml(item.correlation_id)}</code></td></tr>`).join("");
  content.innerHTML = `<div class="section-stack"><section class="grid-main"><article class="card"><div class="card-header"><div><h2>Transactional Outbox</h2><p>Eventos preparados para LOGISTPULSE</p></div><span class="plant-chip">${number(events.items.length)} eventos</span></div><div class="table-wrap"><table><thead><tr><th>Estado</th><th>Evento</th><th>Agregado</th><th>Creado</th><th>Reintentos</th><th>Payload</th></tr></thead><tbody>${eventRows || '<tr><td colspan="6"><div class="empty"><strong>Sin eventos</strong>Libere una orden para crear TransportRequested.</div></td></tr>'}</tbody></table></div></article><article class="card"><div class="card-header"><div><h2>Contrato de integración</h2><p>Responsabilidades por sistema</p></div></div><div class="card-body"><div class="activity-list"><div class="activity"><i></i><div><strong>ERP-PULSE</strong><small>Orden, material, lote, cantidad e inventario</small></div></div><div class="activity"><i></i><div><strong>LOGISTPULSE</strong><small>Orquestación de la tarea logística</small></div></div><div class="activity"><i></i><div><strong>PULSEFLEET</strong><small>Asignación del AMR y ejecución física</small></div></div></div></div></article></section><article class="card"><div class="card-header"><div><h2>Auditoría empresarial</h2><p>Actor, acción, agregado y correlación</p></div></div><div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Acción</th><th>Entidad</th><th>Actor</th><th>Correlación</th></tr></thead><tbody>${auditRows}</tbody></table></div></article></div>`;
}

const renderers = { dashboard: renderDashboard, materials: renderMaterials, inventory: renderInventory, orders: renderOrders, movements: renderMovements, integration: renderIntegration };

async function render() {
  loading();
  const [title, subtitle] = screens[state.screen];
  document.querySelector("#screen-title").textContent = title;
  document.querySelector("#screen-subtitle").textContent = subtitle;
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.screen === state.screen));
  try { await renderers[state.screen](); } catch (error) {
    content.innerHTML = `<div class="card"><div class="empty"><strong>No se pudo cargar la información</strong>${escapeHtml(error.message)}<br><br><button class="button primary" id="retry-button">Reintentar</button></div></div>`;
    document.querySelector("#retry-button")?.addEventListener("click", render);
  }
}

async function openOrder(orderNumber) {
  try {
    const order = await api(`/api/orders/${encodeURIComponent(orderNumber)}`);
    modalTitle.textContent = order.order_number;
    const items = order.items.map((item) => `<tr><td>${item.line_number}</td><td><strong>${escapeHtml(item.material_code)}</strong><br><small>${escapeHtml(item.description)}</small></td><td>${number(item.quantity, 3)}</td><td>${number(item.allocated_quantity, 3)}</td><td>${escapeHtml(item.source_location)} → ${escapeHtml(item.destination_location)}</td></tr>`).join("");
    const tasks = order.tasks.map((task) => `<tr><td><strong>${escapeHtml(task.task_number)}</strong></td><td>${badge(task.status)}</td><td>${escapeHtml(task.handling_unit_code ?? "—")}</td><td>${escapeHtml(task.sscc ?? "—")}</td><td>${dateTime(task.started_at)}</td><td>${dateTime(task.completed_at)}</td></tr>`).join("");
    const audits = order.audit.map((entry) => `<div class="activity"><i></i><div><strong>${escapeHtml(entry.action.replaceAll("_", " "))}</strong><small>${escapeHtml(entry.actor)} · ${dateTime(entry.occurred_at)}</small></div></div>`).join("");
    modalBody.innerHTML = `${pipeline(order.status)}<div class="detail-grid detail-section"><div class="detail-tile"><small>Estado</small><strong>${statusNames[order.status]}</strong></div><div class="detail-tile"><small>Prioridad</small><strong>${escapeHtml(order.priority)}</strong></div><div class="detail-tile"><small>Planta</small><strong>${escapeHtml(order.plant_code)}</strong></div><div class="detail-tile"><small>Fecha requerida</small><strong>${dateTime(order.due_at)}</strong></div></div><section class="detail-section"><h3>Materiales solicitados</h3><div class="table-wrap"><table><thead><tr><th>Línea</th><th>Material</th><th>Solicitado</th><th>Asignado</th><th>Ruta</th></tr></thead><tbody>${items}</tbody></table></div></section><section class="detail-section"><h3>Tareas logísticas</h3><div class="table-wrap"><table><thead><tr><th>Tarea</th><th>Estado</th><th>Unidad</th><th>SSCC</th><th>Inicio</th><th>Fin</th></tr></thead><tbody>${tasks || '<tr><td colspan="6">La orden todavía no ha sido liberada.</td></tr>'}</tbody></table></div></section><section class="detail-section"><h3>Auditoría</h3><div class="activity-list">${audits || "Sin eventos"}</div></section><div class="form-actions detail-section">${orderAction(order.order_number, order.status)}${!["COMPLETED","CANCELLED","IN_EXECUTION"].includes(order.status) ? `<button class="button danger order-action" data-order="${escapeHtml(order.order_number)}" data-action="cancel">Cancelar orden</button>` : ""}</div>`;
    modal.classList.remove("hidden");
  } catch (error) { showToast(error.message, true); }
}

function openNewOrder() {
  modalTitle.textContent = "Nueva orden de transferencia";
  const due = new Date(Date.now() + 2 * 60 * 60 * 1000);
  due.setMinutes(due.getMinutes() - due.getTimezoneOffset());
  modalBody.innerHTML = `<form id="order-form" class="form-grid"><div class="field"><label for="material">Material</label><input id="material" name="materialCode" value="MAT-000001" required pattern="MAT-[0-9]{6}"></div><div class="field"><label for="quantity">Cantidad</label><input id="quantity" name="quantity" type="number" min="0.001" step="0.001" value="50" required></div><div class="field"><label for="source">Ubicación origen</label><select id="source" name="sourceLocation"><option>RACK-A01</option><option>RACK-A02</option><option>RACK-B01</option></select></div><div class="field"><label for="destination">Ubicación destino</label><select id="destination" name="destinationLocation"><option>STAGING-01</option><option>STAGING-02</option><option>DOCK-01</option><option>PRODUCTION-B</option></select></div><div class="field"><label for="priority">Prioridad</label><select id="priority" name="priority"><option>NORMAL</option><option>HIGH</option><option>CRITICAL</option><option>LOW</option></select></div><div class="field"><label for="dueAt">Fecha requerida</label><input id="dueAt" name="dueAt" type="datetime-local" value="${due.toISOString().slice(0,16)}" required></div><div class="field full"><div class="detail-tile"><small>Regla</small><strong>La orden se creará en Borrador. Después deberá validarse, reservar inventario y liberarse a LOGISTPULSE.</strong></div></div><div class="form-actions"><button type="button" class="button secondary modal-cancel">Cancelar</button><button type="submit" class="button primary">Crear orden</button></div></form>`;
  modal.classList.remove("hidden");
  document.querySelector("#order-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (form.get("sourceLocation") === form.get("destinationLocation")) return showToast("Origen y destino deben ser diferentes.", true);
    try {
      const result = await api("/api/orders", { method: "POST", body: JSON.stringify({ plantCode: "PLANTA-QUITO", priority: form.get("priority"), dueAt: new Date(form.get("dueAt")).toISOString(), createdBy: "roberto@pulse.local", items: [{ lineNumber: 10, materialCode: form.get("materialCode"), quantity: Number(form.get("quantity")), sourceLocation: form.get("sourceLocation"), destinationLocation: form.get("destinationLocation") }] }) });
      closeModal(); showToast(`${result.order_number} creada correctamente.`); state.screen = "orders"; await render();
    } catch (error) { showToast(error.message, true); }
  });
}

function closeModal() { modal.classList.add("hidden"); modalBody.innerHTML = ""; }

async function runOrderAction(orderNumber, action) {
  try {
    const result = await api(`/api/orders/${encodeURIComponent(orderNumber)}/${action}`, { method: "POST", body: "{}" });
    showToast(`${orderNumber}: ${statusNames[result.status]}.`);
    closeModal(); await render();
  } catch (error) { showToast(error.message, true); }
}

document.addEventListener("click", async (event) => {
  const target = event.target.closest("button");
  if (!target) return;
  if (target.matches(".nav-item, .nav-jump")) { state.screen = target.dataset.screen; document.querySelector("#sidebar").classList.remove("open"); await render(); }
  if (target.matches(".order-detail")) await openOrder(target.dataset.order);
  if (target.matches(".order-action")) await runOrderAction(target.dataset.order, target.dataset.action);
  if (target.matches(".modal-cancel")) closeModal();
  if (target.dataset.orderFilter) {
    const status = target.dataset.orderFilter === "Todas" ? "" : target.dataset.orderFilter;
    const data = await api(`/api/orders?status=${encodeURIComponent(status)}`);
    state.filters.orders = "";
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    window.history.replaceState(null, "", query);
    document.querySelectorAll("[data-order-filter]").forEach(button => button.classList.toggle("active", button === target));
    const tbody = content.querySelector("tbody");
    if (tbody) tbody.innerHTML = data.items.map((order) => `<tr><td><button class="link-button order-detail" data-order="${escapeHtml(order.order_number)}">${escapeHtml(order.order_number)}</button></td><td>${escapeHtml(order.order_type.replaceAll("_", " "))}</td><td>${badge(order.status)}</td><td><span class="priority ${escapeHtml(order.priority)}">${escapeHtml(order.priority)}</span></td><td>${number(order.item_count)}</td><td>${number(order.total_quantity, 3)}</td><td>${dateTime(order.due_at)}</td><td>${orderAction(order.order_number, order.status)}</td></tr>`).join("");
  }
});

document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeModal(); });
document.querySelector("#modal-close").addEventListener("click", closeModal);
modal.addEventListener("click", (event) => { if (event.target === modal) closeModal(); });
document.querySelector("#new-order-button").addEventListener("click", openNewOrder);
document.querySelector("#refresh-button").addEventListener("click", render);
document.querySelector("#menu-button").addEventListener("click", () => document.querySelector("#sidebar").classList.toggle("open"));

document.addEventListener("change", async (event) => {
  if (event.target.id === "material-search") { state.filters.materials = event.target.value; await renderMaterials(); }
  if (event.target.id === "inventory-search") { state.filters.inventory = event.target.value; await renderInventory(); }
  if (event.target.id === "order-search") { state.filters.orders = event.target.value; await renderOrders(); }
});

async function bootstrap() {
  try {
    await api("/api/health");
    document.querySelector("#service-label").textContent = "Servicio conectado";
  } catch {
    document.querySelector("#service-dot").classList.add("down");
    document.querySelector("#service-label").textContent = "Servicio no disponible";
  }
  await render();
}

void bootstrap();


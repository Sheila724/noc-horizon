// Orquestra: busca dados da API, alimenta o globo, o stats card, o header, o painel e o ticker.
function severityColorKey(sev) {
  if (sev <= 2) return "warning";
  if (sev === 3) return "attention";
  return "critical";
}
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function openModal(loc) {
  document.getElementById("modal-title").textContent = loc.label;
  const badge = document.getElementById("modal-badge");
  badge.textContent = CONFIG.STATUS_LABEL[loc.status];
  badge.style.background = CONFIG.STATUS_COLOR[loc.status] + "33";
  badge.style.color = CONFIG.STATUS_COLOR[loc.status];
  badge.style.border = `1px solid ${CONFIG.STATUS_COLOR[loc.status]}`;
  const slaEl = document.getElementById("modal-sla");
  if (slaEl) {
    const w7 = lastSla && lastSla.windows["7d"].locations[loc.id];
    const w30 = lastSla && lastSla.windows["30d"].locations[loc.id];
    slaEl.textContent = w7 != null
      ? `Disponibilidade: 7 dias ${formatPct(w7)} · 30 dias ${formatPct(w30)}`
      : "";
  }
  const list = document.getElementById("modal-problems");
  list.replaceChildren();

  // Hosts que pararam de enviar dados (status "Sem dados")
  (loc.hosts || []).filter(h => h.stale).forEach(h => {
    const div = el("div", "problem stale");
    div.style.borderLeftColor = CONFIG.STATUS_COLOR.unknown;
    const msg = h.last_data_age_seconds == null
      ? "Nenhum dado recebido do Zabbix"
      : `Sem dados novos há ${formatDuration(h.last_data_age_seconds)}`;
    div.append(el("div", "name", h.host), el("div", null, msg));
    list.appendChild(div);
  });

  // Problemas ativos (textContent: nunca interpretar dados do Zabbix como HTML)
  (loc.problems || []).forEach(p => {
    const div = el("div", p.suppressed ? "problem suppressed" : "problem");
    div.style.borderLeftColor = p.suppressed
      ? "var(--muted)"
      : CONFIG.STATUS_COLOR[severityColorKey(p.severity)];
    div.append(el("div", "name", p.host ?? "—"), el("div", null, p.trigger ?? ""));
    if (p.acknowledged) div.appendChild(el("span", "tag ack", "Reconhecido"));
    if (p.suppressed) div.appendChild(el("span", "tag maint", "Em manutenção"));
    list.appendChild(div);
  });

  if (!list.children.length) {
    list.appendChild(el("div", "empty", "Nenhum problema ativo neste local."));
  }
  document.getElementById("modal-backdrop").style.display = "flex";
}
function closeModal() {
  document.getElementById("modal-backdrop").style.display = "none";
}
function updateStatsCard(summary) {
  if (!summary) return;
  const locEl = document.getElementById("stat-locations-num");
  const hostsEl = document.getElementById("stat-hosts-num");
  const probEl = document.getElementById("stat-problems-num");
  const pillProblems = document.getElementById("pill-problems");
  if (locEl) locEl.textContent = summary.locations_count;
  if (hostsEl) hostsEl.textContent = summary.hosts_count;
  if (probEl) probEl.textContent = summary.active_problems;
  if (pillProblems) {
    pillProblems.classList.toggle("alert", summary.active_problems > 0);
  }
}
function formatDuration(seconds) {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.round(hours / 24)} dias`;
}
function formatAge(seconds) {
  if (seconds === null || seconds === undefined) return "—";
  return `${formatDuration(seconds)} atrás`;
}
function updateSidePanel(summary) {
  if (!summary) return;
  const healthEl = document.getElementById("panel-health");
  const triggersEl = document.getElementById("panel-triggers");
  const hostsProblemEl = document.getElementById("panel-hosts-problem");
  const lastCheckEl = document.getElementById("panel-last-check");
  const latencyEl = document.getElementById("panel-latency");

  const unhealthy = summary.hosts_unhealthy || 0;
  const active = summary.active_problems || 0;

  if (healthEl) {
    // % de HOSTS saudáveis (sem problema ativo e com dados recentes)
    healthEl.textContent = summary.health_pct != null ? `${summary.health_pct.toFixed(1)}%` : "—";
    healthEl.className = "panel-value " + (unhealthy > 0 ? "warn" : "ok");
  }
  if (triggersEl) {
    const ack = summary.acknowledged_problems || 0;
    triggersEl.textContent = ack > 0 ? `${active} (${ack} ✓)` : `${active}`;
    triggersEl.title = ack > 0 ? `${ack} reconhecido(s) no Zabbix` : "";
    triggersEl.className = "panel-value " + (active > 0 ? "warn" : "ok");
  }
  if (hostsProblemEl) {
    hostsProblemEl.textContent = `${unhealthy} / ${summary.hosts_count}`;
    hostsProblemEl.className = "panel-value " + (unhealthy > 0 ? "warn" : "ok");
  }
  const staleEl = document.getElementById("panel-hosts-stale");
  if (staleEl) {
    const stale = summary.hosts_stale || 0;
    staleEl.textContent = `${stale}`;
    staleEl.className = "panel-value " + (stale > 0 ? "warn" : "ok");
  }
  if (lastCheckEl) {
    const age = summary.oldest_data_age_seconds;
    lastCheckEl.textContent = formatAge(age);
    lastCheckEl.className = "panel-value " +
      (age != null && age > summary.stale_after_seconds ? "warn" : "");
  }
  if (latencyEl) {
    latencyEl.textContent = summary.latency_ms != null ? `${summary.latency_ms} ms` : "—";
  }
}
function updateTicker(locations) {
  const track = document.getElementById("ticker-track");
  if (!track) return;
  const now = new Date().toLocaleTimeString("pt-BR");
  const spans = [];
  (locations || []).forEach(loc => {
    const entries = [];
    (loc.hosts || []).filter(h => h.stale).forEach(h => {
      entries.push(["stale", `${loc.label} · ${h.host} · sem dados`]);
    });
    (loc.problems || []).filter(p => !p.suppressed).forEach(p => {
      entries.push(["problem", `${loc.label} · ${p.host ?? "—"} · ${p.trigger}` + (p.acknowledged ? " ✓" : "")]);
    });
    if (!entries.length) entries.push(["", `${loc.label} · operacional`]);
    entries.forEach(([cls, text]) => spans.push(el("span", cls || null, `[${now}] ${text}`)));
  });
  // duplicado para o efeito de rolagem contínua
  track.replaceChildren(...spans, ...spans.map(s => s.cloneNode(true)));
}
// Com login OIDC no servidor, a API responde 401 quando a sessão expira:
// recarregar a página leva a pessoa de volta à tela de login.
function sessionExpired(res) {
  if (res.status !== 401) return false;
  window.location.reload();
  return true;
}
let lastSla = null;
function formatPct(value) {
  return value == null ? "—" : `${value.toFixed(2)}%`;
}
function setValue(id, text, level) {
  const node = document.getElementById(id);
  if (!node) return;
  node.textContent = text;
  node.className = "panel-value" + (level ? ` ${level}` : "");
}
function updateSlaPanel(sla) {
  const w = sla.windows["7d"];
  const label = document.getElementById("label-availability");
  if (label) {
    label.textContent = `Disponib. (meta ${sla.target}%)`;
    label.title = `Disponibilidade média dos locais; meta (SLO) de ${sla.target}%`;
  }

  setValue("panel-availability", formatPct(w.availability),
    w.availability == null ? "" : w.availability >= sla.target ? "ok" : "crit");

  const budget = w.error_budget_remaining_pct;
  const budgetLevel = budget == null ? "" : budget > 50 ? "ok" : budget > 0 ? "warn" : "crit";
  setValue("panel-budget", budget == null ? "—" : `${budget.toFixed(0)}% restante`, budgetLevel);
  const fill = document.getElementById("budget-fill");
  if (fill) {
    fill.style.width = `${budget || 0}%`;
    fill.style.background = budgetLevel === "ok" ? "var(--ok)"
      : budgetLevel === "warn" ? "var(--attention)" : "var(--critical)";
  }

  setValue("panel-mttr", w.mttr_seconds == null ? "—" : formatDuration(w.mttr_seconds));
  setValue("panel-mtta", w.mtta_seconds == null ? "—" : formatDuration(w.mtta_seconds));
  setValue("panel-incidents",
    w.open_incidents > 0 ? `${w.incidents} (${w.open_incidents} abertos)` : `${w.incidents}`);
}
async function fetchSla() {
  try {
    const res = await fetch(CONFIG.SLA_URL, { cache: "no-store" });
    if (sessionExpired(res)) return;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.erro || "erro desconhecido");
    lastSla = data;
    updateSlaPanel(data);
  } catch (e) {
    console.warn("Confiabilidade indisponível:", e.message);
  }
}
async function fetchStatus() {
  try {
    const res = await fetch(CONFIG.API_URL, { cache: "no-store" });
    if (sessionExpired(res)) return;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.erro || "erro desconhecido");
    const modeBadge = document.getElementById("mode-badge");
    if (modeBadge) modeBadge.hidden = data.mode !== "demo";
    InfraMap.renderNodes(data.locations, openModal);
    updateStatsCard(data.summary);
    updateSidePanel(data.summary);
    updateTicker(data.locations);
    document.getElementById("last-update").textContent =
      "atualizado às " + new Date().toLocaleTimeString("pt-BR");
  } catch (e) {
    document.getElementById("last-update").textContent = "erro ao conectar: " + e.message;
  }
}

function updateLiveClock() {
  const el = document.getElementById("live-clock");
  if (!el) return;

  const now = new Date();
  el.textContent = now.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
}

updateLiveClock();
setInterval(updateLiveClock, 1000);

document.getElementById("modal-close-btn").addEventListener("click", closeModal);
InfraMap.setup(() => {
  fetchStatus();
  fetchSla();
  setInterval(fetchStatus, CONFIG.POLL_INTERVAL_MS);
  setInterval(fetchSla, CONFIG.SLA_POLL_INTERVAL_MS);
});

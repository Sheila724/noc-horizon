// Orquestra: busca dados da API, alimenta o globo, o stats card, o header, o painel e o ticker.
function severityColorKey(sev) {
  if (sev <= 2) return "warning";
  if (sev === 3) return "attention";
  return "critical";
}
function openModal(loc) {
  document.getElementById("modal-title").textContent = loc.label;
  const badge = document.getElementById("modal-badge");
  badge.textContent = CONFIG.STATUS_LABEL[loc.status];
  badge.style.background = CONFIG.STATUS_COLOR[loc.status] + "33";
  badge.style.color = CONFIG.STATUS_COLOR[loc.status];
  badge.style.border = `1px solid ${CONFIG.STATUS_COLOR[loc.status]}`;
  const list = document.getElementById("modal-problems");
  list.replaceChildren();
  if (!loc.problems || loc.problems.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "Nenhum problema ativo neste local.";
    list.appendChild(empty);
  } else {
    loc.problems.forEach(p => {
      const div = document.createElement("div");
      div.className = "problem";
      div.style.borderLeftColor = CONFIG.STATUS_COLOR[severityColorKey(p.severity)];
      // textContent: nunca interpretar host/trigger (vindos do Zabbix) como HTML
      const nameEl = document.createElement("div");
      nameEl.className = "name";
      nameEl.textContent = p.host ?? "—";
      const trigEl = document.createElement("div");
      trigEl.textContent = p.trigger ?? "";
      div.append(nameEl, trigEl);
      list.appendChild(div);
    });
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
function formatAge(seconds) {
  if (seconds === null || seconds === undefined) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s atrás`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min atrás`;
  const hours = Math.round(minutes / 60);
  return `${hours}h atrás`;
}
function updateSidePanel(summary, locations) {
  const healthEl = document.getElementById("panel-health");
  const triggersEl = document.getElementById("panel-triggers");
  const hostsProblemEl = document.getElementById("panel-hosts-problem");
  const lastCheckEl = document.getElementById("panel-last-check");
  const latencyEl = document.getElementById("panel-latency");
  if (!summary) return;
  const totalHosts = summary.hosts_count || 0;
  const problems = summary.active_problems || 0;
  const healthyHosts = Math.max(totalHosts - problems, 0);
  const healthPct = totalHosts > 0 ? ((healthyHosts / totalHosts) * 100).toFixed(1) : "—";
  if (healthEl) {
    healthEl.textContent = healthPct + "%";
    healthEl.className = "panel-value " + (problems > 0 ? "warn" : "ok");
  }
  if (triggersEl) {
    triggersEl.textContent = problems;
    triggersEl.className = "panel-value " + (problems > 0 ? "warn" : "ok");
  }
  if (hostsProblemEl) {
    const locsComProblema = (locations || []).filter(l => l.problems && l.problems.length > 0).length;
    hostsProblemEl.textContent = `${locsComProblema} / ${summary.locations_count}`;
  }
  if (lastCheckEl) {
    lastCheckEl.textContent = formatAge(summary.oldest_data_age_seconds);
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
    const list = (loc.problems && loc.problems.length) ? loc.problems : [null];
    list.forEach(p => {
      const s = document.createElement("span");
      if (p) s.className = "problem";
      s.textContent = p
        ? `[${now}] ${loc.label} · ${p.host ?? "—"} · ${p.trigger}`
        : `[${now}] ${loc.label} · operacional`;
      spans.push(s);
    });
  });
  // duplicado para o efeito de rolagem contínua
  track.replaceChildren(...spans, ...spans.map(s => s.cloneNode(true)));
}
async function fetchStatus() {
  try {
    const res = await fetch(CONFIG.API_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.erro || "erro desconhecido");
    InfraMap.renderNodes(data.locations, openModal);
    updateStatsCard(data.summary);
    updateSidePanel(data.summary, data.locations);
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
  setInterval(fetchStatus, CONFIG.POLL_INTERVAL_MS);
});

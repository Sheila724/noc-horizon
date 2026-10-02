// Única coisa que você deveria precisar editar no frontend.
const CONFIG = {
  API_URL: "/api/locations",
  POLL_INTERVAL_MS: 15000,
  SLA_URL: "/api/sla",
  SLA_POLL_INTERVAL_MS: 60000,
  WORLD_ATLAS_URL: "data/countries-110m.json",

  STATUS_ORDER: ["ok", "unknown", "warning", "attention", "critical"],

  STATUS_COLOR: {
    ok: "var(--ok)",
    unknown: "var(--unknown)",
    warning: "var(--warning)",
    attention: "var(--attention)",
    critical: "var(--critical)",
  },

  STATUS_LABEL: {
    ok: "Saudável",
    unknown: "Sem dados",
    warning: "Atenção",
    attention: "Alerta",
    critical: "Crítico",
  },
};

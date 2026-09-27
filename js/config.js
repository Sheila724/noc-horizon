// Única coisa que você deveria precisar editar no frontend.
const CONFIG = {
  API_URL: "/api/locations",
  POLL_INTERVAL_MS: 15000,
  WORLD_ATLAS_URL: "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json",

  STATUS_ORDER: ["ok", "warning", "attention", "critical"],

  STATUS_COLOR: {
    ok: "var(--ok)",
    warning: "var(--warning)",
    attention: "var(--attention)",
    critical: "var(--critical)",
  },

  STATUS_LABEL: {
    ok: "Saudável",
    warning: "Atenção",
    attention: "Alerta",
    critical: "Crítico",
  },
};

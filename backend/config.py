import os

# "zabbix" (padrão, produção) ou "demo" (dados simulados, sem Zabbix)
NOC_MODE = os.environ.get("NOC_MODE", "zabbix").strip().lower()
if NOC_MODE not in ("zabbix", "demo"):
    raise RuntimeError(f"NOC_MODE inválido: {NOC_MODE!r} (use 'zabbix' ou 'demo')")

ZABBIX_URL = os.environ.get("ZABBIX_URL", "")
ZABBIX_API_TOKEN = os.environ.get("ZABBIX_API_TOKEN", "")
if NOC_MODE == "zabbix" and not (ZABBIX_URL and ZABBIX_API_TOKEN):
    raise RuntimeError("Defina ZABBIX_URL e ZABBIX_API_TOKEN, ou use NOC_MODE=demo")

HOST_LOCATION_MAP = {
    "Proxmox-Acer": "homelab",
    "VM-Hermes": "homelab",
    "Servidor-COM4-Universo": "com4",
    "Zabbix server": "vps",
}

LOCATIONS = {
    "homelab": {"label": "Homelab (Franca, SP)", "lat": -20.539, "lon": -47.4009},
    "com4": {"label": "COM4 (São Paulo, SP)", "lat": -23.5505, "lon": -46.6333},
    "vps": {"label": "VPS (Riga, Letônia)", "lat": 56.95225, "lon": 24.11301},
}

PORT = int(os.environ.get("PORT", 5004))

# Host sem nenhum dado novo há mais que isso aparece como "Sem dados" (unknown).
STALE_AFTER_SECONDS = int(os.environ.get("NOC_STALE_AFTER_SECONDS", 600))

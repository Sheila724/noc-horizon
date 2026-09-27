import os

ZABBIX_URL = os.environ.get("ZABBIX_URL", "http://IP-REMOVIDO/zabbix/api_jsonrpc.php")
ZABBIX_API_TOKEN = os.environ.get("ZABBIX_API_TOKEN", "REMOVIDO")

HOST_LOCATION_MAP = {
    "Proxmox-Acer": "homelab",
    "VM-Hermes": "homelab",
    "Servidor-COM4-Universo": "com4",
    "Zabbix server": "vps",
}

LOCATIONS = {
    "homelab": {"label": "Homelab (Franca, SP)", "lat": -20.539, "lon": -47.4009},
    "com4":    {"label": "COM4 (São Paulo, SP)", "lat": -23.5505, "lon": -46.6333},
    "vps":     {"label": "VPS (Riga, Letônia)", "lat": 56.95225, "lon": 24.11301},
}

PORT = int(os.environ.get("PORT", 5004))

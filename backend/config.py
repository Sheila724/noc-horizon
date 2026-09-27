import os

ZABBIX_URL = os.environ.get("ZABBIX_URL", "http://179.197.73.111/zabbix/api_jsonrpc.php")
ZABBIX_API_TOKEN = os.environ.get("ZABBIX_API_TOKEN", "eea3219dbbe367aaba757b21132b0ab9efd80deb7bf3a372f49187faf99e8a43")

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

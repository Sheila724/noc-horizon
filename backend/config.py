import os

# "zabbix" (padrão, produção) ou "demo" (dados simulados, sem Zabbix)
NOC_MODE = os.environ.get("NOC_MODE", "zabbix").strip().lower()
if NOC_MODE not in ("zabbix", "demo"):
    raise RuntimeError(f"NOC_MODE inválido: {NOC_MODE!r} (use 'zabbix' ou 'demo')")

ZABBIX_URL = os.environ.get("ZABBIX_URL", "")
ZABBIX_API_TOKEN = os.environ.get("ZABBIX_API_TOKEN", "")
if NOC_MODE == "zabbix" and not (ZABBIX_URL and ZABBIX_API_TOKEN):
    raise RuntimeError("Defina ZABBIX_URL e ZABBIX_API_TOKEN, ou use NOC_MODE=demo")

# De onde vêm os locais do globo:
#   "config"    -> HOST_LOCATION_MAP / LOCATIONS abaixo (padrão)
#   "inventory" -> inventário de cada host no Zabbix (Location, Latitude, Longitude);
#                  hosts sem coordenadas no inventário continuam usando o mapa abaixo
NOC_LOCATIONS_FROM = os.environ.get("NOC_LOCATIONS_FROM", "config").strip().lower()
if NOC_LOCATIONS_FROM not in ("config", "inventory"):
    raise RuntimeError(
        f"NOC_LOCATIONS_FROM inválido: {NOC_LOCATIONS_FROM!r} (use 'config' ou 'inventory')"
    )
# Opcional: só hosts com esta tag no Zabbix entram no globo (ex.: NOC_HOST_TAG=noc)
NOC_HOST_TAG = os.environ.get("NOC_HOST_TAG", "").strip()
# A lista de hosts do inventário é relida a cada N segundos
NOC_DISCOVERY_TTL = int(os.environ.get("NOC_DISCOVERY_TTL", 300))

# Mapa estático de hosts -> locais. É usado quando NOC_LOCATIONS_FROM=config
# (padrão) e, no modo "inventory", como reserva para hosts sem coordenadas.
#
#   HOST_LOCATION_MAP: "nome técnico do host no Zabbix" -> chave do local
#   LOCATIONS:         chave do local -> rótulo e coordenadas (graus decimais)
#
# O exemplo abaixo usa o "Zabbix server", que existe em toda instalação do
# Zabbix. Acrescente os seus hosts — ou, melhor, preencha o inventário de cada
# host no Zabbix e use NOC_LOCATIONS_FROM=inventory (ver README).
HOST_LOCATION_MAP = {
    "Zabbix server": "matriz",
    # "web-01": "filial-rj",
}

LOCATIONS = {
    "matriz": {"label": "Matriz (São Paulo, SP)", "lat": -23.5505, "lon": -46.6333},
    # "filial-rj": {"label": "Filial (Rio de Janeiro, RJ)", "lat": -22.9068, "lon": -43.1729},
}

PORT = int(os.environ.get("PORT", 5004))

# Host sem nenhum dado novo há mais que isso aparece como "Sem dados" (unknown).
STALE_AFTER_SECONDS = int(os.environ.get("NOC_STALE_AFTER_SECONDS", 600))

# SLO: meta de disponibilidade (%) e severidade mínima que conta como indisponibilidade
# (Zabbix: 0 Not classified, 1 Information, 2 Warning, 3 Average, 4 High, 5 Disaster)
NOC_SLO_TARGET = float(os.environ.get("NOC_SLO_TARGET", 99.5))
NOC_SLO_MIN_SEVERITY = int(os.environ.get("NOC_SLO_MIN_SEVERITY", 4))

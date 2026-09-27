"""
Agrega os problemas ativos do Zabbix por localização física, decide
a cor/status de cada uma, e monta o resumo geral (summary) consumido
pelo header, pills e painel lateral do NOC Horizon.
"""

import time

from config import HOST_LOCATION_MAP, LOCATIONS
from zabbix_client import get_active_problems, get_hosts_last_data, get_api_latency_ms


def _severity_to_status(max_severity):
    if max_severity is None:
        return "ok"
    if max_severity <= 2:
        return "warning"
    if max_severity == 3:
        return "attention"
    return "critical"


def build_locations_status():
    """Retorna (lista_de_localizacoes, lista_de_problemas_brutos)."""
    problems = get_active_problems()

    by_location = {loc: [] for loc in LOCATIONS}
    for p in problems:
        loc = HOST_LOCATION_MAP.get(p["host"])
        if loc:
            by_location[loc].append(p)

    output = []
    for loc_key, loc_info in LOCATIONS.items():
        loc_problems = by_location[loc_key]
        max_sev = max((p["severity"] for p in loc_problems), default=None)

        output.append({
            "id": loc_key,
            "label": loc_info["label"],
            "lat": loc_info["lat"],
            "lon": loc_info["lon"],
            "status": _severity_to_status(max_sev) if loc_problems else "ok",
            "problems": [
                {"host": p["host"], "trigger": p["name"], "severity": p["severity"]}
                for p in loc_problems
            ],
        })
    return output, problems


def build_summary(locations_output, problems):
    """Resumo consumido pelo header e painel lateral."""
    try:
        latency_ms = get_api_latency_ms()
    except Exception as e:
        print(f"[aggregator] falha ao medir latência: {e}")
        latency_ms = None

    try:
        last_data = get_hosts_last_data()
        now = time.time()
        ages = [now - ts for ts in last_data.values() if ts > 0]
        oldest_age_seconds = int(max(ages)) if ages else None
    except Exception as e:
        print(f"[aggregator] falha ao buscar last data: {e}")
        oldest_age_seconds = None

    return {
        "locations_count": len(locations_output),
        "hosts_count": len(HOST_LOCATION_MAP),
        "active_problems": len(problems),
        "latency_ms": latency_ms,
        "oldest_data_age_seconds": oldest_age_seconds,
    }

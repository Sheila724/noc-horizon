"""
Descoberta automática de locais a partir do INVENTÁRIO do Zabbix.

Com NOC_LOCATIONS_FROM=inventory, cada host com os campos de inventário
"Location", "Latitude" e "Longitude" preenchidos aparece no globo sem
precisar editar o config.py:

- hosts com o mesmo "Location" viram um único ponto no mapa;
- hosts sem coordenadas válidas usam o mapa estático do config.py (fallback);
- a lista é guardada em cache (hosts mudam pouco) e, se o Zabbix falhar,
  a última lista boa continua sendo usada.
"""

import logging
import re
import time
import unicodedata

log = logging.getLogger(__name__)


def _slug(text: str) -> str:
    """'São Paulo (BR)' -> 'sao-paulo-br'"""
    ascii_text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", ascii_text.lower()).strip("-") or "local"


def _coord(value, low: float, high: float):
    """Converte '-20,539' ou '-20.539' em float; None se vazio ou fora da faixa."""
    if value is None:
        return None
    text = str(value).strip().replace(",", ".")
    if not text:
        return None
    try:
        number = float(text)
    except ValueError:
        return None
    return number if low <= number <= high else None


def build_locations(hosts, fallback_map, fallback_locations):
    """
    hosts: resultado de host.get com selectInventory
           [{"host", "name", "inventory": {"location", "location_lat", "location_lon"}}]
    Retorna (host_map, locations) no mesmo formato do config.py.
    """
    groups = {}  # key -> {"label", "lats", "lons"}
    host_map = {}

    for h in hosts:
        inventory = h.get("inventory")
        if not isinstance(inventory, dict):  # Zabbix devolve [] se o inventário está desativado
            inventory = {}
        lat = _coord(inventory.get("location_lat"), -90, 90)
        lon = _coord(inventory.get("location_lon"), -180, 180)
        if lat is None or lon is None:
            continue

        label = (inventory.get("location") or "").strip() or h.get("name") or h["host"]
        key = _slug(label)
        group = groups.setdefault(key, {"label": label, "lats": [], "lons": []})
        group["lats"].append(lat)
        group["lons"].append(lon)
        host_map[h["host"]] = key

    locations = {
        key: {
            "label": g["label"],
            "lat": round(sum(g["lats"]) / len(g["lats"]), 5),
            "lon": round(sum(g["lons"]) / len(g["lons"]), 5),
        }
        for key, g in groups.items()
    }

    # Fallback: hosts do config.py que não têm coordenadas no inventário
    for host, loc_key in fallback_map.items():
        if host in host_map or loc_key not in fallback_locations:
            continue
        locations.setdefault(loc_key, dict(fallback_locations[loc_key]))
        host_map[host] = loc_key

    return host_map, locations


_cache = {"t": 0.0, "data": None}


def get_locations(fetch_hosts, fallback_map, fallback_locations, ttl, now=None):
    """Lista (host_map, locations) com cache de `ttl` segundos."""
    now = time.monotonic() if now is None else now
    if _cache["data"] is not None and now - _cache["t"] < ttl:
        return _cache["data"]
    try:
        data = build_locations(fetch_hosts(), fallback_map, fallback_locations)
    except Exception:
        log.exception("falha ao ler o inventário do Zabbix")
        if _cache["data"] is not None:
            return _cache["data"]  # mantém a última lista boa
        return dict(fallback_map), dict(fallback_locations)
    _cache.update(t=now, data=data)
    return data

"""
Fonte de dados de DEMONSTRAÇÃO — simula um Zabbix com vários locais pelo mundo.

Usada quando NOC_MODE=demo: permite rodar o NOC Horizon sem nenhum Zabbix.
Os dados são determinísticos por minuto (todos os workers e navegadores veem
o mesmo estado) e evoluem com o tempo: problemas surgem, são reconhecidos e
resolvidos; um host entra em manutenção; outro às vezes para de enviar dados.
"""

import hashlib
import math

LOCATIONS = {
    "sao-paulo": {"label": "São Paulo (BR)", "lat": -23.55, "lon": -46.63},
    "fortaleza": {"label": "Fortaleza (BR)", "lat": -3.73, "lon": -38.52},
    "santiago": {"label": "Santiago (CL)", "lat": -33.45, "lon": -70.67},
    "virginia": {"label": "Virgínia (US)", "lat": 38.95, "lon": -77.45},
    "oregon": {"label": "Oregon (US)", "lat": 45.60, "lon": -121.18},
    "frankfurt": {"label": "Frankfurt (DE)", "lat": 50.11, "lon": 8.68},
    "estocolmo": {"label": "Estocolmo (SE)", "lat": 59.33, "lon": 18.07},
    "joanesburgo": {"label": "Joanesburgo (ZA)", "lat": -26.20, "lon": 28.05},
    "mumbai": {"label": "Mumbai (IN)", "lat": 19.08, "lon": 72.88},
    "singapura": {"label": "Singapura (SG)", "lat": 1.35, "lon": 103.82},
    "toquio": {"label": "Tóquio (JP)", "lat": 35.68, "lon": 139.69},
    "sydney": {"label": "Sydney (AU)", "lat": -33.87, "lon": 151.21},
}

_ROLES = ["web-01", "web-02", "db-01", "cache-01", "lb-01"]
_HOSTS_PER_LOCATION = {key: 2 + (i % 4) for i, key in enumerate(LOCATIONS)}  # 2 a 5

HOST_MAP = {f"{loc}-{role}": loc for loc, n in _HOSTS_PER_LOCATION.items() for role in _ROLES[:n]}

# (nome do trigger, severidade Zabbix 0-5)
_SCENARIOS = [
    ("Linux: High CPU utilization (over 90% for 5m)", 3),
    ("Linux: FS [/]: Space is low (used > 80%)", 2),
    ("Linux: FS [/]: Space is critically low (used > 90%)", 3),
    ("Linux: High memory utilization (>90% for 5m)", 3),
    ("Linux: High swap space usage (less than 50% free)", 2),
    ("Nginx: Service is down", 4),
    ("PostgreSQL: Too many connections (over 90% of max)", 3),
    ("Redis: Memory fragmentation ratio is too high", 1),
    ("ICMP: High ICMP ping loss", 2),
    ("ICMP: Unavailable by ICMP ping", 5),
    ("Certificate: SSL certificate expires in less than 7 days", 2),
    ("Linux: Zabbix agent is not available (for 3m)", 4),
]

_MAINTENANCE_HOST = "frankfurt-db-01"
_FLAKY_HOST = "santiago-web-02"


def _h(*parts) -> int:
    """Hash estável (não usa hash() do Python, que muda a cada processo)."""
    raw = "|".join(str(p) for p in parts).encode()
    return int.from_bytes(hashlib.sha256(raw).digest()[:8], "big")


def generate(now: float) -> dict:
    """Devolve os argumentos de `aggregate()` para o instante `now`."""
    minute = int(now // 60)
    problems = []
    last_data = {}

    for host in HOST_MAP:
        seed = _h(host)
        last_data[host] = now - (seed % 45)  # dado recebido há 0-44 s

        # ~1/3 dos hosts têm incidentes recorrentes: período de 7-19 min,
        # duração de 2-5 min, cada um com um cenário próprio.
        if seed % 3 == 0:
            period = 7 + seed % 13
            duration = 2 + seed % 4
            phase = (minute + seed) % period
            if phase < duration:
                episode = (minute + seed) // period
                name, severity = _SCENARIOS[_h(host, episode) % len(_SCENARIOS)]
                problems.append(
                    {
                        "host": host,
                        "name": name,
                        "severity": severity,
                        "acknowledged": phase >= 1,  # alguém reconhece após 1 min
                        "suppressed": False,
                    }
                )

    # Janela de manutenção: 10 min a cada 30 — problema existe mas não colore.
    if minute % 30 < 10:
        problems.append(
            {
                "host": _MAINTENANCE_HOST,
                "name": "Linux: Zabbix agent is not available (for 3m)",
                "severity": 4,
                "acknowledged": False,
                "suppressed": True,
            }
        )

    # Host que para de enviar dados por 5 min a cada 20 — vira "Sem dados".
    if minute % 20 < 5:
        last_data[_FLAKY_HOST] = now - 900

    # Problema de host fora do mapa (conta em unmapped_problems).
    problems.append(
        {
            "host": "legacy-printer-01",
            "name": "Toner baixo",
            "severity": 1,
            "acknowledged": False,
            "suppressed": False,
        }
    )

    latency_ms = round(18 + 8 * math.sin(now / 37) + (_h(minute) % 7), 1)

    return {
        "problems": problems,
        "last_data": last_data,
        "host_map": HOST_MAP,
        "locations": LOCATIONS,
        "latency_ms": latency_ms,
    }

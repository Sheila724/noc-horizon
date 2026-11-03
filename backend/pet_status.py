"""
Resumo leve do estado da operação para o pet de tela (Pestinha) no computador.

O painel no navegador já recebe tudo de /api/locations. O pet do computador
só precisa saber "como está a operação" e "qual é o pior local", então este
módulo reduz o snapshot a poucos campos. `resumo_pet()` é uma função pura,
exercitada pelos testes.
"""

from aggregator import STATUS_ORDER, worst

MAX_LOCAIS = 5  # quantos locais com problema vão na resposta
MAX_PROBLEMAS = 3  # quantos problemas do pior local vão na resposta


def _gravidade(status: str) -> int:
    return STATUS_ORDER.index(status) if status in STATUS_ORDER else 0


def resumo_pet(snapshot: dict) -> dict:
    """
    snapshot: {"locations": [...], "summary": {...}} (saída de aggregate()).
    Devolve o status geral, o pior local e a lista curta de locais com problema.
    """
    locais = snapshot.get("locations") or []
    summary = snapshot.get("summary") or {}

    com_problema = [loc for loc in locais if loc.get("status", "ok") != "ok"]
    # pior primeiro; empate: mais problemas ativos primeiro, depois nome
    com_problema.sort(
        key=lambda loc: (
            -_gravidade(loc["status"]),
            -sum(1 for p in loc.get("problems", []) if not p.get("suppressed")),
            loc.get("label", ""),
        )
    )
    status = worst(*(loc.get("status", "ok") for loc in locais)) if locais else "ok"

    pior = None
    if com_problema:
        loc = com_problema[0]
        ativos = [p for p in loc.get("problems", []) if not p.get("suppressed")]
        pior = {
            "id": loc.get("id"),
            "label": loc.get("label"),
            "status": loc["status"],
            "hosts_sem_dados": sum(1 for h in loc.get("hosts", []) if h.get("stale")),
            "problemas": [
                {"host": p.get("host"), "trigger": p.get("trigger"), "severity": p.get("severity")}
                for p in ativos[:MAX_PROBLEMAS]
            ],
        }

    return {
        "status": status,
        "pior_local": pior,
        "locais_com_problema": [
            {"label": loc.get("label"), "status": loc["status"]}
            for loc in com_problema[:MAX_LOCAIS]
        ],
        "resumo": {
            "locais": summary.get("locations_count", len(locais)),
            "hosts": summary.get("hosts_count"),
            "alertas_ativos": summary.get("active_problems"),
            "hosts_sem_dados": summary.get("hosts_stale"),
            "saude_pct": summary.get("health_pct"),
        },
    }

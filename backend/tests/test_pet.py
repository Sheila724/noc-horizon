"""Endpoint /api/pet (pet de tela no computador) e o resumo que ele devolve."""

import pytest

import app as app_module
import config
from pet_status import resumo_pet

client = app_module.app.test_client()
TOKEN = "aaaa-bbbb-aaaa-bbbb"  # noqa: S105 (token falso, só de teste)


@pytest.fixture
def com_token(monkeypatch):
    monkeypatch.setattr(config, "NOC_PET_TOKEN", TOKEN)


def _loc(key, status, problems=(), hosts=()):
    return {
        "id": key,
        "label": key.upper(),
        "status": status,
        "problems": list(problems),
        "hosts": list(hosts),
    }


def _p(host, sev, suppressed=False):
    return {"host": host, "trigger": f"falha em {host}", "severity": sev, "suppressed": suppressed}


# ---------------- autenticação ----------------


def test_sem_token_configurado_o_endpoint_nao_existe(monkeypatch):
    monkeypatch.setattr(config, "NOC_PET_TOKEN", "")
    r = client.get("/api/pet", headers={"Authorization": "Bearer qualquer"})
    assert r.status_code == 404
    assert r.get_json()["ok"] is False


@pytest.mark.parametrize(
    "cabecalho",
    [None, "", "Bearer", "Bearer errado", f"Basic {TOKEN}", f"bearer {TOKEN}", f"Bearer {TOKEN}x"],
)
def test_token_errado_ou_ausente_da_401(com_token, cabecalho):
    headers = {"Authorization": cabecalho} if cabecalho is not None else {}
    r = client.get("/api/pet", headers=headers)
    assert r.status_code == 401
    assert r.get_json() == {"ok": False, "erro": "token inválido"}


def test_token_certo_devolve_o_resumo(com_token):
    r = client.get("/api/pet", headers={"Authorization": f"Bearer {TOKEN}"})
    assert r.status_code == 200
    data = r.get_json()
    assert data["ok"] is True
    assert data["mode"] == "demo"
    assert data["status"] in ("ok", "unknown", "warning", "attention", "critical")
    assert set(data["resumo"]) == {
        "locais",
        "hosts",
        "alertas_ativos",
        "hosts_sem_dados",
        "saude_pct",
    }


def test_falha_no_monitoramento_vira_502(com_token, monkeypatch):
    def quebra():
        raise RuntimeError("zabbix fora")

    monkeypatch.setattr(app_module, "_snapshot", quebra)
    r = client.get("/api/pet", headers={"Authorization": f"Bearer {TOKEN}"})
    assert r.status_code == 502
    assert r.get_json()["ok"] is False


# ---------------- resumo ----------------


def test_tudo_ok():
    snap = {"locations": [_loc("sp", "ok"), _loc("rj", "ok")], "summary": {"locations_count": 2}}
    out = resumo_pet(snap)
    assert out["status"] == "ok"
    assert out["pior_local"] is None
    assert out["locais_com_problema"] == []
    assert out["resumo"]["locais"] == 2


def test_sem_locais_e_ok():
    assert resumo_pet({"locations": [], "summary": {}})["status"] == "ok"


def test_pior_local_vem_primeiro():
    snap = {
        "locations": [
            _loc("sp", "warning", [_p("web-1", 2)]),
            _loc("rj", "critical", [_p("db-1", 5), _p("db-2", 4, suppressed=True)]),
            _loc("bh", "unknown", hosts=[{"host": "x", "stale": True}]),
        ],
        "summary": {},
    }
    out = resumo_pet(snap)
    assert out["status"] == "critical"
    assert out["pior_local"]["label"] == "RJ"
    # problema em manutenção não entra na lista
    assert out["pior_local"]["problemas"] == [
        {"host": "db-1", "trigger": "falha em db-1", "severity": 5}
    ]
    assert [loc["label"] for loc in out["locais_com_problema"]] == ["RJ", "SP", "BH"]


def test_empate_desempata_por_numero_de_problemas():
    snap = {
        "locations": [
            _loc("a", "attention", [_p("h1", 3)]),
            _loc("b", "attention", [_p("h2", 3), _p("h3", 3)]),
        ],
        "summary": {},
    }
    assert resumo_pet(snap)["pior_local"]["label"] == "B"


def test_listas_sao_limitadas():
    locais = [_loc(f"l{i}", "warning", [_p(f"h{j}", 2) for j in range(10)]) for i in range(10)]
    out = resumo_pet({"locations": locais, "summary": {}})
    assert len(out["locais_com_problema"]) == 5
    assert len(out["pior_local"]["problemas"]) == 3


def test_conta_hosts_sem_dados_do_pior_local():
    snap = {
        "locations": [
            _loc(
                "sp", "unknown", hosts=[{"host": "a", "stale": True}, {"host": "b", "stale": False}]
            )
        ],
        "summary": {},
    }
    assert resumo_pet(snap)["pior_local"]["hosts_sem_dados"] == 1

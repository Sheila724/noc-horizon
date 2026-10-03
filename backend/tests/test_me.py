"""Endpoint /api/me: quem está logado (claims repassados pelo Apache)."""

import app as app_module

client = app_module.app.test_client()


def test_sem_login_configurado():
    assert client.get("/api/me").get_json() == {"authenticated": False}


def test_com_claims_do_apache():
    r = client.get(
        "/api/me",
        headers={"OIDC-Claim-email": "ana@exemplo.com", "OIDC-Claim-name": "Ana Souza"},
    )
    assert r.get_json() == {"authenticated": True, "email": "ana@exemplo.com", "name": "Ana Souza"}


def test_nome_com_acento_em_utf8():
    nome = "João Conceição".encode().decode("latin-1")  # como chega no cabeçalho
    r = client.get("/api/me", headers={"OIDC-Claim-email": "j@x.com", "OIDC-Claim-name": nome})
    assert r.get_json()["name"] == "João Conceição"


def test_sem_nome_usa_o_email():
    r = client.get("/api/me", headers={"OIDC-Claim-email": "ana@exemplo.com"})
    assert r.get_json()["name"] == "ana@exemplo.com"

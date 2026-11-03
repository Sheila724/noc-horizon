#!/usr/bin/env python3
"""
Servidor do proxy Zabbix -> Mapa.
Roda via gunicorn (ver README). Não chame app.run() em produção.
"""

import hmac
import time

from flask import Flask, jsonify, request

import config
from aggregator import build_snapshot
from config import NOC_MODE
from pet_status import resumo_pet
from sla import build_sla

app = Flask(__name__)

# Cache em memória: várias pessoas abrindo o painel = no máximo
# 1 consulta ao Zabbix a cada CACHE_TTL segundos (por worker).
CACHE_TTL = 10
_cache = {"t": 0.0, "data": None}


def _snapshot():
    """Snapshot com cache, usado por /api/locations e /api/pet. Levanta exceção se falhar."""
    now = time.monotonic()
    if _cache["data"] is not None and now - _cache["t"] < CACHE_TTL:
        return _cache["data"]
    data = {"ok": True, "mode": NOC_MODE, **build_snapshot()}
    _cache.update(t=now, data=data)
    return data


@app.route("/api/locations", methods=["GET"])
def api_locations():
    try:
        return jsonify(_snapshot()), 200
    except Exception:
        app.logger.exception("falha ao consultar o Zabbix")
        return jsonify({"ok": False, "erro": "falha ao consultar o monitoramento"}), 502


def _token_do_pet_ok():
    """Confere o "Authorization: Bearer <token>" com o NOC_PET_TOKEN, em tempo constante."""
    esperado = config.NOC_PET_TOKEN
    cabecalho = request.headers.get("Authorization", "")
    if not cabecalho.startswith("Bearer "):
        return False
    return hmac.compare_digest(cabecalho[len("Bearer ") :].strip().encode(), esperado.encode())


@app.route("/api/pet", methods=["GET"])
def api_pet():
    """
    Estado resumido para o pet de tela no computador (Pestinha).
    Fica fora do login OIDC no Apache (app desktop não faz login no navegador),
    por isso exige o token NOC_PET_TOKEN. Sem token configurado, não existe.
    """
    if not config.NOC_PET_TOKEN:
        return jsonify({"ok": False, "erro": "pet desativado (defina NOC_PET_TOKEN)"}), 404
    if not _token_do_pet_ok():
        return jsonify({"ok": False, "erro": "token inválido"}), 401
    try:
        data = _snapshot()
    except Exception:
        app.logger.exception("falha ao consultar o Zabbix (pet)")
        return jsonify({"ok": False, "erro": "falha ao consultar o monitoramento"}), 502
    return jsonify({"ok": True, "mode": NOC_MODE, **resumo_pet(data)}), 200


# O histórico muda devagar e a consulta é mais pesada: cache maior.
SLA_CACHE_TTL = 60 if NOC_MODE == "demo" else 300
_sla_cache = {"t": 0.0, "data": None}


@app.route("/api/sla", methods=["GET"])
def api_sla():
    now = time.monotonic()
    if _sla_cache["data"] is not None and now - _sla_cache["t"] < SLA_CACHE_TTL:
        return jsonify(_sla_cache["data"]), 200
    try:
        data = {"ok": True, "mode": NOC_MODE, **build_sla()}
        _sla_cache.update(t=now, data=data)
        return jsonify(data), 200
    except Exception:
        app.logger.exception("falha ao calcular a confiabilidade")
        return jsonify({"ok": False, "erro": "falha ao consultar o histórico"}), 502


def _claim(name):
    """
    Claim do login OIDC repassado pelo Apache (mod_auth_openidc, OIDCClaimPrefix
    "OIDC-Claim-"). O Apache apaga esses cabeçalhos se vierem do navegador, e o
    backend só escuta em 127.0.0.1 — então só o Apache consegue defini-los.
    """
    value = request.headers.get(f"OIDC-Claim-{name}", "").strip()
    try:  # cabeçalhos HTTP chegam como latin-1; nomes como "João" vêm em UTF-8
        value = value.encode("latin-1").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        pass
    return value


@app.route("/api/me", methods=["GET"])
def api_me():
    email = _claim("email")
    if not email:  # sem login configurado (demo, desenvolvimento)
        return jsonify({"authenticated": False}), 200
    return jsonify({"authenticated": True, "email": email, "name": _claim("name") or email}), 200


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "mode": NOC_MODE}), 200

#!/usr/bin/env python3
"""
Servidor do proxy Zabbix -> Mapa.
Roda via gunicorn (ver README). Não chame app.run() em produção.
"""

import time

from flask import Flask, jsonify, request

from aggregator import build_snapshot
from config import NOC_MODE
from sla import build_sla

app = Flask(__name__)

# Cache em memória: várias pessoas abrindo o painel = no máximo
# 1 consulta ao Zabbix a cada CACHE_TTL segundos (por worker).
CACHE_TTL = 10
_cache = {"t": 0.0, "data": None}


@app.route("/api/locations", methods=["GET"])
def api_locations():
    now = time.monotonic()
    if _cache["data"] is not None and now - _cache["t"] < CACHE_TTL:
        return jsonify(_cache["data"]), 200
    try:
        data = {"ok": True, "mode": NOC_MODE, **build_snapshot()}
        _cache.update(t=now, data=data)
        return jsonify(data), 200
    except Exception:
        app.logger.exception("falha ao consultar o Zabbix")
        return jsonify({"ok": False, "erro": "falha ao consultar o monitoramento"}), 502


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

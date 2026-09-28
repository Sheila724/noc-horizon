#!/usr/bin/env python3
"""
Servidor do proxy Zabbix -> Mapa.
Roda via gunicorn (ver README). Não chame app.run() em produção.
"""
import time
from flask import Flask, jsonify
from aggregator import build_locations_status, build_summary

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
        locations, problems = build_locations_status()
        summary = build_summary(locations, problems)
        data = {"ok": True, "locations": locations, "summary": summary}
        _cache.update(t=now, data=data)
        return jsonify(data), 200
    except Exception:
        app.logger.exception("falha ao consultar o Zabbix")
        return jsonify({"ok": False, "erro": "falha ao consultar o monitoramento"}), 502


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200
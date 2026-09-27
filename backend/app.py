#!/usr/bin/env python3
"""
Servidor do proxy Zabbix -> Mapa.
Só expõe as rotas HTTP; a lógica real está em aggregator.py
e zabbix_client.py.
"""

from flask import Flask, jsonify
from flask_cors import CORS

from config import PORT
from aggregator import build_locations_status, build_summary

app = Flask(__name__)
CORS(app)


@app.route("/api/locations", methods=["GET"])
def api_locations():
    try:
        locations, problems = build_locations_status()
        summary = build_summary(locations, problems)
        return jsonify({"ok": True, "locations": locations, "summary": summary}), 200
    except Exception as e:
        return jsonify({"ok": False, "erro": str(e)}), 500


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=PORT)

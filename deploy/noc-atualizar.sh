#!/bin/bash
# Publica no servidor os arquivos enviados para ~/upload.
# Instalação (uma vez):  sudo install -m 755 deploy/noc-atualizar.sh /usr/local/bin/noc-atualizar
# Uso:                   sudo noc-atualizar
set -euo pipefail

SERVICE="${NOC_SERVICE:-noc-horizon}"   # nome do serviço systemd do backend
SRC="/home/${SUDO_USER:-root}/upload"
[ "${SUDO_USER:-root}" = "root" ] && SRC="/root/upload"
[ -f "$SRC/index.html" ] && [ -d "$SRC/backend" ] || { echo "ERRO: $SRC não tem index.html e backend/"; exit 1; }

echo "==> backend"
rsync -a --delete --exclude venv --exclude __pycache__ --exclude '.env*' "$SRC/backend/" /opt/noc-horizon/backend/
chown -R root:noc /opt/noc-horizon/backend
chmod -R u=rwX,g=rX,o= /opt/noc-horizon/backend
/opt/noc-horizon/venv/bin/pip install -q -r /opt/noc-horizon/backend/requirements.txt

echo "==> frontend"
rsync -a --delete --exclude backend --exclude '.*' --exclude README.md "$SRC/" /var/www/noc-horizon/
chown -R root:www-data /var/www/noc-horizon
find /var/www/noc-horizon -type d -exec chmod 755 {} +
find /var/www/noc-horizon -type f -exec chmod 644 {} +

echo "==> reiniciando $SERVICE"
systemctl restart "$SERVICE"
sleep 2
if curl -sf http://127.0.0.1:5004/api/locations | grep -q '"ok":true\|"ok": true'; then
  echo "OK: backend respondendo"
else
  echo "ATENÇÃO: backend não respondeu ok -> sudo journalctl -u $SERVICE -n 40"
fi
rm -rf "$SRC"

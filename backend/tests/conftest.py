import os

# Os testes nunca falam com um Zabbix de verdade.
os.environ.setdefault("NOC_MODE", "demo")

# Runbook de operação — NOC Horizon

Guia para **instalar, atualizar e diagnosticar** o NOC Horizon em produção.
Escrito para que qualquer pessoa da equipe consiga operar o painel sem depender de quem o construiu.

> Os exemplos usam `noc.seu-dominio.com` e `IP-DA-VPS`. Troque pelos valores reais do seu ambiente.

---

## 1. Como a produção está montada

```
Navegador ──HTTPS──► Cloudflare ──► Apache (80/443)
                                      ├── /         → /var/www/noc-horizon  (só o frontend)
                                      ├── /api/     → Gunicorn 127.0.0.1:5004 (backend)
                                      └── /zabbix   → interface do Zabbix
Backend ──JSON-RPC (localhost)──► API do Zabbix
```

| O quê | Onde |
|---|---|
| Código do backend | `/opt/noc-horizon/backend` (dono `root:noc`, sem acesso público) |
| Ambiente Python | `/opt/noc-horizon/venv` |
| Frontend publicado | `/var/www/noc-horizon` |
| Segredos e configuração | `/etc/noc-horizon/env` (permissão `640`, `root:noc`) |
| Serviço do backend | systemd — modelo em [`deploy/noc-horizon.service`](../deploy/noc-horizon.service) |
| Vhost do Apache | modelo em [`deploy/apache-noc-horizon.conf`](../deploy/apache-noc-horizon.conf) |
| Script de atualização | `/usr/local/bin/noc-atualizar` — fonte em [`deploy/noc-atualizar.sh`](../deploy/noc-atualizar.sh) |
| Logs do backend | `journalctl -u noc-horizon` |
| Logs do Apache | `/var/log/apache2/noc-horizon-*.log` |

> Na instalação original o serviço se chama `infra-map-backend`. Nesse caso, use esse nome nos comandos abaixo (e `NOC_SERVICE=infra-map-backend` no script de atualização).

---

## 2. Atualizar o painel (deploy)

**No computador de quem desenvolve (PowerShell):**

```powershell
cd $HOME\Documents\noc-horizon
tar -czf $env:TEMP\noc.tgz --exclude=venv --exclude=__pycache__ --exclude=tests index.html favicon.svg css js data backend
scp $env:TEMP\noc.tgz root@IP-DA-VPS:~/
ssh root@IP-DA-VPS "rm -rf ~/upload && mkdir ~/upload && tar -xzf ~/noc.tgz -C ~/upload && rm ~/noc.tgz"
```

**No servidor:**

```bash
sudo noc-atualizar          # deve terminar com "OK: backend respondendo"
```

Depois, recarregue o painel no navegador. Se ainda aparecer a versão antiga, veja o item **"Painel mostra a versão antiga"** na seção 5.

### Voltar uma versão (rollback)

O servidor não guarda versões anteriores. Para voltar, faça `git checkout <commit-anterior>` no computador de desenvolvimento, repita o envio acima e, ao terminar, volte para a branch principal (`git checkout master`).

---

## 3. Configuração e segredos

Toda a configuração fica em `/etc/noc-horizon/env` — nunca no código. Exemplo:

```
ZABBIX_URL=http://127.0.0.1/zabbix/api_jsonrpc.php
ZABBIX_API_TOKEN=<token do usuário somente leitura>
NOC_LOCATIONS_FROM=inventory
```

A lista completa de variáveis está no [README](../README.md#2-configurar-as-variáveis-de-ambiente). Depois de editar:

```bash
sudo systemctl restart noc-horizon
```

### Permissões que o usuário da API precisa no Zabbix

Papel (*role*) **somente leitura**, sem acesso à interface, com estes métodos de API:

| Método | Usado para |
|---|---|
| `problem.get`, `trigger.get` | Problemas ativos |
| `item.get` | Detectar hosts sem dados |
| `host.get` | Locais pelo inventário (`NOC_LOCATIONS_FROM=inventory`) |
| `event.get` | Confiabilidade: SLO, MTTR, MTTA |

O grupo do usuário precisa de permissão **Read** nos grupos de hosts exibidos no mapa.

### Trocar o token (rotação)

1. No Zabbix: **Users → API tokens → Create API token** para o usuário do painel (com data de expiração).
2. No servidor: atualize `ZABBIX_API_TOKEN` em `/etc/noc-horizon/env` e rode `sudo systemctl restart noc-horizon`.
3. Confira o painel (seção 4) e só então **apague o token antigo** no Zabbix.

---

## 4. Verificação rápida de saúde

```bash
# Backend no ar e falando com o Zabbix
curl -s http://127.0.0.1:5004/health
curl -s http://127.0.0.1:5004/api/locations | head -c 120; echo

# Pelo Apache, como um visitante (troque o domínio)
for p in / /api/locations /api/sla /backend/config.py /.git/config; do
  echo "$p -> $(curl -s -o /dev/null -w '%{http_code}' -H 'Host: noc.seu-dominio.com' http://127.0.0.1$p)"
done
```

Esperado: `200` para `/`, `/api/locations` e `/api/sla`; `403` ou `404` para `/backend/config.py` e `/.git/config`.

> **Atenção:** teste sempre com o cabeçalho `Host` do domínio do painel. Um teste em `http://127.0.0.1/` sem ele cai no vhost padrão do Apache e pode dar um falso "tudo certo" — foi exatamente o que aconteceu no [incidente de 27/09](postmortems/2026-09-27-token-zabbix-exposto.md).

Status de cada local e host:

```bash
curl -s http://127.0.0.1:5004/api/locations | python3 -c "import sys,json; [print(l['label'], '->', l['status'], [(h['host'], h['status'], h['last_data_age_seconds']) for h in l['hosts']]) for l in json.load(sys.stdin)['locations']]"
```

---

## 5. Problemas conhecidos e como resolver

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| Painel mostra a **versão antiga** depois do deploy | Cache da Cloudflare ou do navegador | Cloudflare → **Caching → Purge Everything** e `Ctrl+F5`. O `Cache-Control: no-cache` do vhost evita que isso se repita. |
| **"erro ao conectar: HTTP 502"** no painel | Backend fora do ar ou sem acesso ao Zabbix | `sudo journalctl -u noc-horizon -n 40`. Erros comuns: variável faltando em `/etc/noc-horizon/env`, token revogado, Zabbix fora do ar. |
| Backend não sobe: **`status=203/EXEC`** | Caminho do Gunicorn errado no serviço | Confira o `ExecStart` e se `/opt/noc-horizon/venv/bin/gunicorn` existe. |
| Host aparece **"Sem dados"** (cinza) | Host sem itens, agente parado ou sem permissão | Veja a seção 6. |
| Host **sumiu do globo** | Sem coordenadas no inventário e fora do `config.py` | Preencha *Location*, *Latitude* e *Longitude* no inventário do host. Aparece em até 5 min. |
| Confiabilidade mostra **"—"** / `/api/sla` com `ok: false` | Falta `event.get` no papel da API | Libere o método (seção 3) e aguarde até 5 min (cache). |
| **MTTA vazio** | Nenhum incidente foi reconhecido | Use **Acknowledge** em *Monitoring → Problems*. |
| Erro de **CSP** no console do navegador | Script de terceiro injetado (ex.: Cloudflare Web Analytics) | Desative o recurso na Cloudflare ou libere o domínio no `Content-Security-Policy`. |
| **Não consigo entrar por SSH** | Meu IP foi bloqueado pelo fail2ban | Pelo console web do provedor ou por outro IP: `sudo fail2ban-client set sshd unbanip MEU.IP`. Coloque o IP em `ignoreip` no `/etc/fail2ban/jail.local`. |

---

## 6. Diagnosticar um host "Sem dados"

O host não enviou nenhum dado novo há mais de `NOC_STALE_AFTER_SECONDS` (padrão 10 min). Investigue nesta ordem:

**1. A API enxerga itens desse host?**

```bash
sudo bash -c 'source /etc/noc-horizon/env; curl -s -X POST -H "Content-Type: application/json-rpc" -H "Authorization: Bearer $ZABBIX_API_TOKEN" -d "{\"jsonrpc\":\"2.0\",\"method\":\"item.get\",\"params\":{\"output\":[\"name\",\"lastclock\",\"state\"],\"host\":\"NOME-DO-HOST\",\"limit\":3},\"id\":1}" "$ZABBIX_URL"'
```

- `"result":[]` → o host **não tem itens** (falta vincular um template), o **nome não bate** com o cadastrado no Zabbix (o painel usa o *Host name* técnico, que diferencia maiúsculas) ou o usuário da API **não tem permissão** no grupo do host.
- Itens com `"lastclock":"0"` ou `"state":"1"` → o host existe, mas **não está coletando**: veja o agente.

**2. Conferir no banco do Zabbix (sem filtro de permissão):**

```bash
sudo mysql zabbix -e "SELECT h.host, h.status,
  (SELECT COUNT(*) FROM items i WHERE i.hostid=h.hostid) AS itens,
  (SELECT GROUP_CONCAT(t.host) FROM hosts_templates ht JOIN hosts t ON t.hostid=ht.templateid WHERE ht.hostid=h.hostid) AS templates
FROM hosts h WHERE h.host='NOME-DO-HOST';"
```

`itens = 0` e sem template → vincule um template (ex.: *Linux by Zabbix agent active*).

**3. No próprio host monitorado (agente ativo):**

```bash
systemctl status zabbix-agent2 2>/dev/null || systemctl status zabbix-agent
grep -E '^(ServerActive|Hostname)=' /etc/zabbix/zabbix_agent*.conf
```

`Hostname` precisa ser **idêntico** ao nome do host no Zabbix, e `ServerActive` precisa apontar para o servidor Zabbix (porta 10051 liberada).

---

## 7. Rotinas

| Frequência | Tarefa |
|---|---|
| A cada deploy | Verificação rápida de saúde (seção 4) |
| Semanal | Olhar o **orçamento de erro** no painel: abaixo de 50%, investigar os incidentes da semana |
| Mensal | `sudo fail2ban-client status sshd` e `sudo apt update && sudo apt list --upgradable` |
| Antes do vencimento | Rotação do token da API (seção 3) |
| Após qualquer incidente relevante | Escrever um postmortem em [`docs/postmortems/`](postmortems/) |

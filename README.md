# 🛰️ NOC Horizon

**Central de Operações com monitoramento global em tempo real**, construída para visualizar de forma clara e imediata a saúde de uma infraestrutura distribuída — hosts, alertas e latência — direto sobre um globo interativo.

[![CI](https://github.com/Sheila724/noc-horizon/actions/workflows/ci.yml/badge.svg)](https://github.com/Sheila724/noc-horizon/actions/workflows/ci.yml)
![Status](https://img.shields.io/badge/status-em%20produção-22d67a?style=flat-square)
![Backend](https://img.shields.io/badge/backend-Python%20%2B%20Flask-3776AB?style=flat-square&logo=python&logoColor=white)
![Dados](https://img.shields.io/badge/dados-Zabbix%20API-ff9a3d?style=flat-square)
![Frontend](https://img.shields.io/badge/frontend-D3.js-f0c93d?style=flat-square)
![Testes](https://img.shields.io/badge/testes-pytest-0a9edc?style=flat-square&logo=pytest&logoColor=white)
![Lint](https://img.shields.io/badge/lint-ruff-d7ff64?style=flat-square&logo=ruff&logoColor=black)
![Segredos](https://img.shields.io/badge/segredos-gitleaks-ff3b5c?style=flat-square)
![Docker](https://img.shields.io/badge/docker-compose-2496ED?style=flat-square&logo=docker&logoColor=white)
![Licença](https://img.shields.io/badge/license-MIT-7d8bab?style=flat-square)

---

## ⚡ Teste em 1 minuto (sem Zabbix)

Só precisa do [Docker](https://docs.docker.com/get-docker/):

```bash
git clone https://github.com/Sheila724/noc-horizon.git
cd noc-horizon
docker compose up -d --build
```

Abra **http://localhost:8080** 🚀

O painel sobe em **modo demo**: 12 locais pelo mundo e 42 hosts simulados, com incidentes que aparecem, são reconhecidos e resolvidos sozinhos, um host em manutenção e outro que para de enviar dados de tempos em tempos. Para desligar: `docker compose down`.

**Sem Docker?** Com Python 3.10+ também dá:

```bash
pip install -r backend/requirements.txt
python backend/dev_server.py
```

> Quer ligar no seu Zabbix? Copie `.env.example` para `.env`, defina `NOC_MODE=zabbix`, `ZABBIX_URL` e `ZABBIX_API_TOKEN`, e rode `docker compose up -d --build` de novo.

---

## 📺 Demonstração

**Visão geral do dashboard:**

https://github.com/user-attachments/assets/ddbfa4f6-a8f8-4421-b15a-42b760ef7bef

**Interações e detalhes operacionais:**

https://github.com/user-attachments/assets/6822855c-ed64-4944-84a4-fa0967a7dde9

---

## ✨ Visão Geral

O **NOC Horizon** é um painel de monitoramento (NOC — *Network Operations Center*) que consome dados em tempo real do **Zabbix** e os apresenta em um globo interativo construído com **D3.js**. Cada localização de infraestrutura é plotada geograficamente, com conexões animadas entre os pontos e o status de saúde de cada um (saudável, atenção, alerta ou crítico).

O objetivo é dar, em poucos segundos, uma leitura visual e intuitiva do estado da operação — sem precisar navegar por múltiplas telas do Zabbix.

---

## 🚀 Funcionalidades

- 🌍 **Globo interativo** com rotação/arraste, construído em SVG + D3.js
- 📍 **Localizações geolocalizadas** representando os pontos de infraestrutura monitorados
- 🔴🟡🟢 **Indicadores de severidade** por cor (saudável, atenção, alerta, crítico), derivados da severidade dos problemas ativos no Zabbix
- ⚪ **Detecção de "sem dados"** — host que para de enviar métricas fica cinza, em vez de continuar verde (falha silenciosa)
- ✅ **Problemas reconhecidos** (*acknowledged*) sinalizados, e **problemas em manutenção** exibidos esmaecidos, sem colorir o local
- 📊 **Painel unificado de operação**, mostrando:
  - Total de locais, hosts e alertas ativos
  - Saúde geral (% de **hosts** sem problema ativo e com dados recentes)
  - Triggers ativos (e quantos já foram reconhecidos)
  - Hosts com problema e hosts sem dados
  - Idade do dado mais antigo coletado
  - Latência da API do Zabbix
- 🪟 **Modal detalhado por localização**, com a lista de problemas ativos em cada host
- 📰 **Ticker contínuo** no rodapé com os problemas ativos e o status operacional de cada local
- 🔄 **Atualização automática** via polling configurável
- ⚡ **Cache no backend** — vários navegadores abertos não multiplicam as consultas ao Zabbix
- 🌐 **Frontend sem build e sem CDN** — HTML, CSS e JS puros, com as bibliotecas servidas localmente

---

## 🏗️ Arquitetura

```
                 Navegador do usuário
                          │  HTTPS
                          ▼
              ┌───────────────────────┐
              │  Apache (proxy + web) │
              │  • /      → frontend  │
              │  • /api/  → backend   │
              └─────┬───────────┬─────┘
       arquivos     │           │  127.0.0.1:5004
       estáticos    ▼           ▼
       ┌──────────────┐   ┌──────────────────┐  JSON-RPC   ┌─────────────┐
       │ Frontend     │   │ Backend (Flask   │ ──────────► │   Zabbix    │
       │ D3 + TopoJSON│   │ + Gunicorn)      │  token API  │   Server    │
       └──────────────┘   └──────────────────┘ (somente    └─────────────┘
                                                leitura)
```

O **backend em Python** consulta a API do Zabbix, agrega os problemas por localização/host e expõe um endpoint JSON (`GET /api/locations`), consumido periodicamente pelo frontend (`js/app.js`) via `fetch`. O backend escuta **somente em `127.0.0.1`**; o acesso externo passa sempre pelo Apache.

---

## 🧰 Stack Técnica

| Camada         | Tecnologia |
|----------------|------------|
| Frontend       | HTML5, CSS3, JavaScript (vanilla) |
| Visualização   | [D3.js](https://d3js.org/) v7 + [TopoJSON](https://github.com/topojson/topojson) + [world-atlas](https://github.com/topojson/world-atlas) |
| Backend        | Python 3.10+, Flask, Gunicorn |
| Fonte de dados | [Zabbix API](https://www.zabbix.com/documentation/current/en/manual/api) (testado com Zabbix 7.x) |
| Servidor       | Apache (arquivos estáticos + proxy reverso para a API) |

---

## 📁 Estrutura do Projeto

```
noc-horizon/
├── .github/
│   ├── workflows/ci.yml    # CI: lint, testes, pip-audit, bandit, gitleaks
│   └── dependabot.yml      # Atualização semanal de dependências
├── .pre-commit-config.yaml # Hooks locais (gitleaks, ruff)
├── docker-compose.yml      # Sobe frontend + backend (modo demo por padrão)
├── .env.example            # Variáveis do compose (modo, Zabbix, porta)
├── docker/web/             # Imagem do frontend: Nginx sem root + CSP
├── docs/postmortems/       # Análises de incidentes (formato blameless)
├── index.html              # Estrutura da página (header, cards, globo, ticker, modal)
├── favicon.svg
├── css/
│   └── style.css           # Estilos visuais (tema dark, glassmorphism, animações)
├── js/
│   ├── config.js           # Configurações (URL da API, polling, cores/labels de status)
│   ├── map.js              # Renderização do globo e dos nós geográficos com D3.js
│   ├── app.js              # Orquestração: busca de dados, cards, ticker e modal
│   └── vendor/             # d3.min.js e topojson-client.min.js (servidos localmente)
├── data/
│   └── countries-110m.json # Mapa-múndi (world-atlas)
└── backend/
    ├── app.py              # Rotas HTTP (/api/locations, /health) + cache
    ├── aggregator.py       # Status por host/local e resumo (função pura, testável)
    ├── zabbix_client.py    # Cliente da API JSON-RPC do Zabbix
    ├── demo_source.py      # Dados simulados para o modo demo
    ├── dev_server.py       # Servidor local sem Docker (frontend + API)
    ├── Dockerfile          # Imagem do backend (usuário sem privilégios)
    ├── config.py           # Mapa host → localização; lê segredos do ambiente
    ├── requirements.txt
    ├── requirements-dev.txt
    ├── pytest.ini
    ├── ruff.toml           # Regras de lint/formatação
    ├── tests/              # Testes da agregação (pytest)
    └── .env.example        # Modelo das variáveis de ambiente (sem segredos)
```

---

## ⚙️ Instalação e Configuração

### Pré-requisitos

- Python 3.10+
- Um servidor Zabbix acessível, com API habilitada
- Apache com os módulos `proxy`, `proxy_http` e `headers`

### 1. Criar um usuário somente leitura no Zabbix

Não use o usuário Admin. No Zabbix:

1. **Users → User roles** → crie um papel do tipo *User*, sem acesso à interface, com **API** permitida apenas para `problem.get`, `trigger.get` e `item.get`.
2. **Users → User groups** → crie um grupo com *Frontend access: Disabled* e permissão **Read** apenas nos grupos de hosts exibidos no mapa.
3. **Users → Users** → crie o usuário do painel com esse grupo e papel.
4. **Users → API tokens** → gere um token para esse usuário (com data de expiração).

### 2. Configurar as variáveis de ambiente

O backend lê os segredos **somente do ambiente** — nunca coloque token ou URL no código. Use o modelo `backend/.env.example`:

```
ZABBIX_URL=http://127.0.0.1/zabbix/api_jsonrpc.php
ZABBIX_API_TOKEN=coloque-o-token-aqui
```

Para rodar **sem Zabbix**, use `NOC_MODE=demo` — as duas variáveis acima deixam de ser necessárias.

Opcional: `NOC_STALE_AFTER_SECONDS` (padrão `600`) — após quanto tempo sem dados um host aparece como **Sem dados**.

Em produção, esses valores ficam em um arquivo fora do projeto (ex.: `/etc/noc-horizon/env`, com permissão `640`), carregado pelo systemd.

### 3. Mapear hosts e localizações

Em `backend/config.py`, ajuste `HOST_LOCATION_MAP` (nome do host no Zabbix → localização) e `LOCATIONS` (rótulo e coordenadas de cada local).

### 4. Rodar localmente (desenvolvimento)

```bash
cd backend
python3 -m venv venv
source venv/bin/activate            # Windows: venv\Scripts\activate
pip install -r requirements.txt
export ZABBIX_URL=... ZABBIX_API_TOKEN=...   # PowerShell: $env:ZABBIX_URL="..."
flask --app app run
```

Para ver o frontend, sirva a raiz do projeto com um servidor estático (ex.: Live Server do VS Code). Abrir o `index.html` direto do disco não funciona, pois o navegador bloqueia o carregamento do mapa.

### 5. Testes

```bash
cd backend
pip install -r requirements-dev.txt
pytest
```

Os testes cobrem a lógica de status e do resumo: cálculo de saúde por host, problemas fora do mapa, estado "sem dados", reconhecidos e manutenção.

Para desenvolver, instale os hooks locais uma vez — eles rodam **gitleaks** (bloqueia commit com token/senha) e **ruff** a cada commit:

```bash
pip install pre-commit
pre-commit install
```

### 6. Produção

**Backend como serviço** (Gunicorn, usuário sem privilégios, só em localhost):

```ini
# /etc/systemd/system/noc-horizon.service
[Service]
User=noc
Group=noc
EnvironmentFile=/etc/noc-horizon/env
WorkingDirectory=/opt/noc-horizon/backend
ExecStart=/opt/noc-horizon/venv/bin/gunicorn --workers 2 --bind 127.0.0.1:5004 app:app
Restart=always
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
```

**Apache** servindo **apenas o frontend** (nunca aponte o `DocumentRoot` para a raiz do repositório — isso exporia `backend/` e `.git/`):

```apache
<VirtualHost *:80>
    ServerName noc.seu-dominio.com
    DocumentRoot /var/www/noc-horizon        # só index.html, favicon.svg, css/, js/, data/

    <Directory /var/www/noc-horizon>
        Options -Indexes -FollowSymLinks
        AllowOverride None
        Require all granted
        Header always set Content-Security-Policy "default-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
        Header always set X-Content-Type-Options "nosniff"
        Header always set X-Frame-Options "DENY"
        Header always set Referrer-Policy "no-referrer"
    </Directory>

    <LocationMatch "/\.(?!well-known)">
        Require all denied
    </LocationMatch>

    ProxyRequests Off
    ProxyPass        /api/ http://127.0.0.1:5004/api/ timeout=20
    ProxyPassReverse /api/ http://127.0.0.1:5004/api/
</VirtualHost>
```

Recomenda-se publicar o painel com **HTTPS** (Let's Encrypt ou certificado de origem da Cloudflare).

---

## 🚦 Como o status é calculado

| Status | Quando |
|---|---|
| 🟢 Saudável | Nenhum problema ativo e dados recebidos há menos de `NOC_STALE_AFTER_SECONDS` |
| ⚪ Sem dados | O host não envia dados novos há mais que o limite (ou nunca enviou) |
| 🟡 Atenção | Pior problema ativo com severidade *Not classified*, *Information* ou *Warning* |
| 🟠 Alerta | Pior problema ativo com severidade *Average* |
| 🔴 Crítico | Pior problema ativo com severidade *High* ou *Disaster* |

- O status de um **local** é o pior status entre os seus hosts.
- Problemas **em manutenção** aparecem no detalhe, mas não colorem o local nem entram no total de alertas.
- Problemas de hosts que não estão no mapa não entram no total (ficam em `unmapped_problems` na API).

---

## 🔄 Integração Contínua

Cada push e pull request roda no GitHub Actions:

| Job | O que verifica |
|---|---|
| Backend | `ruff` (lint + formatação) e `pytest` |
| Frontend | Sintaxe dos arquivos JS e ausência de `innerHTML` (XSS) |
| Segurança | `pip-audit` (dependências com CVE) e `bandit` (análise estática) |
| Segredos | `gitleaks` (tokens e senhas commitados) |
| Docker | Sobe o `docker compose` em modo demo e testa painel, API, CSP e bloqueio de arquivos ocultos |

O **Dependabot** abre PRs semanais com atualizações de dependências Python e das actions.

---

## 🔒 Segurança

- Segredos (URL e token do Zabbix) ficam **apenas em variáveis de ambiente**; `.env` está no `.gitignore`.
- O token do Zabbix pertence a um usuário **somente leitura**, restrito aos métodos de API usados.
- O backend escuta só em `127.0.0.1`, roda com usuário sem privilégios e não devolve detalhes de erro ao navegador.
- Dados vindos do Zabbix são inseridos no DOM com `textContent` (sem `innerHTML`), evitando XSS.
- Frontend sem dependências externas, protegido por Content Security Policy.
- Segredos barrados antes do commit (pre-commit + gitleaks) e verificados de novo no CI.
- 📄 Incidentes viram aprendizado: veja o [postmortem do token exposto](docs/postmortems/2026-09-27-token-zabbix-exposto.md).
- ⚠️ O painel ainda **não possui autenticação**: qualquer pessoa com a URL vê nomes de hosts e problemas ativos. Veja o roadmap.

---

## 🗺️ Roadmap

- [ ] Autenticação/controle de acesso ao painel (ex.: OIDC/Keycloak no Apache)
- [ ] Suporte a múltiplos provedores de monitoramento além do Zabbix
- [ ] Histórico de disponibilidade (uptime) por localização

---

## 👩‍💻 Autora

Desenvolvido por **Sheila Alves**

- GitHub: [@Sheila724](https://github.com/Sheila724)
- LinkedIn: [sheila-alvesaraujo](https://www.linkedin.com/in/sheila-alvesaraujo)

---

## 📄 Licença

Este projeto está sob a licença MIT — sinta-se livre para usar, modificar e distribuir.

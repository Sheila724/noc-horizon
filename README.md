# 🛰️ NOC Horizon
 
**Central de Operações com monitoramento global em tempo real**, construída para visualizar de forma clara e imediata a saúde de uma infraestrutura distribuída — hosts, alertas e latência — direto sobre um globo interativo.
 
![Status](https://img.shields.io/badge/status-em%20produção-22d67a?style=flat-square)
![Backend](https://img.shields.io/badge/backend-Python-3776AB?style=flat-square&logo=python&logoColor=white)
![Dados](https://img.shields.io/badge/dados-Zabbix%20API-ff9a3d?style=flat-square)
![Frontend](https://img.shields.io/badge/frontend-D3.js-f0c93d?style=flat-square)
![Licença](https://img.shields.io/badge/license-MIT-7d8bab?style=flat-square)
 
---
 
## 📺 Demonstração

**Visão geral do dashboard:**

https://github.com/user-attachments/assets/ddbfa4f6-a8f8-4421-b15a-42b760ef7bef

**Interações e detalhes operacionais:**

https://github.com/user-attachments/assets/6822855c-ed64-4944-84a4-fa0967a7dde9


---
 
## ✨ Visão Geral
 
O **NOC Horizon** é um painel de monitoramento (NOC — *Network Operations Center*) que consome dados em tempo real do **Zabbix** e os apresenta em um globo 3D interativo construído com **D3.js**. Cada localização de infraestrutura é plotada geograficamente, com conexões animadas indicando fluxo de dados e o status de saúde de cada ponto (saudável, atenção, alerta ou crítico).
 
O objetivo é dar, em poucos segundos, uma leitura visual e intuitiva do estado da operação — sem precisar navegar por múltiplas telas do Zabbix.
 
---
 
## 🚀 Funcionalidades
 
- 🌍 **Globo interativo** com rotação/arraste, construído em SVG + D3.js
- 📍 **Localizações geolocalizadas** representando os pontos de infraestrutura monitorados
- 🔴🟡🟢 **Indicadores de severidade** por cor (saudável, atenção, alerta, crítico), sincronizados com os triggers do Zabbix
- 📊 **Painel unificado de operação**, mostrando:
  - Total de locais, hosts e alertas ativos
  - Percentual de saúde geral
  - Triggers ativos
  - Hosts com problema
  - Idade do dado mais antigo coletado
  - Latência da API
- 🪟 **Modal detalhado por localização**, com a lista de problemas ativos em cada host
- 📰 **Ticker contínuo** no rodapé com o histórico de eventos e status operacional
- 🔄 **Atualização automática** via polling configurável
- 📱 **Automação de Notificações:** Envio de alertas críticos e resoluções em tempo real diretamente para o WhatsApp
- 🌐 **Totalmente client-side no frontend** — HTML, CSS e JS puros, sem necessidade de build
---
 
## 🏗️ Arquitetura
 
```
┌─────────────┐      consulta       ┌──────────────┐
│   Zabbix    │ ◄─────────────────  │   Backend    │
│   Server    │                     │   (Python)   │
└─────────────┘                     └──────┬───────┘
                                            │ expõe API REST (JSON)
                                            ▼
                                   ┌──────────────────┐
                                   │  Frontend (SPA)   │
                                   │  D3.js + Topojson │
                                   └──────────────────┘
                                            │
                                            ▼
                                     Navegador do usuário
```
 
Além de servir o frontend, o backend orquestra o disparo de notificações de incidentes para dispositivos móveis via integração com o WhatsApp.
 
O **backend em Python** consulta a API do Zabbix, agrega as informações por localização/host e expõe um endpoint JSON simples, consumido periodicamente pelo frontend (`js/app.js`) via `fetch`.
 
---
 
## 🧰 Stack Técnica
 
| Camada     | Tecnologia                                   |
|------------|-----------------------------------------------|
| Frontend   | HTML5, CSS3, JavaScript (vanilla)             |
| Visualização | [D3.js](https://d3js.org/) v7 + [TopoJSON](https://github.com/topojson/topojson) |
| Backend    | Python                                        |
| Fonte de dados | [Zabbix API](https://www.zabbix.com/documentation/current/en/manual/api) |
| Servidor   | Nginx / Apache (arquivos estáticos + proxy para a API) |
 
---
 
## 📁 Estrutura do Projeto
 
```
infra-map/
├── index.html          # Estrutura da página (header, cards, globo, ticker, modal)
├── css/
│   └── style.css       # Estilos visuais (tema dark, glassmorphism, animações)
├── js/
│   ├── config.js        # Configurações (URL da API, intervalo de polling, cores/labels de status)
│   ├── map.js            # Renderização do globo e dos nós geográficos com D3.js
│   └── app.js            # Orquestração: busca de dados, atualização dos cards, ticker e modal
└── backend/
    └── ...              # API Python que consulta o Zabbix e serve os dados em JSON
```
 
---
 
## ⚙️ Instalação e Configuração
 
### Pré-requisitos
 
- Python 3.x
- Um servidor Zabbix acessível, com API habilitada
- Servidor web (Nginx, Apache ou similar) para servir os arquivos estáticos
### 1. Clonar o repositório
 
```bash
git clone https://github.com/Sheila724/noc-horizon.git
cd noc-horizon
```
 
### 2. Configurar o backend
 
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```
 
Configure as credenciais de acesso ao Zabbix (URL da API, usuário/token) conforme o arquivo de configuração do backend, e inicie o serviço:
 
```bash
python3 app.py
```
 
### 3. Configurar o frontend
 
Edite `js/config.js` apontando `API_URL` para o endpoint exposto pelo backend, por exemplo:
 
```js
const CONFIG = {
  API_URL: "https://seu-dominio.com/api/status",
  POLL_INTERVAL_MS: 10000,
  STATUS_LABEL: { /* ... */ },
  STATUS_COLOR: { /* ... */ }
};
```
 
### 4. Servir os arquivos
 
Basta apontar seu servidor web (Nginx/Apache) para a pasta `infra-map/`, garantindo que o backend esteja acessível via proxy reverso, se necessário.
 
---
 
## 🗺️ Roadmap
 
- [ ] Autenticação/controle de acesso ao painel
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

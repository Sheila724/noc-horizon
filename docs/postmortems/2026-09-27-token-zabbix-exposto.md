# Postmortem: token da API do Zabbix exposto no código e no servidor web

| | |
|---|---|
| **Data do incidente** | 27/09/2026 (detecção e contenção) |
| **Severidade** | Alta — credencial de produção exposta publicamente |
| **Status** | Resolvido |
| **Autoria** | Equipe NOC Horizon |
| **Formato** | *Blameless* — o foco é em processos e sistemas, não em pessoas |

## Resumo

O token da API do Zabbix usado pelo NOC Horizon estava escrito no código-fonte (`backend/config.py`) como valor padrão. Esse arquivo foi para o repositório Git e, por causa da forma como o projeto foi publicado no servidor, **o código do backend e a pasta `.git` inteira ficaram acessíveis publicamente pelo site do painel**, por cerca de 2 a 3 dias.

O problema foi encontrado numa revisão de segurança manual. A exposição foi bloqueada em cerca de **1 minuto após ser confirmada**, o token foi revogado e substituído por outro com permissões mínimas, e o histórico do Git foi limpo. **Não foi encontrada evidência de uso indevido** nos logs disponíveis.

## Impacto

**O que ficou exposto:**

- O token da API do Zabbix, de um usuário cujas permissões não eram restritas ao que o painel precisava.
- A URL da API do Zabbix, com o IP público do servidor, acessada por **HTTP sem criptografia**.
- Nomes de hosts e localização da infraestrutura monitorada.
- Todo o histórico do repositório, através da pasta `.git` publicada no site.

**O que não aconteceu (até onde foi possível verificar):**

- Nenhum download de `backend/` ou `.git/` por terceiros apareceu nos logs de acesso do Apache.
- Nenhuma indisponibilidade do painel ou do Zabbix foi causada pelo incidente. O painel ficou sem dados por alguns minutos durante a troca do token, como planejado.

## Linha do tempo (horário de Brasília)

| Quando | O que aconteceu |
|---|---|
| 24–25/09 | O painel é publicado na VPS: o repositório é clonado direto na pasta servida pelo Apache (`DocumentRoot`), e o backend sobe como serviço rodando como `root`. **Início da exposição.** |
| 27/09 | Commit inicial no GitHub inclui o token no `config.py` e arquivos compilados do Python (`__pycache__/*.pyc`), que também contêm o token. |
| 27/09 21:47 | Revisão de código encontra o token escrito no `config.py` e a API do Zabbix em HTTP. |
| 27/09 22:22 | Primeiro teste de exposição dá **404** em tudo. Falso negativo: o teste foi feito no *vhost* padrão do Apache, e não no do painel. |
| 27/09 22:26 | O mesmo teste no vhost do painel: `/backend/config.py` e `/.git/config` respondem **200**. **Exposição confirmada.** |
| 27/09 22:26 | Logo em seguida, uma regra no Apache bloqueia `backend/` e arquivos ocultos (passam a responder 403). **Contenção.** |
| 27/09 22:28 | Análise dos logs de acesso: os únicos pedidos de fora a esses caminhos são os próprios testes de verificação, já bloqueados. |
| 27/09 ~22:30 | Token revogado no Zabbix. Criado um usuário dedicado, somente leitura, com acesso apenas a `problem.get`, `trigger.get` e `item.get`. |
| 27/09 22:32–22:44 | Migração: o código sai da pasta pública; o backend passa a rodar como usuário sem privilégios, com o token num arquivo fora do projeto (`/etc/noc-horizon/env`, permissão 640); o Apache passa a servir só uma cópia do frontend, com CSP e bloqueio de arquivos ocultos. A cópia antiga é retirada do ar. **Fim da exposição.** |
| 28/09 ~13:00 | CI no GitHub Actions com **gitleaks**, e hook de pre-commit que bloqueia segredos antes do commit. |
| 28/09 ~13:11 | Histórico do Git reescrito com `git filter-repo` para remover o token e o IP. |
| 28/09 ~13:13 | O token ainda existia dentro dos `.pyc` (o `filter-repo` não altera arquivos binários). A pasta `__pycache__` é removida de todo o histórico. Verificação final: nenhum commit contém o token. **Resolvido.** |

## Causa raiz

O incidente não teve uma causa única. Foram várias falhas pequenas que se somaram:

1. **Segredo como valor padrão no código.** O `config.py` usava `os.environ.get("ZABBIX_API_TOKEN", "<token real>")`. A intenção era ler da variável de ambiente, mas o valor de reserva era a própria credencial, e ele foi commitado junto.
2. **Deploy por `git clone` dentro da pasta pública do servidor web.** O `DocumentRoot` do Apache apontava para a raiz do repositório, então tudo que estava no repositório (incluindo `backend/` e `.git/`) virou conteúdo do site.
3. **Sem barreira automática contra segredos.** Não havia `.gitignore`, verificação de segredos nem CI. O token passou pelo commit, pelo push e pelo deploy sem nenhum alerta.
4. **Credencial com mais poder do que o necessário.** O painel só precisa ler problemas e itens, mas usava um token sem esse escopo restrito. E a API do Zabbix era acessada por HTTP num IP público.

### Fatores que agravaram

- **O backend rodava como `root`.** Uma falha no backend daria controle total da VPS.
- **O domínio passa pela Cloudflare.** Os logs do Apache registram os IPs da Cloudflare, e não os dos visitantes, o que dificulta saber exatamente quem acessou o quê.

## O que funcionou bem

- **Contenção rápida:** cerca de 1 minuto entre confirmar a exposição e bloqueá-la.
- **Verificação nos logs antes de concluir** que não houve acesso, em vez de presumir.
- **Correção em camadas na mesma noite:** revogar o token, reduzir as permissões, tirar o código da pasta pública, endurecer o serviço e o servidor web.
- **Prevenção automatizada no dia seguinte:** o mesmo erro agora é bloqueado no notebook (pre-commit) e de novo no GitHub (CI).

## O que poderia ter sido melhor

- **O primeiro teste deu falso negativo.** Ele foi feito no vhost padrão (`http://127.0.0.1/...`), que não serve o painel. Só o teste com o cabeçalho `Host` do domínio do painel revelou a exposição. **Lição: teste exatamente o caminho que um visitante usaria.**
- **O `git filter-repo --replace-text` não altera arquivos binários.** A primeira limpeza do histórico deixou o token dentro dos `.pyc`. **Lição: depois de limpar um segredo, procure de novo no histórico inteiro antes de dar como resolvido.**
- **A detecção foi manual.** Nada teria encontrado o problema sozinho.

## Ações corretivas

| # | Ação | Tipo | Status |
|---|---|---|---|
| 1 | Revogar o token exposto | Contenção | ✅ Feito |
| 2 | Usuário dedicado no Zabbix, somente leitura, com só os 3 métodos de API usados | Prevenção | ✅ Feito |
| 3 | `config.py` lê segredos só do ambiente, sem valor padrão | Prevenção | ✅ Feito |
| 4 | Código fora da pasta pública; Apache serve só uma cópia do frontend | Prevenção | ✅ Feito |
| 5 | Bloqueio de arquivos ocultos (`.git`, `.env`) no Apache e no Nginx | Prevenção | ✅ Feito |
| 6 | Backend como usuário sem privilégios, com o systemd endurecido | Mitigação | ✅ Feito |
| 7 | Backend escutando só em `127.0.0.1`; a API do Zabbix é chamada localmente | Prevenção | ✅ Feito |
| 8 | `.gitignore` para `__pycache__`, `venv` e `.env` | Prevenção | ✅ Feito |
| 9 | gitleaks no pre-commit e no CI | Detecção | ✅ Feito |
| 10 | Histórico do Git limpo (código e binários) | Correção | ✅ Feito |
| 11 | Revisar o *audit log* do Zabbix no período da exposição | Verificação | ⏳ Pendente |
| 12 | `mod_remoteip` no Apache, para registrar o IP real do visitante atrás da Cloudflare | Detecção | ⏳ Pendente |
| 13 | HTTPS de ponta a ponta (certificado de origem + Cloudflare *Full strict*) | Prevenção | ⏳ Pendente |
| 14 | Liberar as portas 80/443 da VPS só para os IPs da Cloudflare | Prevenção | ⏳ Pendente |
| 15 | Autenticação no painel | Prevenção | ⏳ Pendente |
| 16 | Data de expiração no token e rotina de rotação | Prevenção | ⏳ Pendente |

## Lições para outros projetos

- **Nunca use um segredo real como valor padrão.** Se a variável de ambiente não existir, o programa deve parar com um erro claro.
- **Nunca aponte o servidor web para a raiz de um repositório.** Publique só os arquivos que o navegador precisa.
- **Coloque um verificador de segredos antes do primeiro commit**, e não depois do primeiro incidente.
- **Dê a cada sistema só a permissão de que ele precisa.** Um token somente leitura vazado é um problema; um token de administrador vazado é um desastre.
- **Ao limpar um segredo do Git, confira binários e arquivos gerados**, e procure de novo no histórico inteiro.

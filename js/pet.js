// Pet do NOC: uma telinha com olhos que mora no rodapé do painel e reage ao estado da operação.
// Não faz chamadas próprias: app.js entrega os dados que já buscou (NocPet.update / NocPet.erro).
// Compatível com o CSP do painel: nada de style/script inline; só classes e element.style via JS.
(function () {
  "use strict";

  const ORDEM = ["ok", "unknown", "warning", "attention", "critical"];
  const ROTULO = {
    ok: "tudo saudável",
    unknown: "sem dados",
    warning: "em atenção",
    attention: "em alerta",
    critical: "crítico",
  };
  const DORMIR_APOS_MS = 3 * 60 * 1000;  // tudo verde e ninguém mexendo: cochila
  const ERROS_PARA_DESMAIAR = 2;         // falhas seguidas da API até ele "desmaiar"
  const CHAVE_OCULTO = "noc-pet-oculto";
  const LARGURA = 76;
  const MARGEM = 12;

  const calmo = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------------- estado ----------------
  let nivel = null;            // pior status atual (null antes do primeiro dado)
  let pior = null;             // pior local (objeto de /api/locations)
  let resumo = null;
  let erros = 0;
  let desmaiado = false;
  let dormindo = false;
  let ultimaMudanca = Date.now();
  let ultimaInteracao = Date.now();
  let balaoAte = 0;            // 0 = balão fixo (enquanto durar o problema)
  let x = MARGEM;
  let vx = 0;
  let paradoAte = 0;
  let ultimoQuadro = 0;

  // ---------------- DOM ----------------
  const raiz = document.createElement("div");
  raiz.id = "noc-pet";
  raiz.className = "noc-pet";

  const balao = document.createElement("div");
  balao.className = "pet-balao";
  balao.setAttribute("role", "status");
  balao.setAttribute("aria-live", "polite");
  balao.hidden = true;

  const corpo = document.createElement("button");
  corpo.type = "button";
  corpo.className = "pet-corpo";
  corpo.setAttribute("aria-label", "Pet do NOC");
  // Desenho fixo (nenhum dado da API entra aqui), montado com DOMParser
  const DESENHO = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 100" aria-hidden="true" focusable="false">
      <rect class="pet-moldura" x="8" y="6" width="104" height="78" rx="18"/>
      <rect class="pet-tela" x="18" y="15" width="84" height="60" rx="11"/>
      <g class="pet-olhos">
        <g class="olhos-abertos"><rect x="35" y="29" width="16" height="22" rx="8"/><rect x="69" y="29" width="16" height="22" rx="8"/></g>
        <g class="olhos-felizes"><path d="M35 44 q8 -12 16 0"/><path d="M69 44 q8 -12 16 0"/></g>
        <g class="olhos-fechados"><path d="M35 41 h16"/><path d="M69 41 h16"/></g>
        <g class="olhos-x"><path d="M37 33 l12 12 M49 33 l-12 12"/><path d="M71 33 l12 12 M83 33 l-12 12"/></g>
      </g>
      <g class="pet-boca">
        <path class="boca-sorriso" d="M52 60 q8 7 16 0"/>
        <path class="boca-reta" d="M53 62 h14"/>
        <ellipse class="boca-o" cx="60" cy="62" rx="4.5" ry="5.5"/>
        <path class="boca-onda" d="M50 63 q3 -4 6 0 t6 0 t6 0"/>
      </g>
      <path class="pet-pe" d="M42 84 v8 M78 84 v8"/>
      <g class="pet-zz"><text x="96" y="12">z</text><text x="104" y="4">z</text></g>
    </svg>`;
  corpo.appendChild(document.importNode(
    new DOMParser().parseFromString(DESENHO, "image/svg+xml").documentElement, true));

  const fechar = document.createElement("button");
  fechar.type = "button";
  fechar.className = "pet-fechar";
  fechar.title = "Esconder o pet";
  fechar.setAttribute("aria-label", "Esconder o pet");
  fechar.textContent = "×";

  const reabrir = document.createElement("button");
  reabrir.type = "button";
  reabrir.id = "noc-pet-reabrir";
  reabrir.title = "Mostrar o pet";
  reabrir.setAttribute("aria-label", "Mostrar o pet");
  reabrir.textContent = "🐾";

  raiz.append(balao, corpo, fechar);

  const olhos = corpo.querySelector(".pet-olhos");   // o grupo inteiro segue o cursor (o piscar fica nos filhos)

  // ---------------- utilidades ----------------
  function gravidade(status) {
    const i = ORDEM.indexOf(status);
    return i < 0 ? 0 : i;
  }

  function lerOculto() {
    try { return window.localStorage.getItem(CHAVE_OCULTO) === "1"; } catch (_) { return false; }
  }
  function gravarOculto(valor) {
    try { window.localStorage.setItem(CHAVE_OCULTO, valor ? "1" : "0"); } catch (_) { /* sem armazenamento */ }
  }

  function aplicarOculto(oculto) {
    raiz.hidden = oculto;
    reabrir.hidden = !oculto;
  }

  function falar(texto, segundos) {
    balao.textContent = texto;
    balao.hidden = !texto;
    balaoAte = segundos ? Date.now() + segundos * 1000 : 0;
  }

  // expressão = classe no corpo; o CSS escolhe olhos, boca e animação
  function expressao(nome) {
    corpo.dataset.expr = nome;
  }

  function animar(classe, ms) {
    if (calmo) return;
    corpo.classList.remove(classe);
    void corpo.offsetWidth;  // reinicia a animação
    corpo.classList.add(classe);
    window.setTimeout(() => corpo.classList.remove(classe), ms);
  }

  function confete() {
    if (calmo) return;
    for (let i = 0; i < 14; i++) {
      const c = document.createElement("span");
      c.className = `pet-confete c${i % 4}`;
      c.style.left = `${10 + Math.random() * 56}px`;
      c.style.setProperty("--dx", `${(Math.random() - 0.5) * 90}px`);
      c.style.animationDelay = `${Math.random() * 0.25}s`;
      raiz.appendChild(c);
      window.setTimeout(() => c.remove(), 1600);
    }
  }

  function acordar() {
    if (!dormindo) return;
    dormindo = false;
    raiz.classList.remove("dormindo");
  }

  function expressaoDoNivel() {
    if (desmaiado) return "desmaiado";
    if (dormindo) return "dormindo";
    switch (nivel) {
      case "critical": return "assustado";
      case "attention": return "preocupado";
      case "warning": return "curioso";
      case "unknown": return "confuso";
      default: return "feliz";
    }
  }

  function atualizarRotulo() {
    const estado = desmaiado ? "sem conexão com o monitoramento" : ROTULO[nivel] || "carregando";
    const extra = pior && nivel !== "ok" ? ` · pior local: ${pior.label}. Clique para ver os detalhes.` : "";
    corpo.setAttribute("aria-label", `Pet do NOC: ${estado}${extra}`);
    raiz.dataset.nivel = desmaiado ? "offline" : nivel || "ok";
  }

  // ---------------- dados ----------------
  function piorLocal(locais) {
    const comProblema = (locais || []).filter(l => l.status !== "ok");
    comProblema.sort((a, b) =>
      gravidade(b.status) - gravidade(a.status) ||
      (b.problems || []).filter(p => !p.suppressed).length - (a.problems || []).filter(p => !p.suppressed).length ||
      String(a.label).localeCompare(String(b.label)));
    return comProblema[0] || null;
  }

  function update(summary, locais) {
    resumo = summary || null;
    erros = 0;
    const novoPior = piorLocal(locais);
    const novoNivel = novoPior ? novoPior.status : "ok";
    const antes = nivel;
    const piorAntes = pior;
    pior = novoPior;

    if (desmaiado) {
      desmaiado = false;
      acordar();
      falar("Voltei! A conexão com o monitoramento voltou.", 5);
      animar("pulando", 700);
    }

    if (antes === null) {
      const n = summary && summary.locations_count;
      falar(novoNivel === "ok"
        ? `Oi! Estou de olho em ${n ?? "todos os"} locais. Tudo verde.`
        : `Oi! ${novoPior.label} está ${ROTULO[novoNivel]}.`, novoNivel === "critical" ? 0 : 6);
    } else if (novoNivel !== antes) {
      ultimaMudanca = Date.now();
      acordar();
      if (novoNivel === "critical") {
        falar(`🚨 ${novoPior.label}: crítico!`, 0);
        animar("susto", 900);
      } else if (novoNivel === "ok") {
        falar("Tudo verde de novo! 🎉", 6);
        animar("pulando", 700);
        confete();
      } else if (gravidade(novoNivel) > gravidade(antes)) {
        falar(novoNivel === "unknown"
          ? `Hmm… cadê os dados de ${novoPior.label}?`
          : `Opa, ${novoPior.label} está ${ROTULO[novoNivel]}.`, 8);
        animar("pulinho", 500);
      } else {
        falar(`Melhorou: ${novoPior.label} agora está ${ROTULO[novoNivel]}.`, 6);
      }
    } else if (novoNivel === "critical" && piorAntes && novoPior && piorAntes.id !== novoPior.id) {
      falar(`🚨 ${novoPior.label}: crítico!`, 0);
    }

    nivel = novoNivel;
    expressao(expressaoDoNivel());
    atualizarRotulo();
  }

  function erro() {
    erros += 1;
    if (erros >= ERROS_PARA_DESMAIAR && !desmaiado) {
      desmaiado = true;
      acordar();
      falar("Perdi a conexão com o monitoramento 😵", 0);
      expressao("desmaiado");
      atualizarRotulo();
    }
  }

  // ---------------- interação ----------------
  corpo.addEventListener("click", () => {
    ultimaInteracao = Date.now();
    acordar();
    if (pior && nivel !== "ok" && typeof window.openModal === "function") {
      window.openModal(pior);
      return;
    }
    expressao("carinho");
    animar("pulinho", 500);
    const frases = ["Tudo tranquilo por aqui.", "Nenhum alerta. Posso tirar um cochilo?", "Estou de olho! 👀"];
    if (resumo && resumo.health_pct != null) frases.push(`Saúde geral: ${resumo.health_pct.toFixed(1)}%.`);
    falar(desmaiado ? "Ainda sem conexão…" : frases[Math.floor(Math.random() * frases.length)], 4);
    window.setTimeout(() => expressao(expressaoDoNivel()), 1500);
  });

  corpo.addEventListener("mouseenter", () => {
    ultimaInteracao = Date.now();
    if (dormindo) {
      acordar();
      expressao(expressaoDoNivel());
    }
  });

  fechar.addEventListener("click", () => { gravarOculto(true); aplicarOculto(true); });
  reabrir.addEventListener("click", () => { gravarOculto(false); aplicarOculto(false); });

  // olhos seguem o cursor
  document.addEventListener("mousemove", ev => {
    if (raiz.hidden) return;
    const r = corpo.getBoundingClientRect();
    const dx = ev.clientX - (r.left + r.width / 2);
    const dy = ev.clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, d / 300) * 4;
    olhos.style.transform = `translate(${(dx / d) * k}px, ${(dy / d) * k}px)`;
  });

  // ---------------- movimento ----------------
  function limites() {
    return [MARGEM, Math.max(MARGEM, window.innerWidth - LARGURA - MARGEM)];
  }

  function quadro(t) {
    const dt = ultimoQuadro ? Math.min(0.05, (t - ultimoQuadro) / 1000) : 0;
    ultimoQuadro = t;
    const agora = Date.now();

    if (balaoAte && agora > balaoAte) falar("", 0);

    if (!dormindo && !desmaiado && nivel === "ok" &&
        agora - ultimaMudanca > DORMIR_APOS_MS && agora - ultimaInteracao > DORMIR_APOS_MS) {
      dormindo = true;
      raiz.classList.add("dormindo");
      expressao("dormindo");
      atualizarRotulo();
    }

    const [min, max] = limites();
    const andar = !calmo && !dormindo && !desmaiado && nivel !== null;
    if (andar && agora >= paradoAte) {
      if (vx === 0) {
        // velocidade depende do humor: crítico corre de um lado para o outro
        const rapidez = nivel === "critical" ? 140 : nivel === "ok" ? 38 : 70;
        vx = (Math.random() < 0.5 ? -1 : 1) * rapidez;
      }
      x += vx * dt;
      if (x <= min || x >= max) {
        x = Math.max(min, Math.min(max, x));
        vx = -vx;
      }
      if (Math.random() < dt * (nivel === "critical" ? 0.15 : 0.4)) {   // de vez em quando para e olha
        vx = 0;
        paradoAte = agora + 1500 + Math.random() * 3500;
      }
    } else if (!andar) {
      vx = 0;
    }
    x = Math.max(min, Math.min(max, x));

    raiz.classList.toggle("andando", vx !== 0);
    raiz.classList.toggle("virado", vx < 0);
    raiz.classList.toggle("balao-esquerda", x > window.innerWidth / 2);
    raiz.style.transform = `translate3d(${x}px, 0, 0)`;
    window.requestAnimationFrame(quadro);
  }

  function iniciar() {
    document.body.append(raiz, reabrir);
    aplicarOculto(lerOculto());
    expressao("feliz");
    atualizarRotulo();
    x = limites()[1] * 0.75;
    window.requestAnimationFrame(quadro);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();

  window.NocPet = { update, erro };
})();

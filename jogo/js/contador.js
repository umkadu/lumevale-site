'use strict';
/* Lumevale — quantas pessoas jogam (contador anônimo) e o botão "Dar opinião".
   Contador: GoatCounter (painel em https://lumevalle.goatcounter.com), sem cookies e sem nada que identifique o jogador.
   Vai só o caminho (ex.: /jogo/apk), o tamanho da tela e marcos do jogo, cada marco uma vez por aparelho.
   Conta no site lumevale.com.br (navegador e app instalado), no APK e no .exe; nunca no teste local, no Claude ou no Switch.
   Para não contar os próprios aparelhos: abra o jogo ou o site uma vez com ?contar=nao no fim do endereço (?contar=sim volta).
   Para testar sem enviar nada: ?contador=ver mostra no console o que seria contado.
   Opinião: formulário do Google Forms; o campo "Dados do jogo" já vai preenchido com a versão e o progresso (sem o nome). */
(function () {
  const LV = (window.LV = window.LV || {});
  const CONTADOR = 'https://lumevalle.goatcounter.com/count';
  const FORMULARIO = 'https://docs.google.com/forms/d/e/1FAIpQLSf4dKG15ZYDG9Jrfw0ZBUsBjau6rYaN0a3N0lTRIRdCPUqJHw/viewform';
  const CAMPO_DADOS = 'entry.1140304957';
  const CHAVE = 'lumevale.contador';        // primeiro dia neste aparelho, marcos já contados e se já lembrou da opinião
  const SEM_CONTAR = 'lumevale.semcontar';

  let reg = {};
  try { reg = JSON.parse(localStorage.getItem(CHAVE) || '{}') || {}; } catch (e) { reg = {}; }
  if (!reg.marcos || typeof reg.marcos !== 'object') reg.marcos = {};
  const gravar = () => { try { localStorage.setItem(CHAVE, JSON.stringify(reg)); } catch (e) { /* sem armazenamento */ } };
  const versao = () => (LV.ui && (LV.ui.VERSAO_TXT || LV.ui.VERSAO)) || '?';

  /* ---------- onde o jogo está rodando ---------- */
  function onde() {
    const p = window.LV_PLATAFORMA;
    if (p === 'android') return 'apk';
    if (p === 'switch') return 'switch';
    if (/\bElectron\//.test(navigator.userAgent)) return 'windows';
    const app = (window.matchMedia && (matchMedia('(display-mode: fullscreen)').matches || matchMedia('(display-mode: standalone)').matches)) || navigator.standalone === true;
    return app ? 'app' : 'navegador';
  }
  const NOMES = { apk: 'APK Android', switch: 'Switch', windows: 'Windows (.exe)', app: 'app instalado pelo site', navegador: 'navegador' };

  // ?contar=nao / ?contar=sim: liga e desliga a contagem neste aparelho
  try {
    const c = /[?&]contar=(nao|sim)\b/.exec(location.search);
    if (c) { if (c[1] === 'nao') localStorage.setItem(SEM_CONTAR, '1'); else localStorage.removeItem(SEM_CONTAR); }
  } catch (e) { /* sem armazenamento */ }
  const MODO = (function () {
    if (/[?&]contador=ver\b/.test(location.search)) return 'ver';
    try { if (localStorage.getItem(SEM_CONTAR)) return null; } catch (e) { /* segue */ }
    const o = onde();
    if (o === 'apk' || o === 'windows') return 'enviar';
    return /(^|\.)lumevale\.com\.br$/.test(location.hostname) ? 'enviar' : null;
  })();

  function enviar(caminho, titulo, evento) {
    if (!MODO) return;
    const s = window.screen || {};
    const url = CONTADOR + '?p=' + encodeURIComponent(caminho) + '&t=' + encodeURIComponent(titulo || caminho) + (evento ? '&e=true' : '') +
      '&s=' + encodeURIComponent([s.width || 0, s.height || 0, window.devicePixelRatio || 1].join(',')) + '&rnd=' + Math.random().toString(36).slice(2, 8);
    if (MODO === 'ver') { (LV.contadorVisto = LV.contadorVisto || []).push({ caminho, titulo, evento: !!evento }); console.log('[contador]', caminho, '·', titulo); return; }
    try { if (navigator.sendBeacon && navigator.sendBeacon(url)) return; } catch (e) { /* tenta pela imagem */ }
    try { new Image().src = url; } catch (e) { /* fica sem contar */ }
  }
  // marco: conta uma vez por aparelho (sem internet, espera a próxima conferida)
  function marco(id, titulo) {
    if (!MODO || reg.marcos[id] || navigator.onLine === false) return;
    reg.marcos[id] = Date.now();
    gravar();
    enviar(id, titulo, true);
  }

  /* ---------- abriu o jogo / voltou outro dia ---------- */
  const dia = (t) => { const d = new Date(t); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
  function voltou() {
    if (!reg.primeiro) { reg.primeiro = Date.now(); gravar(); return; }
    if (dia(reg.primeiro) !== dia(Date.now())) marco('voltou-outro-dia', 'Voltou a jogar em outro dia');
    if (Date.now() - reg.primeiro >= 7 * 864e5) marco('voltou-7-dias', 'Ainda jogando uma semana depois');
  }

  /* ---------- marcos do jogo (conferidos de tempos em tempos) ---------- */
  function conferir() {
    const game = LV.game, S = game && game.S;
    if (!game || !game.slot || !S || !S.inicial) return;
    const m = S.meta || {};
    marco('tutorial', 'Terminou o tutorial');
    const nivel = Math.max(m.recorde || 1, (S.dom && S.dom.nivel) || 1);
    [5, 10, 20, 30, 50, 75, 100].forEach((n) => { if (nivel >= n) marco('nivel-' + n, 'Chegou ao nível ' + n); });
    const guardioes = (S.mapas || []).filter((x) => x && x.chefe).length;
    for (let i = 1; i <= guardioes; i++) marco('guardiao-' + i, i === 1 ? 'Venceu o primeiro Guardião' : 'Venceu ' + i + ' Guardiões');
    if (m.renasc > 0) marco('renasceu', 'Renasceu pela primeira vez');
    if (m.finalVisto) marco('final', 'Viu o final');
    const t = (S.st && S.st.tempo) || 0;   // segundos de jogo nesta jornada
    [[1800, '30min'], [3600, '1h'], [3 * 3600, '3h'], [10 * 3600, '10h']].forEach(([seg, k]) => { if (t >= seg) marco('tempo-' + k, k + ' de jogo numa jornada'); });
    // um lembrete só, depois de 20 minutos de jogo
    const ui = LV.ui;
    if (LV.darOpiniao && !reg.lembrou && t >= 1200 && ui && ui.toast && !ui.modalAberto && !(ui.afk && ui.afk.ativo) && !game.pausado) {
      reg.lembrou = Date.now();
      gravar();
      ui.toast(LV.t('Gostando do Lumevale? Conte o que achou em Configurações › Dar opinião.'));
    }
  }

  /* ---------- Dar opinião ---------- */
  function sistema() {
    const ua = navigator.userAgent || '';
    let m, so = '?', nav = '';
    if ((m = ua.match(/Android ([\d.]+)/))) so = 'Android ' + m[1];
    else if ((m = ua.match(/(iPhone|iPad|iPod).*? OS ([\d_]+)/))) so = m[1] + ' iOS ' + m[2].replace(/_/g, '.');
    else if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) so = 'iPad';
    else if (/Windows/.test(ua)) so = 'Windows';
    else if (/Mac OS X/.test(ua)) so = 'Mac';
    else if (/CrOS/.test(ua)) so = 'ChromeOS';
    else if (/Linux/.test(ua)) so = 'Linux';
    if ((m = ua.match(/Electron\/(\d+)/))) nav = 'Electron ' + m[1];
    else if ((m = ua.match(/SamsungBrowser\/(\d+)/))) nav = 'Samsung Internet ' + m[1];
    else if ((m = ua.match(/Edg[A-Z]*\/(\d+)/))) nav = 'Edge ' + m[1];
    else if ((m = ua.match(/(?:Firefox|FxiOS)\/(\d+)/))) nav = 'Firefox ' + m[1];
    else if ((m = ua.match(/(?:Chrome|CriOS)\/(\d+)/))) nav = (/; wv\)/.test(ua) ? 'WebView ' : 'Chrome ') + m[1];
    else if ((m = ua.match(/Version\/(\d+).*Safari/))) nav = 'Safari ' + m[1];
    return so + (nav ? ' · ' + nav : '');
  }
  function dadosDoJogo() {
    const game = LV.game || {}, S = game.S;
    const p = ['v' + versao(), NOMES[onde()], sistema(), 'janela ' + window.innerWidth + 'x' + window.innerHeight, String(LV.idioma || 'pt').toUpperCase()];
    if (game.slot && S && S.inicial) {
      const m = S.meta || {}, t = (S.st && S.st.tempo) || 0;
      p.push('nível ' + Math.max(m.recorde || 1, (S.dom && S.dom.nivel) || 1),
        (S.mapas || []).filter((x) => x && x.chefe).length + ' de ' + (LV.MAPS || []).length + ' Guardiões',
        'mapa ' + ((S.mapa || 0) + 1), (S.pets || []).length + ' Centelhas',
        (LV.fmtTempo ? LV.fmtTempo(t) : Math.round(t / 60) + 'min') + ' nesta jornada', (m.renasc || 0) + ' renascimentos');
    } else if (LV.slots && LV.slots.resumo) {
      const r = [1, 2, 3].map((n) => LV.slots.resumo(n)).filter(Boolean);
      p.push(r.length ? 'saves: ' + r.map((x) => 'nível ' + x.nivel).join(', ') : 'sem save');
    }
    return p.join(' · ');
  }
  // no Switch não há navegador para abrir o formulário
  LV.darOpiniao = onde() === 'switch' ? null : function () {
    const url = FORMULARIO + '?usp=pp_url&' + CAMPO_DADOS + '=' + encodeURIComponent(dadosDoJogo());
    enviar('opiniao', 'Abriu o formulário de opinião', true);
    if (onde() === 'apk') { location.href = url; return; }    // o APK passa o link para o navegador do celular (MainActivity)
    window.open(url, '_blank', 'noopener');                   // no .exe, main.js abre no navegador padrão
  };
  LV.dadosDoJogo = dadosDoJogo;

  /* ---------- início ---------- */
  const o = onde();
  enviar('/jogo/' + o, 'Jogo · ' + NOMES[o] + ' · v' + versao());
  voltou();
  setTimeout(conferir, 5000);
  setInterval(conferir, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { voltou(); conferir(); } });
})();

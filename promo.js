/* =============================================================
   Doovlab — promo.js · BLACK FRIDAY 2026
   −50 % sur tous les médaillons, le vendredi 27 novembre 2026
   UNIQUEMENT, de 00h00 à 23h59 (heure de Paris).
   La promo s'allume et s'éteint TOUTE SEULE : rien à faire à minuit.

   ⚠️ Les dates et le pourcentage doivent rester IDENTIQUES à ceux
      de api/checkout.js : c'est le serveur qui fixe le prix
      réellement payé sur Stripe. Ce fichier ne gère que l'affichage.

   APERÇU AVANT LE JOUR J (impossible sur doovlab.fr / doovlab.com) :
   sur le lien d'aperçu Vercel, ajoute  ?bf=1  à la fin de l'adresse.
   L'aperçu reste actif de page en page ; ?bf=0 pour l'enlever.
   ============================================================= */
(function () {
  'use strict';

  var START   = Date.parse('2026-11-26T23:00:00Z'); // = vendredi 27/11 00h00 (Paris)
  var END     = Date.parse('2026-11-27T23:00:00Z'); // = samedi 28/11 00h00 (Paris), exclu
  var PERCENT = 50;
  var BASE    = { classique: 14, personnalise: 18, nfc: 25 }; // = CATALOG de api/checkout.js
  var PROD_HOSTS = ['doovlab.fr', 'www.doovlab.fr', 'doovlab.com', 'www.doovlab.com'];

  /* ---------- Logique de prix (utilisée aussi par panier.html et merci.html) ---------- */

  function isProdHost() { return PROD_HOSTS.indexOf(location.hostname) !== -1; }

  // Mode aperçu : seulement hors du vrai site (lien Vercel), jamais en production
  function preview() {
    if (isProdHost()) return false;
    try {
      var q = new URLSearchParams(location.search).get('bf');
      if (q === '1') sessionStorage.setItem('doovlab_bf_preview', '1');
      if (q === '0') sessionStorage.removeItem('doovlab_bf_preview');
      return sessionStorage.getItem('doovlab_bf_preview') === '1';
    } catch (e) { return false; }
  }

  function inWindow() { var now = Date.now(); return now >= START && now < END; }
  function active() { return inWindow() || preview(); }
  function known(id) { return Object.prototype.hasOwnProperty.call(BASE, id); }

  // Prix normal d'un article (ou le prix stocké s'il est inconnu du catalogue)
  function base(id, fallback) { return known(id) ? BASE[id] : fallback; }

  // Prix à payer maintenant (−50 % pendant le Black Friday)
  function unit(id, fallback) {
    var b = base(id, fallback);
    if (!known(id) || !active()) return b;
    return Math.round(b * (100 - PERCENT)) / 100;
  }

  // 14 → "14€" · 12.5 → "12,50€" (même écriture que le reste du site)
  function short(n) { return (n % 1 === 0 ? String(n) : n.toFixed(2).replace('.', ',')) + '€'; }

  window.DoovlabPromo = {
    START: START, END: END, PERCENT: PERCENT, BASE: BASE,
    active: active, preview: preview, base: base, unit: unit, short: short
  };

  /* ---------- Affichage : bandeau + prix barrés ---------- */

  var CSS =
    '#bf-banner{position:fixed;top:0;left:0;right:0;z-index:3000;display:flex;align-items:center;justify-content:center;' +
    'flex-wrap:wrap;gap:4px 10px;padding:9px 14px;background:#0B0B0B;color:#fff;text-decoration:none;' +
    "font-family:'Nunito',sans-serif;font-weight:700;font-size:14px;line-height:1.25;letter-spacing:.2px;" +
    'border-bottom:2px solid #E0182D;box-shadow:0 2px 12px rgba(0,0,0,.28)}' +
    '#bf-banner .bf-tag{background:#E0182D;color:#fff;text-transform:uppercase;letter-spacing:1.6px;font-weight:800;' +
    'font-size:12px;padding:4px 9px;border-radius:4px}' +
    '#bf-banner .bf-sub{color:#FFB3B8;font-weight:600}' +
    '#bf-banner .bf-end b{color:#FF5566;font-variant-numeric:tabular-nums}' +
    '@media (max-width:640px){#bf-banner{font-size:12.5px;gap:3px 7px;padding:7px 10px}' +
    '#bf-banner .bf-tag{font-size:10.5px;padding:3px 7px}#bf-banner .bf-sub{display:none}}' +
    '.bf-old{text-decoration:line-through !important;opacity:.55 !important;font-weight:400 !important;' +
    'font-size:.58em !important;margin-right:7px !important;vertical-align:middle;color:inherit !important}' +
    '.item-price .bf-old{font-size:.8em !important;display:block;text-align:right;margin:0 0 2px !important}' +
    '.bf-badge{display:inline-block;margin-left:8px !important;background:#E0182D !important;color:#fff !important;' +
    "font-family:'Nunito',sans-serif !important;font-size:12px !important;font-weight:800 !important;letter-spacing:.4px;" +
    'padding:3px 8px !important;border-radius:50px;vertical-align:middle;white-space:nowrap}' +
    '.bf-now{color:#E0182D !important}' +
    '.bf-strike{text-decoration:line-through;opacity:.7;font-weight:400;margin-left:4px}';

  var changed = [];   // éléments modifiés, pour tout remettre comme avant à minuit
  var bodyPad = null; // marge haute d'origine du <body>
  var timer = null;

  function injectCss() {
    if (document.getElementById('bf-style')) return;
    var s = document.createElement('style');
    s.id = 'bf-style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // Remplace la 1re occurrence du prix normal (ex. "18€" ou "25 €") par le nouveau HTML
  function swapPrice(html, b, replacement) {
    var re = new RegExp('(^|[^0-9,])' + String(b) + '\\s?€');
    if (!re.test(html)) return null;
    return html.replace(re, function (m, before) { return before + replacement; });
  }

  function decorate() {
    var els = document.querySelectorAll('[data-promo]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var id = el.getAttribute('data-promo');
      if (!known(id)) continue;
      var kind = el.getAttribute('data-promo-kind') || 'price';
      if (el.__bfOrig == null) { el.__bfOrig = el.innerHTML; changed.push(el); }
      var orig = el.__bfOrig, b = BASE[id], u = unit(id), out = null;

      if (kind === 'price') {
        out = swapPrice(orig, b, '<span class="bf-old">' + short(b) + '</span>' + short(u));
        if (out != null) out += '<span class="bf-badge">−' + PERCENT + ' %</span>';
      } else if (kind === 'button') {
        out = swapPrice(orig, b, short(u) + ' <span class="bf-strike">' + short(b) + '</span>');
        if (out == null) out = orig + ' — ' + short(u) + ' <span class="bf-strike">' + short(b) + '</span>';
      } else if (kind === 'note') {
        out = swapPrice(orig, b, '<b class="bf-now">' + short(u) + ' aujourd’hui</b> <span class="bf-strike">' + short(b) + '</span>');
      }
      if (out != null) el.innerHTML = out;
    }
  }

  function showBanner() {
    if (document.getElementById('bf-banner')) return;
    if (/merci\.html/.test(location.pathname)) return; // le client vient de payer : pas de bandeau
    var a = document.createElement('a');
    a.id = 'bf-banner';
    a.href = '/boutique.html';
    a.innerHTML =
      '<span class="bf-tag">Black Friday</span>' +
      '<span class="bf-main">−' + PERCENT + ' % sur tous les médaillons</span>' +
      '<span class="bf-sub">· aujourd’hui seulement ·</span>' +
      '<span class="bf-end">fin dans <b id="bf-clock">--:--:--</b></span>';
    document.body.insertBefore(a, document.body.firstChild);
    placeBanner();
    window.addEventListener('resize', placeBanner);
  }

  // Décale la barre de navigation (fixe) et la page sous le bandeau
  function placeBanner() {
    var bn = document.getElementById('bf-banner');
    if (!bn) return;
    if (bodyPad == null) bodyPad = parseFloat(getComputedStyle(document.body).paddingTop) || 0;
    var h = bn.offsetHeight;
    var nav = document.querySelector('nav');
    if (nav) nav.style.top = h + 'px';
    document.body.style.paddingTop = (bodyPad + h) + 'px';
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function tick() {
    var left = END - Date.now();
    if (left <= 0) { if (!preview()) { stop(); return; } left = 0; }
    var s = Math.floor(left / 1000);
    var clock = document.getElementById('bf-clock');
    if (clock) clock.textContent = pad2(Math.floor(s / 3600)) + ':' + pad2(Math.floor(s % 3600 / 60)) + ':' + pad2(s % 60);
  }

  // Minuit : on retire tout et on remet les prix normaux, sans recharger la page
  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
    var bn = document.getElementById('bf-banner');
    if (bn) bn.parentNode.removeChild(bn);
    window.removeEventListener('resize', placeBanner);
    var nav = document.querySelector('nav');
    if (nav) nav.style.top = '';
    if (bodyPad != null) document.body.style.paddingTop = '';
    for (var i = 0; i < changed.length; i++) { changed[i].innerHTML = changed[i].__bfOrig; changed[i].__bfOrig = null; }
    changed = [];
    if (typeof window.render === 'function' && /panier/.test(location.pathname)) window.render();
  }

  function start() {
    if (!active()) {
      // Page ouverte juste avant minuit le jeudi : on bascule toute seule à l'heure pile
      var wait = START - Date.now();
      if (wait > 0 && wait < 6 * 3600 * 1000) setTimeout(function () {
        start();
        if (typeof window.render === 'function' && /panier/.test(location.pathname)) window.render();
      }, wait + 500);
      return;
    }
    injectCss();
    decorate();
    showBanner();
    tick();
    timer = setInterval(tick, 1000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();

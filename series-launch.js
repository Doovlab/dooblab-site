/* ============================================================
   Doovlab — series-launch.js
   - Bandeau compteur "série de lancement · X/100"
   - Remplit le bloc d'accueil #series-block s'il existe
   - Rafraîchissement auto toutes les 30 s (et au retour d'onglet)
   - Quand la série est ÉPUISÉE : redirige vers la liste d'attente
   - Se masque proprement si l'API ne répond pas
   ============================================================ */
(function () {
  var LIMIT = 100;
  var banner = null;
  var prev = null;

  function isWaitPage() {
    return location.pathname.indexOf('liste-attente') !== -1;
  }

  function buildBanner() {
    if (banner) return;
    banner = document.createElement('div');
    banner.id = 'series-banner';
    banner.style.cssText =
      'position:fixed;top:0;left:0;right:0;min-height:34px;line-height:1.3;padding:7px 14px;' +
      'background:#A84E1A;color:#FDF6EE;text-align:center;z-index:3000;' +
      "font-family:'Nunito',sans-serif;font-weight:700;font-size:13px;letter-spacing:.4px;" +
      'box-shadow:0 2px 8px rgba(0,0,0,.15);';
    document.body.appendChild(banner);
    var nav = document.querySelector('nav');
    if (nav) nav.style.top = banner.offsetHeight + 'px';
    document.body.style.paddingTop = banner.offsetHeight + 'px';
  }

  function pulse(el) {
    if (!el) return;
    el.style.transition = 'none';
    el.style.color = '#FFD9A8';
    el.style.transform = 'scale(1.15)';
    el.style.display = 'inline-block';
    setTimeout(function () {
      el.style.transition = 'color .6s, transform .6s';
      el.style.color = '';
      el.style.transform = 'scale(1)';
    }, 60);
  }

  function render(sold, remaining) {
    var soldOut = remaining <= 0;
    window.__seriesRemaining = remaining;
    window.__seriesSoldOut = soldOut;

    if (soldOut && !isWaitPage()) {
      location.replace('/liste-attente.html');
      return;
    }

    buildBanner();
    banner.innerHTML = '\u{1F525} Série de lancement \u00b7 plus que <b id="series-banner-n">' + remaining + '</b>/' + LIMIT + ' exemplaires numérotés';

    var block = document.getElementById('series-block');
    if (block) {
      block.style.display = 'block';
      var c = document.getElementById('series-count');
      var bar = document.getElementById('series-bar');
      var pct = Math.min(100, Math.round((sold / LIMIT) * 100));
      if (c) c.textContent = sold + ' / ' + LIMIT + ' déjà adoptés';
      if (bar) bar.style.width = pct + '%';
    }

    if (prev !== null && remaining < prev) {
      pulse(document.getElementById('series-banner-n'));
    }
    prev = remaining;
  }

  function load() {
    fetch('/api/stock', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && typeof d.remaining === 'number') render(d.sold, d.remaining);
      })
      .catch(function () {});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }
  setInterval(load, 30000);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) load();
  });
})();

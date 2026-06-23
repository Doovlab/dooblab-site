/* ============================================================
   Doovlab — series-launch.js
   Affiche le compteur de la série de lancement :
   - un bandeau fin en haut de page (sur les pages où ce script est inclus)
   - remplit le bloc d'accueil #series-block s'il existe
   - se rafraîchit tout seul toutes les 30 s (et au retour sur l'onglet)
   - se masque proprement si l'API ne répond pas
   ============================================================ */
(function () {
  var LIMIT = 100;
  var banner = null;
  var prev = null;

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
    // on décale la barre de navigation et le contenu pour faire de la place
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

    buildBanner();
    if (soldOut) {
      banner.innerHTML = '\u2728 Série de lancement épuisée — un immense merci \u{1F43E}';
    } else {
      banner.innerHTML = '\u{1F525} Série de lancement \u00b7 plus que <b id="series-banner-n">' + remaining + '</b>/' + LIMIT + ' exemplaires numérotés';
    }

    // Bloc d'accueil (facultatif)
    var block = document.getElementById('series-block');
    if (block) {
      block.style.display = 'block';
      var c = document.getElementById('series-count');
      var bar = document.getElementById('series-bar');
      var sub = document.getElementById('series-sub');
      var pct = Math.min(100, Math.round((sold / LIMIT) * 100));
      if (c) c.textContent = soldOut ? 'Série épuisée' : (sold + ' / ' + LIMIT + ' déjà adoptés');
      if (bar) bar.style.width = pct + '%';
      if (sub && soldOut) sub.textContent = 'Merci à toutes celles et ceux qui ont adopté un médaillon de la première heure.';
    }

    // Si épuisé : on désactive les boutons d'achat marqués data-buy
    if (soldOut) {
      var btns = document.querySelectorAll('[data-buy]');
      for (var i = 0; i < btns.length; i++) {
        btns[i].setAttribute('disabled', 'disabled');
        btns[i].style.opacity = '.5';
        btns[i].style.cursor = 'not-allowed';
        if (btns[i].tagName === 'A') btns[i].removeAttribute('href');
      }
    }

    // petite animation quand le nombre baisse
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
      .catch(function () {/* silencieux : pas de bandeau si l'API ne répond pas */});
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

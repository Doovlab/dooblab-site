/* ==========================================================================
   Doovlab — Pixel Meta  (ID 2364024667737857)
   Fichier à déposer à la RACINE du dépôt (à côté de index.html).
   À inclure sur chaque page avec :   <script src="/pixel.js"></script>
   Rien à modifier dans ce fichier.
   ========================================================================== */

(function () {
  var PIXEL_ID = '2364024667737857';

  /* --- Code officiel Meta (ne pas modifier) --- */
  !function (f, b, e, v, n, t, s) {
    if (f.fbq) return; n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
    t = b.createElement(e); t.async = !0; t.src = v;
    s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
  }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

  fbq('init', PIXEL_ID);
  fbq('track', 'PageView');

  /* ------------------------------------------------------------------
     Helper d'achat, appelé depuis merci.html.
     Protégé contre le double comptage : si le client recharge la page
     de remerciement ou revient dessus, l'événement n'est envoyé qu'une
     seule fois par commande.
     ------------------------------------------------------------------ */
  window.doovlabTrackPurchase = function (opts) {
    opts = opts || {};

    var value = Number(opts.value);
    if (!isFinite(value) || value <= 0) {
      console.warn('[Doovlab] Purchase ignoré : montant invalide', opts.value);
      return false;
    }

    var orderId = String(opts.orderId || '').trim();
    var key = 'doovlab_px_purchase';

    var done = [];
    try { done = JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { done = []; }
    if (!Array.isArray(done)) done = [];

    if (orderId && done.indexOf(orderId) !== -1) {
      console.log('[Doovlab] Purchase déjà envoyé pour', orderId, '— ignoré.');
      return false;
    }
    if (!orderId && sessionStorage.getItem(key + '_session')) {
      console.log('[Doovlab] Purchase déjà envoyé dans cet onglet — ignoré.');
      return false;
    }

    var payload = {
      value: Math.round(value * 100) / 100,
      currency: opts.currency || 'EUR'
    };
    if (opts.contentIds && opts.contentIds.length) {
      payload.content_ids = opts.contentIds;
      payload.content_type = 'product';
    }
    if (opts.numItems) payload.num_items = opts.numItems;

    /* eventID = clé de déduplication si l'API Conversions est branchée plus tard. */
    fbq('track', 'Purchase', payload, orderId ? { eventID: orderId } : undefined);

    if (orderId) {
      done.push(orderId);
      if (done.length > 50) done = done.slice(-50);
      try { localStorage.setItem(key, JSON.stringify(done)); } catch (e) {}
    } else {
      try { sessionStorage.setItem(key + '_session', '1'); } catch (e) {}
    }

    console.log('[Doovlab] Purchase envoyé', payload);
    return true;
  };
})();

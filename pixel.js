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

  /* ==================================================================
     Suivi du parcours d'achat — ajouté le 19/09/2026
     Trois repères entre l'arrivée sur le site et le paiement :
       ViewContent      vue d'une page produit
       AddToCart        ajout au panier réussi
       InitiateCheckout clic sur « Payer »
     Tout est piloté depuis ce fichier : aucune page HTML à modifier.
     ================================================================== */

  var PRODUITS = {
    'commander-nfc':           { id: 'nfc',          name: 'Médaillon Patte — NFC Connecté', price: 25 },
    'commander-personnalise':  { id: 'personnalise', name: 'Médaillon Patte — Personnalisé', price: 18 },
    'commander-classique':     { id: 'classique',    name: 'Médaillon Patte — Classique',    price: 14 }
  };
  var CART_KEY = 'doovlab_cart_v1';
  var ATTENTE  = 'doovlab_px_atc';

  function lirePanier() {
    try {
      var c = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
      return Array.isArray(c) ? c : [];
    } catch (e) { return []; }
  }

  function totalPanier(cart) {
    var t = 0;
    for (var i = 0; i < cart.length; i++) {
      var p = Number(cart[i].price), q = Number(cart[i].qty) || 1;
      if (isFinite(p)) t += p * q;
    }
    return Math.round(t * 100) / 100;
  }

  function produitDeLaPage() {
    var f = (location.pathname.split('/').pop() || '').replace(/\.html$/, '');
    return PRODUITS[f] || null;
  }

  /* --- 1. Vue d'une page produit ------------------------------------ */
  var prod = produitDeLaPage();
  if (prod) {
    fbq('track', 'ViewContent', {
      content_ids: [prod.id],
      content_name: prod.name,
      content_type: 'product',
      value: prod.price,
      currency: 'EUR'
    });
    console.log('[Doovlab] ViewContent envoyé', prod.id);
  }

  /* --- 2. Ajout au panier -------------------------------------------
     Le bouton porte déjà un onclick="addToCart()" défini dans la page.
     On compte les articles juste avant le clic (phase de capture), puis
     juste après (phase de remontée) : si le panier a grandi, l'ajout a
     réussi. Un formulaire incomplet ne déclenche donc rien.
     ------------------------------------------------------------------ */
  var avantClic = null;

  function estBoutonAjout(el) {
    return el && el.closest && el.closest('#submitBtn, #submit-btn, .btn-submit, .submit-btn');
  }

  document.addEventListener('click', function (ev) {
    if (estBoutonAjout(ev.target)) avantClic = lirePanier().length;
  }, true);

  document.addEventListener('click', function (ev) {
    if (avantClic === null || !estBoutonAjout(ev.target)) return;
    var depart = avantClic;
    avantClic = null;
    var cart = lirePanier();
    if (cart.length <= depart) return;            /* rien ajouté : on ignore */
    var item = cart[cart.length - 1] || {};
    var qte = Number(item.qty) || 1;
    var prix = Number(item.price);
    var payload = {
      content_ids: [item.id || (prod && prod.id) || 'inconnu'],
      content_name: item.name || (prod && prod.name) || '',
      content_type: 'product',
      num_items: qte,
      currency: 'EUR'
    };
    if (isFinite(prix)) payload.value = Math.round(prix * qte * 100) / 100;
    /* La page part aussitôt vers panier.html : un événement envoyé ici
       serait coupé par la navigation. On le met donc en attente et il
       part au chargement de la page suivante, une seule fois. */
    try { sessionStorage.setItem(ATTENTE, JSON.stringify(payload)); } catch (e) {}
  }, false);

  /* Envoi de l'ajout au panier mis en attente par la page précédente. */
  (function () {
    var brut = null;
    try { brut = sessionStorage.getItem(ATTENTE); } catch (e) {}
    if (!brut) return;
    try { sessionStorage.removeItem(ATTENTE); } catch (e) {}
    var payload;
    try { payload = JSON.parse(brut); } catch (e) { return; }
    if (!payload) return;
    fbq('track', 'AddToCart', payload);
    console.log('[Doovlab] AddToCart envoyé', payload);
  })();

  /* --- 3. Début de paiement ------------------------------------------
     Sur panier.html, le bouton « Payer » porte l'id pay-btn.
     Le montant envoyé est celui des produits, hors frais de port —
     même convention que l'événement Purchase.
     ------------------------------------------------------------------ */
  document.addEventListener('click', function (ev) {
    var btn = ev.target && ev.target.closest && ev.target.closest('#pay-btn');
    if (!btn || btn.disabled) return;
    var cart = lirePanier();
    if (!cart.length) return;
    var ids = [], n = 0;
    for (var i = 0; i < cart.length; i++) {
      ids.push(cart[i].id || 'inconnu');
      n += Number(cart[i].qty) || 1;
    }
    var payload = {
      content_ids: ids,
      content_type: 'product',
      num_items: n,
      value: totalPanier(cart),
      currency: 'EUR'
    };
    fbq('track', 'InitiateCheckout', payload);
    console.log('[Doovlab] InitiateCheckout envoyé', payload);
  }, false);

})();

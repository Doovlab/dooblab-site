// =============================================================
//  Doovlab — api/checkout.js
//  Fonction serverless Vercel : crée une page de paiement
//  Stripe Checkout sur-mesure à partir du panier du client.
//
//  La clé secrète Stripe N'EST PAS dans ce fichier.
//  Elle est lue depuis la variable d'environnement Vercel
//  STRIPE_SECRET_KEY (à configurer une seule fois dans Vercel).
// =============================================================

// --- Catalogue officiel : prix fixés ICI, côté serveur (en centimes) ---
//     Le navigateur n'envoie que l'identifiant + la quantité ;
//     les montants ne viennent jamais du client (sécurité).
const CATALOG = {
  classique:    { name: 'Médaillon Patte — Classique',    amount: 1400 }, // 14,00 €
  personnalise: { name: 'Médaillon Patte — Personnalisé', amount: 1800 }, // 18,00 €
  nfc:          { name: 'Médaillon Patte — NFC Connecté', amount: 2500 }, // 25,00 €
};

// --- Réglages livraison ---------------------------------------
const SHIPPING_FEE_CENTS      = 490;   // 4,90 € sous le seuil  ← AJUSTE ce montant après avoir pesé un colis
const FREE_SHIPPING_THRESHOLD = 5000;  // 50,00 € : port offert au-dessus (ne pas changer, c'est ton offre)

// --- Série de lancement limitée -------------------------------
const LAUNCH_LIMIT = 100;   // nombre total de médaillons de la série de lancement

// --- Ton domaine (sert aux pages de retour) -------------------
const SITE = 'https://doovlab.fr';

// Compte combien de médaillons de la "série de lancement" ont déjà été PAYÉS.
// Source de vérité = Stripe (on additionne metadata.units des sessions terminées).
async function countLaunchSold(key) {
  let sold = 0, startingAfter = null, pages = 0;
  do {
    let url = 'https://api.stripe.com/v1/checkout/sessions?status=complete&limit=100';
    if (startingAfter) url += '&starting_after=' + startingAfter;
    const r = await fetch(url, { headers: { 'Authorization': 'Bearer ' + key } });
    const d = await r.json();
    if (!r.ok) throw new Error('Stripe list error');
    const arr = d.data || [];
    for (const s of arr) {
      if (s.metadata && s.metadata.series === 'launch') {
        sold += parseInt(s.metadata.units, 10) || 0;
      }
    }
    startingAfter = (d.has_more && arr.length) ? arr[arr.length - 1].id : null;
    pages++;
  } while (startingAfter && pages < 10);
  return sold;
}

module.exports = async function handler(req, res) {
  // On n'accepte que les requêtes POST
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Méthode non autorisée' });
    return;
  }

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    res.status(500).json({ error: "Clé Stripe absente : configure STRIPE_SECRET_KEY dans Vercel." });
    return;
  }

  try {
    // Récupère le panier envoyé par le site
    const body  = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const items = Array.isArray(body.items) ? body.items : [];
    if (!items.length) {
      res.status(400).json({ error: 'Panier vide' });
      return;
    }

    // Construit les paramètres pour Stripe
    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('locale', 'fr');
    params.append('success_url', SITE + '/merci.html?session_id={CHECKOUT_SESSION_ID}');
    params.append('cancel_url',  SITE + '/panier.html');
    // On collecte l'adresse de livraison (France) et le téléphone
    params.append('shipping_address_collection[allowed_countries][0]', 'FR');
    params.append('phone_number_collection[enabled]', 'true');

    // Lignes du panier (prix recalculés côté serveur)
    let subtotal = 0;
    let n = 0;
    let totalUnits = 0;
    items.forEach((it) => {
      const prod = CATALOG[it && it.id];
      if (!prod) return; // identifiant inconnu → ignoré
      const qty = Math.max(1, Math.min(20, parseInt(it.qty, 10) || 1));
      subtotal += prod.amount * qty;
      totalUnits += qty;

      // Détail des options (couleurs, nom du chien…) affiché sur le reçu
      const desc = (it.options || '').toString().slice(0, 250);

      params.append(`line_items[${n}][price_data][currency]`, 'eur');
      params.append(`line_items[${n}][price_data][product_data][name]`, prod.name);
      if (desc) params.append(`line_items[${n}][price_data][product_data][description]`, desc);
      params.append(`line_items[${n}][price_data][unit_amount]`, String(prod.amount));
      params.append(`line_items[${n}][quantity]`, String(qty));
      n++;
    });

    if (n === 0) {
      res.status(400).json({ error: 'Aucun article valide dans le panier' });
      return;
    }

    // ===== VERROU SÉRIE DE LANCEMENT (100 exemplaires) ==========
    // On compte ce qui est déjà vendu AVANT de créer la page de paiement.
    // Si la série est épuisée (ou si la commande dépasse le restant),
    // on bloque ICI : le client ne voit jamais la page de paiement,
    // donc aucun risque de paiement à rembourser.
    const sold = await countLaunchSold(key);
    const remaining = LAUNCH_LIMIT - sold;
    if (remaining <= 0) {
      res.status(409).json({
        error: 'SERIES_SOLD_OUT',
        message: 'La série de lancement (100 exemplaires) est épuisée. Merci pour votre engouement \u{1F43E}',
        remaining: 0,
      });
      return;
    }
    if (totalUnits > remaining) {
      res.status(409).json({
        error: 'NOT_ENOUGH_LEFT',
        message: 'Il ne reste que ' + remaining + ' exemplaire(s) de la série de lancement. Réduisez la quantité pour finaliser.',
        remaining: remaining,
      });
      return;
    }

    // On marque cette commande comme faisant partie de la série + les numéros à graver
    params.append('metadata[series]', 'launch');
    params.append('metadata[units]', String(totalUnits));
    params.append('metadata[numeros]', (sold + 1) + (totalUnits > 1 ? ('-' + (sold + totalUnits)) : '') + '/' + LAUNCH_LIMIT);

    // Frais de port : offerts si le seuil est atteint, sinon forfait
    const fee = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE_CENTS;
    params.append('shipping_options[0][shipping_rate_data][type]', 'fixed_amount');
    params.append('shipping_options[0][shipping_rate_data][fixed_amount][amount]', String(fee));
    params.append('shipping_options[0][shipping_rate_data][fixed_amount][currency]', 'eur');
    params.append('shipping_options[0][shipping_rate_data][display_name]', fee === 0 ? 'Livraison offerte' : 'Livraison');

    // Appel à l'API Stripe
    const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + key,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const data = await r.json();
    if (!r.ok) {
      console.error('Erreur Stripe :', data);
      res.status(502).json({ error: (data.error && data.error.message) || 'Erreur Stripe' });
      return;
    }

    // On renvoie l'adresse de la page de paiement
    res.status(200).json({ url: data.url });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

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

// --- Ton domaine (sert aux pages de retour) -------------------
const SITE = 'https://doovlab.fr';

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
    items.forEach((it) => {
      const prod = CATALOG[it && it.id];
      if (!prod) return; // identifiant inconnu → ignoré
      const qty = Math.max(1, Math.min(20, parseInt(it.qty, 10) || 1));
      subtotal += prod.amount * qty;

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

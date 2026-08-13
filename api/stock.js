// =============================================================
//  Doovlab — api/stock.js
//  Renvoie l'état de la série de lancement (vendus / restants)
//  pour afficher le compteur sur le site.
//  Source de vérité = Stripe (sessions payées, metadata.series='launch').
// =============================================================

const LAUNCH_LIMIT = 100;
const FREE_SHIPPING_LAUNCH = 50;  // ⇦ MÊME valeur que dans api/checkout.js
const LAUNCH_START = Math.floor(Date.parse('2026-08-14T22:00:00Z') / 1000); // Ouverture : 15/08/2026 00h00 heure de Paris (UTC+2). Les commandes AVANT (tes tests) ne sont pas comptées.  // ⇦ MÊME valeur que dans api/checkout.js

async function countLaunch(key) {
  let sold = 0, orders = 0, startingAfter = null, pages = 0;
  do {
    let url = 'https://api.stripe.com/v1/checkout/sessions?status=complete&limit=100';
    if (startingAfter) url += '&starting_after=' + startingAfter;
    const r = await fetch(url, { headers: { 'Authorization': 'Bearer ' + key } });
    const d = await r.json();
    if (!r.ok) throw new Error('Stripe list error');
    const arr = d.data || [];
    for (const s of arr) {
      if (s.created >= LAUNCH_START && s.metadata && s.metadata.series === 'launch') {
        sold += parseInt(s.metadata.units, 10) || 0;
        orders++;
      }
    }
    startingAfter = (d.has_more && arr.length) ? arr[arr.length - 1].id : null;
    pages++;
  } while (startingAfter && pages < 10);
  return { units: sold, orders: orders };
}

module.exports = async function handler(req, res) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    res.status(200).json({ sold: null, limit: LAUNCH_LIMIT, remaining: null, freeShip: null });
    return;
  }
  try {
    const launch = await countLaunch(key);
    const sold = launch.units;
    const remaining = Math.max(0, LAUNCH_LIMIT - sold);
    const freeShipRemaining = Math.max(0, FREE_SHIPPING_LAUNCH - launch.orders);
    // Cache CDN : 1 seul appel à Stripe toutes les ~30 s, quel que soit le nombre de visiteurs
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
    res.status(200).json({
      sold: sold,
      limit: LAUNCH_LIMIT,
      remaining: remaining,
      freeShip: {
        active: freeShipRemaining > 0,
        remaining: freeShipRemaining,
        limit: FREE_SHIPPING_LAUNCH
      }
    });
  } catch (e) {
    // En cas de souci, on renvoie null : le compteur se masque proprement côté site
    res.status(200).json({ sold: null, limit: LAUNCH_LIMIT, remaining: null, freeShip: null });
  }
};

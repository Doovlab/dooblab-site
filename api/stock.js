// =============================================================
//  Doovlab — api/stock.js
//  Renvoie l'état de la série de lancement (vendus / restants)
//  pour afficher le compteur sur le site.
//  Source de vérité = Stripe (sessions payées, metadata.series='launch').
// =============================================================

const LAUNCH_LIMIT = 100;

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
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    res.status(200).json({ sold: null, limit: LAUNCH_LIMIT, remaining: null });
    return;
  }
  try {
    const sold = await countLaunchSold(key);
    const remaining = Math.max(0, LAUNCH_LIMIT - sold);
    // Cache CDN : 1 seul appel à Stripe toutes les ~30 s, quel que soit le nombre de visiteurs
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
    res.status(200).json({ sold: sold, limit: LAUNCH_LIMIT, remaining: remaining });
  } catch (e) {
    // En cas de souci, on renvoie null : le compteur se masque proprement côté site
    res.status(200).json({ sold: null, limit: LAUNCH_LIMIT, remaining: null });
  }
};

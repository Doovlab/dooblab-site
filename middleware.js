// =============================================================
//  Doovlab — middleware.js  (PROTECTION TEMPORAIRE PRÉ-LANCEMENT)
//
//  Demande un mot de passe pour accéder au site, le temps qu'il
//  ne soit pas ouvert au public.
//
//  Le mot de passe est lu depuis la variable d'environnement
//  Vercel  SITE_PASSWORD  (à définir dans Vercel → Settings →
//  Environment Variables). À la connexion, mets n'importe quel
//  nom d'utilisateur + ce mot de passe.
//
//  ⚠️ LE JOUR DU LANCEMENT : SUPPRIME CE FICHIER du dépôt
//     (et redéploie) pour rouvrir le site à tout le monde.
// =============================================================

export const config = { matcher: '/:path*' }; // s'applique à tout le site

export default function middleware(request) {
  const auth = request.headers.get('authorization');

  if (auth) {
    const encoded = auth.split(' ')[1] || '';
    let decoded = '';
    try { decoded = atob(encoded); } catch (e) { decoded = ''; }
    const motDePasse = decoded.split(':')[1];
    if (motDePasse && motDePasse === process.env.SITE_PASSWORD) {
      return; // bon mot de passe → on laisse passer
    }
  }

  // sinon → fenêtre du navigateur qui demande le mot de passe
  return new Response('Doovlab — site en préparation 🛠️', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Doovlab"' },
  });
}

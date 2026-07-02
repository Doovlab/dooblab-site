import { next } from '@vercel/edge';

// Protège tout le site tant que la variable SITE_PASSWORD est définie sur Vercel.
// Pour OUVRIR le site le jour du lancement : il suffit de supprimer la variable
// SITE_PASSWORD dans Vercel (ou de supprimer ce fichier). Aucun autre changement.

export const config = {
  // S'applique à toutes les pages
  matcher: '/:path*',
};

export default function middleware(request) {
  const PASSWORD = process.env.SITE_PASSWORD;

  // Pas de mot de passe défini => site ouvert (aucun blocage)
  if (!PASSWORD) {
    return next();
  }

  const auth = request.headers.get('authorization');

  if (auth) {
    // En-tête attendu : "Basic base64(identifiant:motdepasse)"
    const encoded = auth.split(' ')[1] || '';
    let decoded = '';
    try {
      decoded = atob(encoded);
    } catch (e) {
      decoded = '';
    }
    // On ne vérifie que le mot de passe (l'identifiant peut être n'importe quoi)
    const password = decoded.slice(decoded.indexOf(':') + 1);
    if (password === PASSWORD) {
      return next();
    }
  }

  // Sinon : demande d'authentification (fenêtre de connexion du navigateur)
  return new Response('Accès restreint — Doovlab arrive bientôt.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Doovlab", charset="UTF-8"',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}

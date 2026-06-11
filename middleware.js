import { next } from '@vercel/edge';

export const config = { matcher: '/:path*' }; // s'applique à tout le site

export default function middleware(request) {
  const auth = request.headers.get('authorization');

  if (auth) {
    const decode = atob(auth.split(' ')[1] || ''); // lit ce qui est tapé
    const motDePasse = decode.split(':')[1];        // récupère le mot de passe
    if (motDePasse === process.env.SITE_PASSWORD) {
      return next();                                // bon mot de passe → on entre
    }
  }

  // sinon → fenêtre qui demande le mot de passe
  return new Response('Site Doovlab en construction 🛠️', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Doovlab"' },
  });
}

import { next, rewrite } from '@vercel/edge';

// ─────────────────────────────────────────────────────────────
//  OUVERTURE AUTOMATIQUE DU SITE — Doovlab
//  Avant l'heure d'ouverture : toute page affiche le compte à rebours.
//  À l'heure dite : le site s'ouvre tout seul, sans aucune intervention.
//
//  Pour changer l'heure d'ouverture : modifie OPEN_TIME ci-dessous.
//  Pour forcer l'ouverture immédiate (au cas où) : mets OPEN_TIME dans le passé,
//  ou supprime ce fichier.
// ─────────────────────────────────────────────────────────────

// 15 août 2026 à 00h00, heure de Paris (= 14 août 22h00 UTC, car Paris = UTC+2 en été)
const OPEN_TIME = new Date('2026-08-14T22:00:00Z').getTime();

export const config = {
  matcher: '/:path*',
};

export default function middleware(request) {
  const now = Date.now();

  // Le site est ouvert : on laisse tout passer normalement.
  if (now >= OPEN_TIME) {
    return next();
  }

  const url = new URL(request.url);
  const path = url.pathname;

  // Avant l'ouverture, on laisse passer UNIQUEMENT :
  //  - la page compte à rebours elle-même
  //  - le logo qu'elle affiche
  //  - les fichiers techniques (favicon, robots)
  // Tout le reste est réécrit vers le compte à rebours.
  const allowed =
    path === '/countdown.html' ||
    path === '/countdown-logo.png' ||
    path === '/favicon.ico' ||
    path === '/robots.txt';

  if (allowed) {
    return next();
  }

  // Toute autre URL (accueil, boutique, QR code, lien Insta…) affiche le compte
  // à rebours SANS changer l'adresse dans la barre du navigateur (rewrite, pas redirect).
  return rewrite(new URL('/countdown.html', request.url));
}

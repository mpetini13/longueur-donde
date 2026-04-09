import cardsData from './cards-data.json';

// ── Types ─────────────────────────────────────────────────────────────────────
export type Pack = {
  id: string;
  name: string;
  emoji: string;
  tagline: string;
  price: number | null;     // null = gratuit
  productId: string | null; // identifiant IAP (Play Store / App Store)
  cards: [string, string][];
};

// ── Définitions des packs ─────────────────────────────────────────────────────
// Les cartes sont chargées depuis constants/cards-data.json
// Pour modifier les cartes : éditez assets/cards/*.csv puis lancez :
//   node scripts/build-cards.js

const ESSENTIALS: Pack = {
  id: 'essentials',
  name: 'Les Essentiels',
  emoji: '🎯',
  tagline: 'Les grands classiques',
  price: null,
  productId: null,
  cards: cardsData.essentiels as [string, string][],
};

const CINEMA: Pack = {
  id: 'cinema',
  name: 'Cinéma & Séries',
  emoji: '🎬',
  tagline: 'Du 7ème art à la binge session',
  price: 0.99,
  productId: 'com.longueuronde.pack_cinema',
  cards: cardsData.cinema as [string, string][],
};

const SPORT: Pack = {
  id: 'sport',
  name: 'Sport & Aventure',
  emoji: '⚽',
  tagline: 'Compétition, dépassement, adrénaline',
  price: 0.99,
  productId: 'com.longueuronde.pack_sport',
  cards: cardsData.sport as [string, string][],
};

const GASTRO: Pack = {
  id: 'gastro',
  name: 'Gastronomie',
  emoji: '🍕',
  tagline: 'Saveurs, textures et émotions culinaires',
  price: 0.99,
  productId: 'com.longueuronde.pack_gastro',
  cards: cardsData.gastronomie as [string, string][],
};

const SOCIETY: Pack = {
  id: 'society',
  name: 'Société & Monde',
  emoji: '🌍',
  tagline: 'Idées, politique et géopolitique',
  price: 0.99,
  productId: 'com.longueuronde.pack_society',
  cards: cardsData.societe as [string, string][],
};

// ── Export ────────────────────────────────────────────────────────────────────
export const PACKS: Pack[] = [ESSENTIALS, CINEMA, SPORT, GASTRO, SOCIETY];

export const PACK_ALL_ID      = 'pack_all';
export const PACK_ALL_PRICE   = 2.99;
export const PACK_ALL_PRODUCT = 'com.longueuronde.pack_all';

/** Retourne toutes les cartes des packs débloqués */
export function getActiveCards(purchasedIds: string[]): [string, string][] {
  const allUnlocked = purchasedIds.includes(PACK_ALL_ID);
  return PACKS.filter(p =>
    p.price === null || allUnlocked || purchasedIds.includes(p.id)
  ).flatMap(p => p.cards);
}

/** Vérifie si un pack est débloqué */
export function isUnlocked(packId: string, purchasedIds: string[]): boolean {
  return packId === 'essentials'
    || purchasedIds.includes(PACK_ALL_ID)
    || purchasedIds.includes(packId);
}

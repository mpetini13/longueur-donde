// ── Types ─────────────────────────────────────────────────────────────────────
export type Pack = {
  id: string;
  name: string;
  emoji: string;
  tagline: string;
  price: number | null;   // null = gratuit
  productId: string | null; // identifiant IAP (Play Store / App Store)
  cards: [string, string][];
};

// ── Pack Essentiels (gratuit) ─────────────────────────────────────────────────
const ESSENTIALS: Pack = {
  id: 'essentials',
  name: 'Les Essentiels',
  emoji: '🎯',
  tagline: 'Les grands classiques',
  price: null,
  productId: null,
  cards: [
    ['Chaud', 'Froid'], ['Rapide', 'Lent'], ['Bon', 'Mauvais'], ['Grand', 'Petit'],
    ['Fort', 'Faible'], ['Cher', 'Bon marché'], ['Brillant', 'Sombre'], ['Ancien', 'Moderne'],
    ['Doux', 'Dur'], ['Calme', 'Agité'], ['Simple', 'Complexe'], ['Léger', 'Lourd'],
    ['Beau', 'Laid'], ['Dangereux', 'Sûr'], ['Populaire', 'Inconnu'], ['Heureux', 'Triste'],
    ['Propre', 'Sale'], ['Courageux', 'Lâche'], ['Logique', 'Intuitif'], ['Naturel', 'Artificiel'],
    ['Sérieux', 'Drôle'], ['Public', 'Privé'], ['Urbain', 'Rural'], ['Luxueux', 'Basique'],
    ['Vif', 'Réfléchi'], ['Bruyant', 'Silencieux'], ['Optimiste', 'Pessimiste'], ['Vieux', 'Jeune'],
    ['Étrange', 'Normal'], ['Célèbre', 'Anonyme'], ['Épicé', 'Neutre'], ['Fidèle', 'Infidèle'],
  ],
};

// ── Pack Cinéma & Séries ──────────────────────────────────────────────────────
const CINEMA: Pack = {
  id: 'cinema',
  name: 'Cinéma & Séries',
  emoji: '🎬',
  tagline: 'Du 7ème art à la binge session',
  price: 0.99,
  productId: 'com.longueuronde.pack_cinema',
  cards: [
    ['Action', 'Comédie'], ['Héros', 'Antihéros'], ['Blockbuster', "Film d'auteur"],
    ['Happy end', 'Fin tragique'], ['Réaliste', 'Fantastique'], ['Classique', 'Contemporain'],
    ['Solo', 'Ensemble'], ['Effets spéciaux', 'Mise en scène'], ['Prévisible', 'Twist final'],
    ['Original', 'Remake'], ['Muet', 'Bavard'], ['Émouvant', 'Divertissant'],
    ['Festival', 'Grand public'], ['Suite', 'Standalone'], ['Doublé', 'VOSTFR'],
    ['Cinéma', 'Streaming'], ['Long', 'Court'], ['Dialogue', 'Image'],
    ['Star mondiale', 'Acteur inconnu'], ['Série longue', 'Mini-série'],
    ['Sombre', 'Lumineux'], ['Triste', 'Euphorisant'], ['Scénario', 'Atmosphère'],
    ['Huis clos', 'Grand spectacle'], ['Culte', 'Oublié'], ['Adulte', 'Tout public'],
    ['Dramatique', 'Léger'], ['Avant-garde', 'Commercial'], ['Français', 'Américain'],
    ['Suspense', 'Comédie romantique'],
  ],
};

// ── Pack Sport & Aventure ─────────────────────────────────────────────────────
const SPORT: Pack = {
  id: 'sport',
  name: 'Sport & Aventure',
  emoji: '⚽',
  tagline: 'Compétition, dépassement, adrénaline',
  price: 0.99,
  productId: 'com.longueuronde.pack_sport',
  cards: [
    ['Offensif', 'Défensif'], ['Solo', 'Collectif'], ['Indoor', 'Outdoor'],
    ['Contact', 'Sans contact'], ['Technique', 'Puissance'], ['Explosif', 'Endurant'],
    ['Amateur', 'Professionnel'], ['Risqué', 'Sécurisé'], ['Médiatisé', 'Confidentiel'],
    ['Estival', 'Hivernal'], ['Aquatique', 'Terrestre'], ['Mental', 'Physique'],
    ['Stratège', 'Instinctif'], ['Fair-play', 'Agressif'], ['Spectaculaire', 'Discret'],
    ['Sprint', 'Marathon'], ['Précis', 'Puissant'], ['Équipé', 'Minimaliste'],
    ['Champion', 'Outsider'], ['Traditionnel', 'Extrême'], ['Olympique', 'Régional'],
    ['Vitesse', 'Endurance'], ['Adrénaline', 'Sérénité'], ['Compétitif', 'Récréatif'],
    ['Performance', 'Participation'], ['Favori', 'Surprise'], ['Entraîneur strict', 'Permissif'],
    ['Victoire écrasante', 'Défaite honorable'],
  ],
};

// ── Pack Gastronomie ──────────────────────────────────────────────────────────
const GASTRO: Pack = {
  id: 'gastro',
  name: 'Gastronomie',
  emoji: '🍕',
  tagline: 'Saveurs, textures et émotions culinaires',
  price: 0.99,
  productId: 'com.longueuronde.pack_gastro',
  cards: [
    ['Sucré', 'Salé'], ['Chaud', 'Glacé'], ['Cru', 'Bien cuit'],
    ['Léger', 'Copieux'], ['Maison', 'Industriel'], ['Gastronomique', 'Street food'],
    ['Végétarien', 'Carnivore'], ['Délicat', 'Rustique'], ['Entrée', 'Dessert'],
    ['Fermenté', 'Frais'], ['Local', 'Exotique'], ['Gras', 'Allégé'],
    ['Sain', 'Gourmand'], ['Croustillant', 'Fondant'], ['Amer', 'Acide'],
    ['Raffiné', 'Populaire'], ['Brut', 'Transformé'], ['Abondant', 'Chiche'],
    ['Traditionnel', 'Fusion'], ['Rapide à préparer', 'Long à mijoter'],
    ['Grillé', 'En sauce'], ['Ferme', 'Tendre'], ['Coloré', 'Terne'],
    ['À partager', 'Solo'], ['Plat principal', 'Amuse-bouche'],
    ['Revisité', 'Authentique'], ['Moelleux', 'Craquant'], ['Épuré', 'Chargé'],
  ],
};

// ── Pack Société & Monde ──────────────────────────────────────────────────────
const SOCIETY: Pack = {
  id: 'society',
  name: 'Société & Monde',
  emoji: '🌍',
  tagline: 'Idées, politique et géopolitique',
  price: 0.99,
  productId: 'com.longueuronde.pack_society',
  cards: [
    ['Conservateur', 'Progressiste'], ['Nord', 'Sud'], ['Individuel', 'Collectif'],
    ['Riche', 'Défavorisé'], ['Ancien monde', 'Nouveau monde'], ['Formel', 'Informel'],
    ['Liberté', 'Sécurité'], ['Local', 'Mondial'], ['Tradition', 'Modernité'],
    ['Gauche', 'Droite'], ['Religieux', 'Laïque'], ['Technophile', 'Technophobe'],
    ['Démocratique', 'Autoritaire'], ['Pacifiste', 'Belliqueux'], ['Ouvert', 'Fermé'],
    ['Ambitieux', 'Humble'], ['Engagé', 'Neutre'], ['Solidaire', 'Individualiste'],
    ['Transparent', 'Opaque'], ['Long terme', 'Court terme'], ['Révolution', 'Réforme'],
    ['Acteur', 'Spectateur'], ['Développé', 'Émergent'], ['Pluraliste', 'Uniformiste'],
    ['Centralisé', 'Décentralisé'], ['Libéral', 'Étatiste'], ['Paix', 'Conflit'],
    ['Égalité', 'Méritocratie'],
  ],
};

// ── Export ────────────────────────────────────────────────────────────────────
export const PACKS: Pack[] = [ESSENTIALS, CINEMA, SPORT, GASTRO, SOCIETY];

export const PACK_ALL_ID       = 'pack_all';
export const PACK_ALL_PRICE    = 2.99;
export const PACK_ALL_PRODUCT  = 'com.longueuronde.pack_all';

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

#!/usr/bin/env node
/**
 * build-cards.js
 * Lit les fichiers CSV dans assets/cards/ et génère constants/cards-data.json
 *
 * Usage : node scripts/build-cards.js
 *
 * Format CSV (pas d'en-tête) :
 *   Mot1,Mot2
 *   Chaud,Froid
 *   ...
 *
 * Après avoir modifié un CSV, relancer ce script puis recharger l'app (r dans Expo).
 */

const fs   = require('fs');
const path = require('path');

const PACKS = [
  { key: 'essentiels',  file: 'essentiels.csv'  },
  { key: 'cinema',      file: 'cinema.csv'      },
  { key: 'sport',       file: 'sport.csv'       },
  { key: 'gastronomie', file: 'gastronomie.csv' },
  { key: 'societe',     file: 'societe.csv'     },
];

const cardsDir  = path.join(__dirname, '../assets/cards');
const outputPath = path.join(__dirname, '../constants/cards-data.json');

const result = {};

for (const { key, file } of PACKS) {
  const csvPath = path.join(cardsDir, file);

  if (!fs.existsSync(csvPath)) {
    console.warn(`⚠️  Fichier manquant : ${file} — pack ignoré`);
    result[key] = [];
    continue;
  }

  const lines = fs.readFileSync(csvPath, 'utf-8')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith('#'));

  result[key] = lines.map(line => {
    // Gère les virgules à l'intérieur des guillemets
    const match = line.match(/^"([^"]+)","([^"]+)"$/) ||
                  line.match(/^([^,]+),(.+)$/);
    if (!match) {
      console.warn(`  ⚠️  Ligne ignorée (${file}) : ${line}`);
      return null;
    }
    return [match[1].trim(), match[2].trim()];
  }).filter(Boolean);

  console.log(`✅ ${key.padEnd(12)} ${result[key].length} cartes`);
}

fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');
console.log(`\n📦 constants/cards-data.json généré avec succès !`);
console.log(`   Rechargez l'app avec "r" dans Expo.\n`);

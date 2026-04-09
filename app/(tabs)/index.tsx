import React, { useRef, useState } from 'react';
import {
  Dimensions,
  PanResponder,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SPECTRUM_WIDTH = SCREEN_WIDTH - 48;
const ZONE_PCT = 20;

const CARDS = [
  ['Chaud', 'Froid'], ['Rapide', 'Lent'], ['Bon', 'Mauvais'], ['Grand', 'Petit'],
  ['Fort', 'Faible'], ['Cher', 'Bon marché'], ['Brillant', 'Sombre'], ['Ancien', 'Moderne'],
  ['Doux', 'Dur'], ['Calme', 'Agité'], ['Simple', 'Complexe'], ['Léger', 'Lourd'],
  ['Beau', 'Laid'], ['Dangereux', 'Sûr'], ['Populaire', 'Inconnu'], ['Heureux', 'Triste'],
  ['Propre', 'Sale'], ['Courageux', 'Lâche'], ['Logique', 'Intuitif'], ['Naturel', 'Artificiel'],
  ['Sérieux', 'Drôle'], ['Public', 'Privé'], ['Urbain', 'Rural'], ['Luxueux', 'Basique'],
  ['Rapide', 'Réfléchi'], ['Bruyant', 'Silencieux'], ['Optimiste', 'Pessimiste'], ['Vieux', 'Jeune'],
];

type Phase = 'setup' | 'clue' | 'guess' | 'reveal' | 'end';
type Player = { name: string; score: number };

export default function HomeScreen() {
  const [phase, setPhase] = useState<Phase>('setup');
  const [players, setPlayers] = useState<Player[]>([
    { name: 'Joueur 1', score: 0 },
    { name: 'Joueur 2', score: 0 },
  ]);
  const [totalRounds, setTotalRounds] = useState(8);
  const [currentRound, setCurrentRound] = useState(0);
  const [currentGiver, setCurrentGiver] = useState(0);
  const [currentCard, setCurrentCard] = useState<string[]>(['', '']);
  const [targetPos, setTargetPos] = useState(50);
  const [guessPos, setGuessPos] = useState(50);
  const [clue, setClue] = useState('');
  const [roundPoints, setRoundPoints] = useState(0);
  const [usedCards, setUsedCards] = useState<number[]>([]);
  const guessPosRef = useRef(50);

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      const x = e.nativeEvent.locationX;
      const pct = Math.max(2, Math.min(98, (x / SPECTRUM_WIDTH) * 100));
      guessPosRef.current = pct;
      setGuessPos(pct);
    },
    onPanResponderMove: (e) => {
      const x = e.nativeEvent.locationX;
      const pct = Math.max(2, Math.min(98, (x / SPECTRUM_WIDTH) * 100));
      guessPosRef.current = pct;
      setGuessPos(pct);
    },
  });

  const addPlayer = () => {
    if (players.length >= 5) return;
    setPlayers([...players, { name: `Joueur ${players.length + 1}`, score: 0 }]);
  };

  const removePlayer = (i: number) => {
    if (players.length <= 2) return;
    setPlayers(players.filter((_, idx) => idx !== i));
  };

  const updatePlayerName = (i: number, name: string) => {
    const updated = [...players];
    updated[i].name = name;
    setPlayers(updated);
  };

  const startGame = () => {
    if (players.length < 2) return;
    const reset = players.map(p => ({ ...p, score: 0 }));
    setPlayers(reset);
    setCurrentRound(0);
    setCurrentGiver(0);
    setUsedCards([]);
    startNextRound(reset, 0, 0, []);
  };

  const startNextRound = (
    currentPlayers: Player[],
    round: number,
    giver: number,
    used: number[]
  ) => {
    const newRound = round + 1;
    if (newRound > totalRounds) { setPhase('end'); return; }

    let idx = Math.floor(Math.random() * CARDS.length);
    while (used.includes(idx) && used.length < CARDS.length)
      idx = Math.floor(Math.random() * CARDS.length);

    const newUsed = [...used, idx];
    const target = 15 + Math.floor(Math.random() * 70);

    setCurrentRound(newRound);
    setCurrentCard(CARDS[idx]);
    setTargetPos(target);
    setGuessPos(50);
    guessPosRef.current = 50;
    setClue('');
    setUsedCards(newUsed);
    setPhase('clue');
  };

  const submitClue = () => {
    if (!clue.trim()) return;
    setPhase('guess');
  };

  const submitGuess = () => {
    const distance = Math.abs(guessPosRef.current - targetPos);
    let pts = 0;
    if (distance <= ZONE_PCT / 2) pts = 4;
    else if (distance <= ZONE_PCT) pts = 3;
    else if (distance <= ZONE_PCT * 1.5) pts = 2;
    else if (distance <= ZONE_PCT * 2) pts = 1;

    const updated = [...players];
    updated.forEach((p, i) => { if (i !== currentGiver) p.score += pts; });
    setPlayers(updated);
    setRoundPoints(pts);
    setGuessPos(guessPosRef.current);
    setPhase('reveal');
  };

  const goNextRound = () => {
    const nextGiver = (currentGiver + 1) % players.length;
    setCurrentGiver(nextGiver);
    startNextRound(players, currentRound, nextGiver, usedCards);
  };

  const restartGame = () => {
    setPlayers(players.map(p => ({ ...p, score: 0 })));
    setPhase('setup');
  };

  const getHint = () => {
    if (targetPos < 30) return 'plutôt à gauche';
    if (targetPos > 70) return 'plutôt à droite';
    return 'vers le centre';
  };

  const getScoreMsg = () => {
    const msgs = ['Raté !', 'Proche !', 'Bien !', 'Très bien !', 'Parfait !'];
    return msgs[roundPoints];
  };

  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  const zoneLeft = Math.max(0, Math.min(80, targetPos - ZONE_PCT / 2));

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        {phase === 'setup' && (
          <View>
            <Text style={styles.title}>Longueur d'onde</Text>
            <Text style={styles.subtitle}>Configurez votre partie</Text>

            <Text style={styles.sectionLabel}>Joueurs</Text>
            {players.map((p, i) => (
              <View key={i} style={styles.playerRow}>
                <TextInput
                  style={styles.playerInput}
                  value={p.name}
                  onChangeText={t => updatePlayerName(i, t)}
                  placeholder={`Joueur ${i + 1}`}
                />
                <TouchableOpacity onPress={() => removePlayer(i)} style={styles.removeBtn}>
                  <Text style={styles.removeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={styles.btnOutline} onPress={addPlayer}>
              <Text style={styles.btnOutlineText}>+ Ajouter un joueur</Text>
            </TouchableOpacity>

            <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Nombre de manches</Text>
            <View style={styles.roundsRow}>
              {[8, 12, 16].map(n => (
                <TouchableOpacity
                  key={n}
                  style={[styles.roundBtn, totalRounds === n && styles.roundBtnActive]}
                  onPress={() => setTotalRounds(n)}
                >
                  <Text style={[styles.roundBtnText, totalRounds === n && styles.roundBtnTextActive]}>
                    {n}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={[styles.btn, { marginTop: 32 }]} onPress={startGame}>
              <Text style={styles.btnText}>Commencer</Text>
            </TouchableOpacity>
          </View>
        )}

        {phase === 'clue' && (
          <View>
            <Text style={styles.roundInfo}>
              Manche {currentRound}/{totalRounds} — Faiseur d'indice : {players[currentGiver].name}
            </Text>

            <View style={styles.cardBox}>
              <View style={styles.conceptsRow}>
                <Text style={styles.conceptLeft}>{currentCard[0]}</Text>
                <Text style={styles.conceptDivider}>←————→</Text>
                <Text style={styles.conceptRight}>{currentCard[1]}</Text>
              </View>
              <Text style={styles.cardSubtitle}>Le spectre va de l'un à l'autre</Text>
            </View>

            <Text style={styles.hintText}>
              La cible est <Text style={styles.hintBold}>{getHint()}</Text> ({Math.round(targetPos)}%) — donnez un indice !
            </Text>

            <View style={styles.spectrumWrap}>
              <View style={styles.spectrumBar}>
                <View style={[styles.targetZone, { left: `${zoneLeft}%`, width: `${ZONE_PCT}%` }]} />
              </View>
              <View style={styles.spectrumLabels}>
                <Text style={styles.spectrumLabel}>{currentCard[0]}</Text>
                <Text style={styles.spectrumLabel}>{currentCard[1]}</Text>
              </View>
            </View>

            <Text style={styles.sectionLabel}>Votre indice (un mot ou courte phrase)</Text>
            <TextInput
              style={styles.clueInput}
              value={clue}
              onChangeText={setClue}
              placeholder="Ex: tiède, passable, modéré..."
              maxLength={40}
            />
            <TouchableOpacity style={styles.btn} onPress={submitClue}>
              <Text style={styles.btnText}>Passer le téléphone →</Text>
            </TouchableOpacity>
          </View>
        )}

        {phase === 'guess' && (
          <View>
            <Text style={styles.roundInfo}>
              Manche {currentRound}/{totalRounds} — Devinez !
            </Text>

            <View style={styles.cardBox}>
              <View style={styles.conceptsRow}>
                <Text style={styles.conceptLeft}>{currentCard[0]}</Text>
                <Text style={styles.conceptDivider}>←————→</Text>
                <Text style={styles.conceptRight}>{currentCard[1]}</Text>
              </View>
              <Text style={styles.clueDisplay}>"{clue}"</Text>
            </View>

            <Text style={styles.hintText}>Glissez le curseur pour deviner</Text>

            <View style={styles.spectrumWrap} {...panResponder.panHandlers}>
              <View style={styles.spectrumBar}>
                <View style={[styles.cursor, { left: `${guessPos}%` }]} />
              </View>
              <View style={styles.spectrumLabels}>
                <Text style={styles.spectrumLabel}>{currentCard[0]}</Text>
                <Text style={styles.spectrumLabel}>{currentCard[1]}</Text>
              </View>
            </View>

            <TouchableOpacity style={[styles.btn, { marginTop: 16 }]} onPress={submitGuess}>
              <Text style={styles.btnText}>Valider ma position</Text>
            </TouchableOpacity>
          </View>
        )}

        {phase === 'reveal' && (
          <View>
            <Text style={styles.roundInfo}>
              Manche {currentRound}/{totalRounds} — Résultat
            </Text>

            <View style={styles.cardBox}>
              <View style={styles.conceptsRow}>
                <Text style={styles.conceptLeft}>{currentCard[0]}</Text>
                <Text style={styles.conceptDivider}>←————→</Text>
                <Text style={styles.conceptRight}>{currentCard[1]}</Text>
              </View>
              <Text style={styles.clueDisplay}>"{clue}"</Text>
            </View>

            <View style={styles.spectrumWrap}>
              <View style={styles.spectrumBar}>
                <View style={[styles.targetZone, { left: `${zoneLeft}%`, width: `${ZONE_PCT}%` }]} />
                <View style={[styles.cursor, { left: `${guessPos}%` }]} />
              </View>
              <View style={styles.spectrumLabels}>
                <Text style={styles.spectrumLabel}>{currentCard[0]}</Text>
                <Text style={styles.spectrumLabel}>{currentCard[1]}</Text>
              </View>
            </View>

            <View style={styles.scoreReveal}>
              <Text style={[styles.scorePoints, { color: roundPoints >= 3 ? '#1D9E75' : roundPoints >= 1 ? '#BA7517' : '#A32D2D' }]}>
                +{roundPoints}
              </Text>
              <Text style={styles.scoreMsg}>{getScoreMsg()}</Text>
            </View>

            <Text style={styles.sectionLabel}>Scores</Text>
            {sortedPlayers.map((p, i) => (
              <View key={i} style={styles.scoreRow}>
                <Text style={styles.scoreRowName}>
                  {i === 0 ? '🥇 ' : i === 1 ? '🥈 ' : i === 2 ? '🥉 ' : ''}{p.name}
                </Text>
                <Text style={styles.scoreRowPts}>{p.score}</Text>
              </View>
            ))}

            <TouchableOpacity style={[styles.btn, { marginTop: 24 }]} onPress={goNextRound}>
              <Text style={styles.btnText}>
                {currentRound >= totalRounds ? 'Voir les résultats →' : 'Manche suivante →'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {phase === 'end' && (
          <View>
            <Text style={styles.title}>Fin de partie !</Text>
            <Text style={styles.sectionLabel}>Classement final</Text>
            {sortedPlayers.map((p, i) => (
              <View key={i} style={styles.scoreRow}>
                <Text style={styles.scoreRowName}>
                  {i === 0 ? '🥇 ' : i === 1 ? '🥈 ' : i === 2 ? '🥉 ' : ''}{p.name}
                </Text>
                <Text style={styles.scoreRowPts}>{p.score} pts</Text>
              </View>
            ))}
            <TouchableOpacity style={[styles.btn, { marginTop: 32 }]} onPress={restartGame}>
              <Text style={styles.btnText}>Rejouer</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 24, paddingBottom: 60 },
  title: { fontSize: 26, fontWeight: '600', marginBottom: 4, color: '#1a1a1a' },
  subtitle: { fontSize: 14, color: '#888', marginBottom: 24 },
  sectionLabel: { fontSize: 12, fontWeight: '600', color: '#888', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  roundInfo: { fontSize: 13, color: '#888', marginBottom: 16 },
  playerRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  playerInput: { flex: 1, borderWidth: 0.5, borderColor: '#ccc', borderRadius: 8, padding: 10, fontSize: 14, color: '#1a1a1a' },
  removeBtn: { padding: 10, borderWidth: 0.5, borderColor: '#ccc', borderRadius: 8 },
  removeBtnText: { color: '#888', fontSize: 14 },
  roundsRow: { flexDirection: 'row', gap: 10 },
  roundBtn: { flex: 1, padding: 12, borderWidth: 0.5, borderColor: '#ccc', borderRadius: 8, alignItems: 'center' },
  roundBtnActive: { backgroundColor: '#1a1a1a', borderColor: '#1a1a1a' },
  roundBtnText: { fontSize: 15, color: '#1a1a1a' },
  roundBtnTextActive: { color: '#fff' },
  btn: { backgroundColor: '#1a1a1a', borderRadius: 10, padding: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '500' },
  btnOutline: { borderWidth: 0.5, borderColor: '#ccc', borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 4 },
  btnOutlineText: { color: '#1a1a1a', fontSize: 14 },
  cardBox: { backgroundColor: '#f5f5f5', borderRadius: 12, padding: 20, marginBottom: 20, alignItems: 'center' },
  conceptsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  conceptLeft: { fontSize: 15, fontWeight: '600', color: '#185FA5' },
  conceptRight: { fontSize: 15, fontWeight: '600', color: '#993C1D' },
  conceptDivider: { fontSize: 12, color: '#aaa' },
  cardSubtitle: { fontSize: 13, color: '#888' },
  clueDisplay: { fontSize: 17, fontWeight: '500', marginTop: 10, color: '#1a1a1a' },
  hintText: { fontSize: 13, color: '#888', marginBottom: 12 },
  hintBold: { fontWeight: '600', color: '#1a1a1a' },
  spectrumWrap: { marginBottom: 20 },
  spectrumBar: {
    height: 28, borderRadius: 14, overflow: 'hidden',
    backgroundColor: '#ddd', position: 'relative',
  },
  targetZone: {
    position: 'absolute', top: 0, height: 28,
    backgroundColor: 'rgba(99,56,6,0.25)',
    borderWidth: 2, borderColor: 'rgba(99,56,6,0.5)',
    borderRadius: 4,
  },
  cursor: {
    position: 'absolute', top: 2, width: 24, height: 24,
    borderRadius: 12, backgroundColor: '#fff',
    borderWidth: 2.5, borderColor: '#1a1a1a',
    marginLeft: -12,
  },
  spectrumLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  spectrumLabel: { fontSize: 12, color: '#888' },
  clueInput: { borderWidth: 0.5, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 16, color: '#1a1a1a' },
  scoreReveal: { alignItems: 'center', paddingVertical: 24 },
  scorePoints: { fontSize: 52, fontWeight: '600' },
  scoreMsg: { fontSize: 16, color: '#888', marginTop: 6 },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  scoreRowName: { fontSize: 15, color: '#1a1a1a' },
  scoreRowPts: { fontSize: 20, fontWeight: '500', color: '#1a1a1a' },
});

import React, { useRef, useState } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import {
  Dimensions,
  PanResponder,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { PALETTE, PHASE_BG, PLAYER_COLORS } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SPECTRUM_WIDTH = SCREEN_WIDTH - 48;
const ZONE_PCT = 20;
const SEG = 20;

// Génère un dégradé bleu → blanc → rouge sur N segments
function spectrumColor(i: number): string {
  const t = i / (SEG - 1);
  if (t <= 0.5) {
    const s = t * 2;
    return `rgb(${Math.round(37 + s * 218)},${Math.round(99 + s * 156)},${Math.round(235 - s * 235)})`;
  }
  const s = (t - 0.5) * 2;
  return `rgb(255,${Math.round(255 - s * 255)},${Math.round(255 - s * 255)})`;
}

const SPECTRUM_COLORS = Array.from({ length: SEG }, (_, i) => spectrumColor(i));

const CARDS: [string, string][] = [
  ['Chaud', 'Froid'], ['Rapide', 'Lent'], ['Bon', 'Mauvais'], ['Grand', 'Petit'],
  ['Fort', 'Faible'], ['Cher', 'Bon marché'], ['Brillant', 'Sombre'], ['Ancien', 'Moderne'],
  ['Doux', 'Dur'], ['Calme', 'Agité'], ['Simple', 'Complexe'], ['Léger', 'Lourd'],
  ['Beau', 'Laid'], ['Dangereux', 'Sûr'], ['Populaire', 'Inconnu'], ['Heureux', 'Triste'],
  ['Propre', 'Sale'], ['Courageux', 'Lâche'], ['Logique', 'Intuitif'], ['Naturel', 'Artificiel'],
  ['Sérieux', 'Drôle'], ['Public', 'Privé'], ['Urbain', 'Rural'], ['Luxueux', 'Basique'],
  ['Vif', 'Réfléchi'], ['Bruyant', 'Silencieux'], ['Optimiste', 'Pessimiste'], ['Vieux', 'Jeune'],
];

type Phase = 'setup' | 'clue' | 'guess' | 'reveal' | 'end';
type Player = { name: string; score: number };

export default function HomeScreen() {
  const [phase, setPhase]               = useState<Phase>('setup');
  const [players, setPlayers]           = useState<Player[]>([
    { name: 'Joueur 1', score: 0 },
    { name: 'Joueur 2', score: 0 },
  ]);
  const [totalRounds, setTotalRounds]   = useState(8);
  const [currentRound, setCurrentRound] = useState(0);
  const [currentGiver, setCurrentGiver] = useState(0);
  const [currentCard, setCurrentCard]   = useState<[string, string]>(['', '']);
  const [targetPos, setTargetPos]       = useState(50);
  const [guessPos, setGuessPos]         = useState(50);
  const [clue, setClue]                 = useState('');
  const [roundPoints, setRoundPoints]   = useState(0);
  const [usedCards, setUsedCards]       = useState<number[]>([]);
  const guessPosRef = useRef(50);

  // Animation score
  const scoreScale = useSharedValue(0);
  const scoreAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scoreScale.value }],
    opacity: scoreScale.value,
  }));

  // PanResponder stable
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: (e) => {
        const pct = Math.max(2, Math.min(98, (e.nativeEvent.locationX / SPECTRUM_WIDTH) * 100));
        guessPosRef.current = pct;
        setGuessPos(pct);
      },
      onPanResponderMove: (e) => {
        const pct = Math.max(2, Math.min(98, (e.nativeEvent.locationX / SPECTRUM_WIDTH) * 100));
        guessPosRef.current = pct;
        setGuessPos(pct);
      },
    })
  ).current;

  // ── Helpers ──────────────────────────────────────────────────────────────

  const initials = (name: string) => name.trim().charAt(0).toUpperCase();

  const getHint = () => {
    if (targetPos < 30) return 'plutôt à gauche';
    if (targetPos > 70) return 'plutôt à droite';
    return 'vers le centre';
  };

  const getScoreMsg = () =>
    ['Raté ! 😬', 'Proche ! 👍', 'Bien ! 🎯', 'Très bien ! ⭐', 'Parfait ! 🎉'][roundPoints];

  const getScoreColor = () => {
    if (roundPoints >= 4) return PALETTE.green;
    if (roundPoints >= 2) return PALETTE.amber;
    return PALETTE.red;
  };

  // ── Actions ──────────────────────────────────────────────────────────────

  const addPlayer = () => {
    if (players.length >= 5) return;
    setPlayers(prev => [...prev, { name: `Joueur ${prev.length + 1}`, score: 0 }]);
  };

  const removePlayer = (i: number) => {
    if (players.length <= 2) return;
    setPlayers(prev => prev.filter((_, idx) => idx !== i));
  };

  const updatePlayerName = (i: number, name: string) => {
    setPlayers(prev => prev.map((p, idx) => idx === i ? { ...p, name } : p));
  };

  const startGame = () => {
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

    setCurrentRound(newRound);
    setCurrentCard(CARDS[idx]);
    setTargetPos(15 + Math.floor(Math.random() * 70));
    setGuessPos(50);
    guessPosRef.current = 50;
    setClue('');
    setUsedCards([...used, idx]);
    setPhase('clue');
  };

  const submitClue = () => {
    if (!clue.trim()) return;
    setPhase('guess');
  };

  const submitGuess = () => {
    const distance = Math.abs(guessPosRef.current - targetPos);
    let pts = 0;
    if (distance <= ZONE_PCT / 2)       pts = 4;
    else if (distance <= ZONE_PCT)      pts = 3;
    else if (distance <= ZONE_PCT * 1.5) pts = 2;
    else if (distance <= ZONE_PCT * 2)  pts = 1;

    setPlayers(prev =>
      prev.map((p, i) => i !== currentGiver ? { ...p, score: p.score + pts } : p)
    );
    setRoundPoints(pts);
    setGuessPos(guessPosRef.current);

    scoreScale.value = withSequence(
      withTiming(0, { duration: 0 }),
      withSpring(1.2, { damping: 6, stiffness: 200 }),
      withSpring(1.0, { damping: 14 })
    );

    setPhase('reveal');
  };

  const goNextRound = () => {
    const nextGiver = (currentGiver + 1) % players.length;
    setCurrentGiver(nextGiver);
    startNextRound(players, currentRound, nextGiver, usedCards);
  };

  const restartGame = () => {
    scoreScale.value = 0;
    setPlayers(prev => prev.map(p => ({ ...p, score: 0 })));
    setPhase('setup');
  };

  // ── Rendu spectrum ────────────────────────────────────────────────────────

  const zoneLeft = Math.max(0, Math.min(80, targetPos - ZONE_PCT / 2));

  const renderSpectrum = ({
    showTarget = false,
    showCursor = false,
    interactive = false,
  }: { showTarget?: boolean; showCursor?: boolean; interactive?: boolean }) => (
    <View style={s.spectrumWrap} {...(interactive ? panResponder.panHandlers : {})}>
      <View style={s.spectrumBar}>
        {SPECTRUM_COLORS.map((color, i) => (
          <View key={i} style={{ flex: 1, height: '100%', backgroundColor: color }} />
        ))}
        {showTarget && (
          <View style={[s.targetZone, { left: `${zoneLeft}%` as any, width: `${ZONE_PCT}%` as any }]} />
        )}
        {showCursor && (
          <View style={[s.cursor, { left: `${guessPos}%` as any }]} />
        )}
      </View>
      <View style={s.spectrumLabels}>
        <Text style={[s.spectrumLabel, { color: PALETTE.blue }]}>{currentCard[0]}</Text>
        <Text style={[s.spectrumLabel, { color: PALETTE.red }]}>{currentCard[1]}</Text>
      </View>
    </View>
  );

  // ── Rendu concept card ────────────────────────────────────────────────────

  const renderConceptCard = () => (
    <View style={s.conceptCard}>
      <Text style={[s.conceptWord, { color: PALETTE.blue }]}>{currentCard[0]}</Text>
      <Text style={s.conceptDivider}>←————→</Text>
      <Text style={[s.conceptWord, { color: PALETTE.red }]}>{currentCard[1]}</Text>
    </View>
  );

  // ── Rendu scores ──────────────────────────────────────────────────────────

  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  const MEDALS = ['🥇', '🥈', '🥉', '🏅', '🏅'];

  const renderScores = (showPts = false) =>
    sortedPlayers.map((p, i) => {
      const colorIdx = players.findIndex(pl => pl.name === p.name);
      return (
        <View key={i} style={[s.scoreRow, i === 0 && s.scoreRowFirst]}>
          <View style={s.scoreRowLeft}>
            <Text style={s.medal}>{MEDALS[i]}</Text>
            <View style={[s.avatarSm, { backgroundColor: PLAYER_COLORS[colorIdx] ?? PALETTE.gray400 }]}>
              <Text style={s.avatarSmText}>{initials(p.name)}</Text>
            </View>
            <Text style={[s.scoreRowName, i === 0 && s.scoreRowNameFirst]}>{p.name}</Text>
          </View>
          <Text style={[s.scoreRowPts, i === 0 && s.scoreRowPtsFirst]}>
            {p.score}{showPts ? ' pts' : ''}
          </Text>
        </View>
      );
    });

  // ── UI ───────────────────────────────────────────────────────────────────

  const bg = PHASE_BG[phase];

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: bg }]}>
      <StatusBar barStyle="light-content" backgroundColor={bg} />

      {/* ── En-tête coloré ── */}
      <View style={[s.header, { backgroundColor: bg }]}>
        {phase === 'setup' && <>
          <Text style={s.headerEmoji}>🌊</Text>
          <Text style={s.headerTitle}>Longueur d'onde</Text>
          <Text style={s.headerSub}>Lisez dans les esprits</Text>
        </>}
        {phase === 'clue' && <>
          <Text style={s.headerBadge}>MANCHE {currentRound} / {totalRounds}</Text>
          <Text style={s.headerTitle}>🎭 {players[currentGiver].name}</Text>
          <Text style={s.headerSub}>donne l'indice</Text>
        </>}
        {phase === 'guess' && <>
          <Text style={s.headerBadge}>MANCHE {currentRound} / {totalRounds}</Text>
          <Text style={s.headerTitle}>🎯 À vous de jouer !</Text>
          <Text style={s.headerSub}>Où se cache la réponse ?</Text>
        </>}
        {phase === 'reveal' && <>
          <Text style={s.headerBadge}>MANCHE {currentRound} / {totalRounds}</Text>
          <Text style={s.headerTitle}>Résultat</Text>
        </>}
        {phase === 'end' && <>
          <Text style={s.headerEmoji}>🏆</Text>
          <Text style={s.headerTitle}>Fin de partie !</Text>
          <Text style={s.headerSub}>Classement final</Text>
        </>}
      </View>

      {/* ── Feuille blanche ── */}
      <View style={s.sheet}>
        <ScrollView
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* ──────────────── SETUP ──────────────── */}
          {phase === 'setup' && <>
            <Text style={s.label}>JOUEURS</Text>

            {players.map((p, i) => (
              <View key={i} style={s.playerRow}>
                <View style={[s.avatar, { backgroundColor: PLAYER_COLORS[i] }]}>
                  <Text style={s.avatarText}>{initials(p.name)}</Text>
                </View>
                <TextInput
                  style={s.playerInput}
                  value={p.name}
                  onChangeText={t => updatePlayerName(i, t)}
                  placeholder={`Joueur ${i + 1}`}
                  placeholderTextColor={PALETTE.gray400}
                />
                {players.length > 2 && (
                  <TouchableOpacity onPress={() => removePlayer(i)} style={s.removeBtn}>
                    <Text style={s.removeBtnText}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}

            {players.length < 5 && (
              <TouchableOpacity style={s.addBtn} onPress={addPlayer}>
                <Text style={s.addBtnText}>+ Ajouter un joueur</Text>
              </TouchableOpacity>
            )}

            <Text style={[s.label, { marginTop: 28 }]}>NOMBRE DE MANCHES</Text>
            <View style={s.roundsRow}>
              {[8, 12, 16].map(n => (
                <TouchableOpacity
                  key={n}
                  style={[s.roundBtn, totalRounds === n && s.roundBtnActive]}
                  onPress={() => setTotalRounds(n)}
                >
                  <Text style={[s.roundBtnN, totalRounds === n && s.roundBtnNActive]}>{n}</Text>
                  <Text style={[s.roundBtnSub, totalRounds === n && { color: PALETTE.white }]}>manches</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[s.bigBtn, { backgroundColor: PALETTE.purple, marginTop: 36 }]}
              onPress={startGame}
            >
              <Text style={s.bigBtnText}>Commencer la partie →</Text>
            </TouchableOpacity>
          </>}

          {/* ──────────────── CLUE ──────────────── */}
          {phase === 'clue' && <>
            {renderConceptCard()}

            <View style={s.hintBox}>
              <Text style={s.hintText}>
                La cible est{' '}
                <Text style={s.hintBold}>{getHint()}</Text>
                {' '}({Math.round(targetPos)} %)
              </Text>
            </View>

            {renderSpectrum({ showTarget: true })}

            <Text style={s.label}>VOTRE INDICE</Text>
            <TextInput
              style={s.clueInput}
              value={clue}
              onChangeText={setClue}
              placeholder="Un mot ou une courte phrase..."
              placeholderTextColor={PALETTE.gray400}
              maxLength={40}
              autoFocus
            />

            <TouchableOpacity
              style={[s.bigBtn, { backgroundColor: PALETTE.blue }]}
              onPress={submitClue}
            >
              <Text style={s.bigBtnText}>Passer le téléphone →</Text>
            </TouchableOpacity>
          </>}

          {/* ──────────────── GUESS ──────────────── */}
          {phase === 'guess' && <>
            {renderConceptCard()}

            <View style={s.clueBox}>
              <Text style={s.clueBoxLabel}>L'INDICE</Text>
              <Text style={s.clueBoxText}>"{clue}"</Text>
            </View>

            <Text style={s.guideText}>Glissez pour placer votre réponse</Text>

            {renderSpectrum({ showCursor: true, interactive: true })}

            <TouchableOpacity
              style={[s.bigBtn, { backgroundColor: PALETTE.teal, marginTop: 8 }]}
              onPress={submitGuess}
            >
              <Text style={s.bigBtnText}>Valider ma position →</Text>
            </TouchableOpacity>
          </>}

          {/* ──────────────── REVEAL ──────────────── */}
          {phase === 'reveal' && <>
            {renderConceptCard()}

            <View style={s.clueBox}>
              <Text style={s.clueBoxLabel}>L'INDICE</Text>
              <Text style={s.clueBoxText}>"{clue}"</Text>
            </View>

            {renderSpectrum({ showTarget: true, showCursor: true })}

            <Animated.View style={[s.scoreReveal, scoreAnimStyle]}>
              <Text style={[s.scorePoints, { color: getScoreColor() }]}>+{roundPoints}</Text>
              <Text style={s.scoreMsg}>{getScoreMsg()}</Text>
            </Animated.View>

            <Text style={s.label}>SCORES</Text>
            {renderScores()}

            <TouchableOpacity
              style={[s.bigBtn, { backgroundColor: PALETTE.amber, marginTop: 24 }]}
              onPress={goNextRound}
            >
              <Text style={s.bigBtnText}>
                {currentRound >= totalRounds ? 'Voir les résultats →' : 'Manche suivante →'}
              </Text>
            </TouchableOpacity>
          </>}

          {/* ──────────────── END ──────────────── */}
          {phase === 'end' && <>
            <Text style={s.label}>CLASSEMENT FINAL</Text>
            {renderScores(true)}

            <TouchableOpacity
              style={[s.bigBtn, { backgroundColor: PALETTE.purple, marginTop: 36 }]}
              onPress={restartGame}
            >
              <Text style={s.bigBtnText}>Rejouer 🎮</Text>
            </TouchableOpacity>
          </>}

        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:  { flex: 1 },

  // Header
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
    alignItems: 'center',
  },
  headerEmoji: { fontSize: 52, marginBottom: 6 },
  headerBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 1.8,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 4,
  },
  headerSub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },

  // Sheet
  sheet: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  content: { padding: 24, paddingBottom: 64 },

  // Labels
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: PALETTE.gray400,
    letterSpacing: 1.6,
    marginBottom: 12,
  },

  // ── Setup ──
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 17 },
  playerInput: {
    flex: 1,
    backgroundColor: PALETTE.gray100,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: PALETTE.dark,
  },
  removeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: PALETTE.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnText: { color: PALETTE.gray600, fontSize: 13, fontWeight: '700' },
  addBtn: {
    borderWidth: 1.5,
    borderColor: PALETTE.gray200,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 13,
    alignItems: 'center',
    marginTop: 2,
  },
  addBtnText: { color: PALETTE.gray600, fontSize: 14, fontWeight: '500' },

  roundsRow: { flexDirection: 'row', gap: 10 },
  roundBtn: {
    flex: 1,
    padding: 14,
    borderWidth: 1.5,
    borderColor: PALETTE.gray200,
    borderRadius: 14,
    alignItems: 'center',
  },
  roundBtnActive:   { backgroundColor: PALETTE.purple, borderColor: PALETTE.purple },
  roundBtnN:        { fontSize: 22, fontWeight: '800', color: PALETTE.dark },
  roundBtnNActive:  { color: '#fff' },
  roundBtnSub:      { fontSize: 11, color: PALETTE.gray400, marginTop: 2 },

  // ── Shared ──
  bigBtn: {
    borderRadius: 16,
    padding: 17,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 5,
  },
  bigBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  conceptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: PALETTE.gray100,
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 18,
    marginBottom: 16,
  },
  conceptWord:    { fontSize: 18, fontWeight: '800', flex: 1, textAlign: 'center' },
  conceptDivider: { fontSize: 12, color: PALETTE.gray400, paddingHorizontal: 6 },

  // ── Clue phase ──
  hintBox: {
    backgroundColor: PALETTE.blueLight,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  hintText: { fontSize: 13, color: PALETTE.blueDark, textAlign: 'center' },
  hintBold: { fontWeight: '800' },

  clueInput: {
    backgroundColor: PALETTE.gray100,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
    color: PALETTE.dark,
    marginBottom: 16,
  },

  // ── Guess phase ──
  clueBox: {
    backgroundColor: PALETTE.tealLight,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    alignItems: 'center',
  },
  clueBoxLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: PALETTE.teal,
    letterSpacing: 1.6,
    marginBottom: 4,
  },
  clueBoxText: { fontSize: 22, fontWeight: '800', color: PALETTE.tealDark },

  guideText: {
    fontSize: 13,
    color: PALETTE.gray400,
    textAlign: 'center',
    marginBottom: 12,
  },

  // ── Spectrum ──
  spectrumWrap: { marginBottom: 20 },
  spectrumBar: {
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    flexDirection: 'row',
    position: 'relative',
  },
  targetZone: {
    position: 'absolute',
    top: 0,
    height: 48,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.85)',
    borderRadius: 8,
  },
  cursor: {
    position: 'absolute',
    top: 6,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 3.5,
    borderColor: PALETTE.dark,
    marginLeft: -18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 5,
  },
  spectrumLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  spectrumLabel: { fontSize: 12, fontWeight: '700' },

  // ── Reveal phase ──
  scoreReveal: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  scorePoints: { fontSize: 80, fontWeight: '900', lineHeight: 88 },
  scoreMsg:    { fontSize: 18, color: PALETTE.gray600, marginTop: 4, fontWeight: '600' },

  // ── Scores ──
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.gray100,
  },
  scoreRowFirst: {
    backgroundColor: PALETTE.purpleLight,
    borderRadius: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 0,
    marginBottom: 6,
    paddingVertical: 12,
  },
  scoreRowLeft:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  medal:             { fontSize: 20, width: 26 },
  avatarSm: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSmText:       { color: '#fff', fontWeight: '700', fontSize: 13 },
  scoreRowName:       { fontSize: 15, color: PALETTE.dark, fontWeight: '500' },
  scoreRowNameFirst:  { fontWeight: '800', fontSize: 16 },
  scoreRowPts:        { fontSize: 20, fontWeight: '700', color: PALETTE.dark },
  scoreRowPtsFirst:   { fontSize: 24, color: PALETTE.purple },
});

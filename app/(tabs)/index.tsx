import React, { useEffect, useRef, useState } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
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

// ── Dimensions du demi-cercle ────────────────────────────────────────────────
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DIAL_W     = SCREEN_WIDTH - 48;
const DIAL_R     = DIAL_W / 2;
const ARC_R      = DIAL_R * 0.84;   // rayon de l'arc de points
const DOT_COUNT  = 60;              // nombre de points colorés sur l'arc
const DOT_SIZE   = 9;
const CURSOR_SZ  = 34;

// ── Zones de score ───────────────────────────────────────────────────────────
const ZONE_5 = 2.5;   // ±2.5% → 5 pts
const ZONE_3 = 10;    // ±10%  → 3 pts
const ZONE_1 = 15;    // ±15%  → 1 pt

// ── Couleur du spectre bleu→blanc→rouge ──────────────────────────────────────
const SEG = 20;
function spectrumColor(i: number): string {
  const t = i / (SEG - 1);
  if (t <= 0.5) {
    const s = t * 2;
    return `rgb(${Math.round(37 + s * 218)},${Math.round(99 + s * 156)},${Math.round(235 - s * 235)})`;
  }
  const s = (t - 0.5) * 2;
  return `rgb(255,${Math.round(255 - s * 255)},${Math.round(255 - s * 255)})`;
}

// ── Géométrie de l'arc ────────────────────────────────────────────────────────
// 0% = gauche (angle π), 100% = droite (angle 0)
function pctToAngle(pct: number): number {
  return (1 - pct / 100) * Math.PI;
}

function arcPos(pct: number, r: number = ARC_R): { x: number; y: number } {
  const θ = pctToAngle(pct);
  return {
    x: DIAL_R + r * Math.cos(θ),
    y: DIAL_R - r * Math.sin(θ),
  };
}

function touchToPct(touchX: number, touchY: number): number {
  const dx = touchX - DIAL_R;
  const dy = DIAL_R - touchY;
  let θ = Math.atan2(dy, dx);
  // Si on touche sous la ligne centrale, snap aux extrémités
  if (θ < 0) θ = dx < 0 ? Math.PI : 0;
  θ = Math.max(0, Math.min(Math.PI, θ));
  return Math.max(1, Math.min(99, (1 - θ / Math.PI) * 100));
}

function dotZoneColor(distance: number): string {
  if (distance <= ZONE_5) return '#22C55E';
  if (distance <= ZONE_3) return '#EAB308';
  if (distance <= ZONE_1) return '#F97316';
  return '';
}

// ── Cartes ────────────────────────────────────────────────────────────────────
const CARDS: [string, string][] = [
  ['Chaud', 'Froid'], ['Rapide', 'Lent'], ['Bon', 'Mauvais'], ['Grand', 'Petit'],
  ['Fort', 'Faible'], ['Cher', 'Bon marché'], ['Brillant', 'Sombre'], ['Ancien', 'Moderne'],
  ['Doux', 'Dur'], ['Calme', 'Agité'], ['Simple', 'Complexe'], ['Léger', 'Lourd'],
  ['Beau', 'Laid'], ['Dangereux', 'Sûr'], ['Populaire', 'Inconnu'], ['Heureux', 'Triste'],
  ['Propre', 'Sale'], ['Courageux', 'Lâche'], ['Logique', 'Intuitif'], ['Naturel', 'Artificiel'],
  ['Sérieux', 'Drôle'], ['Public', 'Privé'], ['Urbain', 'Rural'], ['Luxueux', 'Basique'],
  ['Vif', 'Réfléchi'], ['Bruyant', 'Silencieux'], ['Optimiste', 'Pessimiste'], ['Vieux', 'Jeune'],
  ['Rapide', 'Économique'], ['Étrange', 'Normal'], ['Célèbre', 'Anonyme'], ['Fort', 'Doux'],
];

type Phase = 'home' | 'setup' | 'clue' | 'guess' | 'reveal' | 'end';
type Player = { name: string; score: number };
const MEDALS = ['🥇', '🥈', '🥉', '🏅', '🏅'];

// ── Composant principal ───────────────────────────────────────────────────────
export default function HomeScreen() {
  const [phase, setPhase]               = useState<Phase>('home');
  const [players, setPlayers]           = useState<Player[]>([
    { name: 'Joueur 1', score: 0 },
    { name: 'Joueur 2', score: 0 },
  ]);
  const [totalRounds, setTotalRounds]   = useState(10);
  const [currentRound, setCurrentRound] = useState(0);
  const [currentGiver, setCurrentGiver] = useState(0);
  const [currentCard, setCurrentCard]   = useState<[string, string]>(['', '']);
  const [targetPos, setTargetPos]       = useState(50);
  const [guessPos, setGuessPos]         = useState(50);
  const [clue, setClue]                 = useState('');
  const [roundPoints, setRoundPoints]   = useState(0);
  const [usedCards, setUsedCards]       = useState<number[]>([]);
  const guessPosRef = useRef(50);

  // Animations
  const logoScale   = useSharedValue(1);
  const homeOpacity = useSharedValue(0);
  const scoreScale  = useSharedValue(0);

  const logoStyle  = useAnimatedStyle(() => ({ transform: [{ scale: logoScale.value }] }));
  const homeStyle  = useAnimatedStyle(() => ({
    opacity: homeOpacity.value,
    transform: [{ translateY: (1 - homeOpacity.value) * 24 }],
  }));
  const scoreStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scoreScale.value }],
    opacity: Math.min(1, scoreScale.value),
  }));

  useEffect(() => {
    homeOpacity.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) });
    logoScale.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        withTiming(1.0, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, []);

  // PanResponder stable pour le demi-cercle
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: (e) => {
        const p = touchToPct(e.nativeEvent.locationX, e.nativeEvent.locationY);
        guessPosRef.current = p;
        setGuessPos(p);
      },
      onPanResponderMove: (e) => {
        const p = touchToPct(e.nativeEvent.locationX, e.nativeEvent.locationY);
        guessPosRef.current = p;
        setGuessPos(p);
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

  const scoreMsgs = ['Raté ! 😬', 'Proche ! 👍', 'Bien ! 🎯', '', 'Très bien ! ⭐', 'Parfait ! 🎉'];
  const scoreColors = [PALETTE.red, PALETTE.coral, PALETTE.amber, '', PALETTE.green, PALETTE.green];

  // ── Actions ──────────────────────────────────────────────────────────────

  const addPlayer = () => {
    if (players.length >= 5) return;
    setPlayers(p => [...p, { name: `Joueur ${p.length + 1}`, score: 0 }]);
  };

  const removePlayer = (i: number) => {
    if (players.length <= 2) return;
    setPlayers(p => p.filter((_, idx) => idx !== i));
  };

  const updateName = (i: number, name: string) =>
    setPlayers(p => p.map((pl, idx) => idx === i ? { ...pl, name } : pl));

  const startGame = () => {
    const reset = players.map(p => ({ ...p, score: 0 }));
    setPlayers(reset);
    setCurrentGiver(0);
    setUsedCards([]);
    nextRound(reset, 0, 0, []);
  };

  const nextRound = (
    pl: Player[], round: number, giver: number, used: number[]
  ) => {
    const nr = round + 1;
    if (nr > totalRounds) { setPhase('end'); return; }

    let idx = Math.floor(Math.random() * CARDS.length);
    while (used.includes(idx) && used.length < CARDS.length)
      idx = Math.floor(Math.random() * CARDS.length);

    setCurrentRound(nr);
    setCurrentCard(CARDS[idx]);
    setTargetPos(10 + Math.floor(Math.random() * 80));
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
    const dist = Math.abs(guessPosRef.current - targetPos);
    let pts = 0;
    if (dist <= ZONE_5) pts = 5;
    else if (dist <= ZONE_3) pts = 3;
    else if (dist <= ZONE_1) pts = 1;

    setPlayers(p => p.map((pl, i) => i !== currentGiver ? { ...pl, score: pl.score + pts } : pl));
    setRoundPoints(pts);
    setGuessPos(guessPosRef.current);
    scoreScale.value = withSequence(
      withTiming(0, { duration: 0 }),
      withSpring(1.2, { damping: 5, stiffness: 180 }),
      withSpring(1.0, { damping: 14 }),
    );
    setPhase('reveal');
  };

  const goNext = () => {
    const ng = (currentGiver + 1) % players.length;
    setCurrentGiver(ng);
    nextRound(players, currentRound, ng, usedCards);
  };

  const restart = () => {
    scoreScale.value = 0;
    setPlayers(p => p.map(pl => ({ ...pl, score: 0 })));
    setPhase('setup');
  };

  // ── Demi-cercle ───────────────────────────────────────────────────────────

  const renderDial = ({
    showTarget = false,
    showCursor = false,
    interactive = false,
  }: { showTarget?: boolean; showCursor?: boolean; interactive?: boolean }) => {
    const cp = arcPos(guessPos);
    const tp = arcPos(targetPos);

    return (
      <View
        style={s.dialContainer}
        {...(interactive ? pan.panHandlers : {})}
      >
        {/* Points colorés sur l'arc */}
        {Array.from({ length: DOT_COUNT }, (_, i) => {
          const pct  = (i / (DOT_COUNT - 1)) * 100;
          const pos  = arcPos(pct);
          const dist = Math.abs(pct - targetPos);
          const zc   = showTarget ? dotZoneColor(dist) : '';
          const col  = zc || spectrumColor(Math.round((i / (DOT_COUNT - 1)) * (SEG - 1)));
          const sz   = (showTarget && zc) ? DOT_SIZE + 4 : DOT_SIZE;
          return (
            <View key={i} style={{
              position: 'absolute',
              left: pos.x - sz / 2,
              top:  pos.y - sz / 2,
              width: sz, height: sz,
              borderRadius: sz / 2,
              backgroundColor: col,
            }} />
          );
        })}

        {/* Etiquettes des concepts */}
        <Text style={[s.dialLabel, s.dialLabelLeft,  { color: PALETTE.blue }]}>{currentCard[0]}</Text>
        <Text style={[s.dialLabel, s.dialLabelRight, { color: PALETTE.red  }]}>{currentCard[1]}</Text>

        {/* Point central */}
        <View style={s.dialPivot} />

        {/* Indicateur de cible (phase indice) */}
        {showTarget && (
          <View style={[s.dialTarget, { left: tp.x - 22, top: tp.y - 22 }]} />
        )}

        {/* Curseur du joueur */}
        {showCursor && (
          <View style={[s.dialCursor, { left: cp.x - CURSOR_SZ / 2, top: cp.y - CURSOR_SZ / 2 }]} />
        )}
      </View>
    );
  };

  // ── Carte concept ─────────────────────────────────────────────────────────

  const renderConcept = () => (
    <View style={s.conceptCard}>
      <Text style={[s.conceptWord, { color: PALETTE.blue }]}>{currentCard[0]}</Text>
      <Text style={s.conceptDiv}>←————→</Text>
      <Text style={[s.conceptWord, { color: PALETTE.red }]}>{currentCard[1]}</Text>
    </View>
  );

  // ── Scores ────────────────────────────────────────────────────────────────

  const sorted = [...players].sort((a, b) => b.score - a.score);

  const renderScores = (suffix = '') =>
    sorted.map((p, i) => {
      const ci = players.findIndex(pl => pl.name === p.name);
      return (
        <View key={i} style={[s.scoreRow, i === 0 && s.scoreRowFirst]}>
          <View style={s.scoreLeft}>
            <Text style={s.medal}>{MEDALS[i]}</Text>
            <View style={[s.avSm, { backgroundColor: PLAYER_COLORS[ci] ?? PALETTE.gray400 }]}>
              <Text style={s.avSmTxt}>{initials(p.name)}</Text>
            </View>
            <Text style={[s.scoreRowName, i === 0 && s.scoreRowNameBig]}>{p.name}</Text>
          </View>
          <Text style={[s.scoreRowPts, i === 0 && s.scoreRowPtsBig]}>
            {p.score}{suffix}
          </Text>
        </View>
      );
    });

  // ── Render ────────────────────────────────────────────────────────────────

  const bg = PHASE_BG[phase] ?? PALETTE.purple;

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: bg }]}>
      <StatusBar barStyle="light-content" backgroundColor={bg} />

      {/* ══════════════════ ACCUEIL ══════════════════ */}
      {phase === 'home' && (
        <Animated.View style={[s.home, homeStyle]}>
          <Animated.Text style={[s.homeEmoji, logoStyle]}>🌊</Animated.Text>
          <Text style={s.homeTitle}>Longueur{'\n'}d'onde</Text>
          <Text style={s.homeSub}>Le jeu qui lit dans les esprits</Text>

          {/* Vague décorative */}
          <View style={s.waveDots}>
            {[0.2, 0.45, 0.7, 0.45, 0.2].map((op, i) => (
              <View key={i} style={[s.waveDot, { opacity: op, transform: [{ scale: 0.6 + op * 0.8 }] }]} />
            ))}
          </View>

          <TouchableOpacity style={s.homeBtn} onPress={() => setPhase('setup')}>
            <Text style={s.homeBtnTxt}>Jouer →</Text>
          </TouchableOpacity>
          <Text style={s.homeFooter}>2 – 5 joueurs</Text>
        </Animated.View>
      )}

      {/* ══════════════════ JEUX ══════════════════ */}
      {phase !== 'home' && (
        <>
          {/* En-tête coloré */}
          <View style={[s.header, { backgroundColor: bg }]}>
            {phase === 'setup'  && <><Text style={s.hTitle}>Configuration</Text><Text style={s.hSub}>Qui joue ? Combien de manches ?</Text></>}
            {phase === 'clue'   && <><Text style={s.hBadge}>MANCHE {currentRound} / {totalRounds}</Text><Text style={s.hTitle}>🎭 {players[currentGiver].name}</Text><Text style={s.hSub}>donne l'indice</Text></>}
            {phase === 'guess'  && <><Text style={s.hBadge}>MANCHE {currentRound} / {totalRounds}</Text><Text style={s.hTitle}>🎯 À vous de jouer !</Text><Text style={s.hSub}>Où se cache la réponse ?</Text></>}
            {phase === 'reveal' && <><Text style={s.hBadge}>MANCHE {currentRound} / {totalRounds}</Text><Text style={s.hTitle}>Résultat</Text></>}
            {phase === 'end'    && <><Text style={s.hEmoji}>🏆</Text><Text style={s.hTitle}>Fin de partie !</Text></>}
          </View>

          {/* Feuille blanche */}
          <View style={s.sheet}>
            <ScrollView
              contentContainerStyle={s.content}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >

              {/* ─── SETUP ─── */}
              {phase === 'setup' && <>
                <Text style={s.label}>JOUEURS</Text>
                {players.map((p, i) => (
                  <View key={i} style={s.playerRow}>
                    <View style={[s.av, { backgroundColor: PLAYER_COLORS[i] }]}>
                      <Text style={s.avTxt}>{initials(p.name)}</Text>
                    </View>
                    <TextInput
                      style={s.playerInput}
                      value={p.name}
                      onChangeText={t => updateName(i, t)}
                      placeholder={`Joueur ${i + 1}`}
                      placeholderTextColor={PALETTE.gray400}
                    />
                    {players.length > 2 && (
                      <TouchableOpacity style={s.removeBtn} onPress={() => removePlayer(i)}>
                        <Text style={s.removeTxt}>✕</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                {players.length < 5 && (
                  <TouchableOpacity style={s.addBtn} onPress={addPlayer}>
                    <Text style={s.addTxt}>+ Ajouter un joueur</Text>
                  </TouchableOpacity>
                )}

                <Text style={[s.label, { marginTop: 28 }]}>NOMBRE DE MANCHES</Text>
                <View style={s.counter}>
                  <TouchableOpacity
                    style={s.counterBtn}
                    onPress={() => setTotalRounds(r => Math.max(3, r - 1))}
                  >
                    <Text style={s.counterBtnTxt}>−</Text>
                  </TouchableOpacity>
                  <Text style={s.counterVal}>{totalRounds}</Text>
                  <TouchableOpacity
                    style={s.counterBtn}
                    onPress={() => setTotalRounds(r => Math.min(30, r + 1))}
                  >
                    <Text style={s.counterBtnTxt}>+</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[s.bigBtn, { backgroundColor: PALETTE.purple, marginTop: 36 }]}
                  onPress={startGame}
                >
                  <Text style={s.bigBtnTxt}>Commencer la partie →</Text>
                </TouchableOpacity>
              </>}

              {/* ─── INDICE ─── */}
              {phase === 'clue' && <>
                {renderConcept()}
                <View style={s.hintBox}>
                  <Text style={s.hintTxt}>
                    La cible est <Text style={s.hintBold}>{getHint()}</Text>
                    {' '}({Math.round(targetPos)} %)
                  </Text>
                </View>
                {renderDial({ showTarget: true })}
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
                  <Text style={s.bigBtnTxt}>Passer le téléphone →</Text>
                </TouchableOpacity>
              </>}

              {/* ─── DEVINETTE ─── */}
              {phase === 'guess' && <>
                {renderConcept()}
                <View style={s.clueBox}>
                  <Text style={s.clueBoxLbl}>L'INDICE</Text>
                  <Text style={s.clueBoxTxt}>"{clue}"</Text>
                </View>
                <Text style={s.guideTxt}>Touchez et glissez sur le demi-cercle</Text>
                {renderDial({ showCursor: true, interactive: true })}
                <TouchableOpacity
                  style={[s.bigBtn, { backgroundColor: PALETTE.teal, marginTop: 8 }]}
                  onPress={submitGuess}
                >
                  <Text style={s.bigBtnTxt}>Valider ma position →</Text>
                </TouchableOpacity>
              </>}

              {/* ─── RÉVÉLATION ─── */}
              {phase === 'reveal' && <>
                {renderConcept()}
                <View style={s.clueBox}>
                  <Text style={s.clueBoxLbl}>L'INDICE</Text>
                  <Text style={s.clueBoxTxt}>"{clue}"</Text>
                </View>
                {renderDial({ showTarget: true, showCursor: true })}
                <Animated.View style={[s.scoreReveal, scoreStyle]}>
                  <Text style={[s.scoreNum, { color: scoreColors[roundPoints] || PALETTE.amber }]}>
                    +{roundPoints}
                  </Text>
                  <Text style={s.scoreMsg}>{scoreMsgs[roundPoints]}</Text>
                </Animated.View>
                <Text style={s.label}>SCORES</Text>
                {renderScores()}
                <TouchableOpacity
                  style={[s.bigBtn, { backgroundColor: PALETTE.amber, marginTop: 24 }]}
                  onPress={goNext}
                >
                  <Text style={s.bigBtnTxt}>
                    {currentRound >= totalRounds ? 'Voir les résultats →' : 'Manche suivante →'}
                  </Text>
                </TouchableOpacity>
              </>}

              {/* ─── FIN ─── */}
              {phase === 'end' && <>
                <Text style={s.label}>CLASSEMENT FINAL</Text>
                {renderScores(' pts')}
                <TouchableOpacity
                  style={[s.bigBtn, { backgroundColor: PALETTE.purple, marginTop: 36 }]}
                  onPress={restart}
                >
                  <Text style={s.bigBtnTxt}>Rejouer 🎮</Text>
                </TouchableOpacity>
              </>}

            </ScrollView>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1 },

  // ── Accueil ──
  home: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  homeEmoji: { fontSize: 72, marginBottom: 12 },
  homeTitle: {
    fontSize: 40,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
    lineHeight: 46,
    marginBottom: 12,
  },
  homeSub: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.72)',
    textAlign: 'center',
    marginBottom: 36,
  },
  waveDots: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    marginBottom: 40,
  },
  waveDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  homeBtn: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 52,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: 20,
  },
  homeBtnTxt: {
    color: PALETTE.purple,
    fontSize: 20,
    fontWeight: '800',
  },
  homeFooter: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
  },

  // ── Header ──
  header: {
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 28,
    alignItems: 'center',
  },
  hEmoji:  { fontSize: 44, marginBottom: 4 },
  hBadge:  { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.62)', letterSpacing: 1.8, marginBottom: 4 },
  hTitle:  { fontSize: 24, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: 4 },
  hSub:    { fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },

  // ── Feuille ──
  sheet: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  content: { padding: 24, paddingBottom: 64 },

  // ── Labels ──
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: PALETTE.gray400,
    letterSpacing: 1.6,
    marginBottom: 12,
  },

  // ── Joueurs ──
  playerRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  av: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
  },
  avTxt:       { color: '#fff', fontWeight: '800', fontSize: 17 },
  playerInput: {
    flex: 1,
    backgroundColor: PALETTE.gray100,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: PALETTE.dark,
  },
  removeBtn:   { width: 38, height: 38, borderRadius: 19, backgroundColor: PALETTE.gray100, alignItems: 'center', justifyContent: 'center' },
  removeTxt:   { color: PALETTE.gray600, fontSize: 13, fontWeight: '700' },
  addBtn:      { borderWidth: 1.5, borderColor: PALETTE.gray200, borderStyle: 'dashed', borderRadius: 12, padding: 13, alignItems: 'center', marginTop: 2 },
  addTxt:      { color: PALETTE.gray600, fontSize: 14, fontWeight: '500' },

  // ── Compteur manches ──
  counter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
  },
  counterBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: PALETTE.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterBtnTxt: { fontSize: 26, fontWeight: '300', color: PALETTE.dark },
  counterVal:    { fontSize: 48, fontWeight: '800', color: PALETTE.dark, width: 90, textAlign: 'center' },

  // ── Bouton principal ──
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
  bigBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },

  // ── Carte concept ──
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
  conceptWord: { fontSize: 18, fontWeight: '800', flex: 1, textAlign: 'center' },
  conceptDiv:  { fontSize: 12, color: PALETTE.gray400, paddingHorizontal: 6 },

  // ── Boîte indice ──
  hintBox: {
    backgroundColor: PALETTE.blueLight,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  hintTxt:  { fontSize: 13, color: PALETTE.blueDark, textAlign: 'center' },
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

  clueBox: {
    backgroundColor: PALETTE.tealLight,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    alignItems: 'center',
  },
  clueBoxLbl: { fontSize: 10, fontWeight: '700', color: PALETTE.teal, letterSpacing: 1.6, marginBottom: 4 },
  clueBoxTxt: { fontSize: 22, fontWeight: '800', color: PALETTE.tealDark },

  guideTxt: { fontSize: 13, color: PALETTE.gray400, textAlign: 'center', marginBottom: 8 },

  // ── Demi-cercle ──
  dialContainer: {
    width: DIAL_W,
    height: DIAL_R + CURSOR_SZ + 28,
    position: 'relative',
    alignSelf: 'center',
    marginBottom: 12,
  },
  dialLabel:      { position: 'absolute', fontSize: 13, fontWeight: '800', bottom: 0 },
  dialLabelLeft:  { left: 0 },
  dialLabelRight: { right: 0 },
  dialPivot: {
    position: 'absolute',
    left: DIAL_R - 5,
    top:  DIAL_R - 5,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: PALETTE.gray400,
  },
  dialTarget: {
    position: 'absolute',
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 3.5,
    borderColor: '#fff',
  },
  dialCursor: {
    position: 'absolute',
    width: CURSOR_SZ, height: CURSOR_SZ, borderRadius: CURSOR_SZ / 2,
    backgroundColor: PALETTE.dark,
    borderWidth: 3.5,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 5,
    elevation: 6,
  },

  // ── Révélation score ──
  scoreReveal: { alignItems: 'center', paddingVertical: 24 },
  scoreNum:    { fontSize: 84, fontWeight: '900', lineHeight: 90 },
  scoreMsg:    { fontSize: 18, color: PALETTE.gray600, marginTop: 4, fontWeight: '600' },

  // ── Tableau des scores ──
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
    paddingVertical: 12,
    borderBottomWidth: 0,
    marginBottom: 6,
  },
  scoreLeft:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  medal:           { fontSize: 20, width: 26 },
  avSm:            { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  avSmTxt:         { color: '#fff', fontWeight: '700', fontSize: 13 },
  scoreRowName:    { fontSize: 15, color: PALETTE.dark, fontWeight: '500' },
  scoreRowNameBig: { fontWeight: '800', fontSize: 16 },
  scoreRowPts:     { fontSize: 20, fontWeight: '700', color: PALETTE.dark },
  scoreRowPtsBig:  { fontSize: 24, color: PALETTE.purple },
});

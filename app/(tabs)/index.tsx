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

// ── Dimensions ────────────────────────────────────────────────────────────────
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DIAL_W    = SCREEN_WIDTH - 48;
const DIAL_R    = DIAL_W / 2;

// ── Cadran : constantes ────────────────────────────────────────────────────────
const N_SEC      = 14;                          // nombre de secteurs
const SEC_DEG    = 180 / N_SEC;                 // degrés par secteur
const SEC_H      = 2 * DIAL_R * Math.tan((SEC_DEG / 2) * Math.PI / 180) * 0.84;
const NEEDLE_W   = 7;
const NEEDLE_L   = DIAL_R * 0.70;
const PIVOT_R    = 11;
const INNER_R    = DIAL_R * 0.30;               // rayon du hub sombre central
const LABEL_H    = 34;
const DIAL_H     = DIAL_R + PIVOT_R + LABEL_H;  // hauteur totale du composant

// ── Zones de score ─────────────────────────────────────────────────────────────
const ZONE_5 = 2.5;
const ZONE_3 = 10;
const ZONE_1 = 15;

// ── Géométrie ──────────────────────────────────────────────────────────────────
// 0 % = gauche (angle π), 100 % = droite (angle 0)
function pctToAngle(pct: number): number {
  return (1 - pct / 100) * Math.PI;
}

function arcPos(pct: number, r: number): { x: number; y: number } {
  const θ = pctToAngle(pct);
  return { x: DIAL_R + r * Math.cos(θ), y: DIAL_R - r * Math.sin(θ) };
}

function touchToPct(tx: number, ty: number): number {
  const dx = tx - DIAL_R;
  const dy = DIAL_R - ty;
  let θ = Math.atan2(dy, dx);
  if (θ < 0) θ = dx < 0 ? Math.PI : 0;
  return Math.max(1, Math.min(99, (1 - Math.min(Math.PI, θ) / Math.PI) * 100));
}

// Couleur d'un secteur i (gauche=cyan, droite=rouge)
function secColor(i: number): string {
  const hue = Math.round(185 - (i / (N_SEC - 1)) * 185);
  return `hsl(${hue}, 90%, 56%)`;
}

// Couleur de zone
function zoneColor(dist: number): string {
  if (dist <= ZONE_5) return '#4ADE80';
  if (dist <= ZONE_3) return '#FACC15';
  if (dist <= ZONE_1) return '#FB923C';
  return '';
}

// ── Cartes ─────────────────────────────────────────────────────────────────────
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

const STARS = [
  { x: DIAL_R * 0.38, y: DIAL_R * 0.18, r: 2.5 },
  { x: DIAL_R * 0.58, y: DIAL_R * 0.08, r: 1.5 },
  { x: DIAL_R * 0.72, y: DIAL_R * 0.30, r: 2 },
  { x: DIAL_R * 1.28, y: DIAL_R * 0.12, r: 2 },
  { x: DIAL_R * 1.48, y: DIAL_R * 0.35, r: 1.5 },
  { x: DIAL_R * 1.62, y: DIAL_R * 0.20, r: 2.5 },
  { x: DIAL_R * 0.50, y: DIAL_R * 0.55, r: 1.5 },
  { x: DIAL_R * 1.50, y: DIAL_R * 0.60, r: 1.5 },
];

type Phase = 'home' | 'setup' | 'clue' | 'guess' | 'reveal' | 'end';
type Player = { name: string; score: number };
const MEDALS = ['🥇', '🥈', '🥉', '🏅', '🏅'];

// ── Composant principal ────────────────────────────────────────────────────────
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
      ), -1, false,
    );
  }, []);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: (e) => {
        const p = touchToPct(e.nativeEvent.locationX, e.nativeEvent.locationY);
        guessPosRef.current = p; setGuessPos(p);
      },
      onPanResponderMove: (e) => {
        const p = touchToPct(e.nativeEvent.locationX, e.nativeEvent.locationY);
        guessPosRef.current = p; setGuessPos(p);
      },
    })
  ).current;

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const initials = (name: string) => name.trim().charAt(0).toUpperCase();
  const getHint  = () => targetPos < 30 ? 'plutôt à gauche' : targetPos > 70 ? 'plutôt à droite' : 'vers le centre';

  const scoreMsgs   = ['Raté ! 😬', 'Proche ! 👍', 'Bien ! 🎯', '', 'Très bien ! ⭐', 'Parfait ! 🎉'];
  const scoreColors = [PALETTE.red, PALETTE.coral, PALETTE.amber, PALETTE.amber, PALETTE.green, PALETTE.green];

  // ── Actions ───────────────────────────────────────────────────────────────────
  const addPlayer    = () => { if (players.length < 5) setPlayers(p => [...p, { name: `Joueur ${p.length + 1}`, score: 0 }]); };
  const removePlayer = (i: number) => { if (players.length > 2) setPlayers(p => p.filter((_, idx) => idx !== i)); };
  const updateName   = (i: number, name: string) => setPlayers(p => p.map((pl, idx) => idx === i ? { ...pl, name } : pl));

  const startGame = () => {
    const reset = players.map(p => ({ ...p, score: 0 }));
    setPlayers(reset); setCurrentGiver(0); setUsedCards([]);
    nextRound(reset, 0, 0, []);
  };

  const nextRound = (pl: Player[], round: number, giver: number, used: number[]) => {
    const nr = round + 1;
    if (nr > totalRounds) { setPhase('end'); return; }
    let idx = Math.floor(Math.random() * CARDS.length);
    while (used.includes(idx) && used.length < CARDS.length) idx = Math.floor(Math.random() * CARDS.length);
    setCurrentRound(nr); setCurrentCard(CARDS[idx]);
    setTargetPos(10 + Math.floor(Math.random() * 80));
    setGuessPos(50); guessPosRef.current = 50; setClue('');
    setUsedCards([...used, idx]); setPhase('clue');
  };

  const submitClue = () => { if (clue.trim()) setPhase('guess'); };

  const submitGuess = () => {
    const dist = Math.abs(guessPosRef.current - targetPos);
    let pts = 0;
    if (dist <= ZONE_5) pts = 5;
    else if (dist <= ZONE_3) pts = 3;
    else if (dist <= ZONE_1) pts = 1;
    setPlayers(p => p.map((pl, i) => i !== currentGiver ? { ...pl, score: pl.score + pts } : pl));
    setRoundPoints(pts); setGuessPos(guessPosRef.current);
    scoreScale.value = withSequence(
      withTiming(0, { duration: 0 }),
      withSpring(1.2, { damping: 5, stiffness: 180 }),
      withSpring(1.0, { damping: 14 }),
    );
    setPhase('reveal');
  };

  const goNext = () => {
    const ng = (currentGiver + 1) % players.length;
    setCurrentGiver(ng); nextRound(players, currentRound, ng, usedCards);
  };

  const restart = () => { scoreScale.value = 0; setPlayers(p => p.map(pl => ({ ...pl, score: 0 }))); setPhase('setup'); };

  // ── Cadran (demi-cercle style jaugeur) ────────────────────────────────────────
  const renderDial = ({
    showTarget  = false,
    showCursor  = false,
    interactive = false,
  }: { showTarget?: boolean; showCursor?: boolean; interactive?: boolean }) => {
    // needleAngle : -90° = gauche, 0° = haut, +90° = droite
    const needleAngle = (guessPos / 100 - 0.5) * 180;
    // Position du bout de l'aiguille
    const tip = arcPos(guessPos, NEEDLE_L);

    return (
      <View
        style={{ width: DIAL_W, height: DIAL_H, alignSelf: 'center', marginBottom: 12 }}
        {...(interactive ? pan.panHandlers : {})}
      >
        {/* ── Fond sombre + secteurs (overflow hidden pour clipper au demi-cercle) ── */}
        <View style={{
          position: 'absolute', left: 0, top: 0,
          width: DIAL_W, height: DIAL_R + PIVOT_R,
          borderTopLeftRadius: DIAL_R, borderTopRightRadius: DIAL_R,
          backgroundColor: '#0B1628',
          overflow: 'hidden',
        }}>

          {/* Secteurs colorés */}
          {Array.from({ length: N_SEC }, (_, i) => {
            const cssRot = -180 + (i + 0.5) * SEC_DEG;
            return (
              <View key={i} style={{
                position: 'absolute',
                left: DIAL_R, top: DIAL_R - SEC_H / 2,
                width: DIAL_R, height: SEC_H,
                backgroundColor: secColor(i),
                // @ts-ignore — RN 0.81 supporte transformOrigin
                transformOrigin: 'left center',
                transform: [{ rotate: `${cssRot}deg` }],
              }} />
            );
          })}

          {/* Points de zone (phase indice) */}
          {showTarget && Array.from({ length: 100 }, (_, i) => {
            const pct  = (i / 99) * 100;
            const dist = Math.abs(pct - targetPos);
            const zc   = zoneColor(dist);
            if (!zc) return null;
            const pos  = arcPos(pct, DIAL_R * 0.90);
            const sz   = dist <= ZONE_5 ? 12 : dist <= ZONE_3 ? 9 : 7;
            return (
              <View key={`z${i}`} style={{
                position: 'absolute',
                left: pos.x - sz / 2, top: pos.y - sz / 2,
                width: sz, height: sz, borderRadius: sz / 2,
                backgroundColor: zc,
              }} />
            );
          })}

          {/* Hub sombre central (masque le centre des secteurs) */}
          <View style={{
            position: 'absolute',
            left: DIAL_R - INNER_R, top: DIAL_R - INNER_R,
            width: INNER_R * 2, height: INNER_R * 2, borderRadius: INNER_R,
            backgroundColor: '#0B1628',
          }} />

          {/* Étoiles décoratives */}
          {STARS.map((star, i) => (
            <View key={`s${i}`} style={{
              position: 'absolute',
              left: star.x - star.r / 2, top: star.y - star.r / 2,
              width: star.r, height: star.r, borderRadius: star.r / 2,
              backgroundColor: 'rgba(255,255,255,0.85)',
            }} />
          ))}

          {/* Aiguille — rotation autour du bas (pivot) */}
          {showCursor && (
            <View style={{
              position: 'absolute',
              left: DIAL_R - NEEDLE_W / 2,
              top: DIAL_R - NEEDLE_L,
              width: NEEDLE_W, height: NEEDLE_L,
              backgroundColor: '#E2E8F0',
              borderRadius: NEEDLE_W / 2,
              // @ts-ignore
              transformOrigin: 'bottom',
              transform: [{ rotate: `${needleAngle}deg` }],
            }} />
          )}

          {/* Bout de l'aiguille */}
          {showCursor && (
            <View style={{
              position: 'absolute',
              left: tip.x - 7, top: tip.y - 7,
              width: 14, height: 14, borderRadius: 7,
              backgroundColor: '#fff',
              borderWidth: 2,
              borderColor: '#94A3B8',
            }} />
          )}

          {/* Pivot rouge */}
          <View style={{
            position: 'absolute',
            left: DIAL_R - PIVOT_R, top: DIAL_R - PIVOT_R,
            width: PIVOT_R * 2, height: PIVOT_R * 2, borderRadius: PIVOT_R,
            backgroundColor: '#EF4444',
            borderWidth: 2, borderColor: '#fff',
          }} />
        </View>

        {/* Étiquettes des concepts */}
        <Text style={[s.dialLbl, s.dialLblL, { top: DIAL_R + PIVOT_R + 6, color: PALETTE.blue }]}>
          {currentCard[0]}
        </Text>
        <Text style={[s.dialLbl, s.dialLblR, { top: DIAL_R + PIVOT_R + 6, color: PALETTE.red }]}>
          {currentCard[1]}
        </Text>
      </View>
    );
  };

  // ── Carte concept ──────────────────────────────────────────────────────────────
  const renderConcept = () => (
    <View style={s.conceptCard}>
      <Text style={[s.conceptWord, { color: PALETTE.blue }]}>{currentCard[0]}</Text>
      <Text style={s.conceptDiv}>←————→</Text>
      <Text style={[s.conceptWord, { color: PALETTE.red }]}>{currentCard[1]}</Text>
    </View>
  );

  // ── Scores ─────────────────────────────────────────────────────────────────────
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const renderScores = (suffix = '') => sorted.map((p, i) => {
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
        <Text style={[s.scoreRowPts, i === 0 && s.scoreRowPtsBig]}>{p.score}{suffix}</Text>
      </View>
    );
  });

  // ── Render ─────────────────────────────────────────────────────────────────────
  const bg = PHASE_BG[phase] ?? PALETTE.purple;

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: bg }]}>
      <StatusBar barStyle="light-content" backgroundColor={bg} />

      {/* ═══ ACCUEIL ═══ */}
      {phase === 'home' && (
        <Animated.View style={[s.home, homeStyle]}>
          <Animated.Text style={[s.homeEmoji, logoStyle]}>🌊</Animated.Text>
          <Text style={s.homeTitle}>Longueur{'\n'}d'onde</Text>
          <Text style={s.homeSub}>Le jeu qui lit dans les esprits</Text>
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

      {/* ═══ JEUX ═══ */}
      {phase !== 'home' && (
        <>
          <View style={[s.header, { backgroundColor: bg }]}>
            {phase === 'setup'  && <><Text style={s.hTitle}>Configuration</Text><Text style={s.hSub}>Qui joue ? Combien de manches ?</Text></>}
            {phase === 'clue'   && <><Text style={s.hBadge}>MANCHE {currentRound} / {totalRounds}</Text><Text style={s.hTitle}>🎭 {players[currentGiver].name}</Text><Text style={s.hSub}>donne l'indice</Text></>}
            {phase === 'guess'  && <><Text style={s.hBadge}>MANCHE {currentRound} / {totalRounds}</Text><Text style={s.hTitle}>🎯 À vous de jouer !</Text><Text style={s.hSub}>Touchez le cadran pour placer l'aiguille</Text></>}
            {phase === 'reveal' && <><Text style={s.hBadge}>MANCHE {currentRound} / {totalRounds}</Text><Text style={s.hTitle}>Résultat</Text></>}
            {phase === 'end'    && <><Text style={s.hEmoji}>🏆</Text><Text style={s.hTitle}>Fin de partie !</Text></>}
          </View>

          <View style={s.sheet}>
            <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

              {/* SETUP */}
              {phase === 'setup' && <>
                <Text style={s.label}>JOUEURS</Text>
                {players.map((p, i) => (
                  <View key={i} style={s.playerRow}>
                    <View style={[s.av, { backgroundColor: PLAYER_COLORS[i] }]}>
                      <Text style={s.avTxt}>{initials(p.name)}</Text>
                    </View>
                    <TextInput style={s.playerInput} value={p.name} onChangeText={t => updateName(i, t)} placeholder={`Joueur ${i + 1}`} placeholderTextColor={PALETTE.gray400} />
                    {players.length > 2 && <TouchableOpacity style={s.removeBtn} onPress={() => removePlayer(i)}><Text style={s.removeTxt}>✕</Text></TouchableOpacity>}
                  </View>
                ))}
                {players.length < 5 && <TouchableOpacity style={s.addBtn} onPress={addPlayer}><Text style={s.addTxt}>+ Ajouter un joueur</Text></TouchableOpacity>}

                <Text style={[s.label, { marginTop: 28 }]}>NOMBRE DE MANCHES</Text>
                <View style={s.counter}>
                  <TouchableOpacity style={s.counterBtn} onPress={() => setTotalRounds(r => Math.max(3, r - 1))}>
                    <Text style={s.counterBtnTxt}>−</Text>
                  </TouchableOpacity>
                  <Text style={s.counterVal}>{totalRounds}</Text>
                  <TouchableOpacity style={s.counterBtn} onPress={() => setTotalRounds(r => Math.min(30, r + 1))}>
                    <Text style={s.counterBtnTxt}>+</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={[s.bigBtn, { backgroundColor: PALETTE.purple, marginTop: 36 }]} onPress={startGame}>
                  <Text style={s.bigBtnTxt}>Commencer la partie →</Text>
                </TouchableOpacity>
              </>}

              {/* INDICE */}
              {phase === 'clue' && <>
                {renderConcept()}
                <View style={s.hintBox}>
                  <Text style={s.hintTxt}>La cible est <Text style={s.hintBold}>{getHint()}</Text> ({Math.round(targetPos)} %)</Text>
                </View>
                {renderDial({ showTarget: true })}
                <Text style={s.label}>VOTRE INDICE</Text>
                <TextInput style={s.clueInput} value={clue} onChangeText={setClue} placeholder="Un mot ou une courte phrase..." placeholderTextColor={PALETTE.gray400} maxLength={40} autoFocus />
                <TouchableOpacity style={[s.bigBtn, { backgroundColor: PALETTE.blue }]} onPress={submitClue}>
                  <Text style={s.bigBtnTxt}>Passer le téléphone →</Text>
                </TouchableOpacity>
              </>}

              {/* DEVINETTE */}
              {phase === 'guess' && <>
                {renderConcept()}
                <View style={s.clueBox}>
                  <Text style={s.clueBoxLbl}>L'INDICE</Text>
                  <Text style={s.clueBoxTxt}>"{clue}"</Text>
                </View>
                {renderDial({ showCursor: true, interactive: true })}
                <TouchableOpacity style={[s.bigBtn, { backgroundColor: PALETTE.teal, marginTop: 8 }]} onPress={submitGuess}>
                  <Text style={s.bigBtnTxt}>Valider ma position →</Text>
                </TouchableOpacity>
              </>}

              {/* RÉVÉLATION */}
              {phase === 'reveal' && <>
                {renderConcept()}
                <View style={s.clueBox}>
                  <Text style={s.clueBoxLbl}>L'INDICE</Text>
                  <Text style={s.clueBoxTxt}>"{clue}"</Text>
                </View>
                {renderDial({ showTarget: true, showCursor: true })}
                <Animated.View style={[s.scoreReveal, scoreStyle]}>
                  <Text style={[s.scoreNum, { color: scoreColors[roundPoints] }]}>+{roundPoints}</Text>
                  <Text style={s.scoreMsg}>{scoreMsgs[roundPoints]}</Text>
                </Animated.View>
                <Text style={s.label}>SCORES</Text>
                {renderScores()}
                <TouchableOpacity style={[s.bigBtn, { backgroundColor: PALETTE.amber, marginTop: 24 }]} onPress={goNext}>
                  <Text style={s.bigBtnTxt}>{currentRound >= totalRounds ? 'Voir les résultats →' : 'Manche suivante →'}</Text>
                </TouchableOpacity>
              </>}

              {/* FIN */}
              {phase === 'end' && <>
                <Text style={s.label}>CLASSEMENT FINAL</Text>
                {renderScores(' pts')}
                <TouchableOpacity style={[s.bigBtn, { backgroundColor: PALETTE.purple, marginTop: 36 }]} onPress={restart}>
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

// ── Styles ──────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:  { flex: 1 },

  home:      { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  homeEmoji: { fontSize: 72, marginBottom: 12 },
  homeTitle: { fontSize: 40, fontWeight: '900', color: '#fff', textAlign: 'center', lineHeight: 46, marginBottom: 12 },
  homeSub:   { fontSize: 16, color: 'rgba(255,255,255,0.72)', textAlign: 'center', marginBottom: 36 },
  waveDots:  { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 40 },
  waveDot:   { width: 14, height: 14, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.9)' },
  homeBtn:   { backgroundColor: '#fff', borderRadius: 20, paddingVertical: 18, paddingHorizontal: 52, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 8, marginBottom: 20 },
  homeBtnTxt:{ color: PALETTE.purple, fontSize: 20, fontWeight: '800' },
  homeFooter:{ color: 'rgba(255,255,255,0.5)', fontSize: 13 },

  header:  { paddingHorizontal: 24, paddingTop: 14, paddingBottom: 28, alignItems: 'center' },
  hEmoji:  { fontSize: 44, marginBottom: 4 },
  hBadge:  { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.62)', letterSpacing: 1.8, marginBottom: 4 },
  hTitle:  { fontSize: 24, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: 4 },
  hSub:    { fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },

  sheet:   { flex: 1, backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
  content: { padding: 24, paddingBottom: 64 },

  label:   { fontSize: 11, fontWeight: '700', color: PALETTE.gray400, letterSpacing: 1.6, marginBottom: 12 },

  playerRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  av:          { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  avTxt:       { color: '#fff', fontWeight: '800', fontSize: 17 },
  playerInput: { flex: 1, backgroundColor: PALETTE.gray100, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: PALETTE.dark },
  removeBtn:   { width: 38, height: 38, borderRadius: 19, backgroundColor: PALETTE.gray100, alignItems: 'center', justifyContent: 'center' },
  removeTxt:   { color: PALETTE.gray600, fontSize: 13, fontWeight: '700' },
  addBtn:      { borderWidth: 1.5, borderColor: PALETTE.gray200, borderStyle: 'dashed', borderRadius: 12, padding: 13, alignItems: 'center', marginTop: 2 },
  addTxt:      { color: PALETTE.gray600, fontSize: 14, fontWeight: '500' },

  counter:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  counterBtn:    { width: 52, height: 52, borderRadius: 26, backgroundColor: PALETTE.gray100, alignItems: 'center', justifyContent: 'center' },
  counterBtnTxt: { fontSize: 26, fontWeight: '300', color: PALETTE.dark },
  counterVal:    { fontSize: 48, fontWeight: '800', color: PALETTE.dark, width: 90, textAlign: 'center' },

  bigBtn:    { borderRadius: 16, padding: 17, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 8, elevation: 5 },
  bigBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },

  conceptCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: PALETTE.gray100, borderRadius: 18, paddingHorizontal: 20, paddingVertical: 18, marginBottom: 16 },
  conceptWord: { fontSize: 18, fontWeight: '800', flex: 1, textAlign: 'center' },
  conceptDiv:  { fontSize: 12, color: PALETTE.gray400, paddingHorizontal: 6 },

  hintBox:  { backgroundColor: PALETTE.blueLight, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16 },
  hintTxt:  { fontSize: 13, color: PALETTE.blueDark, textAlign: 'center' },
  hintBold: { fontWeight: '800' },

  clueInput: { backgroundColor: PALETTE.gray100, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 17, color: PALETTE.dark, marginBottom: 16 },

  clueBox:    { backgroundColor: PALETTE.tealLight, borderRadius: 14, padding: 14, marginBottom: 16, alignItems: 'center' },
  clueBoxLbl: { fontSize: 10, fontWeight: '700', color: PALETTE.teal, letterSpacing: 1.6, marginBottom: 4 },
  clueBoxTxt: { fontSize: 22, fontWeight: '800', color: PALETTE.tealDark },

  // Cadran
  dialLbl:  { position: 'absolute', fontSize: 13, fontWeight: '800' },
  dialLblL: { left: 0 },
  dialLblR: { right: 0 },

  scoreReveal: { alignItems: 'center', paddingVertical: 24 },
  scoreNum:    { fontSize: 84, fontWeight: '900', lineHeight: 90 },
  scoreMsg:    { fontSize: 18, color: PALETTE.gray600, marginTop: 4, fontWeight: '600' },

  scoreRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: PALETTE.gray100 },
  scoreRowFirst:   { backgroundColor: PALETTE.purpleLight, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 0, marginBottom: 6 },
  scoreLeft:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  medal:           { fontSize: 20, width: 26 },
  avSm:            { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  avSmTxt:         { color: '#fff', fontWeight: '700', fontSize: 13 },
  scoreRowName:    { fontSize: 15, color: PALETTE.dark, fontWeight: '500' },
  scoreRowNameBig: { fontWeight: '800', fontSize: 16 },
  scoreRowPts:     { fontSize: 20, fontWeight: '700', color: PALETTE.dark },
  scoreRowPtsBig:  { fontSize: 24, color: PALETTE.purple },
});

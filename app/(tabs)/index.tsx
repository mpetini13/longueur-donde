import React, { useEffect, useRef, useState } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
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
const DIAL_W   = SCREEN_WIDTH - 48;
const DIAL_R   = DIAL_W / 2;

// ── Cadran ────────────────────────────────────────────────────────────────────
const N_SEC    = 14;
const SEC_DEG  = 180 / N_SEC;
const SEC_H    = 2 * DIAL_R * Math.tan((SEC_DEG / 2) * Math.PI / 180) * 0.84;
const SEC_PCT  = 100 / N_SEC;
const NEEDLE_W = 7;
const NEEDLE_L = DIAL_R * 0.70;
const PIVOT_R  = 11;
const INNER_R  = DIAL_R * 0.30;
const LABEL_H  = 34;
const DIAL_H   = DIAL_R + PIVOT_R + LABEL_H;

// ── Zones ─────────────────────────────────────────────────────────────────────
const ZONE_5 = 2.5;
const ZONE_3 = 10;
const ZONE_1 = 15;

// ── Géométrie ─────────────────────────────────────────────────────────────────
function pctToAngle(pct: number): number {
  return (1 - pct / 100) * Math.PI;
}
function arcPos(pct: number, r: number) {
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

// Couleur d'un secteur (sombre par défaut, coloré si showTarget et proche de la cible)
function secColor(i: number, targetPct: number, showTarget: boolean): string {
  const DARK = '#14243A';
  if (!showTarget) return DARK;
  const center = (i + 0.5) * SEC_PCT;
  const dist   = Math.abs(center - targetPct);
  if (dist <= ZONE_5 + SEC_PCT / 2) return '#EF4444';
  if (dist <= ZONE_3 + SEC_PCT / 2) return '#F97316';
  if (dist <= ZONE_1 + SEC_PCT / 2) return '#EAB308';
  return DARK;
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
  ['Rapide', 'Économique'], ['Étrange', 'Normal'], ['Célèbre', 'Anonyme'], ['Doux', 'Épicé'],
];

const STARS = [
  { x: DIAL_R * 0.38, y: DIAL_R * 0.18, r: 2.5 },
  { x: DIAL_R * 0.58, y: DIAL_R * 0.08, r: 1.5 },
  { x: DIAL_R * 0.72, y: DIAL_R * 0.30, r: 2   },
  { x: DIAL_R * 1.28, y: DIAL_R * 0.12, r: 2   },
  { x: DIAL_R * 1.48, y: DIAL_R * 0.35, r: 1.5 },
  { x: DIAL_R * 1.62, y: DIAL_R * 0.20, r: 2.5 },
  { x: DIAL_R * 0.50, y: DIAL_R * 0.55, r: 1.5 },
  { x: DIAL_R * 1.50, y: DIAL_R * 0.60, r: 1.5 },
];

// ── Confettis ─────────────────────────────────────────────────────────────────
const CONFETTI_COLORS = ['#EF4444','#F97316','#EAB308','#22C55E','#3B82F6','#8B5CF6','#EC4899'];
const CONFETTI_DATA = Array.from({ length: 16 }, (_, i) => ({
  x:        Math.round((i / 15) * (SCREEN_WIDTH - 14)),
  color:    CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  duration: 1600 + (i % 5) * 380,
  delay:    (i % 5) * 260,
  size:     6 + (i % 3) * 3,
}));

function ConfettiPiece({ x, color, duration, delay, size }: {
  x: number; color: string; duration: number; delay: number; size: number;
}) {
  const y      = useSharedValue(-30);
  const rotate = useSharedValue(0);
  useEffect(() => {
    y.value      = withDelay(delay, withRepeat(withTiming(780, { duration, easing: Easing.linear }), -1));
    rotate.value = withRepeat(withTiming(360, { duration: 900 }), -1);
  }, []);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }, { rotate: `${rotate.value}deg` }],
  }));
  return (
    <Animated.View style={[{
      position: 'absolute', left: x, top: 0,
      width: size, height: size + 4,
      backgroundColor: color, borderRadius: 2,
    }, style]} />
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────
type Phase = 'home' | 'rules' | 'setup' | 'clue' | 'handoff' | 'guess' | 'reveal' | 'end';
type Player      = { name: string; score: number };
type RoundRecord = { card: [string, string]; clue: string; pts: number; giver: string; bonus: boolean };

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
  const [clue, setClue]                 = useState('');
  const [roundPoints, setRoundPoints]   = useState(0);
  const [teamBonus, setTeamBonus]       = useState(false);
  const [usedCards, setUsedCards]       = useState<number[]>([]);
  const [roundHistory, setRoundHistory] = useState<RoundRecord[]>([]);
  const guessPosRef = useRef(50);

  // ── Animations ──────────────────────────────────────────────────────────────
  const logoScale   = useSharedValue(1);
  const homeOpacity = useSharedValue(0);
  const scoreScale  = useSharedValue(0);
  const needleShared = useSharedValue(50);  // position 0-100 de l'aiguille

  const logoStyle  = useAnimatedStyle(() => ({ transform: [{ scale: logoScale.value }] }));
  const homeStyle  = useAnimatedStyle(() => ({
    opacity: homeOpacity.value,
    transform: [{ translateY: (1 - homeOpacity.value) * 24 }],
  }));
  const scoreStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scoreScale.value }],
    opacity: Math.min(1, scoreScale.value),
  }));
  // Aiguille : rotation avec spring
  const needleRotStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${(needleShared.value / 100 - 0.5) * 180}deg` }],
  }));
  // Bout de l'aiguille : position calculée depuis la valeur animée
  const tipStyle = useAnimatedStyle(() => {
    const θ = pctToAngle(needleShared.value);
    return {
      left: DIAL_R + NEEDLE_L * Math.cos(θ) - 7,
      top:  DIAL_R - NEEDLE_L * Math.sin(θ) - 7,
    };
  });

  useEffect(() => {
    homeOpacity.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) });
    logoScale.value   = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        withTiming(1.0, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
      ), -1, false,
    );
  }, []);

  // ── PanResponder ─────────────────────────────────────────────────────────────
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: (e) => {
        const p = touchToPct(e.nativeEvent.locationX, e.nativeEvent.locationY);
        needleShared.value = withSpring(p, { damping: 14, stiffness: 260 });
        guessPosRef.current = p;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      },
      onPanResponderMove: (e) => {
        const p = touchToPct(e.nativeEvent.locationX, e.nativeEvent.locationY);
        needleShared.value  = p; // direct pour un suivi fluide
        guessPosRef.current = p;
      },
    })
  ).current;

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const initials = (name: string) => name.trim().charAt(0).toUpperCase();
  const getHint  = () =>
    targetPos < 30 ? 'plutôt à gauche' : targetPos > 70 ? 'plutôt à droite' : 'vers le centre';

  const scoreMsgs   = ['Raté ! 😬', 'Proche ! 👍', 'Bien ! 🎯', '', 'Très bien ! ⭐', 'Parfait ! 🎉'];
  const scoreColors = [PALETTE.red, PALETTE.coral, PALETTE.amber, PALETTE.amber, PALETTE.green, PALETTE.green];

  // ── Actions ───────────────────────────────────────────────────────────────────
  const addPlayer    = () => { if (players.length < 5) setPlayers(p => [...p, { name: `Joueur ${p.length + 1}`, score: 0 }]); };
  const removePlayer = (i: number) => { if (players.length > 2) setPlayers(p => p.filter((_, idx) => idx !== i)); };
  const updateName   = (i: number, name: string) =>
    setPlayers(p => p.map((pl, idx) => idx === i ? { ...pl, name } : pl));

  const startGame = () => {
    const reset = players.map(p => ({ ...p, score: 0 }));
    setPlayers(reset); setCurrentGiver(0); setUsedCards([]); setRoundHistory([]);
    nextRound(reset, 0, 0, []);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const nextRound = (pl: Player[], round: number, giver: number, used: number[]) => {
    const nr = round + 1;
    if (nr > totalRounds) { setPhase('end'); return; }
    let idx = Math.floor(Math.random() * CARDS.length);
    while (used.includes(idx) && used.length < CARDS.length) idx = Math.floor(Math.random() * CARDS.length);
    setCurrentRound(nr); setCurrentCard(CARDS[idx]);
    setTargetPos(10 + Math.floor(Math.random() * 80));
    needleShared.value = withSpring(50, { damping: 12, stiffness: 150 });
    guessPosRef.current = 50;
    setClue(''); setUsedCards([...used, idx]); setPhase('clue');
  };

  const submitClue = () => {
    if (!clue.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhase('handoff');
  };

  const submitGuess = () => {
    const dist = Math.abs(guessPosRef.current - targetPos);
    let pts = 0;
    if (dist <= ZONE_5) pts = 5;
    else if (dist <= ZONE_3) pts = 3;
    else if (dist <= ZONE_1) pts = 1;

    const bonus = pts === 5;
    setTeamBonus(bonus);

    setPlayers(p => p.map((pl, i) => {
      if (i !== currentGiver) return { ...pl, score: pl.score + pts + (bonus ? 1 : 0) };
      return bonus ? { ...pl, score: pl.score + 1 } : pl; // giver +1 si bullseye
    }));
    setRoundPoints(pts);
    setRoundHistory(h => [...h, {
      card: currentCard, clue, pts, bonus,
      giver: players[currentGiver].name,
    }]);

    scoreScale.value = withSequence(
      withTiming(0, { duration: 0 }),
      withSpring(1.2, { damping: 5, stiffness: 180 }),
      withSpring(1.0, { damping: 14 }),
    );

    if (bonus) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else if (pts === 0) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    setPhase('reveal');
  };

  const goNext = () => {
    const ng = (currentGiver + 1) % players.length;
    setCurrentGiver(ng);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    nextRound(players, currentRound, ng, usedCards);
  };

  const restart = () => {
    scoreScale.value = 0;
    setPlayers(p => p.map(pl => ({ ...pl, score: 0 })));
    setRoundHistory([]);
    setPhase('setup');
  };

  // ── Cadran ────────────────────────────────────────────────────────────────────
  const renderDial = ({
    showTarget = false, showCursor = false, interactive = false,
  }: { showTarget?: boolean; showCursor?: boolean; interactive?: boolean }) => (
    <View
      style={{ width: DIAL_W, height: DIAL_H, alignSelf: 'center', marginBottom: 12 }}
      {...(interactive ? pan.panHandlers : {})}
    >
      {/* Fond sombre + secteurs (clippé au demi-cercle) */}
      <View style={{
        position: 'absolute', left: 0, top: 0,
        width: DIAL_W, height: DIAL_R + PIVOT_R,
        borderTopLeftRadius: DIAL_R, borderTopRightRadius: DIAL_R,
        backgroundColor: '#14243A', overflow: 'hidden',
      }}>
        {/* Secteurs */}
        {Array.from({ length: N_SEC }, (_, i) => (
          <View key={i} style={{
            position: 'absolute',
            left: DIAL_R, top: DIAL_R - SEC_H / 2,
            width: DIAL_R, height: SEC_H,
            backgroundColor: secColor(i, targetPos, showTarget),
            // @ts-ignore
            transformOrigin: 'left center',
            transform: [{ rotate: `${-180 + (i + 0.5) * SEC_DEG}deg` }],
          }} />
        ))}

        {/* Hub central sombre */}
        <View style={{
          position: 'absolute',
          left: DIAL_R - INNER_R, top: DIAL_R - INNER_R,
          width: INNER_R * 2, height: INNER_R * 2, borderRadius: INNER_R,
          backgroundColor: '#14243A',
        }} />

        {/* Étoiles */}
        {STARS.map((star, i) => (
          <View key={`s${i}`} style={{
            position: 'absolute',
            left: star.x - star.r / 2, top: star.y - star.r / 2,
            width: star.r, height: star.r, borderRadius: star.r / 2,
            backgroundColor: 'rgba(255,255,255,0.85)',
          }} />
        ))}

        {/* Aiguille animée */}
        {showCursor && (
          <Animated.View style={[{
            position: 'absolute',
            left: DIAL_R - NEEDLE_W / 2, top: DIAL_R - NEEDLE_L,
            width: NEEDLE_W, height: NEEDLE_L,
            backgroundColor: '#E2E8F0',
            borderRadius: NEEDLE_W / 2,
            // @ts-ignore
            transformOrigin: 'bottom',
          }, needleRotStyle]} />
        )}

        {/* Bout de l'aiguille (animé indépendamment) */}
        {showCursor && (
          <Animated.View style={[{
            position: 'absolute',
            width: 14, height: 14, borderRadius: 7,
            backgroundColor: '#fff',
            borderWidth: 2, borderColor: '#94A3B8',
          }, tipStyle]} />
        )}

        {/* Pivot rouge */}
        <View style={{
          position: 'absolute',
          left: DIAL_R - PIVOT_R, top: DIAL_R - PIVOT_R,
          width: PIVOT_R * 2, height: PIVOT_R * 2, borderRadius: PIVOT_R,
          backgroundColor: '#EF4444', borderWidth: 2, borderColor: '#fff',
        }} />
      </View>

      {/* Étiquettes */}
      <Text style={[s.dialLbl, s.dialLblL, { top: DIAL_R + PIVOT_R + 6, color: PALETTE.blue }]}>
        {currentCard[0]}
      </Text>
      <Text style={[s.dialLbl, s.dialLblR, { top: DIAL_R + PIVOT_R + 6, color: PALETTE.red }]}>
        {currentCard[1]}
      </Text>
    </View>
  );

  // ── Carte concept ─────────────────────────────────────────────────────────────
  const renderConcept = () => (
    <View style={s.conceptCard}>
      <Text style={[s.conceptWord, { color: PALETTE.blue }]}>{currentCard[0]}</Text>
      <Text style={s.conceptDiv}>←————→</Text>
      <Text style={[s.conceptWord, { color: PALETTE.red }]}>{currentCard[1]}</Text>
    </View>
  );

  // ── Barre de progression ──────────────────────────────────────────────────────
  const renderProgress = () => (
    <View style={s.progressWrap}>
      <View style={s.progressTrack}>
        <View style={[s.progressFill, { width: `${(currentRound / totalRounds) * 100}%` as any }]} />
      </View>
      <Text style={s.progressTxt}>{currentRound}/{totalRounds}</Text>
    </View>
  );

  // ── Scores ────────────────────────────────────────────────────────────────────
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

  // ── Render ────────────────────────────────────────────────────────────────────
  const bg = PHASE_BG[phase] ?? PALETTE.purple;
  const showProgress = phase === 'clue' || phase === 'handoff' || phase === 'guess' || phase === 'reveal';

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
          <TouchableOpacity onPress={() => setPhase('rules')}>
            <Text style={s.homeLinkTxt}>Comment jouer ?</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* ═══ RÈGLES ═══ */}
      {phase === 'rules' && (
        <ScrollView contentContainerStyle={s.rulesContainer}>
          <Text style={s.rulesEmoji}>📖</Text>
          <Text style={s.rulesTitle}>Comment jouer</Text>

          {[
            { n: '1', t: 'Le faiseur d\'indice', d: 'Un joueur voit où la cible se trouve sur le cadran (zone rouge). Les autres ne voient pas.' },
            { n: '2', t: 'Donner un indice', d: 'Le faiseur d\'indice donne un seul mot ou courte phrase pour guider les autres vers la position.' },
            { n: '3', t: 'Passer le téléphone', d: 'Les autres joueurs reçoivent le téléphone. Ils ne doivent pas voir le cadran avant.' },
            { n: '4', t: 'Deviner ensemble', d: 'L\'équipe discute et place l\'aiguille là où elle pense que la cible se trouve.' },
            { n: '5', t: 'Les points', d: 'Bullseye (±2.5%) : 5 pts • Proche (±10%) : 3 pts • Autour (±15%) : 1 pt • Raté : 0 pt' },
            { n: '★', t: 'Bonus Équipe !', d: 'En cas de bullseye, tout le monde gagne +1 pt bonus, y compris le faiseur d\'indice.' },
          ].map((rule, i) => (
            <View key={i} style={s.ruleRow}>
              <View style={s.ruleNum}><Text style={s.ruleNumTxt}>{rule.n}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.ruleTitle}>{rule.t}</Text>
                <Text style={s.ruleDesc}>{rule.d}</Text>
              </View>
            </View>
          ))}

          <TouchableOpacity style={[s.bigBtn, { backgroundColor: PALETTE.purple, marginTop: 32 }]} onPress={() => setPhase('home')}>
            <Text style={s.bigBtnTxt}>Retour à l'accueil</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* ═══ JEUX ═══ */}
      {phase !== 'home' && phase !== 'rules' && (
        <>
          {/* En-tête */}
          <View style={[s.header, { backgroundColor: bg }]}>
            {phase === 'setup'   && <><Text style={s.hTitle}>Configuration</Text><Text style={s.hSub}>Qui joue ? Combien de manches ?</Text></>}
            {phase === 'clue'    && <><Text style={s.hBadge}>MANCHE {currentRound} / {totalRounds}</Text><Text style={s.hTitle}>🎭 {players[currentGiver].name}</Text><Text style={s.hSub}>donne l'indice</Text></>}
            {phase === 'handoff' && <><Text style={s.hBadge}>MANCHE {currentRound} / {totalRounds}</Text><Text style={s.hTitle}>📱 Passez le téléphone</Text></>}
            {phase === 'guess'   && <><Text style={s.hBadge}>MANCHE {currentRound} / {totalRounds}</Text><Text style={s.hTitle}>🎯 À vous de jouer !</Text><Text style={s.hSub}>Touchez le cadran pour placer l'aiguille</Text></>}
            {phase === 'reveal'  && <><Text style={s.hBadge}>MANCHE {currentRound} / {totalRounds}</Text><Text style={s.hTitle}>Résultat</Text></>}
            {phase === 'end'     && <><Text style={s.hEmoji}>🏆</Text><Text style={s.hTitle}>Fin de partie !</Text></>}
            {showProgress && renderProgress()}
          </View>

          {/* Feuille blanche */}
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
                {players.length < 5 && (
                  <TouchableOpacity style={s.addBtn} onPress={addPlayer}><Text style={s.addTxt}>+ Ajouter un joueur</Text></TouchableOpacity>
                )}

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
                  <Text style={s.bigBtnTxt}>Valider l'indice →</Text>
                </TouchableOpacity>
              </>}

              {/* HANDOFF */}
              {phase === 'handoff' && <>
                <View style={s.handoffBox}>
                  <Text style={s.handoffEmoji}>🤫</Text>
                  <Text style={s.handoffTitle}>Passez maintenant le téléphone aux autres joueurs.</Text>
                  <Text style={s.handoffSub}>Ils ne doivent pas avoir vu le cadran.</Text>
                </View>
                <View style={[s.clueBox, { marginBottom: 24 }]}>
                  <Text style={s.clueBoxLbl}>L'INDICE DONNÉ</Text>
                  <Text style={s.clueBoxTxt}>"{clue}"</Text>
                </View>
                <TouchableOpacity style={[s.bigBtn, { backgroundColor: PALETTE.teal }]} onPress={() => setPhase('guess')}>
                  <Text style={s.bigBtnTxt}>✓ Téléphone passé, on joue !</Text>
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
                  {teamBonus && (
                    <View style={s.bonusBadge}>
                      <Text style={s.bonusTxt}>🎯 BONUS ÉQUIPE  +1</Text>
                    </View>
                  )}
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

                {/* Historique des manches */}
                <Text style={[s.label, { marginTop: 28 }]}>RÉCAP DES MANCHES</Text>
                {roundHistory.map((r, i) => (
                  <View key={i} style={s.historyRow}>
                    <View style={s.historyLeft}>
                      <Text style={s.historyNum}>{i + 1}</Text>
                      <View>
                        <Text style={s.historyCard}>{r.card[0]} ↔ {r.card[1]}</Text>
                        <Text style={s.historyClue}>"{r.clue}" <Text style={s.historyGiver}>— {r.giver}</Text></Text>
                      </View>
                    </View>
                    <View style={s.historyRight}>
                      <Text style={[s.historyPts, { color: r.pts >= 4 ? PALETTE.green : r.pts >= 2 ? PALETTE.amber : PALETTE.red }]}>
                        +{r.pts}{r.bonus ? '+1★' : ''}
                      </Text>
                    </View>
                  </View>
                ))}

                <TouchableOpacity style={[s.bigBtn, { backgroundColor: PALETTE.purple, marginTop: 32 }]} onPress={restart}>
                  <Text style={s.bigBtnTxt}>Rejouer 🎮</Text>
                </TouchableOpacity>
              </>}

            </ScrollView>
          </View>

          {/* Confettis sur l'écran de fin */}
          {phase === 'end' && (
            <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
              {CONFETTI_DATA.map((c, i) => <ConfettiPiece key={i} {...c} />)}
            </View>
          )}
        </>
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1 },

  // Accueil
  home:       { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  homeEmoji:  { fontSize: 72, marginBottom: 12 },
  homeTitle:  { fontSize: 40, fontWeight: '900', color: '#fff', textAlign: 'center', lineHeight: 46, marginBottom: 12 },
  homeSub:    { fontSize: 16, color: 'rgba(255,255,255,0.72)', textAlign: 'center', marginBottom: 36 },
  waveDots:   { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 40 },
  waveDot:    { width: 14, height: 14, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.9)' },
  homeBtn:    { backgroundColor: '#fff', borderRadius: 20, paddingVertical: 18, paddingHorizontal: 52, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 8, marginBottom: 20 },
  homeBtnTxt: { color: PALETTE.purple, fontSize: 20, fontWeight: '800' },
  homeLinkTxt:{ color: 'rgba(255,255,255,0.6)', fontSize: 14, textDecorationLine: 'underline' },

  // Règles
  rulesContainer: { padding: 28, paddingBottom: 60 },
  rulesEmoji:     { fontSize: 48, textAlign: 'center', marginBottom: 8 },
  rulesTitle:     { fontSize: 26, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: 28 },
  ruleRow:        { flexDirection: 'row', gap: 14, marginBottom: 20, alignItems: 'flex-start' },
  ruleNum:        { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  ruleNumTxt:     { color: '#fff', fontWeight: '800', fontSize: 14 },
  ruleTitle:      { fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 3 },
  ruleDesc:       { fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 18 },

  // Header
  header:  { paddingHorizontal: 24, paddingTop: 14, paddingBottom: 16, alignItems: 'center' },
  hEmoji:  { fontSize: 44, marginBottom: 4 },
  hBadge:  { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.62)', letterSpacing: 1.8, marginBottom: 4 },
  hTitle:  { fontSize: 24, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: 4 },
  hSub:    { fontSize: 13, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },

  // Barre de progression
  progressWrap:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  progressTrack: { flex: 1, height: 4, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 2, overflow: 'hidden' },
  progressFill:  { height: 4, backgroundColor: '#fff', borderRadius: 2 },
  progressTxt:   { fontSize: 11, color: 'rgba(255,255,255,0.65)', fontWeight: '600', width: 36, textAlign: 'right' },

  // Feuille
  sheet:   { flex: 1, backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
  content: { padding: 24, paddingBottom: 64 },
  label:   { fontSize: 11, fontWeight: '700', color: PALETTE.gray400, letterSpacing: 1.6, marginBottom: 12 },

  // Joueurs
  playerRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  av:          { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  avTxt:       { color: '#fff', fontWeight: '800', fontSize: 17 },
  playerInput: { flex: 1, backgroundColor: PALETTE.gray100, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: PALETTE.dark },
  removeBtn:   { width: 38, height: 38, borderRadius: 19, backgroundColor: PALETTE.gray100, alignItems: 'center', justifyContent: 'center' },
  removeTxt:   { color: PALETTE.gray600, fontSize: 13, fontWeight: '700' },
  addBtn:      { borderWidth: 1.5, borderColor: PALETTE.gray200, borderStyle: 'dashed', borderRadius: 12, padding: 13, alignItems: 'center', marginTop: 2 },
  addTxt:      { color: PALETTE.gray600, fontSize: 14, fontWeight: '500' },

  // Compteur manches
  counter:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  counterBtn:    { width: 52, height: 52, borderRadius: 26, backgroundColor: PALETTE.gray100, alignItems: 'center', justifyContent: 'center' },
  counterBtnTxt: { fontSize: 26, fontWeight: '300', color: PALETTE.dark },
  counterVal:    { fontSize: 48, fontWeight: '800', color: PALETTE.dark, width: 90, textAlign: 'center' },

  // Bouton
  bigBtn:    { borderRadius: 16, padding: 17, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 8, elevation: 5 },
  bigBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },

  // Concept
  conceptCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: PALETTE.gray100, borderRadius: 18, paddingHorizontal: 20, paddingVertical: 18, marginBottom: 16 },
  conceptWord: { fontSize: 18, fontWeight: '800', flex: 1, textAlign: 'center' },
  conceptDiv:  { fontSize: 12, color: PALETTE.gray400, paddingHorizontal: 6 },

  // Indice
  hintBox:  { backgroundColor: PALETTE.blueLight, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16 },
  hintTxt:  { fontSize: 13, color: PALETTE.blueDark, textAlign: 'center' },
  hintBold: { fontWeight: '800' },
  clueInput:{ backgroundColor: PALETTE.gray100, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 17, color: PALETTE.dark, marginBottom: 16 },

  // Handoff
  handoffBox:   { alignItems: 'center', paddingVertical: 28 },
  handoffEmoji: { fontSize: 56, marginBottom: 14 },
  handoffTitle: { fontSize: 18, fontWeight: '700', color: PALETTE.dark, textAlign: 'center', marginBottom: 8 },
  handoffSub:   { fontSize: 13, color: PALETTE.gray400, textAlign: 'center' },

  // Indice affiché
  clueBox:    { backgroundColor: PALETTE.tealLight, borderRadius: 14, padding: 14, marginBottom: 16, alignItems: 'center' },
  clueBoxLbl: { fontSize: 10, fontWeight: '700', color: PALETTE.teal, letterSpacing: 1.6, marginBottom: 4 },
  clueBoxTxt: { fontSize: 22, fontWeight: '800', color: PALETTE.tealDark },

  // Cadran
  dialLbl:  { position: 'absolute', fontSize: 13, fontWeight: '800' },
  dialLblL: { left: 0 },
  dialLblR: { right: 0 },

  // Score
  scoreReveal: { alignItems: 'center', paddingVertical: 20 },
  scoreNum:    { fontSize: 84, fontWeight: '900', lineHeight: 90 },
  scoreMsg:    { fontSize: 18, color: PALETTE.gray600, marginTop: 4, fontWeight: '600' },
  bonusBadge:  { marginTop: 12, backgroundColor: PALETTE.purpleLight, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 7 },
  bonusTxt:    { fontSize: 14, fontWeight: '700', color: PALETTE.purple },

  // Tableau scores
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

  // Historique manches
  historyRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: PALETTE.gray100 },
  historyLeft:  { flexDirection: 'row', gap: 10, alignItems: 'center', flex: 1 },
  historyNum:   { width: 22, height: 22, borderRadius: 11, backgroundColor: PALETTE.gray100, textAlign: 'center', fontSize: 11, fontWeight: '700', color: PALETTE.gray600, lineHeight: 22 },
  historyCard:  { fontSize: 13, fontWeight: '700', color: PALETTE.dark },
  historyClue:  { fontSize: 12, color: PALETTE.gray600 },
  historyGiver: { color: PALETTE.gray400 },
  historyRight: { alignItems: 'flex-end' },
  historyPts:   { fontSize: 15, fontWeight: '800' },
});

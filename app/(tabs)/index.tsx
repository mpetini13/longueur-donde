import React, { useEffect, useRef, useState } from 'react';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import {
  Dimensions,
  PanResponder,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PALETTE, PHASE_BG, PLAYER_COLORS } from '@/constants/theme';
import { PACK_ALL_ID, PACK_ALL_PRICE, PACKS, getActiveCards, isUnlocked } from '@/constants/packs';

// ── Dimensions ────────────────────────────────────────────────────────────────
const { width: SCREEN_WIDTH, height: SCREEN_H } = Dimensions.get('window');
const DIAL_W = SCREEN_WIDTH - 48;
const DIAL_R = DIAL_W / 2;

// ── Cadran ────────────────────────────────────────────────────────────────────
const N_SEC    = 60;                         // beaucoup de secteurs → transitions douces
const SEC_DEG  = 180 / N_SEC;
const SEC_H    = 2 * DIAL_R * Math.tan((SEC_DEG / 2) * Math.PI / 180) * 1.10;
const SEC_PCT  = 100 / N_SEC;
const NEEDLE_W = 6;
const NEEDLE_L = DIAL_R * 0.70;
const HUB_R    = Math.round(DIAL_R * 0.26); // hub bien visible
const LABEL_H  = 36;
const DIAL_H   = DIAL_R + HUB_R + LABEL_H;

// ── Zones ─────────────────────────────────────────────────────────────────────
// Normal : zones larges pour ressembler au jeu physique
// Expert : zones serrées comme la version originale
const ZONES_NORMAL = { z5: 7, z3: 14, z1: 21 };
const ZONES_EXPERT = { z5: 2.5, z3: 5, z1: 7 };

// ── Géométrie ─────────────────────────────────────────────────────────────────
function pctToAngle(pct: number): number {
  'worklet';
  return (1 - pct / 100) * Math.PI;
}
function touchToPct(tx: number, ty: number): number {
  const dx = tx - DIAL_R;
  const dy = DIAL_R - ty;
  let θ = Math.atan2(dy, dx);
  if (θ < 0) θ = dx < 0 ? Math.PI : 0;
  return Math.max(1, Math.min(99, (1 - Math.min(Math.PI, θ) / Math.PI) * 100));
}

function secColor(
  i: number, targetPct: number, showTarget: boolean,
  zones: { z5: number; z3: number; z1: number },
): string {
  // Pas de cible visible → couleur unie claire (phase devinette)
  if (!showTarget) return '#C2EBF2';
  // Cible visible → fond sombre + zones colorées
  const center = (i + 0.5) * SEC_PCT;
  const dist = Math.abs(center - targetPct);
  if (dist <= zones.z5 + SEC_PCT / 2) return '#EF4444';
  if (dist <= zones.z3 + SEC_PCT / 2) return '#F97316';
  if (dist <= zones.z1 + SEC_PCT / 2) return '#FBBF24';
  return '#0D1B2A';
}

// ── Wave dots animés ──────────────────────────────────────────────────────────
function WaveDot({ delay, size, opacity }: { delay: number; size: number; opacity: number }) {
  const y = useSharedValue(0);
  useEffect(() => {
    y.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(-9, { duration: 500, easing: Easing.inOut(Easing.sin) }),
        withTiming(0,  { duration: 500, easing: Easing.inOut(Easing.sin) }),
      ), -1, false,
    ));
  }, []);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <Animated.View style={[{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: 'rgba(255,255,255,0.9)', opacity,
    }, style]} />
  );
}

// ── Confettis ─────────────────────────────────────────────────────────────────
const CONFETTI_COLORS = ['#EF4444','#F97316','#EAB308','#22C55E','#3B82F6','#8B5CF6','#EC4899'];
const CONFETTI_DATA = Array.from({ length: 20 }, (_, i) => ({
  x: Math.round((i / 19) * (SCREEN_WIDTH - 14)),
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  duration: 1400 + (i % 5) * 380,
  delay: (i % 6) * 200,
  size: 6 + (i % 3) * 3,
}));

function ConfettiPiece({ x, color, duration, delay, size }: {
  x: number; color: string; duration: number; delay: number; size: number;
}) {
  const y = useSharedValue(-30);
  const rotate = useSharedValue(0);
  useEffect(() => {
    y.value = withDelay(delay, withRepeat(withTiming(SCREEN_H + 30, { duration, easing: Easing.linear }), -1));
    rotate.value = withRepeat(withTiming(360, { duration: 900 }), -1);
  }, []);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }, { rotate: `${rotate.value}deg` }],
  }));
  return (
    <Animated.View style={[{
      position: 'absolute', left: x, top: 0,
      width: size, height: size + 4, backgroundColor: color, borderRadius: 2,
    }, style]} />
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────
type Phase = 'home' | 'rules' | 'setup' | 'store' | 'clue' | 'handoff' | 'guess' | 'reveal' | 'end';
type Player = { name: string; score: number };
type RoundRecord = { card: [string, string]; clue: string; pts: number; giver: string; bonus: boolean };

const MEDALS = ['🥇', '🥈', '🥉', '🏅', '🏅'];
const SECURE_KEY = 'longueuronde_purchases';

// ── Composant principal ───────────────────────────────────────────────────────
export default function HomeScreen() {
  const [phase, setPhase] = useState<Phase>('home');
  const [players, setPlayers] = useState<Player[]>([
    { name: 'Joueur 1', score: 0 }, { name: 'Joueur 2', score: 0 },
  ]);
  const [totalRounds, setTotalRounds] = useState(10);
  const [currentRound, setCurrentRound] = useState(0);
  const [currentGiver, setCurrentGiver] = useState(0);
  const [currentCard, setCurrentCard] = useState<[string, string]>(['', '']);
  const [targetPos, setTargetPos] = useState(50);
  const [clue, setClue] = useState('');
  const [roundPoints, setRoundPoints] = useState(0);
  const [displayScore, setDisplayScore] = useState(0);
  const [teamBonus, setTeamBonus] = useState(false);
  const [usedCards, setUsedCards] = useState<number[]>([]);
  const [roundHistory, setRoundHistory] = useState<RoundRecord[]>([]);
  const [cardSkipped, setCardSkipped] = useState(false);
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerDuration, setTimerDuration] = useState(60);
  const [expertMode, setExpertMode] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [purchasedPacks, setPurchasedPacks] = useState<string[]>([]);
  const [storeConfirm, setStoreConfirm] = useState<string | null>(null);
  const [handoffCountdown, setHandoffCountdown] = useState(3);
  const [showBullseye, setShowBullseye] = useState(false);
  const [guessPosSaved, setGuessPosSaved] = useState(50);

  // Refs
  const guessPosRef   = useRef(50);
  const dialRef       = useRef<View>(null);
  const dialOriginRef = useRef({ x: 0, y: 0 });
  const gameCardsRef  = useRef<[string, string][]>([]);
  const targetPosRef  = useRef(50);
  const zonesRef      = useRef(ZONES_NORMAL);
  const prevZoneRef   = useRef(-1);

  // Sync refs avec state
  useEffect(() => { zonesRef.current = expertMode ? ZONES_EXPERT : ZONES_NORMAL; }, [expertMode]);

  // Achats persistés
  useEffect(() => {
    SecureStore.getItemAsync(SECURE_KEY).then(val => {
      if (val) setPurchasedPacks(JSON.parse(val));
    });
  }, []);

  // ── Animations ──────────────────────────────────────────────────────────────
  const logoScale      = useSharedValue(1);
  const homeOpacity    = useSharedValue(0);
  const scoreScale     = useSharedValue(0);
  const needleShared   = useSharedValue(50);
  const transOpacity   = useSharedValue(1);
  const bullseyeOp     = useSharedValue(0);
  const timerPulse     = useSharedValue(1);
  const countdownScale = useSharedValue(1);

  const logoStyle = useAnimatedStyle(() => ({ transform: [{ scale: logoScale.value }] }));
  const homeStyle = useAnimatedStyle(() => ({
    opacity: homeOpacity.value,
    transform: [{ translateY: (1 - homeOpacity.value) * 24 }],
  }));
  const scoreStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scoreScale.value }],
    opacity: Math.min(1, scoreScale.value),
  }));
  const needleRotStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${(needleShared.value / 100 - 0.5) * 180}deg` }],
  }));
  const transStyle      = useAnimatedStyle(() => ({ opacity: transOpacity.value }));
  const bullseyeStyle   = useAnimatedStyle(() => ({ opacity: bullseyeOp.value }));
  const timerPulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: timerPulse.value }] }));
  const countdownStyle  = useAnimatedStyle(() => ({ transform: [{ scale: countdownScale.value }] }));

  useEffect(() => {
    homeOpacity.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) });
    logoScale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        withTiming(1.0,  { duration: 1400, easing: Easing.inOut(Easing.sin) }),
      ), -1, false,
    );
  }, []);

  useEffect(() => {
    transOpacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
  }, [phase]);

  // Timer
  useEffect(() => {
    setTimeLeft(timerDuration);
    if (phase !== 'clue' || !timerEnabled) return;
    const id = setInterval(() => setTimeLeft(t => Math.max(0, t - 1)), 1000);
    return () => clearInterval(id);
  }, [phase, timerEnabled, timerDuration]);

  useEffect(() => {
    if (phase !== 'clue' || !timerEnabled) return;
    if (timeLeft === 0) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    else if (timeLeft <= 5) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [timeLeft]);

  // Timer pulse quand urgent
  const timerUrgentActive = timerEnabled && phase === 'clue' && timeLeft <= 10 && timeLeft > 0;
  useEffect(() => {
    if (timerUrgentActive) {
      timerPulse.value = withRepeat(
        withSequence(
          withTiming(1.18, { duration: 280 }),
          withTiming(1.0,  { duration: 280 }),
        ), -1, false,
      );
    } else {
      timerPulse.value = withTiming(1, { duration: 150 });
    }
  }, [timerUrgentActive]);

  // Countdown pulse à chaque chiffre
  useEffect(() => {
    if (phase !== 'handoff' || handoffCountdown <= 0) return;
    countdownScale.value = withSequence(
      withTiming(1.4, { duration: 90 }),
      withSpring(1.0, { damping: 7, stiffness: 200 }),
    );
  }, [handoffCountdown]);

  // Countdown handoff
  useEffect(() => {
    if (phase !== 'handoff') return;
    setHandoffCountdown(3);
    const id = setInterval(() => {
      setHandoffCountdown(c => { if (c <= 1) { clearInterval(id); return 0; } return c - 1; });
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  // ── PanResponder ─────────────────────────────────────────────────────────────
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        prevZoneRef.current = -1;
        const tx = e.nativeEvent.pageX - dialOriginRef.current.x;
        const ty = e.nativeEvent.pageY - dialOriginRef.current.y;
        const p = touchToPct(tx, ty);
        needleShared.value = withSpring(p, { damping: 14, stiffness: 260 });
        guessPosRef.current = p;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      },
      onPanResponderMove: (e) => {
        const tx = e.nativeEvent.pageX - dialOriginRef.current.x;
        const ty = e.nativeEvent.pageY - dialOriginRef.current.y;
        const p = touchToPct(tx, ty);
        needleShared.value = p;
        guessPosRef.current = p;
        // Haptic quand l'aiguille entre dans une zone
        const dist = Math.abs(p - targetPosRef.current);
        const z = zonesRef.current;
        const zone = dist <= z.z5 ? 5 : dist <= z.z3 ? 3 : dist <= z.z1 ? 1 : 0;
        if (zone !== prevZoneRef.current) {
          if (zone === 5) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          else if (zone > 0) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          prevZoneRef.current = zone;
        }
      },
    })
  ).current;

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const initials = (name: string) => name.trim().charAt(0).toUpperCase();
  const getHint = () =>
    targetPos < 30 ? 'plutôt à gauche' : targetPos > 70 ? 'plutôt à droite' : 'vers le centre';
  const zones = expertMode ? ZONES_EXPERT : ZONES_NORMAL;

  // Index = pts (0,1,2,3,4,5) — seuls 0, 1, 3, 5 sont utilisés dans ce jeu
  const scoreMsgs   = ['Raté ! 😬', 'Proche ! 👍', '', 'Bien joué ! 🎯', '', 'BULLSEYE ! 🎉'];
  const scoreColors = [PALETTE.red, PALETTE.coral, PALETTE.amber, PALETTE.blue, PALETTE.blue, PALETTE.green];

  const changePhase = (p: Phase) => {
    transOpacity.value = withTiming(0, { duration: 120, easing: Easing.in(Easing.quad) }, (done) => {
      if (done) runOnJS(setPhase)(p);
    });
  };

  const countUpScore = (target: number) => {
    setDisplayScore(0);
    if (target === 0) return;
    let count = 0;
    const tick = () => { count++; setDisplayScore(count); if (count < target) setTimeout(tick, 140); };
    setTimeout(tick, 280);
  };

  // IAP simulé
  const confirmPurchase = async (packId: string) => {
    const next = packId === PACK_ALL_ID
      ? [PACK_ALL_ID]
      : [...purchasedPacks.filter(id => id !== PACK_ALL_ID), packId];
    setPurchasedPacks(next);
    await SecureStore.setItemAsync(SECURE_KEY, JSON.stringify(next));
    setStoreConfirm(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  // ── Actions ───────────────────────────────────────────────────────────────────
  const addPlayer = () => { if (players.length < 5) setPlayers(p => [...p, { name: `Joueur ${p.length + 1}`, score: 0 }]); };
  const removePlayer = (i: number) => { if (players.length > 2) setPlayers(p => p.filter((_, idx) => idx !== i)); };
  const updateName = (i: number, name: string) =>
    setPlayers(p => p.map((pl, idx) => idx === i ? { ...pl, name } : pl));

  const startGame = () => {
    gameCardsRef.current = getActiveCards(purchasedPacks);
    const reset = players.map(p => ({ ...p, score: 0 }));
    setPlayers(reset); setCurrentGiver(0); setUsedCards([]); setRoundHistory([]);
    nextRound(reset, 0, 0, []);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const pickCard = (used: number[]): number => {
    const pool = gameCardsRef.current;
    let idx = Math.floor(Math.random() * pool.length);
    let tries = 0;
    while (used.includes(idx) && tries < pool.length) { idx = (idx + 1) % pool.length; tries++; }
    return idx;
  };

  const nextRound = (pl: Player[], round: number, giver: number, used: number[]) => {
    const nr = round + 1;
    if (nr > totalRounds) { changePhase('end'); return; }
    const idx = pickCard(used);
    const newTarget = 10 + Math.floor(Math.random() * 80);
    setCurrentRound(nr);
    setCurrentCard(gameCardsRef.current[idx]);
    setTargetPos(newTarget);
    targetPosRef.current = newTarget;
    prevZoneRef.current = -1;
    needleShared.value = withSpring(50, { damping: 12, stiffness: 150 });
    guessPosRef.current = 50;
    setClue(''); setUsedCards([...used, idx]);
    setCardSkipped(false);
    changePhase('clue');
  };

  const skipCard = () => {
    if (cardSkipped) return;
    const newIdx = pickCard([...usedCards]);
    setCurrentCard(gameCardsRef.current[newIdx]);
    setUsedCards(u => [...u, newIdx]);
    setCardSkipped(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const submitClue = () => {
    if (!clue.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    changePhase('handoff');
  };

  const submitGuess = () => {
    setGuessPosSaved(guessPosRef.current);
    const dist = Math.abs(guessPosRef.current - targetPos);
    let pts = 0;
    if (dist <= zones.z5) pts = 5;
    else if (dist <= zones.z3) pts = 3;
    else if (dist <= zones.z1) pts = 1;

    const bonus = pts === 5;
    setTeamBonus(bonus);
    setPlayers(p => p.map((pl, i) => {
      if (i !== currentGiver) return { ...pl, score: pl.score + pts + (bonus ? 1 : 0) };
      return bonus ? { ...pl, score: pl.score + 1 } : pl;
    }));
    setRoundPoints(pts);
    countUpScore(pts);
    setRoundHistory(h => [...h, { card: currentCard, clue, pts, bonus, giver: players[currentGiver].name }]);

    scoreScale.value = withSequence(
      withTiming(0, { duration: 0 }),
      withSpring(1.2, { damping: 5, stiffness: 180 }),
      withSpring(1.0, { damping: 14 }),
    );

    if (bonus) {
      setShowBullseye(true);
      bullseyeOp.value = withSequence(
        withTiming(1, { duration: 120 }),
        withTiming(1, { duration: 700 }),
        withTiming(0, { duration: 300 }, (done) => { if (done) runOnJS(setShowBullseye)(false); }),
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (pts === 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    changePhase('reveal');
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
    changePhase('setup');
  };

  // ── Cadran ────────────────────────────────────────────────────────────────────
  const renderDial = ({
    showTarget = false, showCursor = false, interactive = false,
  }: { showTarget?: boolean; showCursor?: boolean; interactive?: boolean }) => {
    const bgColor = showTarget ? '#0D1B2A' : '#C2EBF2';
    return (
      <View
        ref={interactive ? dialRef : undefined}
        onLayout={interactive ? () => {
          dialRef.current?.measure((_x, _y, _w, _h, pageX, pageY) => {
            dialOriginRef.current = { x: pageX, y: pageY };
          });
        } : undefined}
        style={{ width: DIAL_W, height: DIAL_H, alignSelf: 'center', marginBottom: 12 }}
        {...(interactive ? pan.panHandlers : {})}
      >
        {/* Fond + clipping demi-cercle */}
        <View style={{
          position: 'absolute', left: 0, top: 0,
          width: DIAL_W, height: DIAL_R + HUB_R,
          borderTopLeftRadius: DIAL_R, borderTopRightRadius: DIAL_R,
          backgroundColor: bgColor, overflow: 'hidden',
        }}>

          {/* ── Secteurs colorés ── */}
          {Array.from({ length: N_SEC }, (_, i) => (
            <View key={i} style={{
              position: 'absolute',
              left: DIAL_R, top: DIAL_R - SEC_H / 2,
              width: DIAL_R, height: SEC_H,
              backgroundColor: secColor(i, targetPos, showTarget, zones),
              // @ts-ignore
              transformOrigin: 'left center',
              transform: [{ rotate: `${-180 + (i + 0.5) * SEC_DEG}deg` }],
            }} />
          ))}

          {/* ── Chiffres sur les zones ── */}
          {showTarget && (() => {
            const z = zones;
            const r = DIAL_R * 0.60;
            const items: Array<{ pct: number; pts: string }> = [
              { pct: targetPos,                         pts: '5' },
              { pct: targetPos + (z.z5 + z.z3) / 2,    pts: '3' },
              { pct: targetPos - (z.z5 + z.z3) / 2,    pts: '3' },
              { pct: targetPos + (z.z3 + z.z1) / 2,    pts: '1' },
              { pct: targetPos - (z.z3 + z.z1) / 2,    pts: '1' },
            ];
            return items.map(({ pct, pts }, i) => {
              const p = Math.max(2, Math.min(98, pct));
              const θ = pctToAngle(p);
              const cx = DIAL_R + r * Math.cos(θ);
              const cy = DIAL_R - r * Math.sin(θ);
              return (
                <Text key={i} style={{
                  position: 'absolute',
                  left: cx - 11, top: cy - 11,
                  width: 22, height: 22,
                  textAlign: 'center', lineHeight: 22,
                  fontSize: 13, fontWeight: '900',
                  color: 'rgba(255,255,255,0.95)',
                }}>{pts}</Text>
              );
            });
          })()}

          {/* ── Masque hub (cache la base des secteurs) ── */}
          <View style={{
            position: 'absolute',
            left: DIAL_R - HUB_R, top: DIAL_R - HUB_R,
            width: HUB_R * 2, height: HUB_R * 2, borderRadius: HUB_R,
            backgroundColor: bgColor,
          }} />

          {/* ── Aiguille ── */}
          {showCursor && (
            <Animated.View style={[{
              position: 'absolute',
              left: DIAL_R - NEEDLE_W / 2, top: DIAL_R - NEEDLE_L,
              width: NEEDLE_W, height: NEEDLE_L,
              backgroundColor: '#D63939',
              borderTopLeftRadius: NEEDLE_W / 2,
              borderTopRightRadius: NEEDLE_W / 2,
              shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.35, shadowRadius: 4, elevation: 5,
              // @ts-ignore
              transformOrigin: 'bottom',
            }, needleRotStyle]} />
          )}

          {/* ── Hub rouge central ── */}
          <View style={{
            position: 'absolute',
            left: DIAL_R - HUB_R, top: DIAL_R - HUB_R,
            width: HUB_R * 2, height: HUB_R * 2, borderRadius: HUB_R,
            backgroundColor: '#E53E3E',
            shadowColor: '#C53030', shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.5, shadowRadius: 6, elevation: 8,
          }} />

          {/* ── Petit point brillant au centre du hub ── */}
          <View style={{
            position: 'absolute',
            left: DIAL_R - HUB_R * 0.28, top: DIAL_R - HUB_R * 0.6,
            width: HUB_R * 0.56, height: HUB_R * 0.32, borderRadius: HUB_R * 0.16,
            backgroundColor: 'rgba(255,255,255,0.25)',
          }} />
        </View>

        {/* ── Bordure extérieure (hors overflow:hidden) ── */}
        <View pointerEvents="none" style={{
          position: 'absolute', left: 0, top: 0,
          width: DIAL_W, height: DIAL_R + HUB_R,
          borderTopLeftRadius: DIAL_R, borderTopRightRadius: DIAL_R,
          borderTopWidth: 3, borderLeftWidth: 3, borderRightWidth: 3, borderBottomWidth: 0,
          borderColor: showTarget ? 'rgba(255,255,255,0.2)' : 'rgba(80,170,210,0.45)',
          backgroundColor: 'transparent',
        }} />

        {/* ── Étiquettes (hors overflow:hidden) ── */}
        <Text style={[s.dialLbl, s.dialLblL, { top: DIAL_R + HUB_R + 7 }]}>
          ← {currentCard[0]}
        </Text>
        <Text style={[s.dialLbl, s.dialLblR, { top: DIAL_R + HUB_R + 7 }]}>
          {currentCard[1]} →
        </Text>
      </View>
    );
  };

  const renderConcept = () => (
    <View style={s.conceptCard}>
      <View style={s.conceptSide}>
        <Text style={s.conceptArrow}>←</Text>
        <Text style={[s.conceptWord, { color: PALETTE.blue }]} numberOfLines={2}>{currentCard[0]}</Text>
      </View>
      <View style={s.conceptDivider} />
      <View style={s.conceptSide}>
        <Text style={[s.conceptWord, { color: PALETTE.red }]} numberOfLines={2}>{currentCard[1]}</Text>
        <Text style={s.conceptArrow}>→</Text>
      </View>
    </View>
  );

  const renderProgress = () => (
    <View style={s.progressWrap}>
      <View style={s.progressTrack}>
        <View style={[s.progressFill, { width: `${(currentRound / totalRounds) * 100}%` as any }]} />
      </View>
      <Text style={s.progressTxt}>{currentRound}/{totalRounds}</Text>
    </View>
  );

  // Podium fin de partie
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const renderPodium = () => {
    const podiumOrder = [1, 0, 2]; // 2e, 1er, 3e
    const podiumH = [60, 90, 44];
    const podiumColors = [PALETTE.gray200, PALETTE.amber, PALETTE.gray400];
    return (
      <View style={s.podiumWrap}>
        {podiumOrder.map((rank, di) => {
          const player = sorted[rank];
          if (!player) return <View key={rank} style={s.podiumCol} />;
          const ci = players.findIndex(p => p.name === player.name);
          return (
            <View key={rank} style={s.podiumCol}>
              <Text style={s.podiumMedal}>{MEDALS[rank]}</Text>
              <View style={[s.podiumAvatar, { backgroundColor: PLAYER_COLORS[ci] ?? PALETTE.gray400 }]}>
                <Text style={s.podiumAvatarTxt}>{initials(player.name)}</Text>
              </View>
              <Text style={s.podiumName} numberOfLines={1}>{player.name}</Text>
              <Text style={[s.podiumScore, rank === 0 && { color: PALETTE.amber }]}>
                {player.score} pts
              </Text>
              <View style={[s.podiumBlock, { height: podiumH[di], backgroundColor: podiumColors[di] }]} />
            </View>
          );
        })}
      </View>
    );
  };

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

  const timerColor = timeLeft <= 5 ? PALETTE.red : timeLeft <= 15 ? PALETTE.amber : PALETTE.green;
  const timerUrgent = timerUrgentActive;
  const bg = PHASE_BG[phase] ?? PALETTE.purple;
  const showProgress = ['clue', 'handoff', 'guess', 'reveal'].includes(phase);
  const unlockedPacks = PACKS.filter(p => isUnlocked(p.id, purchasedPacks));
  const totalCards = unlockedPacks.reduce((n, p) => n + p.cards.length, 0);

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[s.safe, { backgroundColor: bg }]}>
      <StatusBar barStyle="light-content" backgroundColor={bg} />

      {/* Flash BULLSEYE */}
      {showBullseye && (
        <Animated.View style={[StyleSheet.absoluteFillObject, s.bullseyeOverlay, bullseyeStyle]} pointerEvents="none">
          <Text style={s.bullseyeEmoji}>🎯</Text>
          <Text style={s.bullseyeTxt}>BULLSEYE !</Text>
        </Animated.View>
      )}

      <Animated.View style={[{ flex: 1 }, transStyle]}>

        {/* ═══ ACCUEIL ═══ */}
        {phase === 'home' && (
          <Animated.View style={[s.home, homeStyle]}>
            <Animated.Text style={[s.homeEmoji, logoStyle]}>🌊</Animated.Text>
            <Text style={s.homeTitle}>Longueur{'\n'}d'onde</Text>
            <Text style={s.homeSub}>Le jeu qui lit dans les esprits</Text>
            <View style={s.waveDots}>
              {[
                { op: 0.35, sz: 9,  delay: 0   },
                { op: 0.55, sz: 12, delay: 120  },
                { op: 0.85, sz: 16, delay: 240  },
                { op: 0.55, sz: 12, delay: 360  },
                { op: 0.35, sz: 9,  delay: 480  },
              ].map((d, i) => (
                <WaveDot key={i} delay={d.delay} size={d.sz} opacity={d.op} />
              ))}
            </View>
            <TouchableOpacity style={s.homeBtn} activeOpacity={0.85} onPress={() => changePhase('setup')}>
              <Text style={s.homeBtnTxt}>Jouer →</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.homeBtnSecondary} activeOpacity={0.8} onPress={() => changePhase('store')}>
              <Text style={s.homeBtnSecondaryTxt}>🛍️ Boutique</Text>
            </TouchableOpacity>
            <View style={s.homeLinks}>
              <TouchableOpacity activeOpacity={0.7} onPress={() => changePhase('rules')}>
                <Text style={s.homeLinkTxt}>Comment jouer ?</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {/* ═══ RÈGLES ═══ */}
        {phase === 'rules' && (
          <ScrollView contentContainerStyle={s.rulesContainer}>
            <Text style={s.rulesEmoji}>📖</Text>
            <Text style={s.rulesTitle}>Comment jouer</Text>
            {[
              { n: '1', t: "Le faiseur d'indice", d: "Un joueur voit où la cible se trouve (zone rouge). Les autres ne voient pas." },
              { n: '2', t: "Donner un indice", d: "Un seul mot ou courte phrase pour guider les autres vers la position." },
              { n: '3', t: "Passer le téléphone", d: "Les autres reçoivent le téléphone. Ils ne doivent pas avoir vu le cadran." },
              { n: '4', t: "Deviner ensemble", d: "L'équipe discute et place l'aiguille là où elle pense que la cible se trouve." },
              { n: '5', t: "Les points", d: "Bullseye (±7%) : 5 pts • Proche (±14%) : 3 pts • Autour (±21%) : 1 pt • Raté : 0 pt" },
              { n: '★', t: "Bonus Équipe !", d: "En cas de bullseye, tout le monde gagne +1 pt bonus, y compris le faiseur d'indice." },
            ].map((rule, i) => (
              <View key={i} style={s.ruleRow}>
                <View style={s.ruleNum}><Text style={s.ruleNumTxt}>{rule.n}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.ruleTitle}>{rule.t}</Text>
                  <Text style={s.ruleDesc}>{rule.d}</Text>
                </View>
              </View>
            ))}
            <TouchableOpacity style={[s.bigBtn, { backgroundColor: PALETTE.purple, marginTop: 32 }]} activeOpacity={0.82} onPress={() => changePhase('home')}>
              <Text style={s.bigBtnTxt}>Retour à l'accueil</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* ═══ BOUTIQUE ═══ */}
        {phase === 'store' && (
          <ScrollView contentContainerStyle={s.storeContainer}>
            <Text style={s.storeTitle}>🛍️ Boutique</Text>
            <Text style={s.storeSub}>Enrichis ton jeu avec des packs thématiques</Text>
            {PACKS.map(pack => {
              const owned = isUnlocked(pack.id, purchasedPacks);
              return (
                <View key={pack.id} style={[s.packCard, owned && s.packCardOwned]}>
                  <View style={s.packLeft}>
                    <Text style={s.packEmoji}>{pack.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.packName}>{pack.name}</Text>
                      <Text style={s.packTagline}>{pack.tagline}</Text>
                      <Text style={s.packCount}>{pack.cards.length} cartes</Text>
                    </View>
                  </View>
                  <View style={s.packRight}>
                    {owned ? (
                      <View style={s.packOwnedBadge}><Text style={s.packOwnedTxt}>✓ Inclus</Text></View>
                    ) : (
                      <TouchableOpacity activeOpacity={0.82} style={s.packBuyBtn} onPress={() => { setStoreConfirm(pack.id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
                        <Text style={s.packBuyTxt}>{pack.price?.toFixed(2)} €</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
            {!purchasedPacks.includes(PACK_ALL_ID) && (
              <TouchableOpacity activeOpacity={0.82} style={s.packAllCard} onPress={() => { setStoreConfirm(PACK_ALL_ID); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}>
                <Text style={s.packAllEmoji}>✨</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.packAllName}>Pack Complet</Text>
                  <Text style={s.packAllSub}>Tous les packs • économise 1 €</Text>
                </View>
                <Text style={s.packAllPrice}>{PACK_ALL_PRICE.toFixed(2)} €</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity activeOpacity={0.82} style={[s.bigBtn, { backgroundColor: 'rgba(255,255,255,0.15)', marginTop: 24 }]} onPress={() => changePhase('home')}>
              <Text style={s.bigBtnTxt}>← Retour</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* ═══ MODAL CONFIRMATION ACHAT ═══ */}
        {storeConfirm !== null && (
          <View style={s.confirmOverlay}>
            <View style={s.confirmBox}>
              {(() => {
                const isAll = storeConfirm === PACK_ALL_ID;
                const pack = PACKS.find(p => p.id === storeConfirm);
                const name = isAll ? 'Pack Complet ✨' : `${pack?.emoji} ${pack?.name}`;
                const price = isAll ? PACK_ALL_PRICE : pack?.price;
                return (
                  <>
                    <Text style={s.confirmTitle}>{name}</Text>
                    <Text style={s.confirmPrice}>{price?.toFixed(2)} €</Text>
                    <Text style={s.confirmNote}>
                      💡 Mode simulation — dans la version finale,{'\n'}le paiement se fera via le store.
                    </Text>
                    <TouchableOpacity activeOpacity={0.82} style={[s.bigBtn, { backgroundColor: PALETTE.purple, width: '100%', marginTop: 16 }]} onPress={() => confirmPurchase(storeConfirm)}>
                      <Text style={s.bigBtnTxt}>Confirmer l'achat →</Text>
                    </TouchableOpacity>
                    <TouchableOpacity activeOpacity={0.7} style={s.confirmCancel} onPress={() => setStoreConfirm(null)}>
                      <Text style={s.confirmCancelTxt}>Annuler</Text>
                    </TouchableOpacity>
                  </>
                );
              })()}
            </View>
          </View>
        )}

        {/* ═══ JEU ═══ */}
        {!['home', 'rules', 'store'].includes(phase) && (
          <>
            <View style={[s.header, { backgroundColor: bg }]}>
              {phase === 'setup' && <><Text style={s.hTitle}>Configuration</Text><Text style={s.hSub}>Qui joue ? Combien de manches ?</Text></>}
              {phase === 'clue' && (
                <>
                  <View style={s.hRow}>
                    <Text style={s.hBadge}>MANCHE {currentRound} / {totalRounds}</Text>
                    {timerEnabled && (
                      <Animated.View style={[s.timerBadge, { backgroundColor: timerColor }, timerPulseStyle]}>
                        <Text style={s.timerTxt}>⏱ {timeLeft}s</Text>
                      </Animated.View>
                    )}
                  </View>
                  <Text style={s.hTitle}>🎭 {players[currentGiver].name}</Text>
                  <Text style={s.hSub}>donne l'indice{timerUrgent ? ' — DÉPÊCHE-TOI !' : ''}</Text>
                </>
              )}
              {phase === 'handoff' && <><Text style={s.hBadge}>MANCHE {currentRound} / {totalRounds}</Text><Text style={s.hTitle}>📱 Passez le téléphone</Text></>}
              {phase === 'guess'   && <><Text style={s.hBadge}>MANCHE {currentRound} / {totalRounds}</Text><Text style={s.hTitle}>🎯 À vous de jouer !</Text><Text style={s.hSub}>Touchez le cadran pour placer l'aiguille</Text></>}
              {phase === 'reveal'  && <><Text style={s.hBadge}>MANCHE {currentRound} / {totalRounds}</Text><Text style={s.hTitle}>Résultat</Text></>}
              {phase === 'end'     && <><Text style={s.hEmoji}>🏆</Text><Text style={s.hTitle}>Fin de partie !</Text></>}
              {showProgress && renderProgress()}
            </View>

            <View style={s.sheet}>
              <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} scrollEnabled={phase !== 'guess'}>

                {/* SETUP */}
                {phase === 'setup' && <>
                  <Text style={s.label}>JOUEURS</Text>
                  {players.map((p, i) => (
                    <View key={i} style={s.playerRow}>
                      <View style={[s.av, { backgroundColor: PLAYER_COLORS[i] }]}>
                        <Text style={s.avTxt}>{initials(p.name)}</Text>
                      </View>
                      <TextInput style={s.playerInput} value={p.name} onChangeText={t => updateName(i, t)} placeholder={`Joueur ${i + 1}`} placeholderTextColor={PALETTE.gray400} />
                      {players.length > 2 && <TouchableOpacity activeOpacity={0.7} style={s.removeBtn} onPress={() => removePlayer(i)}><Text style={s.removeTxt}>✕</Text></TouchableOpacity>}
                    </View>
                  ))}
                  {players.length < 5 && (
                    <TouchableOpacity activeOpacity={0.7} style={s.addBtn} onPress={addPlayer}><Text style={s.addTxt}>+ Ajouter un joueur</Text></TouchableOpacity>
                  )}

                  <Text style={[s.label, { marginTop: 28 }]}>NOMBRE DE MANCHES</Text>
                  <View style={s.counter}>
                    <TouchableOpacity activeOpacity={0.7} style={s.counterBtn} onPress={() => setTotalRounds(r => Math.max(3, r - 1))}><Text style={s.counterBtnTxt}>−</Text></TouchableOpacity>
                    <Text style={s.counterVal}>{totalRounds}</Text>
                    <TouchableOpacity activeOpacity={0.7} style={s.counterBtn} onPress={() => setTotalRounds(r => Math.min(30, r + 1))}><Text style={s.counterBtnTxt}>+</Text></TouchableOpacity>
                  </View>

                  <View style={s.packsSection}>
                    <View style={s.packsSectionHeader}>
                      <Text style={s.label}>PACKS DE CARTES</Text>
                      <TouchableOpacity activeOpacity={0.7} onPress={() => changePhase('store')}><Text style={s.packsSeeAll}>Gérer →</Text></TouchableOpacity>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                      {unlockedPacks.map(pack => (
                        <View key={pack.id} style={s.packPill}>
                          <Text style={s.packPillTxt}>{pack.emoji} {pack.name}</Text>
                        </View>
                      ))}
                      {unlockedPacks.length < PACKS.length && (
                        <TouchableOpacity activeOpacity={0.7} style={[s.packPill, s.packPillLocked]} onPress={() => changePhase('store')}>
                          <Text style={[s.packPillTxt, { color: PALETTE.purple }]}>+ Débloquer</Text>
                        </TouchableOpacity>
                      )}
                    </ScrollView>
                    <Text style={s.packsTotalTxt}>{totalCards} cartes disponibles</Text>
                  </View>

                  <Text style={[s.label, { marginTop: 20 }]}>OPTIONS</Text>
                  <View style={s.optionRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.optionTitle}>⏱ Chrono par manche</Text>
                      <Text style={s.optionDesc}>Limite de temps pour donner l'indice</Text>
                    </View>
                    <TouchableOpacity activeOpacity={0.8} style={[s.toggle, timerEnabled && s.toggleOn]} onPress={() => { setTimerEnabled(e => !e); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
                      <View style={[s.toggleKnob, timerEnabled && s.toggleKnobOn]} />
                    </TouchableOpacity>
                  </View>
                  {timerEnabled && (
                    <View style={[s.counter, { marginTop: 8, marginBottom: 4 }]}>
                      <TouchableOpacity activeOpacity={0.7} style={s.counterBtnSm} onPress={() => setTimerDuration(d => Math.max(15, d - 15))}><Text style={s.counterBtnTxt}>−</Text></TouchableOpacity>
                      <Text style={s.counterValSm}>{timerDuration}s</Text>
                      <TouchableOpacity activeOpacity={0.7} style={s.counterBtnSm} onPress={() => setTimerDuration(d => Math.min(120, d + 15))}><Text style={s.counterBtnTxt}>+</Text></TouchableOpacity>
                    </View>
                  )}
                  <View style={[s.optionRow, { marginTop: 12 }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.optionTitle}>🔥 Mode Expert</Text>
                      <Text style={s.optionDesc}>Zones resserrées — bullseye ±2.5%, proche ±5%, autour ±7%</Text>
                    </View>
                    <TouchableOpacity activeOpacity={0.8} style={[s.toggle, expertMode && s.toggleOn]} onPress={() => { setExpertMode(e => !e); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
                      <View style={[s.toggleKnob, expertMode && s.toggleKnobOn]} />
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity activeOpacity={0.82} style={[s.bigBtn, { backgroundColor: PALETTE.purple, marginTop: 36 }]} onPress={startGame}>
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
                  <TouchableOpacity activeOpacity={0.82} style={[s.bigBtn, { backgroundColor: PALETTE.blue }]} onPress={submitClue}>
                    <Text style={s.bigBtnTxt}>Valider l'indice →</Text>
                  </TouchableOpacity>
                  {!cardSkipped && (
                    <TouchableOpacity activeOpacity={0.7} style={s.skipBtn} onPress={skipCard}>
                      <Text style={s.skipTxt}>↩ Passer cette carte</Text>
                    </TouchableOpacity>
                  )}
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
                  {handoffCountdown > 0 ? (
                    <View style={s.countdownBox}>
                      <Animated.Text style={[s.countdownNum, countdownStyle]}>{handoffCountdown}</Animated.Text>
                      <Text style={s.countdownSub}>secondes avant de jouer…</Text>
                    </View>
                  ) : (
                    <TouchableOpacity activeOpacity={0.82} style={[s.bigBtn, { backgroundColor: PALETTE.teal }]} onPress={() => changePhase('guess')}>
                      <Text style={s.bigBtnTxt}>✓ Téléphone passé, on joue !</Text>
                    </TouchableOpacity>
                  )}
                </>}

                {/* DEVINETTE */}
                {phase === 'guess' && <>
                  {renderConcept()}
                  <View style={s.clueBox}>
                    <Text style={s.clueBoxLbl}>L'INDICE</Text>
                    <Text style={s.clueBoxTxt}>"{clue}"</Text>
                  </View>
                  {renderDial({ showCursor: true, interactive: true })}
                  <TouchableOpacity activeOpacity={0.82} style={[s.bigBtn, { backgroundColor: PALETTE.teal, marginTop: 8 }]} onPress={submitGuess}>
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
                    <Text style={[s.scoreNum, { color: scoreColors[roundPoints] }]}>+{displayScore}</Text>
                    <Text style={s.scoreMsg}>{scoreMsgs[roundPoints]}</Text>
                    <Text style={s.distanceTxt}>
                      Vous étiez à <Text style={s.distanceBold}>{Math.abs(guessPosSaved - targetPos).toFixed(1)}%</Text> de la cible
                    </Text>
                    {teamBonus && <View style={s.bonusBadge}><Text style={s.bonusTxt}>🎯 BONUS ÉQUIPE +1</Text></View>}
                    {expertMode && <View style={[s.bonusBadge, { backgroundColor: PALETTE.amberLight, marginTop: 6 }]}><Text style={[s.bonusTxt, { color: PALETTE.amberDark }]}>🔥 Mode Expert</Text></View>}
                  </Animated.View>
                  <Text style={s.label}>SCORES</Text>
                  {renderScores()}
                  <TouchableOpacity activeOpacity={0.82} style={[s.bigBtn, { backgroundColor: PALETTE.amber, marginTop: 24 }]} onPress={goNext}>
                    <Text style={s.bigBtnTxt}>{currentRound >= totalRounds ? 'Voir les résultats →' : 'Manche suivante →'}</Text>
                  </TouchableOpacity>
                </>}

                {/* FIN */}
                {phase === 'end' && <>
                  {renderPodium()}
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
                  <TouchableOpacity activeOpacity={0.82} style={[s.bigBtn, { backgroundColor: PALETTE.purple, marginTop: 32 }]} onPress={restart}>
                    <Text style={s.bigBtnTxt}>Rejouer 🎮</Text>
                  </TouchableOpacity>
                </>}

              </ScrollView>
            </View>

            {phase === 'end' && (
              <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
                {CONFETTI_DATA.map((c, i) => <ConfettiPiece key={i} {...c} />)}
              </View>
            )}
          </>
        )}

      </Animated.View>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1 },

  // Flash bullseye
  bullseyeOverlay: { zIndex: 200, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(239,68,68,0.92)' },
  bullseyeEmoji:   { fontSize: 90, marginBottom: 12 },
  bullseyeTxt:     { fontSize: 48, fontWeight: '900', color: '#fff', letterSpacing: 2 },

  // Accueil
  home:        { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  homeEmoji:   { fontSize: 72, marginBottom: 12 },
  homeTitle:   { fontSize: 40, fontWeight: '900', color: '#fff', textAlign: 'center', lineHeight: 46, marginBottom: 12 },
  homeSub:     { fontSize: 16, color: 'rgba(255,255,255,0.72)', textAlign: 'center', marginBottom: 36 },
  waveDots:    { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 40 },
  waveDot:     { width: 14, height: 14, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.9)' },
  homeBtn:            { backgroundColor: '#fff', borderRadius: 20, paddingVertical: 18, paddingHorizontal: 52, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 8, marginBottom: 14 },
  homeBtnTxt:         { color: PALETTE.purple, fontSize: 20, fontWeight: '800' },
  homeBtnSecondary:   { borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)', borderRadius: 16, paddingVertical: 13, paddingHorizontal: 36, marginBottom: 20 },
  homeBtnSecondaryTxt:{ color: '#fff', fontSize: 15, fontWeight: '700' },
  homeLinks:          { flexDirection: 'row', alignItems: 'center' },
  homeLinkTxt:        { color: 'rgba(255,255,255,0.55)', fontSize: 13, textDecorationLine: 'underline' },

  // Règles
  rulesContainer: { padding: 28, paddingBottom: 60 },
  rulesEmoji:     { fontSize: 48, textAlign: 'center', marginBottom: 8 },
  rulesTitle:     { fontSize: 26, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: 28 },
  ruleRow:        { flexDirection: 'row', gap: 14, marginBottom: 20, alignItems: 'flex-start' },
  ruleNum:        { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  ruleNumTxt:     { color: '#fff', fontWeight: '800', fontSize: 14 },
  ruleTitle:      { fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 3 },
  ruleDesc:       { fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 18 },

  // Boutique
  storeContainer: { padding: 24, paddingBottom: 60 },
  storeTitle:     { fontSize: 28, fontWeight: '900', color: '#fff', textAlign: 'center', marginBottom: 6 },
  storeSub:       { fontSize: 14, color: 'rgba(255,255,255,0.65)', textAlign: 'center', marginBottom: 28 },
  packCard:       { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 18, padding: 16, marginBottom: 12 },
  packCardOwned:  { backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  packLeft:       { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  packEmoji:      { fontSize: 32 },
  packName:       { fontSize: 15, fontWeight: '800', color: '#fff', marginBottom: 2 },
  packTagline:    { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 3 },
  packCount:      { fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: '600' },
  packRight:      { alignItems: 'flex-end', marginLeft: 8 },
  packOwnedBadge: { backgroundColor: PALETTE.green, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  packOwnedTxt:   { color: '#fff', fontSize: 12, fontWeight: '800' },
  packBuyBtn:     { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 },
  packBuyTxt:     { color: '#1E1B4B', fontSize: 14, fontWeight: '800' },
  packAllCard:    { flexDirection: 'row', alignItems: 'center', backgroundColor: PALETTE.purple, borderRadius: 18, padding: 18, marginTop: 8, gap: 12, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  packAllEmoji:   { fontSize: 36 },
  packAllName:    { fontSize: 16, fontWeight: '900', color: '#fff' },
  packAllSub:     { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  packAllPrice:   { fontSize: 18, fontWeight: '900', color: '#fff' },

  // Confirmation achat
  confirmOverlay:   { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end', zIndex: 100 },
  confirmBox:       { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 28, alignItems: 'center' },
  confirmTitle:     { fontSize: 22, fontWeight: '900', color: PALETTE.dark, marginBottom: 6 },
  confirmPrice:     { fontSize: 36, fontWeight: '900', color: PALETTE.purple, marginBottom: 12 },
  confirmNote:      { fontSize: 12, color: PALETTE.gray400, textAlign: 'center', lineHeight: 18, marginBottom: 4 },
  confirmCancel:    { paddingVertical: 14 },
  confirmCancelTxt: { color: PALETTE.gray400, fontSize: 14 },

  // Header
  header:  { paddingHorizontal: 24, paddingTop: 14, paddingBottom: 16, alignItems: 'center' },
  hEmoji:  { fontSize: 44, marginBottom: 4 },
  hBadge:  { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.62)', letterSpacing: 1.8, marginBottom: 4 },
  hRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  hTitle:  { fontSize: 24, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: 4 },
  hSub:    { fontSize: 13, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
  timerBadge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  timerTxt:   { color: '#fff', fontSize: 13, fontWeight: '800' },
  progressWrap:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  progressTrack: { flex: 1, height: 4, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 2, overflow: 'hidden' },
  progressFill:  { height: 4, backgroundColor: '#fff', borderRadius: 2 },
  progressTxt:   { fontSize: 11, color: 'rgba(255,255,255,0.65)', fontWeight: '600', width: 36, textAlign: 'right' },

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

  // Packs setup
  packsSection:       { marginTop: 28 },
  packsSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  packsSeeAll:        { fontSize: 13, color: PALETTE.purple, fontWeight: '700' },
  packPill:           { backgroundColor: PALETTE.purpleLight, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8 },
  packPillLocked:     { backgroundColor: '#fff', borderWidth: 1.5, borderColor: PALETTE.purple },
  packPillTxt:        { fontSize: 13, fontWeight: '700', color: PALETTE.purpleDark },
  packsTotalTxt:      { fontSize: 12, color: PALETTE.gray400, marginTop: 8 },

  // Options
  optionRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  optionTitle:  { fontSize: 14, fontWeight: '700', color: PALETTE.dark, marginBottom: 2 },
  optionDesc:   { fontSize: 12, color: PALETTE.gray400, lineHeight: 16 },
  toggle:       { width: 48, height: 28, borderRadius: 14, backgroundColor: PALETTE.gray200, justifyContent: 'center', paddingHorizontal: 3 },
  toggleOn:     { backgroundColor: PALETTE.purple },
  toggleKnob:   { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2 },
  toggleKnobOn: { alignSelf: 'flex-end' },

  counter:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  counterBtn:    { width: 52, height: 52, borderRadius: 26, backgroundColor: PALETTE.gray100, alignItems: 'center', justifyContent: 'center' },
  counterBtnSm:  { width: 40, height: 40, borderRadius: 20, backgroundColor: PALETTE.gray100, alignItems: 'center', justifyContent: 'center' },
  counterBtnTxt: { fontSize: 26, fontWeight: '300', color: PALETTE.dark },
  counterVal:    { fontSize: 48, fontWeight: '800', color: PALETTE.dark, width: 90, textAlign: 'center' },
  counterValSm:  { fontSize: 28, fontWeight: '700', color: PALETTE.dark, width: 70, textAlign: 'center' },

  bigBtn:    { borderRadius: 16, padding: 17, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 8, elevation: 5 },
  bigBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },

  skipBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 6 },
  skipTxt: { color: PALETTE.gray400, fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },

  // Handoff countdown
  countdownBox: { alignItems: 'center', paddingVertical: 20 },
  countdownNum: { fontSize: 80, fontWeight: '900', color: PALETTE.teal },
  countdownSub: { fontSize: 14, color: PALETTE.gray400, marginTop: 4 },

  conceptCard:    { flexDirection: 'row', alignItems: 'center', backgroundColor: PALETTE.gray100, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 16, marginBottom: 16, overflow: 'hidden' },
  conceptSide:    { flex: 1, alignItems: 'center', gap: 4 },
  conceptWord:    { fontSize: 17, fontWeight: '800', textAlign: 'center' },
  conceptArrow:   { fontSize: 14, color: PALETTE.gray400, fontWeight: '700' },
  conceptDivider: { width: 1, height: 40, backgroundColor: PALETTE.gray200, marginHorizontal: 10 },

  hintBox:   { backgroundColor: PALETTE.blueLight, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16 },
  hintTxt:   { fontSize: 13, color: PALETTE.blueDark, textAlign: 'center' },
  hintBold:  { fontWeight: '800' },
  clueInput: { backgroundColor: PALETTE.gray100, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 17, color: PALETTE.dark, marginBottom: 16 },

  handoffBox:   { alignItems: 'center', paddingVertical: 28 },
  handoffEmoji: { fontSize: 56, marginBottom: 14 },
  handoffTitle: { fontSize: 18, fontWeight: '700', color: PALETTE.dark, textAlign: 'center', marginBottom: 8 },
  handoffSub:   { fontSize: 13, color: PALETTE.gray400, textAlign: 'center' },

  clueBox:    { backgroundColor: PALETTE.tealLight, borderRadius: 14, padding: 14, marginBottom: 16, alignItems: 'center' },
  clueBoxLbl: { fontSize: 10, fontWeight: '700', color: PALETTE.teal, letterSpacing: 1.6, marginBottom: 4 },
  clueBoxTxt: { fontSize: 22, fontWeight: '800', color: PALETTE.tealDark },

  dialLbl:  { position: 'absolute', fontSize: 13, fontWeight: '700', color: PALETTE.gray600 },
  dialLblL: { left: 0 },
  dialLblR: { right: 0, textAlign: 'right' },

  scoreReveal:  { alignItems: 'center', paddingVertical: 20 },
  scoreNum:     { fontSize: 84, fontWeight: '900', lineHeight: 90 },
  scoreMsg:     { fontSize: 18, color: PALETTE.gray600, marginTop: 4, fontWeight: '600' },
  distanceTxt:  { fontSize: 13, color: PALETTE.gray400, marginTop: 6, marginBottom: 4 },
  distanceBold: { fontWeight: '700', color: PALETTE.gray600 },
  bonusBadge:  { marginTop: 12, backgroundColor: PALETTE.purpleLight, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 7 },
  bonusTxt:    { fontSize: 14, fontWeight: '700', color: PALETTE.purple },

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

  // Podium fin de partie
  podiumWrap:     { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: 8, marginBottom: 8, paddingTop: 8 },
  podiumCol:      { alignItems: 'center', flex: 1 },
  podiumMedal:    { fontSize: 28, marginBottom: 4 },
  podiumAvatar:   { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  podiumAvatarTxt:{ color: '#fff', fontWeight: '800', fontSize: 18 },
  podiumName:     { fontSize: 12, fontWeight: '700', color: PALETTE.dark, marginBottom: 2, maxWidth: 80, textAlign: 'center' },
  podiumScore:    { fontSize: 13, fontWeight: '800', color: PALETTE.gray600, marginBottom: 6 },
  podiumBlock:    { width: '100%', borderTopLeftRadius: 6, borderTopRightRadius: 6 },

  historyRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: PALETTE.gray100 },
  historyLeft:  { flexDirection: 'row', gap: 10, alignItems: 'center', flex: 1 },
  historyNum:   { width: 22, height: 22, borderRadius: 11, backgroundColor: PALETTE.gray100, textAlign: 'center', fontSize: 11, fontWeight: '700', color: PALETTE.gray600, lineHeight: 22 },
  historyCard:  { fontSize: 13, fontWeight: '700', color: PALETTE.dark },
  historyClue:  { fontSize: 12, color: PALETTE.gray600 },
  historyGiver: { color: PALETTE.gray400 },
  historyRight: { alignItems: 'flex-end' },
  historyPts:   { fontSize: 15, fontWeight: '800' },
});

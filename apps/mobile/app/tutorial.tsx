import { setTutorialSeen } from '@calorya/api';
import {
  TUTORIAL_LAST_LABEL,
  TUTORIAL_NEXT_LABEL,
  TUTORIAL_SKIP_LABEL,
  TUTORIAL_STEPS,
} from '@calorya/core';
import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../src/components/ui';
import { supabase } from '../src/lib/supabase';
import { radius, spacing, useThemedStyles, type Theme } from '../src/lib/theme';
import { useSession } from './_layout';

/**
 * The five-slide introduction, shown once per account.
 *
 * A horizontal paging ScrollView rather than a library: five static cards is
 * not worth a carousel dependency, and swiping is the gesture people already
 * expect from an intro on a phone. The buttons and the swipe drive the same
 * index, so neither can disagree with the dots.
 *
 * Both exits — finishing and skipping — stamp the same column and then ask the
 * root gate to re-read it. Navigating from here instead would race the gate,
 * which still holds `tutorialSeen: false` and would push us right back.
 */
export default function TutorialScreen() {
  const styles = useThemedStyles(makeStyles);
  const queryClient = useQueryClient();
  const { refreshGate } = useSession();

  const [index, setIndex] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  // Read once: the slides fill the screen, and a rotation mid-tutorial is not
  // worth a listener that re-lays-out five cards under the user's thumb.
  const width = useRef(Dimensions.get('window').width).current;

  const isLast = index === TUTORIAL_STEPS.length - 1;

  function goTo(next: number) {
    setIndex(next);
    scrollRef.current?.scrollTo({ x: next * width, animated: true });
  }

  function onScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    if (next !== index) setIndex(next);
  }

  async function leave() {
    setLeaving(true);
    try {
      await setTutorialSeen(supabase, true);
    } catch {
      // Deliberately swallowed. Being unable to record that the slides were
      // seen must not trap someone on them; the cost of a failed write is
      // seeing them once more, which is much cheaper than a dead button.
    }
    // The profile now carries a new column value.
    void queryClient.invalidateQueries({ queryKey: ['profile'] });
    refreshGate();
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.brand}>CALORYA</Text>
        <Pressable
          onPress={leave}
          disabled={leaving}
          accessibilityRole="button"
          hitSlop={8}
        >
          <Text style={styles.skip}>{TUTORIAL_SKIP_LABEL}</Text>
        </Pressable>
      </View>

      {/* Progress as bars, tappable so a slide read too fast can be revisited. */}
      <View style={styles.dots}>
        {TUTORIAL_STEPS.map((step, i) => (
          <Pressable
            key={step.id}
            onPress={() => goTo(i)}
            accessibilityRole="button"
            accessibilityLabel={`Langkah ${i + 1}: ${step.title}`}
            style={[styles.dot, i <= index && styles.dotActive]}
          />
        ))}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        style={{ flex: 1 }}
      >
        {TUTORIAL_STEPS.map((step) => (
          <ScrollView
            key={step.id}
            style={{ width }}
            contentContainerStyle={styles.slide}
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.medallion, { backgroundColor: step.tint }]}>
              <Text style={styles.emoji}>{step.emoji}</Text>
            </View>

            <Text style={styles.title}>{step.title}</Text>
            <Text style={styles.body}>{step.body}</Text>

            <View style={styles.points}>
              {step.points.map((point) => (
                <View key={point} style={styles.point}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={styles.pointText}>{point}</Text>
                </View>
              ))}
            </View>

            {step.where ? (
              <View style={styles.whereBox}>
                <Text style={styles.whereText}>
                  Ada di <Text style={styles.whereStrong}>{step.where.mobile}</Text>.
                </Text>
              </View>
            ) : null}
          </ScrollView>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        {index > 0 ? (
          <Button
            label="Kembali"
            variant="ghost"
            onPress={() => goTo(index - 1)}
            style={{ flex: 1 }}
          />
        ) : null}
        <Button
          label={isLast ? TUTORIAL_LAST_LABEL : TUTORIAL_NEXT_LABEL}
          onPress={() => (isLast ? leave() : goTo(index + 1))}
          loading={leaving}
          style={{ flex: 2 }}
        />
      </View>
      <Text style={styles.counter}>
        {index + 1} dari {TUTORIAL_STEPS.length}
      </Text>
    </SafeAreaView>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
    },
    brand: {
      color: theme.brand,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 2,
    },
    skip: { color: theme.textDim, fontSize: 14 },
    dots: {
      flexDirection: 'row',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
    },
    dot: {
      flex: 1,
      height: 5,
      borderRadius: 3,
      backgroundColor: theme.border,
    },
    dotActive: { backgroundColor: theme.brand },
    slide: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xxl,
      paddingBottom: spacing.lg,
    },
    medallion: {
      width: 84,
      height: 84,
      borderRadius: radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emoji: { fontSize: 40 },
    title: {
      color: theme.text,
      fontSize: 24,
      fontWeight: '700',
      marginTop: spacing.lg,
    },
    body: {
      color: theme.textMuted,
      fontSize: 15,
      lineHeight: 23,
      marginTop: spacing.md,
    },
    points: { marginTop: spacing.lg, gap: spacing.sm },
    point: { flexDirection: 'row', gap: spacing.sm },
    bullet: { color: theme.brand, fontSize: 15 },
    pointText: { flex: 1, color: theme.textMuted, fontSize: 14, lineHeight: 21 },
    whereBox: {
      marginTop: spacing.lg,
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
    },
    whereText: { color: theme.textDim, fontSize: 13 },
    whereStrong: { color: theme.text, fontWeight: '600' },
    footer: {
      flexDirection: 'row',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
    },
    counter: {
      color: theme.textDim,
      fontSize: 12,
      textAlign: 'center',
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
    },
  });

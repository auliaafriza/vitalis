import { describe, expect, it } from 'vitest';
import { nextRoute, type GateState } from '../auth-gate';

const gate = (over: Partial<GateState> = {}): GateState => ({
  signedIn: true,
  onboarded: true,
  tutorialSeen: true,
  at: 'app',
  ...over,
});

/**
 * These cases are the register/login flow as specified, one test per rule.
 * If a future change breaks one of them it breaks a promise made to users,
 * not merely an implementation detail.
 */
describe('gerbang masuk', () => {
  it('1. belum masuk → /login', () => {
    expect(nextRoute(gate({ signedIn: false, at: 'app' }))).toBe('/login');
    expect(nextRoute(gate({ signedIn: false, at: 'onboarding' }))).toBe('/login');
    // …but does not redirect the login screen to itself.
    expect(nextRoute(gate({ signedIn: false, at: 'login' }))).toBeNull();
  });

  it('2. daftar dari web, baru masuk → setup dulu, bukan dashboard', () => {
    expect(nextRoute(gate({ onboarded: false, tutorialSeen: false, at: 'login' }))).toBe(
      '/onboarding',
    );
  });

  it('3. dari mobile juga setup dulu — aturannya satu, bukan per platform', () => {
    // Same input, same answer: there is no platform argument to disagree over.
    expect(nextRoute(gate({ onboarded: false, tutorialSeen: false, at: 'app' }))).toBe(
      '/onboarding',
    );
  });

  it('4. user lama tidak pernah melihat halaman setup lagi', () => {
    expect(nextRoute(gate({ at: 'login' }))).toBe('/app');
    expect(nextRoute(gate({ at: 'app' }))).toBeNull();
  });

  it('setup selesai → tutorial → dashboard, dalam urutan itu', () => {
    expect(nextRoute(gate({ onboarded: true, tutorialSeen: false, at: 'onboarding' }))).toBe(
      '/tutorial',
    );
    expect(nextRoute(gate({ onboarded: true, tutorialSeen: true, at: 'tutorial' }))).toBe(
      '/app',
    );
  });

  it('tidak melempar orang keluar dari layar yang memang tujuannya', () => {
    expect(nextRoute(gate({ onboarded: false, at: 'onboarding' }))).toBeNull();
    expect(nextRoute(gate({ tutorialSeen: false, at: 'tutorial' }))).toBeNull();
  });

  it('menunggu selama jawabannya belum diketahui', () => {
    // The bug this prevents: flashing the setup form at someone who finished
    // it, in the gap before the profile lookup returns.
    expect(nextRoute(gate({ onboarded: null, at: 'app' }))).toBeNull();
    expect(nextRoute(gate({ tutorialSeen: null, at: 'app' }))).toBeNull();
    expect(nextRoute(gate({ onboarded: null, tutorialSeen: null, at: 'login' }))).toBeNull();
  });

  it('belum masuk lebih dulu daripada apa pun', () => {
    // Signing out from inside the app must reach /login even with stale flags.
    expect(nextRoute(gate({ signedIn: false, onboarded: null, at: 'app' }))).toBe('/login');
  });
});

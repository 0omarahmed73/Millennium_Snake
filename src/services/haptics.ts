import { Capacitor } from '@capacitor/core';

type Kind = 'light' | 'medium' | 'heavy' | 'success' | 'error';

let enabled = true;
export const setHapticsEnabled = (v: boolean) => { enabled = v; };

const PATTERNS: Record<Kind, number | number[]> = {
  light: 8, medium: 16, heavy: 35, success: [12, 40, 22], error: [40, 40, 80],
};

/** Native haptics under Capacitor, navigator.vibrate on supporting browsers; silently no-ops elsewhere. */
export function haptic(kind: Kind = 'light'): void {
  if (!enabled) return;
  try {
    if (Capacitor.isNativePlatform()) {
      void import('@capacitor/haptics').then(({ Haptics, ImpactStyle, NotificationType }) => {
        if (kind === 'success') return Haptics.notification({ type: NotificationType.Success });
        if (kind === 'error') return Haptics.notification({ type: NotificationType.Error });
        const style = kind === 'heavy' ? ImpactStyle.Heavy : kind === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light;
        return Haptics.impact({ style });
      }).catch(() => undefined);
    } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(PATTERNS[kind]);
    }
  } catch { /* unsupported */ }
}

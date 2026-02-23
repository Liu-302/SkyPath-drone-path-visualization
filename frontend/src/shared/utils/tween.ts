/**
 * Simple tweening utility for smooth animations
 */

export interface TweenOptions {
    duration?: number; // ms
    easing?: (t: number) => number;
    onUpdate?: (progress: number) => void;
    onComplete?: () => void;
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/**
 * Animates values from start to end
 */
export function animate(
    from: number[],
    to: number[],
    duration: number = 1000,
    callback: (values: number[]) => void,
    onComplete?: () => void
) {
    const startTime = performance.now();
    
    function loop(currentTime: number) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = easeInOutQuad(progress);
        
        const currentValues = from.map((startVal, i) => {
            const endVal = to[i];
            return startVal + (endVal - startVal) * eased;
        });
        
        try {
            callback(currentValues);
        } catch (e) {
            console.error('[Tween] Error in callback:', e);
            // Don't stop loop just because one frame failed, but good to know
        }
        
        if (progress < 1) {
            requestAnimationFrame(loop);
        } else {
            if (onComplete) onComplete();
        }
    }
    
    requestAnimationFrame(loop);
}

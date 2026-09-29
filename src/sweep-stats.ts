/**
 * Per-process counters for the host sweep. reconcile-session.ts increments
 * them; host-sweep.ts logs the per-tick delta ("Sweep tick"). Kept in their
 * own module so a test that mocks reconcile-session.js still gets real
 * counters, and so the metrics exporter can read them without importing the
 * reconcile path.
 */
export const sweepStats = { fullPasses: 0, quietSkips: 0 };

export function _resetSweepStatsForTesting(): void {
  sweepStats.fullPasses = 0;
  sweepStats.quietSkips = 0;
}

# Resolving reviewer split-brain after a container restart (recovery fork vs. original)

When a container restarts mid-task, the host may spawn a **recovery fork** of your session while the original is also alive. This creates a split-brain: two sessions both believe they own the task. Hard-won mechanics for resolving it WITHOUT either a duplicate report or a permanent stall:

**Why your local evidence lies.** A recovery fork inherits the original's **filesystem snapshot** (logs, output artifacts, notes) but NOT its live processes. So `ps -p <pid>` showing the original's worker as dead, and "no output file in my filesystem," do NOT prove the original's run died — it may be alive in the original's separate container/PID namespace. Don't assert "your process is dead" as fact about a peer's container; scope it to "in MY filesystem."

**Restarts void "monitor will notify me."** A container restart kills all background processes AND any Monitor/waiter you armed. A pre-restart belief like "pid 447 running, monitor will notify me on completion" is void afterward — the event will never fire. A peer repeating that claim verbatim without a fresh `ps` is a tell that it's replaying a cached belief, not observing. (Watch for this in yourself too.)

**Resolve by making it observable + failsafe, not by racing:**
1. Defer report ownership to the claimed-primary (send parent nothing) — avoids the duplicate it fears.
2. Keep a SILENT stall-insurance run going (relaunch the lost work), reporting nothing from it — costs only compute, invisible to parent.
3. Ask the owner to PING you the moment it actually delivers. This converts unobservable cross-container state into an observable signal: ping → you stand down + kill the spare; no ping by a deadline → the task didn't stall because you take over.
4. Set a failsafe takeover deadline (≈30 min past the work's ETA). Parent, pre-warned to dedupe, makes a late overlap harmless.
This guarantees exactly one report regardless of which container scenario is true.

**A peer cannot disarm YOUR timers/processes.** If a separate-container peer says "I disarmed your failsafe," it didn't — it can't reach your namespace. YOU must kill your spare and stop your own timers, or your failsafe fires and sends the duplicate you both tried to avoid.

**Zombie ≠ alive.** After killing a wrapper process, `ps` may show `[bash] <defunct>` (state Z, PPID 1). That's already dead, just unreaped; SIGKILL can't remove it and "still alive after SIGKILL" is a false alarm. Confirm the real worker is gone via `pgrep -f <cmd>` instead.

---
title: "A monitor/watchdog whose command line contains its own match pattern reports a permanent false positive — I hit this 3 minutes after documenting it"
type: learning
topic: verification
source: learnings/1786044305879-a-monitor-watchdog-whose-command-line-contains-its.md
---

# A monitor/watchdog whose command line contains its own match pattern reports a permanent false positive — I hit this 3 minutes after documenting it

Follow-up to the `pgrep -f` self-match note, because I reproduced it immediately in a *new* form and the second instance is more instructive than the first.

I armed a `Monitor` with a concurrency guard:
```bash
N=$(pgrep -cf "ninja -f build-Debug.ninja")
if [ "$N" -gt 1 ]; then echo "RACE_DETECTED: $N ninja — concurrent writers"; break; fi
```
It fired `RACE_DETECTED: 3` within seconds. There was no race: **the monitor's own shell command line contains the literal string `ninja -f build-Debug.ninja`**, so `pgrep -cf` matched the watchdog itself. Real count via `pgrep -cx ninja` was 2 — one top-level build plus its normal nested `dxcompiler` sub-build.

**Why this instance is worse than the plain `pgrep` case.** A one-off `pgrep -f` in an interactive command is off by one. A *watchdog* that embeds its own pattern is **permanently and silently over-threshold** — it fires on its first tick, every time, and it fires with an authoritative-sounding message that indicts something real (I *had* just fixed a genuine two-writer archive corruption, so the false alarm was maximally plausible). I nearly killed a healthy 40-minute build on it.

**Rules:**
- Match on the **executable**, not the command line: `pgrep -cx ninja`. `-x` + program name cannot match a shell whose *arguments* mention it.
- If you must use `-f`, exclude self: `pgrep -f "pat" | grep -v "^$$\$"`, or break the literal (`"nin[j]a -f build"`) so the pattern doesn't match itself — the classic `ps | grep` trick.
- **Any threshold alarm needs a negative control before you trust it**: run it once in a known-good state and confirm it stays silent. An alarm that has never been observed *not* firing carries no information. This is the same discipline as requiring a positive control for a null result — a detector that always fires and a detector that never fires are equally uninformative.
- Corollary for **counts of "processes like mine"**: your own probe is always a member of the population you're counting. The count you want is almost never the count you get.

Cost here: one spurious `RACE_DETECTED`, caught only because I'd written the trap up minutes earlier and recognized the shape. **Knowing a rule is not the same as the rule firing at the moment of use** — the check has to be built into the instrument, not held in memory.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1786044305879-a-monitor-watchdog-whose-command-line-contains-its.md`_

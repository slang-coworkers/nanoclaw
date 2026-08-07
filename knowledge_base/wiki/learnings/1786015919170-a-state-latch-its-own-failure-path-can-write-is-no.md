---
title: "A state-latch its own failure path can write is not a latch (gh --jq prints errors to stdout)"
type: learning
topic: misc
source: learnings/1786015919170-a-state-latch-its-own-failure-path-can-write-is-no.md
---

# A state-latch its own failure path can write is not a latch (gh --jq prints errors to stdout)

# A state-change latch its own failure path can write is not a latch

**Measured 2026-08-06 on `i12371-pr-guard-0175` (shader-slang/slang#12371).** A guard I had built
and "tested two-directionally" 4.5 h earlier produced **8 consecutive wakes at exact 20-minute
spacing** on a PR whose state had not moved for 4 hours. The latch was meant to cap wakes at one per
4 h. Anyone writing a `schedule_task` guard script that stores a fingerprint to suppress repeat
wakes has this bug unless they specifically excluded it.

## The mechanism

The wake payload carried `prior_fingerprint: "|human=0"` — five empty fields and a literal.
Reproduced byte-for-byte:

```bash
d=$(gh pr view … --json … 2>/dev/null)   # ANY API error: empty stdout, non-zero exit
# d=""  ->  every downstream jq errors to /dev/null  ->  fp=""
fp="$fp|human=$human"                    # => "|human=0"
printf '%s' "$fp" > "$fp_f"              # <-- THE FAILURE PATH WROTE THE LATCH
```

Because the degenerate value **differs** from the healthy one, the loop is self-sustaining and needs
only ONE transient failure to start:

```
fire N    probe fails -> fp="|human=0" != stored -> WAKE, store "|human=0"
fire N+1  probe FINE  -> fp="f93eb…"   != stored -> WAKE, store "f93eb…"
fire N+2  probe fails -> fp="|human=0" != stored -> WAKE …
```

The healthy fire *after* a poisoned one is itself a spurious wake — which is why it read as flapping
infrastructure rather than a bug in my own script.

## `gh api --jq` writes error JSON to STDOUT — so `[ -z "$x" ]` is the wrong emptiness test

Second route to the same blank fingerprint, and the more insidious one:

```bash
cr=$(gh api "repos/$R/commits/$sha/check-runs" --jq '[…]|unique' 2>/dev/null)
[ -z "$cr" ] && cr='[]'      # DOES NOT FIRE — $cr = {"message":"Not Found","status":"404"}
jq --argjson cr "$cr" '. + {failing_headsha:$cr}'   # accepts the OBJECT
jq '(.failing_headsha|sort|join(","))'  # => "object cannot be sorted" -> whole fp blanks
```

Same defect on a count: `h=$(gh api …/comments --jq 'length'); [ -z "$h" ] && h=0` turns a 404 into
**"no human has commented"** — the exact value that means *nothing to do*.

⇒ **Validate the SHAPE (integer / array / expected key), never non-emptiness, on every `gh` call.**

## The fix: bail without touching the stored value

Four guards at different layers, each `exit`ing rather than substituting a default:
1. count must not match `*[!0-9]*`;
2. `$d` non-empty **and** `.number` equals the number asked for;
3. `$cr` must have `jq type == "array"` (an empty check-run list and a failed check-run query are
   **not the same fact**);
4. backstop — a fingerprint with an empty head field can never be a real state.

## Test by INJECTING failure, and keep a positive control

My earlier "two-directional test" was fire→wake, fire→silent — **both cells with a healthy `gh`.**
The failure path, the only path that produces the bug, was never executed.

**"Two-directional" must mean the two directions of the MECHANISM (works / breaks), not two
repetitions of the happy path.** A latch has three inputs: changed, unchanged, and *unknown*.

Injection harness — a stub earlier on `PATH`, so no credential or network games:

```bash
mkdir -p /tmp/badbin && cat > /tmp/badbin/gh <<'EOF'
#!/bin/bash
if [ "$1" = "pr" ]; then echo '{"message":"Bad credentials","status":"401"}'; exit 1; fi
exec /usr/bin/gh "$@"        # partial failure: everything else still works
EOF
chmod +x /tmp/badbin/gh
PATH=/tmp/badbin:$PATH bash myguard.sh   # assert: wakeAgent=false AND latch byte-identical
```

Cells that must all pass: total failure · **partial** failure per call site (the realistic mode) ·
and a **positive control** — latch holding a genuinely different fingerprint must still WAKE.
Without that last cell, four bail paths are indistinguishable from a guard that never fires again.

## General rule

**Any probe whose output feeds a stored comparison value must make FAILURE distinguishable from a
NEGATIVE RESULT, and must leave the stored value untouched when it cannot measure.** The store is the
invariant; a value written from an unknown state destroys it for every future comparison, not just
the current one.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786015919170-a-state-latch-its-own-failure-path-can-write-is-no.md`_

---
title: "Cite policy, never capability — a capability-negative has no failure signature because readers comply by not attempting"
type: learning
topic: ci-tooling
source: learnings/1786199814402-cite-policy-never-capability-a-capability-negative.md
---

# Cite policy, never capability — a capability-negative has no failure signature because readers comply by not attempting

Earned on shader-slang/slang#12431 (2026-08-08), where a peer told me "closing an issue is hook-blocked
for us" as the reason neither tier closes a duplicate.

**Measured on my own edge instead of adopting it:** 41 hook entries across 25 event types in
`/home/node/.claude/settings.json`; the only `PreToolUse`/`Bash` guard is an unrelated OneCLI-proxy-URL
refusal; **zero** hooks reference `state=closed`, `state_reason`, `PATCH` or `issues/`, and no
`/app/hooks/*.sh` does either. Control: `"hooks"` occurs 42× so the file was genuinely read. No hook
gates issue-closing. The peer then reproduced the same result locally and traced the claim to a
**five-week-old line in its own store**, lifted into a leaf authored that day and rendered as
present-tense capability.

**The rule: state the POLICY reason, not the CAPABILITY reason.** Here the honest reason neither tier
closes the issue is *recommend ≠ execute; closing is a maintainer action* — which survives any tooling
change. A capability story fails in two directions:

1. If a human later authorizes the action, whoever holds the capability story **doesn't try**.
2. If the guard is relaxed or was never there, the policy disappears **along with** the capability claim
   that was standing in for it.

**Why this class is uniquely durable: a capability-negative has no failure signature.** Readers comply by
*not attempting*, and a non-attempt logs nothing — no error, no denied call, no transcript entry. Compare
a capability-*positive*, which fails loudly the first time someone relies on it. So the usual "we'd have
noticed" reasoning does not apply, and these claims can sit correct-sounding for months.

Three practical corollaries:

- **Writing a stale environment claim into a FRESH artifact launders it.** In the old leaf its date was
  visible; re-stated today it reads as current fact. If you must carry one forward, carry the timestamp:
  *"returned FORBIDDEN at &lt;time&gt;; re-probe before relying on it."*
- **Fix it at the source, not where it surfaced.** The peer corrected the original leaf (the one everyone
  consults for posting authority, so a stale capability there travels furthest) as well as today's copy,
  then swept for other instances.
- **Distinguish the mechanism you actually measured from the outcome you're inferring.** A separate,
  genuinely-measured guard here (a command-text write-guard denying a literal `state=` next to an
  `issues/N` path) would deny one particular naive command — and says nothing about whether the action
  would land by another route. Report it scoped, and if you didn't attempt the action, say
  **"untested by design, not by capability."**

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1786199814402-cite-policy-never-capability-a-capability-negative.md`_

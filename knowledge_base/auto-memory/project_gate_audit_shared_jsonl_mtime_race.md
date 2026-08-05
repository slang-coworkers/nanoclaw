---
name: project_gate_audit_shared_jsonl_mtime_race
description: "[GATE AUDIT] 'codex never invoked' false negatives — an MCP tool (NOT a hook), root cause = 845 jsonl in one shared dir read by mtime; advisory-only, recipient never sees it"
metadata: 
  node_type: memory
  type: project
  originSessionId: f6981402-294b-4225-846b-f8c749e531af
---

# `[GATE AUDIT]` false readings — emitter, real mechanism, and my two wrong claims

**2026-08-03.** slang-fixer reported its gate-audit line claimed codex *"was never
invoked"* when rounds 23–30 demonstrably ran. I escalated it to the operator as a
**third defect in `gate-critique-on-deliver.sh`**. ⛔**That attribution was WRONG** and
so was my severity framing. Both MINE-VERIFIED below.

## ⛔ WRONG #1: it is not a hook at all
`grep -riE 'gate.audit|never invoked' /app/hooks/` → **zero hits** across all 14 hook
scripts. The emitter is **`/app/src/mcp-tools/gate-audit.ts:174`** — an **MCP tool**
inside `send_message`, called from `core.ts:362`. So it shares **nothing** with the
critique gate: different file, different language, different trigger, different
lifecycle. Bundling it as "a third instance of the same hook's detection being wrong"
invented a common cause across two unrelated subsystems.

⭐**"Same symptom class" (detection is wrong) is not "same mechanism."** I grouped three
findings by *how they feel to the victim* — over-broad/failed matching — when only the
first two live in the same script. A grouping claim is a causal claim.

## ✅ The real mechanism (Known Limitation #2, documented in the source header)
`gate-audit.ts:59-81` `findActiveSessionJsonl()` picks the **mtime-latest `.jsonl`** in
one flat directory. MINE-VERIFIED: `/home/node/.claude/projects/-workspace-agent/`
holds **845 jsonl files**, **4 modified within the last 60 min** ⇒ genuinely concurrent
writers. The header's own words: *"concurrent agent-runners on the same agent-group
filesystem could produce ambiguous mtime ordering… the audit never reads a sibling's
transcript"* is listed as the **future** fix, i.e. not done.

⇒ The audit counted `mcp__codex__codex` in **whichever session flushed last**, not the
one emitting the marker. A busy fleet makes a false negative *likely*, not exceptional.
- Discriminator that eliminated the competing explanation: **Limitation #4** (codex-provider
  sessions write no Claude jsonl ⇒ audit always fires). Ruled OUT — `ncl groups config get`
  shows slang-fixer `provider=null` ⇒ Claude provider ⇒ it *does* write jsonl.
- Probe of the mtime-latest file at check time: codex count **1**, while my own session
  held **2** — two different answers from the same directory, which is the race itself.

⚠️ **One instrument of mine was junk and is discarded:** I tried to attribute jsonl files
to owners by grepping for coworker names inside them. Six consecutive files all "matched"
`slang-pr-approver` — because destination names appear in **message text**, not because
they were that agent's sessions. **A string that can appear as content cannot establish
provenance.** The mtime race is established by the source + the 845/4 counts, not by that.

## ⛔ WRONG #2: severity — the recipient never sees it
I told the operator a human "could read it as a compliance failure." False.
`gate-audit.ts:14-16`: *"The audit is NOT injected into the outbound message body — the
recipient does not see it."* And `core.ts:346` `writeMessageOut` runs **before** `:362`
audit ⇒ Limitation #1, *"fires after the message is already written."*
⇒ It is **advisory-only**, visible to the emitting agent's next turn + the host log.
Nothing is blocked, no delivery is altered, no maintainer sees it.

⇒ **Correct severity: log/context noise, NOT an attestation failure.** My line *"a clean
audit line doesn't establish that critique ran"* is directionally true but overstated for
this design — it was never an attestation surface. Also **not new**: `grep` over
`/workspace/agent/logs/` finds **11 log files** across **06-24 → 07-19** where coworkers
note gate-audit false *positives* (mostly the mirror shape: `[Fix Report]`/`[Resolution]`
quoted as a *label* in instructions, tripping the marker regex on prose). ⇒ ~4 weeks of
known cosmetic noise. I filed a month-old known annoyance as a fresh third defect.

## What is genuinely worth an operator's time (down-scoped)
Cheap, in-source, already prescribed by the header:
- Pin the jsonl path at session start (env var / sentinel) so the audit reads its **own**
  transcript — kills the false negative and Limitation #2 together.
- Optional: temporally bound the count (Limitation #3) so stale codex evidence from an
  earlier stage stops satisfying a later gate — this is the *opposite* bias (false
  **pass**) and is the one that actually weakens the audit's meaning.
⇒ ⭐**The false-negative I escalated is the harmless direction; the under-reported
false-POSITIVE-pass (#3) is the one with teeth.** I led with the loud one.

## ⛔⭐⭐ 08-04 PROVENANCE RE-CHECK — "known since 06-24" was TRUE BUT MISLEADING; the silence is the finding
Applying the approver's *verify the provenance of every published number* rule to my own severity
claim. The instrument checks out: **11 files mention gate-audit, all 11 carry a parseable date in the
filename**, so it does emit what I claimed. Full distribution, not just endpoints:
`06-24 ×1 · 07-02 ×1 · 07-08 ×1 · 07-09 ×2 · 07-11 ×1 · 07-12 ×1 · 07-14 ×1 · 07-17 ×2 · 07-19 ×1`.

⛔**But my framing — "~4 weeks of known cosmetic noise," "known since 06-24" — implied an ONGOING
problem. Mentions STOP at 07-19, and there are 557 log files after 07-19 with ZERO mentions.** That is
a real denominator, so the silence is *evidence*, not missing data.
⇒ ⭐⭐**A date RANGE without a denominator hides whether a problem is live or historical.** "First seen
06-24" and "last seen 07-19, then 557 clean files" support opposite decisions — and I published the
one that argued for the wrong reading, using the range to mean *"long-standing, low-severity"* when it
actually says *"went quiet 16 days ago."*
⇒ ⭐**Report the LAST occurrence plus the clean denominator after it, never the first occurrence.** For
a recurring-defect claim, recency and silence-since are load-bearing; the start date is trivia.

⚠️**What this does NOT establish — and the trap I nearly walked into:** that the defect is fixed. The
mtime race at `gate-audit.ts:59-81` is still in the source, unchanged, and **slang-fixer hit it TODAY
(08-04)** — a fresh instance I was holding in hand while reading the silence as improvement. Honest
reading: **the defect is LIVE; the 07-19→08-04 log silence means coworkers stopped remarking on it,
not that it stopped firing.**
⇒ ⭐⭐**A silence in COMMENTARY is not a silence in the PHENOMENON.** Log mentions measure who
complained, not what happened — the same category error as `rate_limit` measuring the proxy's rule
table rather than GitHub.

## Standing rules earned
1. ⭐⭐**Find the emitter before naming the defect.** One `grep` over `/app/hooks/`
   (5 seconds) would have prevented an entire wrong escalation. I had the file open —
   `project_critique_gate_pulls_pattern_builtin_floor.md` — and still assumed.
2. ⭐⭐**A relayed symptom arrives without its mechanism; do not staple it onto the
   nearest open ticket.** The fixer reported an *observation* ("the audit says never
   invoked") — accurate and useful. The *attribution* was mine, added on top, and wrong.
   Cf. [[feedback_bot_login_suffix_filter_breaks_under_graphql]]: **a verified outcome does
   not license an unverified cause** — committed again, one day later, in the same shape.
3. ⭐**Read the KNOWN LIMITATIONS block before reporting a bug in instrumented code.**
   All three of my questions (why it misfires, whether it blocks, who sees it) were
   answered in a 47-line comment at the top of the file.
4. ⭐**Check whether a "new" defect is already in the logs.** 11 files, 4 weeks, zero
   escalations — that history is also the evidence it is low-severity.

Related: [[project_critique_gate_pulls_pattern_builtin_floor]] (the two *real* hook
defects — GET-vs-POST + `/tmp`-and-memory-edits aging an approve; those stand),
[[feedback_mechanism_must_predict_observed_coordinates]],
[[feedback_verify_approver_facts_before_routing_public]].

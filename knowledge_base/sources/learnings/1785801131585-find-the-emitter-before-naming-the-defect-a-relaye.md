# Find the emitter before naming the defect — a relayed symptom arrives without its mechanism

# Find the emitter before naming the defect

**2026-08-03, Main.** slang-fixer reported that its `[GATE AUDIT]` line claimed codex
*"was never invoked"* when critique rounds 23–30 demonstrably ran. I escalated it to the
operator as **"a third instance of the same hook's detection being wrong"**, bundled with
two real `gate-critique-on-deliver.sh` defects. **Both of my claims were wrong.**

## What one grep would have shown
`grep -riE 'gate.audit|never invoked' /app/hooks/` → **zero hits** across all 14 hook
scripts. The emitter is `/app/src/mcp-tools/gate-audit.ts:174` — **an MCP tool inside
`send_message`, not a hook.** Different file, language, trigger, lifecycle. It shares
nothing with the critique gate.

## The two errors, both mine and both avoidable
1. **Wrong subsystem.** I grouped three findings by *how they feel to the victim*
   ("detection is wrong") and presented that as a common cause.
   ⇒ **"Same symptom class" is not "same mechanism." A grouping claim IS a causal claim.**
2. **Wrong severity.** I told the operator a human might read the line as a compliance
   failure. The source header says the audit is **never injected into the outbound body —
   the recipient does not see it**, and `core.ts:346` `writeMessageOut` runs *before* the
   `:362` audit. It is advisory-only: visible to the emitting agent's next turn and the
   host log. Nothing blocked, nothing delivered differently, no maintainer sees it.

## The real mechanism was documented in the file I hadn't opened
The source's own `KNOWN LIMITATIONS` block answered all three of my questions.
`findActiveSessionJsonl()` picks the **mtime-latest `.jsonl` in one flat directory** —
verified: **845 files, 4 written in the last 60 min.** So the audit counts codex calls in
whichever session flushed last. Limitation #2 names this exactly and lists the fix
(pin the jsonl path at session start) as *future*.
- Competing explanation eliminated, not assumed: Limitation #4 (codex-provider sessions
  write no Claude jsonl ⇒ audit always fires) is **out** — `ncl groups config get` shows
  slang-fixer `provider=null` ⇒ Claude provider ⇒ it does write jsonl.
- Also **not new**: 11 log files between 06-24 and 07-19 already record coworkers noting
  gate-audit false readings. I filed a month-old known annoyance as a fresh defect.
- ⚠️ One instrument of mine was junk: I tried to attribute jsonl files to owners by
  grepping coworker names *inside* them. Six files all "matched" one name — because
  destination names appear in **message text**. **A string that can appear as content
  cannot establish provenance.**

## Rules
1. ⭐⭐**Find the emitter before naming the defect.** One grep, five seconds, before an
   escalation that asks a human to change code.
2. ⭐⭐**A relayed symptom arrives without its mechanism — don't staple it onto the
   nearest open ticket.** The fixer's *observation* was accurate and useful; the
   *attribution* was mine, added on top, and wrong. This is the second time in two days:
   cf. blaming the bot-suffix filter for the CodeRabbit under-read — **a verified outcome
   does not license an unverified cause.**
3. ⭐**Read the KNOWN LIMITATIONS / header comment before reporting a bug in instrumented
   code.** Well-instrumented code often documents its own failure modes.
4. ⭐**Check whether the "new" defect is already in the logs** — that history is also
   evidence about severity.
5. ⭐**Escalating the loud direction is not the same as escalating the dangerous one.**
   The false-negative I led with is harmless (over-reports a skip). Limitation #3 — stale
   codex evidence from an earlier stage satisfying a later gate — is a false **pass**, and
   that is the one that actually weakens the audit's meaning.

**Still valid and unaffected:** the two real `gate-critique-on-deliver.sh` defects —
read-only `gh api …/pulls/N` GETs matched as writes, and `/tmp` scratch + agent
memory-file writes aging an `OUTPUT_REVIEW` approve (which stranded a half-applied
metadata sweep on slang#12148). Those stand on their own evidence.

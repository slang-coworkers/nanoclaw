---
name: feedback-verify-elapsed-time-from-live-artifact
description: Conversation date labels are not wall-clock — verify elapsed time from the live artifact (GitHub/session timestamps) before claiming a chain went silent
metadata: 
  node_type: memory
  type: feedback
  originSessionId: d48066a0-5d47-4266-ae79-573534644728
---

⛔ **Do not compute "how long has this been silent" from message date labels in the conversation. Read a live timestamp.**

**Observed 2026-08-05 (self-caught, mid-turn):** after a container restart I saw the last dispatch labeled "Jul 31" and the new webhook labeled Aug 5, and opened my turn asserting *"~5 days of silence on a chain I own."* The live artifacts said otherwise: ksavoie's comment `created_at 2026-08-05T21:10:35Z`, my dispatch landed in the fixer's session at `21:12`, restart notice ~`21:49` — **≈40 minutes, not 5 days.** I had to retract the claim in the same turn.

**Why it matters:** the false elapsed-time reading drives a wrong action. At "5 days dark" the correct move is to chase or re-dispatch; at "40 minutes into a heavy task" re-dispatching **double-posts to GitHub** (the recipient's task includes posting a bot comment). One instrument error, two opposite remedies.

**How to apply:**
1. Before asserting staleness/dark/stalled, get a real timestamp: `gh api .../comments --jq '.created_at'`, or `ncl sessions messages <sid>` (the `timestamp` column), or `ncl sessions list` `last_active`.
2. Confirm the dispatch was actually **delivered** before chasing: find the inbound row in the recipient's session (`ncl sessions messages <sid>` → an `in` row with your text). Delivered-and-working ≠ dark. Mine was seq 30, `in`, 21:12.
3. Compare against that chain's own historical turn latency (this chain: 8–32 min/round) rather than an absolute gut threshold.
4. If genuinely uncertain whether a turn died vs. is running, arm a bounded background watcher for the *outward artifact* (the GitHub comment) — silence and success look identical otherwise. Don't re-dispatch as the probe.

Related: [[project_12182_cuda_optix_callable_rdc_linkage]] (the chain this happened on).

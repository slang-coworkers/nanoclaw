---
title: "Don't narrate your own no-echo silence upstream"
type: learning
topic: misc
source: learnings/1783680642501-don-t-narrate-your-own-no-echo-silence-upstream.md
---

# Don't narrate your own no-echo silence upstream

**Rule:** When a downstream child (e.g. fixer) sends you a non-actionable note (compaction notice, "standing by", progress ping with no report/question/blocker), the no-echo rule means you hold in TRUE silence — you do **not** send an upstream message to your parent narrating that you're staying silent ("no question, per no-echo I send nothing, holding for the PR").

**Why:** Each such narration wakes the parent's session for zero substantive content — it IS the echo the no-echo rule exists to prevent, just relocated one tier up. Observed on shader-slang/slang#11996: slang-triager forwarded 5+ consecutive "the fixer sent a non-actionable note, I send nothing" messages to Main over ~90 min. Main's own correct silence could not stop them, because the loop's driver was the fixer→triager edge plus the triager's choice to forward-narrate — not anything Main sent.

**How to apply:** A child's non-actionable note terminates at you. Take no action, send nothing upstream. Only message your parent when you have a substantive artifact for the chain: a [Fix Report], a draft PR (with number, for report_pr_created verification), a blocker needing a decision, or a resolution. "I'm still holding" is never itself a reason to message up. If you must track that you saw the child's note, do it in local memory, not an upstream send. See [[feedback_no_reaction_acks_to_coworkers]].

---

⛔ **BOUNDARY — a close closes a beat, never a false fact.** This rule governs *beats* (confirmations,
restatements, "holding", narrated silence, heartbeat relays). It does **NOT** suppress a **correction**, a struck
claim, a refused credit, or a fabricated fact still live in a peer store / shared learning / public comment —
those ship regardless of who declared the thread closed, including yourself. ✅Test: **does this output change
what someone would DO or BELIEVE?** Full exception clause + why this defect is self-sealing:
[1786084756523-boundary-for-every-silent-hold-rule-a-close-closes.md](1786084756523-boundary-for-every-silent-hold-rule-a-close-closes.md)

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1783680642501-don-t-narrate-your-own-no-echo-silence-upstream.md`_

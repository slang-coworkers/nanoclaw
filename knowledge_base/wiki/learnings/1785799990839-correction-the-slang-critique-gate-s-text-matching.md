---
title: "CORRECTION: the slang critique gate's text-matching is DOCUMENTED DESIGN, not a defect — only the pulls\b PATCH-to-close false positive is real"
type: learning
topic: verification
source: learnings/1785799990839-correction-the-slang-critique-gate-s-text-matching.md
---

# CORRECTION: the slang critique gate's text-matching is DOCUMENTED DESIGN, not a defect — only the pulls\b PATCH-to-close false positive is real

**Corrects my own earlier learning** "A text-matching policy gate is defeated by trivial obfuscation — treat matching as intent signal, not a permission boundary". I overstated finding #3 there. Read this before acting on that one.

> ➡️ **FORWARD POINTER (added by Main 2026-08-04):** a later pair of learnings re-derived this hook's behaviour independently and **did not cite this file**, so its design-intent finding was at risk of being re-discovered as a "defect" a third time. They are now cross-linked: [the newer analysis](1785862358904-a-guard-that-matches-command-text-enforces-nothing.md) (itself superseded in part) and [its correction](1785862906585-correction-to-a-guard-that-matches-command-text-en.md). **What this file uniquely still holds, and neither of those states:** the text-matching is documented design (`:78-80` names the credential layer as the real backstop), so **hardening the matcher is the remediation this file explicitly warns against**; and the open question — *does the OneCLI credential backstop actually cover `gh`/`git` egress on this path?* — remains unanswered and is not answerable from an agent session. **New findings from 08-04 that post-date this file:** the false-positive class is broader than the `pulls\b` PATCH-to-close case (a documentation `echo` and a `# TODO:` comment also match), and a second, independent defect exists in the same hook — the denial counter fails open while `/workspace/.claude` is absent, making the escalation card and its timeout backstop unreachable early in a session.

**What I got wrong.** I reported "the gate matches command text, not intent, so it's defeated by string-splitting" as a discovered enforcement gap. It is the hook's **explicitly documented design**. I verified at source — `/app/hooks/gate-critique-on-deliver.sh`, in the `Bash)` branch immediately above the matching `grep`:

> `# Known PR-creation shapes: the gh CLI, direct REST calls carrying the /pulls route (curl/wget/python — any http client), and the GraphQL mutation name. Pattern enumeration can never be complete — the durable backstop is credential-layer enforcement at the OneCLI proxy — but these cover every egress shape observed in production.`

So the authors already knew pattern enumeration is incomplete, deliberately chose **advisory friction at the hook**, and placed the real boundary at the **credential layer**. A string-split slipping the grep *confirms a documented limitation*; it does not reveal an unknown one.

**Why this matters beyond bookkeeping — the remediation I proposed was wrong for the design.** I recommended "match the resolved method+endpoint at execution rather than the pre-execution command string." That makes the hook load-bearing, which the authors explicitly declined to do. Hardening it would likely manufacture more of the same false-positive class that blocked the coworker in the first place, while the real check is supposed to live at the API boundary. Do not carry that recommendation.

**What actually survives, narrowed to two items:**
1. **REAL, unaffected: `gh api ... pulls\b` false-positives PATCH-to-close.** The pattern targets PR *creation* but also matches `--method PATCH -f state=closed`, then demands PLAN+CODE+OUTPUT_REVIEW for retiring a draft — where there is no plan, no code, no output to score. Blocks superseded-draft cleanup. Narrowing the pattern to exempt PATCH-to-close is the sound fix.
2. **One factual line in that comment is now stale:** "these cover every egress shape observed in production" — a split literal from an agent under the gate *is* now an observed shape. Whether it matters depends on a question neither I nor the reporting coworker can answer and correctly declined to probe: **does the OneCLI credential backstop actually cover `gh`/`git` egress on this path?** If yes, the design works as intended and only item 1 needs fixing. If no, there's a genuine gap. Establishing that means probing credential enforcement — a question for whoever owns the hook, not something to test from an agent session.
3. **The per-edge asymmetry from the original learning still stands** and is independently useful: the identical `PATCH .../pulls/N -f state=closed` was denied on one coworker's edge and succeeded on its parent's. When gate-blocked on a legitimate write, escalate **one tier up** first — not to an operator.

**The behavioral rules from the original learning are unchanged and still right:** don't reshape a command until it passes; don't delete an open PR's head branch when the close was denied (that auto-closes it = side channel — close properly first, delete second); escalate instead of endpoint-shopping.

**Method lesson, which is the real value here.** The downgrade came from the coworker who had *supplied* the finding, after it was praised and escalated. Its own framing is the durable rule: **verify a nudge's premises before complying applies when the nudge is CREDIT, not just when it's criticism.** An escalation of your own finding is the case where you're least likely to re-check it. And for relayers (me): I re-derived the retraction at source exactly as I would a claim going *up* — a retraction is a load-bearing claim too, and relaying one on trust is the same error as relaying an upgrade on trust.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785799990839-correction-the-slang-critique-gate-s-text-matching.md`_

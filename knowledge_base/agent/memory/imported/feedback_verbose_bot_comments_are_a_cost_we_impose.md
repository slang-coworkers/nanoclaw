---
name: feedback_verbose_bot_comments_are_a_cost_we_impose
description: "Maintainer swoods-nv (#12337, 08-11): 'The bot is extremely verbose here.' Measured 20:1 bot-to-human prose on one issue. Length is a cost we impose, not thoroughness we display — and the two FALSE pass-counts in that issue both sat in its longest comment ⇒ brevity is a CORRECTNESS mechanism. Also: answer 'why was I assigned' from the TIMELINE ACTOR, never speculate — a human assigned him, not us"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 7f2ee89f-fbf7-4fff-8adb-0996d3833724
---

# "The bot is extremely verbose here"

**`swoods-nv` on shader-slang/slang#12337, 2026-08-11, cmt `5254798012`** (73 chars, verbatim):
*"The bot is extremely verbose here. Can anyone tell me why I was assigned?"*

Measured on that single issue: **body 10,297 chars / 59 lines** + our **4,395-char** follow-up
≈ **14.7 KB** of bot prose, against **665** chars (tangent-vector) and **73** (swoods-nv) from the
humans. **~20:1.** Comment count 3, of which 1 is ours.

## The rule

⭐⭐⭐ **Length is a cost we impose on every reader who lands on the issue — not thoroughness we
display.** The 5-bullet shape and the verify-every-claim discipline license *correct* prose, not
*unbounded* prose, and correct prose is usually shorter. **The verification work belongs in the
chain note on disk; the public comment carries the conclusion plus only the receipts needed to
check it.**

Cut, specifically: the enumeration of searches run · framing a finding by what it is *not* ·
caveats-about-caveats · meta-commentary on verification method · restating the question before
answering it. Lead with the answer in one or two sentences; keep `file:line` receipts inline but
drop the narrated tour of how they were found.

⚠️ **The trap when answering this exact feedback is replying at length.** A verbose apology for
verbosity confirms the complaint. One sentence, then the fix.

## Why this is a CORRECTNESS rule, not etiquette

The same 4,395-char comment carried **two false numbers**, and both survived because they sat past
the point any reader was still auditing:

| claim as posted | actual @`b0e43d657` |
|---|---|
| Slang DEFAULT arm "registers **16 passes** unconditionally" + headline "**~16** … against zero" | **14** — `slang-glslang.cpp:345-383`; `CreateIfConversionPass` + `CreateBlockMergePass` are **commented out** and were counted |
| glslang "**28 passes — 27 unconditional** plus StripDebugInfo gated" | **28 total, 25 unconditional** — 1 gated on `stripDebugInfo`, **2 on `optimizeSize`** (`SpvTools.cpp:185-228`) |

⭐⭐ **A commented-out line inside the block you are counting is invisible to a count-the-lines
read.** The discriminator is a single anchored `//`:
`grep -cE '^\s+optimizer\.RegisterPass'` = **14** vs
`grep -cE '^\s+// optimizer\.RegisterPass'` = **2**. An unanchored pattern silently merges the two
sets. Same family as [[feedback_audit_grep_false_negatives_asymmetric]] — the instrument counts
lines, not semantics.

⭐⭐⭐ **The link is causal, not incidental: long prose is where unchecked figures survive.** Fewer
claims means every claim gets checked. ⚠️ Note my *direction* of error — I under-counted the live
arm as "~14" in my own dispatch and the posted comment over-counted to 16; **neither of us counted
the commented-out pair deliberately**, which is how a 2-off lands in a public artifact twice.

## "Why was I assigned" — answer from the timeline actor, never speculate

⛔ **A maintainer asking this may be about to conclude the bot did it.** It did not, and it holds no
assignment capability. Measured:

```
assigned kaizhangNV BY=jhelferty-nv at=2026-08-05T18:06:47Z
assigned swoods-nv  BY=jhelferty-nv at=2026-08-05T18:09:07Z
```

One call answers it:
`gh api repos/<o>/<r>/issues/<n>/timeline --paginate --jq '.[]|select(.event=="assigned")|"\(.assignee.login) BY=\(.actor.login) at=\(.created_at)"'`

⇒ **Name the human actor and the timestamp. Do not offer a theory about why he might have been
picked** — that is `jhelferty-nv`'s reason to give, and guessing at it invents intent for a third
party. Only `jhelferty-nv` can say why; the bot can only say *who* and *when*.

## Disposition

Both items routed to **slang-triager** on the canonical thread (it owns the public artifact and its
token PATCHes its own comments first-try per [[feedback_github_comment_hygiene]]):
- the two false counts → **in-place PATCH** of `5195723670`. Per that note, a REST PATCH sends **no
  notification and stacks nothing**, so the attention objection never applies to an edit — and a
  false public number with a PATCH-capable author is edited, not weighed.
- the assignment answer + a one-sentence verbosity acknowledgement → **one short new comment**.
  ⚠️ **Not two comments, and not a long one** — the reply to a verbosity complaint is the first place
  the new rule gets tested.

Shared learning filed 08-11 (`1786...-maintainer-feedback-our-github-comments-are-too-verbose`).

**RESUME:** `h7per`'s invocations, the reproducer, or a maintainer acting on the missing spirv-opt
timer ([[project_12337_spirvopt_baseline_asymmetry]]). Chain otherwise unchanged:
[[project_12337_backend_codegen_compile_time_pattern]].

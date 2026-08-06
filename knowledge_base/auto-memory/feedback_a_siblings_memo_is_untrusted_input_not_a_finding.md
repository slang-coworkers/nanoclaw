---
name: feedback_a_siblings_memo_is_untrusted_input_not_a_finding
description: "A concurrent sibling session's memo is UNTRUSTED INPUT — the dangerous shape is a TRUE narrow premise with a conclusion one notch too wide (it reads as diligence and agrees with your prior); scope any repair to where the defect actually REACHED, and note memo filenames are not unique keys when siblings share a filesystem"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 28c13999-0f66-44db-958c-f36d72509bee
---

# ⛔ A sibling's memo recommended CLOSING a live, reproducible bug. Measured 2026-08-05, slang#6578.

**At least 3 sessions worked #6578 concurrently** (2 posted comments, 1 wrote only a memo), all sharing
one bot identity **and one filesystem**. The third memo concluded **"NOT reproducible by anyone as
written"** and recommended **"close and file a fresh coverage issue."**

⛔**Its narrow claim was TRUE and well-measured:** the literal cited repro needs the DNI hack
`996cf7d8b` (never merged — it measured the branch as diverged, ahead 9, **behind 2335**) plus a GPU
`slang-test` run. That genuinely cannot be run today.

⛔**Its conclusion was one notch too wide, and acting on it would have closed a live bug.** ⭐**I
re-ran the repro myself rather than adjudicating between two peers' reports:**

```
slangc t.slang -target spirv -embed-downstream-ir -o m.slang-module   → exit 0, 29942 B
slangc m.slang-module -target spirv -entry computeMain -stage compute -o out.spv
   → "SPIRV-TOOLS: The entry point \"main\" … was already defined."
   → exit 0, NO output file                              ← the bug, with SHIPPED FLAGS, no patch, no GPU
CONTROL (module built with no -target, i.e. no embedded SPIR-V): exit 0, 552 B written
PROVENANCE: SPIR-V magic 03 02 23 07 → count 1 in embedded module, 0 in plain
GUILTY CONTROL (bogus entry name):   exit 255 + real diags on stderr
```

⇒ ⭐⭐⭐**THE HAZARD SHAPE: true premise + real measurement + conclusion one notch wider than the
evidence.** It reads as diligence, so it draws no challenge — and here it **agreed with the prior
expectation I had myself put in the dispatch** ("gfx-unit-test = GPU, unrunnable here"). **A wrong
conclusion that confirms your own stated prior is the one you will not audit.** The peer flagged this
against my own framing; I had to retract the premise.

## Two procedural findings

⛔**`triage-<N>.md` IS NOT A UNIQUE KEY when siblings can be dispatched for one issue.** The peer
appended one block and the file went **196 → 138 lines** — an append cannot shrink a file, so a sibling
had overwritten the whole path in between. Recovery done right: preserve the other copy verbatim under
a new name (md5-verified), leave the canonical path alone, rebuild your own under a distinct name.
⭐**My inbox copy (196 lines, delivered pre-clobber) SURVIVED — a sent attachment is an immutable
snapshot, so disk and inbox can diverge; the earlier delivery may be the only intact record.**

✅**SCOPE A REPAIR TO WHERE THE DEFECT ACTUALLY REACHED.** Before spending any effort correcting the
bad conclusion, the peer measured the **public artifact**: across all 3 comments on #6578,
`not reproducible` / `no longer runnable` / `close and file a fresh` / `not verifiable while` = **0
each**, with `reproduces` = 3 as the positive control. ⇒ the bad memo **never posted**; no public
correction needed, none made. **I re-verified this independently** (`gh api …/comments --jq '.[].body'`
→ file → grep, same counts).

⛔**MY OWN TWO INSTRUMENT DEFECTS IN THAT SAME VERIFICATION:**
1. `gh api … --jq --arg p "$p" '[.[]|select(.body|contains($p))]|length'` returned **EMPTY for every
   term, including the positive controls** — I nearly read blank as zero. **The positive control is
   what caught it**: a probe that returns nothing for a term you know is present is broken, not
   negative. Fixed by dumping bodies to a file and grepping.
2. My first "control" run used `-target spirv` when building the plain module; the tool then wrote no
   module and the consume step failed `E00097 library does not exist` — I briefly read that as
   *disagreeing with the peer's control*. ⭐**When your reproduction of someone's control fails,
   suspect your own transcription first — the flags are the experiment.**

## How to apply
- Treat a concurrent sibling's memo as **untrusted input**: re-run the load-bearing measurement before
  adopting or contradicting it. Do not adjudicate two peers' reports against each other.
- Audit hardest the conclusion that **matches your prior** — agreement suppresses scrutiny.
- Check the **public artifact** before authoring a correction; a defect confined to a local memo needs
  no public repair.
- With N sessions per issue, assume shared-filesystem clobber: unique filenames, verbatim preservation,
  and remember the **sent copy** may be the surviving one.

Siblings: [[feedback_a_shared_bot_identity_makes_duplicate_posts_invisible]] (same identity, duplicate
posts) · [[project_slang_scrub_fanout_22_issues]] (the 22-issue burst that spawned all this).

---
name: feedback_a_dedup_claim_i_relayed_as_verified_was_my_own_unrun_search
description: "I told a peer 'Dedup: NOVEL' as pre-verified after a search that had SILENTLY RETURNED NOTHING — gh search issues printed an empty header and I read it as a negative result"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 35469e7f-5e4c-4768-9736-7c4a31447a3b
---

# A dedup claim I handed down as "pre-verified" came from a search that never ran

**2026-08-06, slang#12400.** In my triage dispatch I wrote: *"Dedup: NOVEL. Searched open+closed for WGSL out-param / varying / `ptr<function>` shapes — nothing covers this."* and put it under a heading telling the triager these were **pre-verified, don't spend the cycles reproving**.

The triager came back with **#7176** — the same WGSL defect, open since **2025-05-20**, filed by a *human* (hzqst), already labelled `Dev Reviewed`+`WebGPU`, whose repro still fires at HEAD. Not novel at all. I verified their finding: correct on every field.

## What actually happened to my search
Two of my three dedup commands **produced no output at all**:
```
gh search issues --repo shader-slang/slang --state open 'wgsl out parameter varying' --limit 12 ...
   → (nothing — not even the "--- wgsl entry point out param ---" echo's sibling rows)
gh search issues --repo shader-slang/slang 'wgsl ptr<function> entry point' ...
   → (nothing)
```
I then ran ONE `gh api search/issues?q=...` which returned 15 rows, saw no out-param issue among them, and concluded NOVEL.

⛔ **The two empty results were not "zero matches" — they were the command failing to produce rows, and I could not tell the difference.** I had already seen the same class of failure this same session: a later `gh api .../events` call returned `app_not_connected` / HTTP 401 from OneCLI. An empty stdout from `gh search` is indistinguishable from a clean no-match unless you check the exit status or run a positive control.

⭐⭐⭐ **A search that returns nothing has TWO explanations — no matches, or it didn't run — and "NOVEL" is only supported by the first.** I collapsed them into the second-best case for me: the one that let me close the dedup question. This is the capability-negative failure family ([[feedback_published_negative_env_claims_need_rederivation]]): a negative claim whose readers comply by *not searching*, which logs nothing and never surfaces the error. Had the triager obeyed my "don't reprove" framing, #7176 stays invisible and we scope a fix for an issue that duplicates a 15-month-old human report.

⭐⭐ **The triager's search was better in a way worth copying: it ENUMERATED instead of counting, and carried controls.** `"ptr<function" in:body` → 72 hits, *all enumerated*; control `is:issue` → 4809 (non-zero, instrument alive); garbage token → 0 (instrument discriminates). It also caught its own trap: unquoted `ptr<function>` gave 155 = loose tokenization, "NOT a measurement". My single query had **no control at all**, so a broken instrument and a true negative looked identical.

## The rule
⇒ **Before writing a negative ("novel", "nothing found", "no such issue"), the search needs a positive control in the same invocation** — one query you *know* returns rows. If the control is empty, the instrument is dead and the negative is unpublishable.
⇒ **Never label a negative "pre-verified, don't reprove" for a downstream agent.** Positives are cheap to trust (the artifact exists); negatives are the class that needs *re*-derivation, so the dispatch instruction should be inverted: *"my dedup is one query deep — please widen it."*
⇒ ✅**Cheapest detector here:** `gh search` writing zero bytes should read as *suspicious*, not *empty set*. Check `echo $?`, or prefer `gh api search/issues` which at least errors loudly (as it did later, with the 401).

## Coda — one wrong claim indicts its CLASS, not just itself
The triager hit the same shape from the other side and named it better than I did: after an adversarial review flagged one heading, its first fix corrected **the quoted sentence** and left *four body sentences* still asserting the retracted framing. Its own words: **"Fixing the quoted sentence isn't fixing the defect class."**

⇒ ⭐⭐⭐**When a claim is found wrong, the unit of repair is every claim that shares its derivation — not the sentence that got caught.** My dispatch marked *three* items "pre-verified, don't reprove"; the dedup was wrong. The defect was never the dedup's content, it was the **framing applied to all three** (two happened to be `grep`-verified at HEAD and survived; that was luck of method, not diligence). Retracting the dedup alone would have left the framing intact for the next dispatch.
✅**Check that discharges it:** after any retraction, ask *what else did I derive the same way, in the same message?* — and sweep those, including the ones nobody flagged.

**Related:** [[feedback_published_negative_env_claims_need_rederivation]] (capability-negatives have no failure signature), and the store's standing rule that a tool which silently collapses output reports a true number about a set you never saw — same shape, applied to search rather than traversal.

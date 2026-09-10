---
name: feedback_in_body_qualifier_silently_excludes_every_comment
description: "MEASURED 2x2: `in:body` on gh search/issues excludes ALL comments — issue AND inline review. Dropping the qualifier found the hit with the SAME paraphrase; keeping it missed with the compiler's EXACT string. The qualifier, not the vocabulary, was decisive."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: dd6c5348-62db-4101-8b01-d603c9d1d751
---

# `in:body` excludes every comment — so it cannot see a defect discussed in review

**GitHub's `search/issues` `in:body` qualifier matches the issue/PR *body only*. It excludes
issue-level comments AND inline review comments.** Since dedup exists to find prior *discussion*, and
discussion lives in comments, `in:body` is close to the worst available qualifier for the job — and
its miss is silent, indistinguishable from "nobody filed this."

## The instance (slang#12411 → PR#10723, 2026-08-06)

Two tiers independently concluded a `SLANG_UNEXPECTED` crash in `getCoopVecComponentType_enum` was
unfiled. Both were wrong. It had been raised **pre-merge** on PR #10723 — the very PR that introduced
the code path — as inline review comment `3029202982` (2026-04-02, `github-actions[bot]`), titled
*"🟡 Gap: 64-bit type cases removed without validation guard"*. It named `FLOAT64`/`INT64`/`UINT64`,
noted they remain in the enum and the SPIR-V emitter, and **predicted the exact abort**. Merged 8.6h
later with **0 replies** (verified: `in_reply_to_id == 3029202982` count = 0, non-zero control: 20
inline comments on the PR). Live 4 months.

## ⛔ The stated cause was wrong, and the 2×2 says so

The peer diagnosed it as **paraphrase** — *"we searched our words; they quoted the compiler's."*
Plausible, and it matched their own query. But my log showed I had *also* run the compiler's exact
string. So I ran the 2×2 instead of accepting the diagnosis:

| | `in:body` | unscoped |
|---|---|---|
| **paraphrase** (`Float64 cooperative vector HLSL`) | `[12411]` — **miss** | `[12411, 12017, **10723**, …]` — **HIT** |
| **exact string** (`"Unsupported cooperative vector component type"`) | `[12411, 7490]` — **miss** | `[12411, 9603, **10723**, …]` — **HIT** |

⭐⭐⭐ **Both `in:body` cells miss; both unscoped cells hit. The qualifier is decisive and the
vocabulary is not** — the *paraphrase* found it once the qualifier was dropped, and the *exact
compiler string* still missed while the qualifier was kept. Had I accepted "use their vocabulary,"
I'd have adopted a remedy that does not work (B1 above is exactly that remedy, and it misses).

Confirmed independently on a second, unrelated inline comment: phrase `"No test coverage for
transpose"` → `in:body` = **0**, `in:comments` = **2** (`#10723`, `#10902`); zero-control garbage
phrase = 0. And confirmed the hit really comes from the *inline* comment, not a bystander: of #10723's
21 comments, the only one containing the string is inline comment 3029202982 — the single issue-level
comment (coderabbitai, 21,672 B) does **not** contain it, and neither does the PR body.

## How to apply

⛔ **Drop `in:body` from dedup searches. Run unscoped, or `in:comments` when you want to target
discussion.** Unscoped covers title+body+comments; there is no upside to narrowing, because a dedup
query is trying to *maximize* recall.

⭐⭐ **When a hit is expected but absent, vary the QUALIFIER before you rewrite the words.** Query
failures have two independent axes — *what you matched* and *where you looked* — and the second is
one token, cheap to flip. Both parties here reached for the vocabulary axis and neither tested the
aperture.

⚠️ **The REST surface has a third noun.** The comment was invisible to `issues/{n}` (body) *and*
`issues/{n}/comments`; it lived in **`pulls/{n}/comments`** (inline review comments). Three nouns, not
two. See [[feedback_gh_pr_comment_and_rest_comments_are_different_verbs]] for the write-side twin of
this asymmetry.

## The control lesson, restated because it keeps recurring

Both tiers' dedup carried passing non-zero and zero controls. **They all passed.** ⭐⭐⭐ **A control
proves the instrument fired; it never proves the query encoded the question.** And two tiers agreeing
is **not** two measurements when both chose the aperture the same way — correlated method, not
independent confirmation. This is ANCHOR C's "controls validate the INSTRUMENT, never the TARGET"
in a new surface.

Related: [[feedback_dedup_is_per_claim_not_per_issue]] (the same trap on the *signature* axis rather
than the aperture axis), [[feedback_a_dedup_claim_i_relayed_as_verified_was_my_own_unrun_search]],
[[project_12411_coopvec_bfloat16]].
</content>

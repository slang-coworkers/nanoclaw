---
name: project_12298_enum_bool_switch_canonicalization
description: "#12298 enum-with-bool-tag switch case-label canonicalization; follow-up of #12260; DRAFT PR #12301 held"
metadata: 
  node_type: memory
  type: project
  originSessionId: 7064d472-3144-4bb6-abea-e13367d792ef
---

# #12298 — enum:bool switch case-label canonicalization

Follow-up of [[project_12260_enum_bool_switch_e39999]] #12260 (Gap 1). **P3 code-quality / smell.** VERIFIED @HEAD `a729b2b22`.

**Approach A (producer-side):** `lowerEnumType` canonicalizes a bool-tag `IRIntLit` → `IRBoolLit`, `removeAndDeallocate` on the old form so no dual representation survives.

**DRAFT PR #12301** — `Closes #12298`, non-breaking, head `fix/issue-12298`, 6 files. Review caught a **pre-existing LLVM `switch(bool)` crash cascade** → fixed, plus `legalizeBoolSwitch` tightened + a defensive assert added.

**Verification:** CUDA/host verified empirically; HLSL-DXC + Metal-MSL routed to CI. (`int8_t`-not-native-HLSL DXC-rejection = HYPOTHESIS, not claimed.)

**GitHub:** issue verdict posted (cmt 5136498674), `reproduced` label, Issue Type=Bug.

**Status:** HELD maintainer review; OP-gated merge (drafts-only guardrail). **RESUME =** merge / fresh comment / CI-review webhook.

## 🔴 RE-OPENED 08-05 — maintainer asked for a fresh repro check

**jhelferty-nv**, cmt [5195175595](https://github.com/shader-slang/slang/issues/12298#issuecomment-5195175595): *"@nv-slang-bot Can you check if this issue still repros on default branch?"* Real bot mention ⇒ **post-authorized**. Routed to slang-triager on canonical thread `gh-issue-shader-slang/slang-12298`.

⭐**The stored "VERIFIED @HEAD `a729b2b22`" does NOT answer this** — it is a claim about a tree that is now ~6 days stale, and the whole question is about *today's* default branch. Re-verify at **current `origin/master`**, freshly fetched; never relay the memo's verdict as the answer.

⭐**Check FIRST whether #12301 merged** — if it did, the issue no longer repros *because our own fix landed*, and the honest answer names the PR as the cause rather than reporting a bare "no longer repros" (which would read as "was never real"). If #12301 is still a draft, the expected answer is **yes, still repros**, and the maintainer's real question is likely *"is the draft still needed / why isn't it merged?"* → surface that #12301 is ready and OP/maintainer-gated.

⚠️**Rebuild before claiming** — the prebuilt `slangc` was stale once already on this exact chain (predated the #12260 fix), which is what made the original triage nearly report a false negative. A repro claim from an unrebuilt binary is a claim about an old tree.

### ANSWERED 08-05 — still repros at master `b0e43d657dc6a4d0544a5d831522932276f983f7`

Answered in cmt **5195219069**, PATCHED in place (holding note → answer, 610→3321 chars) since the holding note was our own superseded position. hlsl/cpp/cuda/metal emit `case int8_t(0/1):` on a bare `bool` selector, **exit 0 — silent, not diagnosed**; wgsl/spirv integer-legalized. Repros **because our fix hasn't landed**: #12301 unmerged draft, `REVIEW_REQUIRED`, 0 reviews, `behind_by=31`; `canonicalizeBoolTagConstants` absent from source AND `libslang-compiler.so` (non-zero control = 2). Prebuilt was ~7h stale ⇒ rebuilt, and re-checked `rev-parse HEAD` **after** the build (unchanged — no sibling moved it mid-build).

⛔⭐⭐⭐**THE "ROUTED TO CI" CAVEAT WAS INERT — a draft PR's checks are `skipping`, so the DXC/MSL gate we promised for ~6 days NEVER RAN.** We had been carrying "HLSL/DXC + Metal/MSL routed to CI" as if it were pending-but-scheduled coverage; it was **structurally impossible** while the PR stayed a draft. ⇒ **"Routed to CI" is a claim about a CI RUN — open the checks and confirm a run EXISTS and is not `skipping`. A held draft silently converts "will be verified" into "will never be verified," and the two are byte-identical in a status report.** Textbook [[feedback_a_guard_can_be_inert_and_read_as_passing]] / [[feedback_false_coverage_the_five_mechanisms_that_consume_the_reason_to_look]].

⭐⭐**A passing test can be STRUCTURALLY INCAPABLE of catching the bug** — `enum-bool-switch.slang` passes 4/4 but only carries `-cpu`/`spirv-asm`/`wgsl` directives, i.e. exactly the three *legalizing* paths. Its green is not counter-evidence; **read a test's directives before treating its pass as coverage of the target.**

## ✅ MERGED 2026-08-06 — CHAIN TERMINAL

**MINE-VERIFIED, not relayed:** PR #12301 `MERGED` at merge commit **`bbaef7d62e`** (09:11:19Z), `reviewDecision=APPROVED` by **skiminki-nv** ("LGTM"); issue `CLOSED / COMPLETED` at 09:11:21Z — 2 s later, so `Closes #12298` fired. Fix confirmed **on master** via the GitHub contents API: `canonicalizeBoolTagConstants` **3 hits**, must-hit control `lowerEnumType`=1, zero-control=0 (so the presence claim is not a false positive). Triager additionally verified `--is-ancestor origin/master`, the tightened `as<IRBoolLit>` assert in `legalizeBoolSwitch`, and both regression tests on master.

✅**The CI-failure exoneration was vindicated:** `test-compile-regression` / `test-falcor` passed on re-run with **zero code change**. The fixer called them not-its-change on specific grounds (canonicalization gated on `kIROp_BoolType`) and was right.

## ⛔ THE GAP THAT OUTLIVED THE MERGE — untested, unfiled, and it survived BECAUSE everything went green

**Whether DXC accepts `case false:`/`case true:` is STILL untested by anything.** The merged tests assert only what Slang **emits** (`SIMPLE(filecheck)` on `-target hlsl`/`-target metal`); the toolchain-invoking directives are **`-target dxil` (123 in-tree tests)** and **`-target metallib` (97)**, and the PR used **neither (0)**. ⇒ **This decides whether #12298 was *canonical-form cleanup* or *we were emitting invalid HLSL*** — i.e. how the original issue should be characterised. Remedy: add those two directives to `tests/language-feature/interfaces/enum-bool-switch.slang`.

⭐⭐⭐**HOW IT SURVIVED IS THE TRANSFERABLE PART: the PR body's own "Routed to CI (not confirmed locally): DXC (HLSL) and Metal/MSL acceptance" section sitting beside a CLEAN GREEN RUN made an untested claim look settled.** Raised pre-merge in PR comment **5196897838** (2 remedies offered: add the directive, or soften the wording); merged anyway. ⇒ **`PENDING`, `UNRUNNABLE`, and `PASSED` render IDENTICALLY in a status report — only reading the DIRECTIVES/matrix distinguishes them.** Full family: [[feedback_a_null_from_an_instrument_with_no_field_is_an_unasked_question]].

**MEASURED 08-06: not tracked upstream** — `gh search issues --state open` for both `dxil enum bool switch` and `enum bool switch case` returned **`[]`**. So the gap exists only in PR comment 5196897838 on a merged PR and in the issue's RESOLVED banner. **Triage correctly declined to file unprompted on a freshly-closed issue** and left it with the maintainer.

**Verdict comment 5195219069 patched 5× total** — each time because the bot's own text had gone **false** (not merely stale) as state moved; conclusion never changed. Final patch added a `> [!NOTE]` **RESOLVED-historical banner at the top** rather than silently rewriting, because a human had already read the original. Issue comments stayed **3** throughout — edited, never stacked.

## ⛔⭐⭐⭐ `--is-ancestor` HAS A SILENT FALSE-NEGATIVE ON SQUASH-MERGE — and it passed here BY LUCK (MINE-VERIFIED 08-06)

The close-out check I endorsed (*"verify the merge commit `--is-ancestor origin/master`, don't trust the PR's merged flag"*) is **not style-agnostic.** Measured on my own edge via the compare API:

| subject | result |
|---|---|
| `bbaef7d62e` parent count | **1** ⇒ **SQUASH-merged** |
| pre-squash branch head `d7d1e6dea6` … `master` | **`diverged`** (ahead 39, behind 1) ⇒ **NOT an ancestor** |
| merge commit `bbaef7d62e` … `master` | **`identical`** ✅ |

⇒ **The check produced the right answer only because we happened to use the MERGE-COMMIT sha.** The identical method with the **branch** sha yields a confident ***"the fix is not on master"*** — a false negative that, acted on, would have re-opened a correctly-closed chain or blocked a worktree cleanup. On a **2-parent** merge-commit PR the branch sha *would* be an ancestor, so **the check works most of the time and fails silently exactly on squash** — the merge style is the hidden precondition it never states.

⭐⭐⭐**A CHECK THAT IS RIGHT FOR A REASON YOU DIDN'T CHOOSE IS NOT YET A RELIABLE CHECK.** Both of us would have carried it forward as sound, *because it produced the correct answer.* Same family as [[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]] — a lucky success certifies the absence of the mechanism it mimics.

⛔⭐⭐⭐**CORRECTED ATTRIBUTION, and the correction IS the operational rule: the FAILING instance surfaced this, never the passing one.** I first recorded it as the triager catching its own method's fragility. Truer sequence (its own correction, against its interest): **the fixer hit the false negative on its own branch sha**, which forced the squash diagnosis; the triager then tested whether *its passing* check shared the defect and found it passed by luck. **It audited its own instrument, not the triager's.**

⇒ ⭐⭐⭐**THIS DEFECT CLASS IS ESSENTIALLY ONLY EVER SURFACED BY THE FAILING SIDE, because a false POSITIVE generates no symptom to investigate.** The passing party has nothing to look at; the failing party is forced to. ⇒ **OPERATIONAL: when a peer reports a FALSE NEGATIVE in a check you also use, immediately ask whether YOUR version is a FALSE POSITIVE.** Pairs with *when a check passes, name the property that made it correct.* ⭐⭐**Corollary on credit: the party whose instrument failed is the one who found it — don't reassign that to whoever reported it upward.**

⚠️**Also: a peer's DEDUP is never coverage for your store.** The fixer deduped correctly against **its own** memory — but these stores are **per-agent-group**, so the file it found does not exist on other edges. Dedup, like reachability, is per-store.

✅**Style-agnostic replacement (what my own close-out actually used):** assert the **content** on master — the fix symbol present, with a **must-hit control** (a symbol that must exist) and a **zero-control** (a string that must not). Mine: `canonicalizeBoolTagConstants`=3, `lowerEnumType`=1, `zzzNOPE`=0. Content survives squash, rebase, and merge-commit alike.

⭐⭐**And the peer behavior worth copying, because both easy options were wrong:** the fixer's ancestry check said *"not landed"* while the PR said `MERGED`. It neither forced the destructive removal nor escalated a false alarm — it **switched instruments** (content: 5/6 files byte-identical; the lone delta was master's *own* unrelated `#include <assert.h>` removal `5b3f7a2430`, not lost work) and proceeded only once the **disagreement was explained**. ⇒ **Two instruments disagreeing is information ABOUT AN INSTRUMENT, not licence to pick the convenient one.**

⚠️**Two adjacent traps from the same cleanup:** `git worktree remove` **refuses** a submodule-bearing tree (needs `--force` ⇒ **re-verify cleanliness immediately before forcing**), and `echo "exit=$?"` after a **pipeline** reported **0** on that fatal refusal ⇒ use `PIPESTATUS`.

**Status: TERMINAL.** Re-open only on a fresh substantive human comment. **Two loose ends, both operator-gated and neither actioned:** (1) the DXC/MSL acceptance gap above — unfiled, untracked upstream; (2) the upstream branch `fix/issue-12298` still exists (`ls-remote`=1) — deleting a remote branch is an outward destructive act no bot here is authorized for.

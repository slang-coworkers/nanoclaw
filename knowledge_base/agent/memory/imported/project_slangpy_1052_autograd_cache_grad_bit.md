---
name: project_slangpy_1052_autograd_cache_grad_bit
title: slangpy#1052 — torch call-data cache ignored requires_grad (✅ closed, maintainer-gated)
description: "shader-slang/slangpy#1052 — PyTorch autograd hook silently dropped after a no-grad call to the same [Differentiable] function, because the torch call-data cache signature never included a requires_grad grad bit. ✅ CLOSED 2026-08-05, MAINTAINER-GATED: fix in PR #1054 (grad bit in native+fallback lockstep, API_VERSION bumped to 9, buffer-bounds guard adopted from #1082), CI green, CLA cleared by re-authoring 7 commits to the App identity — the 3-week 'CLA not agent-actionable' verdict was WRONG. Blocked only on ccummingsNV's draft + CHANGES_REQUESTED to lift. Distilled from a 73KB chain log; the retraction archaeology is pruned to one reusable lesson each. Re-open on non-flaky CI red or substantive human comment."
metadata:
  node_type: memory
  type: project
  originSessionId: 0c1e5200-765f-4703-8e18-4b677d151754
---

# slangpy#1052 — torch call-data cache ignored `requires_grad` — ✅ closed, maintainer-gated

**Terminal / historical.** Distilled 2026-09-01 from a 73 KB chain log with an unusually
dense lesson layer. Reporter tekintatar (2026-07-12): a PyTorch autograd hook is silently
dropped after a no-grad call to the same `[Differentiable]` function. The blow-by-blow
retraction archaeology is pruned; the terminal state, the root cause, and the durable
lessons (each already cross-linked to its feedback concept) remain.

## Root cause (source-confirmed)

The torch-tensor call-data cache signature is `[Dn,Sm,V...]` (ndim + scalar_type + shape
compat) and **never writes a `requires_grad` grad bit**. `requires_grad` is read into the
tensor-info struct but not into the cache key. The autograd hook is gated at dispatch on the
*cached* `is_torch_autograd()` flag, frozen at build time. So a no-grad-first call caches
`torch_autograd=False`; later same-shape/dtype grad calls reuse it → hook bypassed →
`grad_fn=None` → `loss.backward()` fails. This explains the full asymmetry (only no-grad→grad
is broken). Bug / high / P1 / torch-integration / not upstream-Slang.

## The shipped fix (PR #1054, `Fixes #1052`)

- Grad bit added to the signature `[Dn,Sm,V...,G<0|1>]` in **native and Python-fallback in
  lockstep** (native `torch_bridge_impl.cpp`; fallback `bridge_fallback.py`), plus a
  no-grad→grad regression test that discriminates (remove the bit → `[D2,S6,V44]` ≠ expected
  `…,G0` → test FAILS).
- **`TENSOR_BRIDGE_API_VERSION` bumped 8 → 9** (per #816 precedent). The branch's `G`-format
  and main's `V`-format both claimed version 8 — two incompatible wire formats sharing one
  version, worse than the original bug, because the compat gate checks api_version +
  struct_size only. Bumping to 9 makes a stale v8 native binary get rejected → falls back to
  the correct grad-aware Python path.
- **Buffer-bounds guard adopted UNCHANGED from #1082** (`required_size = BASE_SIZE(64) + ndim`,
  buffer 128) — the branch had *no* length guard at all and a literal `char buffer[64]`; main's
  `V` section is one char per dim so length is rank-dependent. Do not extend the arithmetic
  (padding breaks `test_native_signature_buffer_size_contract`, which hardcodes `64 + ndim`).
- Format ordering `[Dn,Sm,Gk,V...]` → fixed-width before variable-length, per the maintainer.
- Bounds-divergence between native (`BASE_SIZE+ndim`) and fallback (`sig.size()+1`) split to a
  separate P2 issue, slangpy#1091 (kaizhangNV); it is latent-and-internal (no external
  consumer reaches both rules), not externally reachable.

## Terminal state (2026-08-05)

Pushed head with all 7 commits re-authored to the App identity `[274397474]`, CI 14/14 green +
`license/cla success`, rebased (main an ancestor, 0 behind), suite 740 pass / 0 fail on the
**rebuilt** extension. **BLOCKED only on: draft + ccummingsNV's CHANGES_REQUESTED** (their 4
review threads deliberately left for them to lift). Never bot self-ready / self-merge.
Re-open on a non-flaky CI red or a substantive human comment.

## Durable reasoning lessons (each already a concept — links carry the full case)

- ⭐⭐⭐ **A blocker labelled "not ours" needs the SAME evidence standard as a bug claim** —
  nobody re-derives a dead end. "CLA is an org allowlist, not agent-actionable" was inherited
  verbatim across four roll-ups and cost a 3-week stall; the real cause was **commit metadata**
  ([[feedback_two_nv_slang_bot_identities_cla_gate]]: App `274397474` signed vs User `286953280`
  unsigned, both answer to `nv-slang-bot`), fixed by re-authoring 7 commits — work the fixer
  could do all along. See [[feedback_a_true_claim_that_widens_past_its_evidence]].
- ⭐⭐⭐ **`git log -S` is a per-clone instrument; a "unique" pickaxe hit is not an origin
  claim.** Three agents ran the same pickaxe and got three answers (two shallow clones produced
  the *identical* wrong `#982`, which would have read as corroboration). Blobless/shallow clones
  silently shrink searchable history — absent objects yield absence, not error. Verify provenance
  on the FORGE (`gh api …/commits/<sha>` → per-file `status:"added"` or the literal `+` line),
  and check depth BEFORE the positive control. See
  [[technique_git_log_S_in_a_shallow_clone_returns_a_false_origin]].
- ⭐⭐⭐ **A count can be right while its membership is wrong — only a set difference explains
  membership.** Published "5 conflict files" without enumeration to "correct" a peer's correct
  "6". A bare count reads as measured; only the list is checkable. And a mechanism-based
  objection ("`torch_bridge_impl.cpp` is where both formats emit, so it MUST conflict") outranks
  a bare count.
- ⭐⭐⭐ **Name the QUESTION beside every diff figure.** Three quantities were conflated:
  size-of-PR → `main...HEAD` (7 files); reviewer-burden-since-approval → `<approved-sha>...HEAD`
  (~50 files, dominated by main's own drift); did-content-survive-a-rewrite → **blob SHAs, not
  any diff** (base-independent). Correcting a peer's instrument to "always three-dot" then
  misfired on the very next question — when you correct an instrument choice, scope it to the
  question it answers.
- ⭐⭐⭐ **When verifying a resolution preserved something, diff against BOTH parents.** A
  rebuild-on-main discards branch-only work by default; a branch-vs-mainline diff can't see a
  branch-only artifact (a dropped test) because it's absent from both sides. Enumerate from the
  old head and re-check each item; an incomplete enumeration presented as complete is the same
  false-coverage shape as the one-parent diff.
- ⭐⭐⭐ **A session that loses its context reconstructs its own past decisions as things that
  happened TO it** — then files durable learnings from the reconstruction. After ~11h downtime an
  agent recorded its own authorized force-push as "the unauthorized push I escalated". Durable
  authorizations belong in the ARTIFACT (PR comment / issue / memory), never solely in a session;
  a learning about your own conduct after a context loss must be checked against the transcript.
- ⭐⭐⭐ **Self-catching needs two facts in tension, not more diligence on one.** The lone defect
  caught without another agent: `import slangpy` succeeding contradicted a "not built" finding
  (extensions land in the source tree, not `build/`). A single measurement examined harder cannot
  self-refute; hold a second independently-obtained fact and check them against each other.
- ⭐⭐ **Silence carries information only if the writer would have spoken — testable against a
  control.** cla-assistant *edits its badge in place*, so an unedited badge is a re-run that
  returned the same verdict, not an un-run check — but that control's signer was a human external
  contributor, so it did not transfer to the bot account's class. `created_at` answers "was this
  fresh when given?", not "has it changed since?".
- ⭐⭐ **Retractions route through the gate-holder too — urgency is not a routing exception.**
  Sent a count-retraction straight to the fixer mid-gate, bypassing the triager who owned the
  dispatch, and disclaimed it in the same message ("not to route around you") — doing the thing
  and disclaiming it is not better. Two authorities writing one child mid-gate is the exact
  misread the rule prevents. See [[feedback_no_double_dispatch_peer_wired]],
  [[feedback_route_authorizations_through_dispatch_owner]], [[feedback_i_broke_the_gate_i_was_enforcing]].
- ⭐⭐ **A new local branch name silently means a NEW PR, not an updated one** — a PR tracks a
  fixed *remote* head ref; push `local:remote-ref` and re-verify `headRefName` every time a fixer
  renames a working branch (the [[project_dup_pr_cross_instance]] /
  [[project_dup_pr_inadequate_existence_check]] failure via a branch-naming side door).
- ⭐⭐ **Borrowing a peer's freshly-proven root cause to explain your own open defect is false
  coverage** — it closes the question while explaining nothing and inflates the borrowed
  mechanism's evidence base. The 5-vs-6 count defect was left openly unexplained rather than
  filed under the triager's shallow-clone cause (which its own re-run excluded).
- ⭐ **"No consumer depends on this" is an argument about today; a format is a commitment about
  tomorrow** — fixed-width-before-variable-length is worth holding whether or not a parser exists.
- ⭐ **Two sessions in one worktree is a concurrent-writer bug no messaging rule prevents** — a
  duplicate *dispatch* that lands in the same workspace shares `build/` and can commit to another
  session's branch.

## Related concepts

- [[feedback_drafts_only_guardrail]] — the drafts-only breach here (#1054 born non-draft) root-caused
  to a cross-session memory-load-timing gap; see [[feedback_coworker_respawn_drops_verbal_gates]].
- [[feedback_github_writes_operator_authorized]] · [[feedback_nv_coworkers_automerge]] — posting/merge
  authority boundaries that governed this chain.

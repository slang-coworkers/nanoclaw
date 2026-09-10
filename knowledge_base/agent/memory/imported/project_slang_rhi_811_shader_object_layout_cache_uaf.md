---
name: project_slang_rhi_811_shader_object_layout_cache_uaf
description: "slang-rhi#811 — stop caching ShaderObjectLayout keyed on a caller-supplied TypeLayoutReflection* (fixes slang#10893 UAF). TERMINAL: MERGED 2026-08-10 07:25Z byte-identical to what the approver twice declined (skallweitNV APPROVED independently). Generated the approver's sharpest lessons — author-not-ready ≠ artifact-not-ready; a metric that cannot lose is not a metric; partition a count by the fix's mechanism; the approval policy lived on an ephemeral mount with a stricter silent fallback."
metadata:
  node_type: memory
  type: project
  title: slang-rhi#811 shader-object-layout cache UAF
  tags:
    - slang-rhi
    - approver
    - use-after-free
    - terminal
  originSessionId: pending
---

# slang-rhi#811 — do not cache shader object layouts keyed on a caller-supplied type layout

🔵 **TERMINAL — MERGED 2026-08-10 07:25:17Z** (`merge_commit 8b27c96c9a`, head `b4ca3c8c6c`).
`skallweitNV` (User, ≠ author) APPROVED @`b4ca3c8c` independently. **The production fix shipped
byte-identical to the head the approver twice declined**, and the only PR-owned commit past the decided
sha was the advisory nit it had already cleared. Nothing was posted to GitHub by us.

## The bug and the fix

`Device::m_shaderObjectLayoutCache` was keyed on a raw `slang::TypeLayoutReflection*` and lived as long
as the `Device`. Two entry points reached it, but only one held a reference to the key's owner:
`createShaderObject(session, type, …)` holds a `ComPtr<ISession>`; `createShaderObjectFromTypeLayout`
took a **caller-supplied** layout whose owner (a `TargetProgram`/`ComponentType`) the device did not
retain ⇒ use-after-free (fixes slang#10893, a `Dev Reviewed`/`CI Bug` open since 2026-04-21).

Fix (final form): the API is re-architected so the cache **structurally cannot** accept a
caller-supplied key — the `typeLayout`-taking overload is deleted, and the remaining `type`-taking form
derives `session->getTypeLayout(type)` internally and inlines the cache find/emplace. Rejected
alternatives (in the PR body): keying on `ShaderComponentID` (name collisions return the *wrong* layout,
worse than crashing) and validate/evict on lookup (no destruction hook to test a raw pointer for
staleness).

⭐ **The regression test asserts the INVARIANT, not the crash** — creating twice from a reflected layout
and checking `getShaderObjectLayoutCacheSize` is unchanged. Testing the UAF directly would be testing
"ASan happened to stay quiet," which is how these findings were previously written off as fixed. **A
nondeterministic-visibility bug gets a deterministic test by pinning the property that causes it.**

## The lessons this chain generated (the durable yield)

Across 5 head-moves and two approver abstains (ABSTAIN_INFRA `NO_REVIEW_SIGNAL` → ABSTAIN_POLICY
`CHALLENGER_CONCERN`), both later refuted by the merge, this chain produced the approver's sharpest
transferable rules — most now held in dedicated feedback concepts:

- ⭐⭐⭐ **"The AUTHOR isn't ready for review" is not "the ARTIFACT isn't ready to merge."** A WIP note
  (the author declared WIP and pulled both reviewers here) carries who-wants-to-look-and-when, almost
  nothing about what they would find. The maintainer had the same facts and shipped it. A claim about
  PROCESS silently promoted to a claim about SUBSTANCE.
- ⭐⭐⭐ **A calibration metric that cannot lose is not a metric.** *"A human must look; a human looked"*
  scores every abstain correct regardless of outcome; score against *"not material enough to merge
  as-is,"* which byte-identical approval refutes.
- ⭐⭐⭐ **Before publishing a count as evidence for a fix, partition it by the mechanism the fix
  addresses** — if the partition is uneven, the count is not the evidence. ("6 losses" was three
  distinct modes: n=1 WIP-scope, n=3 uncovered-validation-branch, n=2 harness.)
- ⭐⭐⭐ **A self-merge following an independent approval is not an unreviewed merge** — the review
  happened; the author merely pressed the button. `merged_by` is an ACTION, not a JUDGMENT.
- ⭐⭐⭐ **An event that changes state is not evidence about INTENT until you check its actor/context.**
  A bot re-requesting reviewers reads like author intent (check `actor.__typename` via GraphQL, not the
  `[bot]` suffix); a maintainer merging main into a PR is engagement only if it isn't a batch sweep
  across their other PRs the same minute.
- ⭐⭐ **`author`/`actor` `__typename` is a real discriminator (union `User|Bot|Organization|Mannequin`);
  `user(login:)` is a typed root that returns `NOT_FOUND` for every bot — ask the object that has the
  union, not the root that has one type.**
- ⭐⭐⭐ **A config-conditional mechanism needs the config read** — I claimed the Release CI greens were
  false coverage from a `checked_cast`→`static_cast` degrade *without reading whether the device is
  wrapped in Release* (`testing.cpp:790-795`: `enableValidation` is set only under `SLANG_RHI_DEBUG`, so
  Release wraps nothing and the passes were real). Retracted; a correction sent upstream. Naming my own
  premise as unverified is what made it checkable, and refusing to inherit the peer's same-direction
  read kept two wrong derivations from propping up one false fact.
- ⭐⭐⭐ **A forwarded ask is still an ask** — I relayed a "policy gap, open for you to route" to the
  operator twice without running the dead-gate probe I hold; the proposed `not_wip` clause would have
  PASSED on #811 itself (draft==false is an entry precondition) and changed nothing. Reading "Work in
  progress" from free text is a judgment call, not a Step-1 data clause; the only script-shaped signal
  is a structured `wip`/`do-not-merge` label.
- ⭐⭐⭐ **The approval policy existed in two versions on my edge, the authoritative one on an EPHEMERAL
  read-only mount (`/workspace/extra/ephemeral/approver-policy/`), and the silent fallback is STRICTER.**
  A dropped mount fails `head_provenance` on every fork PR and tightens caps 20× — but **fails SAFE
  (over-abstains), which is why it survived unnoticed**; a fail-safe defect is harder to find than a
  fail-open one because its symptom is indistinguishable from diligence. `clauses.json` records
  `policy_version` per decision (~4% of runs really did fall back). **Dates establish which policy was
  current; only `policy_version` establishes which was used.** The fix is to make `eval-clauses.py`
  print the resolved path and warn on fallback + durable storage — never patch `allow_fork_head` (it is
  explicitly `False`, a deliberate default), which would "fix it into failing open."
- ⭐⭐ **Instrument/artifact traps:** a clean CodeRabbit pass lands as an EDIT to its summary comment, not
  a review row on the head sha (key on the rate-limit marker's absence, not the `📥 Commits` header,
  which can sit *inside* a rate-limited block and read as coverage). `fetched == total_count` is a
  TRUNCATION guard, not a completeness one (read `actions/runs/<id>` status/conclusion). A run id's
  `statusCheckRollup` inherits SUCCESS entries from the older sha while `ci` is queued. **An audit that
  mutates the artifact it audits invalidates it — probe on a copy** (overwriting `clauses.json` in place
  destroys the DECISION_REVIEW-attested hash). `devin-flags.md` strips the `1 Bug` count token, so
  grepping the extract mislabels a genuine run as a false clean.

## The open policy question (operator-gated)

6 consecutive `slang-rhi` losses, 0 wins, all merged past — routed as a falsifiable
`APPROVAL_POLICY.json` carve-out, not a behaviour change (a losing streak never authorizes a permissive
derivation; a policy edit is auditable and reversible). Proposed shape: `WOULD_APPROVE` with the WIP
recorded as a caveat **only when every artifact gate is clean** (the state the n=6 data covers), and
**scoped to the repo** — n=6 on one repo with one merging maintainer is a claim about `slang-rhi`, not
approval judgment generally. Note the "one merging maintainer" framing was itself wrong (3 authors), and
the carve-out would have covered only 1 of the 6 losses (the rest are uncovered-validation-branch and
harness modes) — so the strongest signal in the set is NOT the WIP question.

Related: [[feedback_a_config_conditional_mechanism_needs_the_config_read]],
[[feedback_approver_step1_clauses_are_data_only_judgment_is_step3]],
[[feedback_debounce_approver_dispatch_deterministic_abstain]],
[[feedback_two_nv_slang_bot_identities_cla_gate]],
[[feedback_green_job_skipped_backend_zero_coverage]],
[[feedback_a_multi_probe_turn_has_a_window_not_a_timestamp]],
[[feedback_control_the_instrument_not_the_reasoning]],
[[feedback_inbound_scan_must_cover_issue_comments_not_just_reviews]].

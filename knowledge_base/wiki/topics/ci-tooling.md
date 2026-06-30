---
title: "CI, build & tooling"
type: topic
---

# CI, build & tooling

49 learnings. Catalog: [[wiki/index.md]]

- [[wiki/learnings/1781651810617-a-maintainer-merging-master-into-your-pr-branch-ca.md]] — A maintainer merging master into your PR branch can silently fix the root cause — rebuild+retest after any base move
- [[wiki/learnings/1782719314130-an-infra-unblock-nudge-is-not-an-override-of-a-dec.md]] — An infra-unblock nudge is not an override of a decision-based hold — verify the actual trigger
- [[wiki/learnings/1782324937326-attributing-check-cmdline-ref-ci-failures-not-mast.md]] — Attributing check-cmdline-ref CI failures (not master-doc drift by default)
- [[wiki/learnings/1782548309438-bot-pr-lone-red-workflow-dispatch-run-with-build-t.md]] — Bot-PR: lone red workflow_dispatch run with build/test skipped is a no-op, read the rollup
- [[wiki/learnings/1781624196085-build-subagent-that-bails-mid-build-often-leaves-i.md]] — Build subagent that bails mid-build often leaves its detached cmake running — check before relaunching
- [[wiki/learnings/1781809987259-build-only-subagent-overstepped-committed-pushed-d.md]] — Build-only subagent overstepped: committed/pushed/dispatched-CI/edited-PR-body — verify every claim
- [[wiki/learnings/1782296288354-ci-babysitter-cpu-job-failure-is-the-tell-for-real.md]] — CI babysitter: CPU-job failure is the tell for real regression vs GPU flake
- [[wiki/learnings/1782248669315-ci-babysitter-headline-the-dominant-root-cause-whe.md]] — CI babysitter: headline the dominant root-cause when maintainers rerun into a deterministic wall
- [[wiki/learnings/1780790667002-ci-babysitter-identical-build-error-across-unrelat.md]] — CI babysitter: identical build error across unrelated PRs = base-branch break, not flake
- [[wiki/learnings/1780985285213-ci-babysitter-stale-base-build-link-failures-are-r.md]] — CI babysitter: stale-base build/link failures are rerunnable despite the "no linker errors" rule
- [[wiki/learnings/1780623760932-ci-failure-reports-surface-unpinned-toolchain-inst.md]] — CI failure reports: surface unpinned toolchain installs alongside commit range
- [[wiki/learnings/1780769335094-ci-follow-up-issue-filed-by-a-contributor-against-.md]] — CI follow-up issue filed by a contributor against their own still-open PR → stand down to plan-only
- [[wiki/learnings/1782392187766-ci-integrity-bug-class-a-detected-failure-is-logge.md]] — CI-integrity bug class: a detected failure is logged but never folded into the recorded test result (stale init=Success leaks through)
- [[wiki/learnings/1782346148219-ci-flake-class-vs-deterministic-hang-and-the-two-s.md]] — CI: flake-class vs deterministic-hang, and the two-sweep escalation threshold
- [[wiki/learnings/1781660657132-cmake-cache-path-absolutizes-relative-d-values-aga.md]] — CMake CACHE PATH absolutizes relative -D values against the cmake CWD — pass :STRING to keep them relative
- [[wiki/learnings/1781271132976-compare-compute-filecheck-buffer-use-output-using-.md]] — COMPARE_COMPUTE filecheck-buffer: use -output-using-type or CI (cpu+llvm) dumps HEX while local (gcc cpu) dumps decimal
- [[wiki/learnings/1782145502619-descriptorhandle-to-constantbuffer-implicit-conver.md]] — DescriptorHandle to ConstantBuffer implicit conversion blocked by ParameterGroupType target guard in _coerce
- [[wiki/learnings/1782741439587-diagnostic-enum-codes-picked-against-a-stale-base-.md]] — Diagnostic/enum codes picked against a stale base collide on master-merge and break ALL platform builds
- [[wiki/learnings/1780381873486-disk-blocker-false-alarm-df-the-real-build-path-wo.md]] — Disk-blocker false alarm: df the real build path, /workspace/agent is a separate roomy volume
- [[wiki/learnings/1781568134178-disk-full-build-workaround-out-of-source-build-on-.md]] — Disk-full build workaround: out-of-source build on /dev/vda1 (/workspace) when /dev/vdb (/workspace/agent) is full
- [[wiki/learnings/1782151532732-disk-full-on-workspace-agent-prune-worktree-build-.md]] — Disk-full on /workspace/agent: prune worktree build/ dirs, not whole worktrees
- [[wiki/learnings/1782605298157-distinguish-missing-runner-queue-timeout-from-a-re.md]] — Distinguish missing-runner queue-timeout from a real test hang (gh api job runner/steps)
- [[wiki/learnings/1780177920997-don-t-cite-env-var-or-flag-names-without-verifying.md]] — Don't cite env-var or flag names without verifying — they're a high-frequency hallucination surface
- [[wiki/learnings/1780509591502-don-t-conflate-internal-a2a-review-with-github-rev.md]] — Don't conflate internal a2a review with GitHub reviewDecision in human-facing comments
- [[wiki/learnings/1780900630856-draft-held-fix-pr-still-needs-the-issue-5-bullet-p.md]] — Draft-held fix PR still needs the issue 5-bullet — post it when you decide to hold, not after a nudge
- [[wiki/learnings/1782598546890-flaky-ci-evidence-dedup-by-run-id-json-rpc-and-fal.md]] — Flaky-CI evidence: dedup by run id; JSON-RPC and Falcor symptoms each conflate multiple root causes
- [[wiki/learnings/1779427288040-furo-theme-dark-mode-code-colors-use-pygments-dark.md]] — Furo theme dark-mode code colors — use pygments_dark_style, not CSS overrides
- [[wiki/learnings/1778859843367-gh-cli-field-expands-as-file-path.md]] — gh CLI --field expands @ as file path
- [[wiki/learnings/1781818384239-hasoption-optimization-is-not-an-explicit-vs-defau.md]] — hasOption(Optimization) is NOT an explicit-vs-default signal at the emit layer
- [[wiki/learnings/1782464483726-hold-unsolicited-reviews-when-repo-runs-its-own-pr.md]] — Hold unsolicited reviews when repo runs its own PR bot
- [[wiki/learnings/1782148692608-internal-a2a-review-github-reviewdecision.md]] — Internal a2a review ≠ GitHub reviewDecision
- [[wiki/learnings/1782533107353-merge-group-build-break-with-green-head-merge-time.md]] — Merge-group build break with green head = merge-time collision, legitimate not flake
- [[wiki/learnings/1782407661384-on-pure-cmake-override-path-prs-reviewer-c-clarity.md]] — On pure-CMake override-path PRs, Reviewer C (clarity) is the value-add
- [[wiki/learnings/1782535868213-parallel-fix-issue-chains-can-grab-the-same-option.md]] — Parallel fix/issue-* chains can grab the same OptionKind/enum value off a shared base → duplicate-case build break; self-heals via append-renumber
- [[wiki/learnings/1780381892104-per-agent-build-volume-is-dev-vdb-workspace-agent-.md]] — Per-agent build volume is /dev/vdb (/workspace/agent), not shared /workspace
- [[wiki/learnings/1780726000000-pushing-commits-is-not-a-user-facing-write.md]] — Pushing code commits is NOT a user-facing write — it's always allowed, draft or ready
- [[wiki/learnings/1780509076354-reconciling-an-environmental-cause-retraction-agai.md]] — Reconciling an environmental-cause retraction against a test-config fix (map symptom→code path)
- [[wiki/learnings/1781338076804-splitbuffer-bytebuffer-vulkan-gpu-hang-flake-falco.md]] — SplitBuffer ByteBuffer Vulkan GPU-hang flake (Falcor)
- [[wiki/learnings/1780733286644-spvdescriptorheapext-path-fix-function-call-specia.md]] — spvDescriptorHeapEXT path — fix function-call specialization allowlists, not the downstream pass
- [[wiki/learnings/1780734760813-spvdescriptorheapext-specialization-fix-don-t-para.md]] — spvDescriptorHeapEXT specialization fix: don't parameterize the heap global
- [[wiki/learnings/1781324278003-stacked-pr-review-reviewer-a-checks-out-master-pro.md]] — Stacked-PR review: Reviewer A checks out master, producing predictable false positives + a missed-drop; coordinator must self-verify against the real base/head
- [[wiki/learnings/1782734222994-templated-operator-wake-explicit-scoped-override-o.md]] — Templated operator-wake ≠ explicit scoped override of a considered hold
- [[wiki/learnings/1780769206960-testing-the-buffer-load-arg-site-4-heap-load-speci.md]] — Testing the buffer-load-arg (Site 4) heap-load specialization path
- [[wiki/learnings/1782465056185-verify-n-reviewers-approve-against-github-reviewde.md]] — Verify "N reviewers APPROVE" against GitHub reviewDecision before posting it as a public verdict
- [[wiki/learnings/1781385600632-verify-a-reported-release-version-mismatch-against.md]] — Verify a reported release-version mismatch against the actual artifact before treating it as a release-CI bug
- [[wiki/learnings/1780648573408-verify-the-cited-fix-pr-is-an-ancestor-of-the-repo.md]] — Verify the cited fix-PR is an ancestor of the reporter's build before accepting regression/incomplete-fix framing
- [[wiki/learnings/1782231415029-when-ci-infra-failure-goes-fleet-wide-reruns-mask-.md]] — When CI infra failure goes fleet-wide, reruns mask — escalate instead
- [[wiki/learnings/1780623682428-when-ci-regresses-but-git-diff-in-the-bisect-range.md]] — When CI regresses but git diff in the bisect range is empty, suspect the toolchain
- [[wiki/learnings/1782360530038-xpass-is-a-deterministic-author-owned-ci-failure-n.md]] — XPASS is a deterministic author-owned CI failure, not a flake or regression

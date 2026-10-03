---
title: "slang CI: agentic docs tests only run nightly, so target-gated passes can merge red"
type: learning
topic: slang-compiler
source: learnings/1790929124431-slang-ci-agentic-docs-tests-only-run-nightly-so-ta.md
---

# slang CI: agentic docs tests only run nightly, so target-gated passes can merge red

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-02T08:18:44.431Z
---

# slang CI: agentic docs tests only run nightly, so target-gated passes can merge red

On 2026-10-02 `Nightly Slang Test` / `agentic-tests` went red on `docs/generated/tests/design/ir-reference/differentiation/reverse-mode-emitted-name-prefixes.slang` (CUDA and METAL legs only) after #13358 added a CUDA/Metal-only `expandAutodiffParameterContexts` pass. The merge queue and PR CI do not run `docs/generated/tests`, so the PR merged green. When an agentic-test nightly fails, check which targets fail (`.slang.N` suffix maps to the Nth TEST line) and grep `compare/<green>...<red>` for target guards in `slang-emit.cpp`. Tooling: `actions/runs?created=<ISO>..<ISO>` with the colons encoded as `%3A` works through the OneCLI proxy. If a job's runner was lost, `actions/jobs/<id>/logs` returns BlobNotFound; read `check-runs/<id>/annotations` instead.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790929124431-slang-ci-agentic-docs-tests-only-run-nightly-so-ta.md`_

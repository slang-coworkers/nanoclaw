---
title: "A merge-group sanitizer issue's 'failing tests' list can be collateral, not the trigger (slang#12058)"
type: learning
topic: slang-compiler
source: learnings/1783724442644-a-merge-group-sanitizer-issue-s-failing-tests-list.md
---

# A merge-group sanitizer issue's "failing tests" list can be collateral, not the trigger (slang#12058)

When a merge-group `sanitizer` job fails and an auto-filed issue lists N "failing tests," do NOT assume those tests caused the sanitizer finding. In shader-slang/slang#12058 the issue listed 11 `(cpu)` tests, but **all 11 were `//TEST:EXECUTABLE:` tests that never call `createBuffer`** — they failed on a *different* error: `ASan runtime does not come first in initial library list … LD_PRELOAD` (the #11831/#11833 static-canary / VM-preload flake class, see shared learnings 1782802321817 + correction 1782802481315). The actual heap-buffer-overflow was triggered by a CPU *compute* test that wasn't even in the list.

**Why the trigger test is unpinnable from the log:** the sanitizer lane runs `slang-test -use-test-server -server-count 2`. The ASan report is written to a per-child-process log file (e.g. `ubsan.17884`) containing only the stack trace — no `.slang` path, no render-test command line. In the shared multi-server model, slang-test does not annotate which dispatched test hit which server PID, so the crash cannot be mapped to a test name from CI logs alone. To pin it you must reproduce locally under the ASan build and instrument the suspect call site (e.g. log the `.slang` when `bufferSize % 4 != 0`).

**Also:** the job fails via a post-hoc "Sanitizer Summary" step that scans collected sanitizer log files (`FOUND N SANITIZER LOG(S): … PR-related → job fails`), even though `slang-test` itself reported green (6085/6097 passed). So "slang-test passed but the sanitizer job is red" is expected and correct — look at the sanitizer-log scan, not the test tally.

**Triage takeaways:** (1) verify each listed test's directive (`//TEST:...`) before assuming it's the culprit — EXECUTABLE tests build standalone binaries and hit a wholly different ASan failure mode than shader/compute tests. (2) One deterministic ASan abort in a shared test-server process can present as a cluster of "failures" that are all collateral. (3) A single auto-filed CI issue frequently conflates two independent problems (here: a real overflow + a known infra canary flake) — separate them explicitly in the verdict and route them to different owners (bot-fixable code fix vs. non-bot-PR-able workflow-YAML/VM item).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783724442644-a-merge-group-sanitizer-issue-s-failing-tests-list.md`_

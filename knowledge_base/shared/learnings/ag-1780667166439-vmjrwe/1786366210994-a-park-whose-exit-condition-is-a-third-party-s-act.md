---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1783545891057-wrw44c
written_at: 2026-08-10T12:50:10.994Z
---

# A park whose exit condition is a third party's action has no instrument behind it

**The trap:** A well-reasoned HOLD/PARK note that names its own resume trigger as *"resume when a maintainer asks"* installs a **rule, not a watcher**. Nothing polls the issue. The park then silently degrades into a stall, and the failure is invisible — a park produces no error, no failing check, no log line. Silence looks identical to "correctly waiting."

**Measured (shader-slang/slang#9062, 2026-08-10):** I parked a maintainer-owned issue on 2026-07-08 for good reasons (author == assignee == `jkwak-work`, self-filed, actively reasoning in-thread; the assignee-owned-issue antipattern says don't race them). The note explicitly recorded its exit condition: *"Resume trigger: only an explicit re-dispatch from parent or **a maintainer request**."* That maintainer request arrived **2026-07-16T00:57Z** — `"@nv-slang-bot, can you make a PR based on the Approach A as discussed?"` — and sat **25 days** unobserved until a parent supervisor nudge surfaced it. The park was correct; the *absence of an instrument for its own exit* was the defect.

**How to apply:**
- When parking on a condition owned by someone else, the note must name **WHO CHECKS and HOW OFTEN**, or a scheduled sweep must sit behind it. "I'll notice when they ask" is not a mechanism.
- Prefer an **expiring** park: record a date after which the park is re-evaluated regardless of whether the trigger fired. `"they're working on it"` decays into `"nobody is"` with no observable transition.
- The assignee-owned HOLD heuristic is still right about not racing a maintainer — it just has **no built-in expiry**. Pair it with one.
- ⭐ Companion measurement trap found in the same state check: the branch and worktree `fix/issue-9062` both **existed**, which reads like work-in-progress — but `git merge-base --is-ancestor HEAD origin/master` was true and `git log origin/master..HEAD` was empty. **Zero own commits.** An existing branch/worktree licenses the claim *"checked out"*, never *"started"*. Check for commits, not for a directory.
- ⭐ Also: the stored anchor line drifted. My note cited `processConstructor` at `slang-ir-spirv-legalize.cpp:~1780`; at current master it is `:1805`. Re-derive `file:line` at the moment of use — a park's technical content ages along with the tree it describes.

**Generalization:** this is the same family as *rule-recorded ≠ rule-installed*. Any note whose payload is a future conditional action needs to answer: **what process evaluates this condition, and when?** If the answer is "a future me happens to re-read this file," there is no instrument.

---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786375378701-irfh6y
written_at: 2026-08-10T16:13:33.668Z
---

# [approver/clause-gap] no_protected_paths misses include/** — an ABI break is invisible to Step 1

## Symptom

slang-rhi#825 R2 (`426b62d6778a`) removed **six virtual methods** from the public COM interface
`ITaskPool` and changed `submitTask`'s signature, under a **byte-identical interface GUID**.
`eval-clauses.py` returned **6/6 clauses PASS**, including `no_protected_paths`. Step 1 saw
nothing. Had I trusted the clause sweep, this would have gone to Step 3 with no ABI flag at all.

## Root cause

`APPROVAL_POLICY.json` `protected_paths` is:
`.github/**`, `**/CMakeLists.txt`, `cmake/**`, `external/**`, `**/*.yml`, `**/*.yaml`,
`source/slang/slang-ast-support-code.h`, `**/slang-tag-version.h`.

`include/**` is **not** in that list — for either slang or slang-rhi, both of which document
`include/` as ABI-stable public API with explicit never-remove/never-reorder/never-resignature
rules for COM vtables. The predicate is a path list tuned for build/CI tampering, not for API
surface. So the one file class where a change is *definitionally* high-blast-radius is the class
Step 1 cannot see.

## How to catch it

On ANY PR whose changed-path list includes `include/`, run this before Step 3 severity judgement —
it is two commands and needs no diff reasoning:

```bash
# 1. Are public virtual methods or enumerators REMOVED?
git diff <merge-base>..<head> -- include/ | grep -E '^-.*(virtual|SLANG_MCALL|= 0;)'
# 2. If yes: did the interface GUID change?
git show <merge-base>:include/<hdr> | grep -A2 "class I<Name>"
grep -A2 "class I<Name>" include/<hdr>
```

Removed vtable slot + unchanged GUID = the break is **silent**: an old-header consumer querying
that UUID gets shifted slots, and a third-party implementer of the old interface silently fails to
override. Then ask the question that decides severity: **is the interface externally
implementable?** Grep the public header for a setter that accepts it (here
`IRHI::setTaskPool(ITaskPool*)`, `include/slang-rhi.h:4032`) — if an application can pass its own
implementation, the affected population is outside the repo and you CANNOT enumerate it, which is
itself the reason to abstain rather than clear.

## Fix

- Report the clause gap explicitly in the decision (Step 3 owns what Step 1 cannot see) rather
  than letting a vacuous PASS read as a positive safety finding.
- Proposed policy change: add `include/**` to `protected_paths`, or add a dedicated
  `abi_surface_paths` predicate. Until then this check is manual and must fire on every
  `include/`-touching PR.
- Related trap in the same clause set: `ci_green_on_sha` also passed **vacuously** here
  ("policy does not require CI green"). A clause that passes because the policy doesn't ask is
  not evidence — enumerate CI yourself.

## Transferable rule

**A clause PASS has two possible meanings — "checked and clean" and "not checked" — and the
output looks identical.** Read each passing clause's *evidence string*, not just its status. Any
evidence of the form "policy does not require X" or a path list that doesn't cover the changed
files is an UNCHECKED dimension you now own in Step 3.

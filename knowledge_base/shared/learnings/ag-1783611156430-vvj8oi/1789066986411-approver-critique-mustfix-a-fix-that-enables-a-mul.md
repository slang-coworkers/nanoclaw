---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788545131884-ame9wo
written_at: 2026-09-10T19:03:06.411Z
---

# [approver/critique-mustfix] A fix that enables a multi-arm branch needs a test per arm — don't clear an untested arm by shared-machinery analogy

## Symptom
On slang#12892 R2 (@66b77beebfda, "Fix node discard in tryParseGenericApp", Fixes
#9810) I derived WOULD_APPROVE under the newly-restored wide policy (all 6 clauses
pass). The DECISION_REVIEW codex critique returned **must-fix** and I revised to
**ABSTAIN_POLICY:OPEN_GAP**. This is the first recorded instance of the critique gate
flipping a decision on the MERITS (not a clause artifact) in this group.

## The change
A 6-line parser fix adds one guarded substitution in `tryParseGenericApp`:
```cpp
if (as<MemberExpr>(base) &&
    (as<DeclRefExpr>(checkedBase) || as<OverloadedExpr>(checkedBase)))
    base = checkedBase;
```
It ENABLES a new path (generic member call through a pointer) that has **two distinct
accepting arms**: checkedBase can be a single `DeclRefExpr` (one overload) OR an
`OverloadedExpr` (multiple overloads). The PR's one new test declares TWO `Bar`
overloads, so it exercises ONLY the `OverloadedExpr` arm. The single-overload
`DeclRefExpr` arm — `foo->Bar<42>()` with ONE `Bar` — is untested, and a corpus search
found NO pre-existing `->` generic-member-call test at all.

## Root cause of the near-miss
I cleared that coverage gap as "advisory" by arguing the single-decl arm "shares the
identical `base = checkedBase` → `parseGenericApp` machinery" as the tested arm — a
CODE-TRACE ANALOGY, not evidenced coverage. The conservative-lean bar is explicit:
a 🟡 gap clears only if the branch is *covered elsewhere* (identify the test) or the
trigger is unreachable/inconsequential. An untested arm that is a plausible common
trigger **directly within the PR's stated purpose** does not clear by analogy —
"uncertainty => ABSTAIN".

## How to catch it
When a fix ADDS a branch/guard that accepts MULTIPLE shapes (an `||` of `as<>` checks,
several enum cases, both `.` and `->` forms), treat each accepted shape that lies within
the PR's purpose as needing its own trigger-present test. Before calling an arm "covered
elsewhere," actually FIND the test (grep the corpus for the exact shape); if none exists
and you cannot add one (approver is read-only), that arm is an OPEN_GAP, not a nit. This
is the same discipline as the standing "positive control per new flag" probe, applied to
"positive control per new accepting arm."

## Fix / rule
- Enumerate the distinct accepting arms of any new guard; map each to a test or an
  existing-coverage citation.
- "Shared downstream machinery" is NOT coverage. Only an identified test clears an arm.
- An untested arm central to the PR's purpose ⇒ ABSTAIN_POLICY:OPEN_GAP (a human confirms
  or adds the test). This is an expected shadow-mode false-abstain when humans then approve
  (slang#12892: MEMBER jkwak-work APPROVED the exact head; production+Devin found 0 bugs) —
  and it is excluded from agreement scoring, so lean conservative.
- Run DECISION_REVIEW before recording a WOULD_APPROVE; it is the backstop that catches
  analogy-based gap clearing.

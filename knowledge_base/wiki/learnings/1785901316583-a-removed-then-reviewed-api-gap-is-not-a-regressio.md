---
title: "A removed-then-reviewed API gap is not a regression: check whether the removed thing ever SHIPPED"
type: learning
topic: review-process
source: learnings/1785901316583-a-removed-then-reviewed-api-gap-is-not-a-regressio.md
---

# A removed-then-reviewed API gap is not a regression: check whether the removed thing ever SHIPPED

Filed shader-slang/slang#12356 (`getDefaultValueBlob` unreachable from C#/C ABI). Handed to me as "a verified C-API regression with a verified root cause". The substance was right; **the classification and three framing claims were wrong**, and each error had the same shape — a plausible mechanism nobody had reason to re-check because the conclusion looked correct.

**1. "Regression" needs a SHIPPED predecessor. Check the tags, not the diff.**
The flat export `spReflectionVariable_GetDefaultValueBlob` was removed by commit `de1550a3c`. It's natural to read "an export was removed" as a regression. But it existed *only on the PR branch* and was removed *before* merge:
```bash
for t in v2026.11 v2026.12 v2026.12.2 v2026.13 v2026.13.1 v2026.14 v2026.14.1; do
  printf '%-14s %s\n' "$t" "$(git grep -c '<symbol>' "$t" -- include/ 2>/dev/null | wc -l)"
done
# must-hit control, or a wrong tag name silently reads as "absent":
git ls-tree -r --name-only "$t" -- include/slang-deprecated.h | wc -l   # expect 1
```
0 at every tag ⇒ no release ever had it ⇒ **there is no regression, only a coverage gap introduced with a new API**. A removal inside an unmerged branch is invisible to users. Without the must-hit control a typo'd tag returns 0 and *confirms* the wrong story.

**2. A commit message saying "removed at review request" may be a two-option offer, not a directive.** The maintainer first objected on new-function grounds, then *self-corrected* 2 days later ("I am sorry but I had some misunderstanding… the `sp*_*()` naming pattern is deprecated") and offered **either** inlining **or** moving it back. The author picked one. Reading only the first comment (or only the commit message) produces "maintainer required removal" — subtly wrong about who decided what. Read the maintainer's comments **in sequence**; a later self-correction can invert the earlier one.

**3. `state_reason` is a FIELD; "won't-fix" is a claim about that field.** A closing comment reading "no good way to clean it up" is *prose declining the work* — but the recorded `state_reason` was `completed`. Describe the prose, and quote the field separately. Same family as the general rule: don't let a paraphrase stand in for the field you can query.

**4. An issue number that behaves oddly may be a PULL REQUEST.** `#11827` had a `pr:`-prefixed label and a null `state_reason` — both PR tells. `gh api .../issues/11827` happily returns it. Discriminate before proposing "reopen it":
```bash
gh api repos/O/R/issues/N --jq 'if .pull_request then "PR" else "ISSUE" end'
```
It was a closed **unmerged** PR authored by our own bot. "Reopen #11827" would have meant resurrecting an abandoned PR, not reviving an issue.

**5. Sub-collection pagination silently inverted a load-bearing finding.** A review thread raised this exact gap and I first concluded it went unanswered. Page 1 returned **exactly 100** = the `per_page` cap; page 2 held 15 more, including the author's one-word reply **"yes"** confirming the omission was intentional. That single word changed the issue's class from "unreviewed oversight" to "intentional omission, undocumented". **Any count landing exactly on the page size is a cap, not a total** — walk `&page=N` until short.

**6. Two errors where my instrument was right and I under-read it.**
- `grep -rIl getDefaultValueBlob` listed three `source/slang-wasm/*` files. I read past them and wrote "C++-only" — literally false, since an Emscripten binding exposes it to JS. The grep had already told me.
- I inherited "the only declaration-only `SLANG_API` member in the public header". `grep -cE 'SLANG_API.*\);$' include/slang.h` = **14**, not 2. The true claim is narrower: the only out-of-line `SLANG_API` member *of that struct*. **Rescope an inherited superlative before repeating it** — "only X in the whole header" is a tree-wide claim and cheap to test.

**7. "Not exported" vs "not bindable" are different claims — `nm` distinguishes them.**
```bash
nm -D --defined-only libslang.so | grep -i '<name>'
```
The symbol *is* exported, as `_ZN5slang18VariableReflection19getDefaultValueBlobEPP10ISlangBlob` (C++-mangled), while the deprecated control is a plain unmangled name. So "no export exists" is false; the accurate claim is "no documented, portable, stable C ABI entry point" — mangling and implicit-`this` vary by compiler/platform, and one Linux Debug ELF doesn't generalize to Windows/macOS. Don't say "impossible to bind" either: a caller *can* `NativeLibrary.GetExport` a decorated name.

**Method note.** All seven were caught by running `/codex-critique` *before* posting, then re-deriving each objection myself rather than accepting it — one of them (the enum claim) was a factual error in **my own** text that the critic caught, and two of the critic's own claims needed my verification before I'd use them. Three rounds to approve. Worth it: the artifact corrects my parent three ways and had to be right to do so.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1785901316583-a-removed-then-reviewed-api-gap-is-not-a-regressio.md`_

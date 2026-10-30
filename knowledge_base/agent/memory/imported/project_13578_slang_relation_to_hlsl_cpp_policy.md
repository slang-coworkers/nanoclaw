---
type: project
name: project_13578_slang_relation_to_hlsl_cpp_policy
description: "slang#13578 (tangent-vector, 10-12, self-assigned, no labels): proposes a design-principles doc saying Slang is its own language; compatibility with HLSL/C++ is not a goal (exceptions are C-style shared headers and ease of porting). Maintainer governance proposal -> held: NO dispatch, NO bot post. The spec's introduction-goals.md is still a TODO stub, and the user guide still advertises HLSL compatibility."
---

# slang#13578: how Slang does and does not relate to HLSL, C++, etc.

**10-12 19:22Z, `issue_opened`.** Live read at ~19:23Z: open, human author `tangent-vector`, self-assigned,
no labels, 0 comments, `updated_at` 11 s after `created_at` (assignee edit). The live body matches the payload.
Only my own webhook session `sess-1791832922054-x10ik4` was on `gh-issue-shader-slang/slang-13578`. There was
no task and no conversation hit.

**Disposition: held. Nothing dispatched or posted.** This follows the #13550 / #13498 / #13457 precedent
([[project_13550_intrinsic_annotation_application_policy]], [[project_13498_breaking_change_label_policy]]).
The issue is a maintainer's proposal for project policy: draft wording plus a list of examples of rejected
requests (C++ templates, `public:`/`private:` sections, out-of-line methods, `const` methods, `virtual`,
`constexpr`, C++ constructor syntax, implicit zero-arg init). The author says the draft is "probably over-long",
so the team still has to decide the length, where the doc lives and the final wording. The filer self-assigned
it, and nobody asked the bot for anything.

**Repo facts I checked** (slang master `b00d9e482a`, spec `d66b8df`, 10-12):
- The natural home already exists and is empty: spec `specification/introduction-goals.md` is
  `# Slang Language Goals` / `TODO`. Next to it, `introduction-language-evolution.md` defines the
  proposal process vs. the issue-driven process. Since #13439 moved the language reference to the spec repo,
  a principles doc probably belongs in a **spec-repo** PR.
- The slang user guide says the opposite of the proposal: `docs/user-guide/00-introduction.md:20`
  ("Slang is backward compatible with most existing HLSL code") and `:60` ("high degree of compatibility with
  existing HLSL code"), and `01-get-started.md:45` ("compatible with most HLSL code you would write").
  Adopting the policy would mean rewording these lines.
- No existing design-principles text in slang `docs/design/` or `CONTRIBUTING.md`. The only related line is
  `docs/design/interfaces.md:60` ("when in doubt, do what Swift does").

I offered these as operator-only, not to GitHub.

**10-29 11:33Z, operator triage request** (dashboard, msg 30). Live re-read: still open, 0 comments, no labels,
body unchanged; one change, milestone `Q4 2026 (Fall)` added 10-14 17:07Z. Spec `introduction-goals.md` still `TODO`,
the user-guide lines are unchanged on master `01dcd35682`, and no PR/issue references #13578. I answered the
triage myself (docs/governance, spec repo; low, non-defect; maintainer-owned) and did not dispatch the triager,
because its workflow would post a public triage comment on a self-assigned maintainer policy issue. I offered
the operator: dispatch the triager, or post the two pointers.

**Resume** on a comment that @-mentions @nv-slang-bot (for example, asking for the spec PR or the user-guide
rewording once the text is agreed), or if the operator says to post the pointers. A mention arrives as a
webhook, so no re-chase timer is needed.

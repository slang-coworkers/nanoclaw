---
name: project_12077_pdf_docs_distribution_parked
description: "#12077 PDF docs distribution feature request — TERMINAL 2026-08-04: maintainer declined + closed not_planned (filename says 'parked'; it isn't)"
metadata: 
  node_type: memory
  type: project
  originSessionId: a346a6ce-a1af-464a-b278-fdf493bcfc5a
---

🔴 **TERMINAL 2026-08-04 — DECLINED BY MAINTAINER. Not parked any more; the filename is stale, do not re-read it as a state.**
`swoods-nv` (MEMBER, and the issue's assignee) commented [`5181057587`](https://github.com/shader-slang/slang/issues/12077#issuecomment-5181057587) and **closed the issue in the same second** (`closed_at` = comment `created_at` = `2026-08-04T15:18:20Z`, `closed_by: swoods-nv`, `state_reason: not_planned`). His reasoning: the language/module references are changing weekly, so *"there's too much flux to create something that's as ossified as a PDF (even if the PDF were to be regularly updated)"* — tabled until those references are *"more substantially complete."*

⇒ This is a **DECISION, not discussion** — but the decision is **NO**, so [[feedback_reopen_not_release_parked_feature]]'s release branch never arms. The park-release condition ("re-engage on maintainer comment / design decision") **fired and resolved to close**. **No fixer, no dispatch, no PDF pipeline — ever, unless a maintainer reopens.**
⭐ **The classifier in that lesson is under-specified: it splits *decision* vs *discussion* and assumes a decision means release.** A decision can be a **refusal**, which is terminal, not a release. Read the *polarity* of a decision before its *existence*.
⭐ Maintainer comment was addressed to the reporter (`@vk4d`), **not** to the bot, and carries **no `@nv-slang-bot` mention** ⇒ we hold **no posting authorization** here. Our own two prior comments already told `vk4d` the issue was parked pending exactly this decision, and the maintainer has now answered him directly, in public, on the issue. **Adding a third bot comment restates what a MEMBER just said, to the person he said it to.** Silence is correct — see [[feedback_holding_echoes_are_noise]].
⭐ Note the reporter's own last word was a thanks/ack (`4957042258`), and our reply to it (`4957052795`) is what made this the tracked home for the decision. That worked: the decision landed here.

---

shader-slang/slang#12077 (author vk4d): feature request to distribute downloadable **PDF** exports of the docs at shader-slang.org/docs/ (User's Guide, Module Reference, Specification).

**Verdict (slang-triager, verified @HEAD 8f0c3515d):** feature-request / low (enhancement) / docs+website tooling / P3. NOT a compiler bug — nothing to reproduce.

**Why it WAS parked (historical — design-gated, needs-maintainer; the gate has since resolved to NO):** the three artifacts live in THREE separate sources — User's Guide (`docs/user-guide/`, Jekyll, in-repo), Module Reference (generated → separate repo `shader-slang/stdlib-reference`), Specification (separate repo `shader-slang/spec`). NO PDF pipeline exists anywhere in-repo (no pandoc/weasyprint/mkdocs/sphinx). Natural "Download PDF" surface = website front-end (`shader-slang.github.io`), not this repo. No single slang-repo change satisfies it; no agreed owner/design. Smallest in-repo slice = a CI step rendering `docs/user-guide/*.md` → release PDF (User's Guide only).

**Status (SUPERSEDED — see the TERMINAL banner at top):** Issue Type set = Feature; verified 5-bullet verdict posted to GitHub (comment 4956636383, nv-slang-bot). NO fixer dispatched. Chain closed at triaged. ~~Re-engage on maintainer comment / design decision webhook. Do NOT auto-release without maintainer go.~~ — **that trigger FIRED 2026-08-04 and resolved to DECLINE + close (`not_planned`).** Current state: **TERMINAL, no action ours.** The only thing that reopens this: a maintainer reopening the issue, or `swoods-nv`'s stated precondition being met (language + module references "substantially complete") **and** a maintainer saying so. **A fresh comment from the reporter asking again is NOT that** — it re-opens discussion at most, and the answer on record is no.

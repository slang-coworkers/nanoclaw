---
name: base
license: MIT
type: workflow
description: "Universal workflow stub — splice point for cross-cutting overlays (buddy, gates, etc.). Workflows that don't declare `extends:` implicitly extend `base`; an overlay declaring `applies-to.workflows: [base]` therefore reaches every workflow that didn't opt out via `extends: none`."
requires: []
uses:
  skills: []
  workflows: []
---

# /base — Universal Workflow Stub

This workflow is a target for `extends:` and a splice point for cross-cutting overlays — not something agents invoke directly. Every workflow that omits `extends:` implicitly extends `base`, so overlays declaring `applies-to.workflows: [base]` auto-attach to all of them.

## Steps

1. **Understand** {#understand} — Read the inbound message. Identify what's being asked, what artifacts exist, and what the success criterion is. If the request is ambiguous, ask once before working.

2. **Setup** {#setup} — Establish the workspace state needed for the task: claim active-work, ensure the repo or files you'll touch are ready, gather any session memory worth recalling.

3. **Change** {#change} — Do the work. Make the smallest correct change for the task; keep the diff or output focused.

4. **Deliver** {#deliver} — Produce the artifact (file, PR, message, report) the caller asked for. Verify it actually addresses the original request.

5. **Report** {#report} — Send a concise status to the caller: what was done, what remains, where to find the artifact. End the turn.

## Mode invariants

- These step ids (`understand`, `setup`, `change`, `deliver`, `report`) are the universal anchor convention. Concrete workflows reuse the same ids when their phases match — overlays target by id.
- Workflows that opt out of the convention (e.g. one-shot status tools) declare `extends: none` and will not pick up `applies-to.workflows: [base]` overlays.

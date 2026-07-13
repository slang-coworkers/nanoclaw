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

A target for `extends:` and a splice point for cross-cutting overlays — agents never invoke it directly. Workflows omitting `extends:` implicitly extend `base`, so overlays with `applies-to.workflows: [base]` auto-attach to all of them.

## Steps

0. **Track** {#track} — Seed a TodoWrite list with the concrete workflow's steps (not this stub's) and mark each complete as you go. Skip only for a one-shot with no multi-step body.

1. **Understand** {#understand} — Read the inbound message. Identify what's asked, what artifacts exist, the success criterion. If ambiguous, ask once before working.

2. **Setup** {#setup} — Establish workspace state for the task: claim active-work, ready the repo/files you'll touch, recall any useful session memory.

3. **Change** {#change} — Do the work. Smallest correct change; keep the diff or output focused.

4. **Deliver** {#deliver} — Produce the artifact (file, PR, message, report) asked for. Verify it addresses the original request.

5. **Report** {#report} — Send a concise status to the caller: what was done, what remains, where the artifact is. End the turn.

## Mode invariants

- Step ids (`understand`, `setup`, `change`, `deliver`, `report`) are the universal anchor convention. Concrete workflows reuse the same ids when phases match — overlays target by id.
- Workflows opting out (e.g. one-shot status tools) declare `extends: none` and won't pick up `applies-to.workflows: [base]` overlays.

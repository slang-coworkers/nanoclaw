---
name: khr-repo-tools
license: MIT
description: 'How to read and edit a prepared khr job repository: which guidance to read before editing, how to learn its conventions, and repository-specific reading lists (Vulkan-ValidationLayers, VK-GL-CTS). Use before changing any job repository.'
provides: [code.read, code.edit]
---

# khr repo tools

You work only inside `/workspace/agent/jobs/<job>/repos/<name>/`. Each worktree is on its topic branch at the pinned base listed in `targets.json`.

## Before editing any repository

1. Read its trusted instructions in `trusted-instructions.json`, from the pinned target revision only.
2. Read its tracked top-level `CONTRIBUTING*` and the relevant `BUILD*` documentation. Then read the style guides, templates and task-specific contributor documentation those files point to. Follow references to the guides that apply.
3. Look at comparable existing changes at the supplied revision to learn the repository's conventions. Use only history in `HEAD`'s ancestry (see the workspace-scope invariant).
4. Use the repository's own workflow scripts. Don't guess a manual procedure when one exists.

## Repository reading lists

- **Vulkan-ValidationLayers:** `CONTRIBUTING.md`, `BUILD.md`, `docs/creating_tests.md` and `tests/README.md` before editing. If generated files are involved, also `docs/generated_code.md`, and follow its workflow.
- **VK-GL-CTS:** `README.md` and `external/vulkancts/README.md` before configuring.
- **Specification repositories:** use `/khr-spec-authoring`.

## Editing

- Make the change in the files the request needs, keeping each file's existing style.
- Generated files, implementation and tests follow each repository's native workflow. Never hand-edit generated output; edit the inputs and rerun the generator.
- Keep related specification and implementation changes consistent, within the requested scope.
- Commit with the preset identity: plain `git commit`, with no `-c user.*`, `--author` or `--amend` of commits from before this job.

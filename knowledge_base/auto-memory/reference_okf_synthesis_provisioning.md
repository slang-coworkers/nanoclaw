---
name: okf-synthesis-provisioning
description: "The okf-synthesis skill has NO source-of-truth in the NanoClaw repo; it is provisioned per-agent-group in each group's own .claude-shared mount, and Main cannot file-copy a mirror to peers."
metadata: 
  node_type: memory
  type: reference
  originSessionId: a6095251-0434-402e-8497-1d80bc61de04
---

# okf-synthesis skill: per-group, no repo source, no cross-group file mirror

Verified 2026-08-22 by direct filesystem probe from Main's container.

- **No repo source-of-truth.** `okf-synthesis` / `okf_synth` appears **nowhere** in the NanoClaw source tree — not `container/skills/`, not the groups scaffold, not `/app`, not `.external-skills.json` (which lists only `shader-slang/slang-skills` external skills). grep across all checkouts returns empty. So there is no upstream file to edit for propagation. This is a gap: it should be baked into `container/skills/` or the slang-skills repo so group-init carries it.
- **`/home/node/.claude` is a PER-AGENT-GROUP `.claude-shared` mount**, not shared across groups. `findmnt` shows Main's is `ag-1776713211742-1w6l4e/.claude-shared`. Each coworker group has its own SKILL.md copy under its own `.claude-shared`. Editing one does NOT propagate.
- **Main cannot file-copy a mirror to peers.** `/workspace/extra/ephemeral/prod-groups` (`/dev/vdb`) is **read-only** to Main's container, and peers' `.claude-shared` dirs are not mounted into Main at all. Mirroring must go peer→peer via the diff relayed as a message, each group applying it to its own local `~/.claude/skills/okf-synthesis/`.
- **SKILL.md's embedded `okf_synth.py` block is the source of truth for the tool** — it overwrites `/workspace/agent/tools/okf_synth.py` on every run. A fix to the on-disk tool alone is wiped next run; it MUST land in SKILL.md's embedded block. Keep `test_okf_synth.py` green alongside.
- **Which groups run it:** fixer, triager, and Main's own group have written `tools/okf_synth.py` (i.e. run the task). The recurring task is `okf-memory-synthesis-*`, `0 4 * * *`, gated by `okf_synth.py gate`.
- **Dialect note:** the fixer's tree is heavy on the NanoClaw auto-memory nested `metadata.type` frontmatter (263/501); the triager's is NOT (1/683, ~635 genuinely typeless). The `metadata.type`-recognition fix helps the fixer specifically; the triager's backlog is real typeless DOSSIERs. See [[reference_okf_synth_classifier_fix]] for the heuristic change.

**How to apply:** to change this skill fleet-wide, either (a) relay the diff to each running group to apply locally, or (b) get it into the repo's provisioning path so future group-inits carry it — (b) is the durable fix and needs an operator/code change.
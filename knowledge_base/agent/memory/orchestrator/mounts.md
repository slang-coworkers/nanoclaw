---
type: reference
title: Container mounts (orchestrator)
description: Main's container mount map, including the /workspace/project read-only mount the spine table omits.
---

# Container mounts

| Container path      | Access                      | Notes                                                                              |
| ------------------- | --------------------------- | ---------------------------------------------------------------------------------- |
| `/workspace/agent`  | read-write                  | Per-group folder (notes, memory, conversations). Project clones live here too.     |
| `/workspace/shared` | read-write (Main) / ro else | Cross-group facts and learnings. Coworkers read but cannot write; Main writes via `append_learning`. |
| `/workspace/project`| read-only                   | Optional — mounted only when a coworker's `container.json` declares the path in `additionalMounts`. |

The `/workspace/project` row is the one detail the composed spine's Mounts table
does not list. The other two rows duplicate the spine and are kept here only so
this page reads as a complete map.

See also [[orchestrator/self-modification.md]] for how a workspace `pnpm install`
(temporary, this turn only) differs from durable `install_packages`.

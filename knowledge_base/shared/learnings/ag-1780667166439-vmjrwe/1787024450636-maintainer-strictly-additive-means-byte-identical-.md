---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786744681592-v6fbwz
written_at: 2026-08-18T03:40:50.636Z
---

# Maintainer "strictly additive" means byte-identical existing branches, not behavior-equivalent

When a maintainer says a change to shared code must be "strictly additive" (e.g. adding a `TemplateDecl` alongside `GenericDecl` at consumer sites), it means the EXISTING branch's source text must stay byte-identical — not merely behavior-equivalent. Merging two cases through a common base (`if (auto x = as<ParameterizedDecl>(decl))` replacing `if (auto g = as<GenericDecl>(decl))`) is a textual modification of the generic path and will be rejected even though behavior is identical. Even `if (!as<GenericDecl>(c) && !as<TemplateDecl>(c))` textually alters the original `if (!as<GenericDecl>(c))` condition. The faithful pattern: keep the original block verbatim and PREPEND a distinct branch — `if (as<TemplateDecl>(c)) { /* handle */ } else if (!as<GenericDecl>(c)) { <original block unchanged> }`. The `else if` prefixes the original condition without changing its body or indentation. shader-slang/slang#12568 (Step 1 of a staged epic; the base-class unification was explicitly the maintainer's LATER commit). codex OUTPUT_REVIEW is good at catching the subtle "combined condition still modifies the generic branch" case that a human skims past.

Second lesson from the same PR: NEVER trust a build subagent that returns in <2min for a 15-25min Slang build. Two `general-purpose` build subagents backgrounded ninja and returned immediately claiming success; a concurrent confirming `cmake --build` then corrupted the link step (`objcopy: input file '…so' is empty`). Run the build directly via Bash `run_in_background` + a Monitor gating on `BUILD_EXIT=`, and before launching verify no ninja is alive in THIS worktree via `pgrep -x ninja` + `readlink /proc/<pid>/cwd` (never `pgrep -f`, which matches your own argv).

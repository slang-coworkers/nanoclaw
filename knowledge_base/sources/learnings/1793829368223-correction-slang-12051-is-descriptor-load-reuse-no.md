---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788442123367-aqekvl
written_at: 2026-11-04T21:56:08.223Z
---

# Correction: slang#12051 is descriptor-load reuse, not NonUniform/nonuniformEXT

My earlier learning on slang#12897 (bindless GLSL buffer heap missing GL_EXT_nonuniform_qualifier) cited "#12161/#12051" as where nonuniformEXT wrapping lives. That is wrong for #12051. `gh issue view 12051` gives the title "Add a way to re-use loaded descriptors multiple times" (closed). The issue that tracks NonUniform on DescriptorHandle<T> for HLSL/GLSL/WGSL is #12161 alone. The mistake came from a recalled wiki summary and was caught by OUTPUT_REVIEW. Check an issue's title at the source before you cite it as "related".

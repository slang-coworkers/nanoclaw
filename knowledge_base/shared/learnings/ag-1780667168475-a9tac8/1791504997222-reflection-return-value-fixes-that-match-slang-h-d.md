---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791495439286-mw0lsm
written_at: 2026-10-09T00:16:37.222Z
---

# Reflection return-value fixes that match slang.h docs can still be breaking: grep slangpy for `== 0` generic markers

Case: PR #13535 changed `TypeReflection::getElementCount()` for unsized `T[]` from 0 to SLANG_UNBOUNDED_SIZE, which is what slang.h always documented. On paper it is a doc-conformance fix. In practice slangpy (`src/sgl/refl/type.h:231` `is_generic(){return num_elements()==0;}`, `type.cpp:625` `any_generic_dims`, `slangpy/builtin/array.py:85`, `tensorcommon.py:285`) uses 0 as its "generic/unsized dimension" marker, stores `int(element_count())`, and so now reads -1 for function params like `float[] a`. slang-rhi Metal `collectPointerFields` (`metal-shader-object-layout.cpp:22`) does `if(count==0)return; for(i<count)`, which becomes an effectively infinite loop. Rule: when a reflection value changes, grep slangpy and slang-rhi for the *old* value being used as a sentinel (`== 0`, `> 0`, narrow_cast, uint32 casts), not only for the accessor, and treat the PR as `pr: breaking change`. Also note that `CI SlangPy Trigger Test` is SKIPPED on bot-authored PRs; dispatch it manually (`workflow_dispatch pr_number=N`) to get coverage. A quick C++ probe linking `build/Release/lib/libslang-compiler.so` (master vs PR) is the fastest way to show the value change for function-param arrays (`m->getLayout()->findFunctionByName(...)->getParameterByIndex(0)->getType()->getElementCount()`).

# An inline template's __FILE__ names the header, so a crash path's directory prefix attributes the TU, not the owner of the data

On shader-slang/slang-rhi#818 the assert path read `src/metal/../core/short_vector.h:187`, and the issue's own reading was "the include path says the indexing TU is under `src/metal/`". True but nearly useless, and it pointed triage at the wrong subsystem.

`short_vector::operator[]` is an **inline template member**, so `__FILE__` expands to the *header*, and the `src/metal/../core/` prefix reflects the relative include path of whichever TU instantiated it. It tells you a metal TU was on the stack; it does **not** tell you that Metal-owned data was indexed.

**Three measurements that settled it** (at the exact pinned commit, not HEAD):
- `src/metal/` declared exactly **two** `short_vector`s (`metal-command.cpp:71-72`) and **neither was referenced again anywhere in that file** — structurally incapable of being the crash site. That is much stronger than "weak evidence": it's a disproof, and it cost one `grep`.
- **Zero** files under `src/metal/` included `../core/` at all (must-hit control: that TU has 7 includes) — so the literal path in the message is not even spelled by a metal file.
- The real chain was `metal-*.cpp` → `metal-base.h:3` → `../rhi-shared.h` → `core/short_vector.h:10`, which also pulls in `shader-object.h`, `device.h`, `shader.h`, `command-list.h`. The indexed vectors lived in `shader-object.h:227-230`.

**The generalisable rules:**
1. **A path in a crash message is a claim about instantiation, not ownership.** Before triaging to the directory named in the path, census what that directory actually declares, and check whether it even includes the header by that spelling.
2. **"Declared but never referenced" is a disproof, not weak evidence.** When ruling a candidate out, prefer the check that makes it *impossible* over the one that makes it *unlikely*.
3. **Do the census at the commit CI actually built.** The failing runs pinned the submodule 10 commits behind the default branch; reading the working tree would have been reading code that never ran. `git show <pin>:<path>` throughout, and check `--is-shallow-repository` first — a shallow clone yields a *false origin*, not a false zero.

**Second, independent finding from the same chain — a retrying CI step hides crash faces, and an issue title freezes one of them.** Four crash instances across two runs produced **three** distinct signatures: `index < m_size` at `short_vector.h:187` (prefix `src/metal/../core/`), `new_data != nullptr` at `short_vector.h:582` (prefix plain `src/core/` — a `malloc` failure inside `grow()`, i.e. a garbage capacity), and a bare `Segmentation fault: 11` with **no assert text at all**. The issue recorded only the first; a sibling issue on the same job recorded only the segfault and was *titled* "exit 139", so a census keyed on either title misses half the data. Both faces are what reading a corrupted container looks like.

⛔ And the tidy explanation for the segfault face was **false**: `SLANG_RHI_ASSERT` has no `_DEBUG` guard and `handleAssert` prints then `std::abort()` unconditionally, so "the assert was compiled out in Release" cannot be the mechanism. Check the assert macro's definition before explaining why an assert didn't fire.

⇒ When a step retries, enumerate **every attempt's** signature from the log, not just the one the job conclusion reports. Capture the logs the same pass — retention was ~7 days here.

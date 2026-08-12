# A closing-sum assert guards completeness, never correctness — and a sabotage that FAILS to trip a guard maps its real edge

Follow-on to the fix>assert>document precedence. Two agents hardened their own analysis scripts, then
discovered the hardening's limits by trying to defeat it — and the *failed* attack was worth more than the
successful ones.

**The finding.** A bucket-partition tool asserts `sum(buckets) == len(input)` and prints
`PARTITION CLOSES: True`. Sabotage a *middle* classification rule so it rejects everything, expecting the
assert to fire. **It doesn't — exit 0.** The terminal catch-all bucket absorbs whatever an earlier rule
wrongly rejects, so the sum still closes. Measured on a real dylib: breaking the `glslang::` rule silently
reshuffled all **1034** of its symbols into three other buckets (`spv::` 247→256, `std::` 7→133,
`other` 105→1004) and the tool still reported the partition as closing.

⇒ **A closing-sum assert guards the partition's COMPLETENESS, never any individual rule's CORRECTNESS.
A misclassification is silent by design.** "The buckets close" is evidence that nothing *vanished*, not
that anything is in the right bucket. Both of us had been reading it as the stronger claim. Rule-level
correctness rests entirely on known-good cells — so record the per-bucket numbers from a verified run, and
put the assert's scope limit *next to the assert*, where someone about to over-read it is standing.

⭐ **The transferable method: a sabotage that FAILS to trip a guard maps the guard's real edge, and that is
more informative than one that trips.** A tripping sabotage confirms the guard works on the case you
imagined. A non-tripping one tells you what the guard was never watching. Budget attacks for both outcomes
and treat "the guard didn't fire" as a result, not a failed experiment.

**Two more traps from the same session:**

- **A self-test against a duplicate can pass while the shipped path is broken.** One agent's parser logic
  was inlined in its report loop, so a self-test would have exercised a copy. Mine shared the *classifier*
  but had the input preparation (Mach-O `_`-prefix stripping) written twice — report and self-test. Factored
  into one `load_mangled()` helper both call. **Prove sharing by sabotage, not by inspection:** edit only
  the shared helper and require *both* the report and the self-test to break. If one survives, you had two
  code paths. (Bonus discriminator: the ELF cell correctly kept passing, since it doesn't strip — which
  confirms the sabotage hit the Mach-O branch specifically.)

- **Release tarballs for different architectures can share an identical inner path.** Both macOS slang
  tarballs contain `./lib/libslang-glslang-<ver>.dylib`, so a plain extract of the second **silently
  overwrites the first** and you measure one architecture twice under two names. One agent's data did
  exactly that mid-session. Extract to distinct directories, and **verify the arch by CPU type, never by
  filename or directory name**: Mach-O header offset 4 gives `cputype` — `0x0100000c` = ARM64,
  `0x01000007` = X86_64. A file-size difference is a useful second check; identical sizes are a red flag.

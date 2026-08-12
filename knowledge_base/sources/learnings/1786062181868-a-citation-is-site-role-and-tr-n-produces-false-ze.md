# A citation is (site, role) — and tr '\n' ' ' produces false zeros on wrapped markdown

## Two verification defects from one review, both invisible to matchers

### 1. A correct citation in the wrong role reverses your conclusion

A PR body's glossary cited `slang-check-stmt.cpp:642` as *"the same idiom appears at…"* — precedent
for the predicate the PR shipped. The site was real, the quoted idiom was genuinely there, and every
individual fact in the sentence was true.

But that site tests only **one** of two sentinels, making it a member of the exact defect class the
PR's stronger predicate was written to fix. So the body **cited a defective site as precedent for the
fix that repairs it** — arguing against its own change — and it sat there for hours.

**Why no instrument caught it: every check anyone ran was a *site* check.** `grep` confirms the line
exists and says what it is quoted as saying. Nothing asks *"does this support the sentence I hung on
it?"* Site checks are mechanical; role checks are not, and **no matcher fires on a role error**. In a
session that produced ~10 instrument defects, this was the only class caught by a *reader* rather
than by a probe.

⇒ **After citing anything, state the conclusion a reader will draw from it and compare that to the
conclusion you want.** Same axis as "a predicate is (operand, comparand)" — the literal match can be
right while the inference from it is wrong.

Two repair notes:
- **Replace, don't append.** An earlier fix in the same body added a corrected paragraph without
  deleting the superseded one, leaving the artifact asserting both sides. Delete what you supersede.
- **Removing a wrong citation is not supplying the right one.** The first repair removed the
  misleading precedent and left the body with *zero* mentions of the site actually followed.

### 2. `tr '\n' ' '` transliterates rather than collapses — a false zero on any wrapped phrase

A peer's verification probe reported a phrase **absent** when it was present:

```bash
printf 'stronger: those\n  sites would\n'
tr '\n' ' '                 | grep -oF 'those sites'   # → 0   ← FALSE ZERO
tr '\n' ' ' | tr -s ' '     | grep -oF 'those sites'   # → 1
python3 -c "re.sub(r'\s+',' ', text)"                  # → 1
```

`tr` maps the newline to **one** space, so the markdown indent's remaining spaces survive and the
needle sees `those   sites`. Any fragment that crosses an indented line wrap silently misses.

⇒ Use `re.sub(r'\s+', ' ', text)` in Python, or add `tr -s ' '`, for any multi-word fragment sweep
over wrapped text.

**The polarity is what made it dangerous.** The probe was asking *"did I assert an unsupported
claim?"* — so a false zero would have **cleared the claim by pretending it was absent**. A
verification tool that fails toward "nothing to see" is strictly worse than one that fails loudly,
because a clean result is exactly what you were hoping for.

### Corollary: an omission is safe only if its justification is retrievable

Two things were deliberately left out of that PR. Each is defensible *only* because the measurement
behind it is written into a durable note rather than living in a peer conversation. An omission whose
reasoning exists only in a chat thread is indistinguishable from an oversight once the thread is
gone — and worse, **saying it to a peer feels discharged**, identical to having recorded it.

⇒ **Record the boundary rather than closing it.** When you decline to widen a fix, write down what
you measured and why the narrow scope is right, somewhere a future reader can find it.

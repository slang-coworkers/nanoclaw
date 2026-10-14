---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791920241254-cz45c7
written_at: 2026-10-13T20:09:50.410Z
---

# slang-test filecheck-buffer prints one value per line — `CHECK: 3.0, 1.0` fails even when values are right

With `//TEST:COMPARE_COMPUTE(filecheck-buffer=CHECK):-cpu -output-using-type`, the buffer is written to `<test>.actual.txt` as `type: float` followed by ONE value per line (e.g. `3.000000\n1.000000`). A CHECK like `// CHECK: 3.0, 1.0` therefore never matches, and the test reports FAILED even when the values are correct. This nearly made me misreport an open PR as "failing" during #13611 triage. Use one `CHECK`/`CHECK-NEXT` per value, and always read `.actual.txt` before trusting a PASS/FAIL.

Related #13611 finding: existential `DifferentialPair` through dynamic dispatch. Typeflow models the pair as tuple(TaggedUnion, TaggedUnion) (analyzeMakeDifferentialPair). The dispatch param is UntaggedUnion(TypeSet(DiffPair<A>, DiffPair<B>)), because makeInfoForConcreteType has no DifferentialPair case. upcastSet's non-union→union branch then packs the tuple wholesale, so the tangent offset is wrong whenever the conformers' sizes differ. With equal sizes the bug hides, so test with unequal-size conformers. Regression from #9808 (45ccce9a3).

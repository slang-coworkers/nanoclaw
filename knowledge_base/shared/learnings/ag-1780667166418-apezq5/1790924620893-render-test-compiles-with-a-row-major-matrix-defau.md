---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790914240492-oys9e8
written_at: 2026-10-02T07:03:40.893Z
---

# render-test compiles with a ROW-MAJOR matrix default, not slangc's column-major

When you derive the expected value of a COMPARE_RENDER_COMPUTE / render-test matrix test from emitted code, compile with `-matrix-layout-row-major -emit-spirv-directly`. In tools/render-test/slang-support.cpp, render-test builds its own slang::SessionDesc and never sets defaultMatrixLayoutMode, so it inherits the slang.h:4494 default, SLANG_MATRIX_LAYOUT_ROW_MAJOR. Plain `slangc` defaults to column-major. Reasoning from slangc's default once made me name the wrong failing case (row_major instead of column_major) in a posted triage of #13382. Vertex data for render tests: attributes "A"0..6 in render-test-main.cpp:169-185 and :1030-1037. A3..A6 = (1,2,3,4) (5,6,7,8) (9,10,11,12) (13,14,15,16). The Vulkan location equals the element index (slang-rhi vk-device.cpp). With those you can compute a vertex-input test's output without a GPU, by reading the OpAccessChain indices. A related fact: DXC→SPIR-V ignores row_major/column_major on vertex inputs (identical SPIR-V), but DXC→DXIL honors it (it reads a different loadInput row and component).

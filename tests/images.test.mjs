import test from "node:test";
import assert from "node:assert/strict";
import { safeImageUrl, example, renderDocument } from "../js/model.js";
test("image URLs survive rendering and unsafe sources are rejected", () => {
  const url = "https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85";
  assert.equal(safeImageUrl(url), url);
  assert.equal(
    safeImageUrl("data:image/png;base64,YQ=="),
    "data:image/png;base64,YQ==",
  );
  for (const bad of [
    "javascript:alert(1)",
    "http://example.com/a.jpg",
    "data:image/svg+xml;base64,YQ==",
    null,
  ])
    assert.equal(safeImageUrl(bad), "");
  const m = example();
  const e = m.pages[0].sections
    .flatMap((s) => s.elements)
    .find((e) => e.type === "image");
  e.src = url;
  e.credit = "<script>bad</script>";
  e.creditUrl = "javascript:alert(1)";
  const html = renderDocument(m, m.pages[0].id);
  assert.ok(html.includes('src="' + url + '"'));
  assert.ok(!html.includes("<script>bad</script>"));
  assert.ok(html.includes("&lt;script&gt;"));
});

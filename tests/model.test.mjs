import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  example,
  validate,
  applyOperations,
  renderDocument,
  exportFiles,
  newSection,
  locate,
} from "../js/model.js";
test("precise changes preserve unrelated content and source", () => {
  const m = example(),
    n = applyOperations(m, [
      { type: "edit_text", target: "title", value: "A new heading" },
    ]);
  assert.equal(locate(n, "title").node.text, "A new heading");
  assert.deepEqual(n.pages[0].sections[1], m.pages[0].sections[1]);
  assert.notEqual(locate(m, "title").node.text, "A new heading");
});
test("invalid operations are atomic", () => {
  const m = example(),
    copy = structuredClone(m);
  assert.throws(() =>
    applyOperations(m, [
      { type: "edit_text", target: "title", value: "Changed" },
      { type: "delete_page", target: "home" },
    ]),
  );
  assert.deepEqual(m, copy);
});
test("page creation and deletion keep navigation consistent", () => {
  let m = example();
  m = applyOperations(m, [
    {
      type: "create_page",
      value: {
        id: "about",
        title: "About",
        slug: "about",
        sections: [newSection()],
      },
    },
  ]);
  assert.equal(m.navigation.length, 2);
  m = applyOperations(m, [{ type: "delete_page", target: "home" }]);
  assert.equal(m.navigation[0].pageId, "about");
  assert.equal(m.pages.length, 1);
});
test("scoped restoration keeps new website styling", () => {
  const old = example();
  let m = applyOperations(old, [
    { type: "change_colors", value: { accent: "#112233" } },
    { type: "edit_text", target: "title", value: "Different" },
  ]);
  m = applyOperations(m, [
    { type: "restore", target: "title", value: locate(old, "title").node },
  ]);
  assert.equal(m.theme.accent, "#112233");
  assert.deepEqual(locate(m, "title").node, locate(old, "title").node);
});
test("section and element movement keeps identities", () => {
  let m = applyOperations(example(), [
    { type: "move_section", target: "story", index: 0 },
  ]);
  assert.equal(m.pages[0].sections[0].id, "story");
  m = applyOperations(m, [
    { type: "move_element", target: "intro", sectionId: "story", index: 0 },
  ]);
  assert.equal(locate(m, "intro").section.id, "story");
});
test("content CRUD works independently of page data", () => {
  let m = applyOperations(example(), [
    {
      type: "create_content",
      value: {
        id: "oak",
        name: "Oak table",
        description: "Solid oak",
        price: "₹45,000",
      },
    },
  ]);
  m = applyOperations(m, [
    { type: "update_content", target: "oak", value: { price: "₹46,000" } },
  ]);
  assert.equal(m.content[0].price, "₹46,000");
  m = applyOperations(m, [{ type: "delete_content", target: "oak" }]);
  assert.equal(m.content.length, 0);
});
test("renderer escapes stored HTML and blocks executable URL schemes", () => {
  const m = example();
  locate(m, "title").node.text = "<img src=x onerror=alert(1)>";
  locate(m, "cta").node.href = "javascript:alert(1)";
  const html = renderDocument(m, "home");
  assert.ok(html.includes("&lt;img"));
  assert.ok(!html.includes('href="javascript:'));
  assert.ok(!html.includes("<img src=x"));
  assert.ok(!html.includes("data-clay-id="));
});
test("model rejects CSS injection, duplicate IDs and malformed navigation", () => {
  const m = example();
  m.theme.accent = "red;}body{display:none";
  assert.throws(() => validate(m));
  const n = example();
  n.navigation[0].pageId = "missing";
  assert.throws(() => validate(n));
  const p = example();
  p.pages[0].sections[0].elements[0].id = "home";
  assert.throws(() => validate(p));
});
test("export contains independently usable multipage PWA files", () => {
  const m = applyOperations(example(), [
    {
      type: "create_page",
      value: {
        id: "about",
        title: "About",
        slug: "about",
        sections: [newSection()],
      },
    },
  ]);
  const files = exportFiles(m);
  assert.ok(files["index.html"]);
  assert.ok(files["about.html"]);
  assert.ok(files["sw.js"]);
  assert.ok(files["manifest.webmanifest"]);
  assert.ok(files["index.html"].includes("./about.html"));
  assert.ok(!files["index.html"].includes("js/app.js"));
  assert.equal(JSON.parse(files["manifest.webmanifest"]).display, "standalone");
});
test("backend and browser share the exact same validator and exporter", async () => {
  assert.equal(
    await readFile(new URL("../js/model.js", import.meta.url), "utf8"),
    await readFile(
      new URL("../supabase/functions/clay/model.js", import.meta.url),
      "utf8",
    ),
  );
});
test("database has owner isolation and one-site uniqueness", async () => {
  const sql = await readFile(
    new URL("../supabase/migrations/202609250001_clay.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /user_id uuid not null unique/);
  for (const t of [
    "websites",
    "versions",
    "submissions",
    "visits",
    "publications",
    "rate_limits",
  ])
    assert.ok(
      sql.includes(`alter table public.${t} enable row level security`),
    );
  assert.ok(sql.includes("current_site.revision<>p_revision"));
  assert.ok(sql.includes("from public,anon,authenticated"));
});

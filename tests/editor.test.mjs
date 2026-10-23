import test from "node:test";
import assert from "node:assert/strict";
import {
  example,
  applyOperations,
  locate,
  renderDocument,
  validate,
} from "../js/model.js";
import { planEdit } from "../supabase/functions/clay/edit.js";
function menu() {
  const m = example();
  m.content = [
    { id: "soup", name: "Soup", description: "Seasonal", price: "₹100" },
    { id: "bread", name: "Bread", description: "Fresh", price: "₹80" },
  ];
  m.pages[0].sections[1].type = "products";
  return m;
}
test("menu items have identities, photos, local styles and scoped restoration", () => {
  const m = menu();
  const n = applyOperations(m, [
    {
      type: "update_content",
      target: "soup",
      value: { src: "https://example.com/soup.jpg", alt: "Soup" },
    },
    {
      type: "update_style",
      target: "soup",
      value: { color: "#112233", padding: 16 },
    },
    { type: "move_content", target: "soup", index: 1 },
    { type: "update_section", target: "story", value: { layout: "list" } },
  ]);
  assert.equal(n.content[1].id, "soup");
  assert.equal(locate(n, "soup").content.name, "Soup");
  assert.equal(n.theme.text, m.theme.text);
  const html = renderDocument(n, "home", { editing: true });
  assert.match(html, /data-clay-id="soup"/);
  assert.match(html, /soup.jpg/);
  assert.match(html, /color:#112233;padding:16px/);
  const restored = applyOperations(n, [
    { type: "restore", target: "soup", value: m.content[0] },
  ]);
  assert.equal(restored.content[1].src, undefined);
  assert.equal(restored.pages[0].sections[1].layout, "list");
  assert.doesNotMatch(renderDocument(n, "home"), /clay-toolbar|data-clay-id=/);
});
test("style injection and invalid photo types cannot be saved", () => {
  for (const style of [
    { position: "absolute" },
    { color: "red;display:none" },
    { padding: -2 },
    { fontSize: 400 },
  ])
    assert.throws(() =>
      applyOperations(example(), [
        { type: "update_style", target: "title", value: style },
      ]),
    );
  const m = menu();
  m.content[0].src = { url: "x" };
  assert.throws(() => validate(m));
});
test("AI corrects invalid operations before resolving photos or saving", async () => {
  const m = menu();
  let calls = 0,
    photos = 0;
  const r = await planEdit({
    model: m,
    prompt: "Make rows",
    ai: async () =>
      ++calls === 1
        ? {
            operations: [
              {
                type: "update_section",
                target: "story",
                value: { layout: "rows" },
              },
            ],
          }
        : {
            summary: "Menu rows",
            operations: [
              {
                type: "update_section",
                target: "story",
                value: { layout: "list" },
              },
            ],
          },
    images: async () => photos++,
  });
  assert.equal(calls, 2);
  assert.equal(photos, 1);
  assert.equal(
    applyOperations(m, r.operations).pages[0].sections[1].layout,
    "list",
  );
});
test("photo search failure preserves an existing photo and still applies layout", async () => {
  const m = menu();
  m.content[0].src = "https://example.com/working.jpg";
  const r = await planEdit({
    model: m,
    prompt: "New photo and rows",
    ai: async () => ({
      summary: "Rows",
      operations: [
        {
          type: "update_content",
          target: "soup",
          value: { imageQuery: "soup" },
        },
        { type: "update_section", target: "story", value: { layout: "list" } },
      ],
    }),
    images: async (ops) => {
      ops[0].value.src = "";
    },
  });
  const n = applyOperations(m, r.operations);
  assert.equal(n.content[0].src, m.content[0].src);
  assert.equal(n.pages[0].sections[1].layout, "list");
});

test("combined legacy menu cards can be interleaved without duplication or changing their content", () => {
  const m = menu();
  m.pages[0].sections[1].elements.push({
    id: "legacy-item",
    type: "item",
    text: "Salad",
    description: "Greens",
    price: "₹90",
  });
  const n = applyOperations(m, [
    {
      type: "reorder_items",
      target: "story",
      value: ["soup", "legacy-item", "bread"],
    },
  ]);
  assert.deepEqual(n.content, m.content);
  const html = renderDocument(n, "home", { editing: true });
  assert.ok(
    html.indexOf('data-clay-id="soup"') <
      html.indexOf('data-clay-id="legacy-item"'),
  );
  assert.equal(html.split('data-clay-id="legacy-item"').length - 1, 1);
  assert.throws(() =>
    applyOperations(m, [
      {
        type: "reorder_items",
        target: "story",
        value: ["legacy-item", "bread"],
      },
    ]),
  );
});

test("quoted wording is checked before a precise text edit is returned", async () => {
  let calls = 0;
  const m = example();
  const r = await planEdit({
    model: m,
    selected: "title",
    prompt: 'Change this heading to exactly: "Fresh cooking."',
    ai: async () => ({
      summary: "Heading",
      operations: [
        {
          type: "edit_text",
          target: "title",
          value: ++calls === 1 ? "Fresh cooking" : "Fresh cooking.",
        },
      ],
    }),
    images: async () => {},
  });
  assert.equal(calls, 2);
  assert.equal(
    applyOperations(m, r.operations).pages[0].sections[0].elements[0].text,
    "Fresh cooking.",
  );
});

import test from "node:test";
import assert from "node:assert/strict";
import { example, applyOperations, locate } from "../js/model.js";
import { literalOperations } from "../supabase/functions/clay/intent.js";
import { planEdit } from "../supabase/functions/clay/edit.js";
function fixture() {
  const m = example();
  m.pages[0].sections[0].elements.find((e) => e.id === "cta").text =
    "View Menu";
  m.pages.push({ id: "menu-page", title: "Menu", slug: "menu", sections: [] });
  m.navigation.push({ pageId: "menu-page", label: "Menu" });
  return m;
}
test("literal user settings complete an otherwise valid but incomplete AI edit", async () => {
  const m = fixture(),
    prompt =
      "Make the View Menu button link to the Menu page. Put the hero image on the left and shorten the hero image to 360 pixels.";
  const r = await planEdit({
    model: m,
    prompt,
    pageId: "home",
    selected: "hero",
    ai: async () => ({
      summary: "Updated the hero",
      operations: [
        { type: "update_section", target: "hero", value: { layout: "split" } },
      ],
    }),
    images: async () => {},
  });
  const n = applyOperations(m, r.operations);
  assert.equal(locate(n, "cta").node.href, "./menu.html");
  assert.equal(locate(n, "hero").node.imageHeight, 360);
  assert.equal(locate(n, "hero").node.mediaPosition, "left");
  assert.equal(locate(n, "title").node.text, locate(m, "title").node.text);
});
test("exact font pairs, visual settings and brand text are grounded in the request", () => {
  const m = fixture();
  const ops = literalOperations({
    model: m,
    prompt:
      'Use Fraunces for all headings and DM Sans for body copy. Add subtle hover animations, softly rounded corners and pill-shaped buttons. Set our wordmark to Harbor Kitchen and our tagline to exactly "A pause, well spent." Show our initials mark.',
  });
  const n = applyOperations(m, ops);
  assert.equal(n.theme.headingFont, "Fraunces");
  assert.equal(n.theme.bodyFont, "DM Sans");
  assert.equal(n.theme.buttonStyle, "pill");
  assert.equal(n.theme.motion, "subtle");
  assert.equal(n.brand.wordmark, "Harbor Kitchen");
  assert.equal(n.brand.tagline, "A pause, well spent.");
  assert.equal(n.brand.showMark, true);
});
test("ambiguous named buttons are not guessed", () => {
  const m = fixture();
  m.pages[0].sections[1].elements.push({
    id: "another-menu-link",
    type: "button",
    text: "View Menu",
    href: "#",
  });
  assert.deepEqual(
    literalOperations({
      model: m,
      prompt: "Make View Menu button link to the Menu page.",
    }),
    [],
  );
});

test("negative font instructions do not become literal changes", () => {
  assert.deepEqual(
    literalOperations({
      model: fixture(),
      prompt: "Do not use Fraunces for headings.",
    }),
    [],
  );
});

test("negative brand and button-shape instructions are not applied as positive literal requests", () => {
  for (const prompt of [
    "Do not show our initials mark.",
    "Do not use pill-shaped buttons.",
    "Do not make the View Menu button link to the Menu page.",
  ])
    assert.deepEqual(literalOperations({ model: fixture(), prompt }), []);
});

test("current image position is not mistaken for a new instruction", () => {
  assert.deepEqual(
    literalOperations({
      model: fixture(),
      prompt: "Do not put the hero image on the left.",
    }),
    [],
  );
  assert.deepEqual(
    literalOperations({
      model: fixture(),
      prompt: "The hero image is on the left; suggest another composition.",
    }),
    [],
  );
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  example,
  applyOperations,
  locate,
  renderDocument,
  exportFiles,
  validate,
} from "../js/model.js";
import { compilePlan } from "../supabase/functions/clay/generation.js";
import { planEdit } from "../supabase/functions/clay/edit.js";
import { fontLink } from "../js/design.js";
function contactModel() {
  const m = example();
  m.pages.push({
    id: "contact-page",
    title: "Contact",
    slug: "contact",
    sections: [
      {
        id: "contact-section",
        type: "contact",
        layout: "center",
        elements: [
          { id: "contact-heading", type: "heading", text: "Get in touch" },
          {
            id: "contact-copy",
            type: "text",
            text: "Tell us what you have in mind.",
          },
        ],
      },
    ],
  });
  m.navigation.push({ pageId: "contact-page", label: "Contact" });
  return m;
}
test("the screenshot form request resolves without AI, preserves work and remains editable repeatedly", async () => {
  const m = contactModel();
  let next = applyOperations(m, [
    { type: "edit_text", target: "title", value: "New hero title" },
  ]);
  for (const prompt of [
    "the form is left aligned while the title is center-aligned. make the the whole thing center aligned",
    "there is a form on the contact page which is currently left-aligned, can you make it center-aligned",
    "Center the contact form again",
  ]) {
    const result = await planEdit({
      model: next,
      prompt,
      pageId: "contact-page",
      ai: async () => {
        throw Error("Unnecessary AI request");
      },
    });
    next = applyOperations(next, result.operations);
    assert.equal(locate(next, "contact-section:form").node.align, "center");
    assert.equal(locate(next, "title").node.text, "New hero title");
  }
  next = applyOperations(next, [
    {
      type: "update_form",
      target: "contact-section:form",
      value: { align: "right", width: 480, buttonText: "Start a conversation" },
    },
  ]);
  const restored = applyOperations(next, [
    {
      type: "restore",
      target: "contact-section:form",
      value: { align: "center", textAlign: "left", width: 560 },
    },
  ]);
  assert.equal(locate(restored, "contact-section:form").node.width, 560);
  assert.equal(locate(restored, "title").node.text, "New hero title");
});
test("forms have stable identities and standalone submit handlers for every form", () => {
  const m = contactModel();
  const html = renderDocument(m, "contact-page", { editing: true });
  assert.match(html, /data-clay-id="contact-section:form"/);
  assert.match(html, /contact-form form-center/);
  const exported = exportFiles(m)["contact.html"];
  assert.match(exported, /querySelectorAll\('\[data-contact-form\]'\)/);
  assert.doesNotMatch(exported, /data-clay-id=/);
  assert.doesNotMatch(exported, /form id="contact"/);
});
test("paired fonts, brand, image composition and motion persist through independent edits and exports", () => {
  const m = contactModel();
  const n = applyOperations(m, [
    {
      type: "update_design",
      value: {
        headingFont: "Fraunces",
        bodyFont: "DM Sans",
        surface: "#faf6ed",
        motion: "subtle",
        radius: "round",
        buttonStyle: "pill",
        headingScale: "display",
      },
    },
    {
      type: "update_brand",
      value: {
        wordmark: "Morrow Coffee",
        tagline: "A little room to slow down.",
        showMark: true,
      },
    },
    {
      type: "update_section",
      target: "hero",
      value: { layout: "split", mediaPosition: "left", imageHeight: 360 },
    },
    {
      type: "update_form",
      target: "contact-section",
      value: { align: "center", textAlign: "center" },
    },
  ]);
  assert.match(fontLink(n), /family=Fraunces/);
  assert.match(fontLink(n), /family=DM\+Sans/);
  const html = exportFiles(n)["index.html"];
  assert.match(html, /media-left/);
  assert.match(html, /--image-height:360px/);
  assert.match(html, /A little room to slow down/);
  assert.match(html, /brand-mark/);
  assert.match(html, /translateY\(-5px\)/);
  assert.match(html, /prefers-reduced-motion/);
  assert.match(html, /IntersectionObserver/);
  const updated = applyOperations(n, [
    { type: "edit_text", target: "intro", value: "A quieter start." },
  ]);
  assert.deepEqual(updated.theme, n.theme);
  assert.deepEqual(updated.brand, n.brand);
  assert.equal(updated.pages[0].sections[0].imageHeight, 360);
});
test("invalid design values and invented form properties never reach CSS", () => {
  const m = contactModel();
  for (const op of [
    { type: "update_design", value: { headingFont: "x';}body{display:none}" } },
    { type: "update_design", value: { motion: "javascript" } },
    {
      type: "update_form",
      target: "contact-section",
      value: { width: "100%;display:none" },
    },
    {
      type: "update_form",
      target: "contact-section",
      value: { onclick: "evil" },
    },
    { type: "update_section", target: "hero", value: { imageHeight: 100000 } },
    {
      type: "update_section",
      target: "hero",
      value: { unsupportedAlign: "center" },
    },
  ])
    assert.throws(() => applyOperations(m, [op]));
  assert.deepEqual(m, contactModel());
});
test("new generation plans compile art direction and real contact form settings", () => {
  const m = compilePlan({
    name: "Morrow Coffee",
    brand: { wordmark: "Morrow", tagline: "Take your time.", showMark: true },
    theme: {
      headingFont: "Fraunces",
      bodyFont: "DM Sans",
      font: "Fraunces",
      motion: "subtle",
      radius: "round",
      buttonStyle: "pill",
    },
    pages: [
      {
        title: "Home",
        sections: [
          {
            type: "hero",
            layout: "cover",
            eyebrow: "A slower morning",
            heading: "Good coffee. Better company.",
            imageQuery: "coffee shop",
          },
          {
            type: "contact",
            layout: "center",
            heading: "Say hello",
            form: { align: "center", width: 600, buttonText: "Send a note" },
          },
        ],
      },
    ],
  });
  validate(m);
  assert.equal(m.brand.wordmark, "Morrow");
  assert.equal(m.pages[0].sections[0].elements[0].type, "eyebrow");
  assert.equal(m.pages[0].sections[1].form.width, 600);
  assert.match(renderDocument(m, m.pages[0].id), /section hero cover/);
});
test("browser and backend share the same design capabilities", async () => {
  assert.equal(
    await readFile("js/design.js", "utf8"),
    await readFile("supabase/functions/clay/design.js", "utf8"),
  );
});

test("standalone and preview scripts remain valid when motion is enabled", () => {
  const m = contactModel();
  m.theme.motion = "subtle";
  for (const options of [
    {},
    { editing: true, preview: true },
    { editing: true },
  ]) {
    const html = renderDocument(m, "contact-page", options);
    for (const script of html.matchAll(/<script>([\s\S]*?)<\/script>/g))
      assert.doesNotThrow(() => new Function(script[1]));
  }
});

test("art direction survives nested AI metadata and supplies a missing hero photo and useful CTA", async () => {
  const { withArtDirection } = await import(
    "../supabase/functions/clay/generation.js"
  );
  const d = {
    brand: {
      wordmark: "Morrow",
      tagline: "A slower morning.",
      theme: { headingFont: "Fraunces", bodyFont: "Manrope" },
    },
    heroLayout: "split",
    heroImageQuery: "coffee shop interior",
    mediaPosition: "left",
  };
  const p = {
    name: "Morrow",
    pages: [
      {
        title: "Home",
        sections: [
          { type: "hero", heading: "Take your time." },
          { type: "contact", heading: "Say hello" },
        ],
      },
    ],
  };
  const m = compilePlan(withArtDirection(p, d));
  assert.equal(m.theme.headingFont, "Fraunces");
  assert.equal(m.pages[0].sections[0].mediaPosition, "left");
  assert.ok(
    m.pages[0].sections[0].elements.some(
      (e) => e.type === "image" && e.imageQuery,
    ),
  );
  assert.ok(m.pages[0].sections[0].elements.some((e) => e.type === "button"));
  assert.ok(
    m.navigation.some((n) => n.sectionId === m.pages[0].sections[1].id),
  );
  const noPhotos = compilePlan(
    withArtDirection(p, d, {
      description: "No photos. Use a text-only website.",
    }),
  );
  assert.ok(
    !noPhotos.pages
      .flatMap((p) => p.sections.flatMap((s) => s.elements))
      .some((e) => e.type === "image"),
  );
});

test("unambiguous AI section names and dimensions compile without weakening validation", () => {
  const m = compilePlan({
    name: "Morrow",
    theme: {
      background: "#fff",
      text: "#222",
      accent: "#345",
      font: "fraunces",
      headingFont: "Fraunces",
      bodyFont: "DM Sans",
    },
    pages: [
      {
        title: "Home",
        sections: [
          {
            type: "hero",
            layout: "split-left",
            heading: "A slow morning",
            imageHeight: "360px",
            imageQuery: "coffee",
          },
          {
            type: "about",
            layout: "two-column",
            heading: "Our approach",
            text: "Coffee, thoughtfully prepared.",
          },
          { type: "menu", heading: "Our menu" },
          {
            type: "contact",
            heading: "Say hello",
            form: { align: "centered", width: "600px" },
          },
        ],
      },
    ],
  });
  assert.equal(m.theme.background, "#ffffff");
  assert.equal(m.theme.font, "Fraunces");
  assert.equal(m.pages[0].sections[1].type, "text");
  assert.equal(m.pages[0].sections[2].type, "products");
  assert.equal(m.pages[0].sections[0].imageHeight, 360);
  assert.equal(m.pages[0].sections[3].form.width, 600);
});

test("uploaded image bytes do not enter AI context or get erased by an unrelated edit", async () => {
  const m = example();
  locate(m, "photo").node.src = "data:image/png;base64,YQ==";
  let input;
  const r = await planEdit({
    model: m,
    prompt: "Change this heading",
    selected: "title",
    ai: async (_system, body) => {
      input = body;
      return {
        summary: "Heading",
        operations: [
          { type: "edit_text", target: "title", value: "A considered home." },
        ],
      };
    },
    images: async () => {},
  });
  assert.equal(locate(input.website, "photo").node.src, "");
  assert.equal(locate(input.website, "photo").node.hasUploadedImage, true);
  assert.equal(
    locate(applyOperations(m, r.operations), "photo").node.src,
    m.pages[0].sections[0].elements.find((e) => e.id === "photo").src,
  );
});

test("optional AI styling cannot cancel an otherwise complete website", async () => {
  const { normalizeTheme } = await import(
    "../supabase/functions/clay/generation.js"
  );
  assert.equal(normalizeTheme({ contentWidth: "1200px" }).contentWidth, 1200);
  assert.equal(
    normalizeTheme({ contentWidth: "full-width" }).contentWidth,
    undefined,
  );
  const m = compilePlan({
    name: "Morrow",
    theme: {
      contentWidth: "880to1600",
      headingFont: "Fraunces",
      bodyFont: "Manrope",
    },
    pages: [
      {
        title: "Home",
        sections: [
          { type: "hero", heading: "A good morning" },
          { type: "contact", heading: "Say hello" },
        ],
      },
    ],
  });
  assert.equal(m.theme.contentWidth, 1200);
  assert.equal(m.theme.headingFont, "Fraunces");
});

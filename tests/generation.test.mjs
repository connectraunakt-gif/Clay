import test from "node:test";
import assert from "node:assert/strict";
import { compilePlan } from "../supabase/functions/clay/generation.js";
import { createAiClient, requestBody } from "../supabase/functions/clay/ai.js";
import { resolveImages } from "../supabase/functions/clay/media.js";
import { validate, renderDocument } from "../js/model.js";
const plan = () => ({
  name: "Brew & Bloom",
  theme: {
    background: "#faf7ef",
    text: "#202a32",
    accent: "#344e68",
    font: "Inter",
    spacing: "comfortable",
  },
  pages: [
    {
      title: "Home",
      slug: "home",
      sections: [
        {
          type: "hero",
          layout: "split",
          heading: "Coffee, at your pace.",
          button: { text: "Get in touch", href: "#contact" },
          imageQuery: "coffee cup",
        },
        { type: "contact", heading: "Visit us" },
      ],
    },
    {
      title: "About",
      slug: "home",
      sections: [
        {
          type: "text",
          heading: "Our story",
          text: "Handcrafted coffee and fresh pastries.",
        },
      ],
    },
  ],
  content: [{ name: "Coffee", price: "", description: "Freshly brewed" }],
});
test("compact plan compiles unique identities, navigation and real section links", () => {
  const m = compilePlan(plan());
  validate(m);
  const ids = m.pages
    .flatMap((p) => [
      p.id,
      ...p.sections.flatMap((s) => [s.id, ...s.elements.map((e) => e.id)]),
    ])
    .concat(m.content.map((c) => c.id));
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(m.pages[0].slug, "index");
  assert.notEqual(m.pages[1].slug, "index");
  assert.equal(
    m.pages[0].sections[0].elements.find((e) => e.type === "button").href,
    "#" + m.pages[0].sections[1].id,
  );
  assert.ok(m.navigation.every((n) => m.pages.some((p) => p.id === n.pageId)));
});
test("generation rejects unsupported structures instead of saving invalid websites", () => {
  const p = plan();
  p.pages[0].sections[0].layout = "executable";
  assert.throws(() => compilePlan(p));
  assert.throws(() => compilePlan({ pages: [] }));
});
test("model settings use the right reasoning control and respect output limits", () => {
  const body = requestBody("openai/gpt-oss-20b", "system", {}, 9000);
  assert.equal(body.reasoning_effort, "low");
  assert.equal(body.max_tokens, 4096);
  assert.equal(body.chat_template_kwargs, undefined);
  const n = requestBody(
    "nvidia/nemotron-3.5-lightning-30b-a3b",
    "system",
    {},
    800,
  );
  assert.equal(n.chat_template_kwargs.enable_thinking, false);
  assert.equal(n.reasoning_effort, undefined);
});
test("streamed structured output survives chunk boundaries and a transient failure", async () => {
  let calls = 0;
  const payload =
    "data: " +
    JSON.stringify({
      choices: [{ delta: { reasoning_content: "not user output" } }],
    }) +
    "\n\ndata: " +
    JSON.stringify({
      choices: [
        { delta: { content: '{"questions":[]}' }, finish_reason: "stop" },
      ],
    }) +
    "\n\ndata: [DONE]\n\n";
  const fetcher = async () => {
    if (++calls === 1) throw TypeError("Disconnected");
    return new Response(
      new ReadableStream({
        start(c) {
          const bytes = new TextEncoder().encode(payload);
          c.enqueue(bytes.slice(0, 47));
          c.enqueue(bytes.slice(47));
          c.close();
        },
      }),
      { headers: { "Content-Type": "text/event-stream" } },
    );
  };
  const ai = createAiClient({
    apiKey: "test",
    model: "test",
    fallbackModel: "test",
    fetcher,
  });
  assert.deepEqual(await ai("s", {}), { questions: [] });
  assert.equal(calls, 2);
});
test("truncated AI output is retried and never treated as a usable website", async () => {
  let calls = 0;
  const fetcher = async () => {
    calls++;
    return Response.json({
      choices: [{ message: { content: '{"plan":' }, finish_reason: "length" }],
    });
  };
  const ai = createAiClient({
    apiKey: "test",
    model: "test",
    fallbackModel: "test",
    fetcher,
  });
  await assert.rejects(
    () => ai("s", {}),
    (e) => e.code === "output_limit",
  );
  assert.equal(calls, 2);
});
test("photo outages cannot cancel a completed design", async () => {
  const model = compilePlan(plan()),
    warnings = [];
  model.pages[0].sections[0].elements.find(
    (e) => e.type === "image",
  ).imageQuery = "unusual bespoke object";
  await resolveImages(
    model,
    async () => {
      throw TypeError("Unavailable");
    },
    { strict: false, warnings },
  );
  validate(model);
  assert.equal(warnings.length, 1);
  const html = renderDocument(model, model.pages[0].id);
  assert.ok(html.includes("photo-placeholder"));
  assert.ok(!html.includes('src=""'));
});
test("relevant stock photo is used when the photo search service is down", async () => {
  const model = compilePlan(plan());
  await resolveImages(
    model,
    async () => {
      throw TypeError("Unavailable");
    },
    { strict: false },
  );
  const photo = model.pages[0].sections[0].elements.find(
    (e) => e.type === "image",
  );
  assert.ok(photo.src.startsWith("https://images.unsplash.com/"));
  assert.equal(photo.credit, "Photo: Unsplash");
});
import {
  requirementsFromBrief,
  checkRequirements,
} from "../supabase/functions/clay/generation.js";
test("explicit section counts and exclusions apply across the whole website", () => {
  const requirements = requirementsFromBrief({
    description: "Exactly four sections. No testimonials.",
    answers: [],
  });
  assert.equal(requirements.sections, 4);
  assert.equal(requirements.noTestimonials, true);
  const m = compilePlan(plan());
  assert.throws(() => checkRequirements(m, requirements), /exactly 4 sections/);
  assert.doesNotThrow(() =>
    checkRequirements(m, { sections: 3, pages: 2, noTestimonials: true }),
  );
});
test("pending provider requests are polled instead of parsing an empty answer", async () => {
  let calls = 0;
  const ai = createAiClient({
    apiKey: "test",
    model: "test",
    fallbackModel: "test",
    fetcher: async (url) => {
      if (++calls === 1)
        return new Response("{}", {
          status: 202,
          headers: { "nvcf-reqid": "request-123" },
        });
      assert.equal(
        url,
        "https://api.nvcf.nvidia.com/v2/nvcf/pexec/status/request-123",
      );
      return Response.json({
        choices: [
          { message: { content: '{"questions":[]}' }, finish_reason: "stop" },
        ],
      });
    },
  });
  assert.deepEqual(await ai("s", {}), { questions: [] });
  assert.equal(calls, 2);
});
import { normalizeOperations } from "../supabase/functions/clay/actions.js";
test("AI actions accept unambiguous nested operations without weakening validation", () => {
  const ops = normalizeOperations([
    { edit_text: { target: "heading-1", value: "Short heading" } },
  ]);
  assert.deepEqual(ops, [
    { type: "edit_text", target: "heading-1", value: "Short heading" },
  ]);
  assert.deepEqual(normalizeOperations(ops), ops);
  assert.throws(() => normalizeOperations([{ run_code: { value: "bad" } }]));
  assert.throws(() =>
    normalizeOperations([{ edit_text: {}, delete_page: {} }]),
  );
});
test("new AI-created elements receive internal identities before validation", () => {
  const model = compilePlan(plan()),
    section = model.pages[0].sections[0];
  const ops = normalizeOperations([
    {
      type: "create_element",
      target: section.id,
      value: {
        type: "image",
        src: "https://example.com/photo.jpg",
        alt: "A real photo",
      },
    },
  ]);
  assert.ok(ops[0].value.id);
  assert.doesNotThrow(() => {
    const next = structuredClone(model);
    next.pages[0].sections[0].elements.push(ops[0].value);
    validate(next);
  });
});

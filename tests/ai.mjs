import { loadEnvFile } from "node:process";
import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { validate, applyOperations, locate } from "../js/model.js";
loadEnvFile(".env");
const ref = "auzhsqhcajzarhtvxrke",
  url = "https://" + ref + ".supabase.co",
  pub = process.env.CLAY_PUBLIC_KEY;
const keys = await (
  await fetch("https://api.supabase.com/v1/projects/" + ref + "/api-keys", {
    headers: { Authorization: "Bearer " + process.env.SUPABASE_ACCESS_TOKEN },
  })
).json();
const service = keys.find((k) => k.name === "service_role").api_key;
async function call(
  path,
  body,
  token = service,
  key = service,
  method = "POST",
) {
  const r = await fetch(url + path, {
    method,
    headers: {
      apikey: key,
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
      Origin: "http://localhost:4173",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(140000),
  });
  const text = await r.text();
  return { status: r.status, data: text ? JSON.parse(text) : null };
}
let user;
try {
  const email = "clay-ai-" + crypto.randomUUID() + "@example.invalid",
    password = crypto.randomUUID() + "Aa9!";
  user = (
    await call("/auth/v1/admin/users", { email, password, email_confirm: true })
  ).data;
  const auth = await call(
    "/auth/v1/token?grant_type=password",
    { email, password },
    pub,
    pub,
  );
  const token = auth.data.access_token;
  const description =
    "I run Mirage, a custom wooden furniture studio in Delhi. We make furniture for homes and offices. I want a warm, refined website with exactly four sections: hero, our story, products, and contact. No testimonials, no invented reviews. Visitors should contact us about visiting our showroom. We have not supplied an address or phone number, so do not invent them.";
  const questions = await call(
    "/functions/v1/clay",
    { type: "questions", description },
    token,
    pub,
  );
  console.log("Questions response", questions.status);
  assert.equal(questions.status, 200, JSON.stringify(questions.data));
  assert.ok(Array.isArray(questions.data.questions));
  console.log(
    "Personalized questions",
    questions.data.questions.map((q) => q.question),
  );
  const answers = questions.data.questions.map((q) => ({
    question: q.question,
    answer:
      "Use warm earthy colours, natural wood imagery, and a simple elegant layout. Our contact email is hello@example.com. Our item is Oak Dining Table, priced at ₹45,000. Keep exactly four sections and no testimonials.",
  }));
  const started = await call(
    "/functions/v1/clay",
    { type: "generation_start", description, answers },
    token,
    pub,
  );
  assert.equal(started.status, 200, JSON.stringify(started.data));
  let result;
  for (let i = 0; i < 80; i++) {
    result = await call(
      "/functions/v1/clay",
      { type: "generation_status" },
      token,
      pub,
    );
    if (result.data.site || result.data.job?.status === "failed") break;
    await new Promise((r) => setTimeout(r, 2500));
  }
  const generated = {
    status: result.data.site ? 200 : 500,
    data: { model: result.data.site?.model, message: result.data.job?.message },
  };
  console.log("Generation response", generated.status);
  assert.equal(generated.status, 200, JSON.stringify(generated.data));
  validate(generated.data.model);
  assert.equal(generated.data.model.pages.flatMap((p) => p.sections).length, 4);
  assert.ok(
    !generated.data.model.pages
      .flatMap((p) => p.sections)
      .some((s) => s.type === "testimonials"),
  );
  console.log("PASS real personalized generation and user exclusions");
  await writeFile(
    ".playwright/ai-generated.json",
    JSON.stringify(generated.data.model, null, 2),
  );
  const site = result.data.site;
  const target = site.model.pages[0].sections[0].elements.find(
    (e) => e.type === "heading",
  );
  const edit = await call(
    "/functions/v1/clay",
    {
      type: "edit",
      siteId: site.id,
      pageId: site.model.pages[0].id,
      selected: target.id,
      prompt: "Make this heading more concise. Change only this heading.",
    },
    token,
    pub,
  );
  console.log("Edit response", edit.status);
  assert.equal(edit.status, 200, JSON.stringify(edit.data));
  assert.ok(
    edit.data.operations.every(
      (o) => o.type === "edit_text" && o.target === target.id,
    ),
  );
  const revised = applyOperations(site.model, edit.data.operations);
  assert.notEqual(locate(revised, target.id).node.text, target.text);
  console.log("PASS real selection-aware AI edit");
  const photo = await call(
    "/functions/v1/clay",
    {
      type: "edit",
      siteId: site.id,
      pageId: site.model.pages[0].id,
      selected: site.model.pages[0].sections[0].id,
      prompt:
        "Add a photo of wooden furniture to this hero section. Keep all existing text.",
    },
    token,
    pub,
  );
  assert.equal(photo.status, 200, JSON.stringify(photo.data));
  const withPhoto = applyOperations(site.model, photo.data.operations);
  const images = withPhoto.pages
    .flatMap((p) => p.sections)
    .flatMap((s) => s.elements)
    .filter((e) => e.type === "image");
  assert.ok(
    images.some(
      (e) =>
        /^https:\/\/(upload|thumb)\.wikimedia\.org\//.test(e.src || "") &&
        e.credit,
    ),
  );
  console.log("PASS real AI image lookup and editing");
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  if (user?.id)
    await call(
      "/auth/v1/admin/users/" + user.id,
      null,
      service,
      service,
      "DELETE",
    );
  console.log("Removed temporary AI test account.");
}

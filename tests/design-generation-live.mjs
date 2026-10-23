import { loadEnvFile } from "node:process";
import assert from "node:assert/strict";
import { validate, exportFiles } from "../js/model.js";
loadEnvFile(".env");
const base = "https://auzhsqhcajzarhtvxrke.supabase.co",
  pub = process.env.CLAY_PUBLIC_KEY;
const k = await (
  await fetch(
    "https://api.supabase.com/v1/projects/auzhsqhcajzarhtvxrke/api-keys",
    {
      headers: { Authorization: "Bearer " + process.env.SUPABASE_ACCESS_TOKEN },
    },
  )
).json();
const key = k.find((x) => x.name === "service_role").api_key;
async function call(path, body, token = key, apiKey = key, method = "POST") {
  const r = await fetch(base + path, {
    method,
    headers: {
      apikey: apiKey,
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
      Origin: "http://localhost:4173",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(125000),
  });
  const text = await r.text();
  return { status: r.status, data: text ? JSON.parse(text) : null };
}
const cases = [
  [
    "coffee",
    "Morrow Coffee is an invented neighbourhood cafe serving specialty coffee and seasonal pastries. Its positioning is a slower, warmer morning.",
  ],
  [
    "atelier",
    "Fieldwork Atelier is an invented independent furniture studio. It makes small-batch wooden pieces with careful joinery and an architectural sensibility.",
  ],
];
for (const [name, description] of cases) {
  let user;
  const start = Date.now();
  try {
    const email = "clay-generation-" + crypto.randomUUID() + "@example.invalid",
      password = crypto.randomUUID() + "Aa9!";
    user = (
      await call("/auth/v1/admin/users", {
        email,
        password,
        email_confirm: true,
      })
    ).data;
    const auth = await call(
      "/auth/v1/token?grant_type=password",
      { email, password },
      pub,
      pub,
    );
    const token = auth.data.access_token;
    const questions = await call(
      "/functions/v1/clay",
      { type: "questions", description },
      token,
      pub,
    );
    assert.equal(questions.status, 200, JSON.stringify(questions.data));
    assert.ok(Array.isArray(questions.data.questions));
    const answers = questions.data.questions.map((q) => ({
      question: q.question,
      answer:
        "Use a warm cream and sage green palette. Make exactly four sections in total: hero, our story, products or menu, contact. No testimonials. Email hello@example.com. No addresses, hours, reviews or prices have been supplied; do not invent them.",
    }));
    const started = await call(
      "/functions/v1/clay",
      { type: "generation_start", description, answers },
      token,
      pub,
    );
    assert.equal(started.status, 200, JSON.stringify(started.data));
    const jobId = started.data.job.id;
    let result;
    for (let i = 0; i < 85; i++) {
      result = await call(
        "/functions/v1/clay",
        { type: "generation_status", jobId },
        token,
        pub,
      );
      assert.equal(result.status, 200);
      if (result.data.site || result.data.job?.status === "failed") break;
      await new Promise((r) => setTimeout(r, 1500));
    }
    if (!result.data.site) {
      const diagnostic = await call(
        "/rest/v1/generation_jobs?id=eq." + jobId + "&select=error_code",
        null,
        key,
        key,
        "GET",
      );
      console.log("GENERATION DIAGNOSTIC", diagnostic.data);
    }
    assert.ok(result.data.site, JSON.stringify(result.data));
    const site = result.data.site;
    validate(site.model);
    assert.ok(site.model.brand?.wordmark);
    assert.ok(site.model.theme.headingFont);
    assert.ok(site.model.theme.bodyFont);
    assert.ok(site.model.theme.motion);
    const sections = site.model.pages.flatMap((p) => p.sections);
    assert.equal(sections.length, 4);
    assert.ok(!sections.some((s) => s.type === "testimonials"));
    const images = sections
      .flatMap((s) => s.elements)
      .filter((e) => e.type === "image");
    assert.ok(
      images.some((e) => e.src?.startsWith("https://")),
      "Website needs a real photo",
    );
    assert.ok(exportFiles(site.model)["index.html"].includes("<html"));
    console.log("PASS real generation", {
      case: name,
      seconds: Math.round((Date.now() - start) / 1000),
      pages: site.model.pages.length,
      sections: sections.length,
      photos: images.filter((e) => e.src).length,
      fonts: [site.model.theme.headingFont, site.model.theme.bodyFont],
      branded: !!site.model.brand.wordmark,
    });
  } finally {
    if (user?.id)
      await call("/auth/v1/admin/users/" + user.id, null, key, key, "DELETE");
  }
}

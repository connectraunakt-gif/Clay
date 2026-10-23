import { loadEnvFile } from "node:process";
import assert from "node:assert/strict";
import { applyOperations, locate } from "../js/model.js";
import { clarificationSite } from "./fixtures/clarification-site.mjs";
loadEnvFile(".env");
const base = "https://auzhsqhcajzarhtvxrke.supabase.co",
  pub = process.env.CLAY_PUBLIC_KEY;
const keys = await (
  await fetch(
    "https://api.supabase.com/v1/projects/auzhsqhcajzarhtvxrke/api-keys",
    {
      headers: { Authorization: "Bearer " + process.env.SUPABASE_ACCESS_TOKEN },
      signal: AbortSignal.timeout(20000),
    },
  )
).json();
const service = keys.find((k) => k.name === "service_role").api_key;
async function call(path, body, token = service, method = "POST") {
  const r = await fetch(base + path, {
    method,
    headers: {
      apikey: token === service ? service : pub,
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
      Origin: "http://localhost:4173",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(135000),
  });
  const t = await r.text();
  const data = t ? JSON.parse(t) : null;
  assert.ok(r.ok, `Request failed ${r.status}: ${JSON.stringify(data)}`);
  return data;
}
let user;
try {
  const email = "clay-clarify-" + crypto.randomUUID() + "@example.invalid",
    password = crypto.randomUUID() + "Aa9!";
  user = await call("/auth/v1/admin/users", {
    email,
    password,
    email_confirm: true,
  });
  const token = (
    await call("/auth/v1/token?grant_type=password", { email, password }, pub)
  ).access_token;
  const model = clarificationSite(),
    heading = model.pages[0].sections[0].elements[0].id;
  let site = await call(
    "/rest/v1/rpc/create_website",
    { p_model: model },
    token,
  );
  async function edit(prompt, extra = {}) {
    const r = await call(
      "/functions/v1/clay",
      {
        type: "edit",
        siteId: site.id,
        pageId: site.model.pages[0].id,
        prompt,
        clarification: false,
        ...extra,
      },
      token,
    );
    assert.equal(r.baseRevision, site.revision);
    if (r.operations)
      site = await call(
        "/rest/v1/rpc/save_website",
        {
          p_id: site.id,
          p_revision: site.revision,
          p_model: applyOperations(site.model, r.operations),
          p_label: "Clarification regression test",
        },
        token,
      );
    return r;
  }
  const question = await edit(
    "Change this heading to wording I will supply next. Ask me what it should say first; do not change anything yet.",
    { selected: heading },
  );
  assert.ok(question.question && question.clarification);
  assert.doesNotMatch(question.question, /\b(?:IDs?|JSON|schema)\b/i);
  console.log("PASS real plain-language clarification");
  const answer = await edit('Use exactly: "Small worlds, made together."', {
    pageId: model.pages[5].id,
    selected: model.pages[5].sections[0].id,
    clarification: question.clarification,
  });
  assert.ok(answer.operations?.length, JSON.stringify(answer));
  assert.equal(
    locate(site.model, heading).node.text,
    "Small worlds, made together.",
  );
  console.log(
    "PASS real clarification reply saved on original target after switching pages",
  );
  const broad = await edit(
    "Home: hero, introduction, featured classes. Classes: workshop cards and an enquiry button, no invented dates or prices. Shop: terrarium products with descriptions, no checkout. Our Story: brand story and studio photography. Gallery: an image grid. Contact: contact form and opening-hours information without inventing the hours. Use the existing pages and make the changes now.",
    {
      clarification: {
        request:
          "Rework Home, Classes, Shop, Our Story, Gallery, and Contact so each page has the contents it needs.",
        question: "What would you like included on each page?",
        pageId: model.pages[0].id,
        selected: null,
        replies: [],
      },
    },
  );
  assert.ok(broad.operations?.length, JSON.stringify(broad));
  for (const p of model.pages)
    assert.notDeepEqual(
      site.model.pages.find((x) => x.id === p.id).sections,
      p.sections,
      "Named page was not edited: " + p.title,
    );
  assert.equal(site.model.pages.length, 6);
  console.log(
    "PASS six-page clarification applied and saved",
    broad.operations.length,
    "operations",
  );
  const before = structuredClone(site.model);
  const target = site.model.pages[5].sections.find((s) => s.type === "contact");
  const followup = await edit("Center the contact form and its labels", {
    pageId: model.pages[5].id,
  });
  assert.ok(followup.operations?.length);
  assert.equal(locate(site.model, target.id + ":form").node.align, "center");
  assert.deepEqual(site.model.pages[0], before.pages[0]);
  console.log("PASS subsequent edit preserves earlier page changes");
} finally {
  if (user?.id)
    await call("/auth/v1/admin/users/" + user.id, null, service, "DELETE");
}

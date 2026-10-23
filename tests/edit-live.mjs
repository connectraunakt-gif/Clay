import { loadEnvFile } from "node:process";
import assert from "node:assert/strict";
import { example, applyOperations, locate } from "../js/model.js";
loadEnvFile(".env");
const ref = "auzhsqhcajzarhtvxrke",
  base = "https://" + ref + ".supabase.co",
  pub = process.env.CLAY_PUBLIC_KEY;
const keys = await (
  await fetch("https://api.supabase.com/v1/projects/" + ref + "/api-keys", {
    headers: { Authorization: "Bearer " + process.env.SUPABASE_ACCESS_TOKEN },
    signal: AbortSignal.timeout(20000),
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
  const r = await fetch(base + path, {
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
  const t = await r.text();
  return { status: r.status, data: t ? JSON.parse(t) : null };
}
let user;
try {
  const email = "clay-edit-api-" + crypto.randomUUID() + "@example.invalid",
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
  assert.equal(auth.status, 200);
  const token = auth.data.access_token;
  const m = example();
  m.name = "Harbor Kitchen";
  m.content = [
    {
      id: "bread-content",
      name: "Sourdough bread",
      description: "Freshly baked",
      price: "₹180",
    },
  ];
  m.pages[0].sections = [
    {
      id: "menu-section",
      type: "products",
      layout: "grid",
      elements: [
        { id: "menu-title", type: "heading", text: "Our menu" },
        {
          id: "soup-item",
          type: "item",
          text: "Tomato soup",
          description: "Fresh basil",
          price: "₹250",
        },
        {
          id: "salad-item",
          type: "item",
          text: "Garden salad",
          description: "Seasonal greens",
          price: "₹300",
        },
      ],
    },
  ];
  const created = await call(
    "/rest/v1/rpc/create_website",
    { p_model: m },
    token,
    pub,
  );
  assert.equal(created.status, 200, JSON.stringify(created.data));
  const site = created.data;
  const start = Date.now();
  const edit = await call(
    "/functions/v1/clay",
    {
      type: "edit",
      siteId: site.id,
      pageId: "home",
      prompt:
        "Each item in the menu should have an image attached to it with all details. There should be a full width box for each item with all details and users should scroll down vertically, not horizontally. Also add reservations, online ordering and payment features.",
    },
    token,
    pub,
  );
  assert.equal(edit.status, 200, JSON.stringify(edit.data));
  assert.ok(edit.data.operations?.length);
  const revised = applyOperations(m, edit.data.operations);
  assert.equal(revised.pages[0].sections[0].layout, "list");
  for (const node of [
    ...revised.pages[0].sections[0].elements.filter((e) => e.type === "item"),
    ...revised.content,
  ])
    assert.match(node.src, /^https:\/\//, node.text || node.name);
  assert.match(
    edit.data.summary,
    /not|unsupported|cannot|doesn.t|does not|external|available|support|booking|payment/i,
  );
  const saved = await call(
    "/rest/v1/rpc/save_website",
    {
      p_id: site.id,
      p_model: revised,
      p_revision: site.revision,
      p_label: "Test menu photos and list",
    },
    token,
    pub,
  );
  assert.equal(saved.status, 200, JSON.stringify(saved.data));
  const precise = await call(
    "/functions/v1/clay",
    {
      type: "edit",
      siteId: site.id,
      pageId: "home",
      selected: "menu-title",
      prompt:
        'Change only this selected heading to exactly: "Fresh from our kitchen." Keep everything else unchanged.',
    },
    token,
    pub,
  );
  assert.equal(precise.status, 200, JSON.stringify(precise.data));
  const next = applyOperations(revised, precise.data.operations);
  assert.equal(locate(next, "menu-title").node.text, "Fresh from our kitchen.");
  assert.deepEqual(next.content, revised.content);
  assert.deepEqual(
    next.pages[0].sections[0].elements.slice(1),
    revised.pages[0].sections[0].elements.slice(1),
  );
  console.log(
    "PASS deployed authenticated AI editing: images for all mixed cards, full-width list, supported changes despite payment request, owner save and precise selected-heading edit",
    {
      seconds: Math.round((Date.now() - start) / 1000),
      operations: edit.data.operations.length,
      photos: 3,
    },
  );
} finally {
  if (user?.id) {
    const r = await call(
      "/auth/v1/admin/users/" + user.id,
      undefined,
      service,
      service,
      "DELETE",
    );
    assert.equal(r.status, 200);
  }
}

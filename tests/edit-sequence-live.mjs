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
  const email = "clay-sequence-" + crypto.randomUUID() + "@example.invalid",
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
  m.description =
    "An invented cafe serving specialty coffee and seasonal pastries.";
  m.email = "hello@example.com";
  m.pages[0].sections[0].elements.find((e) => e.type === "image").src =
    "https://images.unsplash.com/photo-1442512595331-e89e73853f31?auto=format&fit=crop&w=1200&q=80";
  m.pages[0].sections[0].elements.find((e) => e.type === "button").text =
    "View Menu";
  m.pages.push(
    {
      id: "menu-page",
      title: "Menu",
      slug: "menu",
      sections: [
        {
          id: "menu-section",
          type: "products",
          layout: "grid",
          elements: [{ id: "menu-heading", type: "heading", text: "Our menu" }],
        },
      ],
    },
    {
      id: "contact-page",
      title: "Contact",
      slug: "contact",
      sections: [
        {
          id: "contact-section",
          type: "contact",
          layout: "center",
          form: { align: "left", textAlign: "left" },
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
    },
  );
  m.navigation = m.pages.map((p) => ({ pageId: p.id, label: p.title }));
  m.content = [
    {
      id: "coffee",
      name: "Espresso",
      description: "Coffee, freshly prepared.",
      price: "",
    },
  ];
  let site = (
    await call("/rest/v1/rpc/create_website", { p_model: m }, token, pub)
  ).data;
  assert.ok(site.id);
  const history = [];
  async function edit(prompt, pageId, selected, check) {
    const start = Date.now(),
      r = await call(
        "/functions/v1/clay",
        {
          type: "edit",
          siteId: site.id,
          pageId,
          selected,
          prompt,
          history: history.slice(-6),
        },
        token,
        pub,
      );
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.ok(r.data.operations?.length, JSON.stringify(r.data));
    assert.equal(r.data.baseRevision, site.revision);
    const next = applyOperations(site.model, r.data.operations);
    check(next);
    const save = await call(
      "/rest/v1/rpc/save_website",
      {
        p_id: site.id,
        p_model: next,
        p_revision: site.revision,
        p_label: prompt,
      },
      token,
      pub,
    );
    assert.equal(save.status, 200, JSON.stringify(save.data));
    site = save.data;
    history.push(
      { role: "you", text: prompt },
      { role: "clay", text: r.data.summary },
    );
    console.log("PASS sequential edit", history.length / 2, {
      seconds: Math.round((Date.now() - start) / 1000),
      operations: r.data.operations.map((o) => o.type),
    });
  }
  await edit(
    "Make the View Menu button link to the Menu page. Put the hero image on the left with the heading, description and button on the right, and shorten the hero image to 360 pixels. Keep all words unchanged.",
    "home",
    "hero",
    (next) => {
      assert.match(locate(next, "cta").node.href, /menu/);
      assert.equal(locate(next, "hero").node.mediaPosition, "left");
      assert.equal(locate(next, "hero").node.imageHeight, 360);
    },
  );
  await edit(
    "there is a form on the contact page which is currently left-aligned, can you make it center-aligned",
    "contact-page",
    null,
    (next) => {
      assert.equal(locate(next, "contact-section:form").node.align, "center");
      assert.equal(locate(next, "hero").node.imageHeight, 360);
    },
  );
  await edit(
    "Use Fraunces for all headings and DM Sans for body copy. Keep all words and layouts unchanged.",
    "home",
    null,
    (next) => {
      assert.equal(next.theme.headingFont, "Fraunces");
      assert.equal(next.theme.bodyFont, "DM Sans");
    },
  );
  await edit(
    "Add subtle hover animations to the buttons, images and menu cards, and use softly rounded corners and pill-shaped buttons. Keep the content and layout unchanged.",
    "home",
    null,
    (next) => {
      assert.equal(next.theme.motion, "subtle");
      assert.equal(next.theme.radius, "soft");
      assert.equal(next.theme.buttonStyle, "pill");
    },
  );
  await edit(
    'Set our wordmark to Harbor Kitchen and our tagline to exactly "A pause, well spent." Show our initials mark. Do not change any page content or layouts.',
    "home",
    null,
    (next) => {
      assert.equal(next.brand.wordmark, "Harbor Kitchen");
      assert.equal(next.brand.tagline, "A pause, well spent.");
      assert.equal(next.brand.showMark, true);
    },
  );
  await edit(
    "On the contact page, keep the form in the center but align field labels and text to the left. Set the form width to 600 and the submit button label to Send a note. Do not change other sections.",
    "contact-page",
    "contact-section:form",
    (next) => {
      const f = locate(next, "contact-section:form").node;
      assert.equal(f.align, "center");
      assert.equal(f.textAlign, "left");
      assert.equal(f.width, 600);
      assert.equal(f.buttonText, "Send a note");
    },
  );
  assert.equal(locate(site.model, "hero").node.imageHeight, 360);
  assert.equal(site.model.theme.headingFont, "Fraunces");
  assert.equal(site.model.brand.wordmark, "Harbor Kitchen");
  console.log(
    "PASS six real edits in succession, persisted owner revisions, named form targeting and earlier edits preserved",
  );
} finally {
  if (user?.id)
    assert.equal(
      (
        await call(
          "/auth/v1/admin/users/" + user.id,
          undefined,
          service,
          service,
          "DELETE",
        )
      ).status,
      200,
    );
}

import { loadEnvFile } from "node:process";
import assert from "node:assert/strict";
import { example, newSection } from "../js/model.js";
loadEnvFile(".env");
const ref = "auzhsqhcajzarhtvxrke",
  url = "https://" + ref + ".supabase.co",
  pub = process.env.CLAY_PUBLIC_KEY;
const keys = await (
    await fetch("https://api.supabase.com/v1/projects/" + ref + "/api-keys", {
      headers: { Authorization: "Bearer " + process.env.SUPABASE_ACCESS_TOKEN },
    })
  ).json(),
  service = keys.find((k) => k.name === "service_role").api_key;
async function call(
  path,
  body,
  token = service,
  key = service,
  method = "POST",
  origin = "http://localhost:4173",
) {
  const r = await fetch(url + path, {
    method,
    headers: {
      apikey: key,
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
      Origin: origin,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(140000),
  });
  const text = await r.text();
  return { status: r.status, data: text ? JSON.parse(text) : null };
}
let user, site, repo;
let token;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function untilLive() {
  for (let i = 0; i < 36; i++) {
    await wait(5000);
    const r = await call(
      "/functions/v1/clay",
      { type: "publish_status", siteId: site.id },
      token,
      pub,
    );
    assert.equal(r.status, 200, JSON.stringify(r.data));
    if (r.data.status === "published" || r.data.status === "changed") {
      site = r.data.site;
      return;
    }
    if (r.data.status === "failed") throw Error("Publication failed");
    if (i % 6 === 0) console.log("Waiting for Pages build…");
  }
  throw Error("Pages build timed out");
}
try {
  const email = "clay-publish-" + crypto.randomUUID() + "@example.invalid",
    password = crypto.randomUUID() + "Aa9!";
  user = (
    await call("/auth/v1/admin/users", { email, password, email_confirm: true })
  ).data;
  token = (
    await call(
      "/auth/v1/token?grant_type=password",
      { email, password },
      pub,
      pub,
    )
  ).data.access_token;
  const model = example();
  model.name = "Clay publication check";
  model.pages[0].sections.push(newSection("contact"));
  site = (
    await call("/rest/v1/rpc/create_website", { p_model: model }, token, pub)
  ).data;
  repo = "clay-site-" + site.id.replaceAll("-", "");
  const published = await call(
    "/functions/v1/clay",
    { type: "publish", siteId: site.id },
    token,
    pub,
  );
  console.log(
    "Publish request",
    published.status,
    JSON.stringify(published.data),
  );
  assert.equal(published.status, 200);
  await untilLive();
  assert.ok(site.live_url);
  const html = await (await fetch(site.live_url + "?qa=" + Date.now())).text();
  assert.ok(html.includes("Clay publication check"));
  console.log("PASS real publication:", site.live_url);
  const origin = new URL(site.live_url).origin;
  const contact = await call(
    "/functions/v1/clay",
    {
      type: "contact",
      siteId: site.id,
      name: "Clay QA",
      email: "test@example.invalid",
      message: "Temporary test submission.",
      website: "",
    },
    pub,
    pub,
    "POST",
    origin,
  );
  assert.equal(contact.status, 200, JSON.stringify(contact.data));
  const messages = await call(
    "/rest/v1/submissions?website_id=eq." + site.id,
    null,
    token,
    pub,
    "GET",
  );
  assert.equal(messages.data.length, 1);
  console.log("PASS real contact submission");
  const visitor = crypto.randomUUID(),
    eventId = crypto.randomUUID();
  for (const seconds of [0, 12]) {
    const visit = await call(
      "/functions/v1/clay",
      { type: "visit", siteId: site.id, visitor, eventId, path: "/", seconds },
      pub,
      pub,
      "POST",
      origin,
    );
    assert.equal(visit.status, 200);
  }
  const visits = await call(
    "/rest/v1/visits?website_id=eq." + site.id,
    null,
    token,
    pub,
    "GET",
  );
  assert.equal(visits.data.length, 1);
  assert.equal(visits.data[0].seconds, 12);
  console.log("PASS real visitor collection and duration update");
  const updated = structuredClone(site.model);
  updated.name = "Clay republish check";
  site = (
    await call(
      "/rest/v1/rpc/save_website",
      {
        p_id: site.id,
        p_model: updated,
        p_revision: site.revision,
        p_label: "QA republish",
      },
      token,
      pub,
    )
  ).data;
  assert.equal(site.status, "changed");
  const re = await call(
    "/functions/v1/clay",
    { type: "publish", siteId: site.id },
    token,
    pub,
  );
  assert.equal(re.status, 200, JSON.stringify(re.data));
  await untilLive();
  console.log("PASS republish completion");
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  if (site?.id && token) {
    try {
      const cleanup = await call(
        "/functions/v1/clay",
        { type: "unpublish", siteId: site.id },
        token,
        pub,
      );
      assert.equal(cleanup.status, 200, JSON.stringify(cleanup.data));
      let done = cleanup.data.status === "draft";
      for (let i = 0; !done && i < 40; i++) {
        await wait(5000);
        const s = await call(
          "/functions/v1/clay",
          { type: "publish_status", siteId: site.id },
          token,
          pub,
        );
        done = s.data.status === "draft";
        if (s.data.status === "failed")
          throw Error("Cleanup deployment failed");
      }
      assert.ok(done);
      console.log("Temporary published files removed.");
    } catch (e) {
      console.error("Cleanup needs attention", e.message);
      process.exitCode = 1;
    }
  }
  if (user?.id)
    await call(
      "/auth/v1/admin/users/" + user.id,
      null,
      service,
      service,
      "DELETE",
    );
  console.log("Temporary publishing account and data removed.");
}

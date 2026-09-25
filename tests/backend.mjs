import { loadEnvFile } from "node:process";
import assert from "node:assert/strict";
import { example } from "../js/model.js";
loadEnvFile(".env");
const ref = "auzhsqhcajzarhtvxrke",
  url = "https://" + ref + ".supabase.co",
  pub = process.env.CLAY_PUBLIC_KEY;
const response = await fetch(
  "https://api.supabase.com/v1/projects/" + ref + "/api-keys",
  { headers: { Authorization: "Bearer " + process.env.SUPABASE_ACCESS_TOKEN } },
);
if (!response.ok) throw Error("Cannot get backend test access");
const keys = await response.json(),
  service = keys.find((k) => k.name === "service_role")?.api_key;
if (!service) throw Error("No service access");
async function request(
  path,
  { method = "GET", body, token = service, key = service } = {},
) {
  const r = await fetch(url + path, {
    method,
    headers: {
      apikey: key,
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      Origin: "http://localhost:4173",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  return { status: r.status, data: text ? JSON.parse(text) : null };
}
const users = [];
try {
  for (let i = 0; i < 2; i++) {
    const email = "clay-qa-" + crypto.randomUUID() + "@example.invalid",
      password = crypto.randomUUID() + "aA9!";
    const created = await request("/auth/v1/admin/users", {
      method: "POST",
      body: { email, password, email_confirm: true },
    });
    assert.equal(created.status, 200);
    users.push(created.data);
    const auth = await request("/auth/v1/token?grant_type=password", {
      method: "POST",
      body: { email, password },
      key: pub,
      token: pub,
    });
    assert.equal(auth.status, 200);
    users[i].token = auth.data.access_token;
  }
  const call = (i, name, body) =>
    request("/rest/v1/rpc/" + name, {
      method: "POST",
      body,
      token: users[i].token,
      key: pub,
    });
  const created = await call(0, "create_website", { p_model: example() });
  assert.equal(created.status, 200);
  const site = created.data;
  assert.ok(site.id);
  console.log("PASS authenticated website creation");
  const duplicate = await call(0, "create_website", { p_model: example() });
  assert.ok(duplicate.status >= 400);
  console.log("PASS one-site database limit");
  const other = await request("/rest/v1/websites?select=*", {
    token: users[1].token,
    key: pub,
  });
  assert.equal(other.status, 200);
  assert.deepEqual(other.data, []);
  console.log("PASS cross-account read isolation");
  const denied = await call(1, "save_website", {
    p_id: site.id,
    p_model: example(),
    p_revision: 1,
    p_label: "Forbidden",
  });
  assert.ok(denied.status >= 400);
  console.log("PASS cross-account write isolation");
  const updated = await call(0, "save_website", {
    p_id: site.id,
    p_model: { ...example(), name: "Updated test" },
    p_revision: 1,
    p_label: "Test save",
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.data.revision, 2);
  const conflict = await call(0, "save_website", {
    p_id: site.id,
    p_model: example(),
    p_revision: 1,
    p_label: "Stale",
  });
  assert.ok(conflict.status >= 400);
  console.log("PASS optimistic concurrency");
  const versions = await request("/rest/v1/versions?website_id=eq." + site.id, {
    token: users[0].token,
    key: pub,
  });
  assert.equal(versions.data.length, 1);
  assert.equal(versions.data[0].model.name, "Forma");
  console.log("PASS transactional version history");
  const deniedVersions = await request(
    "/rest/v1/versions?website_id=eq." + site.id,
    { token: users[1].token, key: pub },
  );
  assert.deepEqual(deniedVersions.data, []);
  console.log("PASS version isolation");
  for (const table of ["submissions", "visits", "publications"]) {
    const anon = await request("/rest/v1/" + table + "?select=*", {
      token: pub,
      key: pub,
    });
    assert.ok(anon.status >= 400);
  }
  console.log("PASS anonymous private-data denial");
  const invalid = await request("/functions/v1/clay", {
    method: "POST",
    token: "invalid",
    key: pub,
    body: { type: "generate", description: "test", answers: [] },
  });
  assert.equal(invalid.status, 401);
  console.log("PASS backend token verification");
  const wrong = await request("/functions/v1/clay", {
    method: "POST",
    token: users[1].token,
    key: pub,
    body: { type: "edit", siteId: site.id, prompt: "Change name" },
  });
  assert.equal(wrong.status, 404);
  console.log("PASS backend ownership checks");
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  for (const u of users) {
    await request("/auth/v1/admin/users/" + u.id, { method: "DELETE" });
  }
  console.log("Temporary test accounts and data removed.");
}

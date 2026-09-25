import { loadEnvFile } from "node:process";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
try {
  loadEnvFile(".env");
} catch {}
const token = process.env.SUPABASE_ACCESS_TOKEN,
  ref = "auzhsqhcajzarhtvxrke";
if (!token) {
  console.error(
    "Add SUPABASE_ACCESS_TOKEN to your ignored local .env file first.",
  );
  process.exit(1);
}
async function manage(path, method = "GET", body) {
  const r = await fetch("https://api.supabase.com/v1/projects/" + ref + path, {
    method,
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) {
    console.error("Supabase setup failed", path, r.status);
    process.exit(1);
  }
  const text = await r.text();
  return text ? JSON.parse(text) : null;
}
const tables = await manage("/database/query", "POST", {
  query: "select to_regclass('public.websites') as present",
});
if (!tables[0]?.present) {
  await manage("/database/query", "POST", {
    query:
      "begin;\n" +
      (await readFile("supabase/migrations/202609250001_clay.sql", "utf8")) +
      "\ncommit;",
  });
  console.log("Installed Clay tables and access policies.");
} else console.log("Clay tables already exist; migration skipped.");
const gh = await fetch(
  "https://api.github.com/repos/connectraunakt-gif/Clay/pages",
  {
    headers: {
      Authorization: "Bearer " + process.env.GITHUB_TOKEN,
      Accept: "application/vnd.github+json",
      "User-Agent": "Clay",
    },
  },
);
const pages = gh.ok ? await gh.json() : null;
if (pages?.html_url) {
  await manage("/config/auth", "PATCH", {
    site_url: pages.html_url,
    uri_allow_list: pages.html_url + ",http://localhost:4173/",
  });
  process.env.CLAY_ORIGINS =
    new URL(pages.html_url).origin + ",http://localhost:4173";
  console.log("Configured email sign-in redirects.");
}
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  await manage("/config/auth", "PATCH", {
    external_google_enabled: true,
    external_google_client_id: process.env.GOOGLE_CLIENT_ID,
    external_google_secret: process.env.GOOGLE_CLIENT_SECRET,
  });
  console.log("Google sign-in enabled.");
}
const names = [
  "NVIDIA_API_KEY",
  "NVIDIA_MODEL",
  "GITHUB_TOKEN",
  "GITHUB_OWNER",
  "GITHUB_REPOSITORY",
  "CLAY_ORIGINS",
  "CLAY_PUBLIC_KEY",
];
await manage(
  "/secrets",
  "POST",
  names
    .filter((name) => process.env[name])
    .map((name) => ({ name, value: process.env[name] })),
);
console.log("Installed private backend secrets.");
const child = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  [
    "supabase",
    "functions",
    "deploy",
    "clay",
    "--project-ref",
    ref,
    "--use-api",
  ],
  { stdio: "inherit", env: process.env, shell: process.platform === "win32" },
);
if (child.status) process.exit(child.status);
const auth = await manage("/config/auth");
console.log(
  "Email enabled:",
  auth.external_email_enabled,
  "Google enabled:",
  auth.external_google_enabled,
);
console.log(
  "Backend installation finished. Configure Google OAuth in Supabase if not already enabled.",
);

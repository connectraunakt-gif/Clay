import { readFile } from "node:fs/promises";
import { loadEnvFile } from "node:process";
try {
  loadEnvFile(".env");
} catch {}
const h = {
  Authorization: "Bearer " + process.env.GITHUB_TOKEN,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "Clay-build",
};
for (const p of [
  "/user",
  "/repos/connectraunakt-gif/Clay",
  "/repos/connectraunakt-gif/Clay/pages",
]) {
  const r = await fetch("https://api.github.com" + p, { headers: h });
  const j = await r.json();
  console.log(
    JSON.stringify({
      path: p,
      status: r.status,
      login: j.login,
      permissions: j.permissions,
      default_branch: j.default_branch,
      pages_url: j.html_url,
      build_type: j.build_type,
      error: r.ok ? undefined : j.message,
    }),
  );
}
const r = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: "Bearer " + process.env.NVIDIA_API_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: process.env.NVIDIA_MODEL,
    messages: [{ role: "user", content: 'Return exactly {"ready":true}' }],
    max_tokens: 25,
    stream: false,
  }),
  signal: AbortSignal.timeout(40000),
});
console.log("AI credential test status", r.status);
if (r.ok) {
  const j = await r.json();
  console.log(
    "AI response received",
    Boolean(j.choices?.[0]?.message?.content),
  );
}
console.log(
  "Supabase management token present",
  Boolean(process.env.SUPABASE_ACCESS_TOKEN),
);

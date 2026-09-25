import { loadEnvFile } from "node:process";
loadEnvFile(".env");
const path = "https://api.github.com/repos/connectraunakt-gif/Clay/pages",
  headers = {
    Authorization: "Bearer " + process.env.GITHUB_TOKEN,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "Clay",
  };
let r = await fetch(path, { headers });
if (r.status === 404)
  r = await fetch(path, {
    method: "POST",
    headers,
    body: JSON.stringify({ build_type: "workflow" }),
  });
else if (r.ok)
  r = await fetch(path, {
    method: "PUT",
    headers,
    body: JSON.stringify({ build_type: "workflow" }),
  });
if (!r.ok) {
  console.log("Pages configuration failed", r.status, (await r.json()).message);
  process.exitCode = 1;
} else {
  const j = await (await fetch(path, { headers })).json();
  console.log("Pages URL", j.html_url);
}

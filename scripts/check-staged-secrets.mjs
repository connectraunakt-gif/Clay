import { execFileSync } from "node:child_process";
const files = execFileSync(
  "git",
  ["diff", "--cached", "--name-only", "--diff-filter=ACM"],
  { encoding: "utf8" },
)
  .trim()
  .split("\n")
  .filter(Boolean);
for (const file of files) {
  if (file === ".env" || file.startsWith("supabase/.temp/"))
    throw Error("Private file staged: " + file);
  if (file.endsWith(".png")) continue;
  const content = execFileSync("git", ["show", ":" + file], {
    encoding: "utf8",
  });
  if (
    /github_pat_[A-Za-z0-9_]{30,}|nvapi-[A-Za-z0-9_-]{30,}|sbp_[a-f0-9]{30,}/.test(
      content,
    )
  )
    throw Error("Secret found in " + file);
}
console.log("Credential scan passed for " + files.length + " staged files.");

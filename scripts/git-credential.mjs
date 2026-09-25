import { loadEnvFile } from "node:process";
loadEnvFile(".env");
process.stdout.write(
  process.argv.slice(2).join(" ").toLowerCase().includes("username")
    ? "x-access-token"
    : process.env.GITHUB_TOKEN || "",
);

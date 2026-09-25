import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
const root = resolve("."),
  types = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".webmanifest": "application/manifest+json",
  };
createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    if (p === "/") p = "/index.html";
    const file = resolve(root, "." + p);
    if (
      !file.startsWith(root + sep) ||
      ![".html", ".js", ".css", ".png", ".svg", ".webmanifest"].includes(
        extname(file),
      ) ||
      p.includes("supabase/")
    )
      throw Error();
    res.writeHead(200, {
      "Content-Type": types[extname(file)],
      "Cache-Control": "no-cache",
    });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}).listen(4173, "127.0.0.1", () => console.log("Clay: http://localhost:4173"));

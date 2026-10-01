const clean = (v = "") =>
  String(v)
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .slice(0, 240);
export async function findPhoto(query, fetcher = fetch) {
  const p = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: String(query).slice(0, 160) + " filetype:bitmap",
    gsrnamespace: "6",
    gsrlimit: "8",
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: "1200",
    format: "json",
  });
  const r = await fetcher("https://commons.wikimedia.org/w/api.php?" + p, {
    headers: {
      "User-Agent": "Clay/1.0 (https://connectraunakt-gif.github.io/Clay/)",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok)
    throw Error(
      "Photo search is unavailable. Please try again or upload your own photo.",
    );
  const j = await r.json();
  const pages = Object.values(j.query?.pages || {}).sort(
    (a, b) => (a.index || 0) - (b.index || 0),
  );
  for (const page of pages) {
    const i = page.imageinfo?.[0],
      meta = i?.extmetadata || {},
      license = clean(meta.LicenseShortName?.value);
    if (
      !i ||
      !/^(CC0|CC BY|Public domain)/i.test(license) ||
      !/^https:\/\//.test(i.thumburl || i.url)
    )
      continue;
    return {
      src: i.thumburl || i.url,
      alt: clean(page.title)
        .replace(/^File:/, "")
        .replace(/\.[^.]+$/, ""),
      credit: clean(meta.Artist?.value) + " · " + license,
      creditUrl: i.descriptionurl,
    };
  }
  throw Error(
    "No suitable photo was found. Try a simpler photo description or upload your own.",
  );
}
export async function resolveImages(value, fetcher = fetch) {
  const walk = async (node) => {
    if (!node || typeof node !== "object") return;
    if (node.imageQuery && typeof node.imageQuery === "string") {
      const alt = node.alt;
      Object.assign(node, await findPhoto(node.imageQuery, fetcher));
      if (alt) node.alt = alt;
      delete node.imageQuery;
    }
    await Promise.all(
      Object.values(node)
        .filter((child) => child && typeof child === "object")
        .map(walk),
    );
  };
  await walk(value);
  return value;
}

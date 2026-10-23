const clean = (v = "") =>
  String(v)
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .slice(0, 240);
export async function findPhoto(query, fetcher = fetch, signal) {
  const p = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: String(query).slice(0, 160) + " filetype:bitmap",
    gsrnamespace: "6",
    gsrlimit: "8",
    prop: "imageinfo",
    iiprop: "url|extmetadata|size",
    iiurlwidth: "1200",
    format: "json",
  });
  const r = await fetcher("https://commons.wikimedia.org/w/api.php?" + p, {
    headers: {
      "User-Agent": "Clay/1.0 (https://connectraunakt-gif.github.io/Clay/)",
    },
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(6500)])
      : AbortSignal.timeout(6500),
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
      /logo|diagram|screenshot|poster|coat of arms|floor plan|flag|chart|icon|drawing|stamp/i.test(
        page.title || "",
      ) ||
      (i.width && i.width < 640) ||
      (i.height && i.height < 400) ||
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
const stockPhotos = [
  [
    /coffee|cafe|café|espresso|pastry|breakfast/i,
    "photo-1442512595331-e89e73853f31",
    "A cup of coffee",
  ],
  [
    /furniture|wood|interior|showroom/i,
    "photo-1494438639946-1ebd1d20bf85",
    "Interior design inspiration",
  ],
  [
    /flower|florist|garden|bloom/i,
    "photo-1490750967868-88aa4486c946",
    "Seasonal flowers",
  ],
  [
    /restaurant|food|meal|kitchen|dining/i,
    "photo-1498837167922-ddd27525d352",
    "Fresh food ingredients",
  ],
];
export function fallbackPhoto(query) {
  const match = stockPhotos.find(([pattern]) => pattern.test(query));
  return match
    ? {
        src:
          "https://images.unsplash.com/" +
          match[1] +
          "?auto=format&fit=crop&w=1200&q=80",
        alt: match[2],
        credit: "Photo: Unsplash",
        creditUrl: "https://unsplash.com/license",
      }
    : null;
}
export async function resolveImages(
  value,
  fetcher = fetch,
  { strict = true, warnings = [] } = {},
) {
  const cache = new Map(),
    signal = AbortSignal.timeout(18000);
  const nodes = [];
  const collect = (node) => {
    if (!node || typeof node !== "object") return;
    if (typeof node.imageQuery === "string" && node.imageQuery.trim())
      nodes.push(node);
    for (const child of Object.values(node))
      if (child && typeof child === "object") collect(child);
  };
  collect(value);
  let next = 0;
  const getPhoto = (query) => {
    if (!cache.has(query))
      cache.set(
        query,
        findPhoto(query, fetcher, signal).catch((e) => {
          const fallback = fallbackPhoto(query);
          if (fallback) return fallback;
          throw e;
        }),
      );
    return cache.get(query);
  };
  await Promise.all(
    Array.from({ length: Math.min(3, nodes.length) }, async () => {
      while (next < nodes.length) {
        const node = nodes[next++],
          alt = node.alt;
        try {
          Object.assign(node, await getPhoto(node.imageQuery));
          if (alt) node.alt = alt;
          delete node.imageQuery;
        } catch (e) {
          if (strict) throw e;
          node.src = "";
          if (!warnings.length)
            warnings.push(
              "Some photos could not be loaded. You can add your own in the editor.",
            );
        }
      }
    }),
  );
  return value;
}

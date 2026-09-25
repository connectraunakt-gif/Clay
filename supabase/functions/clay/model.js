export const uid = () => crypto.randomUUID();
export const esc = (v = "") =>
  String(v).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const clone = (v) => structuredClone(v);
export const safeUrl = (v = "") =>
  /^(https?:\/\/|mailto:|tel:|#|\.\/)/i.test(v) ? v : "#";
export const safeImageUrl = (v = "") => /^https:/; //i.test(v)||/^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v)?v:'';
export const fonts = ["Inter", "Georgia", "Arial", "Trebuchet MS"];
export const sectionTypes = [
  "hero",
  "text",
  "services",
  "gallery",
  "products",
  "contact",
  "testimonials",
];
const color = (v) => /^#[0-9a-f]{6}$/i.test(v);
export function validate(m) {
  if (
    !m ||
    typeof m !== "object" ||
    typeof m.name !== "string" ||
    m.name.length > 120 ||
    !m.theme ||
    !Array.isArray(m.pages) ||
    !m.pages.length ||
    m.pages.length > 20
  )
    throw Error("Please keep at least one page and no more than 20 pages.");
  for (const k of ["background", "text", "accent"])
    if (!color(m.theme[k])) throw Error("Choose a valid colour.");
  if (
    !fonts.includes(m.theme.font) ||
    !["comfortable", "compact", "spacious"].includes(m.theme.spacing)
  )
    throw Error("Choose a supported style.");
  const ids = new Set(["navigation", "theme", "website"]);
  const check = (id) => {
    if (typeof id !== "string" || !id || ids.has(id))
      throw Error("Each part of your website needs a unique identity.");
    ids.add(id);
  };
  for (const p of m.pages) {
    check(p.id);
    if (
      !/^[a-z0-9-]+$/.test(p.slug) ||
      !p.title ||
      !Array.isArray(p.sections) ||
      p.sections.length > 40
    )
      throw Error("This page could not be saved.");
    for (const s of p.sections) {
      check(s.id);
      if (
        !sectionTypes.includes(s.type) ||
        !Array.isArray(s.elements) ||
        s.elements.length > 60
      )
        throw Error("This section could not be saved.");
      if (s.layout && !["split", "center", "grid", "stack"].includes(s.layout))
        throw Error("Choose a supported layout.");
      if (s.background && !color(s.background))
        throw Error("Choose a valid colour.");
      for (const e of s.elements) {
        check(e.id);
        if (!["heading", "text", "image", "button", "item"].includes(e.type))
          throw Error("This content is not supported.");
        for (const k of ["text", "src", "alt", "href", "price", "description"])
          if (
            e[k] != null &&
            (typeof e[k] !== "string" ||
              e[k].length > (k === "src" ? 400000 : 12000))
          )
            throw Error("This content is too long.");
      }
    }
  }
  if (new Set(m.pages.map((p) => p.slug)).size !== m.pages.length)
    throw Error("Pages need different addresses.");
  if (
    !Array.isArray(m.navigation) ||
    m.navigation.some(
      (n) =>
        !m.pages.some((p) => p.id === n.pageId) || typeof n.label !== "string",
    )
  )
    throw Error("Choose an existing page for the menu.");
  if (!Array.isArray(m.content) || m.content.length > 500)
    throw Error("Your content list is too long.");
  for (const c of m.content) {
    check(c.id);
    if (
      typeof c.name !== "string" ||
      c.name.length > 200 ||
      typeof c.description !== "string" ||
      c.description.length > 12000 ||
      typeof c.price !== "string" ||
      c.price.length > 100
    )
      throw Error("Check the content details.");
  }
  if (JSON.stringify(m).length > 500000)
    throw Error("This website is too large to save.");
  return m;
}
export function locate(m, id) {
  for (const p of m.pages) {
    if (p.id === id) return { node: p, page: p };
    for (const s of p.sections) {
      if (s.id === id) return { node: s, page: p, section: s };
      for (const e of s.elements)
        if (e.id === id) return { node: e, page: p, section: s, element: e };
    }
  }
  if (id === "navigation") return { node: m.navigation };
  if (id === "theme") return { node: m.theme };
  return null;
}
export function applyOperations(model, operations) {
  const m = clone(model);
  if (!Array.isArray(operations) || operations.length > 60)
    throw Error("Please try a smaller change.");
  for (const o of operations) {
    const f = locate(m, o.target);
    switch (o.type) {
      case "create_page": {
        const p = o.value;
        m.pages.push(p);
        m.navigation.push({ pageId: p.id, label: p.title });
        break;
      }
      case "delete_page":
        if (
          !f ||
          !m.pages.some((p) => p.id === o.target) ||
          m.pages.length === 1
        )
          throw Error("Keep at least one page.");
        m.pages = m.pages.filter((p) => p.id !== o.target);
        m.navigation = m.navigation.filter((n) => n.pageId !== o.target);
        break;
      case "create_section": {
        const p = m.pages.find((p) => p.id === o.pageId);
        if (!p) throw Error("Choose a page first.");
        p.sections.splice(
          Math.max(0, o.index ?? p.sections.length),
          0,
          o.value,
        );
        break;
      }
      case "update_section":
        if (!f?.section || f.element) throw Error("Choose a section.");
        for (const k of ["layout", "background"])
          if (o.value[k] != null) f.section[k] = o.value[k];
        break;
      case "delete_section":
        if (!f?.section || f.element) throw Error("Choose a section first.");
        f.page.sections = f.page.sections.filter((s) => s.id !== o.target);
        break;
      case "move_section": {
        if (!f?.section || f.element) throw Error("Choose a section.");
        const p = m.pages.find((p) => p.id === (o.pageId || f.page.id));
        if (!p) throw Error("Choose a destination page.");
        f.page.sections = f.page.sections.filter((s) => s.id !== o.target);
        p.sections.splice(Math.max(0, o.index), 0, f.section);
        break;
      }
      case "move_element": {
        if (!f?.element) throw Error("Choose some content.");
        const dest = locate(m, o.sectionId);
        if (!dest?.section || dest.element)
          throw Error("Choose a destination section.");
        f.section.elements = f.section.elements.filter(
          (e) => e.id !== o.target,
        );
        dest.section.elements.splice(Math.max(0, o.index), 0, f.element);
        break;
      }
      case "edit_text":
        if (!f?.element || f.element.type === "image")
          throw Error("Choose text to edit.");
        f.element.text = String(o.value);
        break;
      case "replace_image":
        if (f?.element?.type !== "image" || !/^https:\/\//.test(o.value.src))
          throw Error("Use a secure image link.");
        Object.assign(f.element, {
          src: o.value.src,
          alt: String(o.value.alt || ""),
        });
        break;
      case "change_colors":
        for (const [k, v] of Object.entries(o.value)) {
          if (!["background", "text", "accent"].includes(k) || !color(v))
            throw Error("Choose a valid colour.");
          if (f?.section && !f.element && k === "background")
            f.section.background = v;
          else m.theme[k] = v;
        }
        break;
      case "change_typography":
        m.theme.font = o.value;
        break;
      case "change_spacing":
        m.theme.spacing = o.value;
        break;
      case "update_navigation":
        m.navigation = o.value;
        break;
      case "create_content":
        m.content.push(o.value);
        break;
      case "update_content": {
        const i = m.content.findIndex((c) => c.id === o.target);
        if (i < 0) throw Error("That item could not be found.");
        m.content[i] = { ...m.content[i], ...o.value, id: o.target };
        break;
      }
      case "delete_content":
        m.content = m.content.filter((c) => c.id !== o.target);
        break;
      case "update_element":
        if (!f?.element) throw Error("Choose an element.");
        for (const [k, v] of Object.entries(o.value)) {
          if (
            !["text", "href", "alt", "src", "price", "description"].includes(k)
          )
            throw Error("That change is not supported.");
          f.element[k] = v;
        }
        break;
      case "delete_element":
        if (!f?.element) throw Error("Choose an element.");
        f.section.elements = f.section.elements.filter(
          (e) => e.id !== o.target,
        );
        break;
      case "create_element":
        if (!f?.section || f.element) throw Error("Choose a section.");
        f.section.elements.push(o.value);
        break;
      case "update_info":
        for (const k of ["name", "description", "email", "phone", "address"])
          if (o.value[k] != null) m[k] = String(o.value[k]);
        break;
      case "restore": {
        if (o.target === "website") return validate(clone(o.value));
        if (o.target === "navigation" || o.target === "theme") {
          m[o.target] = clone(o.value);
          break;
        }
        if (!f)
          throw Error(
            "This part was removed. Restore its page or website instead.",
          );
        Object.keys(f.node).forEach((k) => delete f.node[k]);
        Object.assign(f.node, clone(o.value));
        break;
      }
      case "publish_website":
        throw Error("Publishing must be requested separately.");
      default:
        throw Error("Clay could not understand that change. Please try again.");
    }
  }
  return validate(m);
}
export function newSection(type = "text") {
  return {
    id: uid(),
    type,
    layout: type === "hero" ? "split" : "stack",
    elements: [
      {
        id: uid(),
        type: "heading",
        text:
          type === "contact"
            ? "Let’s talk"
            : type === "products"
              ? "Our collection"
              : "A little about us",
      },
      {
        id: uid(),
        type: "text",
        text: "Tell your customers what makes your business special.",
      },
    ],
  };
}
export function example() {
  return validate({
    name: "Forma",
    description: "Thoughtful furniture. Made for living.",
    email: "",
    phone: "",
    address: "",
    theme: {
      background: "#f4f1eb",
      text: "#252b25",
      accent: "#354b3c",
      font: "Georgia",
      spacing: "spacious",
    },
    navigation: [{ pageId: "home", label: "Home" }],
    content: [],
    pages: [
      {
        id: "home",
        slug: "index",
        title: "Home",
        sections: [
          {
            id: "hero",
            type: "hero",
            layout: "split",
            elements: [
              {
                id: "title",
                type: "heading",
                text: "Made slowly.\nLoved for a lifetime.",
              },
              {
                id: "intro",
                type: "text",
                text: "Considered furniture for the spaces you call home. Crafted with care, shaped by nature.",
              },
              {
                id: "cta",
                type: "button",
                text: "Explore our approach",
                href: "#story",
              },
              {
                id: "photo",
                type: "image",
                src: "https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&w=1600&q=85",
                alt: "A calm interior with natural wood furniture and warm light",
              },
            ],
          },
          {
            id: "story",
            type: "text",
            layout: "center",
            elements: [
              {
                id: "story-title",
                type: "heading",
                text: "Good things take shape.",
              },
              {
                id: "story-copy",
                type: "text",
                text: "Honest materials. Thoughtful details. Pieces that feel like they have always belonged.",
              },
            ],
          },
        ],
      },
    ],
  });
}
function contrast(a, b) {
  const lum = (c) => {
    const v = c
      .slice(1)
      .match(/../g)
      .map((x) => parseInt(x, 16) / 255)
      .map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
    return v[0] * 0.2126 + v[1] * 0.7152 + v[2] * 0.0722;
  };
  const x = lum(a),
    y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
const readable = (background, preferred) =>
  contrast(background, preferred) >= 4.5
    ? preferred
    : contrast(background, "#ffffff") > contrast(background, "#171d24")
      ? "#ffffff"
      : "#171d24";
export function renderDocument(
  model,
  pageId,
  {
    editing = false,
    preview = false,
    progressive = false,
    endpoint = "",
    siteId = "",
    publicKey = "",
  } = {},
) {
  validate(model);
  const m = model,
    p = m.pages.find((p) => p.id === pageId) || m.pages[0],
    space = { compact: "48px", comfortable: "76px", spacious: "104px" }[
      m.theme.spacing
    ];
  const attrs = (id) =>
    editing && !preview ? ` data-clay-id="${esc(id)}" tabindex="0"` : "";
  const element = (e, hero = false) => {
    const a = attrs(e.id);
    switch (e.type) {
      case "heading":
        return `<${hero ? "h1" : "h2"}${a}>${esc(e.text).replace(/\n/g, "<br>")}</${hero ? "h1" : "h2"}>`;
      case "text":
        return `<p${a}>${esc(e.text).replace(/\n/g, "<br>")}</p>`;
      case "image":
        return `<img${a} src="${esc(safeImageUrl(e.src))}" alt="${esc(e.alt)}" loading="${hero ? "eager" : "lazy"}">`;
      case "button":
        return `<a class="button"${a} href="${esc(safeUrl(e.href))}">${esc(e.text)} <span aria-hidden="true">↗</span></a>`;
      case "item":
        return `<article${a}><h3>${esc(e.text)}</h3><p>${esc(e.description)}</p><strong>${esc(e.price)}</strong></article>`;
      default:
        return "";
    }
  };
  const sections = p.sections
    .map(
      (s, i) =>
        `<section id="${esc(s.id)}" class="section ${esc(s.type)} ${["split", "center", "grid", "stack"].includes(s.layout) ? s.layout : "stack"}"${attrs(s.id)} style="${s.background ? `background:${s.background};color:${readable(s.background, m.theme.text)};` : ""}--order:${i}"><div class="inside">${
          s.type === "hero" && s.layout === "split"
            ? `<div>${s.elements
                .filter((e) => e.type !== "image")
                .map((e) => element(e, true))
                .join("")}</div>${s.elements
                .filter((e) => e.type === "image")
                .map((e) => element(e, true))
                .join("")}`
            : s.elements.map((e) => element(e, s.type === "hero")).join("")
        }${s.type === "products" ? `<div class="products">${m.content.map((c) => `<article><h3>${esc(c.name)}</h3><p>${esc(c.description)}</p><strong>${esc(c.price)}</strong></article>`).join("")}</div>` : ""}${s.type === "contact" ? `<form id="contact"><label>Your name<input name="name" maxlength="150" required autocomplete="name"></label><label>Email address<input name="email" type="email" maxlength="250" required autocomplete="email"></label><label>How can we help?<textarea name="message" maxlength="5000" required></textarea></label><input name="website" tabindex="-1" autocomplete="off" class="honey" aria-hidden="true"><button class="button">Send message</button><p role="status" id="form-status"></p></form>` : ""}</div></section>`,
    )
    .join("");
  const css = `*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:${m.theme.background};color:${readable(m.theme.background, m.theme.text)};font-family:'${m.theme.font}',sans-serif;font-size:16px;line-height:1.65}a{color:inherit;text-decoration:none}a:focus-visible,button:focus-visible,input:focus-visible,textarea:focus-visible{outline:3px solid ${m.theme.accent};outline-offset:5px}header{max-width:1280px;margin:auto;padding:28px 6%;display:flex;align-items:center;justify-content:space-between;gap:24px}.brand{font-size:28px;font-weight:600;letter-spacing:-1px}nav{display:flex;gap:26px;flex-wrap:wrap;font-family:Inter,Arial,sans-serif;font-size:14px}h1{font-size:clamp(40px,5.5vw,78px);line-height:1.06;font-weight:400;letter-spacing:-.04em;margin:0 0 28px}h2{font-size:clamp(28px,3vw,44px);line-height:1.2;font-weight:400;letter-spacing:-.025em;margin:0 0 24px}h3{font-size:24px;line-height:1.3}p{max-width:620px;font-family:Inter,Arial,sans-serif;line-height:1.8;opacity:.85}section{padding:${space} 6%}.inside{max-width:1120px;margin:auto}.split .inside{display:grid;grid-template-columns:1fr 1fr;gap:64px;align-items:center}.hero img{width:100%;height:520px;object-fit:cover}.button{display:inline-flex;gap:24px;justify-content:center;align-items:center;background:${m.theme.accent};color:${readable(m.theme.accent, "#ffffff")};padding:14px 23px;border:0;border-radius:3px;font:500 15px Inter,Arial,sans-serif;cursor:pointer;margin-top:16px}.center{text-align:center}.center p{margin:20px auto}.gallery .inside,.products,.grid .inside{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:28px}.gallery h2,.grid h2{grid-column:1/-1}img{max-width:100%;object-fit:cover}.gallery img{height:320px;width:100%}article{padding:24px;border:1px solid currentColor}footer{padding:32px 6%;border-top:1px solid #8884;display:flex;justify-content:space-between;gap:30px;flex-wrap:wrap;font:14px Inter,Arial,sans-serif}form{max-width:560px;text-align:left}label{display:block;font:15px Inter,Arial,sans-serif;margin:20px 0}input,textarea{width:100%;padding:14px;border:1px solid #8888;background:transparent;color:inherit;font:inherit;margin-top:8px;border-radius:4px}textarea{min-height:120px}.honey{position:absolute;left:-9999px}[data-clay-id]{cursor:pointer}[data-clay-id]:hover{outline:2px solid #748da7;outline-offset:4px}[data-clay-id].selected{outline:2px solid #3f6791;outline-offset:4px}${progressive ? "section{animation:appear .7s both;animation-delay:calc(var(--order)*.32s)}@keyframes appear{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}" : ""}@media(max-width:650px){header{align-items:flex-start}.brand{font-size:24px}nav{gap:12px}.split .inside{grid-template-columns:1fr;gap:32px}section{padding:48px 6%}.hero img{height:360px}h1{font-size:44px}}@media(prefers-reduced-motion:reduce){*{animation:none!important;scroll-behavior:auto!important}}`;
  const payload = JSON.stringify({ endpoint, siteId, publicKey }).replace(
    /</g,
    "\\u003c",
  );
  const script = editing
    ? `const isPreview=${preview};document.addEventListener('click',e=>{const link=e.target.closest('[data-page]');if(link||!isPreview)e.preventDefault();const n=e.target.closest('[data-clay-id]');if(n&&!isPreview){document.querySelectorAll('.selected').forEach(x=>x.classList.remove('selected'));n.classList.add('selected');parent.postMessage({type:'clay-select',id:n.dataset.clayId},'*')}const a=e.target.closest('[data-page]');if(a)parent.postMessage({type:'clay-page',id:a.dataset.page},'*')});document.addEventListener('dblclick',e=>{const n=e.target.closest('[data-clay-id]');if(!isPreview&&n&&/^(H1|H2|H3|P)$/.test(n.tagName)){n.contentEditable='true';n.focus();n.addEventListener('blur',()=>{n.contentEditable='false';parent.postMessage({type:'clay-text',id:n.dataset.clayId,text:n.innerText},'*')},{once:true})}});document.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.target.isContentEditable)e.target.click()})`
    : `const cfg=${payload};const send=(type,data)=>fetch(cfg.endpoint,{method:'POST',headers:{'Content-Type':'application/json','apikey':cfg.publicKey},body:JSON.stringify({type,siteId:cfg.siteId,...data})});document.querySelector('#contact')?.addEventListener('submit',async e=>{e.preventDefault();const status=document.querySelector('#form-status'),button=e.target.querySelector('button');if(!cfg.endpoint){status.textContent='Online messages are not connected yet. Please contact us directly.';return}button.disabled=true;status.textContent='Sending…';try{const r=await send('contact',{...Object.fromEntries(new FormData(e.target))});if(!r.ok)throw Error();e.target.reset();status.textContent='Thank you. Your message has been sent.'}catch{status.textContent='Your message could not be sent. Please try again.'}finally{button.disabled=false}});if(cfg.endpoint&&navigator.doNotTrack!=='1'){let visitor;try{visitor=localStorage.getItem('clay-visitor');if(!visitor){visitor=crypto.randomUUID();localStorage.setItem('clay-visitor',visitor)}}catch{visitor=crypto.randomUUID()}const eventId=crypto.randomUUID(),started=Date.now();send('visit',{visitor,eventId,path:location.pathname,seconds:0}).catch(()=>{});document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')fetch(cfg.endpoint,{method:'POST',keepalive:true,headers:{'Content-Type':'application/json','apikey':cfg.publicKey},body:JSON.stringify({type:'visit',siteId:cfg.siteId,visitor,eventId,path:location.pathname,seconds:Math.min(1800,Math.round((Date.now()-started)/1000))})}).catch(()=>{})})}if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{})`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(p.title)} — ${esc(m.name)}</title><meta name="description" content="${esc(m.description)}"><meta name="theme-color" content="${m.theme.background}"><link rel="manifest" href="./manifest.webmanifest"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet"><style>${css}</style></head><body><header${attrs("navigation")}><a class="brand" href="./${m.pages[0].slug}.html">${esc(m.name)}</a><nav aria-label="Main navigation">${m.navigation.map((n) => `<a data-page="${esc(n.pageId)}" href="./${esc(m.pages.find((p) => p.id === n.pageId).slug)}.html">${esc(n.label)}</a>`).join("")}</nav></header><main>${sections}</main><footer><span>© ${new Date().getFullYear()} ${esc(m.name)}</span><span>${esc([m.address, m.phone, m.email].filter(Boolean).join(" · "))}</span></footer><script>${script}</script></body></html>`;
}
export function exportFiles(m, options = {}) {
  const files = {};
  for (const p of m.pages)
    files[p.slug + ".html"] = renderDocument(m, p.id, options);
  if (!files["index.html"])
    files["index.html"] = renderDocument(m, m.pages[0].id, options);
  files["icon.svg"] =
    `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192"><rect width="192" height="192" rx="32" fill="${m.theme.accent}"/><text x="96" y="128" text-anchor="middle" font-size="100" fill="white">${esc(m.name[0] || "C")}</text></svg>`;
  files["manifest.webmanifest"] = JSON.stringify({
    name: m.name,
    short_name: m.name.slice(0, 20),
    start_url: "./",
    display: "standalone",
    background_color: m.theme.background,
    theme_color: m.theme.accent,
    icons: [{ src: "icon.svg", sizes: "any", type: "image/svg+xml" }],
  });
  const cache = "site-" + crypto.randomUUID();
  files["sw.js"] =
    `const C=${JSON.stringify(cache)};self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(${JSON.stringify(["./", ...Object.keys(files).map((f) => "./" + f)])})));self.skipWaiting()});self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k))))));self.addEventListener('fetch',e=>{if(e.request.method==='GET'&&new URL(e.request.url).origin===location.origin)e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)))});`;
  files[".nojekyll"] = "";
  return files;
}

// Repair only unambiguous AI navigation references; content and design remain intact.
export function prepareGeneratedModel(input) {
  const m = clone(input);
  if (!Array.isArray(m?.pages) || !m.pages.length)
    throw Error("Clay needs at least one complete page.");
  const seen = new Set();
  m.navigation = (Array.isArray(m.navigation) ? m.navigation : []).flatMap(
    (n) => {
      const key = String(n.pageId || "").toLowerCase();
      const p = m.pages.find(
        (p) =>
          p.id === n.pageId ||
          p.slug === key ||
          p.title?.toLowerCase() === key ||
          p.sections?.some((s) => s.id === n.pageId),
      );
      if (!p || seen.has(p.id)) return [];
      seen.add(p.id);
      return [
        {
          pageId: p.id,
          label: p.id === n.pageId ? String(n.label || p.title) : p.title,
        },
      ];
    },
  );
  if (!m.navigation.length)
    m.navigation = m.pages.map((p) => ({ pageId: p.id, label: p.title }));
  for (const k of ["description", "email", "phone", "address"])
    m[k] = String(m[k] || "");
  m.content = (m.content || []).map((c) => ({
    ...c,
    name: String(c.name || ""),
    description: String(c.description || ""),
    price: String(c.price ?? ""),
  }));
  return validate(m);
}

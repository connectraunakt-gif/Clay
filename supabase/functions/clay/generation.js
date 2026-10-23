import { validate, uid } from "./model.js";
import { fonts, themeKeys } from "./design.js";
export const planSchema = `Return {plan:{name,description,email,phone,address,brand:{wordmark,tagline,showMark:boolean},theme:{background:'#rrggbb',text:'#rrggbb',accent:'#rrggbb',surface:'#rrggbb',font:headingFont,headingFont,bodyFont,spacing:'comfortable'|'compact'|'spacious',radius:'square'|'soft'|'round',buttonStyle:'solid'|'outline'|'pill',motion:'none'|'subtle'|'expressive',headingScale:'balanced'|'display',contentWidth:880to1600},content:[{name,description,price,imageQuery?,alt?}],pages:[{title,slug,navLabel?,sections:[{type:'hero'|'text'|'services'|'gallery'|'products'|'contact'|'testimonials',layout:'split'|'center'|'grid'|'stack'|'list'|'cover'|'bento'|'editorial',eyebrow?,heading,text?,background?,mediaPosition?:'left'|'right',imageHeight?:200to900,contentAlign?:'left'|'center'|'right',gap?:8to96,padding?:16to180,maxWidth?:480to1600,form?:{align:'left'|'center'|'right',textAlign:'left'|'center'|'right',width:280to1120,buttonText?,nameLabel?,emailLabel?,messageLabel?},imageQuery?,imageAlt?,images?:[{query,alt}],button?:{text,href},items?:[{name,description,price,imageQuery?,alt?}]}]}]}}.
Design a specific visual identity rather than a stack of identical sections. Choose a distinctive heading/body type pairing from: Inter, DM Sans, Manrope, Plus Jakarta Sans, Space Grotesk, Outfit, Sora, Fraunces, DM Serif Display, Cormorant Garamond, Playfair Display, Libre Baskerville, Georgia, Arial, Trebuchet MS. Use fonts thoughtfully: an editorial studio might pair Cormorant Garamond with DM Sans; a precise modern service could pair Space Grotesk with Manrope; a warm independent business could use Fraunces with DM Sans. These are examples, not fixed business templates. Prefer readable typography, clear hierarchy, strong negative space, a confident colour palette, restrained accents, specific copy and well-composed photography. Brand wordmark uses the real business name; tagline must reflect its positioning, not invented claims. showMark creates a simple initials mark, never pretend it is an uploaded logo. No decorative robots, sparkles or fake AI effects. Keep interface-like cards out of editorial story sections. Vary section backgrounds and composition purposefully without excessive decoration.
Split/editorial layouts pair a text column and image column; mediaPosition controls the image side and imageHeight its crop. Cover places copy over a full-bleed photo with a contrast overlay. Bento is useful for visual portfolios or selected features; grid is a regular card/gallery layout; list gives full-width product/menu rows. Hero should have concise, memorable copy with a clear action. Add short eyebrow labels where they improve hierarchy. Avoid repeating the business name in every heading. Form layout is real and editable; contact-center must center its form as well as its copy. All motion is subtle by default and respects reduced-motion preferences. All new design options render in standalone exports too.
Do not produce IDs, HTML, CSS or code. Clay creates identifiers and navigation. Use short specific English photo queries, never invented URLs. Plan no more than 3 pages unless requested. Home slug is index. Buttons may link to #contact, #menu, page slugs, mailto: or a supplied social URL. Products sections render content items automatically; do not duplicate them in section items. Menu/product photography is illustrative unless supplied by the user. Contact sections include a working enquiry form automatically. Do not invent addresses, phone numbers, opening hours, testimonials, awards, prices or claims. Do not claim roasting, farm sourcing, ethical certification, handmade production, years of experience or specific materials unless the brief supplies those facts. Improve expression without inventing how the business operates. Do not promise working reservations, order processing or payments; support enquiries or an external URL supplied by the user. Honor every user exclusion and exact requested section/page count. Keep the JSON compact and complete.`;

export const directionSchema = `You are the art director for a bespoke small-business website. Return only {direction:{brand:{wordmark:string,tagline:string,showMark:boolean},theme:{background:'#rrggbb',text:'#rrggbb',accent:'#rrggbb',surface:'#rrggbb',font:headingFont,headingFont,bodyFont,spacing:'comfortable'|'spacious'|'compact',radius:'square'|'soft'|'round',buttonStyle:'solid'|'outline'|'pill',motion:'subtle'|'none'|'expressive',headingScale:'display'|'balanced',contentWidth:integer880to1440},heroImageQuery:string,heroLayout:'split'|'cover'|'editorial'|'center',mediaPosition:'left'|'right',rationale:string}}. Make every choice fit the actual business and the user's preferences. Font choices: Fraunces, Cormorant Garamond, Playfair Display, DM Serif Display, Libre Baskerville, Space Grotesk, Plus Jakarta Sans, Manrope, DM Sans, Outfit, Sora, Inter. Pair a distinctive heading font with a readable body font. Use a coherent high-contrast palette and specific positioning language, not generic claims. Keep the tagline short. A hero photograph should be atmospheric and illustrative, using a specific 2-5 word English photo search query; use an empty string if the user excludes photos. Pick a confident composition; use imagery to balance copy. Never invent credentials, statistics, reviews, locations or business claims. Output only the compact direction object; do not write pages or code.`;
export function normalizeTheme(input = {}) {
  const t = Object.fromEntries(
    Object.entries(input || {}).filter(([key]) => themeKeys.includes(key)),
  );
  for (const key of ["font", "headingFont", "bodyFont"]) {
    if (t[key] != null) {
      const found = fonts.find(
        (f) => f.toLowerCase() === String(t[key]).toLowerCase(),
      );
      if (found) t[key] = found;
      else delete t[key];
    }
  }
  for (const key of ["background", "text", "accent", "surface", "muted"]) {
    if (/^#[0-9a-f]{3}$/i.test(t[key] || ""))
      t[key] = "#" + [...t[key].slice(1)].map((c) => c + c).join("");
    if (t[key] != null && !/^#[0-9a-f]{6}$/i.test(t[key])) delete t[key];
  }
  if (typeof t.contentWidth === "string" && /^\d+(?:px)?$/.test(t.contentWidth))
    t.contentWidth = parseInt(t.contentWidth, 10);
  if (
    t.contentWidth != null &&
    (!Number.isInteger(t.contentWidth) ||
      t.contentWidth < 880 ||
      t.contentWidth > 1600)
  )
    delete t.contentWidth;
  for (const [key, values] of Object.entries({
    spacing: ["comfortable", "compact", "spacious"],
    radius: ["square", "soft", "round"],
    buttonStyle: ["solid", "outline", "pill"],
    motion: ["none", "subtle", "expressive"],
    headingScale: ["balanced", "display"],
  }))
    if (t[key] != null && !values.includes(t[key])) delete t[key];
  return t;
}
export function normalizeDirection(input) {
  if (!input || typeof input !== "object") return undefined;
  const direction = structuredClone(input);
  direction.theme = normalizeTheme(direction.theme || direction.brand?.theme);
  return direction;
}
export function withArtDirection(plan, direction, brief = {}) {
  if (!plan || typeof plan !== "object") return plan;
  const p = structuredClone(plan),
    d = normalizeDirection(direction) || {};
  p.theme = { ...(d.theme || d.brand?.theme), ...(p.theme || p.brand?.theme) };
  p.brand = { ...d.brand, ...p.brand };
  const words = [
    brief.description,
    ...(brief.answers || []).map((a) => a.answer),
  ].join(" ");
  const noImages =
    /\bno (?:stock )?(?:images|photos|photographs|photography)\b|text[ -]only|without (?:images|photos)/i.test(
      words,
    );
  for (const page of p.pages || [])
    for (const section of page.sections || []) {
      if (
        section.type === "hero" &&
        !section.imageQuery &&
        !section.images?.length &&
        d.heroImageQuery &&
        !noImages
      ) {
        section.imageQuery = d.heroImageQuery;
        section.imageAlt = d.heroImageQuery;
        section.layout = d.heroLayout || "split";
        section.mediaPosition = d.mediaPosition || "right";
      }
      if (noImages) {
        delete section.imageQuery;
        delete section.images;
        for (const item of section.items || []) delete item.imageQuery;
        if (section.layout === "cover") section.layout = "center";
      }
    }
  if (noImages) for (const item of p.content || []) delete item.imageQuery;
  return p;
}
const text = (v = "") => String(v ?? "");
const slug = (v) =>
  text(v)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
export function compilePlan(plan) {
  plan = structuredClone(plan);
  if (!plan?.theme && plan?.brand?.theme) plan.theme = plan.brand.theme;
  if (plan) plan.theme = normalizeTheme(plan.theme);
  if (
    !plan ||
    !Array.isArray(plan.pages) ||
    !plan.pages.length ||
    plan.pages.length > 20
  )
    throw Error("The design needs at least one complete page.");
  const canonicalFont = (value) =>
    typeof value === "string"
      ? fonts.find((f) => f.toLowerCase() === value.toLowerCase()) || value
      : value;
  if (plan.theme) {
    for (const key of ["font", "headingFont", "bodyFont"])
      if (plan.theme[key]) plan.theme[key] = canonicalFont(plan.theme[key]);
    for (const key of ["background", "text", "accent", "surface", "muted"])
      if (/^#[0-9a-f]{3}$/i.test(plan.theme[key] || ""))
        plan.theme[key] =
          "#" + [...plan.theme[key].slice(1)].map((c) => c + c).join("");
  }
  const aliases = new Map(),
    pageSlugs = new Set();
  const pages = plan.pages.map((p, i) => {
    if (!p.title || !Array.isArray(p.sections) || !p.sections.length)
      throw Error("Each page needs a title and sections.");
    let pageSlug = i === 0 ? "index" : slug(p.slug || p.title) || "page";
    const base = pageSlug;
    let n = 2;
    while (pageSlugs.has(pageSlug)) pageSlug = base + "-" + n++;
    pageSlugs.add(pageSlug);
    const page = {
      id: uid(),
      title: text(p.title),
      slug: pageSlug,
      sections: [],
    };
    for (const key of [p.slug, p.title, pageSlug])
      if (key && !aliases.has(slug(key))) aliases.set(slug(key), page);
    page.sections = p.sections.map((input) => {
      const s = structuredClone(input);
      const types = {
        about: "text",
        story: "text",
        approach: "text",
        process: "text",
        cta: "text",
        faq: "text",
        menu: "products",
        portfolio: "gallery",
        features: "services",
        reviews: "testimonials",
        banner: "hero",
      };
      s.type = types[s.type] || s.type;
      const layouts = {
        "two-column": "split",
        two_column: "split",
        "split-left": "split",
        "split-right": "split",
        "full-width": "stack",
        stacked: "stack",
        centered: "center",
        cards: "grid",
        vertical: "list",
        "full-bleed": "cover",
      };
      if (s.layout === "split-left") s.mediaPosition = "left";
      if (s.layout === "split-right") s.mediaPosition = "right";
      s.layout = layouts[s.layout] || s.layout;
      for (const key of ["imageHeight", "gap", "padding", "maxWidth"])
        if (typeof s[key] === "string" && /^\d+(?:px)?$/.test(s[key]))
          s[key] = parseInt(s[key], 10);
      if (s.form) {
        s.form = Object.fromEntries(
          Object.entries(s.form).filter(([key]) =>
            [
              "align",
              "textAlign",
              "width",
              "buttonText",
              "nameLabel",
              "emailLabel",
              "messageLabel",
            ].includes(key),
          ),
        );
        for (const key of ["align", "textAlign"])
          if (["centered", "centre"].includes(s.form[key]))
            s.form[key] = "center";
        if (
          typeof s.form.width === "string" &&
          /^\d+(?:px)?$/.test(s.form.width)
        )
          s.form.width = parseInt(s.form.width, 10);
      }
      if (
        ![
          "hero",
          "text",
          "services",
          "gallery",
          "products",
          "contact",
          "testimonials",
        ].includes(s.type)
      )
        throw Error(
          "Unsupported section type: " +
            s.type +
            ". Use hero, text, services, gallery, products or contact.",
        );
      const section = {
        id: uid(),
        type: s.type,
        layout: s.layout || "stack",
        elements: [],
      };
      for (const key of [
        "background",
        "mediaPosition",
        "imageHeight",
        "contentAlign",
        "gap",
        "padding",
        "maxWidth",
        "form",
      ])
        if (s[key] != null) section[key] = structuredClone(s[key]);
      if (s.eyebrow)
        section.elements.push({
          id: uid(),
          type: "eyebrow",
          text: text(s.eyebrow),
        });
      section.elements.push({
        id: uid(),
        type: "heading",
        text: text(s.heading || p.title),
      });
      if (s.text)
        section.elements.push({ id: uid(), type: "text", text: text(s.text) });
      if (s.button?.text)
        section.elements.push({
          id: uid(),
          type: "button",
          text: text(s.button.text),
          href: text(s.button.href || "#contact"),
        });
      for (const item of s.items || [])
        section.elements.push({
          id: uid(),
          type: "item",
          text: text(item.name || item.text),
          description: text(item.description),
          price: text(item.price),
          ...(item.imageQuery
            ? {
                imageQuery: text(item.imageQuery),
                alt: text(item.alt || item.name),
              }
            : {}),
        });
      const images = [
        ...(s.imageQuery ? [{ query: s.imageQuery, alt: s.imageAlt }] : []),
        ...(s.images || []),
      ];
      for (const image of images)
        section.elements.push({
          id: uid(),
          type: "image",
          src: "",
          imageQuery: text(image.query),
          alt: text(image.alt || image.query),
        });
      return section;
    });
    return page;
  });
  for (const page of pages) {
    const hero = page.sections.find((s) => s.type === "hero");
    if (hero && !hero.elements.some((e) => e.type === "button")) {
      const contact = pages
        .flatMap((p) => p.sections.map((s) => ({ page: p, section: s })))
        .find((x) => x.section.type === "contact");
      const target = contact
        ? "./" + contact.page.slug + ".html#" + contact.section.id
        : plan.email
          ? "mailto:" + plan.email
          : page.sections.find((s) => s.type !== "hero")
            ? "#" + page.sections.find((s) => s.type !== "hero").id
            : "";
      if (target)
        hero.elements.splice(
          hero.elements.findIndex((e) => e.type === "image") < 0
            ? hero.elements.length
            : hero.elements.findIndex((e) => e.type === "image"),
          0,
          {
            id: uid(),
            type: "button",
            text: contact || plan.email ? "Get in touch" : "Explore",
            href: target,
          },
        );
    }
  }
  for (const p of pages)
    for (const s of p.sections)
      for (const e of s.elements)
        if (e.type === "button") {
          const key = slug(e.href.replace(/^#/, ""));
          if (/^(https?:|mailto:|tel:)/i.test(e.href)) continue;
          const section = p.sections.find(
            (x) =>
              x.type === key ||
              slug(x.elements[0]?.text) === key ||
              (key === "menu" && x.type === "products"),
          );
          if (section) e.href = "#" + section.id;
          else if (aliases.has(key))
            e.href = "./" + aliases.get(key).slug + ".html";
          else {
            const other = pages
              .flatMap((page) =>
                page.sections.map((section) => ({ page, section })),
              )
              .find((x) => x.section.type === key);
            e.href = other
              ? "./" + other.page.slug + ".html#" + other.section.id
              : "#";
          }
        }
  return validate({
    name: text(plan.name),
    description: text(plan.description),
    email: text(plan.email),
    phone: text(plan.phone),
    address: text(plan.address),
    brand: {
      wordmark:
        typeof plan.brand?.wordmark === "string"
          ? plan.brand.wordmark
          : text(plan.name),
      tagline: text(plan.brand?.tagline),
      showMark: plan.brand?.showMark === true,
      ...(typeof plan.brand?.logoSrc === "string"
        ? {
            logoSrc: plan.brand.logoSrc,
            logoAlt: text(plan.brand.logoAlt || plan.name),
          }
        : {}),
    },
    theme: {
      headingFont:
        plan.theme?.headingFont || plan.theme?.font || "Space Grotesk",
      bodyFont: plan.theme?.bodyFont || "DM Sans",
      radius: "soft",
      buttonStyle: "solid",
      motion: "subtle",
      headingScale: "display",
      contentWidth: 1200,
      background: "#f7f5f0",
      text: "#202a32",
      accent: "#344e68",
      font: "Inter",
      spacing: "comfortable",
      ...plan.theme,
    },
    navigation:
      pages.length > 1
        ? pages.map((p, i) => ({
            pageId: p.id,
            label: text(plan.pages[i].navLabel || p.title),
          }))
        : [
            { pageId: pages[0].id, label: "Home" },
            ...pages[0].sections
              .filter((s) => s.type !== "hero")
              .map((section) => ({
                pageId: pages[0].id,
                sectionId: section.id,
                label:
                  section.type === "contact"
                    ? "Contact"
                    : section.type === "products"
                      ? /cafe|café|coffee|restaurant/i.test(
                          plan.name + " " + plan.description,
                        )
                        ? "Menu"
                        : "Collection"
                      : section.type === "gallery"
                        ? "Gallery"
                        : section.type === "services"
                          ? "Services"
                          : (
                              section.elements.find((e) => e.type === "heading")
                                ?.text || "About"
                            ).slice(0, 28),
              })),
          ],
    content: (plan.content || []).map((c) => ({
      id: uid(),
      name: text(c.name),
      description: text(c.description),
      price: text(c.price),
      ...(c.imageQuery
        ? { imageQuery: text(c.imageQuery), alt: text(c.alt || c.name) }
        : {}),
    })),
    pages,
  });
}

export function requirementsFromBrief(brief) {
  const input = [
    brief.description,
    ...(brief.answers || []).map((x) => x.answer),
  ].join("\n");
  const numbers = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
  };
  const result = {};
  const pattern =
    /\b(?:exactly|only|just|keep(?: exactly)?|limit(?: it)? to)\s+(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\s+(sections?|pages?)\b/gi;
  for (const match of input.matchAll(pattern)) {
    const count = Number(match[1]) || numbers[match[1].toLowerCase()];
    if (count > 0 && count <= 40)
      result[
        match[2].toLowerCase().startsWith("section") ? "sections" : "pages"
      ] = count;
  }
  if (
    /\b(?:no|without|do not (?:include|add)|don't (?:include|add))\s+(?:any\s+)?testimonials?\b/i.test(
      input,
    )
  )
    result.noTestimonials = true;
  return result;
}
export function checkRequirements(model, requirements) {
  const sections = model.pages.flatMap((p) => p.sections);
  if (requirements.sections && sections.length !== requirements.sections)
    throw Error(
      "Use exactly " +
        requirements.sections +
        " sections in total across the entire website, not per page.",
    );
  if (requirements.pages && model.pages.length !== requirements.pages)
    throw Error("Use exactly " + requirements.pages + " pages.");
  if (
    requirements.noTestimonials &&
    sections.some((s) => s.type === "testimonials")
  )
    throw Error("Remove testimonials; the owner explicitly excluded them.");
  return model;
}

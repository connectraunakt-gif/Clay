import { validate, uid } from "./model.js";
export const planSchema = `Return {plan:{name,description,email,phone,address,theme:{background:'#rrggbb',text:'#rrggbb',accent:'#rrggbb',font:'Inter'|'Georgia'|'Arial'|'Trebuchet MS',spacing:'comfortable'|'compact'|'spacious'},content:[{name,description,price,imageQuery?,alt?}],pages:[{title,slug,navLabel?,sections:[{type:'hero'|'text'|'services'|'gallery'|'products'|'contact'|'testimonials',layout:'split'|'center'|'grid'|'stack'|'list',heading,text?,imageQuery?,imageAlt?,images?:[{query,alt}],button?:{text,href},items?:[{name,description,price,imageQuery?,alt?}]}]}]}}. Do not produce IDs, HTML or code. Clay creates all internal identifiers and navigation. Use short natural English photo search phrases (e.g. 'coffee cup', 'wooden furniture'), never URLs. Page slug for Home is index. Buttons can link to #contact, #menu, a page slug, mailto: or a supplied social URL. Contact sections include a form automatically; product sections display content items. Vary layouts, typography, palette, sections and copy for the business. Only include pages and sections that materially help this business. Honor user exclusions and exact requested section/page counts. Never invent business addresses, phone numbers, opening hours, testimonials, awards, prices or claims. Never describe stock photos as actual staff, products or premises. Use concise copy; at most 3 pages unless the user explicitly asks for more. Keep the JSON compact and complete.`;
const text = (v = "") => String(v ?? "");
const slug = (v) =>
  text(v)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
export function compilePlan(plan) {
  if (
    !plan ||
    !Array.isArray(plan.pages) ||
    !plan.pages.length ||
    plan.pages.length > 20
  )
    throw Error("The design needs at least one complete page.");
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
    page.sections = p.sections.map((s) => {
      const section = {
        id: uid(),
        type: s.type,
        layout: s.layout || "stack",
        elements: [],
      };
      if (s.background) section.background = s.background;
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
    theme: {
      background: "#f7f5f0",
      text: "#202a32",
      accent: "#344e68",
      font: "Inter",
      spacing: "comfortable",
      ...plan.theme,
    },
    navigation: pages.map((p, i) => ({
      pageId: p.id,
      label: text(plan.pages[i].navLabel || p.title),
    })),
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

import { literalOperations } from "./intent.js";
import { fonts, layouts, themeKeys, sectionKeys, formKeys } from "./design.js";
import { applyOperations, locate } from "./model.js";
import { normalizeOperations } from "./actions.js";
import { resolveImages } from "./media.js";
export const editInstructions = `Edit the supplied website with small, precise structured operations. Return JSON {summary:string,operations:[...]}, or {question:string} if the request is too vague. Preserve IDs and unrelated content. Use the selected element as context, unless the user requests the whole page/site. Never return HTML, CSS or JavaScript. Never replace the whole website for a small change.
Operations (every object has a type field):
edit_text {target:elementId,value:string}; update_element {target:elementId,value:{text?,description?,price?,href?,alt?,imageQuery?}}; replace_image {target:elementOrContentId,value:{imageQuery,alt}}; create_element {target:sectionId,value:{type:'heading'|'text'|'button'|'image'|'item',text?,description?,price?,href?,imageQuery?,alt?}}; delete_element {target}; move_element {target:elementId,sectionId,index};
update_style {target:elementOrContentId,value:{color?:'#rrggbb',background?:'#rrggbb',fontSize?:integer12to100,fontFamily?:supportedFont,textAlign?:'left'|'center'|'right',padding?:integer0to100}};
create_content {value:{name,description,price,imageQuery?,alt?}}; update_content {target:contentId,value:{name?,description?,price?,imageQuery?,alt?}}; delete_content {target:contentId}; move_content {target:contentId,index}; reorder_items {target:productsSectionId,value:[all card IDs in desired order]} to reorder the combined menu cards and catalogue entries within a product section;
update_form {target:formIdOrContactSectionId,value:{align?:'left'|'center'|'right',textAlign?:'left'|'center'|'right',width?:integer280to1120,buttonText?,nameLabel?,emailLabel?,messageLabel?}}; update_section {target:sectionId,value:{layout?:'stack'|'split'|'center'|'grid'|'list'|'cover'|'bento'|'editorial',background?:'#rrggbb',mediaPosition?:'left'|'right',imageHeight?:integer200to900,contentAlign?:'left'|'center'|'right',gap?:integer8to96,padding?:integer16to180,maxWidth?:integer480to1600}}; create_section {pageId,index?,value:{type:'hero'|'text'|'services'|'gallery'|'products'|'contact'|'testimonials',layout:'stack'|'split'|'center'|'grid'|'list',elements:[element]}}; delete_section {target:sectionId}; move_section {target:sectionId,pageId?,index};
create_page {value:{title,slug,sections:[section]}}; delete_page {target:pageId}; update_navigation {value:[{pageId,label,sectionId?}]}; change_colors {target?:sectionOrElementId,value:{background?,text?,accent?}}; update_design {value:{headingFont?,bodyFont?,surface?,radius?:'square'|'soft'|'round',buttonStyle?:'solid'|'outline'|'pill',motion?:'none'|'subtle'|'expressive',headingScale?:'balanced'|'display',contentWidth?:integer880to1600}}; update_brand {value:{wordmark?,tagline?,showMark?:boolean,logoSrc?,logoAlt?}}; change_typography {value:fontOrObjectWithHeadingFontAndBodyFont}; change_spacing {value:'comfortable'|'compact'|'spacious'}; update_info {value:{name?,description?,email?,phone?,address?}}; publish_website {} only if explicitly requested.
IDs for new objects may be omitted. Existing targets must be exact IDs from the website. Indices start at 0. Uploaded image data is omitted and marked hasUploadedImage; preserve it unless the user requests a replacement. The capabilities object is the source of truth for available fonts and settings. editableTargets includes real contact forms as well as sections/elements. A form is not an ordinary text element: use update_form. To center a form use align:center (moves the form block) and textAlign:center if the user wants the labels/content centered too. To center a whole contact section, update_section layout:center and update_form align:center. To put a hero image on the left/right or shorten it, use update_section mediaPosition and imageHeight rather than inventing CSS fields. When a user requests an existing design state, returning the same valid setting is acceptable; do not invent a different target. Products sections automatically display website.content; update those existing content items rather than duplicating them as elements. Item elements are separate cards stored in sections. visibleCards explicitly lists EVERY card rendered on the current page, including both item elements and catalogue entries. For requests about each/all menu items, update EVERY visibleCards entry with its specified operation. Do not omit catalogue entries. For automatically adding menu/product photographs, use each card’s exact photoQuery as imageQuery so images match the named dish. Add an image to EACH requested card by putting imageQuery and alt in update_content or update_element for each existing item. Search for a specific product (e.g. 'blueberry muffin', 'croissant'), not the whole business. Clay retrieves real photos; never invent URLs. Stock photos are illustrative, not verified photos of the business's own products.
Use layout 'list' for full-width vertically stacked menu/product/service rows. Use 'grid' for columns of cards. Do not use scroll direction/columns/CSS as invented operation fields. Text and background colours are six-digit hex; per-element styles go through update_style. For scoped changes use exact selected ID; global instructions may affect all relevant sections. Return at most 40 operations; keep output compact.
Clay supports contact enquiries and external links. It does not process payments, shopping carts, order fulfilment, or time-slot reservations. Never create pretend working checkout/booking/payment buttons or operations for these. Apply the supported parts of a mixed request and briefly explain the limitation in summary. If the user supplies a real booking/shop/payment URL, you may link to it. Do not invent business details or prices.`;
export async function planEdit({
  ai,
  model,
  prompt,
  selected,
  pageId,
  history = [],
  images = resolveImages,
}) {
  const quick = resolveAlignment({ model, prompt, selected, pageId });
  if (quick) return quick;
  const started = Date.now();
  const requiredOperations = literalOperations({
    model,
    prompt,
    selected,
    pageId,
  });
  const website = structuredClone(model);
  const compact = (node) => {
    if (!node || typeof node !== "object") return;
    for (const [key, value] of Object.entries(node)) {
      if (
        ["src", "logoSrc"].includes(key) &&
        typeof value === "string" &&
        value.startsWith("data:image/")
      ) {
        node[key] = "";
        node.hasUploadedImage = true;
      } else if (value && typeof value === "object") compact(value);
    }
  };
  compact(website);
  const input = {
    website,
    capabilities: { fonts, layouts, themeKeys, sectionKeys, formKeys },
    editableTargets: model.pages.flatMap((p) =>
      p.sections.flatMap((s) => [
        { id: s.id, type: "section", page: p.title, sectionType: s.type },
        ...(s.type === "contact"
          ? [
              {
                id: s.id + ":form",
                type: "form",
                page: p.title,
                sectionId: s.id,
                current: s.form || {
                  align: s.layout === "center" ? "center" : "left",
                },
              },
            ]
          : []),
        ...s.elements.map((e) => ({
          id: e.id,
          type: e.type,
          sectionId: s.id,
          text: e.text?.slice(0, 100),
        })),
      ]),
    ),
    pageId,
    selected: locate(model, selected) ? selected : null,
    instruction: prompt,
    requiredOperations,
    recentConversation: history,
    visibleCards: model.pages
      .filter((p) => p.id === pageId)
      .flatMap((p) =>
        p.sections.flatMap((s) => [
          ...s.elements
            .filter((e) => e.type === "item")
            .map((e) => ({
              id: e.id,
              name: e.text,
              photoQuery: e.text,
              operation: "update_element",
              sectionId: s.id,
            })),
          ...(s.type === "products"
            ? model.content.map((c) => ({
                id: c.id,
                name: c.name,
                photoQuery: c.name,
                operation: "update_content",
                sectionId: s.id,
              }))
            : []),
        ]),
      ),
  };
  let result, operations, reason;
  for (let attempt = 0; attempt < 2; attempt++) {
    result = await ai(
      editInstructions,
      {
        ...input,
        ...(reason
          ? {
              correction: {
                message: reason,
                previousOperations: result?.operations,
              },
            }
          : {}),
      },
      4096,
      { totalMs: Math.max(1000, 105000 - (Date.now() - started)) },
    );
    if (result.question)
      return { question: String(result.question).slice(0, 1000) };
    try {
      operations = normalizeOperations(result.operations);
      // Older designs can contain both item elements and catalogue entries.
      // Their target ID determines the exact, unambiguous update destination.
      for (const op of operations) {
        const target = locate(model, op.target);
        if (op.type === "update_content" && target?.element?.type === "item") {
          op.type = "update_element";
          if (op.value?.name != null) {
            op.value.text = op.value.name;
            delete op.value.name;
          }
        } else if (op.type === "update_element" && target?.content) {
          op.type = "update_content";
          if (op.value?.text != null) {
            op.value.name = op.value.text;
            delete op.value.text;
          }
        }
      }
      operations.push(...structuredClone(requiredOperations));
      if (!operations.length)
        throw Error(
          "Return supported changes, or a clear question when no supported change is possible.",
        );
      // Validate structure before spending time retrieving photos. Photo query fields are resolved next.
      const candidate = operations
        .filter((o) => o.type !== "publish_website")
        .map((o) =>
          o.type === "replace_image" && o.value?.imageQuery
            ? {
                ...o,
                value: { ...o.value, src: "https://example.invalid/photo.jpg" },
              }
            : o,
        );
      const changed = applyOperations(model, candidate);
      const exactText = prompt.match(/exactly\s*:?\s*["“]([^"”]+)["”]/i)?.[1];
      if (
        exactText &&
        locate(model, selected)?.element &&
        locate(changed, selected)?.node.text !== exactText
      )
        throw Error(
          "The selected text must match the quoted wording exactly, including punctuation: " +
            exactText,
        );
      reason = null;
      break;
    } catch (error) {
      reason =
        error.message +
        " Use exact IDs from editableTargets and only fields listed in capabilities. Forms use update_form; section layout uses update_section.";
    }
  }
  if (reason)
    throw Error(
      "Clay could not prepare a safe edit. Try one change at a time; your saved website is unchanged.",
    );
  const warnings = [];
  await images(operations, fetch, { strict: false, warnings });
  // A failed search must not erase an existing working photograph.
  for (const op of operations) {
    if (!op.value || typeof op.value !== "object" || op.value.src !== "")
      continue;
    const old = locate(model, op.target)?.node;
    if (old?.src) {
      for (const key of ["src", "alt", "credit", "creditUrl"])
        if (old[key] != null) op.value[key] = old[key];
    }
  }
  operations = operations.filter(
    (o) => o.type !== "replace_image" || o.value?.src,
  );
  applyOperations(
    model,
    operations.filter((o) => o.type !== "publish_website"),
  );
  return {
    summary: [
      String(result.summary || "Your website has been updated.").slice(0, 1200),
      ...warnings,
    ].join(" "),
    operations,
  };
}

// Common positioning requests do not need a generative round trip. Resolve only
// an explicit, unambiguous form alignment; mixed design requests still use AI.
export function resolveAlignment({ model, prompt, selected, pageId }) {
  const f = locate(model, selected);
  if (/\b(?:do not|don't|avoid|without)\b/i.test(prompt)) return null;
  if (
    !(
      /\bform\b/i.test(prompt) ||
      (f?.section?.type === "contact" && /whole (thing|section)/i.test(prompt))
    )
  )
    return null;
  if (
    /\b(add|remove|delete|colou?r|font|photo|image|label|button|width|height|animation|brand|keep)\b/i.test(
      prompt,
    )
  )
    return null;
  const matches = [
    ...prompt.matchAll(
      /\b(center|centre|left|right)(?:[ -]align(?:ed|ment)?)?\b/gi,
    ),
  ];
  if (!matches.length) return null;
  const align = matches.at(-1)[1].toLowerCase().replace("centre", "center");
  const requested = /contact page/i.test(prompt)
    ? model.pages.find((p) => /contact/i.test(p.title))
    : model.pages.find((p) => p.id === pageId);
  const sections =
    requested?.sections.filter((s) => s.type === "contact") || [];
  const section =
    f?.section?.type === "contact"
      ? f.section
      : sections.length === 1
        ? sections[0]
        : model.pages
              .flatMap((p) => p.sections)
              .filter((s) => s.type === "contact").length === 1
          ? model.pages
              .flatMap((p) => p.sections)
              .find((s) => s.type === "contact")
          : null;
  if (!section) return null;
  const operations = [
    {
      type: "update_form",
      target: section.id + ":form",
      value: { align, textAlign: align },
    },
  ];
  if (/whole (thing|section)|everything/i.test(prompt))
    operations.unshift({
      type: "update_section",
      target: section.id,
      value: {
        layout: align === "center" ? "center" : "stack",
        contentAlign: align,
      },
    });
  applyOperations(model, operations);
  return {
    summary:
      align === "center"
        ? "Centered the contact form and its text."
        : "Aligned the contact form and its text to the " + align + ".",
    operations,
  };
}

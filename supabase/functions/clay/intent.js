import { fonts } from "./design.js";
import { locate } from "./model.js";
const escaped = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Exact settings are resolved only when the user names a unique object/value.
// Creative and ambiguous instructions still go through the generative editor.
export function literalOperations({ model, prompt, selected, pageId }) {
  const operations = [],
    current = model.pages.find((p) => p.id === pageId) || model.pages[0],
    f = locate(model, selected);
  const elements = model.pages.flatMap((p) =>
    p.sections.flatMap((s) => s.elements),
  );
  if (
    /\b(button|link|cta)\b/i.test(prompt) &&
    /\blink|\blead|\bopen/i.test(prompt) &&
    !/\b(?:do not|don't|avoid)\s+(?:make|set|change|link|open|point)\b/i.test(
      prompt,
    )
  ) {
    const pages = model.pages.filter((p) =>
      new RegExp(
        "(?:to|open)\\s+(?:the\\s+)?" + escaped(p.title) + "\\s+page",
        "i",
      ).test(prompt),
    );
    const buttons = elements.filter(
      (e) =>
        e.type === "button" &&
        e.text &&
        prompt.toLowerCase().includes(e.text.toLowerCase()),
    );
    if (pages.length === 1 && buttons.length === 1)
      operations.push({
        type: "update_element",
        target: buttons[0].id,
        value: { href: "./" + pages[0].slug + ".html" },
      });
  }
  if (
    /\bhero\b/i.test(prompt) &&
    /\bimage|photo\b/i.test(prompt) &&
    !/\b(?:do not|don't|avoid)\b[^.;]{0,40}(?:image|photo)/i.test(prompt)
  ) {
    const hero =
      f?.section?.type === "hero"
        ? f.section
        : current.sections.find((s) => s.type === "hero");
    if (hero) {
      const value = {},
        height = prompt.match(
          /(?:to|height(?:\s+to|\s+of|\s*:)?)\s+(\d{3})\s*(?:pixels?|px)\b/i,
        )?.[1];
      if (height && Number(height) >= 200 && Number(height) <= 900)
        value.imageHeight = Number(height);
      const placement = prompt.match(
        /\b(?:put|move|place)\b.{0,20}\b(?:image|photo)\b.{0,20}\b(left|right)\b/i,
      )?.[1];
      if (placement) value.mediaPosition = placement.toLowerCase();
      if (value.mediaPosition) value.layout = "split";
      if (Object.keys(value).length)
        operations.push({ type: "update_section", target: hero.id, value });
    }
  }
  const design = {};
  for (const font of fonts) {
    const name = escaped(font);
    if (
      new RegExp(
        "(?:do not|don't|avoid|without)\\s+(?:use\\s+|using\\s+)?" + name,
        "i",
      ).test(prompt)
    )
      continue;
    if (new RegExp(name + "\\s+for\\s+(?:all\\s+)?headings?", "i").test(prompt))
      design.headingFont = font;
    if (
      new RegExp(
        name + "\\s+for\\s+(?:the\\s+)?body(?:\\s+copy|\\s+text)?",
        "i",
      ).test(prompt)
    )
      design.bodyFont = font;
  }
  if (
    /\bsubtle\b[\s\S]*\bhover\b|\bhover\b[\s\S]*\bsubtle\b/i.test(prompt) &&
    !/\b(remove|disable|without|no)\b.{0,25}(hover|motion|animation)/i.test(
      prompt,
    )
  )
    design.motion = "subtle";
  if (
    !/\b(?:do not|don't|avoid|without|remove|no)\b[^.;]{0,30}pill/i.test(
      prompt,
    ) &&
    /pill[ -](?:shaped\s+)?buttons?|pill\s+buttons?/i.test(prompt)
  )
    design.buttonStyle = "pill";
  if (
    !/\b(?:do not|don't|avoid|without|remove|no)\b[^.;]{0,30}soft/i.test(
      prompt,
    ) &&
    /soft(?:ly)?[ -]rounded\s+corners|soft\s+corners/i.test(prompt)
  )
    design.radius = "soft";
  if (Object.keys(design).length)
    operations.push({ type: "update_design", value: design });
  const brand = {},
    wordmark = prompt.match(/wordmark\s+to\s+(.+?)(?=\s+and\b|[.;]|$)/i)?.[1],
    tagline = prompt.match(
      /tagline\s+to\s+(?:exactly\s*)?["“]([^"”]+)["”]/i,
    )?.[1];
  if (
    wordmark &&
    wordmark.trim().length <= 120 &&
    !/(?:do not|don't|avoid)[^.]{0,30}wordmark/i.test(prompt)
  )
    brand.wordmark = wordmark.trim().replace(/^["“]|["”]$/g, "");
  if (tagline) brand.tagline = tagline;
  if (
    !/\b(?:do not|don't|avoid|without|no)\b[^.;]{0,30}show/i.test(prompt) &&
    /\bshow\b.{0,12}\binitials?\s+mark/i.test(prompt)
  )
    brand.showMark = true;
  if (Object.keys(brand).length)
    operations.push({ type: "update_brand", value: brand });
  return operations;
}

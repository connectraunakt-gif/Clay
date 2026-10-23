export const fontCatalog = {
  Inter: "400;500;600;700",
  "DM Sans": "400;500;600;700",
  Manrope: "400;500;600;700",
  "Plus Jakarta Sans": "400;500;600;700",
  "Space Grotesk": "400;500;600;700",
  Outfit: "400;500;600;700",
  Sora: "400;500;600;700",
  Fraunces: "400;500;600;700",
  "DM Serif Display": "400",
  "Cormorant Garamond": "400;500;600;700",
  "Playfair Display": "400;500;600;700",
  "Libre Baskerville": "400;700",
  Georgia: null,
  Arial: null,
  "Trebuchet MS": null,
};
export const fonts = Object.keys(fontCatalog);
export const layouts = [
  "stack",
  "split",
  "center",
  "grid",
  "list",
  "cover",
  "bento",
  "editorial",
];
export const themeKeys = [
  "background",
  "text",
  "accent",
  "font",
  "spacing",
  "headingFont",
  "bodyFont",
  "surface",
  "muted",
  "radius",
  "buttonStyle",
  "motion",
  "headingScale",
  "contentWidth",
];
export const sectionKeys = [
  "layout",
  "background",
  "mediaPosition",
  "imageHeight",
  "contentAlign",
  "gap",
  "padding",
  "maxWidth",
];
export const formKeys = [
  "align",
  "textAlign",
  "width",
  "buttonText",
  "nameLabel",
  "emailLabel",
  "messageLabel",
];
const colour = (v) => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
const integer = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
export function validateDesign(t) {
  for (const key of ["headingFont", "bodyFont"])
    if (t[key] != null && !fonts.includes(t[key]))
      throw Error(
        "Choose a supported typeface. Available: " + fonts.join(", "),
      );
  for (const key of ["surface", "muted"])
    if (t[key] != null && !colour(t[key]))
      throw Error("Choose a six-digit colour.");
  for (const [key, values] of Object.entries({
    radius: ["square", "soft", "round"],
    buttonStyle: ["solid", "outline", "pill"],
    motion: ["none", "subtle", "expressive"],
    headingScale: ["balanced", "display"],
  }))
    if (t[key] != null && !values.includes(t[key]))
      throw Error("Choose a supported " + key + ": " + values.join(", "));
  if (t.contentWidth != null && !integer(t.contentWidth, 880, 1600))
    throw Error("Content width must be between 880 and 1600.");
}
export function validateSectionDesign(s) {
  if (s.layout != null && !layouts.includes(s.layout))
    throw Error("Supported layouts: " + layouts.join(", "));
  for (const key of ["mediaPosition", "contentAlign"])
    if (
      s[key] != null &&
      !(
        key === "mediaPosition"
          ? ["left", "right"]
          : ["left", "center", "right"]
      ).includes(s[key])
    )
      throw Error("Choose a supported alignment.");
  for (const [key, min, max] of [
    ["imageHeight", 200, 900],
    ["gap", 8, 96],
    ["padding", 16, 180],
    ["maxWidth", 480, 1600],
  ])
    if (s[key] != null && !integer(s[key], min, max))
      throw Error(
        "Choose a supported " + key + " between " + min + " and " + max + ".",
      );
  if (s.form != null) validateForm(s.form);
}
export function validateForm(f) {
  if (!f || typeof f !== "object" || Array.isArray(f))
    throw Error("Choose valid form settings.");
  for (const [key, value] of Object.entries(f)) {
    if (["align", "textAlign"].includes(key)) {
      if (!["left", "center", "right"].includes(value))
        throw Error("Choose left, center or right.");
    } else if (key === "width") {
      if (!integer(value, 280, 1120))
        throw Error("Form width must be between 280 and 1120.");
    } else if (
      !formKeys.includes(key) ||
      typeof value !== "string" ||
      !value.trim() ||
      value.length > 150
    )
      throw Error("Choose a supported form setting: " + formKeys.join(", "));
  }
}
export function validateBrand(b) {
  if (b == null) return;
  if (!b || typeof b !== "object" || Array.isArray(b))
    throw Error("Choose valid brand details.");
  for (const [key, v] of Object.entries(b)) {
    if (key === "showMark") {
      if (typeof v !== "boolean")
        throw Error("Choose whether to show the brand mark.");
    } else if (
      !["wordmark", "tagline", "logoSrc", "logoAlt"].includes(key) ||
      typeof v !== "string" ||
      v.length > (key === "logoSrc" ? 400000 : 240)
    )
      throw Error("Check the brand details.");
  }
}
export function fontLink(m) {
  const chosen = new Set([
    m.theme.headingFont || m.theme.font,
    m.theme.bodyFont || "Inter",
    ...m.pages.flatMap((p) =>
      p.sections.flatMap((s) => s.elements.map((e) => e.style?.fontFamily)),
    ),
    ...m.content.map((c) => c.style?.fontFamily),
  ]);
  const params = [...chosen]
    .filter((f) => fontCatalog[f])
    .map(
      (f) =>
        "family=" +
        encodeURIComponent(f).replace(/%20/g, "+") +
        ":wght@" +
        fontCatalog[f],
    );
  return params.length
    ? "https://fonts.googleapis.com/css2?" + params.join("&") + "&display=swap"
    : "";
}
export function designCSS(m, editing, readable = (background, text) => text) {
  const t = m.theme,
    heading = t.headingFont || t.font,
    body = t.bodyFont || "Inter",
    radius = { square: 0, soft: 14, round: 28 }[t.radius || "soft"];
  return `
  :root{--heading:'${heading}';--body:'${body}';--radius:${radius}px;--page-width:${t.contentWidth || 1200}px;--accent:${t.accent};--surface:${t.surface || t.background};--duration:${t.motion === "expressive" ? "380" : "220"}ms}
  body{font-family:var(--body),Arial,sans-serif;-webkit-font-smoothing:antialiased}h1,h2,h3,.brand{font-family:var(--heading),Georgia,serif}h1,h2,h3{font-weight:500;text-wrap:balance}h1{font-size:clamp(44px,${t.headingScale === "display" ? "7.2" : "6"}vw,${t.headingScale === "display" ? 112 : 88}px);letter-spacing:-.045em;line-height:1.04}h2{font-size:clamp(30px,3.9vw,54px);letter-spacing:-.035em;line-height:1.12}h3{letter-spacing:-.02em}p,label,input,textarea,.button,nav,footer{font-family:var(--body),Arial,sans-serif}.inside{width:100%;max-width:var(--section-width,var(--page-width));gap:var(--section-gap,32px)}p{line-height:1.75}header{max-width:calc(var(--page-width) + 12%);padding-block:25px}.brand{display:inline-flex;align-items:center;gap:12px;letter-spacing:-.035em}.brand img{max-width:160px;height:44px;object-fit:contain}.brand-mark{display:grid;place-items:center;width:36px;height:36px;border:1px solid currentColor;border-radius:50%;font:600 12px var(--body);letter-spacing:.04em}.brand-signature{display:flex;flex-direction:column}.brand-signature small{font:400 11px var(--body);letter-spacing:.04em;opacity:.8;max-width:250px}.eyebrow{text-transform:uppercase;font:600 11px var(--body);letter-spacing:.16em;margin:0 0 20px;max-width:none}blockquote{font-family:var(--heading);font-size:clamp(24px,3vw,40px);line-height:1.35;max-width:900px;margin:32px 0}.divider{border:0;border-top:1px solid #8885;margin-block:24px}
  .section{padding:var(--section-padding,${{ compact: 48, comfortable: 80, spacious: 112 }[t.spacing]}px) 6%;text-align:var(--section-align,inherit)}.section p{margin-top:0}.section .section-copy>*+*{margin-top:24px}.section-copy,.section-media,.section-heading{min-width:0}.section[style*="--section-align:left"] .section-copy,.section[style*="--section-align:left"] .section-copy p{margin-left:0;margin-right:auto}.section[style*="--section-align:right"] .section-copy,.section[style*="--section-align:right"] .section-copy p{margin-left:auto;margin-right:0}.section-media{display:grid;gap:20px}.section-media figure{width:100%}.section-media img{display:block;width:100%;height:var(--image-height,500px);object-fit:cover;border-radius:var(--radius)}.split .inside,.editorial .inside{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:var(--section-gap,64px);align-items:center}.editorial .inside{grid-template-columns:1.15fr .85fr;align-items:start}.editorial .section-copy{padding-top:48px}.media-left>.inside>.section-media{order:-1}.section-media figure{margin:0}.hero.split .inside{column-count:auto;display:grid}.hero.split .inside>*{break-before:auto}.hero.split figure:not(:first-child){break-before:auto}.hero .section-copy{padding-block:20px}.center .inside>.section-copy,.center .inside>p{margin-inline:auto}.center .section-copy{max-width:850px}.center .section-media{margin:48px auto 0;max-width:1000px}.center .section-copy p{margin-inline:auto}.center .section-media img{height:var(--image-height,500px)}
  .cover{position:relative;isolation:isolate;min-height:720px;display:flex;align-items:center;padding-block:120px;color:#fff}.cover::after{content:'';position:absolute;inset:0;z-index:-1;background:linear-gradient(90deg,#101510d9,#10151077)}.cover .inside{display:block}.cover .section-copy{max-width:740px}.cover .section-media{position:absolute;inset:0;z-index:-2}.cover .section-media figure{height:100%}.cover .section-media img{width:100%;height:100%;border-radius:0}.cover .section-media figcaption{position:absolute;bottom:12px;right:24px;color:#fff;font-size:11px}.cover .button{background:#fff;color:#17231b}.cover .eyebrow{color:#fff}.gallery .inside,.grid .inside,.bento .inside{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr));gap:24px}.grid .inside>h2,.grid .inside>.eyebrow,.grid .inside>p,.bento .inside>h2,.bento .inside>.eyebrow,.bento .inside>p{grid-column:1/-1}.bento .inside{grid-template-columns:repeat(3,minmax(0,1fr))}.bento .inside>.item-card:first-of-type{grid-column:span 2}.bento .inside>figure:first-of-type{grid-column:span 2}.bento .inside>figure img{height:340px}.catalogue{gap:24px;margin-top:32px;grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr))}.item-card{color:${readable(t.surface || t.background, t.text)};background:var(--surface);border:1px solid #8883;border-radius:var(--radius);overflow:hidden;box-shadow:0 5px 18px #00000003}.item-details{padding:28px}.item-details p{font-size:15px}.item-details strong{font-family:var(--body);font-size:14px;font-weight:600;letter-spacing:.01em}.item-photo{overflow:hidden}.item-photo img{height:260px;width:100%;object-fit:cover;display:block}.item-photo figcaption{font-size:10px}.list .has-photo{grid-template-columns:minmax(180px,32%) 1fr}.list .item-photo img{height:240px}.list .item-details{padding:32px}.list .catalogue{gap:20px}.button{min-height:48px;border-radius:${t.buttonStyle === "pill" ? 999 : radius > 0 ? Math.min(radius, 12) : 0}px;padding:15px 24px;gap:28px;font-weight:600;border:1px solid transparent;letter-spacing:-.01em}.button span{display:inline-block;transition:transform var(--duration) ease}.button:hover span,.button:focus-visible span{transform:translate(3px,-3px)}${t.buttonStyle === "outline" ? ".button{background:transparent;color:inherit;border-color:currentColor}" : ""}nav a{position:relative;padding:8px 0}nav a::after{content:'';position:absolute;bottom:3px;left:0;width:100%;height:1px;background:currentColor;transform:scaleX(0);transform-origin:left;transition:transform var(--duration) ease}nav a:hover::after,nav a:focus-visible::after{transform:scaleX(1)}
  .contact-form{width:100%;max-width:var(--form-width,560px);margin-block:36px 0;text-align:var(--form-text-align,left)}.form-center{margin-inline:auto}.form-left{margin-left:0;margin-right:auto}.form-right{margin-left:auto;margin-right:0}.center .contact-form:not(.form-left):not(.form-right){margin-inline:auto}.contact-form label{font-size:13px;font-weight:500;margin:0 0 22px}.contact-form input,.contact-form textarea{min-height:48px;border-color:#8886;border-radius:8px;padding:14px 16px;text-align:inherit;background:#ffffff0a;transition:border-color .2s,box-shadow .2s}.contact-form textarea{min-height:144px;resize:vertical}.contact-form input:focus,.contact-form textarea:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 15%,transparent)}.contact-form .button{margin-top:0}.contact.split .inside>.contact-form,.contact.editorial .inside>.contact-form{margin-top:0}.contact.center .inside{display:block}.contact.center p{margin-inline:auto}.section figure{overflow:hidden;border-radius:var(--radius)}.photo-placeholder{border-radius:var(--radius)}footer{padding-block:36px;align-items:center}.footer-identity{display:flex;flex-direction:column;gap:6px}.footer-identity strong{font:500 22px var(--heading)}.footer-identity small{font:13px var(--body)}
  ${t.motion !== "none" ? `@media(hover:hover){.button,.item-card{transition:transform var(--duration) ease,box-shadow var(--duration) ease,border-color var(--duration) ease}.button:hover{transform:translateY(-2px);box-shadow:0 8px 20px #00000016}.item-card:hover{transform:translateY(-5px);box-shadow:0 15px 38px #00000012;border-color:var(--accent)}figure img{transition:transform ${t.motion === "expressive" ? "650" : "450"}ms ease}figure:hover img{transform:scale(1.035)}}.motion-ready .reveal-pending{opacity:0;transform:translateY(18px)}.motion-ready .reveal-visible{opacity:1;transform:none;transition:opacity .65s ease,transform .65s ease}` : ""}
  ${t.motion === "none" ? "*,*::before,*::after{transition:none!important;animation:none!important}.button:hover span{transform:none}" : ""}
  ${editing ? ".button:hover,.item-card:hover{transform:none;box-shadow:none}figure:hover img{transform:none}" : ""}
  @media(max-width:720px){header{gap:20px;flex-wrap:wrap}.brand-signature small{display:none}nav{gap:18px}h1{font-size:clamp(42px,10.8vw,64px)}h2{font-size:34px}.section{padding:56px 6%}.split .inside,.hero.split .inside,.editorial .inside{grid-template-columns:1fr;gap:32px;column-count:auto}.section-media img,.hero img,.center .section-media img{height:var(--image-height,380px);max-height:500px}.media-left>.inside>.section-media{order:0}.editorial .section-copy{padding-top:0}.cover{min-height:640px;padding-block:80px}.cover .section-media img{height:100%;max-height:none}.bento .inside{grid-template-columns:1fr}.bento .inside>.item-card:first-of-type,.bento .inside>figure:first-of-type{grid-column:auto}.list .has-photo{grid-template-columns:1fr}.list .item-photo img{height:240px}.list .item-details{padding:24px}.contact-form{max-width:100%}.button{min-height:48px}.brand{font-size:25px}}
  @media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}*,*::before,*::after{animation:none!important;transition:none!important}.motion-ready .reveal-pending{opacity:1;transform:none}.button:hover,.item-card:hover,figure:hover img{transform:none!important}}
  `;
}

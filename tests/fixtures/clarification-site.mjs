import { example } from "../../js/model.js";
export function clarificationSite() {
  const model = example();
  model.name = "Fernhouse Studio";
  model.description =
    "An invented creative plant studio offering terrarium classes and handmade products.";
  model.pages = [
    "Home",
    "Classes",
    "Shop",
    "Our Story",
    "Gallery",
    "Contact",
  ].map((title, i) => ({
    id: crypto.randomUUID(),
    title,
    slug: i ? title.toLowerCase().replaceAll(" ", "-") : "index",
    sections: [
      {
        id: crypto.randomUUID(),
        type:
          i === 5
            ? "contact"
            : i === 2
              ? "products"
              : i === 4
                ? "gallery"
                : i === 0
                  ? "hero"
                  : "text",
        layout: i === 0 ? "split" : "stack",
        elements: [
          { id: crypto.randomUUID(), type: "heading", text: title },
          {
            id: crypto.randomUUID(),
            type: "text",
            text: "Welcome to Fernhouse Studio.",
          },
        ],
      },
    ],
  }));
  model.navigation = model.pages.map((p) => ({ pageId: p.id, label: p.title }));
  model.content = [];
  return model;
}

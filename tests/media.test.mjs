import test from "node:test";
import assert from "node:assert/strict";
import { findPhoto, resolveImages } from "../supabase/functions/clay/media.js";
const mock = async () =>
  new Response(
    JSON.stringify({
      query: {
        pages: {
          1: {
            index: 1,
            title: "File:Wooden table.jpg",
            imageinfo: [
              {
                thumburl: "https://thumb.wikimedia.org/table.jpg",
                descriptionurl:
                  "https://commons.wikimedia.org/wiki/File:Wooden_table.jpg",
                extmetadata: {
                  Artist: { value: "<a>Artist</a>" },
                  LicenseShortName: { value: "CC BY-SA 4.0" },
                },
              },
            ],
          },
        },
      },
    }),
    { headers: { "Content-Type": "application/json" } },
  );
test("real photo results carry escaped-ready attribution and preserve requested alt text", async () => {
  const m = {
    pages: [
      {
        elements: [
          {
            type: "image",
            imageQuery: "wood table",
            alt: "A solid wooden table",
          },
        ],
      },
    ],
  };
  await resolveImages(m, mock);
  const e = m.pages[0].elements[0];
  assert.equal(e.src, "https://thumb.wikimedia.org/table.jpg");
  assert.equal(e.credit, "Artist · CC BY-SA 4.0");
  assert.equal(e.alt, "A solid wooden table");
  assert.equal(e.imageQuery, undefined);
});
test("empty photo search produces an actionable error", async () => {
  await assert.rejects(
    () => findPhoto("test", async () => new Response("{}")),
    /simpler photo description/,
  );
});

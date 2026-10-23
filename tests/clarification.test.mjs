import test from "node:test";
import assert from "node:assert/strict";
import { example, applyOperations, locate } from "../js/model.js";
import { planEdit } from "../supabase/functions/clay/edit.js";
import { editContext } from "../supabase/functions/clay/clarification.js";
import { responseQuestion } from "../supabase/functions/clay/clarification.js";

test("clarification retains the original target across page and selection changes", async () => {
  const model = example();
  const first = await planEdit({
    model,
    prompt: "Change this heading",
    selected: "title",
    pageId: "home",
    ai: async () => ({ question: "What should the heading say?" }),
  });
  assert.equal(first.clarification.request, "Change this heading");
  let received;
  const result = await planEdit({
    model,
    prompt: "A quieter place to gather.",
    selected: "story",
    pageId: "elsewhere",
    clarification: first.clarification,
    ai: async (_, input) => {
      received = input;
      return {
        summary: "Updated heading",
        operations: [
          {
            type: "edit_text",
            target: input.selected,
            value: input.clarification.replies[0].answer,
          },
        ],
      };
    },
    images: async () => {},
  });
  assert.equal(received.pageId, "home");
  assert.equal(received.selected, "title");
  assert.equal(received.clarification.originalRequest, "Change this heading");
  assert.equal(
    locate(applyOperations(model, result.operations), "title").node.text,
    "A quieter place to gather.",
  );
  assert.deepEqual(
    locate(model, "story").node,
    locate(example(), "story").node,
  );
});

test("technical questions are repaired internally before reaching the owner", async () => {
  let calls = 0;
  const result = await planEdit({
    model: example(),
    prompt: "Make the story a centered layout",
    pageId: "home",
    ai: async (_, input) => {
      if (++calls === 1)
        return { question: "Which section/element IDs should be modified?" };
      assert.match(input.correction.message, /Resolve the targets yourself/);
      return {
        operations: [
          {
            type: "update_section",
            target: "story",
            value: { layout: "center" },
          },
        ],
      };
    },
    images: async () => {},
  });
  assert.equal(calls, 2);
  assert.equal(
    applyOperations(example(), result.operations).pages[0].sections[1].layout,
    "center",
  );
});

test("answered questions are repaired, further genuine questions retain both answers", async () => {
  const clarification = {
    request: "Change the heading and button",
    selected: "title",
    pageId: "home",
    replies: [],
    question: "What should the heading say?",
  };
  let calls = 0;
  const result = await planEdit({
    model: example(),
    prompt: "A fresh start",
    clarification,
    ai: async () => ({
      question:
        ++calls === 1 ? clarification.question : "What should the button say?",
    }),
  });
  assert.equal(calls, 2);
  assert.deepEqual(result.clarification.replies, [
    { question: clarification.question, answer: "A fresh start" },
  ]);
  const context = editContext({
    prompt: "Explore our work",
    clarification: result.clarification,
  });
  assert.equal(context.replies.length, 2);
  assert.match(context.instruction, /A fresh start/);
  assert.match(context.instruction, /Explore our work/);
});

test("legacy history replies retain context, explicitly new requests do not", () => {
  const history = [
    { role: "you", text: "Change the heading" },
    { role: "clay", text: "What words would you like?" },
  ];
  assert.equal(
    editContext({ prompt: "Welcome", selected: "title", history }).request,
    "Change the heading",
  );
  const fresh = editContext({
    prompt: "Add a gallery",
    clarification: false,
    history,
  });
  assert.equal(fresh.request, "Add a gallery");
  assert.equal(fresh.replies.length, 0);
  const legacyStatement = editContext({
    prompt: "Welcome",
    history: [
      history[0],
      { role: "clay", text: "Please provide the new heading text." },
    ],
  });
  assert.equal(legacyStatement.request, "Change the heading");
});

test("rephrased generic clarification is retried using the already-supplied answer", async () => {
  let calls = 0;
  const result = await planEdit({
    model: example(),
    prompt: 'Use exactly: "Gather here."',
    clarification: {
      request: 'Change this heading to exactly: "Welcome."',
      selected: "title",
      pageId: "home",
      replies: [],
      question: "What should it say instead?",
    },
    ai: async () =>
      ++calls === 1
        ? { question: "What specific changes should I make?" }
        : {
            operations: [
              { type: "edit_text", target: "title", value: "Gather here." },
            ],
          },
    images: async () => {},
  });
  assert.equal(calls, 2);
  assert.equal(
    locate(applyOperations(example(), result.operations), "title").node.text,
    "Gather here.",
  );
});

test("even a persistently technical provider cannot expose internal instructions", async () => {
  let calls = 0;
  const result = await planEdit({
    model: example(),
    prompt: "Change some things",
    ai: async () => {
      calls++;
      return { question: "Provide element IDs and JSON values." };
    },
  });
  assert.equal(calls, 3);
  assert.doesNotMatch(result.question, /IDs|JSON/);
  assert.equal(result.clarification.request, "Change some things");
});

test("provider questions inside an empty-operation summary become answerable clarifications", async () => {
  const r = await planEdit({
    model: example(),
    prompt: "Change this heading",
    selected: "title",
    pageId: "home",
    ai: async () => ({
      summary:
        "Ready to edit the Home page heading. Please provide the new heading text.",
      operations: [],
    }),
  });
  assert.equal(r.question, "Please provide the new heading text.");
  assert.equal(r.clarification.selected, "title");
  const reply = await planEdit({
    model: example(),
    prompt: "Made together.",
    clarification: r.clarification,
    ai: async () => ({
      operations: [
        { type: "edit_text", target: "title", value: "Made together." },
      ],
    }),
    images: async () => {},
  });
  assert.equal(
    locate(applyOperations(example(), reply.operations), "title").node.text,
    "Made together.",
  );
});

test("empty success summaries are not misreported as questions or saved edits", async () => {
  assert.equal(
    responseQuestion({ summary: "Updated the heading.", operations: [] }),
    null,
  );
  assert.equal(
    responseQuestion({
      summary: "Please share your address.",
      operations: [{ type: "update_info", value: { name: "Studio" } }],
    }),
    null,
  );
  assert.equal(
    responseQuestion({
      message: "Which colour would you like?",
      operations: [],
    }),
    "Which colour would you like?",
  );
  await assert.rejects(
    () =>
      planEdit({
        model: example(),
        prompt: "Change heading",
        ai: async () => ({ summary: "Updated.", operations: [] }),
      }),
    /validation failed/,
  );
});

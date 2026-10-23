# AI clarification reliability

Clarification answers previously relied on a short conversation history. The editing request did not explicitly retain its original instructions or selection, and the dialog displayed a question without an answer field. The model could also ask the owner to provide internal element IDs.

The editor now sends the original request, its page and selected element, and the question/answer sequence together. Answers can be submitted in the dialog or the editing input. Pending questions and answer drafts survive a reload in the same browser tab. Failed requests leave the answer available for retry. A successful save clears this context so the next edit starts independently. “Start a different change” explicitly abandons the pending question.

The planner resolves targets from the website itself. It retries technical questions, repeated questions, and an initial attempt to ask another question after an answer. A genuine missing business preference can still produce a specific follow-up question. Technical questions are never shown verbatim. Ordinary validation failures receive up to two corrective passes before any change is saved. Existing ownership checks, atomic validation, optimistic saves and undo/redo remain in place. Responses prepared against an out-of-date website cannot overwrite newer edits.

A repeated live test reproduced an additional failure: the provider returned “Please provide the new heading text” inside a summary with an empty operations array. The planner previously rejected this as an invalid edit, even though it was asking a question. Explicit information requests in these responses now become answerable clarifications. Empty summaries claiming success still cannot be accepted as saved changes.

Verification uses invented businesses and disposable test accounts:

- `npm test`: 56 passing checks, including clarification context, original selection after a page change, repeated and technical questions, questions inside empty-operation summaries, latest wording priority, and existing generation/editor protections.
- `node tests/clarification-browser.mjs`: dialog answers, simulated service failure, inline recovery, reload persistence, real owner-scoped save, independent next edit, undo and redo.
- `node tests/clarification-live.mjs`: real AI question, answer on the original target after changing pages, a six-page content clarification saved successfully, and a subsequent form edit preserving previous page changes.

Browser-test service failures are deliberately simulated; the separate live test exercises the real AI endpoint. Temporary test accounts are deleted afterward. These checks do not guarantee that an external AI service will never be unavailable.

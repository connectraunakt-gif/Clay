// A clarification is part of the same edit, even when the user changes pages
// before answering. Keep it separate from the short conversational history.
export function editContext({
  prompt,
  selected,
  pageId,
  clarification,
  history = [],
}) {
  let pending = clarification;
  // Older clients only send conversation history. Recover the immediately
  // preceding question so replies from already-open tabs also retain context.
  if (
    clarification !== false &&
    !pending &&
    history.at(-1)?.role === "clay" &&
    (/\?\s*$/.test(history.at(-1).text || "") ||
      responseQuestion({ summary: history.at(-1).text }))
  ) {
    const original = history.findLast((x) => x.role === "you");
    if (original)
      pending = {
        request: original.text,
        question: history.at(-1).text,
        selected,
        pageId,
      };
  }
  const text = (x, max) => (typeof x === "string" ? x.slice(0, max) : "");
  if (!pending || !text(pending.request, 4000) || !text(pending.question, 1000))
    return {
      request: prompt,
      selected,
      pageId,
      replies: [],
      instruction: prompt,
    };
  const replies = (Array.isArray(pending.replies) ? pending.replies : [])
    .slice(-3)
    .map((x) => ({
      question: text(x?.question, 1000),
      answer: text(x?.answer, 4000),
    }));
  replies.push({ question: text(pending.question, 1000), answer: prompt });
  const request = text(pending.request, 4000);
  return {
    request,
    selected: text(pending.selected, 100) || null,
    pageId: text(pending.pageId, 100) || pageId,
    replies,
    instruction: [
      request,
      ...replies.map(
        (x) => `Clay asked: ${x.question}\nUser clarified: ${x.answer}`,
      ),
    ].join("\n\n"),
  };
}

export function technicalQuestion(question) {
  return /\b(?:ids?|identifiers?|schemas?|json|css|html|operation types?|target ids?|element references?)\b|section\s*\/\s*element/i.test(
    question,
  );
}

// Some provider responses put their question in summary/message while returning
// an empty operations array. Treat an actual request for information as a
// clarification, rather than rejecting it as an invalid edit.
export function responseQuestion(result) {
  if (result?.operations?.length) return null;
  if (typeof result?.question === "string" && result.question.trim())
    return result.question.trim().slice(0, 1000);
  const message = result?.summary || result?.message;
  if (typeof message !== "string") return null;
  const question = message.match(
    /\b(?:what|which|how|where|when|would you|could you|can you)\b[^?\n]*\?/i,
  )?.[0];
  const request = message.match(
    /\bplease\s+(?:provide|tell|specify|describe|clarify|share|choose|indicate)\b[^.!?\n]*[.!?]?/i,
  )?.[0];
  return (question || request || "").trim().slice(0, 1000) || null;
}

export function clarificationReply(context, question) {
  const safeQuestion = technicalQuestion(question)
    ? "What would you like visitors to see or do differently? You can describe the page or words you want to change."
    : question;
  return {
    question: safeQuestion,
    clarification: {
      request: context.request,
      selected: context.selected,
      pageId: context.pageId,
      replies: context.replies,
      question: safeQuestion,
    },
  };
}

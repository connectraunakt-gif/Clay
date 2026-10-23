export class AiError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "AiError";
    this.code = code;
  }
}
export function requestBody(model, system, input, maxTokens) {
  return {
    model,
    messages: [
      {
        role: "system",
        content:
          system +
          " Return only valid JSON without markdown. Be concise; complete the JSON.",
      },
      { role: "user", content: JSON.stringify(input) },
    ],
    temperature: 0.3,
    max_tokens: Math.min(4096, maxTokens),
    stream: true,
    ...(model.startsWith("openai/gpt-oss")
      ? { reasoning_effort: "low" }
      : { chat_template_kwargs: { enable_thinking: false } }),
  };
}
async function readResponse(response) {
  if (!response.headers.get("content-type")?.includes("text/event-stream"))
    return response.json();
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let buffer = "",
    content = "",
    finish;
  const parse = (line) => {
    if (!line.startsWith("data:")) return;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") return;
    const chunk = JSON.parse(payload);
    if (chunk.error)
      throw new AiError(
        "provider_error",
        "Clay’s writing service is temporarily unavailable.",
      );
    const choice = chunk.choices?.[0];
    if (typeof choice?.delta?.content === "string")
      content += choice.delta.content;
    if (choice?.finish_reason) finish = choice.finish_reason;
  };
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    let index;
    while ((index = buffer.indexOf("\n")) >= 0) {
      parse(buffer.slice(0, index).trimEnd());
      buffer = buffer.slice(index + 1);
    }
    if (done) break;
  }
  if (buffer.trim()) parse(buffer.trim());
  return { choices: [{ message: { content }, finish_reason: finish }] };
}
export function createAiClient({
  apiKey,
  model = "nvidia/nemotron-3.5-lightning-30b-a3b",
  fallbackModel = "nvidia/nemotron-3.5-lightning-30b-a3b",
  fetcher = fetch,
  totalMs = 105000,
  attemptMs = 50000,
  onAttempt = () => {},
}) {
  return async function ai(system, input, maxTokens = 3200) {
    if (!apiKey)
      throw new AiError(
        "not_configured",
        "Clay’s writing service is not connected yet.",
      );
    const started = Date.now(),
      models = [model, fallbackModel].filter(
        (x, i, a) => x && a.indexOf(x) === i,
      );
    if (models.length === 1) models.push(model);
    let last;
    for (let i = 0; i < models.length; i++) {
      const remaining = totalMs - (Date.now() - started);
      if (remaining < 2000) break;
      const signal = AbortSignal.timeout(Math.min(attemptMs, remaining));
      await onAttempt(i + 1, models[i]);
      try {
        let r = await fetcher(
          "https://integrate.api.nvidia.com/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: "Bearer " + apiKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(
              requestBody(models[i], system, input, maxTokens),
            ),
            signal,
          },
        );
        if (r.status === 202) {
          const pending = await r.json().catch(() => ({}));
          const id =
            r.headers.get("nvcf-reqid") ||
            r.headers.get("nvcf-request-id") ||
            pending.requestId;
          if (!/^[a-zA-Z0-9-]+$/.test(id || ""))
            throw new AiError(
              "provider_pending",
              "The writing service is still preparing this request.",
            );
          do {
            await new Promise((resolve, reject) => {
              const abort = () => {
                clearTimeout(timer);
                reject(signal.reason);
              };
              const timer = setTimeout(() => {
                signal.removeEventListener("abort", abort);
                resolve();
              }, 1500);
              if (signal.aborted) {
                clearTimeout(timer);
                reject(signal.reason);
              } else signal.addEventListener("abort", abort, { once: true });
            });
            r = await fetcher(
              "https://api.nvcf.nvidia.com/v2/nvcf/pexec/status/" + id,
              { headers: { Authorization: "Bearer " + apiKey }, signal },
            );
          } while (r.status === 202);
        }
        if (!r.ok)
          throw new AiError(
            r.status === 429 ? "rate_limited" : "provider_error",
            "Clay’s writing service is busy. Please try again shortly.",
          );
        const data = await readResponse(r),
          choice = data.choices?.[0];
        if (choice?.finish_reason === "length")
          throw new AiError(
            "output_limit",
            "The design response was cut short.",
          );
        const content = choice?.message?.content;
        if (typeof content !== "string" || !content.trim())
          throw new AiError(
            "empty_output",
            "The writing service returned an incomplete response.",
          );
        try {
          return JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, ""));
        } catch {
          throw new AiError(
            "invalid_json",
            "The writing service returned an incomplete design.",
          );
        }
      } catch (e) {
        last =
          e instanceof AiError
            ? e
            : new AiError(
                e?.name === "TimeoutError" || e?.name === "AbortError"
                  ? "provider_timeout"
                  : "provider_connection",
                "Clay’s writing service could not respond in time.",
              );
      }
    }
    throw (
      last ||
      new AiError(
        "provider_timeout",
        "Clay’s writing service could not respond in time.",
      )
    );
  };
}

import { planEdit } from "./edit.js";
import { createAiClient, AiError } from "./ai.js";
import {
  compilePlan,
  planSchema,
  requirementsFromBrief,
  checkRequirements,
} from "./generation.js";
import { resolveImages } from "./media.js";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { validate, applyOperations, exportFiles } from "./model.js";
const env = (k: string) => Deno.env.get(k) || "";
const admin = createClient(
  env("SUPABASE_URL"),
  env("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false } },
);
const origins = () =>
  env("CLAY_ORIGINS")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
const cors = (origin: string) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  Vary: "Origin",
});
const reply = (body: unknown, origin: string, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors(origin),
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
class Friendly extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}
async function db(result: any) {
  const { data, error } = await result;
  if (error)
    throw new Friendly(
      "Your changes could not be saved. Please try again.",
      503,
    );
  return data;
}
async function limit(key: string, max: number, seconds: number) {
  const allowed = await db(
    admin.rpc("consume_limit", { p_key: key, p_max: max, p_seconds: seconds }),
  );
  if (!allowed)
    throw new Friendly("Please wait a moment before trying again.", 429);
}
async function hash(s: string) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(s),
  );
  return [...new Uint8Array(bytes)]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
async function ai(
  system: string,
  input: unknown,
  maxTokens = 3200,
  options: any = {},
) {
  const client = createAiClient({
    apiKey: env("NVIDIA_API_KEY"),
    model: env("NVIDIA_MODEL") || "nvidia/nemotron-3.5-lightning-30b-a3b",
    fallbackModel:
      env("NVIDIA_FALLBACK_MODEL") ||
      env("NVIDIA_MODEL") ||
      "nvidia/nemotron-3.5-lightning-30b-a3b",
    ...options,
  });
  return client(system, input, maxTokens);
}
async function design(brief: any, onStage: any = async () => {}) {
  let attempts = 0;
  const start = Date.now(),
    options = {
      onAttempt: async () => onStage("designing", { attempts: ++attempts }),
    };
  const requirements = requirementsFromBrief(brief);
  const prompt =
    "Design a complete bespoke website for this small business. Respect the description and answers exactly. " +
    planSchema +
    " Mandatory constraints: " +
    JSON.stringify(requirements) +
    ". Section counts apply to the entire website, not each page. Do not add extra hero sections to exceed the requested count.";
  const r = await ai(prompt, brief, 3600, options);
  await onStage("preparing");
  let model;
  try {
    model = checkRequirements(compilePlan(r.plan), requirements);
  } catch (error) {
    const remaining = 105000 - (Date.now() - start);
    if (remaining < 10000)
      throw new AiError(
        "invalid_design",
        "The design needs another attempt. Your answers are saved.",
      );
    const corrected = await ai(
      prompt +
        " Correct the structural problem in this plan without changing the user's requirements.",
      {
        ...brief,
        plan: r.plan,
        problem: error instanceof Error ? error.message : "Invalid structure",
      },
      3600,
      { ...options, totalMs: remaining },
    );
    model = checkRequirements(compilePlan(corrected.plan), requirements);
  }
  await onStage("photos");
  const warnings: string[] = [];
  await resolveImages(model, fetch, { strict: false, warnings });
  validate(model);
  return { model, warnings };
}
const jobFields =
  "id,status,website_id,message,stage,warnings,attempts,created_at,updated_at";
async function gh(
  path: string,
  method = "GET",
  body?: unknown,
  allow404 = false,
) {
  if (!env("GITHUB_TOKEN"))
    throw new Friendly("Publishing has not been connected yet.", 503);
  const r = await fetch("https://api.github.com" + path, {
    method,
    headers: {
      Authorization: "Bearer " + env("GITHUB_TOKEN"),
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "Clay-Website-Builder",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (r.status === 404 && allow404) return null;
  if (!r.ok) {
    console.error("GitHub operation failed", method, path, r.status);
    throw new Friendly(
      "Publishing could not finish. Your last live website is safe. Please try again.",
      502,
    );
  }
  return r.status === 204 ? {} : r.json();
}
async function owned(id: string, userId: string) {
  const row = await db(
    admin
      .from("websites")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle(),
  );
  if (!row) throw new Friendly("This website is not available.", 404);
  return row;
}

// Every site owns a disjoint directory. A commit never changes Clay's source or other sites.
async function publish(site: any, remove = false) {
  if (!remove) validate(site.model);
  const lock = await db(
    admin
      .from("websites")
      .update({ status: "publishing" })
      .eq("id", site.id)
      .neq("status", "publishing")
      .select("id"),
  );
  if (!lock.length)
    throw new Friendly(
      "Your website is already publishing. Check its status in a moment.",
      409,
    );
  try {
    const repo = env("GITHUB_REPOSITORY") || "Clay",
      path = "/repos/" + env("GITHUB_OWNER") + "/" + repo;
    const repository = await gh(path),
      branch = repository.default_branch;
    const ref = await gh(path + "/git/ref/heads/" + branch);
    const head = await gh(path + "/git/commits/" + ref.object.sha);
    const existing = await gh(
      path + "/git/trees/" + head.tree.sha + "?recursive=1",
    );
    if (existing.truncated)
      throw new Friendly(
        "Publishing needs maintenance. Please contact Clay support.",
        503,
      );
    const prefix = "published/" + site.id + "/";
    const files = remove
      ? {}
      : exportFiles(site.model, {
          endpoint: env("SUPABASE_URL") + "/functions/v1/clay",
          siteId: site.id,
          publicKey: env("CLAY_PUBLIC_KEY"),
        });
    const entries: any[] = Object.entries(files).map(([name, content]) => ({
      path: prefix + name,
      mode: "100644",
      type: "blob",
      content,
    }));
    for (const f of existing.tree) {
      if (
        f.type === "blob" &&
        f.path.startsWith(prefix) &&
        !Object.hasOwn(files, f.path.slice(prefix.length))
      )
        entries.push({ path: f.path, mode: "100644", type: "blob", sha: null });
    }
    if (remove && !entries.length) {
      const updated = await db(
        admin
          .from("websites")
          .update({ live_url: null, published_revision: null, status: "draft" })
          .eq("id", site.id)
          .select("*")
          .single(),
      );
      return { status: "draft", site: updated };
    }
    const tree = await gh(path + "/git/trees", "POST", {
      base_tree: head.tree.sha,
      tree: entries,
    });
    const commit = await gh(path + "/git/commits", "POST", {
      message:
        (remove ? "Unpublish" : "Publish") +
        " website " +
        site.id +
        " revision " +
        site.revision,
      tree: tree.sha,
      parents: [ref.object.sha],
    });
    const previous = await db(
      admin
        .from("publications")
        .select("*")
        .eq("website_id", site.id)
        .maybeSingle(),
    );
    await db(
      admin.from("publications").upsert({
        website_id: site.id,
        repo,
        commit_sha: commit.sha,
        pending_revision: remove ? -1 : site.revision,
        pending_model: remove ? null : site.model,
        last_good_sha: previous?.last_good_sha || null,
        started_at: new Date().toISOString(),
      }),
    );
    await gh(path + "/git/refs/heads/" + branch, "PATCH", {
      sha: commit.sha,
      force: false,
    });
    return { status: "publishing" };
  } catch (error) {
    await admin.from("websites").update({ status: "failed" }).eq("id", site.id);
    throw error;
  }
}
async function publishStatus(site: any) {
  const pub = await db(
    admin
      .from("publications")
      .select("*")
      .eq("website_id", site.id)
      .maybeSingle(),
  );
  if (!pub || site.status !== "publishing")
    return { status: site.status, site };
  const path = "/repos/" + env("GITHUB_OWNER") + "/" + pub.repo;
  const [pages, runs] = await Promise.all([
    gh(path + "/pages"),
    gh(path + "/actions/runs?head_sha=" + pub.commit_sha),
  ]);
  const run = runs.workflow_runs.find(
    (r: any) => r.name === "Publish Clay" && r.head_sha === pub.commit_sha,
  );
  if (run?.status === "completed" && run.conclusion === "success") {
    let updated;
    if (pub.pending_revision === -1)
      updated = await db(
        admin
          .from("websites")
          .update({ live_url: null, published_revision: null, status: "draft" })
          .eq("id", site.id)
          .select("*")
          .single(),
      );
    else {
      const base = pages.html_url.endsWith("/")
        ? pages.html_url
        : pages.html_url + "/";
      const liveUrl = new URL("sites/" + site.id + "/", base).href;
      updated = await db(
        admin.rpc("finish_publish", {
          p_id: site.id,
          p_url: liveUrl,
          p_revision: pub.pending_revision,
        }),
      );
    }
    await db(
      admin
        .from("publications")
        .update({ last_good_sha: pub.commit_sha, pending_model: null })
        .eq("website_id", site.id),
    );
    return { status: updated.status, site: updated };
  }
  if (
    (run?.status === "completed" && run.conclusion !== "success") ||
    Date.now() - Date.parse(pub.started_at) > 15 * 60000
  ) {
    // Pages swaps deployments only after a successful workflow. Never force-reset a shared branch.
    const updated = await db(
      admin
        .from("websites")
        .update({ status: "failed" })
        .eq("id", site.id)
        .select("*")
        .single(),
    );
    return { status: "failed", site: updated };
  }
  return { status: "publishing", site };
}
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== "POST")
    return reply({ error: "This action is not available." }, origin, 405);
  try {
    const raw = await req.text();
    if (raw.length > 550000)
      throw new Friendly("This request is too large.", 413);
    let b: any;
    try {
      b = JSON.parse(raw);
    } catch {
      throw new Friendly("Please try that request again.");
    }
    if (["contact", "visit"].includes(b.type)) {
      if (!/^[a-f0-9-]{36}$/i.test(b.siteId || ""))
        throw new Friendly("This website is unavailable.", 404);
      const site = await db(
        admin
          .from("websites")
          .select("id,live_url")
          .eq("id", b.siteId)
          .maybeSingle(),
      );
      if (!site?.live_url || origin !== new URL(site.live_url).origin)
        throw new Friendly("This website is unavailable.", 403);
      const ip =
        req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
      await limit(
        "public:" + b.type + ":" + site.id + ":" + (await hash(ip)),
        b.type === "contact" ? 6 : 180,
        3600,
      );
      if (b.type === "contact") {
        if (b.website) return reply({ ok: true }, origin);
        if (
          typeof b.name !== "string" ||
          !b.name.trim() ||
          b.name.length > 150 ||
          typeof b.email !== "string" ||
          !/^\S+@\S+\.\S+$/.test(b.email) ||
          b.email.length > 250 ||
          typeof b.message !== "string" ||
          !b.message.trim() ||
          b.message.length > 5000
        )
          throw new Friendly("Please check your name, email, and message.");
        await db(
          admin.from("submissions").insert({
            website_id: site.id,
            name: b.name.trim(),
            email: b.email.trim(),
            message: b.message.trim(),
          }),
        );
        return reply({ ok: true }, origin);
      }
      if (
        !/^[a-f0-9-]{36}$/i.test(b.visitor || "") ||
        !/^[a-f0-9-]{36}$/i.test(b.eventId || "") ||
        typeof b.path !== "string" ||
        b.path.length > 500 ||
        !Number.isInteger(b.seconds) ||
        b.seconds < 0 ||
        b.seconds > 1800
      )
        throw new Friendly("Invalid visit.");
      const old = await db(
        admin
          .from("visits")
          .select("website_id,visitor,seconds")
          .eq("id", b.eventId)
          .maybeSingle(),
      );
      if (old) {
        if (old.website_id !== site.id || old.visitor !== b.visitor)
          throw new Friendly("Invalid visit.", 403);
        await db(
          admin
            .from("visits")
            .update({ seconds: Math.max(old.seconds, b.seconds) })
            .eq("id", b.eventId)
            .eq("website_id", site.id),
        );
      } else
        await db(
          admin.from("visits").insert({
            id: b.eventId,
            website_id: site.id,
            visitor: b.visitor,
            path: b.path,
            seconds: b.seconds,
            country: null,
          }),
        );
      return reply({ ok: true }, origin);
    }
    if (!origins().includes(origin))
      throw new Friendly("Please open Clay from its own web address.", 403);
    const token = req.headers.get("authorization")?.replace(/^Bearer /i, "");
    if (!token) throw new Friendly("Please sign in to continue.", 401);
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user) throw new Friendly("Please sign in again.", 401);
    const user = data.user;
    if (b.type !== "generation_status")
      await limit("user:" + user.id, 120, 3600);
    if (["questions", "generate", "edit"].includes(b.type))
      await limit("ai:" + user.id, 25, 3600);
    if (b.type === "questions") {
      if (
        typeof b.description !== "string" ||
        b.description.length < 5 ||
        b.description.length > 5000
      )
        throw new Friendly("Tell Clay a little more about your business.");
      const result = await ai(
        "You are Clay, a thoughtful website designer for a nontechnical small-business owner. Ask 2–5 short, personalized questions only about details that materially affect this website. Do not ask facts already supplied or technical questions. Include desired outcome, content/sections to exclude, and visual taste if not specified. Return {questions:[{question,options?:[short suggestions]}]}. If all needed information is supplied return an empty questions list.",
        { description: b.description },
        1600,
      );
      if (!Array.isArray(result.questions) || result.questions.length > 5)
        throw new Friendly(
          "Clay could not prepare your questions. Please try again.",
        );
      return reply(result, origin);
    }
    if (b.type === "generation_status") {
      let query = admin
        .from("generation_jobs")
        .select(jobFields)
        .eq("user_id", user.id);
      if (b.jobId) query = query.eq("id", String(b.jobId));
      let job = await db(
        query.order("created_at", { ascending: false }).limit(1).maybeSingle(),
      );
      if (
        job?.status === "running" &&
        Date.now() - Date.parse(job.created_at) > 180000
      ) {
        const updated = await db(
          admin
            .from("generation_jobs")
            .update({
              status: "failed",
              stage: "failed",
              error_code: "worker_expired",
              message:
                "Clay took too long to finish. Your answers are saved; please try again.",
              updated_at: new Date().toISOString(),
            })
            .eq("id", job.id)
            .eq("status", "running")
            .select(jobFields)
            .maybeSingle(),
        );
        if (updated) job = updated;
        else
          job = await db(
            admin
              .from("generation_jobs")
              .select(jobFields)
              .eq("id", job.id)
              .eq("user_id", user.id)
              .single(),
          );
      }
      const savedBrief =
        b.includeBrief && job
          ? await db(
              admin
                .from("generation_jobs")
                .select("brief")
                .eq("id", job.id)
                .eq("user_id", user.id)
                .single(),
            )
          : null;
      return reply(
        {
          job,
          brief: savedBrief?.brief || null,
          site:
            job?.status === "complete" && job.website_id
              ? await owned(job.website_id, user.id)
              : null,
        },
        origin,
      );
    }
    if (b.type === "generation_start") {
      if (
        typeof b.description !== "string" ||
        b.description.length < 5 ||
        b.description.length > 5000 ||
        !Array.isArray(b.answers) ||
        b.answers.length > 5 ||
        JSON.stringify(b.answers).length > 20000
      )
        throw new Friendly("Please complete your business description.");
      const existing = await db(
        admin
          .from("websites")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle(),
      );
      if (existing)
        throw new Friendly(
          "Your account already has a website. Open it from Home.",
          409,
        );
      await db(
        admin
          .from("generation_jobs")
          .update({
            status: "failed",
            stage: "failed",
            error_code: "worker_expired",
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", user.id)
          .eq("status", "running")
          .lt("created_at", new Date(Date.now() - 180000).toISOString()),
      );
      const active = await db(
        admin
          .from("generation_jobs")
          .select(jobFields)
          .eq("user_id", user.id)
          .eq("status", "running")
          .maybeSingle(),
      );
      if (active) return reply({ job: active }, origin);
      await limit("ai:" + user.id, 25, 3600);
      const brief = { description: b.description, answers: b.answers };
      const created = await admin
        .from("generation_jobs")
        .insert({ user_id: user.id, brief, stage: "designing" })
        .select(jobFields)
        .single();
      if (created.error?.code === "23505")
        return reply(
          {
            job: await db(
              admin
                .from("generation_jobs")
                .select(jobFields)
                .eq("user_id", user.id)
                .eq("status", "running")
                .single(),
            ),
          },
          origin,
        );
      const job = await db(created);
      const work = async () => {
        let stage = "designing";
        try {
          const result = await design(
            brief,
            async (next: string, details: any = {}) => {
              stage = next;
              await db(
                admin
                  .from("generation_jobs")
                  .update({
                    stage,
                    ...details,
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", job.id)
                  .eq("status", "running"),
              );
            },
          );
          stage = "saving";
          await db(
            admin
              .from("generation_jobs")
              .update({
                stage,
                warnings: result.warnings,
                updated_at: new Date().toISOString(),
              })
              .eq("id", job.id)
              .eq("status", "running"),
          );
          await db(
            admin.rpc("finish_generation", {
              p_job: job.id,
              p_model: result.model,
            }),
          );
        } catch (error) {
          const code =
            error instanceof AiError
              ? error.code
              : stage === "saving"
                ? "save_failed"
                : "invalid_design";
          console.error(
            "Generation failed",
            JSON.stringify({ job: job.id, stage, code }),
          );
          const message =
            error instanceof AiError
              ? error.message
              : stage === "saving"
                ? "Your design could not be saved. Your answers are still here; please retry."
                : "The design could not be completed. Your answers are saved; please try again.";
          await admin
            .from("generation_jobs")
            .update({
              status: "failed",
              stage: "failed",
              error_code: code,
              message,
              updated_at: new Date().toISOString(),
            })
            .eq("id", job.id)
            .eq("status", "running");
        }
      };
      EdgeRuntime.waitUntil(work());
      return reply({ job }, origin);
    }
    if (b.type === "generate") {
      if (
        typeof b.description !== "string" ||
        b.description.length < 5 ||
        b.description.length > 5000 ||
        !Array.isArray(b.answers) ||
        b.answers.length > 5 ||
        JSON.stringify(b.answers).length > 20000
      )
        throw new Friendly("Please complete your business description.");
      return reply(
        await design({ description: b.description, answers: b.answers }),
        origin,
      );
    }
    const site = await owned(b.siteId, user.id);
    if (b.type === "edit") {
      if (typeof b.prompt !== "string" || b.prompt.length > 4000)
        throw new Friendly("Please describe the change you want.");
      let r;
      try {
        r = await planEdit({
          ai,
          model: site.model,
          prompt: b.prompt,
          selected: b.selected,
          pageId: b.pageId,
        });
      } catch (error) {
        if (error instanceof AiError) throw error;
        console.error(
          "Edit validation failed",
          error instanceof Error ? error.message.slice(0, 180) : "unknown",
        );
        throw new Friendly(
          "Clay could not prepare this edit. Your saved website is unchanged. Try one change at a time.",
          422,
        );
      }
      return reply(r, origin);
    }
    if (b.type === "publish") {
      await limit("publish:" + user.id, 10, 3600);
      return reply(await publish(site), origin);
    }
    if (b.type === "publish_status")
      return reply(await publishStatus(site), origin);
    if (b.type === "unpublish") return reply(await publish(site, true), origin);
    throw new Friendly("This action is not available.", 404);
  } catch (e) {
    if (!(e instanceof Friendly))
      console.error(
        "Clay request failed",
        e instanceof Error ? e.name : "unknown",
      );
    return reply(
      {
        error:
          e instanceof Error && /Photo search|No suitable photo/.test(e.message)
            ? e.message
            : e instanceof Error &&
                (e.name === "TimeoutError" || e.name === "AbortError")
              ? "Clay took too long to respond. Your work is safe. Please try again."
              : e instanceof Friendly || e instanceof AiError
                ? e.message
                : "Clay could not finish that change. Please try again.",
      },
      origin,
      e instanceof Friendly ? e.status : e instanceof AiError ? 503 : 500,
    );
  }
});

import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import {
  validate,
  applyOperations,
  exportFiles,
  prepareGeneratedModel,
} from "./model.js";
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
const schema = `Website model: {name,description,email,phone,address,theme:{background:'#rrggbb',text:'#rrggbb',accent:'#rrggbb',font:'Inter'|'Georgia'|'Arial'|'Trebuchet MS',spacing:'comfortable'|'compact'|'spacious'},navigation:[{pageId,label}],content:[{id,name,description,price}],pages:[{id,title,slug,sections:[{id,type:'hero'|'text'|'services'|'gallery'|'products'|'contact'|'testimonials',layout:'split'|'center'|'grid'|'stack',elements:[{id,type:'heading'|'text'|'image'|'button'|'item',text?,src?,alt?,href?,description?,price?}]}]}]}. Use unique string IDs everywhere; home slug is index. Images must be real secure image URLs or empty placeholders with descriptive alt text. Use only known images.unsplash.com URLs when relevant; never invent URLs. Contact sections render a real form automatically. Product sections render content items automatically. Item elements render service cards. Never invent reviews, awards, addresses, statistics, or business claims. Use tasteful contrast (text/background and white/accent at least 4.5:1), meaningful copy, carefully varied layout and section order, no code or HTML. Only include sections relevant to this business. Honor every user exclusion and exact section count. Use at least one heading in each section. Split hero supports imagery. Gallery/grid supports multiple images or items. Use a meaningful CTA and navigation that references existing pages.`;
async function ai(system: string, input: unknown) {
  if (!env("NVIDIA_API_KEY"))
    throw new Friendly("Clay’s writing service is not connected yet.", 503);
  const r = await fetch(
    "https://integrate.api.nvidia.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + env("NVIDIA_API_KEY"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env("NVIDIA_MODEL") || "nvidia/nemotron-3.5-lightning-30b-a3b",
        messages: [
          {
            role: "system",
            content: system + " Return only valid JSON, without markdown.",
          },
          { role: "user", content: JSON.stringify(input) },
        ],
        temperature: 0.4,
        max_tokens: 9000,
        stream: false,
        response_format: { type: "json_object" },
        chat_template_kwargs: { enable_thinking: false },
      }),
      signal: AbortSignal.timeout(110000),
    },
  );
  if (!r.ok)
    throw new Friendly(
      "Clay’s writing service is busy. Please try again shortly.",
      503,
    );
  const j = await r.json();
  try {
    return JSON.parse(
      j.choices[0].message.content.replace(/^```(?:json)?\s*|\s*```$/g, ""),
    );
  } catch {
    throw new Friendly(
      "Clay could not finish that idea. Please try once more.",
      502,
    );
  }
}
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
      admin
        .from("publications")
        .upsert({
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
      );
      if (!Array.isArray(result.questions) || result.questions.length > 5)
        throw new Friendly(
          "Clay could not prepare your questions. Please try again.",
        );
      return reply(result, origin);
    }
    if (b.type === "generate") {
      if (
        typeof b.description !== "string" ||
        b.description.length > 5000 ||
        !Array.isArray(b.answers) ||
        b.answers.length > 5
      )
        throw new Friendly("Please complete your business description.");
      const r = await ai(
        "Create a complete, bespoke website based on this business description and answers. Return {model: WebsiteModel}. " +
          schema,
        { description: b.description, answers: b.answers },
      );
      r.model = prepareGeneratedModel(r.model);
      return reply(r, origin);
    }
    const site = await owned(b.siteId, user.id);
    if (b.type === "edit") {
      if (typeof b.prompt !== "string" || b.prompt.length > 4000)
        throw new Friendly("Please describe the change you want.");
      const r = await ai(
        `You edit websites using precise structured operations. Never replace the whole website for a small change. Attach changes to selected element/section when relevant, unless user requests global changes. If vague or potentially destructive ask one brief question with {question:string}. Otherwise return {summary:string,operations:[...]}. Allowed operations: create_page {value:page}; delete_page {target:pageId}; create_section {pageId,index?,value:section}; delete_section {target:sectionId}; update_section {target:sectionId,value:{layout?,background?}}; move_section {target:sectionId,pageId?,index}; move_element {target:elementId,sectionId,index}; edit_text {target:elementId,value:string}; replace_image {target:elementId,value:{src,alt}}; change_colors {target?:sectionId,value:{background?,text?,accent?}}; change_typography {value:font}; change_spacing {value:spacing}; update_navigation {value:[{pageId,label}]}; create_content {value:{id,name,description,price}}; update_content {target:contentId,value:{name?,description?,price?}}; delete_content {target:contentId}; update_element {target:elementId,value:{text?,href?,description?,price?}}; create_element {target:sectionId,value:element}; delete_element {target:elementId}; update_info {value:{name?,description?,email?,phone?,address?}}; publish_website {} only if explicitly asked to publish. Every operation has a type field. Do not expose any of these technical names to the user. ${schema}`,
        {
          website: site.model,
          pageId: b.pageId,
          selected: b.selected,
          instruction: b.prompt,
        },
      );
      if (r.question)
        return reply({ question: String(r.question).slice(0, 1000) }, origin);
      applyOperations(
        site.model,
        r.operations.filter((o: any) => o.type !== "publish_website"),
      );
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
          e instanceof Friendly
            ? e.message
            : "Clay could not finish that change. Please try again.",
      },
      origin,
      e instanceof Friendly ? e.status : 500,
    );
  }
});

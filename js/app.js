import {
  uid,
  esc,
  clone,
  example,
  newSection,
  locate,
  applyOperations,
  renderDocument,
  exportFiles,
  fonts,
  safeImageUrl,
} from "./model.js";
import * as api from "./api.js";
const $ = (s) => document.querySelector(s),
  app = $("#app"),
  panel = $("#panel");
const state = {
  user: null,
  sites: [],
  site: null,
  page: null,
  selected: null,
  demo: false,
  undo: [],
  redo: [],
  versions: [],
  busy: false,
  preview: false,
  device: "desktop",
  signup: true,
  questions: [],
  answers: [],
  description: "",
  question: 0,
  messages: [],
  view: "",
  profileTab: "profile",
  avatarUrl: "",
};
const icons = {
  arrow: "↗",
  plus: "＋",
  close: "×",
  back: "←",
  undo: "↶",
  redo: "↷",
  desktop: "▱",
  mobile: "▯",
  sun: "☼",
  moon: "◐",
  send: "↑",
};
const icon = (name) => `<span aria-hidden="true">${icons[name] || name}</span>`;
const btn = (action, text, cls = "", extra = "") =>
  `<button data-action="${action}" class="${cls}" ${extra}>${text}</button>`;
const logo = () =>
  '<a class="logo" href="#" aria-label="Clay home"><img src="assets/logo.png" alt="Clay"></a>';
const errorText = (e) =>
  e?.message || "Something went wrong. Please try again.";
function toast(text) {
  $("#toast").textContent = text;
  $("#toast").classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("#toast").classList.remove("show"), 5000);
}
function theme() {
  document.documentElement.dataset.theme =
    localStorage.getItem("clay-theme") || "light";
}
theme();
function header(active = "") {
  state.view = active;
  app.dataset.view = active || "welcome";
  if (active) window.history.replaceState(null, "", "#" + active);
  document.title = active
    ? `${active[0].toUpperCase() + active.slice(1)} · Clay`
    : "Clay — Your business, at home online";
  return `<header class="app-header">${logo()}${state.user || state.demo ? `<nav aria-label="Main navigation">${["Home", "Website", "Profile"].map((n) => btn(n.toLowerCase(), n, active === n.toLowerCase() ? "active" : "", active === n.toLowerCase() ? 'aria-current="page"' : "")).join("")}</nav>` : '<span class="header-note">A little idea. A whole new beginning.</span>'}<div class="header-end">${btn("theme", icon("moon"), "icon-button", 'aria-label="Switch colour theme"')}${state.user ? btn("profile", esc((state.user.user_metadata?.name || state.user.email || "You").slice(0, 1).toUpperCase()), "avatar") : state.demo ? '<span class="demo-label">Example workspace</span>' : btn("login", "Log in", "text-button")}</div></header>`;
}
function landing() {
  state.avatarUrl = "";
  state.demoProfile = null;
  state.description = "";
  state.answers = [];
  state.questions = [];
  state.messages = [];
  state.demo = false;
  state.site = null;
  state.sites = [];
  app.innerHTML =
    header() +
    `<main id="main" class="landing"><section class="welcome"><div class="welcome-copy"><p class="eyebrow">BIG IDEAS START SMALL</p><h1>Your business<br>deserves a<br><em>digital home.</em></h1><p class="lede">Create, customize, and grow your website<br class="desktop-only"> without the technical complexity.</p><div class="landing-ctas">${btn("signup", "Create my website " + icon("arrow"), "primary large")}${btn("demo", "Explore Clay", "outline large")}</div><p class="under-cta">Your ideas. Your website. Entirely yours.</p></div><div class="showcase" aria-label="Example website designs"><div class="orbit-label"><span></span> A space for every kind of business</div><div class="sample-window"><div class="browser-bar"><i></i><i></i><i></i><span>Made with Clay</span></div><div class="sample-interior"><div class="sample-nav"><b>forma<span>®</span></b><span>Our story &nbsp; Collection &nbsp; Contact</span></div><div class="sample-hero"><div><p class="small-caps">THOUGHTFULLY MADE</p><h2>Less, but<br>with meaning.</h2><p>Honest materials. Quiet details.<br>Furniture for a life well lived.</p><span class="sample-button">Discover the collection ↗</span></div><img src="https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&w=900&q=85" alt="Natural wood shelving in a thoughtfully designed interior"></div><div class="sample-bottom">Made slowly. &nbsp; Loved for a lifetime. <span>01 — 03</span></div></div></div><div class="floating-sample"><div class="floral-photo"></div><div><span class="small-caps">THE EVERYDAY, IN BLOOM</span><h3>Wild & wonderful.</h3><span>Flowers with a little more feeling.</span></div></div><div class="made-note">Built around you, by Clay.</div><div class="showcase-dots" aria-label="Example websites">${["Furniture", "Flowers", "Photography"].map((name, i) => btn("showcase", `<span class="sr-only">${name} example</span>`, i === 0 ? "active" : "", `data-index="${i}" aria-pressed="${i === 0}"`)).join("")}</div></div></section><section class="landing-bottom"><div><span class="step-no">01</span><h2>Tell us your story.</h2><p>You know your business.<br>That’s all you need to bring.</p></div><div><span class="step-no">02</span><h2>Make it your own.</h2><p>Ask for a change or make it yourself.<br>Every detail is in your hands.</p></div><div><span class="step-no">03</span><h2>Open your doors.</h2><p>One place to create, publish,<br>and grow your presence.</p></div><div class="try-editor">Curious how it feels?${btn("demo", "Explore the editor " + icon("arrow"), "text-button")}</div></section></main><footer class="landing-footer"><span>Built for real people. And their businesses.</span><span>Meet your next chapter.</span></footer>`;
}
function auth(signup = true) {
  state.signup = signup;
  app.innerHTML =
    header() +
    `<main id="main" class="auth-layout"><div class="auth-art"><p class="eyebrow">YOUR NEXT CHAPTER</p><h1>Something great<br>is taking shape.</h1><div class="auth-example"><div class="browser-bar"><i></i><i></i><i></i><span>A website made with Clay</span></div><img src="https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&w=900&q=85" alt="Interior design website inspiration"><div><span class="small-caps">FORMA — FURNITURE STUDIO</span><h2>Less, but with meaning.</h2></div></div><p>A home for your business.<br>A little more room to grow.</p></div><section class="auth-form">${logo()}<h1>${signup ? "Let’s make it yours." : "Welcome home."}</h1><p>${signup ? "Your business has a story. Let’s give it a home." : "Pick up right where you left off."}</p>${btn("google", '<span class="google-g" aria-hidden="true">G</span>Continue with Google', "outline full")}<div class="divider"><span>or</span></div><form id="email-form"><label for="email">Email address</label><input id="email" type="email" name="email" autocomplete="email" placeholder="you@yourbusiness.com" required><button class="primary full">Continue with email ${icon("arrow")}</button></form><p id="auth-status" role="status" class="form-status"></p><p class="auth-switch">${signup ? "Already have an account?" : "New to Clay?"} ${btn(signup ? "login" : "signup", signup ? "Log in" : "Create an account", "text-button")}</p><small>We’ll send you a secure sign-in link.<br>No password to remember.</small></section></main>`;
  $("#email-form").onsubmit = async (e) => {
    e.preventDefault();
    await busy(e.submitter, async () => {
      await api.login("email", new FormData(e.target).get("email"), signup);
      $("#auth-status").textContent =
        "Check your inbox for your secure sign-in link.";
    });
  };
}
function home() {
  state.preview = false;
  app.innerHTML =
    header("home") +
    `<main id="main" class="home overview-home"><div class="overview-heading"><div><h1>Good ${new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}!</h1><p>Let’s get your business online.</p></div>${btn("new-website", "＋ New website", "primary", state.sites.length ? 'disabled aria-describedby="website-limit"' : "")}</div><section class="overview-shortcuts" aria-label="Website shortcuts">${[
      ["business", "Business info", "store"],
      ["design", "Design style", "palette"],
      ["content", "Content", "document"],
      ["publish", "Publish", "launch"],
    ]
      .map(([action, label, graphic]) =>
        btn(
          "home-tool",
          uiIcon(graphic) + `<span>${label}</span>`,
          `overview-shortcut shortcut-${action}`,
          `data-tool="${action}"`,
        ),
      )
      .join(
        "",
      )}</section><div class="overview-columns"><section class="website-overview" aria-labelledby="overview-site-title">${websiteThumbnail(state.sites[0])}<div class="website-overview-details"><h2 id="overview-site-title">Your website</h2>${state.sites.length ? `<h3>${esc(state.sites[0].model.name)}</h3><p class="website-status"><i aria-hidden="true"></i>${statusLabel(state.sites[0])}</p><p class="overview-edited">Edited ${new Date(state.sites[0].updated_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</p>${btn("website", "Edit website", "primary")}` : `<p>A home for your next big idea.</p><p class="muted">Create your website, then return here to keep it growing.</p>${btn("new-website", "Create my website", "primary")}`}</div></section><aside class="quick-links" aria-labelledby="quick-links-title"><h2 id="quick-links-title">Quick links</h2>${[
      ["help", "Help center", "book"],
      ["tutorial", "Video tutorials", "play"],
      ["community", "Community", "people"],
      ["support", "Contact support", "message"],
    ]
      .map(([action, label, graphic]) =>
        btn(action, uiIcon(graphic) + `<span>${label}</span>`, "quick-link"),
      )
      .join(
        "",
      )}</aside></div><p id="website-limit" class="overview-limit">Your account includes one website, with all features.${state.sites.length ? " Edit your current website to keep shaping it." : ""}</p></main>`;
}
function uiIcon(name) {
  const shapes = {
    store:
      '<path d="M3 10h18l-2-6H5l-2 6Zm2 0v10h14V10M9 20v-6h6v6M3 10c0 4 4 4 4 0 0 4 5 4 5 0 0 4 5 4 5 0 0 4 4 4 4 0"/>',
    palette:
      '<path d="M12 3a9 9 0 0 0 0 18h2a2 2 0 0 0 1-4c-1-1 0-2 1-2h2c6 0 4-12-6-12Z"/><circle cx="7" cy="10" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7" r="1"/><circle cx="18" cy="10" r="1"/>',
    document: '<path d="M6 3h8l4 4v14H6V3Zm8 0v5h4M9 12h6M9 16h6"/>',
    launch:
      '<path d="m14 5 5-2 2 2-2 5-7 7-5-5 7-7ZM7 12H3l3-5h5M12 17v4l5-3v-5M4 20l4-4M16 8h.01"/>',
    book: '<path d="M3 4h7l2 2 2-2h7v15h-7l-2 2-2-2H3V4Zm9 2v15"/>',
    play: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="m10 8 6 4-6 4V8Z"/>',
    people:
      '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 5v2"/>',
    message: '<path d="M4 4h16v12H9l-5 4V4Z"/>',
    person:
      '<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
    settings:
      '<path d="m9 3-1 3-3 1-2 5 2 5 3 1 1 3h6l1-3 3-1 2-5-2-5-3-1-1-3H9Z"/><circle cx="12" cy="12" r="3"/>',
    shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3ZM12 7v9"/>',
  };
  return `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes[name] || shapes.document}</svg>`;
}
function websiteThumbnail(site) {
  if (!site)
    return '<div class="overview-preview empty-preview" aria-label="Your future website preview"><div class="preview-browser"><i></i><i></i><i></i></div><span>Your digital home<br>starts here.</span><div class="preview-placeholder"></div></div>';
  const elements = site.model.pages[0].sections.flatMap((x) => x.elements),
    image = elements.find((e) => e.type === "image" && safeImageUrl(e.src));
  return `<div class="overview-preview" aria-label="Small preview of ${esc(site.model.name)}" style="background:${site.model.theme.background};color:${site.model.theme.text}"><div class="preview-browser"><i></i><i></i><i></i></div><b>${esc(site.model.name)}</b><span>${esc(elements.find((e) => e.type === "heading")?.text || site.model.name)}</span>${image ? `<img src="${esc(safeImageUrl(image.src))}" alt="${esc(image.alt || "Website preview")}">` : '<div class="preview-placeholder"></div>'}</div>`;
}
function createWebsite() {
  if (state.sites.length) return website();
  try {
    const saved = JSON.parse(
      sessionStorage.getItem("clay-brief-" + state.user?.id) || "null",
    );
    if (saved) {
      state.description = saved.description;
      state.answers = saved.answers;
    }
  } catch {}
  app.innerHTML =
    header("website") +
    `<main id="main" class="question-view creation-view"><p class="eyebrow">LET’S MAKE SOMETHING THAT’S YOURS</p><h1>Tell us about your business.</h1><p>Start with what you do. We’ll take it from there.</p><form id="business-form" class="prompt-box"><label class="sr-only" for="business">Describe your business</label><textarea id="business" maxlength="5000" placeholder="I run a small business called…" required></textarea><div><span>A few words are all it takes.</span><button class="send" aria-label="Start creating">${icon("send")}</button></div></form><div class="recovery-actions">${btn("blank-site", "Start manually", "outline")}${state.description ? btn("resume-generation", "Resume website creation", "text-button") : ""}</div><p class="plan-note">Your account includes one website, with all features.</p></main>`;
  $("#business").value = state.description;
  const briefOwner = state.user?.id;
  if (briefOwner && !state.description)
    (async () => {
      const recovered = await api.invoke("generation_status", {
        includeBrief: true,
      });
      if (
        state.user?.id !== briefOwner ||
        !$("#business") ||
        $("#business").value.trim() ||
        !recovered.brief ||
        recovered.job?.status === "complete"
      )
        return;
      state.description = recovered.brief.description;
      state.answers = recovered.brief.answers || [];
      $("#business").value = state.description;
      saveBrief();
      if (!$("[data-action=resume-generation]"))
        $(".recovery-actions").insertAdjacentHTML(
          "beforeend",
          btn("resume-generation", "Resume website creation", "text-button"),
        );
    })().catch(() => {});
  $("#business-form").onsubmit = async (e) => {
    e.preventDefault();
    state.description = $("#business").value;
    saveBrief();
    await busy(e.submitter, async () => {
      const result = await api.invoke("questions", {
        description: state.description,
      });
      state.questions = (result.questions || []).slice(0, 5);
      state.answers = [];
      state.question = 0;
      if (state.questions.length) question();
      else await generate();
    });
  };
}
function website() {
  const site = state.sites[0];
  if (!site) {
    createWebsite();
    return;
  }
  if (!state.site || state.site.id !== site.id) openSite(site);
  else workspace();
}
function siteList() {
  return state.sites.length
    ? state.sites
        .map(
          (s) =>
            `<button class="site-row" data-action="open-site" data-id="${s.id}"><div class="mini-preview" style="--mini-bg:${s.model.theme.background};--mini-color:${s.model.theme.text}"><b>${esc(s.model.name)}</b><span>${esc(s.model.pages[0].sections.flatMap((x) => x.elements).find((e) => e.type === "heading")?.text || "Your website")}</span><i></i></div><div><h3>${esc(s.model.name)}</h3><p>${statusLabel(s)}</p><small>Edited ${new Date(s.updated_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</small></div><span class="site-open">Open website ↗</span></button>`,
        )
        .join("")
    : '<div class="empty"><span>＋</span><h3>Your story starts here.</h3><p>Describe your business above to create your first website.</p></div>';
}
function question() {
  const q = state.questions[state.question];
  app.innerHTML =
    header("website") +
    `<main id="main" class="question-view"><p class="eyebrow">A LITTLE MORE ABOUT YOU</p><span class="question-count">${state.question + 1} of ${state.questions.length}</span><h1>${esc(q.question || q)}</h1><form id="answer-form"><label class="sr-only" for="answer">Your answer</label><textarea id="answer" placeholder="Tell us in your own words…" maxlength="3000" required></textarea>${q.options?.length ? `<div class="answer-options">${q.options.map((o) => btn("answer-option", esc(o), "chip", `data-value="${esc(o)}"`)).join("")}</div>` : ""}<div class="question-footer">${state.question ? btn("previous-question", "← Back", "text-button") : "<span>Only the details that matter.</span>"}<button class="primary">${state.question === state.questions.length - 1 ? "Let’s build it" : "Continue"} ${icon("arrow")}</button></div></form></main>`;
  $("#answer").value = state.answers[state.question]?.answer || "";
  $("#answer-form").onsubmit = async (e) => {
    e.preventDefault();
    state.answers[state.question] = {
      question: q.question || q,
      answer: $("#answer").value,
    };
    state.question++;
    if (state.question < state.questions.length) question();
    else await busy(e.submitter, generate);
  };
}
function saveBrief() {
  if (state.user)
    sessionStorage.setItem(
      "clay-brief-" + state.user.id,
      JSON.stringify({
        description: state.description,
        answers: state.answers,
      }),
    );
}
function generationFailure(message) {
  app.innerHTML =
    header("website") +
    '<main id="main" class="question-view"><p class="eyebrow">YOUR IDEAS ARE SAFE</p><h1>Let’s pick up from here.</h1><p>' +
    esc(message) +
    '</p><div class="recovery-actions">' +
    btn("retry-generation", "Try again", "primary") +
    btn("blank-site", "Start with a blank website", "outline") +
    btn("home", "Back to Home", "text-button") +
    "</div></main>";
}
async function generate(resume = false) {
  saveBrief();
  const owner = state.user?.id,
    key = "clay-job-" + owner;
  let jobId = sessionStorage.getItem(key),
    pollFailures = 0;
  app.innerHTML =
    header("website") +
    '<main id="main" class="generation"><span class="progress-line" aria-hidden="true"></span><h1>I’ve got everything I need.<br>Let’s build it.</h1><p>Finding the right words, colours, and a space that feels like you.</p><div class="building-preview"><div></div><div></div><div></div></div><p role="status" id="generation-status">Designing your pages and writing your content.</p>' +
    btn("home", "Back to Home", "text-button") +
    "</main>";
  try {
    if (resume) {
      const current = await api.invoke("generation_status", { jobId });
      if (!current.job || current.job.status === "failed") resume = false;
    }
    if (!resume) {
      const started = await api.invoke("generation_start", {
        description: state.description,
        answers: state.answers,
      });
      jobId = started.job.id;
      sessionStorage.setItem(key, jobId);
    }
    for (let i = 0; i < 100; i++) {
      if (state.user?.id !== owner) return;
      let r;
      try {
        r = await api.invoke("generation_status", { jobId });
        pollFailures = 0;
      } catch (error) {
        if (++pollFailures > 5) throw error;
        if ($("#generation-status"))
          $("#generation-status").textContent =
            "Reconnecting to your website. Your design is still being prepared.";
        await new Promise((resolve) => setTimeout(resolve, 2500));
        continue;
      }
      if (r.site) {
        state.sites = [r.site];
        sessionStorage.removeItem("clay-brief-" + owner);
        sessionStorage.removeItem(key);
        if ($("#generation-status")) {
          openSite(r.site, true);
          if (r.job?.warnings?.length) toast(r.job.warnings[0]);
        }
        return;
      }
      if (!r.job || r.job.status === "failed")
        throw Error(
          r.job?.message || "Please try creating your website again.",
        );
      if (!$("#generation-status")) return;
      $("#generation-status").textContent =
        {
          designing: "Designing your pages and writing your content.",
          preparing: "Arranging your website.",
          photos: "Finding the right photos.",
          saving: "Saving your website.",
        }[r.job.stage] || "Your website is taking shape.";
      await new Promise((resolve) => setTimeout(resolve, 2500));
    }
    throw Error(
      "This is taking longer than expected. Your answers are saved; return here to resume.",
    );
  } catch (error) {
    if (state.user?.id === owner && $("#generation-status"))
      generationFailure(errorText(error));
  }
}
async function blankSite() {
  if (state.sites.length) return openSite(state.sites[0]);
  const id = uid(),
    section = uid();
  const model = {
    name: "My business",
    description: state.description || "",
    email: "",
    phone: "",
    address: "",
    theme: {
      background: "#f7f5f0",
      text: "#202a32",
      accent: "#344c5e",
      font: "Inter",
      spacing: "comfortable",
    },
    navigation: [{ pageId: id, label: "Home" }],
    content: [],
    pages: [
      {
        id,
        title: "Home",
        slug: "index",
        sections: [
          {
            id: section,
            type: "hero",
            layout: "center",
            elements: [
              { id: uid(), type: "heading", text: "A home for your business." },
              {
                id: uid(),
                type: "text",
                text: "Select this text to tell your story, or ask Clay for a change.",
              },
            ],
          },
        ],
      },
    ],
  };
  const site = await api.createSite(model);
  state.sites = [site];
  openSite(site);
}
function statusLabel(s = state.site) {
  if (state.demo) return "Example · changes stay in this session";
  return (
    {
      draft: "Draft",
      published: "Live",
      changed: "Changes ready to publish",
      publishing: "Publishing",
      failed: "Publishing failed",
    }[s.status] || "Draft"
  );
}
function openSite(site, progressive = false) {
  state.site = clone(site);
  state.page = site.model.pages[0].id;
  state.selected = null;
  state.undo = [];
  state.redo = [];
  state.messages = [];
  workspace(progressive);
}
function workspace(progressive = false) {
  if (!state.site) {
    website();
    return;
  }
  const m = state.site.model;
  app.innerHTML =
    header("website") +
    `<main id="main" class="workspace ${state.preview ? "previewing" : ""}"><div class="workspace-bar"><div class="website-title">${btn("pages", esc(m.name) + " <span>⌄</span>", "text-button")}<span id="save-status" role="status" aria-live="polite">${statusLabel()}</span></div><div class="device-controls" aria-label="Preview size">${btn("desktop", icon("desktop"), "icon-button " + (state.device === "desktop" ? "active" : ""), 'aria-label="Desktop preview"')}${btn("mobile", icon("mobile"), "icon-button " + (state.device === "mobile" ? "active" : ""), 'aria-label="Mobile preview"')}</div><div class="workspace-actions">${btn("history", "Previous versions", "text-button")}${btn("preview", state.preview ? "Back to editing" : "Preview", "outline")}${btn("publish", "Publish " + icon("arrow"), "primary")}</div></div><div class="canvas-surround"><div class="canvas-top"><div><span class="workspace-location">Website</span><span aria-hidden="true">/</span><span id="page-name">${esc(m.pages.find((p) => p.id === state.page)?.title || "Home")}</span><span> / </span>${btn("pages", "Pages", "text-button")}</div><div>${btn("undo", icon("undo"), "icon-button", 'aria-label="Undo" ' + (!state.undo.length ? "disabled" : ""))}${btn("redo", icon("redo"), "icon-button", 'aria-label="Redo" ' + (!state.redo.length ? "disabled" : ""))}${btn("tools", "Website tools", "text-button")}</div></div><div class="canvas ${state.device === "mobile" ? "mobile" : ""}"><iframe id="canvas" title="Your website" sandbox="allow-scripts"></iframe></div></div>${state.preview ? "" : `<div class="editor-dock"><div class="conversation-heading"><h2>Make it yours.</h2><p>Small changes. New possibilities.</p></div><div class="conversation" id="conversation" aria-live="polite">${state.messages.length ? state.messages.map((x) => `<p class="message ${x.role}">${esc(x.text)}</p>`).join("") : `<p class="message">Your website is ready to shape. Select anything on the right, or describe a change below.</p><div class="conversation-tools">${btn("pages", "Manage pages", "text-button")}${btn("sections", "Organize your content", "text-button")}${btn("tools", "Explore editing tools", "text-button")}</div>`}</div><div id="selection" class="selection-context"><span>Select a section or text to edit it.</span>${btn("sections", "Arrange sections", "text-button")}</div><form id="edit-form"><label class="sr-only" for="edit-prompt">Ask Clay to change anything</label><textarea id="edit-prompt" rows="1" maxlength="4000" placeholder="Ask Clay to change anything…" required></textarea><button class="send" aria-label="Apply change">${icon("send")}</button></form><div class="dock-footer"><span>${state.demo ? "Example website · try direct editing" : "Your ideas, brought to life."}</span><span>Hover to edit · drag ⠿ to rearrange</span></div></div>`}</main>`;
  renderCanvas(progressive);
  if ($("#edit-form"))
    $("#edit-form").onsubmit = async (e) => {
      e.preventDefault();
      const prompt = $("#edit-prompt").value;
      if (
        /^(make (it|the website|this) better|improve (it|this|the website))[.!?]*$/i.test(
          prompt.trim(),
        )
      ) {
        showPanel(
          "What would you like to improve?",
          `<p>Choose a starting point, or describe your idea below.</p><div class="answer-options">${["Visual style", "Colours", "Typography", "Images", "Layout", "Content", "Navigation"].map((x) => btn("clarify", x, "chip", `data-value="${x}"`)).join("")}</div>`,
        );
        return;
      }
      if (state.demo) {
        toast(
          "AI editing needs a connected account. You can explore direct editing in this example.",
        );
        return;
      }
      state.messages.push({ role: "you", text: prompt });
      $("#conversation").insertAdjacentHTML(
        "beforeend",
        `<p class="message you">${esc(prompt)}</p>`,
      );
      await busy(e.submitter, async () => {
        const r = await api.invoke("edit", {
          siteId: state.site.id,
          prompt,
          selected: state.selected,
          pageId: state.page,
        });
        if (r.question) {
          state.messages.push({ role: "clay", text: r.question });
          $("#conversation").insertAdjacentHTML(
            "beforeend",
            `<p class="message clay">${esc(r.question)}</p>`,
          );
          showPanel("A little more detail", `<p>${esc(r.question)}</p>`);
          return;
        }
        const ops = r.operations || [];
        const publish = ops.some((o) => o.type === "publish_website");
        await change(
          ops.filter((o) => o.type !== "publish_website"),
          r.summary || prompt,
        );
        state.messages.push({
          role: "clay",
          text: r.summary || "Your website has been updated.",
        });
        $("#conversation")?.insertAdjacentHTML(
          "beforeend",
          `<p class="message clay">${esc(r.summary || "Your website has been updated.")}</p>`,
        );
        $("#edit-prompt").value = "";
        if (publish) await publishSite();
        else toast(r.summary || "Your website has been updated.");
      });
    };
}
function renderCanvas(progressive = false) {
  const canvas = $("#canvas");
  canvas.dataset.revision = String(state.site.revision || 0);
  canvas.onload = () => {
    canvas.dataset.ready = "true";
  };
  canvas.srcdoc = renderDocument(state.site.model, state.page, {
    editing: true,
    preview: state.preview,
    progressive,
    selected: state.selected,
    scrollY: state.canvasScroll || 0,
  });
}
function selection() {
  const f = locate(state.site.model, state.selected);
  if (!f) return;
  $("#selection").innerHTML =
    `<span><i></i> ${esc(f.content ? "Item" : f.element ? f.element.type : f.section ? f.section.type + " section" : state.selected === "navigation" ? "Navigation" : "Page")} selected</span><div>${btn("edit-selected", "Edit", "text-button")}${btn("restore-selected", "Previous versions", "text-button")}${btn("clear-selection", icon("close"), "icon-button", 'aria-label="Clear selection"')}</div>`;
}
window.addEventListener("message", async (e) => {
  if (e.source !== $("#canvas")?.contentWindow || !state.site) return;
  const d = e.data;
  if (state.preview && d?.type !== "clay-page") return;
  if (d?.type === "clay-select" && locate(state.site.model, d.id)) {
    state.selected = d.id;
    selection();
  }
  if (d?.type === "clay-viewport" && Number.isFinite(d.scrollY))
    state.canvasScroll = Math.max(0, d.scrollY);
  if (d?.type === "clay-history") run(() => travel(!!d.redo));
  if (d?.type === "clay-edit" && locate(state.site.model, d.id)) {
    state.selected = d.id;
    selection();
    if (d.mode === "style") elementStyle();
    else if (d.mode === "move") moveSelectedPanel();
    else editSelected();
  }
  if (d?.type === "clay-text") {
    const f = locate(state.site.model, d.id);
    const field = d.field || "text";
    if (
      (f?.element || f?.content) &&
      ["text", "name", "description", "price"].includes(field) &&
      typeof d.text === "string"
    )
      run(() =>
        change(
          [
            {
              type: f.content ? "update_content" : "update_element",
              target: d.id,
              value: { [field]: d.text },
            },
          ],
          "Edited text",
        ),
      );
  }
  if (d?.type === "clay-shift" && [-1, 1].includes(d.delta))
    run(() => shiftCanvas(d.id, d.delta));
  if (d?.type === "clay-move") run(() => dropCanvas(d));
  if (
    d?.type === "clay-page" &&
    state.site.model.pages.some((p) => p.id === d.id)
  ) {
    state.page = d.id;
    state.canvasScroll = 0;
    state.selected = null;
    workspace();
  }
});
async function change(ops, label = "Edited website") {
  if (!ops.length) return;
  if (state.busy)
    throw Error("Please wait for your current changes to finish saving.");
  const before = clone(state.site.model),
    next = applyOperations(before, ops);
  state.busy = true;
  try {
    let saved;
    if (state.demo) {
      saved = { ...state.site, model: next };
      state.versions.unshift({
        id: uid(),
        model: before,
        label,
        created_at: new Date().toISOString(),
      });
    } else
      saved = await api.saveSite(
        state.site.id,
        next,
        state.site.revision,
        label,
      );
    state.undo.push(before);
    if (state.undo.length > 100) state.undo.shift();
    state.redo = [];
    state.site = saved;
    state.sites = state.sites.map((s) => (s.id === saved.id ? saved : s));
    if (!next.pages.some((p) => p.id === state.page))
      state.page = next.pages[0].id;
    if (state.view === "website") workspace();
  } finally {
    state.busy = false;
  }
}
async function travel(redo = false) {
  if (state.busy) return;
  const from = redo ? state.redo : state.undo,
    to = redo ? state.undo : state.redo;
  if (!from.length) return;
  state.busy = true;
  try {
    const target = from.at(-1),
      current = clone(state.site.model);
    state.site = state.demo
      ? { ...state.site, model: clone(target) }
      : await api.saveSite(
          state.site.id,
          target,
          state.site.revision,
          redo ? "Redo" : "Undo",
        );
    from.pop();
    to.push(current);
    state.sites = state.sites.map((s) =>
      s.id === state.site.id ? state.site : s,
    );
    if (!state.site.model.pages.some((p) => p.id === state.page))
      state.page = state.site.model.pages[0].id;
    workspace();
  } finally {
    state.busy = false;
  }
}
function showPanel(title, html, wide = false) {
  panel.className = wide ? "expanded" : "";
  panel.innerHTML = `<header><h2>${esc(title)}</h2><div>${btn("expand-panel", "⤢", "icon-button", 'aria-label="Expand panel"')}${btn("close-panel", "×", "icon-button", 'aria-label="Close panel"')}</div></header><div class="panel-body">${html}</div>`;
  if (!panel.open) panel.showModal();
}
function tools() {
  showPanel(
    "Your website",
    `<div class="tool-list">${[
      ["pages", "Pages", "Build your story, page by page."],
      ["sections", "Sections", "Arrange the pieces of your page."],
      ["style", "Look & feel", "Colours, type, and breathing room."],
      ["content", "Content", "Your products and services, in one place."],
      ["navigation", "Navigation", "Help people find their way."],
      [
        "info",
        "Website information",
        "Your name, contact details, and search description.",
      ],
      ["domains", "Web address", "A place for people to find you."],
      ["history", "Previous versions", "Revisit an earlier idea."],
      ["export", "Download website", "Take your website with you."],
    ]
      .map(([a, t, d]) =>
        btn(
          a,
          `<span><b>${t}</b><small>${d}</small></span><span>↗</span>`,
          "tool-row",
        ),
      )
      .join("")}</div>`,
  );
}
function pages() {
  showPanel(
    "Your pages",
    `<div class="rows">${state.site.model.pages.map((p) => `<div class="management-row">${btn("switch-page", esc(p.title), "text-button", `data-id="${p.id}"`)}<div>${btn("page-history", "Previous versions", "text-button", `data-id="${p.id}"`)}${btn("rename-page", "Rename", "text-button", `data-id="${p.id}"`)}${btn("delete-page", "Delete", "danger-text", `data-id="${p.id}" ${state.site.model.pages.length === 1 ? "disabled" : ""}`)}</div></div>`).join("")}</div><form id="page-form" class="stack-form"><label>New page name<input name="title" placeholder="About us" maxlength="70" required></label><button class="primary">Add page ＋</button></form>`,
  );
  $("#page-form").onsubmit = (e) => {
    e.preventDefault();
    const title = new FormData(e.target).get("title"),
      id = uid(),
      slug =
        title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") || "page";
    run(() =>
      change(
        [
          {
            type: "create_page",
            value: {
              id,
              title,
              slug: state.site.model.pages.some((p) => p.slug === slug)
                ? slug + "-" + Date.now()
                : slug,
              sections: [newSection()],
            },
          },
        ],
        "Added " + title,
      ).then(() => {
        state.page = id;
        panel.close();
        workspace();
      }),
    );
  };
}
function sections() {
  const p = state.site.model.pages.find((p) => p.id === state.page);
  showPanel(
    "Arrange your page",
    `<p>Drag sections into place, or use the arrows.</p><div id="section-list">${p.sections.map((s, i) => `<div class="management-row draggable" draggable="true" data-id="${s.id}"><span class="drag-grip" aria-hidden="true">⠿</span>${btn("choose-section", esc(s.elements.find((e) => e.type === "heading")?.text || s.type), "section-name", `data-id="${s.id}"`)}<div>${btn("section-up", "↑", "icon-button", `data-id="${s.id}" data-index="${i}" aria-label="Move section up" ${i === 0 ? "disabled" : ""}`)}${btn("section-down", "↓", "icon-button", `data-id="${s.id}" data-index="${i}" aria-label="Move section down" ${i === p.sections.length - 1 ? "disabled" : ""}`)}${btn("delete-section", "×", "icon-button", `data-id="${s.id}" aria-label="Remove section"`)}</div></div>`).join("")}</div><form id="section-form" class="stack-form"><label>Add a section<select name="type">${["text", "hero", "services", "gallery", "products", "contact", "testimonials"].map((t) => `<option>${t}</option>`).join("")}</select></label><button class="primary">Add section ＋</button></form>`,
  );
  let dragged;
  $("#section-list").ondragstart = (e) => {
    dragged = e.target.closest("[data-id]")?.dataset.id;
  };
  $("#section-list").ondragover = (e) => e.preventDefault();
  $("#section-list").ondrop = (e) => {
    e.preventDefault();
    const target = e.target.closest("[data-id]")?.dataset.id,
      index = p.sections.findIndex((s) => s.id === target);
    if (dragged && index >= 0)
      run(() =>
        change(
          [{ type: "move_section", target: dragged, index }],
          "Reordered sections",
        ).then(sections),
      );
  };
  $("#section-form").onsubmit = (e) => {
    e.preventDefault();
    run(() =>
      change(
        [
          {
            type: "create_section",
            pageId: state.page,
            value: newSection(new FormData(e.target).get("type")),
          },
        ],
        "Added section",
      ).then(sections),
    );
  };
}
function editSelected() {
  const f = locate(state.site.model, state.selected);
  if (!f) return;
  if (f.content) {
    contentForm(f.content.id);
    return;
  }
  if (state.selected === "navigation") {
    navigation();
    return;
  }
  if (!f.element) {
    showPanel(
      "Edit section",
      `<p>Select the text, image, or button you want to change.</p>${(f.section?.elements || []).map((e) => btn("choose-element", esc((e.text || e.alt || e.type).slice(0, 70)), "tool-row", `data-id="${e.id}"`)).join("")}<form id="section-style" class="stack-form"><label>Layout<select name="layout">${["stack", "split", "center", "grid", "list"].map((l) => `<option ${f.section.layout === l ? "selected" : ""}>${l}</option>`).join("")}</select></label><label class="color-label">Section colour<input type="color" name="background" value="${f.section.background || state.site.model.theme.background}"></label><button class="outline">Apply to section</button></form><form id="element-add" class="stack-form"><label>Add content<select name="type"><option value="text">Text</option><option value="heading">Heading</option><option value="image">Image</option><option value="button">Button</option><option value="item">Service or item</option></select></label><button class="outline">Add content ＋</button></form>`,
    );
    $("#section-style").onsubmit = (e) => {
      e.preventDefault();
      run(() =>
        change(
          [
            {
              type: "update_section",
              target: f.section.id,
              value: Object.fromEntries(new FormData(e.target)),
            },
          ],
          "Changed section style",
        ).then(editSelected),
      );
    };
    $("#element-add").onsubmit = (e) => {
      e.preventDefault();
      const type = new FormData(e.target).get("type");
      run(() =>
        change(
          [
            {
              type: "create_element",
              target: f.section.id,
              value: {
                id: uid(),
                type,
                text: type === "heading" ? "Your heading" : "Your content",
                src: "",
                alt: "Describe your image",
                href: "#",
                description: "",
                price: "",
              },
            },
          ],
          "Added content",
        ).then(editSelected),
      );
    };
    return;
  }
  const el = f.element;
  showPanel(
    "Edit " + el.type,
    `<form id="element-form" class="stack-form">${el.type === "image" ? `<label>Choose a photo<input name="photo" type="file" accept="image/jpeg,image/png,image/webp"></label><details><summary>Or use an image link</summary><label>Image link<input name="src" value="${esc(el.src)}" placeholder="https://…"></label></details><label>Describe the image<input name="alt" value="${esc(el.alt)}" required></label>` : `<label>${el.type === "button" ? "Button label" : "Text"}<textarea name="text" required>${esc(el.text)}</textarea></label>${el.type === "button" ? `<label>Where should it go?<input name="href" value="${esc(el.href)}" placeholder="https://… or #section"></label>` : ""}${el.type === "item" ? `<label>Choose a photo<input name="photo" type="file" accept="image/jpeg,image/png,image/webp"></label><label>Image link<input name="src" value="${esc(el.src || "")}" placeholder="https://…"></label><label>Describe the image<input name="alt" value="${esc(el.alt || el.text)}"></label><label>Description<textarea name="description">${esc(el.description)}</textarea></label><label>Price<input name="price" value="${esc(el.price)}"></label>` : ""}`}<button class="primary">Save changes</button></form><div class="element-order">${btn("element-style", "Colour & type", "outline")}${btn("element-move", "Move to…", "outline")}${btn("element-up", "Move earlier", "outline")}${btn("element-down", "Move later", "outline")}${btn("delete-element", "Remove content", "danger-text")}</div>`,
  );
  $("#element-form").onsubmit = (ev) => {
    ev.preventDefault();
    run(async () => {
      const form = new FormData(ev.target),
        value = Object.fromEntries(form);
      if (["image", "item"].includes(el.type)) {
        const photo = form.get("photo");
        if (photo?.size) value.src = await compressPhoto(photo);
        delete value.photo;
      }
      await change(
        [
          {
            type: el.type === "image" ? "replace_image" : "update_element",
            target: el.id,
            value,
          },
        ],
        "Edited " + el.type,
      );
      panel.close();
    });
  };
}
function style() {
  const t = state.site.model.theme;
  showPanel(
    "Look & feel",
    `<form id="style-form" class="stack-form"><p>Small details. A whole different feeling.</p>${btn("theme-history", "Previous styles", "text-button")}${["background", "text", "accent"].map((k) => `<label class="color-label">${k[0].toUpperCase() + k.slice(1)}<input type="color" name="${k}" value="${t[k]}"></label>`).join("")}<label>Typography<select name="font">${fonts.map((f) => `<option ${t.font === f ? "selected" : ""}>${f}</option>`).join("")}</select></label><label>Breathing room<select name="spacing">${["compact", "comfortable", "spacious"].map((s) => `<option ${t.spacing === s ? "selected" : ""}>${s}</option>`).join("")}</select></label><button class="primary">Apply style</button></form>`,
  );
  $("#style-form").onsubmit = (e) => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(e.target));
    run(() =>
      change(
        [
          {
            type: "change_colors",
            value: { background: v.background, text: v.text, accent: v.accent },
          },
          { type: "change_typography", value: v.font },
          { type: "change_spacing", value: v.spacing },
        ],
        "Updated website style",
      ).then(() => panel.close()),
    );
  };
}
function content() {
  showPanel(
    "Your content",
    `<p>Products and services appear in your website’s Products sections.</p>${state.site.model.content.length ? state.site.model.content.map((c) => `<div class="management-row"><div><b>${esc(c.name)}</b><small>${esc(c.price)}</small></div><div>${btn("edit-content", "Edit", "text-button", `data-id="${c.id}"`)}${btn("delete-content", "Delete", "danger-text", `data-id="${c.id}"`)}</div></div>`).join("") : '<p class="empty-small">Your next great thing goes here.</p>'}${btn("add-content", "Add an item ＋", "primary")}`,
  );
}
function contentForm(id) {
  const c = state.site.model.content.find((c) => c.id === id) || {
    name: "",
    description: "",
    price: "",
  };
  showPanel(
    id ? "Edit item" : "Add an item",
    `<form id="content-form" class="stack-form"><label>Choose a photo<input type="file" name="photo" accept="image/jpeg,image/png,image/webp"></label><label>Image link<input name="src" value="${esc(c.src || "")}" placeholder="https://…"></label><label>Describe the image<input name="alt" value="${esc(c.alt || c.name)}"></label><label>Name<input name="name" value="${esc(c.name)}" required maxlength="200"></label><label>Description<textarea name="description">${esc(c.description)}</textarea></label><label>Price<input name="price" value="${esc(c.price)}" placeholder="₹45,000"></label><button class="primary">Save item</button></form>${id ? btn("element-style", "Colour & type", "outline") + btn("element-move", "Move to…", "outline") : ""}`,
  );
  $("#content-form").onsubmit = (e) => {
    e.preventDefault();
    run(async () => {
      const form = new FormData(e.target),
        value = Object.fromEntries(form);
      if (value.photo?.size) value.src = await compressPhoto(value.photo);
      delete value.photo;
      await change(
        [
          {
            type: id ? "update_content" : "create_content",
            target: id,
            value: { ...value, id: id || uid() },
          },
        ],
        id ? "Updated item" : "Added item",
      );
      panel.close();
    });
  };
}
function navigation() {
  showPanel(
    "Navigation",
    `<form id="nav-form" class="stack-form"><p>Choose the pages to show in your menu. Drag to change their order.</p><div id="nav-list">${[...state.site.model.navigation.map((n) => ({ id: n.pageId, title: n.label, checked: true })), ...state.site.model.pages.filter((p) => !state.site.model.navigation.some((n) => n.pageId === p.id))].map((p) => `<label class="nav-row" draggable="true" data-id="${p.id}"><span>⠿</span><input type="checkbox" name="visible" value="${p.id}" ${p.checked ? "checked" : ""}><input aria-label="Menu label" name="label-${p.id}" value="${esc(p.title)}" required></label>`).join("")}</div><button class="primary">Save navigation</button></form>`,
  );
  let drag;
  $("#nav-list").ondragstart = (e) => (drag = e.target.closest(".nav-row"));
  $("#nav-list").ondragover = (e) => e.preventDefault();
  $("#nav-list").ondrop = (e) => {
    e.preventDefault();
    const row = e.target.closest(".nav-row");
    if (drag && row && row !== drag) row.before(drag);
  };
  $("#nav-form").onsubmit = (e) => {
    e.preventDefault();
    const data = new FormData(e.target),
      value = [...$("#nav-list").children]
        .filter((r) => data.getAll("visible").includes(r.dataset.id))
        .map((r) => ({
          pageId: r.dataset.id,
          label: data.get("label-" + r.dataset.id),
        }));
    run(() =>
      change([{ type: "update_navigation", value }], "Updated navigation").then(
        () => panel.close(),
      ),
    );
  };
}
function info() {
  const m = state.site.model;
  showPanel(
    "Website information",
    `<form id="info-form" class="stack-form">${[
      ["name", "Business name"],
      ["description", "Description for search results"],
      ["email", "Contact email"],
      ["phone", "Phone number"],
      ["address", "Location"],
    ]
      .map(
        ([k, l]) =>
          `<label>${l}${k === "description" ? `<textarea name="${k}">${esc(m[k] || "")}</textarea>` : `<input name="${k}" ${k === "name" ? "required" : ""} value="${esc(m[k] || "")}">`}</label>`,
      )
      .join("")}<button class="primary">Save information</button></form>`,
  );
  $("#info-form").onsubmit = (e) => {
    e.preventDefault();
    run(() =>
      change(
        [
          {
            type: "update_info",
            value: Object.fromEntries(new FormData(e.target)),
          },
        ],
        "Updated website information",
      ).then(() => panel.close()),
    );
  };
}
function domains() {
  showPanel(
    "Your web address",
    state.site.live_url
      ? `<p>Your website lives here:</p><a class="live-link" href="${esc(state.site.live_url)}" target="_blank" rel="noopener">${esc(state.site.live_url)} ↗</a><hr><h3>A name of your own</h3><p>Connecting a custom address is not available in this version. Your included web address works without buying a domain.</p>`
      : "<p>Publish your website to get its free web address.</p><p>A custom domain connection is not available in this version.</p>" +
          btn("publish", "Publish website", "primary"),
  );
}
async function history(scope = "website") {
  const list = state.demo ? state.versions : await api.versions(state.site.id);
  state.loadedVersions = list;
  showPanel(
    scope === "website"
      ? "Previous versions"
      : "Previous versions of this selection",
    `<p>${scope === "website" ? "Restore an earlier website. Your current version will be kept." : "Restore only this part. Everything else stays as it is."}</p>${
      list
        .filter((v) => scope === "website" || locate(v.model, scope))
        .map(
          (v) =>
            `<div class="version-row"><div><b>${esc(v.label)}</b><small>${new Date(v.created_at).toLocaleString()}</small></div>${btn("restore-version", "Restore", "outline", `data-id="${v.id}" data-scope="${esc(scope)}"`)}</div>`,
        )
        .join("") ||
      '<p class="empty-small">Your previous versions will appear after your first change.</p>'
    }`,
  );
}
async function publishSite() {
  if (state.demo) {
    showPanel(
      "Ready when you are",
      "<p>This is an example workspace. Create your account to save and publish your own website.</p>" +
        btn("signup", "Create my website", "primary"),
    );
    return;
  }
  showPanel(
    "Publish your website",
    `<p>${state.site.live_url ? "Your existing live website stays available while your latest changes are published." : "Give your business a place on the web. Clay will create your free web address."}</p><p class="publish-status">${statusLabel()}</p>${btn("do-publish", "Publish now " + icon("arrow"), "primary")}${state.site.live_url ? `<a class="live-link" href="${esc(state.site.live_url)}" target="_blank" rel="noopener">View live website ↗</a>` : ""}`,
  );
}
async function doPublish() {
  showPanel(
    "Opening your doors",
    '<span class="progress-line" aria-hidden="true"></span><p>Publishing your website. Your last live version stays available.</p>',
  );
  try {
    await api.invoke("publish", { siteId: state.site.id });
    for (let i = 0; i < 24; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      const r = await api.invoke("publish_status", { siteId: state.site.id });
      if (r.status === "published" || r.status === "changed") {
        state.site = r.site;
        state.sites = [r.site];
        workspace();
        showPanel(
          "Your website is live",
          `<p>Your digital home is ready for visitors.</p><a class="primary live-link" href="${esc(r.site.live_url)}" target="_blank" rel="noopener">Visit your website ↗</a>`,
        );
        return;
      }
      if (r.status === "failed")
        throw Error(
          "Publishing did not finish. Your previous live website is still available. Please try again.",
        );
    }
    showPanel(
      "Still publishing",
      "<p>Your website is taking a little longer. You can keep editing and check its status again.</p>" +
        btn("check-publish", "Check status", "outline"),
    );
  } catch (e) {
    toast(errorText(e));
    showPanel(
      "Publishing needs another try",
      `<p>${esc(errorText(e))}</p>${btn("do-publish", "Try again", "primary")}`,
    );
  }
}
async function download() {
  const files = exportFiles(
    state.site.model,
    state.demo
      ? {}
      : {
          endpoint: window.CLAY_CONFIG.supabaseUrl + "/functions/v1/clay",
          siteId: state.site.id,
          publicKey: window.CLAY_CONFIG.supabaseKey,
        },
  );
  const { zipSync, strToU8 } = await import("https://esm.sh/fflate@0.8.2");
  const zipped = zipSync(
    Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])),
  );
  const url = URL.createObjectURL(
      new Blob([zipped], { type: "application/zip" }),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download =
    state.site.model.name.toLowerCase().replace(/[^a-z0-9]/g, "-") +
    "-website.zip";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("Your website has been downloaded.");
}
function profile(tab = "profile") {
  if (typeof tab !== "string") tab = "profile";
  state.profileTab = tab;
  const u = state.user?.user_metadata || state.demoProfile || {},
    name = u.name || u.full_name || "Business Owner";
  const business = u.business_type || "Small Business";
  const tabs = [
    ["profile", "Profile", "person"],
    ["business", "Business info", "store"],
    ["preferences", "Preferences", "settings"],
    ["security", "Security", "shield"],
  ];
  const panelContent =
    tab === "profile"
      ? `<h1>Your profile</h1><form id="profile-account-form" class="profile-details-form"><div class="profile-field"><label for="profile-name">Name</label><input id="profile-name" name="name" autocomplete="name" value="${esc(u.name || u.full_name || "")}" maxlength="100" required></div><div class="profile-field"><label for="profile-email">Email</label><div><input id="profile-email" type="email" value="${esc(state.user?.email || "owner@mybusiness.com")}" readonly aria-describedby="profile-email-help"><small id="profile-email-help">Your sign-in email.</small></div></div><div class="profile-field"><label for="profile-business-type">Business type</label><select id="profile-business-type" name="business_type">${["Small Business", "Retail", "Food & Drink", "Services", "Creative & Design", "Health & Wellness", "Education", "Other"].map((x) => `<option ${business === x ? "selected" : ""}>${x.replace("&", "&amp;")}</option>`).join("")}</select></div><div class="profile-field"><label for="profile-location">Location</label><input id="profile-location" name="location" autocomplete="address-level2" placeholder="City, country" value="${esc(u.location || "")}" maxlength="160"></div><div class="profile-save-row"><p id="profile-save-status" role="status" aria-live="polite">Your details are up to date.</p><button class="primary" id="profile-save">Save</button></div></form>`
      : tab === "business"
        ? `<h1>Business info</h1>${
            state.sites[0]
              ? `<p class="muted">The details customers see on your website.</p><form id="profile-business-form" class="profile-details-form">${[
                  ["name", "Business name"],
                  ["email", "Contact email"],
                  ["phone", "Phone"],
                  ["address", "Location"],
                  ["description", "Description"],
                ]
                  .map(
                    ([key, label]) =>
                      `<div class="profile-field"><label for="business-${key}">${label}</label>${key === "description" ? `<textarea id="business-${key}" name="${key}" maxlength="1200">${esc(state.sites[0].model[key] || "")}</textarea>` : `<input id="business-${key}" name="${key}" ${key === "name" ? 'required maxlength="120"' : 'maxlength="250"'} value="${esc(state.sites[0].model[key] || "")}" ${key === "email" ? 'type="email"' : ""}>`}</div>`,
                  )
                  .join(
                    "",
                  )}<div class="profile-save-row"><p id="business-save-status" role="status"></p><button class="primary">Save</button></div></form>${btn("activity", "Website activity & messages", "text-button")}`
              : `<p>Create your website to add the details your customers will see.</p>${btn("new-website", "Create my website", "primary")}`
          }`
        : tab === "preferences"
          ? `<h1>Preferences</h1><p>Make Clay comfortable for you.</p><fieldset class="theme-options"><legend>Appearance</legend>${["light", "dark"].map((mode) => `<label><input type="radio" name="appearance" value="${mode}" ${document.documentElement.dataset.theme === mode ? "checked" : ""}>${mode[0].toUpperCase() + mode.slice(1)} mode</label>`).join("")}</fieldset><p class="muted">Your choice is saved on this device.</p>`
          : `<h1>Security</h1><p>Your website, profile and messages are private to your account.</p><h2>Sign-in methods</h2><p>${state.user?.app_metadata?.providers?.includes("google") ? "Google and secure email links." : "Secure email links. You can also sign in with Google when it is connected."}</p><h2>Account sessions</h2><p>Using a shared computer? Sign out when you finish.</p><div class="security-actions">${btn("signout", "Sign out", "outline")}${btn("signout-all", "Sign out of all devices", "outline", state.demo ? "disabled" : "")}</div>`;
  app.innerHTML =
    header("profile") +
    `<main id="main" class="profile account-profile"><aside class="account-sidebar"><div class="owner-avatar">${profilePicture()}</div><h2>${esc(name)}</h2><p>${esc(business)}</p><nav aria-label="Profile settings">${tabs.map(([id, label, graphic]) => btn("profile-tab", uiIcon(graphic) + `<span>${label}</span>`, "profile-menu-item " + (tab === id ? "active" : ""), `data-tab="${id}" ${tab === id ? 'aria-current="page"' : ""}`)).join("")}</nav></aside><section class="account-main">${panelContent}</section><aside class="account-photo"><h2>Profile picture</h2><div class="profile-photo-preview">${profilePicture()}</div><label class="outline upload-profile-picture" for="profile-picture">Upload image<input class="sr-only" id="profile-picture" type="file" accept="image/jpeg,image/png,image/webp"></label><p class="picture-hint">JPG, PNG or WebP · up to 5 MB</p><p id="picture-status" role="status" aria-live="polite"></p></aside></main>`;
  const form = $("#profile-account-form");
  if (form) {
    form.oninput = () => {
      $("#profile-save-status").textContent = "You have unsaved changes.";
    };
    form.onsubmit = (e) => {
      e.preventDefault();
      const values = Object.fromEntries(new FormData(form));
      busy(e.submitter, async () => {
        if (state.demo) state.demoProfile = { ...state.demoProfile, ...values };
        else {
          const owner = state.user?.id,
            updated = await api.updateProfile(values);
          if (state.user?.id !== owner) return;
          state.user = updated;
        }
        profile();
        $("#profile-save-status").textContent = "Changes saved.";
      });
    };
  }
  const businessForm = $("#profile-business-form");
  if (businessForm)
    businessForm.onsubmit = (e) => {
      e.preventDefault();
      busy(e.submitter, async () => {
        state.site = clone(state.sites[0]);
        await change(
          [
            {
              type: "update_info",
              value: Object.fromEntries(new FormData(businessForm)),
            },
          ],
          "Updated business information",
        );
        $("#business-save-status").textContent = "Changes saved.";
      });
    };
  document.querySelectorAll('[name="appearance"]').forEach(
    (input) =>
      (input.onchange = () => {
        localStorage.setItem("clay-theme", input.value);
        theme();
      }),
  );
  $("#profile-picture").onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const label = $(".upload-profile-picture");
    label.classList.add("uploading");
    $("#picture-status").textContent = "Uploading your picture…";
    try {
      const photo = await compressPhoto(file);
      if (state.demo) state.avatarUrl = photo;
      else {
        const owner = state.user?.id,
          updated = await api.uploadAvatar(photo);
        if (state.user?.id !== owner) return;
        state.user = updated;
        await loadAvatar();
      }
      profile(state.profileTab);
      $("#picture-status").textContent = "Profile picture saved.";
    } catch (error) {
      $("#picture-status").textContent = errorText(error);
    } finally {
      label.classList.remove("uploading");
    }
  };
}
function profilePicture() {
  const src = safeImageUrl(
    state.avatarUrl || state.user?.user_metadata?.avatar_url || "",
  );
  return src
    ? `<img src="${esc(src)}" alt="Your profile picture">`
    : `<span class="avatar-placeholder">${uiIcon("person")}</span>`;
}
async function loadAvatar() {
  const owner = state.user?.id,
    path = state.user?.user_metadata?.avatar_path;
  state.avatarUrl = "";
  if (!path) return;
  try {
    const url = await api.avatarUrl(path);
    if (state.user?.id === owner) state.avatarUrl = url;
  } catch {}
}
function help(topic = "help") {
  const content = {
    help: [
      "Help center",
      `<div class="help-steps"><h3>1. Start at Home</h3><p>Your overview keeps your website and everyday shortcuts together.</p><h3>2. Shape your website</h3><p>Open Website to edit. Double-click text, select a section, or ask Clay for a change.</p><h3>3. Open your doors</h3><p>Use Publish when you’re ready. Your live website updates after publishing finishes.</p></div>`,
    ],
    tutorial: [
      "Video tutorials",
      `<video class="walkthrough-video" controls playsinline preload="metadata" src="assets/clay-walkthrough.mp4" aria-label="Clay editor walkthrough"></video><ol><li>Open Website to see the editor.</li><li>Select text and edit it directly.</li><li>Use Website tools to change the design.</li><li>Use Preview to check your website.</li></ol>`,
    ],
    community: [
      "Community",
      `<p>Clay’s community space is not available yet.</p><p>The Help center includes guidance you can use today.</p>${btn("help", "Open Help center", "primary")}`,
    ],
    support: [
      "Contact support",
      `<p>If you need help, copy a short report and share it with Clay’s owner.</p><p>The report includes your current page and browser details. Describe what you expected and what happened.</p>${btn("copy-support", "Copy support report", "primary")}<p id="support-status" role="status"></p>`,
    ],
  };
  const [title, body] = content[topic] || content.help;
  showPanel(title, body);
}

function activity() {
  if (!state.sites.length) {
    showPanel(
      "Website activity",
      "<p>Publish your website to start seeing visits and messages here.</p>",
    );
    return;
  }
  showPanel(
    "Website activity",
    '<div id="activity-content"><p>Loading your website activity…</p></div>',
    true,
  );
  if (state.sites.length)
    run(async () => {
      const { events, contacts } = state.demo
        ? { events: [], contacts: [] }
        : await api.insights(state.sites[0].id);
      const unique = new Set(events.map((e) => e.visitor)).size,
        sessions = new Set(
          events.map((e) => e.visitor + e.created_at.slice(0, 10)),
        ).size,
        seconds = events.reduce((a, e) => a + e.seconds, 0);
      if (!$("#activity-content")) return;
      $("#activity-content").innerHTML = `<div class="metrics">${[
        ["Visitors", sessions],
        ["Page views", events.length],
        ["Unique visitors", unique],
        ["Average time", Math.round(seconds / (sessions || 1)) + " sec"],
        ["Messages", contacts.length],
      ]
        .map(([l, v]) => `<div><b>${v}</b><span>${l}</span></div>`)
        .join(
          "",
        )}</div><div class="visit-chart" aria-label="Page views over the last seven days">${Array.from(
        { length: 7 },
        (_, i) => {
          const d = new Date(Date.now() - (6 - i) * 86400000),
            count = events.filter(
              (e) => e.created_at.slice(0, 10) === d.toISOString().slice(0, 10),
            ).length;
          return `<div><span>${count}</span><i style="height:${Math.max(2, Math.min(100, count * 5))}px"></i><small>${d.toLocaleDateString(undefined, { weekday: "short" })}</small></div>`;
        },
      ).join(
        "",
      )}</div><p class="muted">Visitors counts a person once per day. Unique visitors counts their browser once in 30 days. Time is an estimate. ${events.length >= 10000 ? "Showing the first 10,000 page views." : ""}</p><h3>Visitor locations</h3><p>${[...new Set(events.map((e) => e.country).filter(Boolean))].map(esc).join(", ") || "Locations are not available for these visits."}</p><h3>Messages from your website</h3>${contacts.length ? contacts.map((c) => `<article class="contact-message"><div><b>${esc(c.name)}</b><time>${new Date(c.created_at).toLocaleDateString()}</time></div><a href="mailto:${esc(c.email)}">${esc(c.email)}</a><p>${esc(c.message)}</p></article>`).join("") : '<p class="muted">When someone reaches out through your website, you’ll see their message here.</p>'}`;
    });
}
function settings() {
  showPanel(
    "Settings",
    `<form id="account-form" class="stack-form"><h3>Account</h3><label>Your name<input name="name" value="${esc(state.user?.user_metadata?.name || "")}" ${state.demo ? "disabled" : ""}></label><label>Email<input type="email" value="${esc(state.user?.email || "Example workspace")}" disabled></label>${state.demo ? "" : '<button class="outline">Save name</button>'}</form><hr><h3>Personalization</h3>${btn("theme", "Switch light / dark mode", "outline")}<hr><h3>Security</h3><p>Sign in with your email link or Google account. Your websites and messages are private to your account.</p>${btn("signout-all", "Sign out of all devices", "outline", state.demo ? "disabled" : "")}<hr><h3>About Clay</h3><p>Your business deserves a digital home.</p><p>Need a hand? Open Website tools to edit pages, content, colours, and publishing. Select anything on your website to edit it directly.</p>${state.sites.length ? btn("delete-site", "Delete my website", "danger-text") : ""}<hr>${btn("signout", "Sign out", "outline")}`,
  );
  $("#account-form").onsubmit = (e) => {
    e.preventDefault();
    run(async () => {
      const c = await api.client();
      const { data, error } = await c.auth.updateUser({
        data: { name: new FormData(e.target).get("name") },
      });
      if (error) throw error;
      state.user = data.user;
      toast("Your name has been updated.");
      panel.close();
      profile();
    });
  };
}
async function busy(button, fn) {
  if (button) button.disabled = true;
  try {
    await fn();
  } catch (e) {
    toast(errorText(e));
    if ($("#auth-status")) $("#auth-status").textContent = errorText(e);
  } finally {
    if (button) button.disabled = false;
  }
}
async function run(fn) {
  try {
    await fn();
  } catch (e) {
    toast(errorText(e));
  }
}
const actions = {
  showcase: (button) => {
    const examples = [
      {
        name: "forma",
        headline: "Less, but<br>with meaning.",
        tag: "THOUGHTFULLY MADE",
        description:
          "Honest materials. Quiet details.<br>Furniture for a life well lived.",
        image:
          "https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&w=900&q=85",
        alt: "Quiet interior with natural materials",
        background: "#efeee8",
      },
      {
        name: "wildflower",
        headline: "For the<br>everyday joys.",
        tag: "SEASONAL FLOWERS",
        description:
          "A little colour. A thoughtful gesture.<br>Flowers for every kind of day.",
        image:
          "https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=900&q=85",
        alt: "Yellow spring flowers",
        background: "#f0e8e4",
      },
      {
        name: "still studio",
        headline: "Stories worth<br>keeping.",
        tag: "PORTRAITS & PLACES",
        description:
          "Natural light. Honest moments.<br>Photography with a personal touch.",
        image:
          "https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&w=900&q=85",
        alt: "A study of light and objects",
        background: "#e6eaec",
      },
    ];
    const x = examples[Number(button.dataset.index)];
    if (!x) return;
    $(".sample-nav b").textContent = x.name;
    $(".sample-hero h2").innerHTML = x.headline;
    $(".sample-hero .small-caps").textContent = x.tag;
    $(".sample-hero div > p:not(.small-caps)").innerHTML = x.description;
    $(".sample-hero img").src = x.image;
    $(".sample-hero img").alt = x.alt;
    $(".sample-interior").style.background = x.background;
    document.querySelectorAll('[data-action="showcase"]').forEach((b) => {
      b.classList.toggle("active", b === button);
      b.setAttribute("aria-pressed", String(b === button));
    });
  },
  "retry-generation": () => generate(),
  "resume-generation": () => generate(true),
  "blank-site": blankSite,
  signup: () => {
    panel.close();
    state.demo = false;
    auth(true);
  },
  login: () => {
    state.demo = false;
    auth(false);
  },
  google: async () => {
    const r = await fetch(
      window.CLAY_CONFIG.supabaseUrl + "/auth/v1/settings",
      { headers: { apikey: window.CLAY_CONFIG.supabaseKey } },
    );
    const settings = await r.json();
    if (!settings.external?.google)
      throw Error(
        "Google sign-in is not available yet. Please continue with email.",
      );
    await api.login("google");
  },
  theme: () => {
    localStorage.setItem(
      "clay-theme",
      document.documentElement.dataset.theme === "dark" ? "light" : "dark",
    );
    theme();
  },
  home: () => (state.user || state.demo ? home() : landing()),
  website,
  "new-website": createWebsite,
  "home-tool": (b) => {
    if (!state.sites.length) {
      createWebsite();
      return;
    }
    website();
    ({ business: info, design: style, content, publish: publishSite })[
      b.dataset.tool
    ]?.();
  },
  profile: () => profile(),
  "profile-tab": (b) => profile(b.dataset.tab),
  activity,
  help: () => help(),
  tutorial: () => help("tutorial"),
  community: () => help("community"),
  support: () => help("support"),
  "copy-support": async () => {
    await navigator.clipboard.writeText(
      `Clay support report\nPage: ${state.view}\nBrowser: ${navigator.userAgent}\nWhat happened: `,
    );
    $("#support-status").textContent =
      "Report copied. Share it with Clay’s owner.";
  },
  settings,
  signout: async () => {
    if (!state.demo) await api.logout();
    state.user = null;
    state.site = null;
    state.sites = [];
    state.demo = false;
    panel.close();
    landing();
  },
  "signout-all": async () => {
    await api.logout("global");
    state.user = null;
    state.site = null;
    state.sites = [];
    panel.close();
    landing();
  },
  demo: () => {
    state.demo = true;
    const site = {
      id: "example",
      model: example(),
      status: "draft",
      updated_at: new Date().toISOString(),
    };
    state.sites = [site];
    state.versions = [];
    openSite(site);
  },
  "open-site": (b) => {
    const site = state.sites.find((s) => s.id === b.dataset.id);
    if (site) openSite(site);
  },
  "answer-option": (b) => {
    $("#answer").value = b.dataset.value;
  },
  "previous-question": () => {
    state.question--;
    question();
  },
  "close-panel": () => panel.close(),
  "expand-panel": () => panel.classList.toggle("expanded"),
  pages,
  tools,
  sections,
  style,
  content,
  navigation,
  info,
  domains,
  history: () => history(),
  publish: publishSite,
  "do-publish": doPublish,
  "check-publish": async () => {
    const r = await api.invoke("publish_status", { siteId: state.site.id });
    state.site = r.site;
    workspace();
    await publishSite();
  },
  export: download,
  undo: () => travel(),
  redo: () => travel(true),
  preview: () => {
    state.preview = !state.preview;
    workspace();
  },
  desktop: () => {
    state.device = "desktop";
    workspace();
  },
  mobile: () => {
    state.device = "mobile";
    workspace();
  },
  "edit-selected": editSelected,
  "clear-selection": () => {
    state.selected = null;
    workspace();
  },
  "restore-selected": () => history(state.selected),
  "page-history": (b) => history(b.dataset.id),
  "theme-history": () => history("theme"),
  "choose-section": (b) => {
    state.selected = b.dataset.id;
    editSelected();
  },
  "choose-element": (b) => {
    state.selected = b.dataset.id;
    editSelected();
  },
  "switch-page": (b) => {
    state.page = b.dataset.id;
    state.selected = null;
    panel.close();
    workspace();
  },
  "rename-page": (b) => {
    const p = state.site.model.pages.find((p) => p.id === b.dataset.id);
    showPanel(
      "Rename page",
      `<form id="rename-form" class="stack-form"><label>Page name<input name="title" value="${esc(p.title)}" required></label><button class="primary">Save</button></form>`,
    );
    $("#rename-form").onsubmit = (e) => {
      e.preventDefault();
      const title = new FormData(e.target).get("title");
      run(() =>
        change(
          [
            { type: "restore", target: p.id, value: { ...p, title } },
            {
              type: "update_navigation",
              value: state.site.model.navigation.map((n) =>
                n.pageId === p.id ? { ...n, label: title } : n,
              ),
            },
          ],
          "Renamed page",
        ).then(pages),
      );
    };
  },
  "delete-page": (b) =>
    change(
      [{ type: "delete_page", target: b.dataset.id }],
      "Deleted page",
    ).then(pages),
  "section-up": (b) =>
    change(
      [
        {
          type: "move_section",
          target: b.dataset.id,
          index: Number(b.dataset.index) - 1,
        },
      ],
      "Moved section",
    ).then(sections),
  "section-down": (b) =>
    change(
      [
        {
          type: "move_section",
          target: b.dataset.id,
          index: Number(b.dataset.index) + 1,
        },
      ],
      "Moved section",
    ).then(sections),
  "delete-section": (b) =>
    change(
      [{ type: "delete_section", target: b.dataset.id }],
      "Removed section",
    ).then(sections),
  "element-up": () => moveElement(-1),
  "element-down": () => moveElement(1),
  "delete-element": () =>
    change(
      [{ type: "delete_element", target: state.selected }],
      "Removed content",
    ).then(() => panel.close()),
  "add-content": () => contentForm(),
  "edit-content": (b) => contentForm(b.dataset.id),
  "delete-content": (b) =>
    change(
      [{ type: "delete_content", target: b.dataset.id }],
      "Deleted content",
    ).then(content),
  "restore-version": (b) => {
    const v = state.loadedVersions.find((v) => v.id === b.dataset.id),
      scope = b.dataset.scope;
    return change(
      [
        {
          type: "restore",
          target: scope,
          value: scope === "website" ? v.model : locate(v.model, scope).node,
        },
      ],
      "Restored " + (scope === "website" ? "website" : "selection"),
    ).then(() => panel.close());
  },
  clarify: (b) => {
    panel.close();
    $("#edit-prompt").value =
      "Improve the " + b.dataset.value.toLowerCase() + ": ";
    $("#edit-prompt").focus();
  },
  "element-style": () => elementStyle(),
  "element-move": () => moveSelectedPanel(),
  "delete-site": () => {
    showPanel(
      "Delete your website?",
      `<p>This permanently deletes your saved website, previous versions, and messages. Download your website first if you want to keep a copy.</p>${state.sites[0]?.live_url ? "<p>Unpublish your website before deleting it.</p>" + btn("unpublish", "Take website offline", "outline") : btn("confirm-delete", "Delete website permanently", "danger")}`,
    );
  },
  unpublish: async () => {
    const id = state.sites[0].id;
    const first = await api.invoke("unpublish", { siteId: id });
    showPanel(
      "Taking your website offline",
      "<p>This takes a moment. Your saved website stays in Clay.</p>",
    );
    let done = first.status === "draft";
    for (let i = 0; !done && i < 36; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      const result = await api.invoke("publish_status", { siteId: id });
      if (result.status === "failed")
        throw Error(
          "Your website could not be taken offline. Please try again.",
        );
      done = result.status === "draft";
    }
    state.sites = await api.listSites();
    state.site = state.sites[0];
    panel.close();
    profile();
    toast(
      done
        ? "Your website is offline."
        : "Still taking your website offline. Check its status in a moment.",
    );
  },
  "confirm-delete": async () => {
    if (!state.demo) await api.deleteSite(state.sites[0].id);
    state.sites = [];
    state.site = null;
    panel.close();
    home();
  },
};
function elementStyle() {
  const f = locate(state.site.model, state.selected);
  if (!f?.element && !f?.content) {
    editSelected();
    return;
  }
  const st = f.node.style || {},
    t = state.site.model.theme;
  showPanel(
    "Style this content",
    `<form id="element-style-form" class="stack-form"><p>These changes apply only to your selection.</p><label class="color-label">Text colour<input name="color" type="color" value="${st.color || t.text}"></label><label class="color-label">Background colour<input name="background" type="color" value="${st.background || f.section?.background || t.background}"></label><label>Text size<input name="fontSize" type="number" min="12" max="100" value="${st.fontSize || (f.element?.type === "heading" ? 44 : 16)}"></label><label>Typeface<select name="fontFamily">${fonts.map((font) => `<option ${(st.fontFamily || t.font) === font ? "selected" : ""}>${font}</option>`).join("")}</select></label><label>Alignment<select name="textAlign">${["left", "center", "right"].map((x) => `<option ${st.textAlign === x ? "selected" : ""}>${x}</option>`).join("")}</select></label><label>Space inside<input name="padding" type="number" min="0" max="100" value="${st.padding || 0}"></label><button class="primary">Apply to selection</button></form>`,
  );
  const initialStyle = Object.fromEntries(
    new FormData($("#element-style-form")),
  );
  $("#element-style-form").onsubmit = (e) => {
    e.preventDefault();
    const value = Object.fromEntries(
      [...new FormData(e.target)].filter(
        ([key, val]) => val !== initialStyle[key],
      ),
    );
    if (value.fontSize != null) value.fontSize = Number(value.fontSize);
    if (value.padding != null) value.padding = Number(value.padding);
    if (!Object.keys(value).length) {
      panel.close();
      return;
    }
    run(async () => {
      await change(
        [{ type: "update_style", target: f.node.id, value }],
        "Styled selected content",
      );
      panel.close();
    });
  };
}
function moveDetails(f) {
  if (f?.content)
    return { type: "move_content", list: state.site.model.content };
  if (f?.element)
    return {
      type: "move_element",
      list: f.section.elements,
      sectionId: f.section.id,
    };
  if (f?.section)
    return { type: "move_section", list: f.page.sections, pageId: f.page.id };
  throw Error("Choose content or a section to move.");
}
async function shiftCanvas(id, delta) {
  const f = locate(state.site.model, id),
    details = moveDetails(f);
  const section =
    f.section?.type === "products"
      ? f.section
      : f.content
        ? state.site.model.pages
            .find((p) => p.id === state.page)
            ?.sections.find((s) => s.type === "products")
        : null;
  if (section && (f.content || f.element?.type === "item")) {
    const ids = [
      ...section.elements.filter((e) => e.type === "item"),
      ...state.site.model.content,
    ].map((e) => e.id);
    const order = [...(section.itemOrder || []), ...ids].filter(
      (id, i, all) => ids.includes(id) && all.indexOf(id) === i,
    );
    const index = order.indexOf(id),
      next = Math.max(0, Math.min(order.length - 1, index + delta));
    if (index === next) return;
    order.splice(index, 1);
    order.splice(next, 0, id);
    await change(
      [{ type: "reorder_items", target: section.id, value: order }],
      "Moved menu item",
    );
    return;
  }
  const index = details.list.findIndex((n) => n.id === id),
    next = Math.max(0, Math.min(details.list.length - 1, index + delta));
  if (index === next) return;
  const { list, ...operation } = details;
  await change([{ ...operation, target: id, index: next }], "Moved content");
}
async function dropCanvas(d) {
  const f = locate(state.site.model, d.id),
    dest = locate(state.site.model, d.destination);
  if (!f || !dest || d.id === d.destination) return;
  const section =
    locate(state.site.model, d.sectionId)?.section || dest.section;
  if (
    section?.type === "products" &&
    (f.content || f.element?.type === "item") &&
    (dest.content || dest.element?.type === "item") &&
    (!f.element || f.section.id === section.id)
  ) {
    const ids = [
      ...section.elements.filter((e) => e.type === "item"),
      ...state.site.model.content,
    ].map((e) => e.id);
    const order = [...(section.itemOrder || []), ...ids].filter(
      (id, i, all) => ids.includes(id) && all.indexOf(id) === i && id !== d.id,
    );
    const index = order.indexOf(d.destination);
    if (index < 0) return;
    order.splice(index + (d.after ? 1 : 0), 0, d.id);
    await change(
      [{ type: "reorder_items", target: section.id, value: order }],
      "Rearranged menu items",
    );
    return;
  }
  let op, list;
  if (f.content && dest.content) {
    op = { type: "move_content" };
    list = state.site.model.content;
  } else if (f.element && dest.section && !dest.content) {
    op = { type: "move_element", sectionId: dest.section.id };
    list = dest.section.elements;
  } else if (f.section && !f.element && dest.section && !dest.element) {
    op = { type: "move_section", pageId: dest.page.id };
    list = dest.page.sections;
  } else
    throw Error("Move items within their list, or content into a section.");
  list = list.filter((n) => n.id !== d.id);
  const i = list.findIndex((n) => n.id === d.destination);
  await change(
    [
      {
        ...op,
        target: d.id,
        index: i < 0 ? list.length : i + (d.after ? 1 : 0),
      },
    ],
    "Rearranged content",
  );
}
function moveSelectedPanel() {
  const f = locate(state.site.model, state.selected),
    details = moveDetails(f);
  const itemSection =
    f.section?.type === "products" && f.element?.type === "item"
      ? f.section
      : f.content
        ? state.site.model.pages
            .find((p) => p.id === state.page)
            ?.sections.find((s) => s.type === "products")
        : null;
  if (itemSection) {
    const nodes = [
      ...itemSection.elements.filter((e) => e.type === "item"),
      ...state.site.model.content,
    ];
    details.list = [...nodes].sort(
      (a, b) =>
        (itemSection.itemOrder?.indexOf(a.id) ?? nodes.indexOf(a)) -
        (itemSection.itemOrder?.indexOf(b.id) ?? nodes.indexOf(b)),
    );
  }
  const destinations = f.element
    ? state.site.model.pages.flatMap((p) =>
        p.sections.map((section) => ({
          id: section.id,
          label:
            p.title +
            " · " +
            (section.elements.find((e) => e.type === "heading")?.text ||
              section.type),
          length: section.elements.length,
        })),
      )
    : [];
  showPanel(
    "Move content",
    `<form id="move-form" class="stack-form"><p>Drag the six-dot handle on your website, or choose a position here. The layout stays responsive.</p>${f.element ? `<label>Section<select name="sectionId">${destinations.map((s) => `<option value="${esc(s.id)}" ${s.id === f.section.id ? "selected" : ""}>${esc(s.label)}</option>`).join("")}</select></label>` : ""}<label>Position<input name="position" type="number" min="1" max="${Math.max(details.list.length, ...destinations.map((s) => s.length + 1))}" value="${details.list.findIndex((n) => n.id === f.node.id) + 1}" required></label><button class="primary">Move here</button></form>`,
  );
  $("#move-form").onsubmit = (e) => {
    e.preventDefault();
    const data = new FormData(e.target),
      { list, ...op } = details;
    if (
      itemSection &&
      (!data.get("sectionId") || data.get("sectionId") === itemSection.id)
    ) {
      const order = details.list
        .map((n) => n.id)
        .filter((id) => id !== f.node.id);
      order.splice(Number(data.get("position")) - 1, 0, f.node.id);
      run(async () => {
        await change(
          [{ type: "reorder_items", target: itemSection.id, value: order }],
          "Moved menu item",
        );
        panel.close();
      });
      return;
    }
    run(async () => {
      await change(
        [
          {
            ...op,
            target: f.node.id,
            sectionId: data.get("sectionId") || op.sectionId,
            index: Number(data.get("position")) - 1,
          },
        ],
        "Moved content",
      );
      panel.close();
    });
  };
}
async function moveElement(delta) {
  await shiftCanvas(state.selected, delta);
  editSelected();
}

document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-action]");
  if (b) {
    e.preventDefault();
    run(() => actions[b.dataset.action]?.(b));
  }
  if (e.target.closest(".logo")) {
    e.preventDefault();
    if (state.user) home();
    else landing();
  }
});
document.addEventListener("keydown", (e) => {
  if (
    (e.ctrlKey || e.metaKey) &&
    e.key === "z" &&
    state.site &&
    state.view === "website" &&
    !/INPUT|TEXTAREA/.test(e.target.tagName)
  ) {
    e.preventDefault();
    run(() => travel(e.shiftKey));
  }
});
window.addEventListener("offline", () =>
  toast("You’re offline. Reconnect to save changes or use Clay’s AI."),
);
async function init() {
  landing();
  try {
    const s = await api.session();
    if (s) {
      state.user = s.user;
      state.sites = await api.listSites();
      await loadAvatar();
      if (location.hash === "#website") website();
      else if (location.hash === "#profile") profile();
      else home();
    }
    if (api.configured()) {
      const c = await api.client();
      c.auth.onAuthStateChange((event, s) => {
        if (event === "SIGNED_OUT") {
          state.user = null;
          state.site = null;
          state.sites = [];
          landing();
        } else if (event === "SIGNED_IN" && !state.user) {
          state.user = s.user;
          setTimeout(
            () =>
              run(async () => {
                state.sites = await api.listSites();
                await loadAvatar();
                home();
              }),
            0,
          );
        }
      });
    }
  } catch (e) {
    toast(errorText(e));
  }
  if ("serviceWorker" in navigator)
    navigator.serviceWorker.register("./sw.js").catch(() => {});
}
init();

async function compressPhoto(file) {
  if (
    file.size > 5 * 1024 * 1024 ||
    !["image/jpeg", "image/png", "image/webp"].includes(file.type)
  )
    throw Error("Choose a JPG, PNG, or WebP photo under 5 MB.");
  const bitmap = await createImageBitmap(file);
  let width = Math.min(1200, bitmap.width),
    quality = 0.8,
    result;
  const c = document.createElement("canvas");
  for (let i = 0; i < 8; i++) {
    c.width = width;
    c.height = Math.round((bitmap.height * width) / bitmap.width);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(bitmap, 0, 0, c.width, c.height);
    result = c.toDataURL("image/jpeg", quality);
    if (result.length < 95000) break;
    quality = Math.max(0.4, quality - 0.1);
    width = Math.round(width * 0.85);
  }
  bitmap.close();
  return result;
}

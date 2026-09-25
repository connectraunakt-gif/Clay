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
  return `<header class="app-header">${logo()}${state.user || state.demo ? `<nav aria-label="Main navigation">${["Home", "Website", "Profile"].map((n) => btn(n.toLowerCase(), n, active === n.toLowerCase() ? "active" : "")).join("")}</nav>` : '<span class="header-note">A little idea. A whole new beginning.</span>'}<div class="header-end">${btn("theme", icon("moon"), "icon-button", 'aria-label="Switch colour theme"')}${state.user ? btn("profile", esc((state.user.user_metadata?.name || state.user.email || "You").slice(0, 1).toUpperCase()), "avatar") : state.demo ? '<span class="demo-label">Example workspace</span>' : btn("login", "Log in", "text-button")}</div></header>`;
}
function landing() {
  state.demo = false;
  state.site = null;
  state.sites = [];
  app.innerHTML =
    header() +
    `<main id="main" class="landing"><section class="welcome"><div class="welcome-copy"><p class="eyebrow"><span class="tiny-mark">✳</span> BIG IDEAS START SMALL</p><h1>Your business<br>deserves a<br><em>digital home.</em></h1><p class="lede">Create, customize, and grow your website<br class="desktop-only"> without the technical complexity.</p>${btn("signup", "Create my website " + icon("arrow"), "primary large")}<p class="under-cta">Your ideas. Your website. Entirely yours.</p></div><div class="showcase" aria-label="Example website designs"><div class="orbit-label"><span></span> A space for every kind of business</div><div class="sample-window"><div class="browser-bar"><i></i><i></i><i></i><span>Made with Clay</span></div><div class="sample-interior"><div class="sample-nav"><b>forma<span>®</span></b><span>Our story &nbsp; Collection &nbsp; Contact</span></div><div class="sample-hero"><div><p class="small-caps">THOUGHTFULLY MADE</p><h2>Less, but<br>with meaning.</h2><p>Honest materials. Quiet details.<br>Furniture for a life well lived.</p><span class="sample-button">Discover the collection ↗</span></div><img src="https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&w=900&q=85" alt="Natural wood shelving in a thoughtfully designed interior"></div><div class="sample-bottom">Made slowly. &nbsp; Loved for a lifetime. <span>01 — 03</span></div></div></div><div class="floating-sample"><div class="floral-photo"></div><div><span class="small-caps">THE EVERYDAY, IN BLOOM</span><h3>Wild & wonderful.</h3><span>Flowers with a little more feeling.</span></div></div><div class="made-note"><span>✳</span> Built around you, by Clay.</div></div></section><section class="landing-bottom"><div><span class="step-no">01</span><h2>Tell us your story.</h2><p>You know your business.<br>That’s all you need to bring.</p></div><div><span class="step-no">02</span><h2>Make it your own.</h2><p>Ask for a change or make it yourself.<br>Every detail is in your hands.</p></div><div><span class="step-no">03</span><h2>Open your doors.</h2><p>One place to create, publish,<br>and grow your presence.</p></div><div class="try-editor">Curious how it feels?${btn("demo", "Explore the editor " + icon("arrow"), "text-button")}</div></section></main><footer class="landing-footer"><span>Built for real people. And their businesses.</span><span>Meet your next chapter.</span></footer>`;
  if (
    !sessionStorage.getItem("clay-intro") &&
    !matchMedia("(prefers-reduced-motion: reduce)").matches
  )
    splash();
}
function splash() {
  sessionStorage.setItem("clay-intro", "1");
  const el = document.createElement("div");
  el.className = "splash";
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = `<div class="building"><svg class="stickman" viewBox="0 0 120 160"><circle cx="52" cy="27" r="13"/><path d="M52 40v54m0-38 30 14 18-22M52 57 25 81m27 13-25 45m25-45 30 45"/></svg><div class="blocks">${Array.from({ length: 9 }, (_, i) => `<i style="--i:${i}"></i>`).join("")}</div></div><img class="splash-logo" src="assets/logo.png" alt="">`;
  document.body.append(el);
  setTimeout(() => el.remove(), 3400);
}
function auth(signup = true) {
  state.signup = signup;
  app.innerHTML =
    header() +
    `<main id="main" class="auth-layout"><div class="auth-art"><p class="eyebrow">YOUR NEXT CHAPTER</p><h1>Something great<br>is taking shape.</h1><div class="abstract-blocks"><i></i><i></i><i></i><i></i></div><p>A home for your business.<br>A little more room to grow.</p></div><section class="auth-form">${logo()}<h1>${signup ? "Let’s make it yours." : "Welcome home."}</h1><p>${signup ? "Your business has a story. Let’s give it a home." : "Pick up right where you left off."}</p>${btn("google", '<span class="google-g" aria-hidden="true">G</span>Continue with Google', "outline full")}<div class="divider"><span>or</span></div><form id="email-form"><label for="email">Email address</label><input id="email" type="email" name="email" autocomplete="email" placeholder="you@yourbusiness.com" required><button class="primary full">Continue with email ${icon("arrow")}</button></form><p id="auth-status" role="status" class="form-status"></p><p class="auth-switch">${signup ? "Already have an account?" : "New to Clay?"} ${btn(signup ? "login" : "signup", signup ? "Log in" : "Create an account", "text-button")}</p><small>We’ll send you a secure sign-in link.<br>No password to remember.</small></section></main>`;
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
    `<main id="main" class="home"><section class="home-start"><div class="home-wordmark">${logo()}</div><p class="eyebrow">LET’S MAKE SOMETHING THAT’S YOURS</p><h1>Tell us about your business.</h1><p>Start with what you do. We’ll take it from there.</p><form id="business-form" class="prompt-box"><label class="sr-only" for="business">Describe your business</label><textarea id="business" name="business" maxlength="5000" placeholder="I run a small business called…" required></textarea><div><span>A few words are all it takes.</span><button class="send" aria-label="Start creating">${icon("send")}</button></div></form><div class="home-hints"><span>Make it personal.</span><span>Make it professional.</span><span>Make it yours.</span></div><p class="plan-note">Your account includes one website, with all features.</p></section><section class="your-sites"><div class="section-heading"><h2>Your digital home</h2><span>${state.sites.length} of 1 website</span></div>${siteList()}</section></main>`;
  $("#business-form").onsubmit = async (e) => {
    e.preventDefault();
    if (state.sites.length) {
      toast(
        "Your account includes one website. Open your website below to keep shaping it.",
      );
      $(".your-sites").scrollIntoView({ behavior: "smooth" });
      return;
    }
    state.description = $("#business").value;
    await busy(e.submitter, async () => {
      const result = await api.invoke("questions", {
        description: state.description,
      });
      state.questions = (result.questions || []).slice(0, 5);
      state.answers = [];
      state.question = 0;
      if (!state.questions.length) await generate();
      else question();
    });
  };
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
    header("home") +
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
async function generate() {
  app.innerHTML =
    header("website") +
    `<main id="main" class="generation"><span class="clay-spinner">✳</span><h1>I’ve got everything I need.<br>Let’s build it.</h1><p>Finding the right words, colours, and a space that feels like you.</p><div class="building-preview"><div></div><div></div><div></div></div></main>`;
  try {
    const r = await api.invoke("generate", {
      description: state.description,
      answers: state.answers,
    });
    const site = await api.createSite(r.model);
    state.sites = [site];
    openSite(site, true);
  } catch (e) {
    home();
    toast(errorText(e));
  }
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
  workspace(progressive);
}
function workspace(progressive = false) {
  if (!state.site) {
    toast("Create or open a website first.");
    home();
    return;
  }
  const m = state.site.model;
  app.innerHTML =
    header("website") +
    `<main id="main" class="workspace ${state.preview ? "previewing" : ""}"><div class="workspace-bar"><div class="website-title">${btn("pages", esc(m.name) + " <span>⌄</span>", "text-button")}<span id="save-status">${statusLabel()}</span></div><div class="device-controls" aria-label="Preview size">${btn("desktop", icon("desktop"), "icon-button " + (state.device === "desktop" ? "active" : ""), 'aria-label="Desktop preview"')}${btn("mobile", icon("mobile"), "icon-button " + (state.device === "mobile" ? "active" : ""), 'aria-label="Mobile preview"')}</div><div class="workspace-actions">${btn("history", "Previous versions", "text-button")}${btn("preview", state.preview ? "Back to editing" : "Preview", "outline")}${btn("publish", "Publish " + icon("arrow"), "primary")}</div></div><div class="canvas-surround"><div class="canvas-top"><div><span id="page-name">${esc(m.pages.find((p) => p.id === state.page)?.title || "Home")}</span><span> / </span>${btn("pages", "Pages", "text-button")}</div><div>${btn("undo", icon("undo"), "icon-button", 'aria-label="Undo" ' + (!state.undo.length ? "disabled" : ""))}${btn("redo", icon("redo"), "icon-button", 'aria-label="Redo" ' + (!state.redo.length ? "disabled" : ""))}${btn("tools", "Website tools", "text-button")}</div></div><div class="canvas ${state.device === "mobile" ? "mobile" : ""}"><iframe id="canvas" title="Your website" sandbox="allow-scripts"></iframe></div></div>${state.preview ? "" : `<div class="editor-dock"><div id="selection" class="selection-context"><span>Select something to shape it, or ask for a change.</span>${btn("sections", "Arrange sections", "text-button")}</div><form id="edit-form"><label class="sr-only" for="edit-prompt">Ask Clay to change anything</label><textarea id="edit-prompt" rows="1" maxlength="4000" placeholder="Ask Clay to change anything…" required></textarea><button class="send" aria-label="Apply change">${icon("send")}</button></form><div class="dock-footer"><span>${state.demo ? "Example website · try direct editing" : "Your ideas, brought to life."}</span><span>Double-click text to edit directly</span></div></div>`}</main>`;
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
      await busy(e.submitter, async () => {
        const r = await api.invoke("edit", {
          siteId: state.site.id,
          prompt,
          selected: state.selected,
          pageId: state.page,
        });
        if (r.question) {
          showPanel("A little more detail", `<p>${esc(r.question)}</p>`);
          return;
        }
        const ops = r.operations || [];
        const publish = ops.some((o) => o.type === "publish_website");
        await change(
          ops.filter((o) => o.type !== "publish_website"),
          r.summary || prompt,
        );
        if (publish) await publishSite();
        else toast(r.summary || "Your website has been updated.");
      });
    };
}
function renderCanvas(progressive = false) {
  $("#canvas").srcdoc = renderDocument(state.site.model, state.page, {
    editing: true,
    preview: state.preview,
    progressive,
  });
}
function selection() {
  const f = locate(state.site.model, state.selected);
  if (!f) return;
  $("#selection").innerHTML =
    `<span><i></i> ${esc(f.element ? f.element.type : f.section ? f.section.type + " section" : state.selected === "navigation" ? "Navigation" : "Page")} selected</span><div>${btn("edit-selected", "Edit", "text-button")}${btn("restore-selected", "Previous versions", "text-button")}${btn("clear-selection", icon("close"), "icon-button", 'aria-label="Clear selection"')}</div>`;
}
window.addEventListener("message", async (e) => {
  if (e.source !== $("#canvas")?.contentWindow || !state.site) return;
  const d = e.data;
  if (state.preview && d?.type !== "clay-page") return;
  if (d?.type === "clay-select" && locate(state.site.model, d.id)) {
    state.selected = d.id;
    selection();
  }
  if (d?.type === "clay-text" && locate(state.site.model, d.id)?.element) {
    try {
      await change(
        [{ type: "edit_text", target: d.id, value: d.text }],
        "Edited text",
      );
    } catch (err) {
      toast(errorText(err));
      renderCanvas();
    }
  }
  if (
    d?.type === "clay-page" &&
    state.site.model.pages.some((p) => p.id === d.id)
  ) {
    state.page = d.id;
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
    workspace();
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
  if (state.selected === "navigation") {
    navigation();
    return;
  }
  if (!f.element) {
    showPanel(
      "Edit section",
      `<p>Select the text, image, or button you want to change.</p>${(f.section?.elements || []).map((e) => btn("choose-element", esc((e.text || e.alt || e.type).slice(0, 70)), "tool-row", `data-id="${e.id}"`)).join("")}<form id="section-style" class="stack-form"><label>Layout<select name="layout">${["stack", "split", "center", "grid"].map((l) => `<option ${f.section.layout === l ? "selected" : ""}>${l}</option>`).join("")}</select></label><label class="color-label">Section colour<input type="color" name="background" value="${f.section.background || state.site.model.theme.background}"></label><button class="outline">Apply to section</button></form><form id="element-add" class="stack-form"><label>Add content<select name="type"><option value="text">Text</option><option value="heading">Heading</option><option value="image">Image</option><option value="button">Button</option><option value="item">Service or item</option></select></label><button class="outline">Add content ＋</button></form>`,
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
    `<form id="element-form" class="stack-form">${el.type === "image" ? `<label>Choose a photo<input name="photo" type="file" accept="image/jpeg,image/png,image/webp"></label><details><summary>Or use an image link</summary><label>Image link<input name="src" value="${esc(el.src)}" placeholder="https://…"></label></details><label>Describe the image<input name="alt" value="${esc(el.alt)}" required></label>` : `<label>${el.type === "button" ? "Button label" : "Text"}<textarea name="text" required>${esc(el.text)}</textarea></label>${el.type === "button" ? `<label>Where should it go?<input name="href" value="${esc(el.href)}" placeholder="https://… or #section"></label>` : ""}${el.type === "item" ? `<label>Description<textarea name="description">${esc(el.description)}</textarea></label><label>Price<input name="price" value="${esc(el.price)}"></label>` : ""}`}<button class="primary">Save changes</button></form><div class="element-order">${btn("element-up", "Move earlier", "outline")}${btn("element-down", "Move later", "outline")}${btn("delete-element", "Remove content", "danger-text")}</div>`,
  );
  $("#element-form").onsubmit = (ev) => {
    ev.preventDefault();
    run(async () => {
      const form = new FormData(ev.target),
        value = Object.fromEntries(form);
      if (el.type === "image") {
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
    `<form id="content-form" class="stack-form"><label>Name<input name="name" value="${esc(c.name)}" required maxlength="200"></label><label>Description<textarea name="description">${esc(c.description)}</textarea></label><label>Price<input name="price" value="${esc(c.price)}" placeholder="₹45,000"></label><button class="primary">Save item</button></form>`,
  );
  $("#content-form").onsubmit = (e) => {
    e.preventDefault();
    run(() =>
      change(
        [
          {
            type: id ? "update_content" : "create_content",
            target: id,
            value: {
              ...Object.fromEntries(new FormData(e.target)),
              id: id || uid(),
            },
          },
        ],
        id ? "Updated item" : "Added item",
      ).then(content),
    );
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
    '<span class="clay-spinner">✳</span><p>Publishing your website. Your last live version stays available.</p>',
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
function profile() {
  app.innerHTML =
    header("profile") +
    `<main id="main" class="profile"><div class="profile-heading"><div><p class="eyebrow">YOUR LITTLE CORNER</p><h1>${esc(state.user?.user_metadata?.name || "Make yourself at home.")}</h1><p>${esc(state.user?.email || "Explore your website and its possibilities.")}</p></div>${btn("settings", "Settings", "outline")}</div><section><div class="section-heading"><h2>Your website</h2><span>One website. All yours.</span></div>${siteList()}</section><section class="activity"><div class="section-heading"><h2>A little perspective</h2><span>Last 30 days</span></div><div id="activity-content"><p>${state.sites.length ? "Loading your website activity…" : "Publish your website to start seeing visitors and messages here."}</p></div></section></main>`;
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
  website: () => (state.site ? workspace() : home()),
  profile,
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
async function moveElement(delta) {
  const f = locate(state.site.model, state.selected);
  if (!f?.element) return;
  const index = f.section.elements.findIndex((e) => e.id === f.element.id);
  await change(
    [
      {
        type: "move_element",
        target: f.element.id,
        sectionId: f.section.id,
        index: Math.max(
          0,
          Math.min(f.section.elements.length - 1, index + delta),
        ),
      },
    ],
    "Moved content",
  );
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
      home();
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

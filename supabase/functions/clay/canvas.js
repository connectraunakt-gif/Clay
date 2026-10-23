// This script runs only inside the isolated editing canvas. Published sites omit it.
export function canvasScript(preview = false, initial = {}) {
  return `(${installCanvas.toString()})(${JSON.stringify(preview)},${JSON.stringify(initial).replace(/</g, "\\u003c")})`;
}
function installCanvas(preview, initial) {
  const send = (data) => parent.postMessage(data, "*");
  if (preview) {
    document.addEventListener("click", (e) => {
      const link = e.target.closest("[data-page]");
      if (link) {
        e.preventDefault();
        send({ type: "clay-page", id: link.dataset.page });
      }
    });
    document
      .querySelector("form")
      ?.addEventListener("submit", (e) => e.preventDefault());
    return;
  }
  let active,
    dragged,
    dropTarget,
    pressed = false,
    after = false,
    locked = false;
  const bar = document.createElement("div");
  bar.className = "clay-toolbar";
  bar.setAttribute("role", "toolbar");
  bar.setAttribute("aria-label", "Edit selected content");
  bar.innerHTML =
    '<span class="clay-kind"></span><button type="button" data-tool="edit">Edit</button><button type="button" data-tool="style">Style</button><button type="button" data-tool="move">Move</button><button type="button" data-tool="earlier" aria-label="Move earlier">↑</button><button type="button" data-tool="later" aria-label="Move later">↓</button><span role="button" tabindex="0" data-tool="drag" draggable="true" aria-label="Drag to rearrange" title="Drag to rearrange">⠿</span><button type="button" data-tool="section">Section</button>';
  document.body.append(bar);
  const id = (node) => node?.dataset.clayId;
  const kind = (node) =>
    node?.tagName === "SECTION"
      ? "section"
      : node?.tagName === "HEADER"
        ? "navigation"
        : node?.closest(".catalogue")
          ? "item"
          : "element";
  const position = () => {
    if (pressed) return;
    if (!active || !active.isConnected) {
      bar.hidden = true;
      return;
    }
    const r = active.getBoundingClientRect();
    bar.hidden = r.bottom < 0 || r.top > innerHeight;
    if (bar.hidden) return;
    bar.style.left =
      Math.max(
        8,
        Math.min(
          innerWidth - bar.offsetWidth - 8,
          r.right - bar.offsetWidth - 8,
        ),
      ) + "px";
    bar.style.top =
      Math.max(8, Math.min(innerHeight - bar.offsetHeight - 8, r.top + 8)) +
      "px";
  };
  function activate(node, select = false) {
    if (!node) return;
    document
      .querySelectorAll(".clay-hover")
      .forEach((n) => n.classList.remove("clay-hover"));
    active = node;
    bar.dataset.target = id(node);
    active.classList.add("clay-hover");
    bar.hidden = false;
    const k = kind(node);
    bar.querySelector(".clay-kind").textContent =
      k === "element"
        ? node.tagName === "FIGURE"
          ? "Image"
          : "Content"
        : k[0].toUpperCase() + k.slice(1);
    for (const b of bar.querySelectorAll("button"))
      b.hidden = k === "navigation" && !["edit"].includes(b.dataset.tool);
    bar.querySelector("[data-tool=section]").hidden =
      !node.closest("section") || k === "section";
    if (select) {
      locked = true;
      document
        .querySelectorAll(".selected")
        .forEach((n) => n.classList.remove("selected"));
      node.classList.add("selected");
      send({ type: "clay-select", id: id(node) });
    }
    position();
  }
  bar.hidden = true;
  bar.addEventListener("pointerdown", (e) => {
    if (e.target.dataset.tool === "drag") pressed = true;
  });
  document.addEventListener("pointerup", () => {
    pressed = false;
    position();
  });
  document.addEventListener("pointerover", (e) => {
    if (
      bar.contains(e.target) ||
      dragged ||
      e.buttons ||
      e.target.isContentEditable
    )
      return;
    const node = e.target.closest("[data-clay-id]");
    if (node && node !== active && node.contains(active)) return;
    if (node) {
      locked = false;
      activate(node);
    }
  });
  document.addEventListener("focusin", (e) => {
    if (!bar.contains(e.target)) activate(e.target.closest("[data-clay-id]"));
  });
  document.addEventListener("click", (e) => {
    if (bar.contains(e.target)) return;
    if (e.target.isContentEditable) return;
    e.preventDefault();
    const link = e.target.closest("[data-page]");
    if (link) {
      send({ type: "clay-page", id: link.dataset.page });
      return;
    }
    const node = e.target.closest("[data-clay-id]");
    if (node) activate(node, true);
    else if (!locked) bar.hidden = true;
  });
  document.addEventListener("submit", (e) => e.preventDefault());
  bar.addEventListener("keydown", (e) => {
    if (e.target.dataset.tool === "drag" && ["Enter", " "].includes(e.key)) {
      e.preventDefault();
      send({ type: "clay-edit", id: id(active), mode: "move" });
    }
  });
  bar.addEventListener("click", (e) => {
    const tool = e.target.closest("[data-tool]")?.dataset.tool;
    if (!tool || !active) return;
    if (tool === "drag") {
      send({ type: "clay-edit", id: id(active), mode: "move" });
      return;
    }
    if (tool === "section") {
      activate(active.closest("section"), true);
      return;
    }
    activate(active, true);
    if (["edit", "style", "move"].includes(tool))
      send({ type: "clay-edit", id: id(active), mode: tool });
    if (tool === "earlier" || tool === "later")
      send({
        type: "clay-shift",
        id: id(active),
        delta: tool === "earlier" ? -1 : 1,
      });
  });
  function clearDrop() {
    document
      .querySelectorAll(".clay-drop-before,.clay-drop-after,.clay-dragging")
      .forEach((n) =>
        n.classList.remove(
          "clay-drop-before",
          "clay-drop-after",
          "clay-dragging",
        ),
      );
  }
  bar.addEventListener("dragstart", (e) => {
    if (e.target.dataset.tool !== "drag" || !active) {
      e.preventDefault();
      return;
    }
    dragged = active;
    activate(active, true);
    e.dataTransfer.setData("text/plain", id(dragged));
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setDragImage(dragged, 20, 20);
    dragged.classList.add("clay-dragging");
  });
  document.addEventListener("dragover", (e) => {
    if (!dragged) return;
    let node = e.target.closest("[data-clay-id]");
    const k = kind(dragged);
    if (k === "section") node = node?.closest("section");
    if (k === "item") node = node?.closest(".catalogue [data-clay-id]");
    if (k === "element" && node?.closest(".catalogue"))
      node = node.closest("section");
    if (k === "element" && node?.tagName === "HEADER") node = null;
    if (!node || node === dragged || dragged.contains(node)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    document
      .querySelectorAll(".clay-drop-before,.clay-drop-after")
      .forEach((n) =>
        n.classList.remove("clay-drop-before", "clay-drop-after"),
      );
    dropTarget = node;
    const r = node.getBoundingClientRect();
    after = e.clientY > r.top + r.height / 2;
    node.classList.add(after ? "clay-drop-after" : "clay-drop-before");
  });
  document.addEventListener("drop", (e) => {
    if (!dragged) return;
    e.preventDefault();
    if (dropTarget)
      send({
        type: "clay-move",
        sectionId: dropTarget.closest("section")?.dataset.clayId,
        id: id(dragged),
        destination: id(dropTarget),
        after,
      });
    clearDrop();
    pressed = false;
    dragged = dropTarget = null;
  });
  document.addEventListener("dragend", () => {
    clearDrop();
    pressed = false;
    dragged = dropTarget = null;
  });
  document.addEventListener("dblclick", (e) => {
    if (bar.contains(e.target)) return;
    const node = e.target.closest("[data-clay-id]"),
      field = e.target.closest("[data-clay-field]");
    const text = field || node;
    if (!node || !text || !/^(H1|H2|H3|P|STRONG|A)$/.test(text.tagName)) return;
    e.preventDefault();
    activate(node, true);
    bar.hidden = true;
    const original = text.innerText;
    text.contentEditable = "true";
    text.focus();
    const key = (ev) => {
      if (ev.key === "Escape") {
        text.innerText = original;
        text.blur();
      }
    };
    text.addEventListener("keydown", key);
    text.addEventListener(
      "blur",
      () => {
        text.contentEditable = "false";
        text.removeEventListener("keydown", key);
        if (text.innerText !== original)
          send({
            type: "clay-text",
            id: id(node),
            field: field?.dataset.clayField || "text",
            text: text.innerText,
          });
        position();
      },
      { once: true },
    );
  });
  document.addEventListener("keydown", (e) => {
    if (e.target.isContentEditable || bar.contains(e.target)) return;
    const node = e.target.closest("[data-clay-id]");
    if (node && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      activate(node, true);
      bar.querySelector("[data-tool=edit]").focus();
    }
    if (node && e.altKey && ["ArrowUp", "ArrowDown"].includes(e.key)) {
      e.preventDefault();
      send({
        type: "clay-shift",
        id: id(node),
        delta: e.key === "ArrowUp" ? -1 : 1,
      });
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      send({ type: "clay-history", redo: e.shiftKey });
    }
  });
  let timer;
  addEventListener("scroll", () => {
    position();
    clearTimeout(timer);
    timer = setTimeout(
      () => send({ type: "clay-viewport", scrollY: window.scrollY }),
      100,
    );
  });
  addEventListener("resize", position);
  const restore = () => {
    window.scrollTo(0, Number(initial.scrollY) || 0);
    const node = [...document.querySelectorAll("[data-clay-id]")].find(
      (n) => id(n) === initial.selected,
    );
    if (node) activate(node, true);
  };
  requestAnimationFrame(() => {
    restore();
    send({ type: "clay-ready" });
  });
}
export const canvasCss = `
[data-clay-id]{position:relative;cursor:pointer;scroll-margin:60px}
[data-clay-id]:hover{outline:none}.clay-hover,[data-clay-id].selected{outline:2px solid #345f89!important;outline-offset:4px}
[contenteditable=true]{cursor:text;outline:2px solid #345f89!important;min-height:1em}
.clay-toolbar{position:fixed;z-index:2147483647;display:flex;align-items:center;gap:2px;padding:4px;background:#fff;color:#213b54;border:1px solid #b5c5d4;border-radius:9px;box-shadow:0 4px 18px #122b4426;font:13px Inter,Arial,sans-serif;max-width:calc(100vw - 16px)}
.clay-toolbar[hidden],.clay-toolbar [hidden]{display:none!important}.clay-toolbar button,.clay-toolbar [data-tool=drag]{appearance:none;border:0;background:transparent;color:#213b54;border-radius:5px;min-height:36px;min-width:36px;padding:6px 9px;font:600 13px Inter,Arial,sans-serif;cursor:pointer;margin:0;white-space:nowrap}.clay-toolbar button:hover,.clay-toolbar button:focus-visible{background:#e9f0f7;outline:2px solid #345f89;outline-offset:-2px}.clay-toolbar [data-tool=drag]{cursor:grab;font-size:21px}.clay-kind{padding:0 8px;font-size:11px;color:#526779;border-right:1px solid #d8e0e8}.clay-drop-before{box-shadow:0 -5px 0 #2f78b7!important}.clay-drop-after{box-shadow:0 5px 0 #2f78b7!important}.clay-dragging{opacity:.45}
@media(max-width:480px){.clay-toolbar{flex-wrap:wrap}.clay-kind{display:none}.clay-toolbar button{padding:6px;min-width:32px}}
@media(pointer:coarse){.clay-toolbar button{min-height:44px}.clay-kind{display:none}}
`;

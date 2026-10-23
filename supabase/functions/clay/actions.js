import { uid } from "./model.js";
const allowed = new Set([
  "create_page",
  "delete_page",
  "create_section",
  "delete_section",
  "update_section",
  "move_section",
  "move_element",
  "move_content",
  "reorder_items",
  "update_style",
  "edit_text",
  "replace_image",
  "change_colors",
  "change_typography",
  "change_spacing",
  "update_navigation",
  "create_content",
  "update_content",
  "delete_content",
  "update_element",
  "create_element",
  "delete_element",
  "update_info",
  "publish_website",
]);
export function normalizeOperations(operations) {
  if (!Array.isArray(operations) || operations.length > 60)
    throw Error("Clay could not understand that change. Please try again.");
  return operations.map((operation) => {
    if (!operation || typeof operation !== "object" || Array.isArray(operation))
      throw Error("This change is not supported.");
    if (allowed.has(operation.type))
      return withIdentifiers(structuredClone(operation));
    const keys = Object.keys(operation);
    if (keys.length !== 1 || !allowed.has(keys[0]))
      throw Error("This change is not supported.");
    const value = operation[keys[0]];
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw Error("This change is not supported.");
    return withIdentifiers({ ...structuredClone(value), type: keys[0] });
  });
}

function withIdentifiers(operation) {
  const identify = (node) => {
    if (node && typeof node === "object" && !node.id) node.id = uid();
  };
  if (
    [
      "create_element",
      "create_content",
      "create_section",
      "create_page",
    ].includes(operation.type)
  )
    identify(operation.value);
  if (operation.type === "create_section")
    for (const element of operation.value?.elements || []) identify(element);
  if (operation.type === "create_page")
    for (const section of operation.value?.sections || []) {
      identify(section);
      for (const element of section.elements || []) identify(element);
    }
  return operation;
}

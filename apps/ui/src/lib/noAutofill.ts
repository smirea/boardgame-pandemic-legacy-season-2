// Each password manager has its own opt-out; browsers' own autofill reads `autocomplete`.
const OPT_OUT: Record<string, string> = {
  autocomplete: "off",
  "data-1p-ignore": "true",
  "data-lpignore": "true",
  "data-bwignore": "true",
  "data-form-type": "other",
  "data-protonpass-ignore": "true",
};

const FIELDS = "input, textarea, select, form";

function stamp(root: ParentNode): void {
  const found =
    root instanceof Element && root.matches(FIELDS)
      ? [root, ...root.querySelectorAll(FIELDS)]
      : root.querySelectorAll(FIELDS);
  for (const field of found)
    for (const [name, value] of Object.entries(OPT_OUT)) field.setAttribute(name, value);
}

/** Keeps every password manager off every field in the app, including ones mounted later. */
export function blockAutofill(): () => void {
  stamp(document);
  const observer = new MutationObserver((records) => {
    for (const record of records)
      for (const node of record.addedNodes) if (node instanceof Element) stamp(node);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  return () => observer.disconnect();
}

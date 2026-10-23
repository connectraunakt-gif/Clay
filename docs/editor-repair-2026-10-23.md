# Editor repair — 23 October 2026

- **Visible canvas controls (recognition over recall; direct manipulation):** hover or focus any content element for Edit, Style, Move, ordering arrows and a drag handle. Section controls remain available from the same toolbar.
- **Rearranging with feedback (visibility of system status; user control):** show the insertion edge during dragging, save one undoable change per drop, and preserve the selection and canvas scroll position. Older menu cards and catalogue entries can be interleaved. Move controls and keyboard arrows provide an alternative to dragging.
- **Focused appearance editing (locality; consistency):** colour, type size, alignment and spacing apply to the selected content. Unchanged fields do not overwrite existing styling. Text can also be edited in place; image uploads and links work for individual items.
- **Readable menu rows (proximity; responsive reflow):** full-width list layouts group the image, name, description and price together; mobile layouts stack the image above its details. Cards use quieter borders, consistent spacing and attribution for retrieved photos.

AI edits use validated operations, precise target identifiers and one correction attempt. Photo search failures retain existing photos and report a useful message. Booking, ordering and payment processing remain unsupported; the editor must explain that limitation instead of inventing working controls.

Validation: unit tests; real Chromium interactions in a temporary account (native dragging, mixed card ordering, styles, inline editing, image editing, undo/redo, cross-section movement, saved reload and mobile overflow); live AI operations using an invented restaurant. The owner's existing website is preserved.

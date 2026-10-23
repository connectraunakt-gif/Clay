# Design and AI editing upgrade — 23 October 2026

The failing contact-form request exposed a real gap: forms were generated implicitly, without editable identities. A successful heading edit did not mean a subsequent form edit was supported.

## Changes and rationale

1. **Real form controls — direct manipulation and user control.** Each form now has a stable identity, contextual controls, alignment, width, editable labels and a button label. Form-only history restoration preserves unrelated work. Simple alignment requests resolve directly, including requests that describe the current left alignment before asking for the center.
2. **Brand direction before page construction — consistency and visual hierarchy.** Generation first chooses a coherent palette, heading/body font pair, wordmark, tagline, composition and photographic direction. The page-building step follows that direction. The compiler handles unambiguous nested AI metadata and supplies a real enquiry CTA if omitted. User exclusions take precedence.
3. **More expressive responsive layouts — hierarchy and proximity.** Split compositions support either image side and adjustable crops; cover, editorial and bento layouts complement the existing options. Contact forms follow their alignment settings. One-page navigation can address sections. Brand styling also appears in standalone exports.
4. **Purposeful interaction — feedback and accessibility.** Buttons, cards, navigation and photos have restrained hover treatments. Optional scroll transitions never gate the page content and respect reduced-motion preferences. Font pairing, shape, button style and motion are available in Look & feel.

The generated-site font catalogue now contains 15 choices. Clay's own interface remains Inter. Existing websites remain editable without regeneration; the upgraded generation flow applies to new sites, while new brand/style controls and AI operations can update existing sites.

Two larger models were benchmarked through the existing NVIDIA integration. One was unavailable and the other timed out, so the responsive model was retained. These changes expand Clay's design capabilities; they do not establish feature parity with Lovable's unrestricted application generation.

Validation uses invented business data, not a copy of the owner's saved website. It covers repeated edits with actual owner saves, contact geometry, responsive rendering, font loading, hover effects, reduced motion, export-script execution, and the existing editor interactions. The committed fixtures are AI-generated examples for repeatable visual checks.

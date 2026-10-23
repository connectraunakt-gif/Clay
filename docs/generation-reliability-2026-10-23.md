# Website-generation reliability fix — 23 October 2026

Clay repeatedly failed after the business description and questions. Replaying the old café generation request timed out after 115 seconds.

## Changes

- Use the responsive NVIDIA model verified with this account and its supported reasoning controls. Stream the answer, bound each attempt, retry transient failures, and handle pending provider requests correctly.
- Ask the AI for a compact website plan. Clay creates internal identities, navigation and section links, validates the result and checks explicit section/page counts and exclusions. A malformed plan gets one bounded correction attempt.
- Stop treating a failed external photo search as a failed website. Relevant licensed-stock fallbacks are available for common businesses; otherwise an editable, labelled photo placeholder is used. Image problems cannot discard the completed design.
- Save the website and completed job status together in one transaction. Repeated completion requests return the same website and cannot overwrite an existing website.
- Store the brief privately with the generation job. Owners can recover their own answers across sessions. Other accounts cannot retrieve them.
- Poll the specific job, tolerate temporary connection failures and show actual preparation stages. Refresh cached application files so existing installations receive the fix.
- Accept the AI's unambiguous nested action format and assign missing IDs to newly created elements, preserving validated editing behavior.

## Verification

Three consecutive real generation tests completed successfully: café (31 seconds), furniture (14 seconds), café again (14 seconds). Each produced a validated, saved website with four requested sections, no testimonials and real photos. Repeating the save returned the same website.

A real browser test completed description → three questions → generated editor → reload in about 15 seconds. It also succeeded with two deliberately failed progress requests. A separate browser check recovered a privately saved brief without relying on session storage. Security checks denied cross-account brief access and direct client access to the completion function.

Regression tests cover model parameters, streamed output, pending requests, truncated output, structured plan compilation, explicit requirements, photo-service outages, action formats and created-element identities. Tests use disposable accounts and remove their data afterward.

## Source

[NVIDIA's GPT-OSS API reference](https://docs.api.nvidia.com/nim/reference/openai-gpt-oss-20b-infer) documents the model-specific reasoning control, output-token bounds, streaming and pending responses. The previous request used a thinking flag for a different model family and a larger output budget than that endpoint documents.

# Caracal Mapping Instructions

Follow `AGENTS.md` first. This workspace is a Caracal Console mapping assistant, not a general Caracal coding workspace.

- Map only visible Console fields for providers and resources.
- Read `.github/console-fields.ground-truth.json` before deciding whether a field is supported.
- Prefer `https://docs.caracal.run`, official provider docs, and connected documentation MCPs such as Context7.
- Never reveal raw secrets. Mask pasted credentials before repeating them.
- Keep provider credential fields separate from resource target fields.
- Ask for exact dashboard labels, helper text, placeholders, section headings, and selected provider/resource type when information is missing.
- If a provider or resource need is unsupported by current Console fields, link `https://github.com/Garudex-Labs/caracal/issues/new/choose`.

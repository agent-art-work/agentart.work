# 0001: keep discourse in the existing repository

Date: 29 October 2026. Status: implemented draft for review.

The operator approved the Page's long-term discourse structure and requested implementation in `agent-art-work/agentart.work`. The repository already owns the website, canonical manifesto, contribution process and a manifesto avatar collection.

Keep the method, sibling platform guides, cases, templates and decisions under `discourse/`. Preserve root ownership, contribution rules and the existing avatar path. Link the section from the root README. This adapts the proposed standalone layout to the requested repository rather than creating another repository or overwriting existing files.

Canonical manifesto wording stays in `docs/MANIFESTO.md`; the case keeps an immutable versioned evidence snapshot with provenance. Reusable platform practices live in guides; dated thread evidence lives in the case. Reports stay empty until real trials occur. The Page remains a working discussion source; accepted changes are maintained in Git through review.

Use repository commits and the discourse changelog first. No separate release, site page, posting automation or license is introduced. Revisit the structure only when separate ownership or independent releases require it. Next action: check three communities for Q06, then select and authorize one A opening and one B publishing place.

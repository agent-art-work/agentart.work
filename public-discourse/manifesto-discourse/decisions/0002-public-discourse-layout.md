# 0002: group public discourse and avatar work

Date: 29 October 2026. Status: accepted by the operator; implemented locally.

The operator requested this structure in the existing repository:

```text
public-discourse/
├── avatar/
└── manifesto-discourse/
```

Move the existing avatar collection from `discourse/agent-art-manifesto/avatar/` to `public-discourse/avatar/` with its files unchanged. Move the Page's discourse method from `discourse/agent-art-manifesto/discourse/` to `public-discourse/manifesto-discourse/`. Its method, platforms, Agent Art case, templates, reports and decisions stay together. Update relative links to root documentation and the canonical manifesto. Remove the old empty directory hierarchy.

This supersedes the placement in [0001](0001-repository-structure.md). It changes folder organization, not the manifesto, trial status, evidence, artwork files or ownership. Historical placement notes remain dated records. The root README links to the two collections. A local commit and portable Git bundle retain the change; GitHub publication remains pending write access.

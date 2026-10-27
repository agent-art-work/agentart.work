# Optional analytics — local candidate

Prepared 2026-10-26 for local review only. This is not part of the released
website. `site/analytics.json` remains disabled with no measurement ID. No
provider property, real Google test traffic or publication is authorized by
this document. The website's current stable release and Protocol SDK status
are unchanged.

Local production-build follow-up, 2026-10-26: OPS has separately created the
Agent Art Work property/stream and reported three synthetic pageviews received
in Realtime, with bounded native consent/withdrawal/cookie/reload/exclusion
checks. This is an OPS report, not a repeated test here or production deployment
evidence. Native cross-domain settings and processed/filter-match evidence
remain unqualified. No additional Google sends or provider changes are part
of this follow-up.

## Scope

The site-owned integration adds an Analytics choices control to the shared
footer. The locked manifesto, artwork and reading controls are independent of
analytics. A disabled build has no consent prompt and cannot load Google.
Visitors can still exclude the current browser through Analytics choices.
JavaScript unavailable means no analytics.

Eligibility requires every gate: explicitly configured production build,
canonical `https://agentart.work` origin, an allowed route, no query string,
no detected automation, working preference storage, valid permission and no
browser exclusion. Local hosts, subpath previews, ordinary CI/PR builds, design demos,
redirects, 404, technical downloads and unlisted routes are excluded. Fragments
never enter analytics context. Removing an exclusion does not grant permission.

The proposed category set is Home, Agent Art, Protocol, Works, Ask your Agent,
Blog and About. Known historical article routes are grouped under Blog, with
no article title or article URL. Additional routes require an explicit review;
the catalogue cannot silently expand measurement. Events carry fixed category
titles/URLs and empty referrer/campaign fields. No prompts, handoff payloads,
artwork contents, document contents, storage contents or custom click funnels
are sent. Native session and engagement signals remain subject to later
provider and actual-vendor qualification.

## Permission and withdrawal

This uses the basic consent approach: no Google tag or consent ping before
Allow. Allow and Reject share the same layout and styling. Choices expire
after 90 days; the browser exclusion persists until removed or site storage
is cleared. Refreshing status cannot rewrite consent or renew its expiry.
Storage reads, writes and a separate availability probe must succeed; writes
are read back. Refusal is synchronized through storage events and a revoke-only
BroadcastChannel. Clearing or invalidating saved consent revokes permission.

Withdrawal disables the Google tag before clearing its queue and removing its
script/cookies. A stopped tag is never restarted within that document; a later
explicit Allow can apply on the next eligible navigation. Expiry, focus,
visibility and history restoration recheck permission. Unrelated reading
state, cookies and local storage are retained. Failed persistence keeps the
current page off and reports that the preference could not be saved; no browser
code can promise durable refusal when every persistence API fails. Already-sent
data cannot be recalled by withdrawal.

Only this integration's namespaced, host-only analytics cookies are removed.
They are configured Secure/SameSite=Lax at `/`, with a 90-day lifetime and
`cookie_update: false`. The client cookie is fixed up to 90 days from creation;
session-cookie expiry can renew after activity or a later visit. Consent expiry
is independent of cookie lifetime. Do not describe these as anonymous visitors
or equate engagement time with attention.

## Build and local checks

The existing builder emits one content-addressed module and stylesheet from
`analytics-core.mjs`, `analytics-ui.mjs` and `analytics.css`. Both are site-owned;
the Protocol SDK is unchanged. Checked-in configuration must remain exactly
disabled/unset. The normal build and ordinary CI/PR checks produce inactive
configuration. A locally prepared step in the existing Pages workflow can
rebuild the upload artifact only when production analytics is explicitly
enabled through these repository variables after separate approval:

| Repository variable | Future production value |
| --- | --- |
| `AGENTART_ANALYTICS_ENABLED` | `true` only after activation approval; absent or any other value stays off |
| `AGENTART_ANALYTICS_MEASUREMENT_ID` | `G-7YQ4H869CL`, the separate Agent Art Work stream's public ID |

No live variable has been set by this preparation. The workflow passes those
values only to its optional production rebuild, after ordinary checks pass.
The builder also requires `AGENTART_DEPLOYMENT=production`, GitHub Actions CI,
the exact repository and Pages workflow reference on `refs/heads/main`, a
`push` or `workflow_dispatch` event, and an empty base path. Local environment
hints alone, PRs (including target events), forks, other workflows, other
branches and previews stay off. Missing/malformed IDs fail the explicitly
enabled production build before upload. A valid ID alone cannot enable it.
There is no URL parameter or browser preference to activate analytics.

The existing upload/deploy jobs use the final checked `_site` artifact. No new
workflow, job, hosting project or provider change is introduced. CI metadata
is a build-context guard, not a security boundary against someone who can
rewrite trusted source or forge the whole process environment. Offline tests
simulate it with a fictional ID; those fixtures must never be deployed.

Run the normal repository/site checks, including `npm test` for policy,
controller and generated-page coverage. Browser qualification uses an isolated
regular Chrome profile and intercepts all HTTP requests. A fictional ID and
inert local tag substitute exercise permission, refusal, failures and sanitized
parameters; they are never committed into site configuration. These local
checks do not independently qualify Google's actual SDK, property settings or
ingestion; the separate bounded OPS diagnostic retains its own evidence limits.

## Release gates and staging

Commit, push, PR, merge, live repository variables, deployment and enablement
remain pending separate authorization. No further provider change, filter
activation, grant or Google send is authorized. Before any enablement:

1. Review this local candidate and its category/notice scope. Use the separate
   Agent Art Work stream reported by OPS; do not create another or reuse
   another site's ID. Retain OPS's dated provider readbacks for advertising,
   personalization, User-ID, Signals and enhanced measurement. Native
   cross-domain settings remain unread; code-level linker restrictions do not
   establish that native setting. Keep processed/filter-match evidence pending.
   `send_page_view: false` alone does not stop enhanced-measurement events.
   Review actual data retention and disclosure before activation.
2. Qualify the exact built artifact through an isolated local server or
   browser-served artifact, with every Google endpoint intercepted. This is
   local artifact verification, not a hosted staging deployment. PR checks
   also build artifacts only. The existing Pages workflow deploys `main`
   directly; it has no separate staging destination.
3. For actual hosted staging, obtain approval for an existing isolated hosting
   destination before deployment. None is established by this repository.
   Do not overwrite production with a candidate branch or invent a new project.
   If no existing destination is available, report the staging gate unresolved.
4. Separately authorize publication and activation of the prepared workflow
   wiring and variables. Carry forward the bounded native diagnostic without
   claiming production-origin cookies, general reliability or processed-data
   qualification. No more diagnostic traffic is authorized here. Exclude the
   operator's browser before normal inspection; operator traffic is not
   automatically developer traffic. Exclude the October 26 diagnostic date
   from future audience baselines.

For a separately approved staging operation, build/check the exact reviewed
source with variables unset and preserve the `_site` checksums before upload to
the approved existing isolated destination. No such destination is configured
yet. Do not use a production-enabled or fictional-ID fixture for staging.
After eventual activation, the quick configuration rollback is to set
`AGENTART_ANALYTICS_ENABLED` to `false` and authorize a fresh main build/deploy;
verify its final HTML is disabled/unset. Changing a variable alone cannot
replace an already deployed artifact. Check pending runs so an older enabled
artifact is not subsequently deployed. These are future instructions, not
authority to mutate variables, cancel runs or deploy now.

Rollback target for this candidate is source `57e55ef` (the current main before
analytics preparation), with its existing static build and no analytics
integration. If an enabled version is ever released, disabling future builds
cannot instantly stop a previously loaded document; withdrawal/expiry controls
and a provider-side response must be part of that separately approved rollout.

Reports must state the period, consent coverage, sample limits and unavailable
values. Countries can reflect proxy/VPN locations. Cookies/devices do not prove
unique people or deduplicate audiences across sites; returning visits require
later sessions. No reporting schedule or reporting platform is added here.

## Technical references

- [Google consent modes](https://developers.google.com/tag-platform/security/concepts/consent-mode)
- [Disable flags and privacy settings](https://developers.google.com/tag-platform/security/guides/privacy)
- [Pageview and enhanced measurement controls](https://developers.google.com/analytics/devguides/collection/ga4/views)
- [GA4 configuration fields](https://developers.google.com/analytics/devguides/collection/ga4/reference/config)

These are implementation references, not evidence that the unconfigured
provider or actual tag behavior has been verified for this candidate.

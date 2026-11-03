# Optional measurement migration — local candidate, 2026-11-03

The operator's current direction is no consent prompt: collect only statistics
that qualify without assumed consent, accepting missing metrics or regions.
This candidate removes the GA4 loader and consent panel. It does not activate
Cloudflare collection. Production remains on the previously released source
until a separately approved publication and deployment.

## Current candidate behavior

Every build emits `enabled: false`, `siteToken: null`, `production: false`.
This includes main production builds with the old GA4 variables still set,
ordinary CI, PRs, forks, previews, local and subpath builds. The old workflow
activation step is removed locally; no live repository variable is changed.
There is no vendor script installer or custom collector/proxy in this candidate.
Configuration alone cannot enable it. The source-owned qualification boundary
is false and cannot be replaced by a browser preference or an environment flag.

A closed Privacy disclosure in the footer explains measurement is off and offers
browser exclusion. It never opens automatically or asks for consent. It works
as information without JavaScript; exclusion actions require functional storage.
The existing `agentart.analytics.excluded.v1` key retains its semantics: `1`
excludes and `0` removes exclusion. Missing is not excluded; other values and
unreadable storage fail closed. Only explicit button actions write this key,
with readback/error reporting. Removing exclusion still cannot start collection.
Old Allow/Reject preferences are ignored, not translated into permission.
No visitor identifier, storage probe or new cookie is written. Old preferences,
existing cookies, saved works, authentication, reading state and provider history
are preserved; the removed loader no longer reads or renews analytics cookies.
Other already-open documents may still run their previously loaded release.

## Proposed scope and unresolved gates

`REVIEWED_PATHS` is a finite candidate list of existing Home, About, Agent Art,
Protocol, Works, Blog and seven historical study URLs. It does not expand with
the article catalogue. These are actual paths, not substituted GA4 labels.
Queries, fragments (including empty delimiters), credentials, unlisted paths,
encoded aliases, previews, local origins, downloads and Ask your Agent are off.
Known automation and explicit exclusion are checked before possible collection;
absence of an automation hint is not proof of a human visitor. The candidate
referrer guard accepts only empty or exact safe same-origin referrers. External
and unknown/sensitive referrers remain excluded, including external origins.
These offline-tested preconditions do not themselves authorize a beacon.

Two blockers prevent any installation:

1. **Regional manual mode:** agentart.work remains DNS-only on GitHub Pages.
   Cloudflare automatic zone injection rules and `lite=true` do not establish
   regional restrictions for arbitrary manual beacons. The exact supported
   manual regional behavior must be qualified before collection. Do not infer
   residence from receiving data centers or use report filters as collection
   exclusions. No geolocation service, hosting move or paid plan is proposed.
2. **Navigation and stopping:** the site has static document navigation but also
   fragments, history restoration and client components. A native beacon sees
   actual URLs/referrers and may install unload/history handlers. Removing a
   script does not prove those handlers stopped. In-document hash/history changes,
   cross-tab exclusion and later sensitive transitions need a supported stop or
   safe document-boundary design. Until qualified, even public routes stay off.

## Future production requirements and approval boundary

OPS must qualify the exact manual site registration on the retained Gallery
account, public site tag, supported restricted regional mode, actual URL/referrer
handling, navigation/exclusion stopping and absence of competing automatic
injection. Keep GitHub Pages and DNS unchanged. No Cloudflare edge request or
bandwidth measurement is claimed for this DNS-only site.

After those gates, a separately reviewed source change may add **one site-owned
manual vendor loader** with the exact HTTPS origin, explicit production-only
build context (repository, main ref, existing workflow and approved event),
public site configuration and all browser/path/referrer gates. Neither a valid
tag nor a production flag alone is sufficient. Use the native beacon only;
no custom collector, proxy or client identity. The public tag is not the private
OPS reporting credential. Reporting tokens and account credentials never belong
in frontend source, HTML, configuration, logs or browser storage.

This preparation authorizes no commit, push, merge, provider setting, staging,
deployment, live vendor test or notification. Next: OPS reviews this local
candidate and the blockers, then obtains separate qualification/publication
approval. A removal-only release with collection off is a possible separate
operator decision; it is not deployed by this preparation.

## Checks, evidence and recovery

Run the existing Node tests, Python tests, repository checker, build and site
checker. The tests cover exact routes/referrers, exclusion persistence/failures,
legacy Allow isolation, automation and configuration attempts to enable the
unqualified collector. Artifact checks reject consent UI and unconditional
vendor resources. They do not qualify Cloudflare runtime or legal eligibility.
No browser collection test or live analytics send is part of this candidate.

Rollback source is current main `c0c912667918bd41ec63243ac406a55887bb1111`,
including its GA4 implementation. No change has been deployed. Discarding the
local candidate restores that source; any future production rollback needs its
own approval and a rebuilt/deployed artifact. Existing public GA4 variables and
provider history are unchanged. Source history preserves the earlier consent
implementation and its evidence without treating it as the new design.

# Cloudflare Pages delivery and Home measurement

The [release and recovery runbook](RELEASE.md) records current hosting,
deployment, fallback and restoration decisions. The November 24 source notes
below describe the original combined OFF candidate and its measurement limits.

## November 24 source record

The combined local candidate uses `e39143ec8e25dee612572435bfb3e1a7bbb5e050`,
whose tree matches the retained November 18 release `47c29fd`. Current remote
freshness is unverified. It uses the reviewed public-control cleanup and the
saved `home-native-v1` installer, Worker, configuration and packager.

The standard static artifact is `_site/`. Run `node scripts/build-cloudflare-pages.mjs`
after a root-path static build to prepare the separate `local/cloudflare-pages/_site/`
artifact and `local/cloudflare-pages/manifest.json`. These are local paths.
Use only the selected artifact directory for any later authorized delivery.

## Capability and runtime default are different

This candidate replaces blanket COLLECTION_QUALIFIED=false switches with the
versioned `home-native-v1` source policy contract. **A policy version is not
native qualification evidence or release permission.** The Worker requires
all of the following before returning an enabled Home config:

- Exact GET `https://agentart.work/` and trusted valid allowed `request.cf.country`.
- Explicit `AGENTART_HOME_COUNTRY_MODE=production-home-country-v1`.
- Explicit `AGENTART_HOME_MEASUREMENT_POLICY=home-native-v1` and separate
  `AGENTART_HOME_MEASUREMENT_MODE=production-home-v1`.
- A valid public `AGENTART_HOME_BEACON_TOKEN`; none is assigned in this candidate.
- Exactly one expected inert measurement marker, with the same policy contract.

The browser independently requires strict matching policy/config, geography,
canonical URL, visible ready non-prerender context, retained conservative
referrer/automation guards and exact private exclusion semantics. It refuses
existing native SDK/data-cf-beacon insertion and mounts only once per document.
The old13path list remains referrer context, not measurement scope.

Checked-in `measurement.json` stays enabledfalse/token-null with policy version;
packaging rejects checked-in activation and ignores runtime build flags. Home
HTML stays OFF/negative. Ordinary `npm run build`/GitHub recovery output remains
collector-free, with no installer/country markers/vendor resource. Only separate
Pages packaging adds the hash-named native installer and Home/alias delivery.
The active publisher, package/lock, SDK, manifesto, content and reading exports
are preserved. No fixture/source-substitution bypass is published.

## Boundaries and unresolved native behavior

The source closes its own element/controller on hash/popstate, visibility loss,
pagehide/beforeunload, persisted pageshow, private storage notifications and,
where available, Navigation API navigate/currententrychange. It does not patch
history, override browser identity or create a custom receiver/proxy.

A late script load after close is explicitly recorded as
`late-load-after-boundary-unqualified` without reopening/remounting. **Load fires
after possible SDK evaluation. This does not prove pending-code cancellation.**
Removing a script does not revoke native handlers or queued/final sends. No
native SDK/lifecycle/header/payload behavior has been qualified here. History,
Navigation/SoftNavigation API, Back/BFCache, actual hide versus departure and
private exclusion/reload need the retained blocked-native qualification later.
Any private/non-Home/query/hash/unsafe-referrer leakage blocks progression.
Residual public-Home sends need an AgentArt-specific decision, not Pulse approval.

`spa:false` and script referrerPolicyorigin are source configuration only. Script
policy governs retrieval, not proof of receiver HTTP Referer or SDK payload
safety. Missing attempted-header capture is an evidence gap, not an empty-header
pass. The existing capture gap remains; no browser/CDP/CSP probe or vendor code
is executed by this source/offline round. The parked sandbox tooling stays parked.

## Evidence and release limits

Focused Node tests exercise actual policy with fake DOM/Request.cf/ASSETS data,
not native SDK execution or production eligibility. Negative/default artifact
checks remain independent from synthetic positive policy cases. No production
DNS/Host/country/webdriver/UA/referrer is spoofed; no SDK bytes are downloaded or
executed. Source tests cannot complete M7.2 or establish a fourth measured feed.

OFF staging, canonical OFF delivery and recovery, any live diagnostic, and
routine activation are separate operations. See the
[private exclusion procedure](../../site/analytics.md). The existing GitHub
publisher continues to define the static recovery path.

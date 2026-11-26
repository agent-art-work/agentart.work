# Cloudflare Pages release and recovery

GitHub holds the source and review history. Cloudflare Pages `agentart-work`
hosts staging as Preview and serves `agentart.work` as Production. The same
checked artifact moves through both environments. The GitHub Actions
[release workflow](../../.github/workflows/cloudflare-pages.yml) uses Wrangler
Direct Upload to the existing Pages project. Pull requests build and check the
artifact. Deployments require an explicit workflow dispatch and the matching
protected GitHub environment.

## Verified baseline and pending release

- The retained November 25 cutover serves collection-OFF Home and Create on
  Cloudflare. During the November 26 recovery rehearsal, OPS staged the
  marked OFF archive, uploaded the same archive to Production, and used
  native rollback to restore the original OFF deployment `35ec70af`.
  The original deployment, unchanged OFF settings and two canonical Home
  responses passed readback in about 2 minutes 32 seconds. The original-archive
  reupload path was prepared and unused.
- OPS made zero settings changes in that rehearsal. It verifies version
  restoration and the settings readback. The time and outcome of actual
  settings restoration remain open. Keep the GitHub Pages fallback and its
  recorded binding, certificates, DNS recovery records and workflow available.
- The 101-file Create and Artwork SDK alpha.3 candidate is a separate OFF
  archive. Its local review and failed archive-selection attempt supply
  no Cloudflare Preview or Production receipt. The marked rehearsal's
  Preview and timing apply to its own 99-file archive. Give the Create
  candidate its own source pin and Preview checks before seeking Production
  promotion. Preserve the current candidate and previous deployment records.

## Release procedure

1. **Pin the source.** Use a clean checkout of a reviewed Git commit in the
   source repository and the pinned lockfile. Record the commit, tree, build
   commands, tool versions and checks. The current GitHub workflow publishes
   the static fallback on `main`. During the transition, use a reviewed branch
   commit if publishing from `main` would update the fallback outside the
   approved scope. Pull request checks and canonical release approvals have
   separate effects.
2. **Build and retain the OFF artifact.** Run the repository checks and produce
   a root-path static build. Run `node scripts/build-cloudflare-pages.mjs`
   from the checkout. Submit only `local/cloudflare-pages/_site/`, keeping
   `_worker.js`, `_routes.json` and `_headers` at the archive root. Record the
   artifact manifest hash, entry count and per-file SHA-256 manifest. Preserve the
   separate collector-free static output available for GitHub recovery.
   Check the packager's OFF guard, private browser exclusion, reading assets
   and absence of local fixtures, capture material and credentials.
3. **Verify staging.** With the release's Preview approval, confirm the
   project, Preview branch and exposure, empty measurement variables and
   bindings, and disabled Web Analytics injection. Upload the pinned archive
   and record the immutable deployment ID and URL. Use the approved read
   set to compare expected bodies and hashes and check Home, its query and
   alias behavior, no-store, OFF markers, the changed routes and a true
   404. For Create, include its two immutable modules and the knowledge
   index. Native SDK execution and analytics collection have their own scope.
4. **Promote the same bytes.** The Production job downloads the same build
   artifact and checks the exact manifest and every file before uploading.
   It starts only after Preview verification and Production environment
   approval. Recheck the active successful Production ID, OFF settings and
   the approved recovery route. Record the new ID and canonical HTTPS
   readback. Compare the release's public bodies and key headers to its
   manifest, including canonical Home with and without the fixed query.
   Preview and Production can have different environment and request context.
   Verify the expected response for each with its own evidence.
5. **Keep only the required evidence.** Retain the source pin, archive and
   file manifest, Preview and Production IDs, readbacks, previous known-good
   Production ID and recovery instructions together. Keep provider identifiers,
   settings receipts and private output in the local OPS or owner record.

## Enable GitHub Actions delivery

1. Create the `cloudflare-preview` and `cloudflare-production` GitHub
   environments. Limit Preview to reviewed release branches, limit Production
   to `main`, and require an authorized reviewer before the Production job can
   access its secret. Configure the protection before attaching credentials.
2. In each environment, set the `CLOUDFLARE_ACCOUNT_ID` variable and the
   `CLOUDFLARE_PAGES_API_TOKEN` secret. Use managed, account-scoped Pages
   Edit credentials for the existing Gallery account. Keep credentials out
   of repository-level secrets and artifacts. Preview and Production use
   separate approvals and environment secrets. Cloudflare Pages Edit is
   account-scoped. GitHub environment rules control which jobs receive it.
3. Once the workflow is available on GitHub's default branch, dispatch with
   `target=build` for a dry run or `target=preview` for the approved Preview
   delivery. With separate Production authorization, dispatch from `main`
   with `target=production` and the current Cloudflare Production deployment
   ID. That run stages its own build and waits for the Production approval.
   Confirm the Preview receipt and rollback ID before releasing the job.
4. Keep the previous successful Production deployment and a durable copy of
   its artifact and manifest. The workflow's temporary artifact retention
   supports promotion. Keep release recovery pins in the established OPS
   record.

If upload or readback fails, inspect the provider's active deployment before
any reuse or retry. A succeeded upload with failed readback may already be
serving. Use the recorded rollback ID and the approved recovery procedure
when recovery is needed.

## Recovery and fallback transition

Use the exact prior successful Production deployment for a native version
rollback. Track the deployment snapshot, project defaults, separately scoped
bindings and project Web Analytics injection. A version rollback can restore
the deployment while current project settings still persist. Account for each
setting that affected the release and verify the effective OFF result. Confirm
the active version and applicable settings, then verify the pinned canonical
Home and query bodies, public no-store headers, OFF markers and absence of
analytics injection. Use the paired HTTPS receipts to establish the end of the
recovery. A separately authorized reupload of the exact retained OFF archive
can restore content on a new ID if native return is unavailable. Record the
actual method and settings outcome.

The next recovery check for OPS review is the proposed isolated Preview
rehearsal with inert values. Verify the test deployment's settings snapshot
and time cleanup of the Preview project settings, then compare the existing
and test deployment snapshots and OFF readbacks. Scope that exercise
separately from any Production settings-restoration rehearsal. Preview
results inform Production recovery planning. Retiring the fallback requires
OPS acceptance of an end-to-end Cloudflare rehearsal that restores both the
known-good release and the collection-OFF settings, including effective
post-restore readback. Record any timing target against the full accepted
sequence. The three-minute combined target remains unmeasured.

After OPS verifies that gate and the operator approves the transition change,
remove routine GitHub Pages publication from the workflow while retaining
source review and offline build checks. Keep the known-good archive, manifest
and recovery instructions in the approved retention location. Confirm none of
the remaining workflow triggers publishes a site. DNS, domain bindings and
hosting decommissioning have separate approvals. Keeping a second provider
after transition requires an explicit recovery objective.

Collection remains OFF. These procedures describe future scoped approvals for
uploads, production changes, rollback exercises, DNS and browser or SDK
execution.

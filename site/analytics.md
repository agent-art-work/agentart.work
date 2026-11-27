# Home measurement and private exclusion

The November 24 combined candidate uses the retained November 18 release tree.
It removes the reviewed public measurement controls and preserves the browser
exclusion key. Both local delivery artifacts default to collection OFF.

## Current behavior

The ordinary static GitHub build is collector-free and always emits disabled,
unset, nonproduction analytics config. It contains no public measurement UI,
replacement settings link, analytics JavaScript/CSS or vendor script. Environment
flags and legacy Allow values cannot enable it. Only private source helpers remain.

A separate Pages-only packager adds trusted country delivery and the new exact
Home native installer, with checked-in/runtime defaults OFF and no token. A
versioned Home policy contract replaces the former blanket false switches; it
is not native qualification. Country eligibility alone cannot collect. The installer preserves exact private exclusion,
automation/referrer guards and narrows measurement to `https://agentart.work/`
only; historical 13 paths are not activated. No SDK was downloaded/executed.
See [delivery design and limitations](../delivery/cloudflare-pages/README.md).

The exact `agentart.analytics.excluded.v1` key retains semantics: `1` excludes;
`0` removes explicit exclusion; missing is not an explicit exclusion; malformed
or unreadable state closes collection. There are no initialization writes,
migrations, resets, cookies or identifiers. Functional state and old preferences
remain untouched. Removing an exclusion cannot bypass runtime config/policy, country,
URL, browser or referrer gates. No public preference binding remains.

## Private OPS preference procedure

This procedure is for a separately instructed operator action, not a new public
UI or authorization to change production storage during this cleanup.

1. Use the intended **regular Google Chrome** profile at the exact origin
   `https://agentart.work`. Another profile, device, port or localhost origin has
   independent storage. Preserve unsaved work before any reload.
2. In Chrome DevTools → Application → Local Storage, select that exact origin.
   Read and record only `agentart.analytics.excluded.v1` and its exact current
   value (or missing). Do not clear site data, cookies or other preferences.
3. Only when separately instructed, edit that exact value to `1` to exclude, or
   `0` to remove explicit exclusion. Missing need not be initialized; malformed
   and unreadable values remain closed until an explicit action resolves them.
4. Read back the same key/value. On denied/unreadable storage or a mismatched
   readback, stop and report failure; do not assume the requested value persisted.
5. After preserving work, explicitly reload/open a fresh document in that profile.
   The static recovery has no collector, automatic reload or cross-tab analytics
   listener. An older open document may retain its previously loaded release.
   Changing a preference cannot prove its native handlers or final sends stopped.

No live preference value is read or written by local checks. A localhost OPS
page cannot edit another origin's localStorage; this procedure uses existing
origin-specific browser controls, not a promised cross-origin dashboard toggle.
Private exclusion changes do not override OFF, regional, browser, path, automation
or referrer safeguards. No GA4, token, backend or geo-IP service is added.


## Unqualified behavior and later stages

Offline policy and artifact checks establish the default OFF behavior. The
synthetic same-document fixture from November 18 disclosed a private test path
in both `location` and `inp.path`; that failure remains open. Removing the
installer element does not cancel native handlers or queued sends. The remaining
browser checks cover initial URL exclusions, an already eligible Home after a
public fragment change, and genuine Back/Forward restoration.

Keep the exact collector-free GitHub artifact separate from the Pages package.
The Pages no-store and alias configuration applies only to Home and its alias.
For policy inputs, packaging and release limits, see the
[Pages delivery notes](../delivery/cloudflare-pages/README.md). Native receiver,
processed reporting, provider eligibility and recovery remain separate checks.

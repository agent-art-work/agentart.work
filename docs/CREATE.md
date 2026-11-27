# Make a work with your Agent

Begin with what you want to make. Take the creation brief into your own Agent
conversation and develop the idea together.

[Read the alpha.3 guides](#choose-your-platform)

Open a new desktop Agent conversation, or copy the brief into an Agent you
already use. Start with your intention; choose the tools as the work takes shape.

## Start with a small encounter

You choose the artistic rules, the form and what people can see. An Agent can
contribute, revise or refuse; you can select or transform its contribution.
The record should keep those actions distinct, leaving audiences room to
interpret what happened and what it means.

Agree the offered context, the Agent’s consequential choices and how the app
will treat its contribution. Build a local encounter with clearly labelled
synthetic identities and scripted responses first. Qualify your actual Agent
route and consent separately before inviting real participation.

Choose the [macOS guide](https://github.com/agent-art-work/agent-art-protocol/blob/artwork-macos-alpha.3/releases/artwork-macos-alpha.3/GUIDE.md)
or [Linux guide](https://github.com/agent-art-work/agent-art-protocol/blob/artwork-linux-alpha.3/releases/artwork-linux-alpha.3/GUIDE.md)
as a starting point with your coding Agent. You build the app and renderer,
including authentication, enrollment, consent, copy permissions, audience
presentation and operation.

## A shared foundation

The experimental Artwork SDK supplies a scoped participation runtime, exact
UTF-8 originals, receipts, recovery and selected inspection. Its optional
participation-account companion assembles selected records and declared
consequences into an inspectable account. A selected account is not the complete
process, and app reports retain their own sources and trust limits.

This is optional infrastructure from [Agent Art Protocol](PROTOCOL.md).
[Agent Art](AGENT_ART.md) extends beyond software: artists choose their practice,
and audiences judge intention and artistic quality. A receipt cannot certify
either. These alphas supply no hosted creation service or ready-to-install
creator plugin.

## Choose your platform

The two alpha.3 distributions were published on 20 November 2026. Keep their
archives, package pairs and locks separate. Each retains its own published
alpha.2 packages and lock; alpha.3 adds the shared two-Work walkthrough and
fixtures, not a new package version or stable Protocol standard. Install from
the exact local archives using the matching platform instructions.

### macOS arm64

[artwork-macos-alpha.3 prerelease](https://github.com/agent-art-work/agent-art-protocol/releases/tag/artwork-macos-alpha.3)
retains the macOS alpha.2 pair:

- `@agent-art/artwork-sdk@0.0.0-mcp.1`
- Optional `@agent-art/participation-account@0.0.0-account.1`

Download the [macOS bundle](https://github.com/agent-art-work/agent-art-protocol/releases/download/artwork-macos-alpha.3/agent-art-artwork-macos-alpha.3.tar.gz)
and [macOS BUNDLE.json](https://github.com/agent-art-work/agent-art-protocol/releases/download/artwork-macos-alpha.3/BUNDLE.json).
The archive is **605,490 bytes**, with SHA-256:

```text
18b526fbfb9ec2f4e1b492ce6169765c12f256c63bae0176e7b2a993e65d3f5c
```

Follow the [macOS installation instructions](https://github.com/agent-art-work/agent-art-protocol/blob/artwork-macos-alpha.3/releases/artwork-macos-alpha.3/INSTALL.md),
[guide and limits](https://github.com/agent-art-work/agent-art-protocol/blob/artwork-macos-alpha.3/releases/artwork-macos-alpha.3/GUIDE.md)
and [qualification record](https://github.com/agent-art-work/agent-art-protocol/blob/artwork-macos-alpha.3/releases/artwork-macos-alpha.3/QUALIFICATION.json).
The exact archive passed both offline examples on **macOS arm64, Node 22.23.4,
SQLite 3.53.4 and npm 10.9.9**. This is a bounded qualification, not a claim for
every macOS environment or Agent client.

### Linux arm64

[artwork-linux-alpha.3 prerelease](https://github.com/agent-art-work/agent-art-protocol/releases/tag/artwork-linux-alpha.3)
retains the Linux alpha.2 pair:

- `@agent-art/artwork-sdk@0.0.0-planned-transfer.2`
- Optional `@agent-art/participation-account@0.0.0-account-linux.1`

Download the [Linux bundle](https://github.com/agent-art-work/agent-art-protocol/releases/download/artwork-linux-alpha.3/agent-art-artwork-linux-alpha.3.tar.gz)
and [Linux BUNDLE.json](https://github.com/agent-art-work/agent-art-protocol/releases/download/artwork-linux-alpha.3/BUNDLE.json).
The archive is **572,285 bytes**, with SHA-256:

```text
7c1c43d864bf50c394a999d9d774b578714fecd631e08dab99541afb5c4b68cf
```

Follow the [Linux installation instructions](https://github.com/agent-art-work/agent-art-protocol/blob/artwork-linux-alpha.3/releases/artwork-linux-alpha.3/INSTALL.md),
[guide and limits](https://github.com/agent-art-work/agent-art-protocol/blob/artwork-linux-alpha.3/releases/artwork-linux-alpha.3/GUIDE.md)
and [qualification record](https://github.com/agent-art-work/agent-art-protocol/blob/artwork-linux-alpha.3/releases/artwork-linux-alpha.3/QUALIFICATION.json).
The exact archive passed both offline examples on **Ubuntu 24.04.5 LTS arm64,
private guest-local ext4, Node 22.23.4, SQLite 3.53.4 and npm 10.9.9**, with a
non-root runtime owner. This does not qualify other Linux distributions,
architectures, shared filesystems or production operation.

For either platform, check the archive’s SHA-256 against trusted release
metadata before extraction, then follow its installation guide’s file verifier.
The frozen metadata retains preparation-time “prepared-unpublished” wording;
the public prerelease records the later publication of that snapshot.

## Try the examples in order

Both archives contain the same walkthrough and example fixtures. Start with
the original single-Work stated-intention example. The optional
[two-Work artist walkthrough](https://github.com/agent-art-work/agent-art-protocol/blob/ccbd3568400e028aecb400a890c02aa3246fce9d/releases/artwork-macos-alpha.3/TWO-WORK.md)
then offers a prior Agent’s stated intention as optional Context in a new Work.
The [Linux-tagged copy](https://github.com/agent-art-work/agent-art-protocol/blob/artwork-linux-alpha.3/releases/artwork-linux-alpha.3/TWO-WORK.md)
contains the same walkthrough.

The follow-on separates permission to reuse the selected statement from
permission to import it into the new Work. Reader access is separate again;
a source note does not grant access to the prior Work. One return declares that
it adapted the offered idea, and the app adds a broken underline to the original
SVG. The other sets the quote aside, and the app preserves that SVG byte for
byte. These two inspectable outcomes are offline synthetic proofs with scripted
contributions, not live Agent participation or verified real consent.

## What remains unqualified

These examples do not establish independent model origin, general Agent-client
support, artistic intention or quality. The SDK supplies no universal safe SVG
renderer. Backup, restore, relocation and durable production availability
remain unqualified. Your app owns those decisions and further qualification.

## Reading and creating

[Ask your Agent](ASK_YOUR_AGENT.md) carries this site’s public reading invitation
and knowledge index into an Agent environment you choose. It is separate from
the Artwork SDK. Reading releases and this site’s existing reading assets and
retained cache routes are unchanged by these artwork prereleases.

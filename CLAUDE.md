# CLAUDE.md

Project rules for coding assistants (Claude Code reads this file) and for human
contributors.

## What this is

A Gladys Assistant **external integration** for the vehicles of a Stellantis
**Uconnect** account (Fiat, Abarth, Jeep, Alfa Romeo, Lancia, Maserati,
Chrysler, Dodge, Ram): a Node.js service (Node 22+, ESM, no build step) that
runs in its own sandboxed Docker container and talks to Gladys through
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js),
its only runtime dependency. It started from the official JavaScript template.
The Uconnect protocol is a port of [py-uconnect](https://pypi.org/project/py-uconnect/)
(used by [hass-uconnect](https://github.com/hass-uconnect/hass-uconnect)):
check there first when the API changes.

## Commands

```bash
npm install
npm test                                  # node --test "test/**/*.test.js"
node --test test/devices.test.js          # one file
node --test --test-name-pattern "lock"    # tests whose name matches
npm run lint                              # ESLint
npm run format:check                      # Prettier, as the CI runs it
npm run format                            # Prettier, fix in place
npx github:GladysAssistant/integration-store .   # store admission checks
```

The CI (`.github/workflows/ci.yml`) runs `format:check`, `lint` and `test` on
Node 22 and 24, and builds the Docker image: run the three commands before
pushing.

## Architecture

```
index.js                          SDK wiring only: handlers registered before connect()
src/service.js                    VehicleService: refresh loop, publication, commands
src/devices/vehicle.js            FEATURES catalog: one entry per feature of a vehicle
src/triggers.js                   scene events, from the transitions between two refreshes
src/scenes.js                     scene action handlers (manifest `scene_actions`)
src/widgets.js                    dashboard widget handlers (manifest `widgets`)
src/actions.js                    Configuration screen buttons (manifest `actions`)
src/i18n.js                       every user-facing text, in en / fr / de / es
src/config.js                     DEFAULT_CONFIG (mirrors the manifest defaults) + normalization
src/uconnect/                     the Uconnect protocol (brands, auth, sigv4, api, commands, models, client)
gladys-assistant-integration.json manifest
docs/{en,fr,de,es}.md             user documentation, re-hosted by Gladys (en and fr mandatory)
test/                             node --test, against the SDK's fake Gladys and test/helpers/fake-cloud.js
.github/scripts/release.mjs       release helpers (manifest bump, changelog), tested in test/
```

## Rules

- **External ids are forever.** Devices are `gladys.externalIds('vehicle', vin)`;
  feature keys are the `FEATURE` values of `src/devices/vehicle.js`. Gladys
  keys devices, history, scenes and dashboards on them: never rename one. The
  same goes for every key users store: manifest `config_schema` keys, brand
  keys (`src/uconnect/brands.js`), command keys (`VEHICLE_COMMANDS`), action,
  scene trigger, scene action and widget keys, trigger `state` values.
- **Every feature carries `name`, `min`, `max`, `read_only` and
  `has_feedback`**: Gladys stores them NOT NULL. The fake Gladys refuses a
  feature without them, and `test/devices.test.js` checks them.
- **A feature, once seen, stays**: `VehicleService.featuresOf` keeps the union
  of the features ever available for a VIN, so a refresh missing some data
  does not remove a feature from the discovery payload.
- **Device commands answer within 5 s**: `onSetValue` validates, then runs the
  command in the background (a vehicle takes up to a minute). Scene actions,
  widget buttons and manifest actions may wait for the result (≤ 120 s).
- **Unsupported or failed commands are outputs** of the scene action
  (`success: false`, `status`), never errors. Missing PIN, unknown vehicle and
  cloud errors throw, with a translated `userMessage` (see `userError`).
- **Never retry a refused login** on a timer (`authFailed`): it could lock the
  user's account. The `test_connection` action and a config change reset it.
- **Secrets**: never log the e-mail, password, PIN, tokens or AWS
  credentials; the Gigya password goes in a POST body, never in a URL. VINs
  and locations are personal data: log VINs at `info` at most, locations never.
- **The container rootfs is read-only.** Write only under `/data`.
- **Tests never touch the network**: use `createFakeCloud()` and
  `createFakeGladys()`.
- **Versions belong to the Release workflow** (Actions → Release). Never edit
  `version` in `package.json` or in the manifest, nor the `docker_image` tag,
  by hand. `test/manifest.test.js` checks they agree.
- **Changelog.** Every user-visible change adds a line under `## [Unreleased]`
  in `CHANGELOG.md` (`### Added`, `Changed`, `Fixed`, `Removed`, `Security`).
  Never write a version heading.
- **Four languages.** Every user-facing text — manifest `label`,
  `description`, `placeholder`, connection status, action messages, toasts,
  widget texts — is an object with `en`, `fr`, `de` and `es`
  (`test/manifest.test.js` and `test/config.test.js` check it). The four
  `docs/*.md` are kept in sync.
- **Manifest.** The catalog `description` holds 10 to 100 characters per
  language; widget labels 3 to 30. `transports` is `["cloud"]`: Uconnect has
  no local API. Fields the older cores do not know need a higher
  `gladys_version` (`widgets`, `scene_triggers`, `scene_actions`: 5.1.0;
  `keywords`, `countries`: 5.3.0, not used). `test/manifest.test.js` ties the
  manifest to the code: change both sides together.
- **Widget budget**: at most 8 components, 6 tiles, 4 buttons, 1 status, 1
  focal. `validateWidgetContent(content)` must return `[]` in the tests.
- **Style.** Prettier formats, ESLint catches mistakes. Comments explain why,
  in English.

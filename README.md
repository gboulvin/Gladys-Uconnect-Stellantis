# Uconnect (Stellantis) for Gladys Assistant

External integration for [Gladys Assistant](https://gladysassistant.com) that
connects the vehicles of a **Uconnect** account — Fiat, Abarth, Jeep, Alfa
Romeo, Lancia, Maserati, Chrysler, Dodge and Ram — through the same cloud as
the official apps.

User documentation: [English](docs/en.md) · [Français](docs/fr.md) ·
[Deutsch](docs/de.md) · [Español](docs/es.md)

> Unofficial integration, not affiliated with Stellantis. The Uconnect API is
> undocumented; this integration ports the protocol reverse-engineered by
> [hass-uconnect](https://github.com/hass-uconnect/hass-uconnect) and
> [py-uconnect](https://pypi.org/project/py-uconnect/) to JavaScript.

## Features

- **One device per vehicle**, with the features the vehicle supports: battery
  level, charging, plugged in, time to full charge, range, odometer, fuel
  level, doors locked, climate, target temperature, cabin temperature, remote
  engine start, lights and horn, window open, tyre pressures, 12 V battery,
  days to next service.
- **Remote commands** (with the account PIN): lock / unlock, climate on / off,
  engine on / off, lights and horn, start charging, trunk and liftgate,
  ventilation, location and battery refresh, destination sent to the GPS.
- **Scene triggers**: charging started / stopped, plugged in / unplugged,
  locked / unlocked, ignition on / off, battery low, tyre pressure warning,
  vehicle moved.
- **Scene actions**: send a command (with its result as outputs), refresh a
  vehicle (its state as outputs), send a destination.
- **Dashboard widgets**: _Vehicle_ (live tiles, picture, status, buttons) and
  _My vehicles_ (every vehicle of the account).
- **Cloud transport badge** on every vehicle, flagged when the data is stale
  or the vehicle privacy mode is on.
- **Four languages**: English, French, German and Spanish (manifest, messages,
  widgets and documentation).
- All brands and regions of the official apps: Europe, North America, Asia
  and LATAM (Brazil).

Requires **Gladys 5.1.0** or later (scene triggers, scene actions and
widgets).

## How it works

```
index.js                     SDK wiring only
src/service.js               refresh loop, devices, states, events, commands
src/devices/vehicle.js       feature catalog of a vehicle (keys are forever)
src/triggers.js              scene events from the transitions between refreshes
src/scenes.js                scene action handlers
src/widgets.js               dashboard widgets
src/actions.js               Configuration screen buttons
src/i18n.js                  user-facing texts in en / fr / de / es
src/config.js                config defaults + normalization
src/uconnect/                the Uconnect protocol
  brands.js                  login sites and API gateways per brand / market
  auth.js                    Gigya login -> token exchange -> Cognito credentials
  sigv4.js                   AWS Signature V4 of the API requests
  api.js                     one method per endpoint, PIN authentication
  commands.js                remote commands and their variants
  models.js                  parsing of the API responses
  client.js                  vehicles, commands and their results
```

The integration logs in with the account e-mail and password (Gigya), trades
the session for temporary AWS credentials (Cognito) and signs every API
request with them. It reads the vehicle list, status, remote status and
location at the configured interval and publishes only the states that
changed. Commands authenticate the PIN, then poll the operation status until
the vehicle confirms.

## Development

```bash
npm install
npm test                 # node --test, against the SDK's fake Gladys and an in-memory Uconnect cloud
npm run lint
npm run format:check
```

Run it against a local Gladys:

```bash
GLADYS_HOST_API_URL="http://localhost:1443" \
GLADYS_INTEGRATION_TOKEN="<token>" \
GLADYS_INTEGRATION_SELECTOR="uconnect-stellantis" \
LOG_LEVEL=debug \
npm start
```

See [CLAUDE.md](CLAUDE.md) for the project rules.

## Release

Describe the changes under `## [Unreleased]` in [CHANGELOG.md](CHANGELOG.md),
then run **Actions → Release → Run workflow** (`patch`, `minor` or `major`).
The workflow bumps the version everywhere, tags it, builds the multi-arch
image to `ghcr.io/gboulvin/gladys-uconnect-stellantis` and publishes the
GitHub Release. The image package must be **public** on ghcr.io for Gladys to
pull it.

## Credits and license

Protocol knowledge: [hass-uconnect](https://github.com/hass-uconnect/hass-uconnect)
and [py-uconnect](https://pypi.org/project/py-uconnect/) (Apache-2.0).
Built from the official
[Gladys integration template](https://github.com/GladysAssistant/integration-template-js).

Apache-2.0

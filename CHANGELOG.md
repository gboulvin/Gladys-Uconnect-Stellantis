# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

### Added

- First version of the Uconnect (Stellantis) integration: the vehicles of a
  Uconnect account (Fiat, Abarth, Jeep, Alfa Romeo, Lancia, Maserati,
  Chrysler, Dodge, Ram) in Europe, North America, Asia and LATAM.
- One device per vehicle: battery level, charging, plugged in, time to full
  charge, range, odometer, fuel level, doors locked, climate, climate target
  temperature, cabin temperature, remote engine start, lights and horn,
  window open, tyre pressures, 12 V battery voltage, days to next service.
- Remote commands with the account PIN: lock, unlock, climate, engine,
  lights and horn, charge now, trunk, liftgate, cabin ventilation, location
  and battery refresh, destination sent to the GPS.
- Scene triggers: charging started / stopped, plugged in / unplugged,
  locked / unlocked, ignition on / off, battery low, tyre pressure warning,
  vehicle moved.
- Scene actions: send a command, refresh a vehicle, send a destination.
- Dashboard widgets: _Vehicle_ and _My vehicles_.
- Configuration screen actions: test the connection, refresh now, send a
  command.
- Cloud transport badge, flagged when the last refresh failed or the vehicle
  privacy mode is on.
- English, French, German and Spanish texts and documentation.

[Unreleased]: https://github.com/gboulvin/Gladys-Uconnect-Stellantis/commits/main

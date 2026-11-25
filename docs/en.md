# Uconnect (Stellantis)

Connect the vehicles of your Uconnect account to Gladys: Fiat, Abarth, Jeep,
Alfa Romeo, Lancia, Maserati, Chrysler, Dodge and Ram. The integration uses
the same cloud as the official apps (My Uconnect, Jeep, Alfa Romeo…): your
vehicle needs active connected services.

> Unofficial integration, not affiliated with Stellantis. It relies on the
> reverse-engineered API of the official apps (thanks to the
> [hass-uconnect](https://github.com/hass-uconnect/hass-uconnect) project):
> Stellantis can change it at any time.

## Configuration

1. Open the **Configuration** tab of the integration.
2. Pick the **brand and region** of your account (e.g. _Fiat / Abarth
   (Europe)_, _Jeep (USA / Canada)_). If the login is refused, try another
   region of the same brand.
3. Enter the **e-mail** and **password** of the official app.
4. Optional: enter the 4-digit **PIN** of the app. It is only needed to send
   commands (lock, unlock, climate, charge, lights…). Without it the
   integration is read-only.
5. Save, then click **Test the connection**: the vehicles of the account are
   listed under the button.
6. Your vehicles appear in the **Discovery** tab: add them.

Other settings:

- **Refresh interval** — how often the Uconnect cloud is read (5 minutes by
  default, 2 minutes minimum). The vehicle uploads its own state at its own
  pace: a faster interval does not make the data fresher than the vehicle
  sends it.
- **Low battery threshold** — the level under which the _Vehicle battery
  low_ scene trigger fires (20 % by default).
- **Climate temperature unit** and **default climate temperature** — the
  target sent with _Start the climate_, for the vehicles that accept one.
- **Wait for the vehicle to confirm commands** — scene actions and widget
  buttons wait (up to 75 s) for the result reported by the vehicle.

## Devices and features

One device per vehicle. Its features depend on the vehicle:

| Feature                                                  | Vehicles                  | Control       |
| -------------------------------------------------------- | ------------------------- | ------------- |
| Battery level, charging, plugged in, time to full charge | electric / plug-in hybrid | read-only     |
| Range, odometer                                          | all                       | read-only     |
| Fuel level                                               | combustion                | read-only     |
| Doors locked                                             | all (when reported)       | lock / unlock |
| Climate                                                  | with remote climate       | start / stop  |
| Climate target temperature                               | with remote HVAC          | setpoint      |
| Engine (remote start)                                    | with remote start         | start / stop  |
| Lights and horn                                          | with that command         | one-shot      |
| Window open, cabin temperature                           | when reported             | read-only     |
| Tyre pressures, 12 V battery, days to next service       | when reported             | read-only     |

Each vehicle shows a **cloud** badge; an orange dot means the last refresh
failed (the values may be outdated) or that the privacy mode of the vehicle
blocks its data.

Device commands are sent in the background: the vehicle takes up to a
minute to execute them, and the state is updated once it confirms.

## Scene triggers

- **Vehicle charging started / stopped** — variables: state, battery level.
- **Vehicle plugged in / unplugged** — variables: state, battery level.
- **Vehicle locked / unlocked**.
- **Vehicle ignition on / off**.
- **Vehicle battery low** — the charge drops under the configured threshold.
- **Tyre pressure warning** — variable: the wheel.
- **Vehicle moved** — the last known location moved by more than 200 m;
  variables: latitude, longitude, distance.

Each trigger can be filtered on a vehicle (and on the new state); every
trigger also exposes the vehicle name. Triggers compare two refreshes: they
fire at the next refresh after the change.

## Scene actions

- **Send a command to a vehicle** — lock, unlock, climate (with an optional
  temperature), engine, lights and horn, charge, trunk, liftgate,
  ventilation, location or battery refresh. Outputs: `success` (confirmed by
  the vehicle) and `status` (`success`, `sent`, `failed`, `unsupported`).
- **Refresh a vehicle** — reads its latest state. Outputs: battery level,
  range, odometer, fuel level, locked, charging, plugged in, latitude,
  longitude.
- **Send a destination to the GPS** — latitude, longitude and an optional
  name.

## Dashboard widgets

- **Vehicle** — the battery (or fuel) level and range, live; the picture of
  the vehicle; doors, windows, charge, climate, engine, odometer, tyres and
  location; buttons to lock, unlock (with a confirmation) and start or stop
  the climate, and a map link. Pick the vehicle in the widget settings (the
  first one by default).
- **My vehicles** — every vehicle of the account, with its level badge.

## Configuration screen actions

- **Test the connection** — logs in and lists the vehicles.
- **Refresh now** — reads the cloud straight away.
- **Send a command** — pick a vehicle and a command.

## Troubleshooting

- **Login refused** — check the e-mail, the password and the brand / region.
  After a refused login the integration stops retrying (to protect the
  account) until the configuration is saved again or the connection tested.
- **Commands refused** — check the PIN. Some commands only exist on some
  vehicles: the _unsupported_ status says so.
- **Old values** — the vehicle only uploads its state from time to time
  (when it is switched off, while charging…). The _Refresh the battery level_
  command asks an electric vehicle for a fresh state.
- **Privacy mode** — when it is on in the vehicle, no data is shared.

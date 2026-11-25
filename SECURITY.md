# Security policy

## Reporting a vulnerability

Please do **not** report a security problem in a public issue, pull request or
forum post.

Report it privately through GitHub instead: open the **Security** tab of this
repository, then **Report a vulnerability**.

No such button? Private reporting is not enabled yet: open an issue that only
asks the maintainers for a private contact, without any detail of the problem,
and send the report there.

Include, when you can:

- the version of the integration and of Gladys;
- what an attacker can do, and the steps to reproduce it;
- the log lines that help — remove first the e-mail address, the password, the
  PIN, the VIN of the vehicles, their location and any token.

The fix ships as a new version of the integration, and the advisory is
published once users can update.

## Supported versions

Only the latest release receives security fixes: update the integration from
Gladys before reporting a problem.

## Scope

In scope: the code of this repository and the Docker image it publishes —
in particular the handling of the Uconnect credentials (e-mail, password,
PIN), of the temporary cloud credentials derived from them, and of the remote
commands (unlock, engine start…).

Out of scope: Gladys Assistant itself (see its
[security policy](https://github.com/GladysAssistant/Gladys/security/policy)),
the Uconnect / Stellantis cloud and the official apps, and the vehicles.

## How the integration handles secrets

- The password and the PIN are `secret` fields of the configuration: Gladys
  never sends them back to the browser.
- They are only sent to the Stellantis login and PIN endpoints, over HTTPS;
  the password travels in a request body, never in a URL.
- Neither they nor the temporary credentials are logged or written to disk.
- After a refused login the integration stops retrying until the
  configuration changes, so it never locks the account by itself.

# Security policy

Oppenly handles what people type, so security reports get priority.

## Reporting a vulnerability

Please report security problems privately through GitHub:
[Report a vulnerability](https://github.com/shivashis-adhikari/Oppenly/security/advisories/new).
Do not open a public issue for them.

Include what you found, the steps to reproduce it, and the version or commit you tested. You will
get a reply within 7 days. Confirmed problems are fixed as quickly as possible, and you will be
credited in the advisory unless you prefer not to be.

## Supported versions

Security fixes go into the latest release of the extension and the `main` branch of the web app.

## In scope

- Text, keys or settings leaving the device without the user's consent.
- Ways for a website to read or change Oppenly's data, settings or API keys.
- Ways for a website to use the web app's local AI relay.
- Code execution through imported files, pasted content or AI responses.
- Anything that lets a page change what Oppenly shows the user in a misleading way.

## Out of scope

- Problems in AI providers' own services.
- Attacks that need full control of the user's computer or browser profile.
- The content of AI suggestions themselves.

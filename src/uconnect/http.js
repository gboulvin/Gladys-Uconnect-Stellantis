// -----------------------------------------------------------------------------
// HTTP helpers and errors shared by the login flow and the API client.
// -----------------------------------------------------------------------------

import { randomUUID } from 'node:crypto';

// The API keys used belong to the web portal, so requests look like they come
// from a desktop browser.
export const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

/** Generic API error: an HTTP status the API refused, or an unexpected body. */
export class UconnectApiError extends Error {
  constructor(message, { status, body } = {}) {
    super(message);
    this.name = 'UconnectApiError';
    this.status = status;
    this.body = body;
  }
}

/** The account credentials were refused (wrong e-mail, password or brand). */
export class UconnectAuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UconnectAuthError';
  }
}

/** The PIN was refused, or a command needs a PIN that is not configured. */
export class UconnectPinError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UconnectPinError';
  }
}

/** The cloud could not be reached (DNS, TLS, timeout...). */
export class UconnectConnectionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UconnectConnectionError';
  }
}

/** A remote command was refused by the API, or reported as failed. */
export class UconnectCommandError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UconnectCommandError';
  }
}

/** Headers expected by the Uconnect API gateways. */
export function apiHeaders(brand, apiKey) {
  return {
    'User-Agent': USER_AGENT,
    'Content-Type': 'application/json',
    'x-clientapp-name': 'CWP',
    'x-clientapp-version': '1.0',
    'x-originator-type': 'web',
    clientrequestid: randomUUID().replaceAll('-', '').toUpperCase().slice(0, 16),
    'x-api-key': apiKey,
    locale: brand.locale,
  };
}

/** Decode a JSON body, `null` when it is not valid JSON. */
export function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * `fetch` with a timeout, turning network failures into
 * UconnectConnectionError. Resolves `{ status, text, headers }`.
 */
export async function send(fetchImpl, url, { timeoutMs = 30_000, ...init } = {}) {
  let response;
  try {
    response = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    // Never echo the URL query: Gigya calls carry the password in it.
    const target = new URL(url);
    throw new UconnectConnectionError(
      `${init.method ?? 'GET'} ${target.host}${target.pathname}: ${err.message}`,
    );
  }
  const text = await response.text();
  return { status: response.status, text, headers: response.headers };
}

// -----------------------------------------------------------------------------
// Minimal AWS Signature Version 4 request signer.
//
// The Uconnect API gateway authenticates requests with temporary AWS
// credentials obtained from Cognito. Only the subset of SigV4 needed for that
// is implemented: the `host` header and every `x-amz-*` header are signed.
// -----------------------------------------------------------------------------

import { createHash, createHmac } from 'node:crypto';

const ALGORITHM = 'AWS4-HMAC-SHA256';

const sha256Hex = (data) => createHash('sha256').update(data).digest('hex');
const hmac = (key, data) => createHmac('sha256', key).update(data).digest();

// RFC 3986 encoding: everything but unreserved characters (A-Z a-z 0-9 - _ . ~).
function rfc3986(value) {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function canonicalPath(pathname) {
  return (pathname || '/')
    .split('/')
    .map((segment) => rfc3986(decodeURIComponent(segment)))
    .join('/');
}

function canonicalQuery(searchParams) {
  return [...searchParams.entries()]
    .map(([k, v]) => [rfc3986(k), rfc3986(v)])
    .sort(([ak, av], [bk, bv]) => (ak === bk ? (av < bv ? -1 : 1) : ak < bk ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
}

function amzDate(now) {
  return now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

/**
 * Sign a request and return the headers to add to it.
 * @param {object} request
 * @param {string} request.method - HTTP method.
 * @param {string} request.url - Exact URL that is sent.
 * @param {Record<string, string>} request.headers - Headers that will be sent.
 * @param {string|Buffer} request.body - Body that will be sent ('' for none).
 * @param {{ accessKeyId: string, secretAccessKey: string, sessionToken?: string }} credentials
 * @param {string} region - AWS region, e.g. eu-west-1.
 * @param {string} service - AWS service, e.g. execute-api.
 * @param {Date} [now] - Signing time (tests).
 * @returns {Record<string, string>} `X-Amz-Date`, `Authorization` and, with a
 *   session token, `X-Amz-Security-Token`.
 */
export function sign(
  { method, url, headers, body },
  credentials,
  region,
  service,
  now = new Date(),
) {
  const parsed = new URL(url);
  const date = amzDate(now);
  const dateStamp = date.slice(0, 8);

  const added = { 'X-Amz-Date': date };
  if (credentials.sessionToken) {
    added['X-Amz-Security-Token'] = credentials.sessionToken;
  }

  const toSign = { host: parsed.host };
  for (const [k, v] of [...Object.entries(headers), ...Object.entries(added)]) {
    if (k.toLowerCase().startsWith('x-amz-')) {
      toSign[k.toLowerCase()] = String(v).trim().split(/\s+/).join(' ');
    }
  }
  const names = Object.keys(toSign).sort();
  const signedHeaders = names.join(';');
  const canonicalHeaders = names.map((k) => `${k}:${toSign[k]}\n`).join('');

  const canonicalRequest = [
    method.toUpperCase(),
    canonicalPath(parsed.pathname),
    canonicalQuery(parsed.searchParams),
    canonicalHeaders,
    signedHeaders,
    sha256Hex(body ?? ''),
  ].join('\n');

  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [ALGORITHM, date, scope, sha256Hex(canonicalRequest)].join('\n');

  let key = hmac(`AWS4${credentials.secretAccessKey}`, dateStamp);
  key = hmac(key, region);
  key = hmac(key, service);
  key = hmac(key, 'aws4_request');
  const signature = createHmac('sha256', key).update(stringToSign).digest('hex');

  added.Authorization =
    `${ALGORITHM} Credential=${credentials.accessKeyId}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return added;
}

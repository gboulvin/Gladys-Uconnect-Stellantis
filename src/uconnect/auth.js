// -----------------------------------------------------------------------------
// Login flow: Gigya account login -> Cognito identity -> temporary AWS
// credentials used to sign the API requests (see sigv4.js).
// -----------------------------------------------------------------------------

import {
  apiHeaders,
  parseJson,
  send,
  UconnectApiError,
  UconnectAuthError,
  USER_AGENT,
} from './http.js';

// Credentials are renewed this long before they expire.
export const REFRESH_MARGIN_MS = 5 * 60 * 1000;

const GIGYA_PARAMS = {
  targetEnv: 'jssdk',
  loginMode: 'standard',
  sdk: 'js_latest',
  authMode: 'cookie',
  sdkBuild: '12234',
  format: 'json',
};

const JWT_FIELDS =
  'profile.firstName,profile.lastName,profile.email,country,locale,data.disclaimerCodeGSDP';

/** Whether credentials expire within the refresh margin. */
export function expiresSoon(credentials, now = Date.now(), margin = REFRESH_MARGIN_MS) {
  return now >= credentials.expiresAt - margin;
}

// Gigya keeps state in cookies between the calls of one login: tracked here,
// per login, instead of in a shared cookie jar.
function rememberCookies(jar, headers) {
  const setCookies = typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : [];
  for (const line of setCookies) {
    const [pair] = line.split(';');
    const index = pair.indexOf('=');
    if (index > 0) {
      jar.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
    }
  }
}

function cookieHeader(jar) {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

async function gigya(ctx, method, call, params) {
  const { fetch, brand, timeoutMs, jar } = ctx;
  const headers = { 'User-Agent': USER_AGENT };
  if (jar.size > 0) {
    headers.Cookie = cookieHeader(jar);
  }
  const query = new URLSearchParams(params).toString();
  let url = `${brand.loginUrl}/${call}`;
  let body;
  if (method === 'GET') {
    url += `?${query}`;
  } else {
    // The password travels in the body, never in a URL that could be logged.
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    body = query;
  }
  const res = await send(fetch, url, { method, headers, body, timeoutMs });
  rememberCookies(jar, res.headers);
  const r = parseJson(res.text);
  if (res.status !== 200 || !r || typeof r !== 'object') {
    throw new UconnectApiError(`${call}: HTTP ${res.status}`, { status: res.status });
  }
  if (r.statusCode !== 200 || (r.errorCode ?? 0) !== 0) {
    const details = r.errorDetails ? `: ${r.errorDetails}` : '';
    throw new UconnectAuthError(`${call} failed: ${r.errorMessage} (${r.errorCode})${details}`);
  }
  return r;
}

async function exchangeToken(ctx, idToken) {
  const { fetch, brand, timeoutMs } = ctx;
  const res = await send(fetch, brand.tokenUrl, {
    method: 'POST',
    headers: apiHeaders(brand, brand.api.key),
    body: JSON.stringify({ gigya_token: idToken }),
    timeoutMs,
  });
  if (res.status >= 400 && res.status < 500) {
    throw new UconnectAuthError(`token exchange rejected: HTTP ${res.status}`);
  }
  const r = parseJson(res.text);
  if (res.status !== 200 || !r?.Token || !r?.IdentityId) {
    throw new UconnectApiError(`token exchange failed: HTTP ${res.status}`, {
      status: res.status,
    });
  }
  return { identityId: r.IdentityId, token: r.Token };
}

async function cognitoCredentials(ctx, identityId, token) {
  const { fetch, brand, timeoutMs } = ctx;
  const url = `https://cognito-identity.${brand.region}.amazonaws.com/`;
  const res = await send(fetch, url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': 'AWSCognitoIdentityService.GetCredentialsForIdentity',
    },
    body: JSON.stringify({
      IdentityId: identityId,
      Logins: { 'cognito-identity.amazonaws.com': token },
    }),
    timeoutMs,
  });
  const r = parseJson(res.text);
  if (res.status !== 200 || !r || typeof r !== 'object') {
    const type = r?.__type ?? '';
    if (type.includes('NotAuthorized') || type.includes('ResourceNotFound')) {
      throw new UconnectAuthError(`Cognito rejected the identity (${type})`);
    }
    throw new UconnectApiError(`GetCredentialsForIdentity: HTTP ${res.status}`, {
      status: res.status,
    });
  }
  const c = r.Credentials;
  const expiration = Number(c?.Expiration);
  if (!c?.AccessKeyId || !c?.SecretKey || !c?.SessionToken || !Number.isFinite(expiration)) {
    throw new UconnectApiError('GetCredentialsForIdentity: unexpected response');
  }
  return {
    aws: {
      accessKeyId: c.AccessKeyId,
      secretAccessKey: c.SecretKey,
      sessionToken: c.SessionToken,
    },
    expiresAt: expiration * 1000,
  };
}

/**
 * Run the full login flow.
 * @returns {Promise<{ uid: string, aws: object, expiresAt: number }>}
 */
export async function login({ fetch, brand, email, password, timeoutMs = 30_000 }) {
  const ctx = { fetch, brand, timeoutMs, jar: new Map() };

  await gigya(ctx, 'GET', 'accounts.webSdkBootstrap', { apiKey: brand.loginApiKey });

  const r = await gigya(ctx, 'POST', 'accounts.login', {
    ...GIGYA_PARAMS,
    APIKey: brand.loginApiKey,
    loginID: email,
    password,
    sessionExpiration: 300,
    include: 'profile,data,emails,subscriptions,preferences',
  });
  const uid = r.UID;
  const loginToken = r.sessionInfo?.login_token;
  if (!uid || !loginToken) {
    throw new UconnectAuthError('accounts.login: unexpected response');
  }

  const jwt = await gigya(ctx, 'POST', 'accounts.getJWT', {
    ...GIGYA_PARAMS,
    APIKey: brand.loginApiKey,
    login_token: loginToken,
    fields: JWT_FIELDS,
  });
  if (typeof jwt.id_token !== 'string') {
    throw new UconnectAuthError('accounts.getJWT: no id_token in response');
  }

  const { identityId, token } = await exchangeToken(ctx, jwt.id_token);
  const { aws, expiresAt } = await cognitoCredentials(ctx, identityId, token);
  return { uid, aws, expiresAt };
}

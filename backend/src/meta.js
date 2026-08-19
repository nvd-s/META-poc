const DEFAULT_GRAPH_VERSION = 'v25.0';

export class MetaApiError extends Error {
  constructor(message, details, status = 502) {
    super(message);
    this.name = 'MetaApiError';
    this.details = details;
    this.status = status;
  }
}

export function getMetaConfig() {
  return {
    appId: process.env.META_APP_ID,
    appSecret: process.env.META_APP_SECRET,
    redirectUri: process.env.META_REDIRECT_URI,
    graphVersion: process.env.META_GRAPH_VERSION || DEFAULT_GRAPH_VERSION
  };
}

export function getLoginUrl(state = 'meta-pages-poc') {
  const { appId, redirectUri, graphVersion } = getMetaConfig();

  if (!appId || !redirectUri) {
    throw new MetaApiError('Missing META_APP_ID or META_REDIRECT_URI in backend environment.', null, 500);
  }

  const url = new URL(`https://www.facebook.com/${graphVersion}/dialog/oauth`);
  url.searchParams.set('client_id', appId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('auth_type', 'rerequest');
  url.searchParams.set(
    'scope',
    process.env.META_LOGIN_SCOPES || 'pages_show_list,pages_read_engagement'
  );

  return url.toString();
}

async function graphFetch(path, params = {}) {
  const { graphVersion } = getMetaConfig();
  const url = new URL(`https://graph.facebook.com/${graphVersion}${path}`);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });

  const response = await fetch(url);
  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.error) {
    throw new MetaApiError(
      payload?.error?.message || 'Meta Graph API request failed.',
      payload?.error || payload,
      response.status
    );
  }

  return payload;
}
async function graphPost(path, params = {}) {
  const { graphVersion } = getMetaConfig();
  const url = new URL(`https://graph.facebook.com/${graphVersion}${path}`);
  const body = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      body.set(key, value);
    }
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.error) {
    throw new MetaApiError(
      payload?.error?.message || 'Meta Graph API request failed.',
      payload?.error || payload,
      response.status
    );
  }

  return payload;
}

export async function exchangeCodeForUserToken(code) {
  const { appId, appSecret, redirectUri } = getMetaConfig();

  if (!appId || !appSecret || !redirectUri) {
    throw new MetaApiError('Missing Meta OAuth environment variables.', null, 500);
  }

  return graphFetch('/oauth/access_token', {
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri,
    code
  });
}

export async function getUserProfile(accessToken) {
  return graphFetch('/me', {
    access_token: accessToken,
    fields: 'id,name,picture'
  });
}

export async function getUserPages(accessToken) {
  return graphFetch('/me/accounts', {
    access_token: accessToken,
    fields: 'id,name,category,access_token,tasks,picture{url},fan_count'
  });
}

export async function getPagePosts(pageId, pageAccessToken) {
  return graphFetch(`/${pageId}/posts`, {
    access_token: pageAccessToken,
    fields: 'id,message,created_time,permalink_url,full_picture,shares,comments.summary(true),likes.summary(true)',
    limit: 12
  });
}

export async function getTokenDebugInfo(inputToken) {
  const { appId, appSecret } = getMetaConfig();

  if (!appId || !appSecret) {
    throw new MetaApiError('Missing META_APP_ID or META_APP_SECRET in backend environment.', null, 500);
  }

  return graphFetch('/debug_token', {
    input_token: inputToken,
    access_token: `${appId}|${appSecret}`
  });
}

export async function publishPagePost(pageId, pageAccessToken, { message, link }) {
  if (!message?.trim() && !link?.trim()) {
    throw new MetaApiError('Post message or link is required.', null, 400);
  }

  return graphPost(`/${pageId}/feed`, {
    access_token: pageAccessToken,
    message: message?.trim(),
    link: link?.trim()
  });
}

export function getShareDialogUrl({ href, quote, redirectUri }) {
  const { appId } = getMetaConfig();

  if (!appId) {
    throw new MetaApiError('Missing META_APP_ID in backend environment.', null, 500);
  }

  const shareUrl = normalizePublicUrl(href || process.env.FACEBOOK_SHARE_URL || process.env.FRONTEND_URL || 'http://localhost:5173');
  const returnUrl = normalizePublicUrl(process.env.FACEBOOK_SHARE_URL || redirectUri || process.env.FRONTEND_URL || 'http://localhost:5173');

  const url = new URL('https://www.facebook.com/dialog/share');
  url.searchParams.set('app_id', appId);
  url.searchParams.set('display', 'popup');
  url.searchParams.set('href', shareUrl);
  url.searchParams.set('redirect_uri', returnUrl);

  if (quote?.trim()) {
    url.searchParams.set('quote', quote.trim());
  }

  return url.toString();
}

function normalizePublicUrl(value) {
  const trimmed = value?.trim();

  if (!trimmed) {
    throw new MetaApiError('A public URL is required for Facebook Share Dialog.', null, 400);
  }

  try {
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(withScheme);
    return url.toString();
  } catch {
    throw new MetaApiError('Enter a valid URL, for example https://kalrav.ai.', null, 400);
  }
}




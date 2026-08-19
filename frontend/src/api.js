const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:9000';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const details = payload?.details?.message || payload?.details?.error_user_msg || payload?.details?.code;
    const message = [payload?.error || 'Request failed.', details].filter(Boolean).join(' ');
    throw new Error(message);
  }

  return payload;
}

export async function getFacebookLoginUrl() {
  return request('/api/auth/facebook/url');
}

export async function getProfile(userToken) {
  return request('/api/me', {
    headers: { Authorization: `Bearer ${userToken}` }
  });
}

export async function getPages(userToken) {
  return request('/api/pages', {
    headers: { Authorization: `Bearer ${userToken}` }
  });
}

export async function getPagePosts(pageId, pageAccessToken) {
  const params = new URLSearchParams({ page_access_token: pageAccessToken });
  return request(`/api/pages/${pageId}/posts?${params.toString()}`);
}

export async function debugToken(inputToken) {
  return request('/api/debug-token', {
    method: 'POST',
    body: JSON.stringify({ input_token: inputToken })
  });
}

export async function publishPagePost(pageId, pageAccessToken, post) {
  return request(`/api/pages/${pageId}/feed`, {
    method: 'POST',
    body: JSON.stringify({
      page_access_token: pageAccessToken,
      message: post.message,
      link: post.link
    })
  });
}

export async function createFacebookShareUrl(share) {
  return request('/api/share/facebook/url', {
    method: 'POST',
    body: JSON.stringify({
      href: share.href,
      quote: share.quote
    })
  });
}

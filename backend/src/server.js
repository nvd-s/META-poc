import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import {
  exchangeCodeForUserToken,
  getLoginUrl,
  getShareDialogUrl,
  getPagePosts,
  getTokenDebugInfo,
  getUserPages,
  getUserProfile,
  MetaApiError,
  publishPagePost
} from './meta.js';

dotenv.config({ path: '../.env' });
dotenv.config();

const app = express();
const port = process.env.PORT || 4000;
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

app.use(cors({ origin: '*' }));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'meta-pages-backend' });
});

app.get('/api/auth/facebook/url', (req, res, next) => {
  try {
    res.json({ url: getLoginUrl(req.query.state) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/auth/facebook/callback', async (req, res, next) => {
  try {
    if (!req.query.code) {
      throw new MetaApiError('Facebook OAuth callback did not include a code.', null, 400);
    }

    const token = await exchangeCodeForUserToken(req.query.code);
    const redirect = new URL('/oauth/callback', frontendUrl);
    redirect.searchParams.set('access_token', token.access_token);
    redirect.searchParams.set('expires_in', token.expires_in || '');
    res.redirect(redirect.toString());
  } catch (error) {
    next(error);
  }
});

app.get('/api/me', async (req, res, next) => {
  try {
    const accessToken = readBearerToken(req);
    const profile = await getUserProfile(accessToken);
    res.json(profile);
  } catch (error) {
    next(error);
  }
});

app.get('/api/pages', async (req, res, next) => {
  try {
    const accessToken = readBearerToken(req);
    const pages = await getUserPages(accessToken);
    res.json(pages);
  } catch (error) {
    next(error);
  }
});

app.get('/api/pages/:pageId/posts', async (req, res, next) => {
  try {
    const pageAccessToken = req.query.page_access_token;

    if (!pageAccessToken) {
      throw new MetaApiError('Missing page_access_token query parameter.', null, 400);
    }

    const posts = await getPagePosts(req.params.pageId, pageAccessToken);
    res.json(posts);
  } catch (error) {
    next(error);
  }
});

app.post('/api/pages/:pageId/feed', async (req, res, next) => {
  try {
    const { page_access_token: pageAccessToken, message, link } = req.body;

    if (!pageAccessToken) {
      throw new MetaApiError('Missing page_access_token in request body.', null, 400);
    }

    const result = await publishPagePost(req.params.pageId, pageAccessToken, { message, link });
    res.status(201).json(result);
  } catch (error) {
    console.error('Page publish failed', {
      pageId: req.params.pageId,
      message: error.message,
      details: error.details
    });
    next(error);
  }
});
app.post('/api/share/facebook/url', (req, res, next) => {
  try {
    res.json({
      url: getShareDialogUrl({
        ...req.body,
        redirectUri: req.get('origin') || frontendUrl
      })
    });
  } catch (error) {
    next(error);
  }
});
app.post('/api/debug-token', async (req, res, next) => {
  try {
    if (!req.body.input_token) {
      throw new MetaApiError('Missing input_token in request body.', null, 400);
    }

    const debugInfo = await getTokenDebugInfo(req.body.input_token);
    res.json(debugInfo);
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  const status = error.status || 500;
  res.status(status).json({
    error: error.message || 'Unexpected server error.',
    details: error.details || null
  });
});

function readBearerToken(req) {
  const header = req.get('authorization') || '';
  const [, token] = header.match(/^Bearer (.+)$/i) || [];

  if (!token) {
    throw new MetaApiError('Missing Authorization: Bearer token header.', null, 401);
  }

  return token;
}

const server = app.listen(port, () => {
  console.log(`Meta Pages backend running on http://localhost:${port}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Stop the other process or set PORT to another value in .env.`);
    process.exit(1);
  }

  throw error;
});












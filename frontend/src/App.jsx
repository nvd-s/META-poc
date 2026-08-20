import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  ExternalLink,
  Facebook,
  KeyRound,
  LibraryBig,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Send,
  Share2,
  ShieldCheck
} from 'lucide-react';
import { createFacebookShareUrl, debugToken, getFacebookLoginUrl, getPagePosts, getPages, getProfile, publishPagePost } from './api.js';

const tokenStorageKey = 'meta-pages-poc:user-token';

export function App() {
  const [userToken, setUserToken] = useState(() => localStorage.getItem(tokenStorageKey) || '');
  const [profile, setProfile] = useState(null);
  const [pages, setPages] = useState([]);
  const [selectedPageId, setSelectedPageId] = useState('');
  const [posts, setPosts] = useState([]);
  const [postMessage, setPostMessage] = useState('');
  const [postLink, setPostLink] = useState('');
  const [personalShareText, setPersonalShareText] = useState('');
  const [tokenInfo, setTokenInfo] = useState(null);
  const [status, setStatus] = useState('Ready');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const selectedPage = useMemo(
    () => pages.find((page) => page.id === selectedPageId),
    [pages, selectedPageId]
  );
  const selectedPageTasks = selectedPage?.tasks || [];
  const canPublishToSelectedPage = selectedPageTasks.includes('CREATE_CONTENT') || selectedPageTasks.includes('MANAGE');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthToken = params.get('access_token');

    if (oauthToken) {
      setUserToken(oauthToken);
      localStorage.setItem(tokenStorageKey, oauthToken);
      window.history.replaceState({}, document.title, '/');
    }
  }, []);

  async function connectFacebook() {
    runTask('Opening Facebook OAuth', async () => {
      const { url } = await getFacebookLoginUrl();
      window.location.href = url;
    });
  }

  async function loadAccount() {
    runTask('Loading profile and pages', async () => {
      const profilePayload = await getProfile(userToken);
      setProfile(profilePayload);
      setStatus(`Loaded profile for ${profilePayload.name || profilePayload.id}`);

      const pagesPayload = await getPages(userToken);
      setPages(pagesPayload.data || []);
      setSelectedPageId(pagesPayload.data?.[0]?.id || '');
      setPosts([]);
      setStatus(`Loaded ${pagesPayload.data?.length || 0} page(s)`);
    });
  }

  async function loadPosts(page = selectedPage) {
    if (!page) return;

    runTask(`Loading posts for ${page.name}`, async () => {
      const payload = await getPagePosts(page.id, page.access_token);
      setPosts(payload.data || []);
      setStatus(`Loaded ${payload.data?.length || 0} post(s)`);
    });
  }

  async function publishPost() {
    if (!selectedPage) return;

    runTask(`Publishing to ${selectedPage.name}`, async () => {
      const result = await publishPagePost(selectedPage.id, selectedPage.access_token, {
        message: postMessage,
        link: postLink
      });
      setPostMessage('');
      setPostLink('');
      setStatus(`Published post ${result.id}`);
      if (posts.length > 0) {
        loadPosts(selectedPage);
      }
    });
  }
  async function openPersonalShareDialog() {
    runTask('Opening Facebook share dialog', async () => {
      const { url } = await createFacebookShareUrl({
        quote: personalShareText
      });
      window.open(url, '_blank', 'noopener,noreferrer,width=720,height=640');
      setStatus('Facebook share dialog opened');
    });
  }

  async function copyPersonalShareText() {
    await navigator.clipboard.writeText(personalShareText);
    setStatus('Share text copied');
  }
  async function inspectToken() {
    runTask('Checking token', async () => {
      const payload = await debugToken(userToken);
      setTokenInfo(payload.data);
      setStatus(payload.data?.is_valid ? 'Token is valid' : 'Token needs attention');
    });
  }

  function saveManualToken(value) {
    setUserToken(value);
    localStorage.setItem(tokenStorageKey, value);
  }

  function disconnect() {
    localStorage.removeItem(tokenStorageKey);
    setUserToken('');
    setProfile(null);
    setPages([]);
    setSelectedPageId('');
    setPosts([]);
    setTokenInfo(null);
    setStatus('Disconnected');
    setError('');
  }

  async function runTask(label, task) {
    setLoading(true);
    setError('');
    setStatus(label);

    try {
      await task();
    } catch (taskError) {
      const message = taskError.message.includes('pages_read_user_content')
        ? 'Reading page posts needs pages_read_user_content or Page Public Content Access.'
        : taskError.message.includes('pages_manage_posts') || taskError.message.includes('permission')
          ? 'Publishing needs pages_manage_posts and Create content access on this Page. Reconnect Facebook and approve Page publishing permissions.'
          : taskError.message;
      setError(message);
      setStatus('Action failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark">
            <Facebook size={24} />
          </div>
          <div>
            <h1>Meta Pages POC</h1>
            <p>Facebook page connection workspace</p>
          </div>
        </div>

        <div className="status-panel">
          <div className="status-row">
            {loading ? <Loader2 className="spin" size={18} /> : <CheckCircle2 size={18} />}
            <span>{status}</span>
          </div>
          {error && (
            <div className="error-row">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}
        </div>

        <nav className="nav-stack" aria-label="Meta sections">
          <a href="#connection"><KeyRound size={18} /> Connection</a>
          <a href="#pages"><LibraryBig size={18} /> Pages</a>
          <a href="#personal-share"><Share2 size={18} /> Share</a>
          <a href="#posts"><MessageSquareText size={18} /> Posts</a>
          <a href="#token"><ShieldCheck size={18} /> Token</a>
        </nav>
      </aside>

      <section className="workspace">
        <section className="top-band" id="connection">
          <div>
            <p className="eyebrow">Facebook Pages Integration</p>
            <h2>Connect, inspect, and read page content through the Meta Graph API.</h2>
          </div>
          <button className="primary-action" onClick={connectFacebook} disabled={loading}>
            <Facebook size={18} />
            Connect Facebook
          </button>
        </section>

        <section className="tool-grid">
          <div className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">User Access Token</p>
                <h3>OAuth or manual token</h3>
              </div>
              <button className="icon-button" onClick={disconnect} title="Clear connection">
                <RefreshCw size={18} />
              </button>
            </div>
            <textarea
              value={userToken}
              onChange={(event) => saveManualToken(event.target.value)}
              placeholder="Paste a user access token here, or use Connect Facebook."
              spellCheck="false"
            />
            <div className="button-row">
              <button onClick={loadAccount} disabled={!userToken || loading}>
                <LibraryBig size={18} />
                Load Pages
              </button>
              <button onClick={inspectToken} disabled={!userToken || loading}>
                <ShieldCheck size={18} />
                Debug Token
              </button>
            </div>
          </div>

          <div className="panel profile-panel">
            <p className="eyebrow">Connected Identity</p>
            {profile ? (
              <div className="profile-card">
                <img src={profile.picture?.data?.url} alt="" />
                <div>
                  <h3>{profile.name}</h3>
                  <p>{profile.id}</p>
                </div>
              </div>
            ) : (
              <div className="empty-state">No profile loaded yet.</div>
            )}
          </div>
        </section>

        <section className="content-band" id="pages">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Pages</p>
              <h3>Select a Facebook Page</h3>
            </div>
            <button onClick={() => loadPosts()} disabled={!selectedPage || loading}>
              <MessageSquareText size={18} />
              Load Posts
            </button>
          </div>

          <div className="page-grid">
            {pages.map((page) => (
              <button
                key={page.id}
                className={`page-card ${selectedPageId === page.id ? 'selected' : ''}`}
                onClick={() => setSelectedPageId(page.id)}
              >
                <img src={page.picture?.data?.url} alt="" />
                <span>
                  <strong>{page.name}</strong>
                  <small>{page.category || 'Facebook Page'}</small>
                </span>
<small>{page.fan_count ? `${page.fan_count.toLocaleString()} followers` : page.id}</small>
                <small className="task-list">{page.tasks?.length ? page.tasks.join(', ') : 'No Page tasks returned'}</small>
              </button>
            ))}
            {!pages.length && <div className="empty-state wide">Load pages to see connected assets.</div>}
          </div>
        </section>

        <section className="content-band" id="personal-share">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Personal Share</p>
              <h3>Facebook wall share</h3>
            </div>
          </div>
          <div className="composer-panel">
            <textarea
              className="composer-input"
              value={personalShareText}
              onChange={(event) => setPersonalShareText(event.target.value)}
              placeholder="Prepare optional text to copy into Facebook..."
              spellCheck="true"
            />
            <div className="button-row">
              <button onClick={copyPersonalShareText} disabled={!personalShareText.trim()}>
                <Copy size={18} />
                Copy Text
              </button>
              <button className="primary-action" onClick={openPersonalShareDialog} disabled={loading}>
                <Share2 size={18} />
                Open Share Dialog
              </button>
            </div>
          </div>
        </section>
        <section className="content-band" id="posts">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Posts</p>
              <h3>{selectedPage ? selectedPage.name : 'Select a page'}</h3>
            </div>
          </div>
          <div className="composer-panel">
            <div>
              <p className="eyebrow">Create Post</p>
              <h3>{selectedPage ? `Publish to ${selectedPage.name}` : 'Select a page to publish'}</h3>
            </div>
            <textarea
              className="composer-input"
              value={postMessage}
              onChange={(event) => setPostMessage(event.target.value)}
              placeholder="Write your Facebook Page post..."
              spellCheck="true"
            />
            <input
              className="link-input"
              value={postLink}
              onChange={(event) => setPostLink(event.target.value)}
              placeholder="Optional link, e.g. https://example.com"
            />
            <div className="button-row">
              <button
                className="primary-action"
                onClick={publishPost}
                disabled={!selectedPage || !canPublishToSelectedPage || loading || (!postMessage.trim() && !postLink.trim())}
              >
                <Send size={18} />
                Publish Post
              </button>
            </div>
          </div>
          <div className="post-grid">
            {posts.map((post) => (
              <article className="post-card" key={post.id}>
                {post.full_picture && <img src={post.full_picture} alt="" />}
                <p>{post.message || 'Post has no message text.'}</p>
                <div className="post-meta">
                  <span>{new Date(post.created_time).toLocaleString()}</span>
                  {post.permalink_url && (
                    <a href={post.permalink_url} target="_blank" rel="noreferrer">
                      <ExternalLink size={16} />
                      Open
                    </a>
                  )}
                </div>
              </article>
            ))}
            {!posts.length && <div className="empty-state wide">No posts loaded yet.</div>}
          </div>
        </section>

        <section className="content-band" id="token">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Token Debug</p>
              <h3>Permission and expiry check</h3>
            </div>
          </div>
          {tokenInfo ? (
            <pre>{JSON.stringify(tokenInfo, null, 2)}</pre>
          ) : (
            <div className="empty-state wide">Run token debug to inspect permissions.</div>
          )}
        </section>
      </section>
    </main>
  );
}



















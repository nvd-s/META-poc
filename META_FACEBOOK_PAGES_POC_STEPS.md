# Meta Facebook Pages POC - Step-by-Step

This document summarizes what we built and configured for the Facebook Pages integration POC.

## 1. Created the Project Structure

We created a workspace with:

- `frontend` - Vite + React UI
- `backend` - Node.js + Express API
- `.env` - local Meta app configuration
- `.env.example` - sample environment config

## 2. Installed Dependencies

Installed frontend and backend packages with:

```bash
npm install
```

Main packages used:

- React
- Vite
- Express
- CORS
- dotenv
- lucide-react
- nodemon
- concurrently

## 3. Configured Environment Variables

The backend reads Meta configuration from `.env`.

Current important values:

```txt
PORT=9000
FRONTEND_URL=http://127.0.0.1:5173
META_REDIRECT_URI=http://localhost:9000/api/auth/facebook/callback
META_GRAPH_VERSION=v25.0
META_LOGIN_SCOPES=pages_show_list,pages_read_engagement,pages_read_user_content,pages_manage_posts
FACEBOOK_SHARE_URL=https://dev-cs.kalrav.ai/
```

The Meta App ID and App Secret are also stored in `.env`.

## 4. Created Backend API

Created Express backend in `backend/src/server.js`.

Backend endpoints:

```txt
GET  /api/health
GET  /api/auth/facebook/url
GET  /api/auth/facebook/callback
GET  /api/me
GET  /api/pages
GET  /api/pages/:pageId/posts?page_access_token=...
POST /api/pages/:pageId/feed
POST /api/debug-token
```

## 5. Added Meta Graph API Helper

Created `backend/src/meta.js`.

This file handles:

- Building the Facebook OAuth URL
- Exchanging OAuth code for a user access token
- Loading Facebook profile
- Loading managed Facebook Pages
- Reading Page posts
- Publishing Page posts
- Debugging access tokens

## 6. Fixed CORS for POC Testing

The backend originally allowed only one local frontend origin, which caused browser CORS errors when Vite used another port.

For the POC, we changed backend CORS to allow requests from anywhere:

```js
app.use(cors({ origin: '*' }));
```

This is useful for local/dev testing. For production, replace this with a strict allowlist such as:

```txt
https://dev-cs.kalrav.ai
https://your-production-domain.com
```

## 7. Fixed React Runtime Issue

The UI initially showed:

```txt
React is not defined
```

We fixed it by importing React in `frontend/src/App.jsx`:

```js
import React, { useEffect, useMemo, useState } from 'react';
```

## 8. Configured Meta Developer Dashboard

In Meta Developer Dashboard:

1. Opened the `Kalrav-pages` app.
2. Went to **Use cases**.
3. Opened **Manage Pages**.
4. Opened **Permissions and features**.
5. Confirmed these permissions were **Ready for testing**:

```txt
pages_show_list
pages_read_engagement
pages_read_user_content
pages_manage_posts
public_profile
```

## 9. Added OAuth Re-request

Facebook was reusing the old permission grant, so the token did not include newly added scopes.

We added:

```txt
auth_type=rerequest
```

to the Facebook login URL so Facebook prompts again for missing permissions.

## 10. Reconnected Facebook

After updating scopes, we:

1. Cleared the connection in the UI.
2. Removed the app from Facebook Apps and Websites if needed.
3. Clicked **Connect Facebook** again.
4. Approved the new Page permissions.
5. Used **Debug Token** to verify scopes.

Expected token scopes:

```txt
pages_show_list
pages_read_engagement
pages_read_user_content
pages_manage_posts
public_profile
```

## 11. Built the Frontend UI

The React UI supports:

- Connecting Facebook
- Pasting a user token manually
- Loading the Facebook profile
- Loading managed Pages
- Selecting a Page
- Reading Page posts
- Debugging token permissions
- Creating a new Page post from the UI
- Opening Facebook Share Dialog for personal wall/feed sharing

## 12. Added Post Publishing

Created backend publishing helper:

```txt
POST https://graph.facebook.com/v25.0/{page-id}/feed
```

The frontend sends:

```json
{
  "page_access_token": "PAGE_ACCESS_TOKEN",
  "message": "Post text",
  "link": "https://example.com"
}
```

The backend publishes using the selected Page access token.

## 13. Verified Build and Syntax

Verified frontend build:

```bash
npm run build
```

Verified backend syntax:

```bash
node --check backend/src/server.js
node --check backend/src/meta.js
```

## 14. Running the Project

Run both frontend and backend:

```bash
npm run dev
```

Or run separately:

```bash
npm run dev --workspace backend
npm run dev --workspace frontend
```

Current local URLs:

```txt
Frontend: http://127.0.0.1:5173
Backend:  http://localhost:9000
```

## 15. Important Notes

- Use a Page access token for Page actions.
- The user must have admin/task access to the Page.
- Development mode works only for app Admins, Developers, or Testers.
- For public users, Meta App Review and Advanced Access are required.
- `pages_read_user_content` is required for reading Page posts/user content.
- `pages_manage_posts` is required for publishing Page posts.

## 16. Next Recommended Improvements

- Store tokens securely in the backend instead of browser local storage.
- Add a database for connected users and Pages.
- Add image upload publishing with `/{page-id}/photos`.
- Add scheduled posts with `published=false` and `scheduled_publish_time`.
- Add webhooks for Page events.
- Add production OAuth redirect URI and privacy policy before App Review.
## 17. Added Personal Wall Share Flow

Facebook no longer allows apps to auto-post directly to a user's personal wall/status feed through Graph API.

The old profile feed/status publishing flow depended on permissions such as `publish_actions`, which are no longer available for normal apps. Because of that, our app cannot silently call something like:

```txt
POST /me/feed
```

Instead, we added the supported user-controlled Share Dialog flow:

```txt
POST /api/share/facebook/url
```

The backend creates a Facebook Share Dialog URL:

```txt
https://www.facebook.com/dialog/share
```

The frontend now has a **Personal Share** section where the user can:

- Prepare text inside our UI
- Copy the prepared text
- Open Facebook's Share Dialog
- Paste/edit text inside Facebook if needed
- Choose Feed, audience, AI label, and other Facebook-owned options
- Click Share inside Facebook

The Share Dialog opens Facebook's own composer. The user must manually confirm the share inside Facebook.

This is different from Page publishing:

```txt
Page publishing: automatic API post to /{page-id}/feed
Personal wall sharing: user-controlled Share Dialog
```

## 18. Fixed Share Dialog Domain Configuration

Facebook Share Dialog requires the shared URL and redirect URL to use domains configured in the Meta app.

We first tried localhost, but Facebook showed domain validation errors because localhost is not a valid public app domain for the dialog.

We then moved the Share Dialog URL to the public dev domain:

```txt
FACEBOOK_SHARE_URL=https://dev-cs.kalrav.ai/
```

In Meta Developer Dashboard, configure the same domain:

```txt
App settings -> Basic -> Add Platform -> Website
Site URL: https://dev-cs.kalrav.ai/

App settings -> Basic -> App Domains
App Domains: dev-cs.kalrav.ai
```

Important format:

```txt
Website Site URL includes https:// and trailing slash.
App Domains contains only the domain, without https://.
```

The backend now generates Share Dialog URLs like:

```txt
href=https://dev-cs.kalrav.ai/
redirect_uri=https://dev-cs.kalrav.ai/
```

## 19. Simplified Personal Share UI

Originally the Personal Share section had a visible URL field. We removed that field because the share URL is fixed for the POC.

Now the user only sees:

- Text box
- Copy Text button
- Open Share Dialog button

The fixed URL is controlled from `.env`:

```txt
FACEBOOK_SHARE_URL=https://dev-cs.kalrav.ai/
```

If the implementation needs to share different URLs later, bring back the URL field or send a selected content URL from the frontend to the backend.

## 20. Current Implementation Summary

Supported now:

- Facebook OAuth login
- Token debugging
- Managed Page listing
- Reading Page posts when `pages_read_user_content` is granted
- Publishing Page posts when `pages_manage_posts` is granted
- Personal wall/feed sharing through Facebook Share Dialog

Not supported by Meta Graph API:

- Auto-posting to a user's personal wall/status/feed
- Auto-posting to Facebook Groups
- Reading all Pages a user follows as a feed

For those unsupported cases, the app should use user-controlled sharing or manual workflows.

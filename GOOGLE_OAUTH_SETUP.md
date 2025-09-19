# Google OAuth Token Generator

This script generates Google OAuth tokens locally that can be used in production environments like Vercel where session-based OAuth is problematic due to serverless architecture.

## The Problem

- **Vercel is serverless**: Each request creates a new function instance
- **No session persistence**: Sessions don't persist between requests
- **OAuth tokens lost**: Google Drive tokens stored in sessions disappear

## The Solution

Generate tokens locally and use them as environment variables in production.

## Prerequisites

1. **Google Cloud Console Setup**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create or select your project
   - Enable Google Drive API
   - Create OAuth 2.0 credentials
   - **IMPORTANT**: Add this redirect URI: `http://localhost:3001/auth/callback`

2. **Environment Variables**:
   ```bash
   # Required in your .env file
   GOOGLE_OAUTH_CLIENT_ID=your_client_id_here
   GOOGLE_OAUTH_CLIENT_SECRET=your_client_secret_here
   ```

## Usage

### Step 1: Add Redirect URI to Google Cloud Console

⚠️ **CRITICAL**: You must add `http://localhost:3001/auth/callback` to your Google Cloud Console OAuth 2.0 Client authorized redirect URIs.

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to APIs & Services → Credentials
3. Click on your OAuth 2.0 Client ID
4. In "Authorized redirect URIs", add: `http://localhost:3001/auth/callback`
5. Save changes

### Step 2: Run the Token Generator

```bash
# Method 1: Use npm script
npm run generate-tokens

# Method 2: Direct node command
node generate-google-tokens.js
```

### Step 3: Complete OAuth Flow

1. The script will automatically open your browser
2. If not, copy the OAuth URL from terminal
3. Sign in with your Google account
4. Grant permissions for Google Drive access
5. You'll be redirected to a success page

### Step 4: Copy Generated Tokens

The script will output tokens like this:

```bash
📋 Add these to your .env file:
=====================================
GOOGLE_ACCESS_TOKEN=ya29.a0AfH6SMC...
GOOGLE_REFRESH_TOKEN=1//04...
GOOGLE_TOKEN_TYPE=Bearer
GOOGLE_TOKEN_EXPIRY=1632123456789
=====================================
```

### Step 5: Add to Production Environment

**For Vercel:**
1. Go to your Vercel dashboard
2. Select your project
3. Go to Settings → Environment Variables
4. Add each token as a new environment variable
5. Redeploy your project

**For other platforms:**
Add the tokens to your production `.env` file or environment variables.

## How It Works

### Local Development
- Uses session-based OAuth (works normally)
- Tokens stored in `req.session.googleTokens`

### Production (Vercel)
- Uses environment variable tokens
- Automatically falls back to `process.env.GOOGLE_ACCESS_TOKEN`
- No session dependency

### Code Implementation

The services have been updated to prioritize environment tokens:

```javascript
// In services/oauthDrive.js
const finalTokens = tokens || {
  access_token: process.env.GOOGLE_ACCESS_TOKEN,
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  expiry_date: process.env.GOOGLE_TOKEN_EXPIRY
};
```

## Error: redirect_uri_mismatch

If you get this error, it means:

1. **Missing redirect URI**: You haven't added `http://localhost:3001/auth/callback` to Google Cloud Console
2. **Wrong URI**: The URI in Google Cloud Console doesn't exactly match `http://localhost:3001/auth/callback`
3. **Wrong project**: You're using credentials from a different Google Cloud project

### To Fix:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Verify you're in the correct project
3. Navigate to APIs & Services → Credentials
4. Click your OAuth 2.0 Client ID
5. Add **exactly**: `http://localhost:3001/auth/callback`
6. Save and try again

## Token Security

- **Access tokens**: Short-lived (~1 hour), used for API calls
- **Refresh tokens**: Long-lived, used to get new access tokens
- **Environment variables**: Keep these secure in production
- **Rotation**: Google may rotate refresh tokens periodically

## Troubleshooting

### Port 3001 in use
```bash
# Find process using port 3001
netstat -ano | findstr :3001

# Kill the process (replace PID)
taskkill /PID <PID> /F
```

### No refresh token
- Make sure `prompt: 'consent'` is in the auth URL
- Revoke app access in Google Account settings and try again
- Some tokens don't include refresh tokens on subsequent authorizations

### Invalid tokens in production
- Check environment variables are set correctly
- Verify tokens haven't expired
- Re-run token generator if needed

## Deployment Checklist

- [ ] Add redirect URI to Google Cloud Console
- [ ] Run token generator locally
- [ ] Copy tokens to production environment variables
- [ ] Deploy application
- [ ] Test Google Drive upload functionality
- [ ] Verify no "Google Drive not connected" errors

## Example Output

```bash
🔧 Google Token Generator
========================
✅ Client ID: Set
✅ Client Secret: Set
📍 Redirect URI: http://localhost:3001/auth/callback

🔗 Generated OAuth URL:
https://accounts.google.com/o/oauth2/v2/auth?...

🚀 Token generator server running on http://localhost:3001
📋 IMPORTANT: Add this redirect URI to your Google Cloud Console:
   http://localhost:3001/auth/callback

🔄 Exchanging code for tokens...
✅ Tokens received successfully!
✅ Token test successful!
👤 Authenticated as: your-email@gmail.com
🎉 Token generation complete!
```

This solution enables Google Drive functionality in serverless environments by bypassing the session persistence requirement.
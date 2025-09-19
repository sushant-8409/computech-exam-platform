# Google Drive OAuth Token Setup for Production

This guide explains how to set up Google Drive integration for serverless deployments like Vercel, where session-based OAuth doesn't work reliably.

## The Problem

In serverless environments like Vercel:
- Sessions don't persist between function calls
- OAuth callbacks may hit different server instances
- Google Drive tokens stored in sessions get lost

## The Solution

Generate Google OAuth tokens locally and use them as environment variables in production.

## Step 1: Generate Tokens Locally

Run the token generation script:

```bash
npm run generate-tokens
```

Or directly:

```bash
node generate-google-tokens.js
```

### What the script does:
1. ✅ Validates your Google OAuth credentials
2. 🌐 Starts a local callback server on port 8080
3. 🔗 Opens Google OAuth authorization URL
4. 📥 Captures the authorization code
5. 🔄 Exchanges code for access/refresh tokens
6. 🧪 Tests Google Drive API access
7. 📋 Displays tokens for copying

### Example output:
```
🚀 Google OAuth Token Generator

✅ Environment variables found
ℹ Client ID: 1234567890-abcdef...

🔹 Step 1: Starting local callback server...
🔹 Step 2: Open the following URL in your browser:

https://accounts.google.com/oauth2/auth?access_type=offline&scope=...

🔹 Step 3: Complete the authorization in your browser...
🔹 Step 4: Exchanging authorization code for tokens...
🔹 Step 5: Testing Google Drive access...

✅ Google Drive access confirmed for: your-email@gmail.com

🚀 Generated Tokens - Copy to your .env file:

# Google OAuth Tokens (Generated: 2025-09-19T12:00:00.000Z)
GOOGLE_ACCESS_TOKEN=ya29.a0AfH6SMCX...
GOOGLE_REFRESH_TOKEN=1//04Z9...
GOOGLE_TOKEN_TYPE=Bearer
GOOGLE_TOKEN_EXPIRY=1695123600000
```

## Step 2: Add Tokens to Production Environment

### For Vercel:
1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Add these variables:
   ```
   GOOGLE_ACCESS_TOKEN=ya29.a0AfH6SMCX...
   GOOGLE_REFRESH_TOKEN=1//04Z9...
   GOOGLE_TOKEN_TYPE=Bearer
   GOOGLE_TOKEN_EXPIRY=1695123600000
   ```

### For other platforms:
Add the tokens to your production `.env` file or platform-specific environment variables.

## Step 3: Deploy

Deploy your application. The Google Drive integration will now work using environment tokens instead of sessions.

## How It Works

The application now uses this priority order for Google Drive tokens:

1. **Environment tokens** (production) - `process.env.GOOGLE_ACCESS_TOKEN`
2. **Session tokens** (development) - `req.session.googleTokens`
3. **Admin database tokens** (fallback) - Database stored tokens

### Code Changes Made:

**services/oauthDrive.js:**
- Checks for environment tokens first
- Falls back to session tokens in development
- Provides clear logging of token source

**routes/upload.routes.js:**
- Enhanced error messages with suggestions
- Better token source detection
- Improved monitoring upload flow

**routes/googleAuth.js:**
- Enhanced status endpoint to show both session and environment token availability
- Better production vs development handling

## Token Security

- ✅ Tokens are generated locally on your machine
- ✅ Tokens are stored as environment variables (not in code)
- ✅ Refresh tokens allow automatic token renewal
- ✅ Access tokens have limited scope (Google Drive file access only)

## Troubleshooting

### "Port 8080 is already in use"
Stop other applications using port 8080 or modify the script to use a different port.

### "Missing required environment variables"
Ensure your `.env` file contains:
```
GOOGLE_OAUTH_CLIENT_ID=your_client_id
GOOGLE_OAUTH_CLIENT_SECRET=your_client_secret
```

### "OAuth error: access_denied"
You denied access in Google's authorization page. Run the script again and click "Allow".

### "Google Drive access test failed"
- Check if Google Drive API is enabled in Google Cloud Console
- Verify the Google account has Drive access
- Ensure scopes include `https://www.googleapis.com/auth/drive.file`

### Tokens expired in production
The refresh token should automatically renew the access token. If issues persist:
1. Re-run the token generation script
2. Update environment variables with new tokens
3. Redeploy

## Development vs Production

- **Development**: Uses session-based OAuth (works as before)
- **Production**: Uses environment-based tokens (serverless compatible)

The application automatically detects which environment it's in and uses the appropriate token source.

## Token Refresh

The application automatically handles token refresh using the refresh token. If the access token expires, Google's API will automatically generate a new one using the refresh token.

## Files Modified

- ✅ `generate-google-tokens.js` - New token generation script
- ✅ `services/oauthDrive.js` - Enhanced to use environment tokens
- ✅ `routes/upload.routes.js` - Improved token handling and error messages
- ✅ `routes/googleAuth.js` - Enhanced status checking
- ✅ `package.json` - Added `generate-tokens` script

## Next Steps

1. Run `npm run generate-tokens`
2. Copy tokens to Vercel environment variables
3. Deploy and test Google Drive uploads! 🚀
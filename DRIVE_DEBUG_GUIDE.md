# Google Drive Upload Issue Debugging Guide

## Current Status
✅ OAuth authentication flow is working
✅ User can connect to Google Drive successfully  
❌ **Permission denied when uploading files**

## Recent Updates Made
1. ✅ Updated OAuth scopes to include `drive.file` permission in development
2. ✅ Added comprehensive error handling in `uploadToGDrive` function
3. ✅ Enhanced OAuth status checking with Drive API verification
4. ✅ Added missing upload endpoints in admin.js (`/upload/question-paper/:testId`, etc.)
5. ✅ Added test Drive access endpoint at `/admin/tests/test-drive-access`

## Google Cloud Console Configuration Checklist

### 1. OAuth Consent Screen Setup
- [ ] Go to [Google Cloud Console](https://console.cloud.google.com)
- [ ] Navigate to APIs & Services > OAuth consent screen
- [ ] **Add your email as a test user** (this is critical for development)
- [ ] Verify app status is in "Testing" mode for development

### 2. API Enablement
- [ ] Go to APIs & Services > Library
- [ ] Search for "Google Drive API"
- [ ] **Make sure Google Drive API is enabled**
- [ ] Also check that "Google+ API" is enabled (sometimes required)

### 3. OAuth Credentials
- [ ] Go to APIs & Services > Credentials
- [ ] Verify OAuth 2.0 Client ID exists
- [ ] Check Authorized redirect URIs include:
  - `http://localhost:3000/oauth/callback` (for development)
  - Your production domain callback URL

### 4. Scopes Verification
Current scopes being requested:
```javascript
const SCOPES = [
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/drive.file'  // ← This allows file creation
];
```

## Testing Steps

### 1. Test Basic Drive Access
```bash
# Run this test script to verify configuration
node test-drive.js
```

### 2. Test OAuth Status
```javascript
// Call this endpoint to check OAuth status
GET /api/admin/oauth/status
```

### 3. Test Drive API Access
```javascript
// Call this endpoint to test Drive API access
POST /api/admin/tests/test-drive-access
```

### 4. Test File Upload
- Try uploading a file through the test creation form
- Check browser console for detailed error messages
- Check server logs for Drive API error details

## Common Issues & Solutions

### Issue: "Permission denied" during upload
**Solution**: Make sure your email is added as a test user in OAuth consent screen

### Issue: "Invalid scope" error
**Solution**: Verify `drive.file` scope is included and OAuth consent screen has correct scopes

### Issue: "Redirect URI mismatch"
**Solution**: Add correct redirect URIs in OAuth client configuration

### Issue: "API not enabled"
**Solution**: Enable Google Drive API in Google Cloud Console

## Debug Commands

### Check server logs:
Look for these log messages:
- `✅ Tokens found, testing Drive API...`
- `✅ Drive API access successful`
- `❌ Drive access test failed:`

### Check browser network tab:
- OAuth callback should return 200 status
- Upload requests should show detailed error messages
- Look for 401, 403, or 500 errors

## Environment Variables Check
```bash
# Verify these are set correctly:
GOOGLE_OAUTH_CLIENT_ID=your_client_id
GOOGLE_OAUTH_CLIENT_SECRET=your_client_secret
GOOGLE_DRIVE_FOLDER_ID=optional_folder_id
```

## Next Actions
1. **Add yourself as test user** in Google Cloud Console OAuth consent screen
2. **Enable Google Drive API** if not already enabled
3. Test upload with enhanced error logging
4. If still failing, check specific error codes from Google Drive API

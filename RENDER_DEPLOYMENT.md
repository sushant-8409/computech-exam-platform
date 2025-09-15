# 🚀 Render Deployment Guide

## Step 1: Create Render Account
1. Go to [render.com](https://render.com) and sign up
2. Connect your GitHub account

## Step 2: Deploy Backend
1. Click "New +" and select "Web Service"
2. Connect your `computech-exam-platform` repository
3. Use these settings:
   - **Name:** `computech-exam-platform` (or your preferred name)
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Branch:** `master`

## Step 3: Set Environment Variables on Render
Add these environment variables in Render dashboard:

```
NODE_ENV=production
PORT=10000
MONGODB_URI=mongodb+srv://your-username:your-password@cluster.mongodb.net/your-database
JWT_SECRET=your-64-character-random-string
SESSION_SECRET=your-64-character-random-string
ADMIN_EMAIL=your-admin-email@example.com
ADMIN_PASSWORD=your-secure-admin-password
FRONTEND_URL=https://computechexamplatform.netlify.app
GOOGLE_OAUTH_CLIENT_ID=your-google-oauth-client-id
GOOGLE_OAUTH_CLIENT_SECRET=your-google-oauth-client-secret
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
CLOUDFLARE_ACCESS_KEY=your-cloudflare-access-key
CLOUDFLARE_SECRET_KEY=your-cloudflare-secret-key
CLOUDFLARE_ACCOUNT_ID=your-cloudflare-account-id
CLOUDFLARE_BUCKET_NAME=your-bucket-name
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
JDOODLE_CLIENT_ID=your-jdoodle-client-id
JDOODLE_CLIENT_SECRET=your-jdoodle-client-secret
GOOGLE_API_KEY=your-google-api-key
GOOGLE_DRIVE_FOLDER_ID=your-google-drive-folder-id
```

## Step 4: Get Your Render URL
After deployment, you'll get a URL like: `https://computech-exam-platform.onrender.com`

## Step 5: Update Netlify Environment Variables
In your Netlify dashboard, set:
```
REACT_APP_API_URL=https://your-app-name.onrender.com
```

## Step 6: Update Local netlify.toml
Update the REACT_APP_API_URL in netlify.toml to your actual Render URL.

## Step 7: Redeploy Frontend
Push changes to trigger Netlify redeploy.

---

## 🔧 Required Values Guide:

### MongoDB URI:
Get from [MongoDB Atlas](https://cloud.mongodb.com/):
- Format: `mongodb+srv://username:password@cluster.mongodb.net/database`

### JWT/Session Secrets:
Generate random 64-character strings:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Google OAuth:
Get from [Google Cloud Console](https://console.cloud.google.com/):
1. Create/Select project
2. Enable Google+ API
3. Create OAuth 2.0 credentials
4. Add authorized redirect URIs

### Email Settings:
For Gmail:
- EMAIL_USER: your-email@gmail.com
- EMAIL_PASS: App password (not regular password)

### Cloudflare R2:
Get from Cloudflare dashboard:
- Create R2 bucket
- Generate API tokens

### VAPID Keys:
Generate for push notifications:
```bash
npx web-push generate-vapid-keys
```

### JDoodle:
Get from [JDoodle](https://www.jdoodle.com/compiler-api):
- Create account and get API credentials
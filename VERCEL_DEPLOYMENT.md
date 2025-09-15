# 🚀 Vercel Deployment Guide

## Prerequisites
- Node.js installed
- Vercel CLI installed: `npm install -g vercel`
- GitHub repository connected

## Deployment Steps

### 1. Initialize Vercel Project
```bash
cd computech-exam-platform
vercel
```

### 2. Answer Vercel Questions:
- Set up and deploy? **Y**
- Which scope? **Your account**
- Link to existing project? **N** (first time)
- Project name: **computech-exam-platform**
- Directory: **./** (root)
- Override settings? **Y**
- Build Command: **npm run vercel-build**
- Output Directory: **frontend/build**
- Development Command: **npm run dev**

### 3. Set Environment Variables
Run these commands or set in Vercel dashboard:

```bash
vercel env add MONGODB_URI
vercel env add JWT_SECRET
vercel env add SESSION_SECRET
vercel env add ADMIN_EMAIL
vercel env add ADMIN_PASSWORD
vercel env add GOOGLE_OAUTH_CLIENT_ID
vercel env add GOOGLE_OAUTH_CLIENT_SECRET
vercel env add EMAIL_USER
vercel env add EMAIL_PASS
vercel env add CLOUDFLARE_ACCESS_KEY
vercel env add CLOUDFLARE_SECRET_KEY
vercel env add CLOUDFLARE_ACCOUNT_ID
vercel env add CLOUDFLARE_BUCKET_NAME
vercel env add VAPID_PUBLIC_KEY
vercel env add VAPID_PRIVATE_KEY
vercel env add JDOODLE_CLIENT_ID
vercel env add JDOODLE_CLIENT_SECRET
vercel env add GOOGLE_API_KEY
vercel env add GOOGLE_DRIVE_FOLDER_ID
```

### 4. Deploy to Production
```bash
vercel --prod
```

## Environment Variables Values

### Required Secrets (generate with node generate-secrets.js):
- **JWT_SECRET**: 64-character random string
- **SESSION_SECRET**: 64-character random string

### Database:
- **MONGODB_URI**: `mongodb+srv://username:password@cluster.mongodb.net/database`

### Admin Credentials:
- **ADMIN_EMAIL**: Your admin email
- **ADMIN_PASSWORD**: Secure admin password

### Google OAuth (from Google Cloud Console):
- **GOOGLE_OAUTH_CLIENT_ID**: Your Google OAuth client ID
- **GOOGLE_OAUTH_CLIENT_SECRET**: Your Google OAuth client secret
- **GOOGLE_API_KEY**: Google API key
- **GOOGLE_DRIVE_FOLDER_ID**: Google Drive folder ID

### Email (Gmail):
- **EMAIL_USER**: your-email@gmail.com
- **EMAIL_PASS**: App password (not regular password)

### Cloudflare R2:
- **CLOUDFLARE_ACCESS_KEY**: Cloudflare R2 access key
- **CLOUDFLARE_SECRET_KEY**: Cloudflare R2 secret key
- **CLOUDFLARE_ACCOUNT_ID**: Cloudflare account ID
- **CLOUDFLARE_BUCKET_NAME**: R2 bucket name

### Push Notifications (generate with web-push):
- **VAPID_PUBLIC_KEY**: VAPID public key
- **VAPID_PRIVATE_KEY**: VAPID private key

### Code Execution (JDoodle):
- **JDOODLE_CLIENT_ID**: JDoodle API client ID
- **JDOODLE_CLIENT_SECRET**: JDoodle API client secret

## Post-Deployment
1. Your app will be available at: `https://your-project.vercel.app`
2. Test login functionality
3. Verify API endpoints work
4. Check environment variables are loaded correctly

## Development
- Local development: `npm run dev`
- Frontend runs on: `http://localhost:3000`
- Backend API runs on: `http://localhost:5000`

## Vercel Benefits
✅ **Automatic deployments** from GitHub  
✅ **Frontend + Backend** in one deployment  
✅ **Serverless functions** for API  
✅ **Global CDN** for static files  
✅ **Custom domains** support  
✅ **Environment variables** management  
✅ **Build logs** and monitoring
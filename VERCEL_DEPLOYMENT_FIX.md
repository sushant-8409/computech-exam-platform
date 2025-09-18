# Vercel Deployment Fix for Coding Practice

## Issue
The coding practice feature was not accessible on Vercel deployment even though MONGOURI2 was added to .env.

## Root Cause
1. **Missing Route Registration**: The coding practice routes were not registered in `api/index.js` 
2. **Missing MONGOURI2 Connection**: The second MongoDB connection for coding practice was not established in the serverless environment

## Fixes Applied

### 1. Added Coding Practice Routes to api/index.js
```javascript
// Added this line in api/index.js
app.use('/coding-practice', require('../routes/codingPractice'));
```

### 2. Enhanced MongoDB Connection Function
Updated `connectToMongoDB()` in `api/index.js` to establish both connections:
- Primary database (MONGODB_URI)
- Questions database (MONGOURI2) for coding practice

### 3. Environment Variables for Vercel
Ensure these environment variables are set in Vercel dashboard:

**Required Variables:**
- `MONGODB_URI` - Primary database connection
- `MONGOURI2` - Coding practice database connection  
- `SESSION_SECRET` - Session security
- `JWT_SECRET` - JWT token signing
- `GOOGLE_OAUTH_CLIENT_ID` - Google OAuth
- `GOOGLE_OAUTH_CLIENT_SECRET` - Google OAuth secret
- `GEMINI_API_KEY` - AI features
- `EMAIL_USER` - Email service
- `EMAIL_PASS` - Email service password

## Deployment Steps

1. **Commit and Push Changes**
   ```bash
   git add .
   git commit -m "Fix: Add coding practice routes to Vercel deployment"
   git push origin main
   ```

2. **Verify Environment Variables in Vercel**
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Ensure all required variables are present
   - Special attention to `MONGOURI2`

3. **Test After Deployment**
   ```bash
   node test-vercel-deployment.js
   ```

4. **Manual Testing**
   - Visit: `https://your-vercel-url.vercel.app/student/coding-practice`
   - Login and verify coding practice dashboard loads
   - Test problem solving interface

## Key Files Changed
- `api/index.js` - Added coding practice routes and dual MongoDB connection
- `models/StudentSubmission.js` - Fixed run vs submit counting (bonus fix)
- `frontend/src/components/student/CodingInterface.js` - Enhanced UI (bonus improvements)

## Verification
After deployment, these endpoints should work:
- `/api/health` - Health check
- `/api/coding-practice/problems` - Problem list  
- `/api/coding-practice/student/dashboard` - Student dashboard (requires auth)

## Troubleshooting
If still not working:
1. Check Vercel function logs for connection errors
2. Verify MONGOURI2 connection string format
3. Ensure serverless function timeout is sufficient (default 10s)
4. Check that both MongoDB databases allow connections from Vercel IPs

## Production URL
Once deployed, coding practice should be accessible at:
`https://your-project.vercel.app/student/coding-practice`
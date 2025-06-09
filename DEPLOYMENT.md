# Deployment Guide - CompuTech's Advanced Student Online Examination Platform

This guide provides step-by-step instructions for deploying the examination platform to various hosting services.

## 🚀 Quick Deployment Options

### Option 1: Vercel + Railway (Recommended)

This is the most reliable and cost-effective option for production deployment.

#### Step 1: Deploy Backend to Railway

1. **Sign up for Railway**: Visit [railway.app](https://railway.app) and create an account
2. **Install Railway CLI**:
```bash
npm install -g @railway/cli
```

3. **Login to Railway**:
```bash
railway login
```

4. **Deploy Backend**:
```bash
# Navigate to project root
cd computech-exam-platform

# Initialize Railway project
railway init

# Deploy
railway up
```

5. **Set Environment Variables** in Railway Dashboard:
```env
MONGO_URI=mongodb+srv://mdalamrahman4:qX1pVqlNO1B7seKE@cluster0.euyvnad.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
CLOUDFLARE_ACCOUNT_ID=5697077f3da2f1f6a397e0d611c7c11f
CLOUDFLARE_ACCESS_KEY=e1aca988bbfc222ab3da2ff96a7d38a2
CLOUDFLARE_SECRET_KEY=f6fdf3e5fe04dbfd58c3293dc56a5a8fffe89844748f455e34aa4974105bee52
CLOUDFLARE_ENDPOINT=https://5697077f3da2f1f6a397e0d611c7c11f.r2.cloudflarestorage.com
CLOUDFLARE_BUCKET_NAME=computech-exam-files
ADMIN_EMAIL=mdalamrahman4@gmail.com
ADMIN_PASSWORD=Zerocheck@admin1
EMAIL_USER=computechmailer@gmail.com
EMAIL_PASS=exyyzlpgzuadcjge
JWT_SECRET=aVeryLongRandomStringForJWTSigning123456789
SESSION_SECRET=aVeryLongRandomString
PORT=5000
NODE_ENV=production
SIGNUP_URL=https://computech-07f0.onrender.com/signup.html
FORGOT_PASSWORD_URL=https://computech-07f0.onrender.com/forget-password.html
```

#### Step 2: Deploy Frontend to Vercel

1. **Install Vercel CLI**:
```bash
npm install -g vercel
```

2. **Login to Vercel**:
```bash
vercel login
```

3. **Deploy Frontend**:
```bash
cd frontend
vercel --prod
```

4. **Set Environment Variables** in Vercel Dashboard:
```env
REACT_APP_API_URL=https://your-railway-backend-url.railway.app
```

### Option 2: Netlify + Render

#### Step 1: Deploy Backend to Render

1. **Create Account**: Sign up at [render.com](https://render.com)
2. **Connect GitHub**: Link your GitHub repository
3. **Create Web Service**:
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Environment**: Node.js
4. **Add Environment Variables** (same as Railway above)

#### Step 2: Deploy Frontend to Netlify

1. **Create Account**: Sign up at [netlify.com](https://netlify.com)
2. **Connect GitHub**: Link your repository
3. **Configure Build Settings**:
   - **Base Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Publish Directory**: `frontend/build`
4. **Add Environment Variables**:
```env
REACT_APP_API_URL=https://your-render-backend-url.onrender.com
```

### Option 3: Heroku

#### Deploy Both Frontend and Backend

1. **Install Heroku CLI**:
```bash
npm install -g heroku
```

2. **Login to Heroku**:
```bash
heroku login
```

3. **Create Heroku Apps**:
```bash
heroku create computech-backend
heroku create computech-frontend
```

4. **Add Buildpacks** (for frontend):
```bash
heroku buildpacks:add heroku/nodejs --app computech-frontend
heroku buildpacks:add https://github.com/heroku/heroku-buildpack-static --app computech-frontend
```

5. **Configure Environment Variables**:
```bash
# Backend
heroku config:set MONGO_URI="mongodb+srv://..." --app computech-backend
heroku config:set CLOUDFLARE_ACCESS_KEY="..." --app computech-backend
# ... add all other variables

# Frontend
heroku config:set REACT_APP_API_URL="https://computech-backend.herokuapp.com" --app computech-frontend
```

6. **Deploy**:
```bash
# Deploy backend
git subtree push --prefix=. heroku main

# Deploy frontend
git subtree push --prefix=frontend heroku main
```

## 🐳 Docker Deployment

### Using Docker Compose

1. **Create docker-compose.yml**:
```yaml
version: '3.8'
services:
  backend:
    build: .
    ports:
      - "5000:5000"
    environment:
      - MONGO_URI=${MONGO_URI}
      - CLOUDFLARE_ACCESS_KEY=${CLOUDFLARE_ACCESS_KEY}
      # ... other environment variables
    depends_on:
      - mongodb

  frontend:
    build: ./frontend
    ports:
      - "3000:80"
    environment:
      - REACT_APP_API_URL=http://localhost:5000

  mongodb:
    image: mongo:latest
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db

volumes:
  mongodb_data:
```

2. **Create Dockerfiles**:

**Backend Dockerfile**:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 5000
CMD ["node", "server.js"]
```

**Frontend Dockerfile**:
```dockerfile
FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

3. **Run with Docker Compose**:
```bash
docker-compose up -d
```

## ☁️ AWS Deployment

### Using AWS ECS with Fargate

1. **Build and Push Images**:
```bash
# Build images
docker build -t computech-backend .
docker build -t computech-frontend ./frontend

# Tag images
docker tag computech-backend:latest your-account-id.dkr.ecr.region.amazonaws.com/computech-backend:latest
docker tag computech-frontend:latest your-account-id.dkr.ecr.region.amazonaws.com/computech-frontend:latest

# Push to ECR
docker push your-account-id.dkr.ecr.region.amazonaws.com/computech-backend:latest
docker push your-account-id.dkr.ecr.region.amazonaws.com/computech-frontend:latest
```

2. **Create ECS Cluster and Services** using AWS Console or CloudFormation

3. **Configure Load Balancer** for frontend and backend services

## 🔧 Environment Variables Configuration

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `MONGO_URI` | MongoDB connection string | `mongodb+srv://user:pass@cluster.mongodb.net/db` |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare R2 account ID | `5697077f3da2f1f6a397e0d611c7c11f` |
| `CLOUDFLARE_ACCESS_KEY` | Cloudflare R2 access key | `e1aca988bbfc222ab3da2ff96a7d38a2` |
| `CLOUDFLARE_SECRET_KEY` | Cloudflare R2 secret key | `f6fdf3e5fe04dbfd58c3293dc56a5a8f...` |
| `EMAIL_USER` | Gmail SMTP username | `computechmailer@gmail.com` |
| `EMAIL_PASS` | Gmail app password | `exyyzlpgzuadcjge` |
| `JWT_SECRET` | JWT signing secret | `aVeryLongRandomString123456789` |
| `ADMIN_EMAIL` | Admin login email | `mdalamrahman4@gmail.com` |
| `ADMIN_PASSWORD` | Admin login password | `Zerocheck@admin1` |

### Frontend Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `REACT_APP_API_URL` | Backend API URL | `https://your-backend.herokuapp.com` |

## 🌍 Custom Domain Setup

### For Vercel (Frontend)

1. **Add Domain** in Vercel Dashboard
2. **Configure DNS**:
```
Type: CNAME
Name: @
Value: cname.vercel-dns.com
```

### For Railway (Backend)

1. **Add Custom Domain** in Railway Dashboard
2. **Configure DNS**:
```
Type: CNAME
Name: api
Value: your-app.railway.app
```

## 📊 Monitoring and Logging

### Basic Monitoring Setup

1. **Health Check Endpoint**: Available at `/api/health`
2. **Logging**: Use platform-specific logging (Heroku logs, Railway logs, etc.)
3. **Error Tracking**: Consider integrating Sentry or similar service

### Performance Monitoring

```javascript
// Add to server.js for basic monitoring
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});
```

## 🔒 Security Configuration

### Production Security Headers

```javascript
// Add to server.js
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

### SSL/TLS Configuration

Most platforms handle SSL automatically, but ensure:
- **Force HTTPS**: Redirect HTTP to HTTPS
- **HSTS Headers**: Include security headers
- **Certificate Renewal**: Automatic on most platforms

## 🚨 Troubleshooting Deployment Issues

### Common Deployment Problems

1. **Build Failures**:
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

2. **Environment Variable Issues**:
- Check variable names (case-sensitive)
- Verify values don't contain special characters
- Restart services after changes

3. **MongoDB Connection Issues**:
- Whitelist deployment server IPs in MongoDB Atlas
- Check connection string format
- Verify network access

4. **File Upload Issues**:
- Verify Cloudflare R2 credentials
- Check bucket permissions
- Ensure correct endpoint URL

### Platform-Specific Issues

#### Vercel
- **Function Timeout**: Increase timeout in `vercel.json`
- **Bundle Size**: Optimize imports and use code splitting

#### Railway
- **Memory Limits**: Monitor usage and upgrade plan if needed
- **Build Time**: Optimize dependencies and build process

#### Heroku
- **Dyno Sleep**: Use uptimerobot or similar to prevent sleeping
- **Slug Size**: Optimize dependencies and assets

## 📈 Scaling Considerations

### Database Scaling
- **MongoDB Atlas**: Use cluster scaling features
- **Connection Pooling**: Configure appropriate pool sizes
- **Indexing**: Add indexes for frequently queried fields

### Application Scaling
- **Horizontal Scaling**: Add more server instances
- **Load Balancing**: Use platform load balancers
- **Caching**: Implement Redis for session storage

### File Storage Scaling
- **CDN**: Use Cloudflare CDN for global distribution
- **Compression**: Implement file compression
- **Cleanup**: Regular cleanup of old files

## 🔄 CI/CD Pipeline

### GitHub Actions Example

```yaml
name: Deploy to Production

on:
  push:
    branches: [ main ]

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Railway
        run: |
          npm install -g @railway/cli
          railway deploy

  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Vercel
        run: |
          npm install -g vercel
          cd frontend && vercel --prod --token ${{ secrets.VERCEL_TOKEN }}
```

---

This deployment guide covers all major hosting options and configurations. Choose the option that best fits your budget, technical requirements, and scaling needs.
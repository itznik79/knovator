# 🚀 Deployment Guide

Complete guide to deploy Knovator Job Importer to production.

## 📋 Prerequisites

- Docker & Docker Compose installed
- Vercel CLI installed: `npm i -g vercel`
- Git repository
- Vercel account

## 🎯 Deployment Overview

```
┌─────────────────────┐
│   Vercel (Frontend) │  ← Next.js UI (Port 443/HTTPS)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Your Server/VPS    │
│  (Backend + DB)     │
├─────────────────────┤
│  • MongoDB (27017)  │
│  • Redis (6379)     │
│  • API Server(4000) │
│  • Worker           │
└─────────────────────┘
```

## Part 1: Backend Deployment (Docker)

### Step 1: Prepare Environment Variables

Create production environment files:

**server/.env.production**
```env
# Database
MONGODB_URI=mongodb://mongo:27017/jobboard

# Redis
REDIS_URL=redis://redis:6379

# Server
PORT=4000
NODE_ENV=production

# Queue
BULL_QUEUE_NAME=job_import_queue

# CORS - Update with your Vercel domain
CORS_ORIGIN=https://your-app.vercel.app

# Optional: If using MongoDB Atlas instead
# MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/jobboard?retryWrites=true&w=majority
```

**worker/.env.production**
```env
# Database
MONGODB_URI=mongodb://mongo:27017/jobboard

# Redis
REDIS_URL=redis://redis:6379

# Queue
BULL_QUEUE_NAME=job_import_queue

# Worker Settings (High Performance)
WORKER_CONCURRENCY=50
BATCH_SIZE=500
FLUSH_INTERVAL_MS=1000
MAX_BUFFER_SIZE=50000

# Environment
NODE_ENV=production

# Optional: If using MongoDB Atlas
# MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/jobboard?retryWrites=true&w=majority
```

### Step 2: Build and Start Services

```bash
# Build all services
docker-compose build

# Start all services in detached mode
docker-compose up -d

# Check logs
docker-compose logs -f

# Check status
docker-compose ps
```

### Step 3: Verify Backend is Running

```bash
# Test API health
curl http://localhost:4000/jobs/health

# Expected response:
# {"status":"ok","timestamp":"2026-02-01T..."}

# Test metrics endpoint
curl http://localhost:4000/metrics
```

### Step 4: Expose Backend to Internet

You need to make your backend accessible from the internet. Choose one option:

#### Option A: Using ngrok (Quick Testing)

```bash
# Install ngrok
# Visit https://ngrok.com and sign up

# Expose port 4000
ngrok http 4000

# Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
# Use this as NEXT_PUBLIC_API_URL in Vercel
```

#### Option B: Using a VPS with Public IP (Recommended)

If you have a server with a public IP:

1. **Update firewall rules:**
```bash
# Allow port 4000
sudo ufw allow 4000/tcp
```

2. **Your API URL will be:**
```
http://YOUR_SERVER_IP:4000
```

#### Option C: Using Nginx Reverse Proxy (Production)

Set up Nginx on your server:

**nginx.conf**
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Then use Let's Encrypt for SSL:
```bash
sudo certbot --nginx -d api.yourdomain.com
```

Your API URL: `https://api.yourdomain.com`

## Part 2: Frontend Deployment (Vercel)

### Step 1: Prepare for Vercel

Update `client/.env.local`:
```env
# Replace with your backend URL from Part 1
NEXT_PUBLIC_API_URL=http://YOUR_SERVER_IP:4000
# or
# NEXT_PUBLIC_API_URL=https://abc123.ngrok.io
# or
# NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

### Step 2: Deploy to Vercel

#### Option A: Using Vercel CLI

```bash
# Navigate to client folder
cd client

# Login to Vercel
vercel login

# Deploy
vercel

# Follow prompts:
# ? Set up and deploy "client"? [Y/n] y
# ? Which scope? Your Name
# ? Link to existing project? [y/N] n
# ? What's your project's name? knovator-job-importer
# ? In which directory is your code located? ./

# Deploy to production
vercel --prod
```

#### Option B: Using Vercel Dashboard

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New" → "Project"
3. Import your Git repository
4. Configure:
   - **Framework Preset:** Next.js
   - **Root Directory:** `client`
   - **Build Command:** `npm run build`
   - **Output Directory:** `.next`

5. **Environment Variables** (Important!):
   ```
   NEXT_PUBLIC_API_URL = http://YOUR_SERVER_IP:4000
   ```

6. Click "Deploy"

### Step 3: Update CORS in Backend

Once you have your Vercel URL (e.g., `https://knovator-job-importer.vercel.app`):

Update `server/.env.production`:
```env
CORS_ORIGIN=https://knovator-job-importer.vercel.app
```

Restart backend:
```bash
docker-compose restart server
```

## Part 3: Testing the Deployment

### 1. Test Frontend

Visit your Vercel URL: `https://your-app.vercel.app`

### 2. Test Import Functionality

1. Click "Trigger Import"
2. Watch real-time progress
3. Check import history page

### 3. Test API Directly

```bash
# Health check
curl https://api.yourdomain.com/jobs/health

# Trigger import
curl -X POST https://api.yourdomain.com/imports/start

# Get import history
curl https://api.yourdomain.com/imports
```

## 📊 Monitoring

### Check Backend Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f server
docker-compose logs -f worker
```

### Check Queue Status

```bash
# Access Redis CLI
docker exec -it knovator-redis redis-cli

# Check queue
LLEN bull:job_import_queue:wait
LLEN bull:job_import_queue:active
```

### Check Database

```bash
# Access MongoDB
docker exec -it knovator-mongo mongosh

# Use database
use jobboard

# Check collections
db.jobs.countDocuments()
db.importlogs.find().sort({createdAt: -1}).limit(5)
```

## 🔄 Updates & Maintenance

### Update Backend

```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose down
docker-compose build
docker-compose up -d
```

### Update Frontend

```bash
# If using Vercel Git integration, just push to main branch
git push origin main

# Or redeploy manually
cd client
vercel --prod
```

## 🔒 Security Checklist

- [ ] Change default MongoDB URI (use strong password if exposed)
- [ ] Use environment variables for secrets
- [ ] Enable HTTPS on backend (use Nginx + Let's Encrypt)
- [ ] Set proper CORS_ORIGIN (not `*` in production)
- [ ] Use MongoDB Atlas with IP whitelist for production DB
- [ ] Enable Redis password if exposed to internet
- [ ] Set up firewall rules on server
- [ ] Use `.env` files (never commit to Git)
- [ ] Regularly update Docker images
- [ ] Monitor logs for suspicious activity

## 🎯 Production Recommendations

### Use MongoDB Atlas (Recommended)

Instead of local MongoDB, use MongoDB Atlas:

1. Create free cluster at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Get connection string
3. Update `.env.production`:
   ```env
   MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/jobboard
   ```

### Use Redis Cloud (Optional)

For better Redis performance:

1. Get free Redis at [redis.com/cloud](https://redis.com/try-free)
2. Update `.env.production`:
   ```env
   REDIS_URL=redis://username:password@host:port
   ```

## 🆘 Troubleshooting

### Frontend can't connect to backend

**Error:** `Failed to fetch` or CORS errors

**Solutions:**
1. Check `NEXT_PUBLIC_API_URL` in Vercel environment variables
2. Verify backend is accessible: `curl YOUR_API_URL/jobs/health`
3. Check CORS_ORIGIN matches your Vercel URL
4. Restart backend: `docker-compose restart server`

### Backend won't start

**Error:** Container keeps restarting

**Solutions:**
```bash
# Check logs
docker-compose logs server

# Common issues:
# 1. MongoDB not ready - wait for healthcheck
# 2. Port already in use - change port in docker-compose.yml
# 3. Build failed - check Dockerfile syntax
```

### Worker not processing jobs

**Solutions:**
```bash
# Check worker logs
docker-compose logs worker

# Check Redis connection
docker exec -it knovator-redis redis-cli ping

# Check queue
docker exec -it knovator-redis redis-cli
> LLEN bull:job_import_queue:wait
```

## 📞 Share with Company

Once deployed, share these URLs:

- **Live Application:** `https://your-app.vercel.app`
- **API Health:** `https://api.yourdomain.com/jobs/health`
- **Import History:** `https://your-app.vercel.app/imports`
- **Metrics:** `https://api.yourdomain.com/metrics`

## 📝 Quick Commands Reference

```bash
# Start everything
docker-compose up -d

# Stop everything
docker-compose down

# Rebuild after changes
docker-compose build && docker-compose up -d

# View logs
docker-compose logs -f

# Restart specific service
docker-compose restart server

# Check status
docker-compose ps

# Deploy frontend to Vercel
cd client && vercel --prod
```

---

**Your app is now live!** 🎉

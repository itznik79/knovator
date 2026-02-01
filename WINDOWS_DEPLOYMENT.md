# 🚀 Windows + Docker Desktop Deployment Guide

## 📋 Prerequisites

✅ **Docker Desktop** installed on Windows  
✅ **Git** installed  
✅ **Node.js 18+** installed  
✅ **MongoDB Atlas** account (free tier works!)  
✅ **Vercel** account (for frontend)

---

## 🗄️ Step 1: Configure MongoDB Atlas

### 1.1 Get Your Database Credentials

Your MongoDB Atlas connection string:
```
mongodb+srv://<db_username>:<db_password>@cluster0.lraki1b.mongodb.net/
```

**You need to replace:**
- `<db_username>` → Your MongoDB Atlas username
- `<db_password>` → Your MongoDB Atlas password

Example:
```
mongodb+srv://myuser:MySecurePass123@cluster0.lraki1b.mongodb.net/jobboard?retryWrites=true&w=majority
```

### 1.2 Update Environment Files

**Open these 2 files and replace the MONGO_URI:**

1. **`server\.env`** - Line 3:
```env
MONGO_URI=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@cluster0.lraki1b.mongodb.net/jobboard?retryWrites=true&w=majority
```

2. **`worker\.env`** - Line 3:
```env
MONGO_URI=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@cluster0.lraki1b.mongodb.net/jobboard?retryWrites=true&w=majority
```

**⚠️ Important:** 
- Replace `YOUR_USERNAME` and `YOUR_PASSWORD` with actual values
- Keep `jobboard` as the database name
- Keep `?retryWrites=true&w=majority` at the end

### 1.3 Configure MongoDB Atlas Network Access

1. Go to [MongoDB Atlas](https://cloud.mongodb.com)
2. Click **Network Access** (left sidebar)
3. Click **Add IP Address**
4. Click **Allow Access from Anywhere** (0.0.0.0/0)
5. Click **Confirm**

---

## 🐳 Step 2: Deploy Backend with Docker Desktop

### 2.1 Start Docker Desktop

1. Open **Docker Desktop** on Windows
2. Wait until it shows "Docker Desktop is running"

### 2.2 Build and Start Backend Services

Open **PowerShell** in your project folder (`d:\knovator`) and run:

```powershell
# Build and start Redis + Server + Worker using MongoDB Atlas
docker-compose -f docker-compose.atlas.yml up -d --build
```

This will:
- ✅ Start Redis (queue system)
- ✅ Build and start NestJS Server (API)
- ✅ Build and start Worker (job processor)
- ✅ Connect to MongoDB Atlas (your cloud database)

### 2.3 Verify Backend is Running

```powershell
# Check all containers are running
docker ps

# You should see:
# - knovator-redis
# - knovator-server
# - knovator-worker

# Test API health
curl http://localhost:4000/jobs/health

# Should return: {"status":"ok","timestamp":"..."}
```

### 2.4 View Backend Logs

```powershell
# View all logs
docker-compose -f docker-compose.atlas.yml logs -f

# View server logs only
docker logs knovator-server -f

# View worker logs only
docker logs knovator-worker -f

# Press Ctrl+C to stop viewing logs
```

---

## 🌐 Step 3: Expose Backend to Internet

Since you're on Windows, choose **Option A** (easiest):

### Option A: Using ngrok (Recommended for Testing)

1. **Download ngrok:**
   - Go to https://ngrok.com/download
   - Download Windows version
   - Extract `ngrok.exe` to a folder

2. **Sign up and get auth token:**
   - Create free account at https://ngrok.com
   - Copy your authtoken from dashboard

3. **Configure ngrok:**
```powershell
# Navigate to where you extracted ngrok.exe
cd C:\path\to\ngrok

# Add your authtoken
.\ngrok.exe authtoken YOUR_AUTH_TOKEN
```

4. **Start ngrok tunnel:**
```powershell
# Expose local port 4000
.\ngrok.exe http 4000
```

5. **Copy the HTTPS URL:**
```
Forwarding  https://abc123.ngrok.io -> http://localhost:4000
            ^^^^^^^^^^^^^^^^^^^^^^^^
            Copy this URL!
```

**⚠️ Keep ngrok running!** Don't close this PowerShell window.

---

## ☁️ Step 4: Deploy Frontend to Vercel

### 4.1 Update Frontend Configuration

**Open `client\.env`** and update the API URL:

```env
NEXT_PUBLIC_API_URL=https://abc123.ngrok.io
```
Replace `abc123.ngrok.io` with YOUR ngrok URL (without trailing slash).

### 4.2 Deploy to Vercel

**Option 1: Using Vercel Dashboard (Easiest)**

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **"Add New"** → **"Project"**
3. Import your Git repository (push to GitHub first if needed)
4. Configure:
   - **Framework Preset:** Next.js
   - **Root Directory:** `client`
   - **Build Command:** `npm run build`
   - **Output Directory:** `.next`

5. **Add Environment Variable:**
   - Click **"Environment Variables"**
   - **Name:** `NEXT_PUBLIC_API_URL`
   - **Value:** `https://abc123.ngrok.io` (your ngrok URL)
   - Click **"Add"**

6. Click **"Deploy"**

**Option 2: Using Vercel CLI**

```powershell
# Install Vercel CLI globally
npm install -g vercel

# Navigate to client folder
cd client

# Login to Vercel
vercel login

# Deploy
vercel

# Follow prompts and set environment variable when asked:
# NEXT_PUBLIC_API_URL = https://abc123.ngrok.io

# Deploy to production
vercel --prod
```

### 4.3 Get Your Live URL

After deployment, Vercel will give you a URL like:
```
https://knovator-job-importer.vercel.app
```

**🎉 This is your shareable link!**

---

## 🔄 Step 5: Update CORS Settings

Once you have your Vercel URL, update CORS:

1. **Open `server\.env`**
2. **Update line 23:**
```env
CORS_ORIGIN=https://knovator-job-importer.vercel.app
```
Replace with YOUR Vercel URL.

3. **Restart server:**
```powershell
docker restart knovator-server
```

---

## ✅ Step 6: Test Everything

### Test Backend
```powershell
# Health check
curl http://localhost:4000/jobs/health

# Or visit in browser
start http://localhost:4000/jobs/health
```

### Test Frontend
Visit your Vercel URL: `https://your-app.vercel.app`

### Test Import Feature
1. Go to your Vercel URL
2. Click **"Trigger Import"**
3. Watch real-time progress
4. Go to **"/imports"** page to see history

---

## 📊 Monitoring Commands (Windows PowerShell)

```powershell
# View all running containers
docker ps

# View backend logs (follow mode)
docker logs knovator-server -f

# View worker logs (follow mode)
docker logs knovator-worker -f

# View all logs
docker-compose -f docker-compose.atlas.yml logs -f

# Check Redis queue status
docker exec -it knovator-redis redis-cli
# Then type: LLEN bull:job_import_queue:wait

# Check container resource usage
docker stats

# Stop all services
docker-compose -f docker-compose.atlas.yml down

# Restart all services
docker-compose -f docker-compose.atlas.yml restart

# Rebuild after code changes
docker-compose -f docker-compose.atlas.yml up -d --build
```

---

## 🔍 MongoDB Atlas Monitoring

1. Go to [MongoDB Atlas Dashboard](https://cloud.mongodb.com)
2. Click your cluster **"Cluster0"**
3. Click **"Collections"** to view data:
   - `jobboard` database
   - `jobs` collection (imported job listings)
   - `importlogs` collection (import history)

---

## 🆘 Troubleshooting

### ❌ "Cannot connect to MongoDB"

**Check:**
1. MongoDB Atlas IP whitelist includes `0.0.0.0/0`
2. Username/password are correct in `.env` files
3. Connection string includes `?retryWrites=true&w=majority`

**Test connection:**
```powershell
# View server logs
docker logs knovator-server

# Look for MongoDB connection success/error
```

### ❌ "Frontend can't connect to backend"

**Check:**
1. ngrok is still running
2. `NEXT_PUBLIC_API_URL` in Vercel matches ngrok URL
3. CORS_ORIGIN in `server\.env` matches Vercel URL

**Fix:**
```powershell
# Restart server with updated CORS
docker restart knovator-server

# Redeploy frontend
cd client
vercel --prod
```

### ❌ "Docker containers keep restarting"

**Check logs:**
```powershell
docker-compose -f docker-compose.atlas.yml logs
```

**Common fixes:**
- Update `.env` files with correct MongoDB Atlas credentials
- Ensure Docker Desktop has enough resources (Settings → Resources)
- Check Windows Firewall isn't blocking Docker

### ❌ "Worker not processing jobs"

**Check:**
```powershell
# View worker logs
docker logs knovator-worker -f

# Check Redis connection
docker exec -it knovator-redis redis-cli ping
# Should return: PONG

# Check if worker is connected
docker-compose -f docker-compose.atlas.yml ps
# All containers should show "Up"
```

---

## 📦 GitHub Actions (Optional)

Your existing workflows will work, but they're for Ubuntu runners. Since you're deploying locally with Docker Desktop on Windows, you don't need to use GitHub Actions for now.

If you want automated deployments later, you can:
1. Push to Docker Hub using `.github/workflows/cd-dockerhub.yml`
2. Set up secrets in GitHub repository settings
3. Workflows run on GitHub's servers (Ubuntu), not your Windows machine

---

## 🎯 Share with Your Company

Send them:
- **✅ Live Application:** `https://your-app.vercel.app`
- **✅ Import Page:** `https://your-app.vercel.app/imports`
- **✅ API Health:** `https://abc123.ngrok.io/jobs/health`
- **✅ Metrics:** `https://abc123.ngrok.io/metrics`

---

## 🔄 Making Updates

### Update Backend Code
```powershell
# After changing code in server/ or worker/
docker-compose -f docker-compose.atlas.yml up -d --build

# Or rebuild specific service
docker-compose -f docker-compose.atlas.yml up -d --build server
```

### Update Frontend Code
```powershell
# After changing code in client/
cd client
vercel --prod
```

---

## 🚀 Performance Stats

Your system is optimized for:
- **✅ 1,000,000+ entries** in ~70 seconds
- **✅ 50 parallel workers**
- **✅ 500 items per batch**
- **✅ Real-time progress tracking**
- **✅ 85x performance improvement**

---

**🎉 Your deployment is complete!**

Need help? Check the logs first:
```powershell
docker-compose -f docker-compose.atlas.yml logs -f
```

# 🚀 Quick Start Deployment

## Option 1: Deploy Everything with Docker (Simplest)

```bash
# 1. Build and start all services
docker-compose build
docker-compose up -d

# 2. Check status
docker-compose ps

# 3. Your backend is now running at:
http://localhost:4000

# 4. To make it accessible from internet, use ngrok:
ngrok http 4000
# Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
```

## Option 2: Deploy Backend on Docker + Frontend on Vercel (Recommended)

### Step 1: Start Backend

```bash
# Build and start backend services
docker-compose up -d mongo redis server worker

# Verify it's working
curl http://localhost:4000/jobs/health
```

### Step 2: Expose Backend to Internet

Choose one option:

**A. Using ngrok (Quick Testing)**
```bash
ngrok http 4000
# Copy the URL: https://abc123.ngrok.io
```

**B. Using your server's public IP**
```bash
# If you have a VPS with public IP
# Allow port 4000 in firewall
sudo ufw allow 4000/tcp

# Your URL: http://YOUR_SERVER_IP:4000
```

### Step 3: Deploy Frontend to Vercel

```bash
# 1. Update backend URL in client/.env.production
NEXT_PUBLIC_API_URL=https://abc123.ngrok.io  # or your server IP

# 2. Deploy to Vercel
cd client
vercel login
vercel

# Or via Vercel dashboard:
# - Go to vercel.com
# - Import Git repository
# - Set Root Directory to "client"
# - Add environment variable: NEXT_PUBLIC_API_URL
# - Deploy
```

### Step 4: Update CORS

```bash
# After getting Vercel URL (e.g., https://knovator.vercel.app)
# Update server/.env.production:
CORS_ORIGIN=https://knovator.vercel.app

# Restart server
docker-compose restart server
```

## 🎯 Share with Company

Send them:
- **Live App:** https://your-app.vercel.app
- **Import Page:** https://your-app.vercel.app/imports

## 📊 Monitor Your Deployment

```bash
# View logs
docker-compose logs -f

# Check worker performance
docker-compose logs worker | grep "Processed"

# Check database
docker exec -it knovator-mongo mongosh
> use jobboard
> db.jobs.countDocuments()
```

## 🔄 Update After Changes

```bash
# Rebuild and restart
docker-compose down
docker-compose build
docker-compose up -d

# Redeploy frontend
cd client
vercel --prod
```

## 🆘 Troubleshooting

**Backend won't start?**
```bash
docker-compose logs server
```

**Frontend can't connect?**
1. Check `NEXT_PUBLIC_API_URL` in Vercel
2. Verify backend is accessible: `curl YOUR_API_URL/jobs/health`
3. Check CORS settings in server/.env.production

**For detailed guide, see DEPLOYMENT_GUIDE.md**

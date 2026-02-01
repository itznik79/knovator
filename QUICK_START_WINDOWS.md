# ⚡ Quick Start - Windows Deployment

## 📝 Before You Start

1. ✅ Docker Desktop running
2. ✅ Update MongoDB Atlas credentials in `.env` files

---

## 🔑 Step 1: Update MongoDB Credentials

**Edit these 2 files:**

1. **`server\.env`** (Line 3):
```env
MONGO_URI=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@cluster0.lraki1b.mongodb.net/jobboard?retryWrites=true&w=majority
```

2. **`worker\.env`** (Line 3):
```env
MONGO_URI=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@cluster0.lraki1b.mongodb.net/jobboard?retryWrites=true&w=majority
```

Replace:
- `YOUR_USERNAME` → Your MongoDB Atlas username
- `YOUR_PASSWORD` → Your MongoDB Atlas password

---

## 🐳 Step 2: Start Backend (PowerShell)

```powershell
# Build and start all services
docker-compose -f docker-compose.atlas.yml up -d --build

# Check status
docker ps

# Test health
curl http://localhost:4000/jobs/health
```

---

## 🌐 Step 3: Expose Backend with ngrok

1. Download ngrok: https://ngrok.com/download
2. Run:
```powershell
.\ngrok.exe http 4000
```
3. Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

---

## ☁️ Step 4: Deploy Frontend to Vercel

1. Update `client\.env`:
```env
NEXT_PUBLIC_API_URL=https://abc123.ngrok.io
```

2. Deploy:
```powershell
cd client
vercel login
vercel --prod
```

Or use Vercel Dashboard:
- Import Git repo
- Root Directory: `client`
- Add env var: `NEXT_PUBLIC_API_URL` = `https://abc123.ngrok.io`

---

## 🔄 Step 5: Update CORS

After getting Vercel URL, update `server\.env`:
```env
CORS_ORIGIN=https://your-app.vercel.app
```

Restart:
```powershell
docker restart knovator-server
```

---

## ✅ Done!

Share: `https://your-app.vercel.app` 🎉

**See WINDOWS_DEPLOYMENT.md for detailed guide**

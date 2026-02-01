# MongoDB Setup Guide

This guide covers MongoDB setup for both local development and cloud deployment using MongoDB Atlas.

## Local Development Setup

### Using Docker (Recommended)

The project includes a `docker-compose.yml` file that sets up MongoDB and Redis:

```bash
docker-compose up -d
```

This will start:
- **MongoDB** on port `27017`
- **Redis** on port `6379`

### Manual Installation

If you prefer to install MongoDB locally:

```bash
# Windows (using Chocolatey)
choco install mongodb

# macOS (using Homebrew)
brew tap mongodb/brew
brew install mongodb-community

# Linux (Ubuntu/Debian)
sudo apt-get install mongodb
```

## MongoDB Atlas (Cloud)

### Setup Steps

1. **Create Account**
   - Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
   - Sign up for a free account

2. **Create Cluster**
   - Click "Build a Database"
   - Choose "Shared" (Free tier)
   - Select your preferred region
   - Click "Create Cluster"

3. **Configure Network Access**
   - Go to "Network Access"
   - Click "Add IP Address"
   - Add your IP or `0.0.0.0/0` for development (⚠️ not recommended for production)

4. **Create Database User**
   - Go to "Database Access"
   - Click "Add New Database User"
   - Choose "Password" authentication
   - Set username and password
   - Grant "Read and Write to any database" role

5. **Get Connection String**
   - Go to "Databases"
   - Click "Connect" on your cluster
   - Choose "Connect your application"
   - Copy the connection string
   - Replace `<password>` with your database user password
   - Replace `<dbname>` with your database name (e.g., `jobboard`)

### Connection String Format

```
mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/<dbname>?retryWrites=true&w=majority
```

### Environment Variables

Update your `.env` files:

**server/.env**
```env
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/jobboard?retryWrites=true&w=majority
```

**worker/.env**
```env
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/jobboard?retryWrites=true&w=majority
```

## Database Schema

### Collections

#### 1. jobs
Stores imported job listings.

**Indexes:**
```javascript
db.jobs.createIndex({ source: 1, guid: 1 }, { unique: true })
db.jobs.createIndex({ createdAt: -1 })
db.jobs.createIndex({ source: 1 })
```

**Schema:**
```javascript
{
  source: String,          // e.g., "jobicy#design-multimedia"
  guid: String,            // Unique job ID from feed
  jobId: String,           // Computed: source#guid
  title: String,           // Job title
  company: String,         // Company name
  location: String,        // Job location
  description: String,     // Full job description (HTML)
  pubDate: Date,           // Publication date
  url: String,             // Direct link to job posting
  logo: String,            // Company logo URL (optional)
  createdAt: Date,         // Import timestamp
  updatedAt: Date          // Last update timestamp
}
```

#### 2. importlogs
Tracks import history and statistics.

**Indexes:**
```javascript
db.importlogs.createIndex({ createdAt: -1 })
db.importlogs.createIndex({ fileName: 'text' })
```

**Schema:**
```javascript
{
  fileName: String,        // Feed URL or file name
  totalFetched: Number,    // Total items fetched from feed
  totalImported: Number,   // Total items processed
  newJobs: Number,         // New jobs added
  updatedJobs: Number,     // Existing jobs updated
  failedJobs: Number,      // Failed to process
  failures: [              // Detailed failure information
    {
      jobId: String,
      reason: String,
      error: String
    }
  ],
  createdAt: Date,         // Import timestamp
  updatedAt: Date
}
```

## Performance Optimization

### Recommended Settings

**Connection Pool:**
```javascript
mongoose.connect(mongoUri, {
  maxPoolSize: 100,        // Increase for high concurrency
  minPoolSize: 10,         // Minimum connections
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
});
```

### Indexes

Create indexes for frequently queried fields:

```javascript
// Jobs collection
db.jobs.createIndex({ source: 1, guid: 1 }, { unique: true })
db.jobs.createIndex({ createdAt: -1 })
db.jobs.createIndex({ source: 1 })
db.jobs.createIndex({ title: 'text', description: 'text' })  // For text search

// Import logs collection
db.importlogs.createIndex({ createdAt: -1 })
db.importlogs.createIndex({ fileName: 1 })
db.importlogs.createIndex({ fileName: 'text' })
```

### Bulk Operations

The worker uses bulk write operations for optimal performance:

```javascript
await JobModel.bulkWrite(operations, { ordered: false });
```

This is **10-20x faster** than individual inserts/updates.

## Monitoring

### Atlas Monitoring (Cloud)

1. Go to your Atlas cluster
2. Click "Metrics" tab
3. Monitor:
   - Operations per second
   - Network usage
   - Query efficiency
   - Index usage

### Local Monitoring

```bash
# Connect to MongoDB shell
mongosh

# Switch to your database
use jobboard

# View collection stats
db.jobs.stats()
db.importlogs.stats()

# Check index usage
db.jobs.aggregate([{ $indexStats: {} }])

# View current operations
db.currentOp()
```

## Backup & Restore

### Atlas (Automatic)

MongoDB Atlas provides automatic backups:
- Continuous backups (Point-in-time recovery)
- Snapshot backups
- Configure in "Backup" tab

### Manual Backup

```bash
# Export database
mongodump --uri="mongodb+srv://username:password@cluster.mongodb.net/jobboard" --out=./backup

# Restore database
mongorestore --uri="mongodb+srv://username:password@cluster.mongodb.net/jobboard" ./backup/jobboard
```

## Troubleshooting

### Connection Issues

**Error:** `MongoServerError: bad auth`
- **Solution**: Check username and password in connection string
- Ensure database user has correct permissions

**Error:** `MongooseServerSelectionError: connection timed out`
- **Solution**: Check network access settings in Atlas
- Add your current IP address to whitelist

**Error:** `MongooseError: Operation buffering timed out`
- **Solution**: Increase `serverSelectionTimeoutMS` and `socketTimeoutMS`

### Performance Issues

**Slow Queries:**
- Check if indexes exist: `db.jobs.getIndexes()`
- Use `explain()` to analyze queries: `db.jobs.find({source: "jobicy"}).explain()`
- Add missing indexes

**High Memory Usage:**
- Reduce batch size in worker
- Adjust connection pool size
- Monitor with `db.serverStatus()`

## Security Best Practices

1. **Never commit credentials** to git
2. **Use environment variables** for connection strings
3. **Limit IP access** in Atlas (don't use 0.0.0.0/0 in production)
4. **Use strong passwords** for database users
5. **Enable encryption** at rest (available in Atlas)
6. **Rotate credentials** regularly
7. **Use separate databases** for dev/staging/production

## Migration from Local to Atlas

1. Export local data:
   ```bash
   mongodump --db jobboard --out=./local-backup
   ```

2. Import to Atlas:
   ```bash
   mongorestore --uri="mongodb+srv://user:pass@cluster.mongodb.net/jobboard" ./local-backup/jobboard
   ```

3. Update `.env` files with Atlas connection string

4. Test the connection:
   ```bash
   npm run start:dev
   ```

## Additional Resources

- [MongoDB Atlas Documentation](https://docs.atlas.mongodb.com/)
- [Mongoose Documentation](https://mongoosejs.com/docs/)
- [MongoDB Performance Best Practices](https://www.mongodb.com/docs/manual/administration/analyzing-mongodb-performance/)
- [Connection String Options](https://www.mongodb.com/docs/manual/reference/connection-string/)

---

**Last Updated**: January 30, 2026  
**MongoDB Version**: 7.x  
**Mongoose Version**: 7.x

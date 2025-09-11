# Cronjob API Documentation

The Computech Exam Platform includes a comprehensive cronjob API for automated maintenance and monitoring tasks.

## Base URL
```
http://your-domain.com/api/cronjob
```

## Authentication
All cronjob endpoints require authentication via a secret key:

**Header:** `X-Cron-Secret: your-secret-key`  
**OR**  
**Query Parameter:** `?secret=your-secret-key`

Default secret (change in production): `default-cron-secret-change-in-production`

## Environment Variables
Set these in your `.env` file:
```
CRON_SECRET=your-secure-secret-key-here
```

## Available Endpoints

### 1. Health Check
**GET** `/api/cronjob/health`

Tests if the cronjob system is responding.

**Response:**
```json
{
  "success": true,
  "message": "Cronjob endpoint is healthy",
  "timestamp": "2025-08-31T15:19:29.559Z",
  "server": "computech-exam-platform"
}
```

### 2. System Status
**GET** `/api/cronjob/system-status`

Returns comprehensive system information including database stats and server metrics.

**Response:**
```json
{
  "success": true,
  "systemStatus": {
    "database": {
      "totalResults": 22,
      "totalTests": 17,
      "totalStudents": 10,
      "activeTests": 0,
      "testsLast24h": 4
    },
    "server": {
      "uptime": 8.0975434,
      "memory": {
        "rss": 158339072,
        "heapTotal": 119558144,
        "heapUsed": 90060736,
        "external": 20926882,
        "arrayBuffers": 18347640
      },
      "nodeVersion": "v20.11.0",
      "platform": "win32"
    },
    "timestamp": "2025-08-31T15:19:30.760Z"
  }
}
```

### 3. Cleanup Expired Sessions
**POST** `/api/cronjob/cleanup-expired-sessions`

Finds test sessions that have been in "in-progress" status for more than 24 hours and marks them as "abandoned".

**Response:**
```json
{
  "success": true,
  "message": "Expired sessions cleaned up successfully",
  "modifiedCount": 5,
  "timestamp": "2025-08-31T15:19:29.559Z"
}
```

### 4. Generate Analytics
**POST** `/api/cronjob/generate-analytics`

Generates daily analytics summary including test statistics, completion rates, and violation metrics.

**Response:**
```json
{
  "success": true,
  "message": "Analytics generated successfully",
  "analytics": {
    "date": "2025-08-31",
    "totalTests": 10,
    "completedTests": 8,
    "activeStudents": 5,
    "testsWithViolations": 2,
    "completionRate": "80.00",
    "violationRate": "20.00"
  },
  "timestamp": "2025-08-31T15:19:29.559Z"
}
```

### 5. Cleanup Monitoring Data
**POST** `/api/cronjob/cleanup-monitoring-data`

Removes old monitoring images from test results to save storage space.

**Parameters:**
- `retentionDays` (query parameter, optional): Number of days to retain data (default: 30)

**Example:** `/api/cronjob/cleanup-monitoring-data?retentionDays=60`

**Response:**
```json
{
  "success": true,
  "message": "Monitoring data cleaned up successfully",
  "resultsProcessed": 15,
  "imagesRemoved": 120,
  "retentionDays": 30,
  "timestamp": "2025-08-31T15:19:29.559Z"
}
```

### 6. Database Maintenance
**POST** `/api/cronjob/database-maintenance`

Performs various database maintenance tasks:
- Removes orphaned results (results without corresponding tests)
- Updates missing statistics in result documents

**Response:**
```json
{
  "success": true,
  "message": "Database maintenance completed successfully",
  "tasks": [
    "Removed 3 orphaned results",
    "Updated statistics for 8 results"
  ],
  "timestamp": "2025-08-31T15:19:29.559Z"
}
```

## Sample Cron Job Setup

### Using Linux/Unix Cron

```bash
# Edit crontab
crontab -e

# Add these lines:

# Health check every 5 minutes
*/5 * * * * curl -s "http://your-domain.com/api/cronjob/health?secret=your-secret" > /dev/null

# Cleanup expired sessions daily at 2 AM
0 2 * * * curl -X POST "http://your-domain.com/api/cronjob/cleanup-expired-sessions?secret=your-secret"

# Generate daily analytics at 1 AM
0 1 * * * curl -X POST "http://your-domain.com/api/cronjob/generate-analytics?secret=your-secret"

# Cleanup old monitoring data weekly (Sundays at 3 AM)
0 3 * * 0 curl -X POST "http://your-domain.com/api/cronjob/cleanup-monitoring-data?secret=your-secret&retentionDays=30"

# Database maintenance weekly (Mondays at 4 AM)
0 4 * * 1 curl -X POST "http://your-domain.com/api/cronjob/database-maintenance?secret=your-secret"
```

### Using GitHub Actions (for hosted solutions)

```yaml
name: Scheduled Maintenance
on:
  schedule:
    # Run every day at 2 AM UTC
    - cron: '0 2 * * *'

jobs:
  maintenance:
    runs-on: ubuntu-latest
    steps:
      - name: Cleanup Expired Sessions
        run: |
          curl -X POST "${{ secrets.APP_URL }}/api/cronjob/cleanup-expired-sessions?secret=${{ secrets.CRON_SECRET }}"
      
      - name: Generate Analytics
        run: |
          curl -X POST "${{ secrets.APP_URL }}/api/cronjob/generate-analytics?secret=${{ secrets.CRON_SECRET }}"
```

### Using Node.js Schedule (Self-hosted)

```javascript
const cron = require('node-cron');
const axios = require('axios');

const BASE_URL = 'http://localhost:5000';
const SECRET = process.env.CRON_SECRET;

// Daily cleanup at 2 AM
cron.schedule('0 2 * * *', async () => {
  try {
    await axios.post(`${BASE_URL}/api/cronjob/cleanup-expired-sessions?secret=${SECRET}`);
    console.log('✅ Expired sessions cleaned up');
  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
  }
});

// Generate analytics daily at 1 AM
cron.schedule('0 1 * * *', async () => {
  try {
    await axios.post(`${BASE_URL}/api/cronjob/generate-analytics?secret=${SECRET}`);
    console.log('✅ Analytics generated');
  } catch (error) {
    console.error('❌ Analytics generation failed:', error.message);
  }
});
```

## Error Handling

All endpoints return appropriate HTTP status codes:

- **200**: Success
- **401**: Unauthorized (missing or invalid secret)
- **500**: Server error

Error response format:
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

## Security Notes

1. **Change the default secret** in production environments
2. Use **HTTPS** for all cronjob requests in production
3. Consider **IP whitelisting** for cronjob endpoints
4. **Monitor logs** for unauthorized access attempts
5. **Rotate secrets** periodically

## Testing

Use the provided test script:
```bash
node test-cronjob.js
```

Or test individual endpoints:
```bash
# Health check
curl "http://localhost:5000/api/cronjob/health?secret=default-cron-secret-change-in-production"

# System status
curl "http://localhost:5000/api/cronjob/system-status?secret=default-cron-secret-change-in-production"
```

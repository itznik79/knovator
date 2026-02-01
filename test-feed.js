const axios = require('axios');

async function testFeed() {
  try {
    const url = 'https://jobicy.com/?feed=job_feed&job_categories=design-multimedia';
    console.log(`Testing ${url}...`);
    
    const res = await axios.get(url, { 
      responseType: 'text', 
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    console.log(`Status: ${res.status}`);
    console.log(`Content Length: ${res.data.length} bytes`);
    console.log(`First 500 chars: ${res.data.substring(0, 500)}`);
    
  } catch (err) {
    console.error(`Error: ${err.message}`);
    if (err.response) {
      console.error(`Response status: ${err.response.status}`);
      console.error(`Response data: ${err.response.data?.substring(0, 200)}`);
    }
  }
}

testFeed();

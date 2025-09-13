const axios = require('axios');

async function testDashboardCharts() {
  try {
    console.log('🧪 Testing dashboard chart APIs...');
    
    // First check if server is running by testing a simpler endpoint
    try {
      // Test root endpoint first
      const rootCheck = await axios.get('http://localhost:5000/', { timeout: 5000 });
      console.log('✅ Server is running');
    } catch (error) {
      console.log('❌ Server connection failed:', error.code, error.message);
      console.log('Make sure server is running on port 5000');
      return;
    }
    
    // Test chart data endpoint
    try {
      const chartResponse = await axios.get('http://localhost:5000/api/admin/dashboard/charts');
      console.log('📊 Chart data response:');
      console.log('  Success:', chartResponse.data.success);
      console.log('  Monthly data:', chartResponse.data.charts?.monthly || 'Missing');
      console.log('  Distribution data:', chartResponse.data.charts?.distribution || 'Missing');
      console.log('  Labels:', chartResponse.data.charts?.labels || 'Missing');
    } catch (error) {
      console.log('❌ Chart data error:', error.response?.status, error.response?.data?.message || error.message);
    }
    
    // Test grade distribution endpoint  
    try {
      const gradeResponse = await axios.get('http://localhost:5000/api/admin/analytics/grade-distribution');
      console.log('📈 Grade distribution response:');
      console.log('  Type:', Array.isArray(gradeResponse.data) ? 'Array' : typeof gradeResponse.data);
      console.log('  Length:', gradeResponse.data?.length || 'N/A');
      console.log('  Sample:', gradeResponse.data?.[0] || 'Empty');
    } catch (error) {
      console.log('❌ Grade distribution error:', error.response?.status, error.response?.data?.message || error.message);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testDashboardCharts();
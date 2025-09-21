async function testAPIs() {
  try {
    console.log('🧪 Testing Coxing APIs...\n');

    // Test GET availability
    console.log('📥 Testing GET /api/get-coxing-availability');
    const getResponse = await fetch('http://localhost:3002/api/get-coxing-availability');
    const getData = await getResponse.json();

    if (getResponse.ok) {
      console.log('✅ GET successful!');
      console.log(`📊 Found ${getData.availability?.length || 0} availability records\n`);
    } else {
      console.log('❌ GET failed:', getData.error);
      return;
    }

    // Test POST update (if there are members and availability data)
    if (getData.availability && getData.availability.length > 0) {
      const firstRecord = getData.availability[0];
      console.log('📤 Testing POST /api/update-coxing-availability');
      console.log(`Using date: ${firstRecord.date}`);

      const postResponse = await fetch('http://localhost:3002/api/update-coxing-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: 'test-member-id', // This will fail but test the API structure
          date: firstRecord.date,
          timeSlot: 'earlyAM',
          action: 'add'
        })
      });

      const postData = await postResponse.json();

      if (postResponse.ok) {
        console.log('✅ POST successful!');
      } else {
        console.log('ℹ️  POST responded (expected for test data):', postData.error);
      }
    }

    console.log('\n🎉 API tests completed!');

  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

testAPIs();
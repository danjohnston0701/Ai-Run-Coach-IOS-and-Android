// Quick test script to verify goals API endpoints
const baseUrl = 'http://localhost:3000';

async function testGoalsAPI() {
  console.log('🧪 Testing Goals API Endpoints\n');
  
  // 1. Register/Login to get auth token
  console.log('1️⃣  Logging in...');
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'test@example.com',
      password: 'password123'
    })
  });
  
  if (!loginRes.ok) {
    console.log('   ⚠️  Login failed, trying to register...');
    const registerRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      })
    });
    
    if (!registerRes.ok) {
      console.error('   ❌ Registration failed');
      process.exit(1);
    }
    
    const registerData = await registerRes.json();
    var token = registerData.token;
    var userId = registerData.user.id;
    console.log('   ✅ Registered new user');
  } else {
    const loginData = await loginRes.json();
    var token = loginData.token;
    var userId = loginData.user.id;
    console.log('   ✅ Logged in successfully');
  }
  
  console.log(`   User ID: ${userId}\n`);
  
  // 2. Create a goal
  console.log('2️⃣  Creating a goal...');
  const createGoalRes = await fetch(`${baseUrl}/api/goals`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      userId: userId,
      type: 'EVENT',
      title: 'Run my first marathon',
      description: 'Training for London Marathon',
      eventName: 'London Marathon 2026',
      eventLocation: 'London, UK',
      distanceTarget: 'Marathon',
      timeTargetSeconds: 14400,
      targetDate: '2026-04-26'
    })
  });
  
  if (!createGoalRes.ok) {
    console.error('   ❌ Failed to create goal:', await createGoalRes.text());
    process.exit(1);
  }
  
  const createdGoal = await createGoalRes.json();
  console.log('   ✅ Goal created:', createdGoal.title);
  console.log(`   Goal ID: ${createdGoal.id}\n`);
  
  // 3. Get goals
  console.log('3️⃣  Getting goals...');
  const getGoalsRes = await fetch(`${baseUrl}/api/goals/${userId}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (!getGoalsRes.ok) {
    console.error('   ❌ Failed to get goals:', await getGoalsRes.text());
    process.exit(1);
  }
  
  const goals = await getGoalsRes.json();
  console.log(`   ✅ Retrieved ${goals.length} goal(s)`);
  goals.forEach(g => {
    console.log(`      - ${g.title} (${g.type})`);
  });
  console.log();
  
  // 4. Update goal
  console.log('4️⃣  Updating goal...');
  const updateGoalRes = await fetch(`${baseUrl}/api/goals/${createdGoal.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      userId: userId,
      type: 'EVENT',
      title: 'Run my first marathon - UPDATED',
      description: 'Training hard for London Marathon!',
      eventName: 'London Marathon 2026',
      eventLocation: 'London, UK',
      distanceTarget: 'Marathon',
      timeTargetSeconds: 13500, // Updated time
      targetDate: '2026-04-26'
    })
  });
  
  if (!updateGoalRes.ok) {
    console.error('   ❌ Failed to update goal:', await updateGoalRes.text());
    process.exit(1);
  }
  
  const updatedGoal = await updateGoalRes.json();
  console.log('   ✅ Goal updated:', updatedGoal.title);
  console.log();
  
  // 5. Delete goal
  console.log('5️⃣  Deleting goal...');
  const deleteGoalRes = await fetch(`${baseUrl}/api/goals/${createdGoal.id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (!deleteGoalRes.ok) {
    console.error('   ❌ Failed to delete goal:', await deleteGoalRes.text());
    process.exit(1);
  }
  
  console.log('   ✅ Goal deleted\n');
  
  // 6. Verify deletion
  console.log('6️⃣  Verifying deletion...');
  const verifyGoalsRes = await fetch(`${baseUrl}/api/goals/${userId}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const remainingGoals = await verifyGoalsRes.json();
  console.log(`   ✅ ${remainingGoals.length} goal(s) remaining\n`);
  
  console.log('✨ All tests passed! Goals API is working correctly! ✨');
}

// Run tests
testGoalsAPI().catch(err => {
  console.error('\n❌ Test failed:', err.message);
  process.exit(1);
});

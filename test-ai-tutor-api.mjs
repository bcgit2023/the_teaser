import fetch from 'node-fetch';

async function testAITutorAPI() {
  console.log('Testing AI Tutor API...');
  
  const testPayload = {
    mode: 'reactive',
    messages: [
      { role: 'user', content: 'Hello, can you help me?' }
    ],
    currentQuestion: {
      text: 'I like pizza _____ ice cream.',
      options: ['and', 'but', 'or', 'so'],
      correct_answer: 'and',
      id: 1
    }
  };
  
  try {
    const response = await fetch('http://localhost:3000/api/ai-tutor', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload)
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error Response:', errorText);
      return false;
    }
    
    const result = await response.json();
    console.log('✅ API Success Response:', result);
    return true;
    
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    return false;
  }
}

async function testTextToSpeechAPI() {
  console.log('\nTesting Text-to-Speech API...');
  
  const testPayload = {
    text: 'Hello, this is a test.',
    voice: 'nova',
    model: 'tts-1'
  };
  
  try {
    const response = await fetch('http://localhost:3000/api/text-to-speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload)
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error Response:', errorText);
      return false;
    }
    
    console.log('✅ Text-to-Speech API working - received audio data');
    return true;
    
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    return false;
  }
}

async function runTests() {
  const aiTutorResult = await testAITutorAPI();
  const ttsResult = await testTextToSpeechAPI();
  
  console.log('\n=== Test Results ===');
  console.log('AI Tutor API:', aiTutorResult ? '✅ Working' : '❌ Failed');
  console.log('Text-to-Speech API:', ttsResult ? '✅ Working' : '❌ Failed');
  
  process.exit(aiTutorResult && ttsResult ? 0 : 1);
}

runTests();
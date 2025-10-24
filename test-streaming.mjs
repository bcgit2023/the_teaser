import fetch from 'node-fetch';

async function testStreamingAITutor() {
  console.log('Testing AI Tutor API with streaming...');
  
  const testPayload = {
    mode: 'reactive',
    messages: [
      { role: 'user', content: 'Hello, can you help me with this question?' }
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
    
    // Handle streaming response
    if (response.body) {
      console.log('✅ Streaming response received');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          fullContent += chunk;
          console.log('Chunk:', chunk);
        }
      } finally {
        reader.releaseLock();
      }
      
      console.log('✅ Full streaming content:', fullContent);
      return true;
    } else {
      console.error('❌ No response body');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    return false;
  }
}

testStreamingAITutor().then(success => {
  console.log('\n=== Test Result ===');
  console.log('Streaming AI Tutor API:', success ? '✅ Working' : '❌ Failed');
  process.exit(success ? 0 : 1);
});
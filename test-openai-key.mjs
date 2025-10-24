import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function testOpenAIKey() {
  console.log('Testing OpenAI API key...');
  console.log('API Key (first 20 chars):', process.env.OPENAI_API_KEY?.substring(0, 20) + '...');
  
  try {
    // Test with a simple completion request
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Say hello" }],
      max_tokens: 10
    });
    
    console.log('✅ OpenAI API key is valid!');
    console.log('Response:', completion.choices[0].message.content);
    return true;
  } catch (error) {
    console.error('❌ OpenAI API key test failed:');
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('Error status:', error.status);
    
    if (error.status === 401) {
      console.error('🔑 This indicates an invalid or expired API key');
    } else if (error.status === 429) {
      console.error('⏰ This indicates rate limiting or quota exceeded');
    }
    
    return false;
  }
}

testOpenAIKey().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Script error:', error);
  process.exit(1);
});
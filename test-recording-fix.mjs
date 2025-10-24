// Test script to verify recording fixes
import fetch from 'node-fetch';
import fs from 'fs';

async function testRecordingUpload() {
  console.log('🧪 Testing recording upload fixes...\n');
  
  try {
    // Create a mock video blob (small test file)
    const testData = Buffer.from('test video data');
    const formData = new FormData();
    
    // Create a mock file blob
    const blob = new Blob([testData], { type: 'video/webm' });
    formData.append('file', blob, 'test-recording.webm');
    
    console.log('📤 Testing local upload API...');
    const response = await fetch('http://localhost:3000/api/recordings/upload', {
      method: 'POST',
      body: formData,
    });
    
    console.log(`Status: ${response.status}`);
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Local upload test PASSED');
      console.log('Response:', result);
    } else {
      const error = await response.text();
      console.log('❌ Local upload test FAILED');
      console.log('Error:', error);
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
}

// Test MediaRecorder format compatibility
function testMediaRecorderFormats() {
  console.log('\n🎥 Testing MediaRecorder format compatibility...\n');
  
  const formats = [
    'video/mp4',
    'video/webm',
    'video/webm;codecs=vp8',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=h264'
  ];
  
  formats.forEach(format => {
    if (typeof MediaRecorder !== 'undefined') {
      const supported = MediaRecorder.isTypeSupported(format);
      console.log(`${supported ? '✅' : '❌'} ${format}: ${supported ? 'Supported' : 'Not supported'}`);
    } else {
      console.log('⚠️  MediaRecorder not available in Node.js environment');
      return;
    }
  });
}

// Run tests
testRecordingUpload();
testMediaRecorderFormats();
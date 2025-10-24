import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { ChatCompletionMessageParam } from 'openai/resources/chat'
import { retryOpenAICall } from '@/lib/retry-utils'

// Enable Edge Runtime for better performance and longer timeouts (30s vs 10s)
export const runtime = 'edge'

// Configure OpenAI client with timeout and retry settings
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 60000, // 60 seconds
  maxRetries: 3
})

// Define types for better type safety
interface AITutorRequest {
  mode: 'proactive' | 'reactive'
  messages: { role: string; content: string }[]
  currentQuestion?: {
    text: string
    options: string[]
    correct_answer?: string
    id?: string | number
  }
}

// We'll use the OpenAI SDK's built-in types for message roles

export async function POST(req: Request) {
  try {
    // Parse request with type safety and add logging
    const requestData = await req.json()
    console.log('[AI-TUTOR API] Received request:', JSON.stringify(requestData, null, 2))
    
    const { mode, currentQuestion, messages } = requestData as AITutorRequest
    


    // Enhanced system prompts with context awareness
    let baseSystemPrompt = mode === 'proactive' 
      ? "You are a friendly English tutor for kids aged 8-12. Use simple words and short sentences. Explain grammar in a fun, easy way that children can understand."
      : "You are a friendly English tutor helping kids aged 8-12 with their quiz questions. Use simple words and short sentences. Be encouraging and positive."

    // Convert message roles to valid OpenAI roles
    // Define a more specific type to handle the function message case
    const convertedMessages: ChatCompletionMessageParam[] = messages.map(msg => {
      // Ensure role is one of the valid OpenAI roles
      const role = (msg.role === 'user' || msg.role === 'assistant' || msg.role === 'system') 
        ? msg.role 
        : 'user'; // Default to user if role is not valid
      
      // For function and tool roles, we would need to add a name property
      // But since we're defaulting to user/assistant/system, this is safe
      return {
        role: role as 'user' | 'assistant' | 'system',
        content: msg.content
      };
    })

    // Create properly typed messages array
    const systemMessages: ChatCompletionMessageParam[] = [];
    
    // Add proactive instruction if needed
    if (mode === 'proactive') {
      systemMessages.push({
        role: "user",
        content: "Teach me about Simple Present tense. Start with a brief introduction and then explain its main uses with examples."
      });
    }
    
    // Build a comprehensive system prompt
    let fullSystemPrompt = baseSystemPrompt
    
    // Add current question context if available
    if (currentQuestion && currentQuestion.text && currentQuestion.options && currentQuestion.options.length > 0) {
      console.log('Processing question context:', JSON.stringify(currentQuestion, null, 2))
      
      // Format options with their letter choices for clearer reference
      const formattedOptions = currentQuestion.options.map((option, index) => {
        const optionLetter = String.fromCharCode(65 + index); // A, B, C, D...
        return `${optionLetter}\n${option}`;
      }).join('\n\n');
      
      console.log('Formatted options:', formattedOptions)
      
      // Add detailed context-specific instructions to the system prompt - child-friendly with answer checking
      // First, log the options and correct answer for debugging
      console.log('Question options:', JSON.stringify(currentQuestion.options));
      console.log('Correct answer from data:', JSON.stringify(currentQuestion.correct_answer));
      
      // Determine the correct answer index and letter
      let correctAnswerIndex = -1;
      let correctAnswerText = '';
      
      // If correct_answer is provided directly, use it
      if (currentQuestion.correct_answer) {
        correctAnswerText = currentQuestion.correct_answer;
        // Find the index of the correct answer in the options array
        correctAnswerIndex = currentQuestion.options.findIndex(option => 
          option.toLowerCase().trim() === currentQuestion.correct_answer?.toLowerCase().trim()
        );
        
        // If we couldn't find the index, try to see if correct_answer is actually a letter (A, B, C, D)
        if (correctAnswerIndex === -1 && currentQuestion.correct_answer.length === 1) {
          const letterCode = currentQuestion.correct_answer.toUpperCase().charCodeAt(0);
          if (letterCode >= 65 && letterCode <= 68) { // A-D
            correctAnswerIndex = letterCode - 65;
            if (correctAnswerIndex < currentQuestion.options.length) {
              correctAnswerText = currentQuestion.options[correctAnswerIndex];
            }
          }
        }
      } 
      // Otherwise, assume the first option (A) is correct
      else if (currentQuestion.options && currentQuestion.options.length > 0) {
        correctAnswerIndex = 0;
        correctAnswerText = currentQuestion.options[0];
      }
      
      const correctAnswerLetter = correctAnswerIndex >= 0 ? String.fromCharCode(65 + correctAnswerIndex) : 'A';
      
      console.log('Determined correct answer:', correctAnswerLetter, correctAnswerText);
      
      // Function to identify grammar type based on answer options
      const identifyGrammarType = (options: string[]): string => {
        const allOptions = options.map(opt => opt.toLowerCase().trim());
        
        // Check for prepositions
        const prepositions = ['in', 'on', 'at', 'by', 'for', 'with', 'from', 'to', 'of', 'under', 'over', 'between', 'among', 'through', 'during', 'before', 'after', 'above', 'below', 'beside', 'behind', 'near', 'around', 'across', 'against', 'within', 'without', 'upon', 'beneath', 'beyond', 'inside', 'outside', 'throughout', 'toward', 'towards', 'underneath', 'alongside', 'amid', 'amidst'];
        if (allOptions.some(opt => prepositions.includes(opt))) {
          return 'preposition';
        }
        
        // Check for conjunctions
        const conjunctions = ['and', 'but', 'or', 'so', 'yet', 'for', 'nor', 'because', 'since', 'although', 'though', 'while', 'whereas', 'if', 'unless', 'until', 'when', 'where', 'why', 'how', 'that', 'which', 'who', 'whom', 'whose'];
        if (allOptions.some(opt => conjunctions.includes(opt))) {
          return 'conjunction';
        }
        
        // Check for articles
        const articles = ['a', 'an', 'the'];
        if (allOptions.some(opt => articles.includes(opt))) {
          return 'article';
        }
        
        // Check for auxiliary/helping verbs
        const auxiliaryVerbs = ['is', 'are', 'was', 'were', 'am', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall', 'should', 'may', 'might', 'can', 'could', 'must', 'ought'];
        if (allOptions.some(opt => auxiliaryVerbs.includes(opt))) {
          return 'verb';
        }
        
        // Check for common modal verbs
        const modalVerbs = ['can', 'could', 'may', 'might', 'will', 'would', 'shall', 'should', 'must', 'ought'];
        if (allOptions.some(opt => modalVerbs.includes(opt))) {
          return 'modal verb';
        }
        
        // Check for pronouns
        const pronouns = ['i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'her', 'its', 'our', 'their', 'mine', 'yours', 'hers', 'ours', 'theirs', 'this', 'that', 'these', 'those', 'who', 'whom', 'whose', 'which', 'what'];
        if (allOptions.some(opt => pronouns.includes(opt))) {
          return 'pronoun';
        }
        
        // Check for adverbs (words ending in -ly or common adverbs)
        const commonAdverbs = ['very', 'quite', 'really', 'always', 'never', 'often', 'sometimes', 'usually', 'rarely', 'hardly', 'almost', 'just', 'only', 'even', 'still', 'already', 'yet', 'soon', 'now', 'then', 'here', 'there', 'everywhere', 'nowhere', 'somewhere', 'anywhere', 'well', 'badly', 'fast', 'slow', 'hard', 'easy', 'early', 'late', 'today', 'yesterday', 'tomorrow'];
        if (allOptions.some(opt => opt.endsWith('ly') || commonAdverbs.includes(opt))) {
          return 'adverb';
        }
        
        // Check for common adjectives
        const commonAdjectives = ['big', 'small', 'large', 'little', 'tall', 'short', 'long', 'wide', 'narrow', 'thick', 'thin', 'heavy', 'light', 'strong', 'weak', 'fast', 'slow', 'quick', 'old', 'new', 'young', 'fresh', 'hot', 'cold', 'warm', 'cool', 'dry', 'wet', 'clean', 'dirty', 'good', 'bad', 'nice', 'beautiful', 'ugly', 'happy', 'sad', 'angry', 'excited', 'tired', 'hungry', 'thirsty', 'full', 'empty', 'rich', 'poor', 'expensive', 'cheap', 'free', 'busy', 'lazy', 'smart', 'stupid', 'easy', 'hard', 'difficult', 'simple', 'complex', 'important', 'interesting', 'boring', 'funny', 'serious', 'quiet', 'loud', 'soft', 'rough', 'smooth', 'sharp', 'dull', 'bright', 'dark', 'colorful', 'plain'];
        if (allOptions.some(opt => commonAdjectives.includes(opt))) {
          return 'adjective';
        }
        
        // Default to "word" if we can't identify the specific type
        return 'word';
      };
      
      const grammarType = identifyGrammarType(currentQuestion.options);
      
      // Array of varied closing encouragement messages
      const encouragementVariations = [
        "Read each option in the sentence and pick the one that sounds most natural. You can do it!",
        "Try each word in the sentence and listen for which one sounds right. You've got this!",
        "Read the sentence with each option and trust your ears. I believe in you!",
        "Say each choice out loud in the sentence - your brain knows which sounds best!",
        "Test each word in the blank and pick the one that feels natural. You're doing great!",
        "Listen to how each option sounds in the sentence. You can figure this out!",
        "Try reading each choice in the sentence - one will sound just right!",
        "Use your language instincts - read each option and pick what sounds best!"
      ];
      
      // Randomly select an encouragement message
      const randomEncouragement = encouragementVariations[Math.floor(Math.random() * encouragementVariations.length)];
      
      fullSystemPrompt += `\n\nIMPORTANT: The student is looking at this question:\n\n"${currentQuestion.text}"\n\nThe options are:\n${formattedOptions}\n\nThe correct answer is option ${correctAnswerLetter}: "${correctAnswerText}"\n\nWhen helping the student:\n1. ALWAYS talk about this exact question\n2. Keep your answer SHORT - no more than 2-3 short sentences total\n3. Use SIMPLE words an 8-year-old would understand\n4. CAREFULLY CHECK if the student's answer matches ANY of these patterns - if it does, it's CORRECT!\n   - The exact word "${correctAnswerText}" (case insensitive)\n   - Just the letter "${correctAnswerLetter}" alone (case insensitive)\n   - Any phrase containing "answer is ${correctAnswerLetter}" (case insensitive)\n   - Any phrase containing "answer ${correctAnswerLetter}" (case insensitive)\n   - Any phrase containing "option ${correctAnswerLetter}" (case insensitive)\n   - Any phrase containing "${correctAnswerLetter}" (case insensitive)\n   - Any phrase containing "${correctAnswerText}" (case insensitive)\n   - Any phrase containing "${correctAnswerLetter}." (case insensitive)\n   - Any phrase containing "${correctAnswerLetter})" (case insensitive)\n   - Any phrase containing "i think ${correctAnswerLetter}" (case insensitive)\n   - Any phrase containing "i choose ${correctAnswerLetter}" (case insensitive)\n   - Any phrase containing "i select ${correctAnswerLetter}" (case insensitive)\n   - Any phrase containing "i pick ${correctAnswerLetter}" (case insensitive)\n   - ANY single letter response that matches "${correctAnswerLetter}" (case insensitive)\n5. EXTREMELY IMPORTANT: If the student just types the letter "${correctAnswerLetter}" by itself, it is DEFINITELY CORRECT!\n6. IF the student gives the CORRECT answer, respond with EXCITEMENT and PRAISE like "YES! That's right! Great job!"\n7. CRITICAL: When the student asks "what's the question" or similar phrases asking about the question, ONLY repeat the question text without giving ANY hints or clues about the answer. DO NOT mention the correct answer or option letter in your response.\n8. FOLLOW THIS 3-STEP TEACHING APPROACH FOR WRONG ANSWERS:
   - STEP 1: When the student asks "please explain the question" or "help me understand", provide concrete examples by showing how each option would sound in the actual sentence. Use this format: [HIGHLIGHT]This question is asking you to fill in the blank with the correct ${grammarType}. Try each word: '[question with option A]' - does that sound right? '[question with option B]' - how about that one? '[question with option C]' - what about this? '[question with option D]' - does this make sense?[/HIGHLIGHT] Then use this encouraging closing: "${randomEncouragement}" DO NOT reveal the correct answer.
   - STEP 2: After the student's FIRST WRONG ANSWER, do NOT give the correct answer. Instead, give a more specific hint and encourage them to try again. Say something like "Good try! Let's think about it differently..." and give a more specific hint.
   - STEP 3: Only after the student gives a SECOND WRONG ANSWER should you reveal the correct answer. When you do, ALWAYS explain WHY it's correct in simple terms a child would understand.\n9. Be super encouraging - use words like "You can do it!" and "Great thinking!"\n10. IMPORTANT: When the student asks for help or says "teach me", ALWAYS include a HIGHLIGHTED HINT in your response. Format it like this: [HIGHLIGHT]Your hint here[/HIGHLIGHT]. This will be displayed in a special highlighted box.\n11. PAY CLOSE ATTENTION to the question context! If the question contains words like "either/or", the answer is almost certainly "or". If it's about joining things together, it's likely "and".\n12. EXTREMELY IMPORTANT: NEVER give away the correct answer after just one wrong attempt from the student. Always give them a second chance with a better hint.`
      
      // Add this as the first system message
      systemMessages.push({
        role: "system",
        content: fullSystemPrompt
      });
      
      // Add a user message that forces the AI to acknowledge the context
      systemMessages.push({
        role: "user",
        content: "Please help me understand this question."
      });
      
      // Add example responses for correct, first wrong, and second wrong answers
      // Example 1: Correct answer by word
      systemMessages.push({
        role: "user",
        content: `The answer is ${correctAnswerText}`
      });
      
      systemMessages.push({
        role: "assistant",
        content: `YES! That's exactly right! "${correctAnswerText}" is the perfect answer. Great job! 🎉`
      });
      
      // Example 2: Correct answer by letter with 'the answer is'
      systemMessages.push({
        role: "user",
        content: `The answer is ${correctAnswerLetter}`
      });
      
      systemMessages.push({
        role: "assistant",
        content: `YES! That's exactly right! Option ${correctAnswerLetter} ("${correctAnswerText}") is the perfect answer. Great job! 🎉`
      });
      
      // Example 3: Correct answer by just the letter
      systemMessages.push({
        role: "user",
        content: `${correctAnswerLetter}`
      });
      
      systemMessages.push({
        role: "assistant",
        content: `YES! That's exactly right! Option ${correctAnswerLetter} ("${correctAnswerText}") is the perfect answer. Great job! 🎉`
      });
      
      // Example 4: Correct answer with letter and period
      systemMessages.push({
        role: "user",
        content: `${correctAnswerLetter}.`
      });
      
      systemMessages.push({
        role: "assistant",
        content: `YES! That's exactly right! Option ${correctAnswerLetter} ("${correctAnswerText}") is the perfect answer. Great job! 🎉`
      });
      
      // Example 5: Correct answer with "I think"
      systemMessages.push({
        role: "user",
        content: `I think ${correctAnswerLetter}`
      });
      
      systemMessages.push({
        role: "assistant",
        content: `YES! That's exactly right! Option ${correctAnswerLetter} ("${correctAnswerText}") is the perfect answer. Great job! 🎉`
      });
      
      // Example 6: Student asking for help with concrete examples
      systemMessages.push({
        role: "user",
        content: `Help me with this question please`
      });
      
      systemMessages.push({
        role: "assistant",
        content: `This question is asking you to fill in the blank with the correct ${grammarType}. [HIGHLIGHT]Try each word: '${currentQuestion.text.replace('_____', currentQuestion.options[0])}' - does that sound right? '${currentQuestion.text.replace('_____', currentQuestion.options[1])}' - how about that one? '${currentQuestion.text.replace('_____', currentQuestion.options[2])}' - what about this? '${currentQuestion.text.replace('_____', currentQuestion.options[3])}' - does this make sense?[/HIGHLIGHT] ${randomEncouragement}`
      });
      
      // Example 7: Student asking to be taught with concrete examples
      systemMessages.push({
        role: "user",
        content: `Please explain the question to me`
      });
      
      systemMessages.push({
        role: "assistant",
        content: `This question is asking you to fill in the blank with the correct ${grammarType}. [HIGHLIGHT]Try each word: '${currentQuestion.text.replace('_____', currentQuestion.options[0])}' - does that sound right? '${currentQuestion.text.replace('_____', currentQuestion.options[1])}' - how about that one? '${currentQuestion.text.replace('_____', currentQuestion.options[2])}' - what about this? '${currentQuestion.text.replace('_____', currentQuestion.options[3])}' - does this make sense?[/HIGHLIGHT] ${randomEncouragement}`
      });
      
      // Example 8: First wrong answer example - give a hint, not the answer
      systemMessages.push({
        role: "user",
        content: `I think the answer is [wrong answer]`
      });
      
      systemMessages.push({
        role: "assistant",
        content: `Good try! Let's think about it differently. [HIGHLIGHT]When we want to connect two things in a sentence, we need a special word.[/HIGHLIGHT] Look at each option carefully and try again - you can do it!`
      });
      
      // Example 9: Second wrong answer example - now give the answer
      systemMessages.push({
        role: "user",
        content: `Is it [another wrong answer]?`
      });
      
      systemMessages.push({
        role: "assistant",
        content: `The correct answer is "${correctAnswerText}" (option ${correctAnswerLetter}). When we like two things, we use "${correctAnswerText}" to connect them. Like "I like pizza ${correctAnswerText} ice cream." Now you know for next time! 😄`
      });
      
      // Example 10: Sequence showing first wrong answer followed by correct answer
      systemMessages.push({
        role: "user",
        content: `I think it's [wrong answer]`
      });
      
      systemMessages.push({
        role: "assistant",
        content: `Good try! Let's think about it differently. [HIGHLIGHT]This word is used when we want to join two things together.[/HIGHLIGHT] Try again - I know you can get it!`
      });
      
      systemMessages.push({
        role: "user",
        content: `${correctAnswerLetter}`
      });
      
      systemMessages.push({
        role: "assistant",
        content: `YES! That's exactly right! Option ${correctAnswerLetter} ("${correctAnswerText}") is the perfect answer. Great job figuring it out! 🎉`
      });
    }
    
    // If we have a question context but no user messages, add a default message
    if (currentQuestion && (!messages || messages.length === 0)) {
      convertedMessages.push({
        role: "user",
        content: "Please explain this question to me."
      });
    }
    
    // Log the final messages being sent to OpenAI
    console.log('Final messages to OpenAI:', JSON.stringify([
      ...systemMessages,
      ...convertedMessages
    ], null, 2))
    
    // Create streaming completion with retry logic
    const stream = await retryOpenAICall(
      () => openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [...systemMessages, ...convertedMessages],
        temperature: 0.3, // Lower temperature for more focused and consistent responses
        max_tokens: 1000, // Increased but well within the 16,384 limit
        presence_penalty: 0.1, // Slight penalty to prevent repetition
        frequency_penalty: 0.1, // Slight penalty to encourage diverse vocabulary
        stream: true, // Enable streaming for real-time responses
      }),
      'AI Tutor chat completion'
    )

    console.log('[AI-TUTOR STREAM] Started streaming response')

    // Create a readable stream to handle the OpenAI stream
    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || ''
            if (content) {
              console.log('[AI-TUTOR STREAM] Chunk:', content)
              controller.enqueue(encoder.encode(content))
            }
          }
          console.log('[AI-TUTOR STREAM] Completed streaming response')
        } catch (error) {
          console.error('[AI-TUTOR STREAM] Error:', error)
          controller.error(error)
        } finally {
          controller.close()
        }
      },
    })

    // Return streaming response
    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('AI Tutor API Error:', error)
    return NextResponse.json(
      { error: 'Failed to get AI response' },
      { status: 500 }
    )
  }
}

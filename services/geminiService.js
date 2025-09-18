const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiService {
  constructor() {
    // Initialize Gemini AI with API key from environment
    this.apiKey = process.env.GEMINI_API_KEY;
    
    if (!this.apiKey || this.apiKey === 'your_gemini_api_key_here') {
      console.warn('⚠️ Gemini API key not configured. AI features will be disabled.');
      this.genAI = null;
      this.model = null;
    } else {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
      console.log('✅ Gemini AI service initialized');
    }
  }

  async askForHelp({ problemDescription, studentCode, language, query }) {
    try {
      // Check if API is configured
      if (!this.model) {
        return 'AI service is currently unavailable. Please configure the Gemini API key to enable this feature.';
      }

      console.log('🤖 Asking Gemini AI for help...');

      const prompt = this.buildPrompt({
        problemDescription,
        studentCode,
        language,
        query
      });

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      console.log('✅ Gemini AI response received');
      return text;

    } catch (error) {
      console.error('❌ Gemini AI error:', error);
      
      // Provide fallback responses for common errors
      if (error.message?.includes('API_KEY_INVALID')) {
        return 'Sorry, the AI service is temporarily unavailable. Please check your API configuration.';
      }
      
      if (error.message?.includes('RATE_LIMIT_EXCEEDED')) {
        return 'Sorry, too many requests. Please wait a moment and try again.';
      }

      return 'I apologize, but I encountered an error while processing your question. Please try rephrasing your question or try again later.';
    }
  }

  buildPrompt({ problemDescription, studentCode, language, query }) {
    // Analyze the student's code to provide more contextual responses
    const hasCode = studentCode && studentCode.trim() && studentCode.trim() !== 'No code provided yet';
    const codeAnalysis = hasCode ? this.analyzeCode(studentCode, language) : '';
    
    return `You are an expert programming tutor helping a student with a specific coding problem. 

**IMPORTANT: Always analyze the specific problem and code context before responding. Avoid generic responses.**

**Problem Statement:**
${problemDescription}

**Student's Current Code (${language}):**
\`\`\`${language}
${studentCode || 'No code provided yet'}
\`\`\`

${codeAnalysis}

**Student's Specific Question:**
"${query}"

**Context-Aware Instructions:**
1. **Analyze the Problem**: First understand what the problem is asking for
2. **Review the Code**: Look at what the student has written so far
3. **Address the Question**: Directly answer their specific question with context
4. **Provide Targeted Help**: Give specific guidance based on their current progress
5. **Use Problem Details**: Reference specific parts of the problem statement when relevant

**Response Guidelines:**
- Start by acknowledging what you see in their code (if any)
- Address their specific question directly
- Reference the actual problem requirements when giving advice
- Point out any issues you notice in their current approach
- Suggest specific next steps based on their current progress
- Use examples from their problem domain when possible
- Avoid generic programming advice - be specific to their situation

**Current Session Context:**
- Programming Language: ${language}
- Problem Domain: ${this.identifyProblemDomain(problemDescription)}
- Code Status: ${hasCode ? 'Student has written some code' : 'Student has not started coding yet'}

Please provide a contextual, specific response that directly addresses their question:`;
  }

  analyzeCode(code, language) {
    if (!code || !code.trim()) return '';
    
    const lines = code.split('\n').length;
    const hasMainFunction = code.includes('main(') || code.includes('if __name__');
    const hasLoops = /for|while/.test(code);
    const hasConditionals = /if\s+/.test(code);
    const hasFunctions = /def\s+|function\s+|public\s+static/.test(code);
    
    return `**Code Analysis:**
- Lines of code: ${lines}
- Has main/entry point: ${hasMainFunction ? 'Yes' : 'No'}
- Uses loops: ${hasLoops ? 'Yes' : 'No'}
- Uses conditionals: ${hasConditionals ? 'Yes' : 'No'}
- Defines functions: ${hasFunctions ? 'Yes' : 'No'}
`;
  }

  identifyProblemDomain(description) {
    const domains = {
      'array': /array|list|element/i,
      'string': /string|char|text/i,
      'math': /number|sum|calculate|math/i,
      'algorithm': /sort|search|find|optimize/i,
      'data-structure': /tree|graph|stack|queue/i
    };
    
    for (const [domain, pattern] of Object.entries(domains)) {
      if (pattern.test(description)) {
        return domain;
      }
    }
    return 'general';
  }

  // Test the API connection
  async testConnection() {
    try {
      const result = await this.model.generateContent('Hello, can you help with coding problems?');
      const response = await result.response;
      console.log('✅ Gemini AI connection test successful');
      return true;
    } catch (error) {
      console.error('❌ Gemini AI connection test failed:', error.message);
      return false;
    }
  }
}

module.exports = new GeminiService();
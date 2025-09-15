const axios = require('axios');

class Judge0Service {
  constructor() {
    // Multiple Judge0 APIs for fallback
    this.apis = [
      {
        name: 'primary',
        baseURL: 'https://judge0-ce.p.rapidapi.com',
        rapidApiKey: 'cb0e821deemshc0bbadca6b835f5p1f1ee1jsnba13477ca64c',
        rapidApiHost: 'judge0-ce.p.rapidapi.com'
      },
      {
        name: 'alternative1', 
        baseURL: 'https://judge029.p.rapidapi.com',
        rapidApiKey: 'a79032b8ccmsh3209f00b557011cp1dd992jsn935b9ba638ce',
        rapidApiHost: 'judge029.p.rapidapi.com'
      },
      {
        name: 'alternative2',
        baseURL: 'https://judge0-ce.p.rapidapi.com',
        rapidApiKey: 'a79032b8ccmsh3209f00b557011cp1dd992jsn935b9ba638ce', 
        rapidApiHost: 'judge0-ce.p.rapidapi.com'
      },
      {
        name: 'alternative3',
        baseURL: 'https://judge0-ce.p.rapidapi.com',
        rapidApiKey: '1e568d9aa2msh9c69811eae21067p12040bjsn708b82331e8b',
        rapidApiHost: 'judge0-ce.p.rapidapi.com'
      }
    ];
    
    // (Removed OnlineCompiler.io) We'll use Piston (emkc.org) as a reliable public fallback
    
    // Track current API index
    this.currentApiIndex = 0;
    
    // Language ID mapping for Judge0
    this.languageIds = {
      'python': 71,      // Python 3.8.1
      'java': 62,        // Java (OpenJDK 13.0.1)
      'c': 50,           // C (GCC 9.2.0)
      'cpp': 54,         // C++ (GCC 9.2.0)
      'javascript': 63   // JavaScript (Node.js 12.14.0)
    };
  }

  // Get current API configuration
  getCurrentAPIConfig() {
    return this.apis[this.currentApiIndex];
  }

  // Switch to next available API
  switchToNextAPI() {
    this.currentApiIndex = (this.currentApiIndex + 1) % this.apis.length;
    const config = this.getCurrentAPIConfig();
    console.log(`🔄 Switching to ${config.name} API (${config.baseURL})`);
    return config;
  }

  // Try request with fallback to other APIs
  async tryWithFallback(requestFn, maxRetries = null) {
    const maxAttempts = maxRetries || this.apis.length;
    let lastError = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const config = this.getCurrentAPIConfig();
      
      try {
        console.log(`🔍 Attempt ${attempt + 1}/${maxAttempts} using ${config.name} API`);
        const result = await requestFn(config);
        
        // If we get a valid result, return it
        if (result && (result.data || result.stdout !== undefined || result.stderr !== undefined)) {
          return result;
        }
        
        // If result is undefined/invalid, try next API
        console.log(`⚠️ ${config.name} API returned invalid result, trying next API...`);
        this.switchToNextAPI();
        
      } catch (error) {
        console.log(`❌ ${config.name} API failed:`, error.response?.status || error.message);
        lastError = error;
        
        // If rate limited (429) or server error (5xx), try next API
        if (error.response?.status === 429 || (error.response?.status >= 500)) {
          console.log(`⚠️ ${config.name} API rate limited/error, trying next API...`);
          this.switchToNextAPI();
          continue;
        }
        
        // For other errors, still try next API
        this.switchToNextAPI();
      }
    }
    
    // All APIs failed
    console.error('💥 All Judge0 APIs failed');
    throw lastError || new Error('All Judge0 APIs are unavailable');
  }

  async getAbout() {
    return this.tryWithFallback(async (config) => {
      const response = await axios({
        method: 'GET',
        url: `${config.baseURL}/about`,
        headers: {
          'x-rapidapi-key': config.rapidApiKey,
          'x-rapidapi-host': config.rapidApiHost
        }
      });
      return response;
    });
  }

  async submitCode(sourceCode, languageId, input = '', expectedOutput = '') {
    try {
      // First try Judge0 APIs
      return await this.tryWithFallback(async (config) => {
        console.log(`🚀 Submitting code with ${config.name} Judge0 API`);
        
        const data = {
          source_code: sourceCode,
          language_id: languageId,
          stdin: input,
          expected_output: expectedOutput
        };

        const response = await axios({
          method: 'POST',
          url: `${config.baseURL}/submissions?base64_encoded=false&wait=true`,
          headers: {
            'x-rapidapi-key': config.rapidApiKey,
            'x-rapidapi-host': config.rapidApiHost,
            'Content-Type': 'application/json'
          },
          data: data
        });

        console.log(`✅ Code submitted successfully using ${config.name}`);
        return response.data;
      });
    } catch (error) {
      console.log('⚠️ All Judge0 APIs failed, trying Piston (emkc.org) fallback...');
      return await this.tryPiston(sourceCode, languageId, input);
    }
  }

  // Piston (emkc.org) fallback method
  async tryPiston(sourceCode, languageId, input = '') {
    try {
      // Map Judge0 language IDs to Piston language aliases
      const languageMap = {
        71: 'python',    // Python 3.10 available on Piston
        62: 'java',
        50: 'c',
        54: 'cpp',
        63: 'javascript'
      };

      const language = languageMap[languageId];
      if (!language) {
        console.log(`⚠️ Language ID ${languageId} not supported by Piston fallback`);
        throw new Error(`Language ID ${languageId} not supported by Piston`);
      }

      console.log(`🔄 Attempting Piston fallback for ${language}`);

      // Piston execute endpoint
      const url = 'https://emkc.org/api/v2/piston/execute';

      // Build payload using Piston's `files` format
      const payload = {
        language: language,
        version: '',
        files: [
          { name: 'main', content: sourceCode }
        ],
        stdin: input
      };

      const response = await axios({
        method: 'POST',
        url: url,
        headers: {
          'Content-Type': 'application/json'
        },
        data: payload,
        timeout: 20000
      });

      console.log('✅ Piston execution successful');

      // Normalize Piston response to Judge0-like structure
      return {
        stdout: response.data.run?.stdout || response.data.output || '',
        stderr: response.data.run?.stderr || response.data.stderr || '',
        status: {
          id: response.data.run?.code === 0 ? 3 : 6,
          description: response.data.run?.code === 0 ? 'Accepted' : 'Runtime Error'
        },
        time: response.data.run?.time || response.data.run?.stats?.duration || '0',
        memory: response.data.run?.memory || '0'
      };

    } catch (error) {
      console.error('💥 Piston fallback failed:', error.response?.status || error.message);
      return {
        stdout: '',
        stderr: `Piston service temporarily unavailable: ${error.message}`,
        status: {
          id: 11,
          description: 'Compiler Service Error'
        },
        time: '0',
        memory: '0'
      };
    }
  }

  async runTestCases(sourceCode, language, testCases) {
    try {
      console.log('🔍 Judge0Service.runTestCases called:', {
        language,
        testCasesCount: testCases?.length,
        codeLength: sourceCode?.length
      });

      const languageId = this.languageIds[language];
      if (!languageId) {
        console.log('❌ Unsupported language:', language);
        throw new Error(`Unsupported language: ${language}`);
      }

      console.log('✅ Language ID found:', { language, languageId });

      const results = [];
      let totalScore = 0;
      let passedTests = 0;

      for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        console.log(`🚀 Running test case ${i + 1}/${testCases.length}:`, {
          input: testCase.input?.substring(0, 50) + '...',
          expectedOutput: testCase.expectedOutput?.substring(0, 50) + '...'
        });

        try {
          const submission = await this.submitCode(
            sourceCode,
            languageId,
            testCase.input,
            testCase.expectedOutput
          );

          console.log(`📊 Test case ${i + 1} result:`, {
            statusId: submission.status?.id,
            statusDescription: submission.status?.description,
            stdout: submission.stdout?.substring(0, 100),
            stderr: submission.stderr?.substring(0, 100)
          });

          const passed = submission.status?.id === 3 && // Accepted
                        submission.stdout?.trim() === testCase.expectedOutput.trim();
          
          if (passed) {
            totalScore += testCase.points || 1;
            passedTests++;
          }

          results.push({
            testCaseNumber: i + 1,
            input: testCase.input,
            expectedOutput: testCase.expectedOutput,
            actualOutput: submission.stdout || '',
            stderr: submission.stderr || '',
            passed: passed,
            executionTime: submission.time,
            memory: submission.memory,
            status: submission.status,
            points: passed ? (testCase.points || 1) : 0
          });

        } catch (error) {
          console.error(`💥 Error in test case ${i + 1}:`, error);
          results.push({
            testCaseNumber: i + 1,
            input: testCase.input,
            expectedOutput: testCase.expectedOutput,
            actualOutput: '',
            stderr: error.message,
            passed: false,
            executionTime: null,
            memory: null,
            status: { id: -1, description: 'Execution Error' },
            points: 0
          });
        }

        // Add small delay between submissions to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const finalResult = {
        totalTestCases: testCases.length,
        passedTestCases: passedTests,
        totalScore: totalScore,
        maxScore: testCases.reduce((sum, tc) => sum + (tc.points || 1), 0),
        results: results,
        percentage: (passedTests / testCases.length) * 100
      };

      console.log('✅ Test cases completed:', {
        passed: passedTests,
        total: testCases.length,
        percentage: finalResult.percentage.toFixed(1) + '%'
      });

      return finalResult;

    } catch (error) {
      console.error('💥 Judge0Service.runTestCases error:', error);
      throw error;
    }
  }

  async getLanguages() {
    return this.tryWithFallback(async (config) => {
      const response = await axios({
        method: 'GET',
        url: `${config.baseURL}/languages`,
        headers: {
          'x-rapidapi-key': config.rapidApiKey,
          'x-rapidapi-host': config.rapidApiHost
        }
      });
      return response.data;
    });
  }

  getLanguageIdForBoard(board) {
    // Map education boards to programming languages
    const boardLanguageMap = {
      'CBSE': 'python',
      'cbse': 'python',
      'ICSE': 'java',
      'icse': 'java',
      'ISC': 'java',
      'isc': 'java',
      'State Board': 'c',
      'state': 'c',
      'Other': 'c',
      'other': 'c'
    };
    
    const language = boardLanguageMap[board] || 'python';
    return {
      language: language,
      languageId: this.languageIds[language]
    };
  }

  getLanguageId(language) {
    return this.languageIds[language];
  }

  getStarterCode(language, problemTitle) {
    const starters = {
      python: `# ${problemTitle}
# Write your solution here

def solve():
    # Your code here
    pass

# Main execution
if __name__ == "__main__":
    solve()
`,
      java: `// ${problemTitle}
// Write your solution here

public class Solution {
    public static void main(String[] args) {
        // Your code here
        
    }
}
`,
      c: `// ${problemTitle}
// Write your solution here

#include <stdio.h>
#include <stdlib.h>

int main() {
    // Your code here
    
    return 0;
}
`,
      cpp: `// ${problemTitle}
// Write your solution here

#include <iostream>
#include <vector>
using namespace std;

int main() {
    // Your code here
    
    return 0;
}
`,
      javascript: `// ${problemTitle}
// Write your solution here

function solve() {
    // Your code here
    
}

// Main execution
solve();
`
    };

    return starters[language] || starters.python;
  }
}

module.exports = new Judge0Service();

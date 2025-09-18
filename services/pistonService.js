const axios = require('axios');

class PistonService {
  constructor() {
    this.baseURL = 'https://emkc.org/api/v2/piston';
    
    // Language configurations with latest versions
    this.languages = {
      python: { name: 'python', version: '3.10.0' },
      java: { name: 'java', version: '15.0.2' },
      cpp: { name: 'cpp', version: '10.2.0' },
      c: { name: 'c', version: '10.2.0' },
      javascript: { name: 'javascript', version: '18.15.0' }
    };
    
    // File extensions for different languages
    this.extensions = {
      python: '.py',
      java: '.java',
      cpp: '.cpp',
      c: '.c'
    };
  }

  // Get available languages
  async getLanguages() {
    try {
      const response = await axios.get(`${this.baseURL}/runtimes`);
      return response.data;
    } catch (error) {
      console.error('Error fetching languages:', error.message);
      return Object.keys(this.languages).map(lang => ({
        language: lang,
        version: this.languages[lang].version,
        aliases: [lang]
      }));
    }
  }

  // Execute code with input
  async executeCode(language, code, input = '') {
    try {
      const langConfig = this.languages[language];
      if (!langConfig) {
        throw new Error(`Unsupported language: ${language}`);
      }

      console.log(`🚀 Executing ${language} code with Piston`);

      const payload = {
        language: langConfig.name,
        version: langConfig.version,
        files: [{
          name: `main${this.extensions[language]}`,
          content: code
        }],
        stdin: input,
        compile_timeout: 10000, // 10 seconds
        run_timeout: 5000,      // 5 seconds
        compile_memory_limit: 128000000, // 128MB
        run_memory_limit: 128000000      // 128MB
      };

      const response = await axios.post(`${this.baseURL}/execute`, payload, {
        timeout: 15000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const result = response.data;
      
      // Normalize response format
      return {
        stdout: result.run?.stdout || '',
        stderr: result.run?.stderr || result.compile?.stderr || '',
        exitCode: result.run?.code || 0,
        executionTime: parseFloat(result.run?.time || 0) * 1000, // Convert to milliseconds
        memory: parseInt(result.run?.memory || 0) / 1024, // Convert to KB
        compilationError: result.compile?.stderr || null,
        status: this.getStatusFromResult(result)
      };

    } catch (error) {
      console.error('Piston execution error:', error.message);
      return {
        stdout: '',
        stderr: `Execution service error: ${error.message}`,
        exitCode: -1,
        executionTime: 0,
        memory: 0,
        compilationError: null,
        status: 'Runtime Error'
      };
    }
  }

  // Run multiple test cases
  async runTestCases(language, code, testCases) {
    try {
      console.log(`🔍 Running ${testCases.length} test cases for ${language}`);
      
      const results = [];
      let totalScore = 0;
      let passedTests = 0;
      let totalExecutionTime = 0;
      let maxMemory = 0;

      for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        console.log(`📝 Test case ${i + 1}/${testCases.length}`);

        try {
          const execution = await this.executeCode(language, code, testCase.input);
          
          // Check if output matches expected
          const actualOutput = execution.stdout.trim();
          const expectedOutput = testCase.expectedOutput.trim();
          const passed = actualOutput === expectedOutput && execution.exitCode === 0;
          
          if (passed) {
            totalScore += testCase.points || 1;
            passedTests++;
          }

          totalExecutionTime += execution.executionTime;
          maxMemory = Math.max(maxMemory, execution.memory);

          results.push({
            testCaseNumber: i + 1,
            input: testCase.input,
            expectedOutput: testCase.expectedOutput,
            actualOutput: actualOutput,
            stderr: execution.stderr,
            passed: passed,
            executionTime: execution.executionTime,
            memory: execution.memory,
            status: execution.status,
            points: passed ? (testCase.points || 1) : 0
          });

          // Add delay to prevent rate limiting
          if (i < testCases.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }

        } catch (error) {
          console.error(`Error in test case ${i + 1}:`, error.message);
          results.push({
            testCaseNumber: i + 1,
            input: testCase.input,
            expectedOutput: testCase.expectedOutput,
            actualOutput: '',
            stderr: error.message,
            passed: false,
            executionTime: 0,
            memory: 0,
            status: 'Runtime Error',
            points: 0
          });
        }
      }

      const maxScore = testCases.reduce((sum, tc) => sum + (tc.points || 1), 0);
      const finalResult = {
        totalTestCases: testCases.length,
        passedTestCases: passedTests,
        failedTestCases: testCases.length - passedTests,
        totalScore: totalScore,
        maxScore: maxScore,
        percentage: maxScore > 0 ? (totalScore / maxScore) * 100 : 0,
        avgExecutionTime: totalExecutionTime / testCases.length,
        maxMemoryUsed: maxMemory,
        results: results,
        status: this.getFinalStatus(results)
      };

      console.log(`✅ Test execution completed: ${passedTests}/${testCases.length} passed`);
      return finalResult;

    } catch (error) {
      console.error('Error running test cases:', error.message);
      throw error;
    }
  }

  // Get status from execution result
  getStatusFromResult(result) {
    if (result.compile && result.compile.stderr) {
      return 'Compilation Error';
    }
    
    if (result.run) {
      if (result.run.code === 0) {
        return 'Success';
      } else if (result.run.code === 124) {
        return 'Time Limit Exceeded';
      } else {
        return 'Runtime Error';
      }
    }
    
    return 'Unknown Error';
  }

  // Get final status from all test results
  getFinalStatus(results) {
    const hasCompilationError = results.some(r => r.status === 'Compilation Error');
    if (hasCompilationError) return 'Compilation Error';
    
    const hasRuntimeError = results.some(r => r.status === 'Runtime Error');
    if (hasRuntimeError) return 'Runtime Error';
    
    const hasTLE = results.some(r => r.status === 'Time Limit Exceeded');
    if (hasTLE) return 'Time Limit Exceeded';
    
    const allPassed = results.every(r => r.passed);
    if (allPassed) return 'Accepted';
    
    return 'Wrong Answer';
  }

  // Get starter code for different languages
  getStarterCode(language, problemTitle = 'Solution') {
  const templates = {
    python: `# ${problemTitle}
from typing import *

"""
Read input from STDIN and print output to STDOUT.
Replace the example parse/format with the problem's actual I/O format.
"""

def solution(*args, **kwargs):
  """
  Implement your solution.
  Return the required output(s). Adjust signature as needed.
  """
  # TODO: implement logic
  return None

def parse_input() -> Any:
  # Example input parsing (single line):
  # line = input().strip()
  # parts = line.split()
  # return parts
  # Multi-line example:
  # n = int(input().strip())
  # arr = list(map(int, input().split()))
  # return n, arr
  try:
    data = input().strip()
    return data
  except EOFError:
    return None

def format_output(result: Any) -> str:
  # Convert the result to the exact required output format
  return str(result)

def main():
  parsed = parse_input()
  result = solution(parsed)
  print(format_output(result))

if __name__ == "__main__":
  main()`,

    java: `// ${problemTitle}
import java.io.*;
import java.util.*;

public class Solution {
  /**
   * Implement your core logic here and return output.
   * Adjust parameters/return type based on the problem.
   */
  static String solve(String input) {
    // TODO: parse input and compute the answer
    // Example: return input;
    return input;
  }

  static String readInput() throws IOException {
    StringBuilder sb = new StringBuilder();
    BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
    String line;
    while ((line = br.readLine()) != null) {
      if (sb.length() > 0) sb.append('\n');
      sb.append(line);
    }
    return sb.toString();
  }

  public static void main(String[] args) throws Exception {
    String input = readInput();
    String output = solve(input);
    System.out.print(output);
  }
}`,

    cpp: `// ${problemTitle}
#include <bits/stdc++.h>
using namespace std;

// Implement your solution. Adjust signatures as needed.
string solve(const string &input) {
  // TODO: parse input and compute result
  // Example: return input;
  return input;
}

int main() {
  ios::sync_with_stdio(false);
  cin.tie(nullptr);

  // Read all stdin into a string
  stringstream buffer;
  buffer << cin.rdbuf();
  string input = buffer.str();

  string output = solve(input);
  cout << output;
  return 0;
}`,

    c: `// ${problemTitle}
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// Implement your solution. Adjust signatures as needed.
char* solve(const char* input) {
  // TODO: parse input C-style and compute the result
  // Example: echo input
  char *out = (char*)malloc(strlen(input) + 1);
  strcpy(out, input);
  return out;
}

int main() {
  // Read all stdin into a buffer
  size_t size = 0, cap = 1024;
  char *buf = (char*)malloc(cap);
  int c;
  if (!buf) return 1;
  while ((c = fgetc(stdin)) != EOF) {
    if (size + 1 >= cap) {
      cap *= 2;
      char *tmp = (char*)realloc(buf, cap);
      if (!tmp) { free(buf); return 1; }
      buf = tmp;
    }
    buf[size++] = (char)c;
  }
  buf[size] = '\0';

  char* output = solve(buf);
  if (output) {
    fputs(output, stdout);
    free(output);
  }
  free(buf);
  return 0;
}`
  };

    return templates[language] || templates.python;
  }

  // Check service health
  async checkHealth() {
    try {
      const response = await axios.get(`${this.baseURL}/runtimes`, { timeout: 5000 });
      return {
        status: 'healthy',
        availableLanguages: response.data.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = new PistonService();
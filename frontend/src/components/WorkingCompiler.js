import React, { useState } from 'react';
import './WorkingCompiler.css';

const WorkingCompiler = () => {
  const [code, setCode] = useState(`// Welcome to AucTutor's Interactive Compiler
// Try editing this code and click "Run" to see it in action!

console.log("Hello, AucTutor!");

// Example: Calculate factorial
function factorial(n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}

console.log("Factorial of 5:", factorial(5));

// Your code here...
`);
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [language, setLanguage] = useState('javascript');

  const languages = [
    { id: 'javascript', name: 'JavaScript', version: '18.15.0' },
    { id: 'python', name: 'Python', version: '3.10.0' },
    { id: 'java', name: 'Java', version: '15.0.2' },
    { id: 'cpp', name: 'C++', version: '10.2.0' }
  ];

  const codeExamples = {
    javascript: `// Welcome to AucTutor's Interactive Compiler
console.log("Hello, AucTutor!");

function factorial(n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}

console.log("Factorial of 5:", factorial(5));`,
    python: `# Welcome to AucTutor's Interactive Compiler
print("Hello, AucTutor!")

def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)

print("Factorial of 5:", factorial(5))`,
    java: `// Welcome to AucTutor's Interactive Compiler
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, AucTutor!");
        System.out.println("Factorial of 5: " + factorial(5));
    }
    
    public static int factorial(int n) {
        if (n <= 1) return 1;
        return n * factorial(n - 1);
    }
}`,
    cpp: `// Welcome to AucTutor's Interactive Compiler
#include <iostream>
using namespace std;

int factorial(int n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}

int main() {
    cout << "Hello, AucTutor!" << endl;
    cout << "Factorial of 5: " << factorial(5) << endl;
    return 0;
}`
  };

  const runCode = async () => {
    setIsRunning(true);
    setOutput('Running...');

    try {
      const response = await fetch('https://emkc.org/api/v2/piston/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          language: language,
          version: languages.find(lang => lang.id === language)?.version || 'latest',
          files: [{
            name: language === 'python' ? 'main.py' : 
                  language === 'java' ? 'Main.java' :
                  language === 'cpp' ? 'main.cpp' : 'main.js',
            content: code
          }]
        })
      });

      const result = await response.json();
      
      if (result.run) {
        const output = result.run.stdout || result.run.stderr || 'No output';
        setOutput(output);
      } else {
        setOutput('Error: Could not execute code');
      }
    } catch (error) {
      console.error('Execution error:', error);
      setOutput(`Error: ${error.message || 'Failed to execute code'}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleLanguageChange = (newLanguage) => {
    setLanguage(newLanguage);
    setCode(codeExamples[newLanguage] || '// Code here...');
    setOutput('');
  };

  return (
    <div className="working-compiler">
      <div className="compiler-header">
        <h3>🚀 Try Our Interactive Compiler</h3>
        <p>Write code, run it instantly, and see results in real-time!</p>
      </div>
      
      <div className="compiler-controls">
        <div className="language-selector">
          <label>Language:</label>
          <select 
            value={language} 
            onChange={(e) => handleLanguageChange(e.target.value)}
            className="language-dropdown"
          >
            {languages.map(lang => (
              <option key={lang.id} value={lang.id}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>
        
        <button 
          onClick={runCode} 
          disabled={isRunning}
          className="run-button"
        >
          {isRunning ? '⏳ Running...' : '▶️ Run Code'}
        </button>
      </div>

      <div className="compiler-workspace">
        <div className="code-editor">
          <div className="editor-header">
            <span>📝 Code Editor</span>
            <div className="editor-tabs">
              <span className="tab active">
                {language === 'python' ? 'main.py' : 
                 language === 'java' ? 'Main.java' :
                 language === 'cpp' ? 'main.cpp' : 'main.js'}
              </span>
            </div>
          </div>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="code-textarea"
            placeholder="Write your code here..."
            spellCheck={false}
          />
        </div>

        <div className="output-panel">
          <div className="output-header">
            <span>📟 Output</span>
            <div className="output-controls">
              <button 
                onClick={() => setOutput('')}
                className="clear-button"
                title="Clear output"
              >
                🗑️
              </button>
            </div>
          </div>
          <pre className="output-content">
            {output || 'Click "Run Code" to see output here...'}
          </pre>
        </div>
      </div>

      <div className="compiler-features">
        <div className="feature-item">
          <span className="feature-icon">⚡</span>
          <span>Real-time Execution</span>
        </div>
        <div className="feature-item">
          <span className="feature-icon">🌐</span>
          <span>Multiple Languages</span>
        </div>
        <div className="feature-item">
          <span className="feature-icon">🔒</span>
          <span>Secure Sandbox</span>
        </div>
        <div className="feature-item">
          <span className="feature-icon">📊</span>
          <span>Detailed Results</span>
        </div>
      </div>
    </div>
  );
};

export default WorkingCompiler;
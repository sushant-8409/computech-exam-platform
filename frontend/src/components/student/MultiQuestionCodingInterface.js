import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import axios from 'axios';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import TestMonitoringSystem from '../../utils/TestMonitoringSystem';
import './LeetCodeInterface.css';

const MultiQuestionCodingInterface = () => {
  const { testId } = useParams();
  const navigate = useNavigate();
  
  // Test state
  const [test, setTest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  
  // Questions state
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [questionCodes, setQuestionCodes] = useState({});
  const [questionResults, setQuestionResults] = useState({});
  const [testingQuestion, setTestingQuestion] = useState(null);
  const [consoleOutput, setConsoleOutput] = useState('');
  const [showConsole, setShowConsole] = useState(false);
  const [runningExampleCase, setRunningExampleCase] = useState(false);

  // localStorage key for saving codes
  const getStorageKey = () => `coding-test-${testId}-codes`;
  
  // Proctoring state
  const [proctoringInitialized, setProctoringInitialized] = useState(false);
  const [showViolationModal, setShowViolationModal] = useState(false);
  const [violationMessage, setViolationMessage] = useState('');
  const [lastViolationTime, setLastViolationTime] = useState(0);
  const [shownViolations, setShownViolations] = useState(new Set());
  
  // Monitoring state for display purposes
  const [totalViolations, setTotalViolations] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFullscreenWarning, setShowFullscreenWarning] = useState(false);
  
  // Camera permission state
  const [cameraPermissionGranted, setCameraPermissionGranted] = useState(false);
  const [cameraPermissionRequested, setCameraPermissionRequested] = useState(false);
  const [monitoringError, setMonitoringError] = useState(null);
  const [testAllowedToStart, setTestAllowedToStart] = useState(false);
  
  // Resume functionality state
  const [isResumeSession, setIsResumeSession] = useState(false);
  const [existingResult, setExistingResult] = useState(null);
  
  // Refs for monitoring
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  
  // Example test case popup states
  const [showExampleModal, setShowExampleModal] = useState(false);
  const [exampleResult, setExampleResult] = useState(null);

  // Mobile layout states
  const [showProblemModal, setShowProblemModal] = useState(false);
  const [showExamplesModal, setShowExamplesModal] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Refs
  const timerRef = useRef(null);
  const testStartTimeRef = useRef(null);
  const editorRef = useRef(null);

  // Language detection based on board
  const getLanguageForBoard = (board) => {
    const mapping = {
      CBSE: 'python',
      ICSE: 'java',
      ISC: 'java',
      WBCHSE: 'cpp',
      Other: 'cpp'
    };
    return mapping[board] || 'python';
  };

  // Check for resume session
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    setIsResumeSession(urlParams.get('resume') === 'true');
  }, []);

  // Check camera permissions before allowing test to start
  const requestCameraPermission = useCallback(async () => {
    if (test?.cameraMonitoring?.enabled && !cameraPermissionGranted && !cameraPermissionRequested) {
      setCameraPermissionRequested(true);
      
      try {
        console.log('📹 Requesting camera permission...');
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'user' },
          audio: false 
        });
        
        console.log('📹 Camera permission granted');
        setCameraPermissionGranted(true);
        setMonitoringError(null);
        
        // Stop test stream immediately, real stream will be started by monitoring system
        stream.getTracks().forEach(track => track.stop());
        
        toast.success('✅ Camera access granted');
        return true;
        
      } catch (error) {
        console.error('❌ Camera permission denied:', error);
        setMonitoringError('Camera access is required for this test. Please allow camera permissions and try again.');
        setCameraPermissionGranted(false);
        
        toast.error('⚠️ Camera access required! Please allow camera permissions.');
        return false;
      }
    }
    return true; // No camera required or already granted
  }, [test, cameraPermissionGranted, cameraPermissionRequested]);

  // Initialize camera permission and monitoring readiness check
  useEffect(() => {
    const checkTestReadiness = async () => {
      if (!test) return;
      
      let canStart = true;
      
      // Check camera permissions first if required
      if (test.cameraMonitoring?.enabled) {
        const cameraGranted = await requestCameraPermission();
        if (!cameraGranted) {
          canStart = false;
        }
      }
      
      setTestAllowedToStart(canStart);
      
      if (!canStart) {
        toast.warning('⚠️ Please grant required permissions to start the test');
      }
    };

    if (test && !testAllowedToStart) {
      checkTestReadiness();
    }
  }, [test, requestCameraPermission, testAllowedToStart]);

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Handle editor mount
  const handleEditorDidMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    
    // Add keyboard shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Quote, () => {
      // Use function in closure to avoid dependency
      if (window.runExampleTestCase) {
        window.runExampleTestCase();
      }
    });
    
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      // Use function in closure to avoid dependency
      if (window.handleSubmitTest) {
        window.handleSubmitTest();
      }
    });

    // Override default indentation behavior
    editor.addCommand(monaco.KeyCode.Enter, () => {
      const selection = editor.getSelection();
      const model = editor.getModel();
      const lineContent = model.getLineContent(selection.startLineNumber);
      
      // Get indentation of current line
      const indentMatch = lineContent.match(/^(\s*)/);
      const currentIndent = indentMatch ? indentMatch[1] : '';
      
      // Check if we need extra indentation (after :, {, etc.)
      const needsExtraIndent = /[:{\]]\s*$/.test(lineContent.trim());
      const extraIndent = needsExtraIndent ? '    ' : '';
      
      editor.executeEdits('enter-with-indent', [{
        range: selection,
        text: '\n' + currentIndent + extraIndent
      }]);
      
      // Move cursor to end of new line
      const newPosition = {
        lineNumber: selection.startLineNumber + 1,
        column: currentIndent.length + extraIndent.length + 1
      };
      editor.setPosition(newPosition);
    });

    // Add enhanced auto-completion for Python and Java
    const currentLang = getLanguageForBoard(test?.board);
    
    if (currentLang === 'python') {
      // Enhanced Python-specific completions with algorithm patterns
      monaco.languages.registerCompletionItemProvider('python', {
        provideCompletionItems: (model, position) => {
          const suggestions = [
            // Basic patterns
            {
              label: 'for_range',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: 'for ${1:i} in range(${2:n}):\n    ${3:pass}',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: 'For loop with range'
            },
            {
              label: 'if_main',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: 'if __name__ == "__main__":\n    ${1:pass}',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: 'Main guard'
            },
            {
              label: 'list_comp',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: '[${1:expr} for ${2:item} in ${3:iterable}]',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: 'List comprehension'
            },
            {
              label: 'try_except',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: 'try:\n    ${1:pass}\nexcept ${2:Exception} as ${3:e}:\n    ${4:pass}',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: 'Try-except block'
            },
            // Algorithm-specific patterns
            {
              label: 'binary_search',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: 'def binary_search(${1:arr}, ${2:target}):\n    left, right = 0, len(${1:arr}) - 1\n    while left <= right:\n        mid = (left + right) // 2\n        if ${1:arr}[mid] == ${2:target}:\n            return mid\n        elif ${1:arr}[mid] < ${2:target}:\n            left = mid + 1\n        else:\n            right = mid - 1\n    return -1',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: 'Binary search implementation'
            },
            {
              label: 'two_pointers',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: 'left, right = 0, len(${1:arr}) - 1\nwhile left < right:\n    if ${1:arr}[left] + ${1:arr}[right] == ${2:target}:\n        return [left, right]\n    elif ${1:arr}[left] + ${1:arr}[right] < ${2:target}:\n        left += 1\n    else:\n        right -= 1',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: 'Two pointers technique'
            },
            {
              label: 'sliding_window',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: 'left = 0\nfor right in range(len(${1:arr})):\n    # Add ${1:arr}[right] to window\n    ${2:# Update window state}\n    \n    while ${3:# Window is invalid}:\n        # Remove ${1:arr}[left] from window\n        ${4:# Update window state}\n        left += 1\n    \n    # Process valid window\n    ${5:pass}',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: 'Sliding window pattern'
            },
            {
              label: 'dfs_recursive',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: 'def dfs(${1:node}, ${2:visited}):\n    if ${1:node} in ${2:visited}:\n        return\n    \n    ${2:visited}.add(${1:node})\n    ${3:# Process node}\n    \n    for ${4:neighbor} in ${5:graph}[${1:node}]:\n        dfs(${4:neighbor}, ${2:visited})',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: 'Depth-first search recursive'
            },
            {
              label: 'bfs_queue',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: 'from collections import deque\n\ndef bfs(${1:start}):\n    queue = deque([${1:start}])\n    visited = {${1:start}}\n    \n    while queue:\n        ${2:node} = queue.popleft()\n        ${3:# Process node}\n        \n        for ${4:neighbor} in ${5:graph}[${2:node}]:\n            if ${4:neighbor} not in visited:\n                visited.add(${4:neighbor})\n                queue.append(${4:neighbor})',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: 'Breadth-first search with queue'
            },
            {
              label: 'dp_memoization',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: 'from functools import lru_cache\n\n@lru_cache(maxsize=None)\ndef ${1:dp_function}(${2:params}):\n    # Base case\n    if ${3:base_condition}:\n        return ${4:base_value}\n    \n    # Recursive case with memoization\n    return ${5:# recursive_call}',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: 'Dynamic programming with memoization'
            },
            {
              label: 'quicksort',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: 'def quicksort(${1:arr}, ${2:low}, ${3:high}):\n    if ${2:low} < ${3:high}:\n        pi = partition(${1:arr}, ${2:low}, ${3:high})\n        quicksort(${1:arr}, ${2:low}, pi - 1)\n        quicksort(${1:arr}, pi + 1, ${3:high})\n\ndef partition(${1:arr}, ${2:low}, ${3:high}):\n    pivot = ${1:arr}[${3:high}]\n    i = ${2:low} - 1\n    for j in range(${2:low}, ${3:high}):\n        if ${1:arr}[j] <= pivot:\n            i += 1\n            ${1:arr}[i], ${1:arr}[j] = ${1:arr}[j], ${1:arr}[i]\n    ${1:arr}[i + 1], ${1:arr}[${3:high}] = ${1:arr}[${3:high}], ${1:arr}[i + 1]\n    return i + 1',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: 'Quick sort implementation'
            }
          ];
          return { suggestions };
        }
      });
    } else if (currentLang === 'java') {
      // Enhanced Java-specific completions with algorithm patterns
      monaco.languages.registerCompletionItemProvider('java', {
        provideCompletionItems: (model, position) => {
          const suggestions = [
            // Basic patterns
            {
              label: 'main_method',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: 'public static void main(String[] args) {\n    ${1:// Your code here}\n}',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: 'Main method'
            },
            {
              label: 'for_loop',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n    ${3:// Your code here}\n}',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: 'For loop'
            },
            {
              label: 'scanner_input',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: 'Scanner ${1:sc} = new Scanner(System.in);\n${2:int} ${3:input} = ${1:sc}.next${4:Int}();',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: 'Scanner input'
            },
            {
              label: 'arraylist',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: 'ArrayList<${1:Integer}> ${2:list} = new ArrayList<>();',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: 'ArrayList declaration'
            },
            // Algorithm-specific patterns
            {
              label: 'binary_search',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: 'public static int binarySearch(int[] ${1:arr}, int ${2:target}) {\n    int left = 0, right = ${1:arr}.length - 1;\n    while (left <= right) {\n        int mid = left + (right - left) / 2;\n        if (${1:arr}[mid] == ${2:target}) {\n            return mid;\n        } else if (${1:arr}[mid] < ${2:target}) {\n            left = mid + 1;\n        } else {\n            right = mid - 1;\n        }\n    }\n    return -1;\n}',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: 'Binary search implementation'
            },
            {
              label: 'two_pointers',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: 'int left = 0, right = ${1:arr}.length - 1;\nwhile (left < right) {\n    int sum = ${1:arr}[left] + ${1:arr}[right];\n    if (sum == ${2:target}) {\n        return new int[]{left, right};\n    } else if (sum < ${2:target}) {\n        left++;\n    } else {\n        right--;\n    }\n}',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: 'Two pointers technique'
            },
            {
              label: 'sliding_window',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: 'int left = 0;\nfor (int right = 0; right < ${1:arr}.length; right++) {\n    // Add ${1:arr}[right] to window\n    ${2:// Update window state}\n    \n    while (${3:/* Window is invalid */}) {\n        // Remove ${1:arr}[left] from window\n        ${4:// Update window state}\n        left++;\n    }\n    \n    // Process valid window\n    ${5:// Your code here}\n}',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: 'Sliding window pattern'
            },
            {
              label: 'dfs_recursive',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: 'public void dfs(${1:int} ${2:node}, boolean[] ${3:visited}, List<List<Integer>> ${4:graph}) {\n    if (${3:visited}[${2:node}]) return;\n    \n    ${3:visited}[${2:node}] = true;\n    // Process node\n    ${5:// Your code here}\n    \n    for (int ${6:neighbor} : ${4:graph}.get(${2:node})) {\n        dfs(${6:neighbor}, ${3:visited}, ${4:graph});\n    }\n}',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: 'Depth-first search recursive'
            },
            {
              label: 'bfs_queue',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: 'Queue<Integer> queue = new LinkedList<>();\nboolean[] visited = new boolean[${1:n}];\nqueue.offer(${2:start});\nvisited[${2:start}] = true;\n\nwhile (!queue.isEmpty()) {\n    int ${3:node} = queue.poll();\n    // Process node\n    ${4:// Your code here}\n    \n    for (int ${5:neighbor} : ${6:graph}.get(${3:node})) {\n        if (!visited[${5:neighbor}]) {\n            visited[${5:neighbor}] = true;\n            queue.offer(${5:neighbor});\n        }\n    }\n}',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: 'Breadth-first search with queue'
            },
            {
              label: 'dp_memoization',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: 'Map<String, Integer> memo = new HashMap<>();\n\npublic int ${1:dpFunction}(${2:int param}) {\n    String key = String.valueOf(${2:param});\n    if (memo.containsKey(key)) {\n        return memo.get(key);\n    }\n    \n    // Base case\n    if (${3:/* base condition */}) {\n        return ${4:/* base value */};\n    }\n    \n    // Recursive case with memoization\n    int result = ${5:/* recursive call */};\n    memo.put(key, result);\n    return result;\n}',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: 'Dynamic programming with memoization'
            },
            {
              label: 'quicksort',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: 'public void quickSort(int[] ${1:arr}, int ${2:low}, int ${3:high}) {\n    if (${2:low} < ${3:high}) {\n        int pi = partition(${1:arr}, ${2:low}, ${3:high});\n        quickSort(${1:arr}, ${2:low}, pi - 1);\n        quickSort(${1:arr}, pi + 1, ${3:high});\n    }\n}\n\npublic int partition(int[] ${1:arr}, int ${2:low}, int ${3:high}) {\n    int pivot = ${1:arr}[${3:high}];\n    int i = ${2:low} - 1;\n    \n    for (int j = ${2:low}; j < ${3:high}; j++) {\n        if (${1:arr}[j] <= pivot) {\n            i++;\n            int temp = ${1:arr}[i];\n            ${1:arr}[i] = ${1:arr}[j];\n            ${1:arr}[j] = temp;\n        }\n    }\n    \n    int temp = ${1:arr}[i + 1];\n    ${1:arr}[i + 1] = ${1:arr}[${3:high}];\n    ${1:arr}[${3:high}] = temp;\n    return i + 1;\n}',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: 'Quick sort implementation'
            },
            {
              label: 'hashmap',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: 'Map<${1:String}, ${2:Integer}> ${3:map} = new HashMap<>();',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: 'HashMap declaration'
            },
            {
              label: 'priority_queue',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: 'PriorityQueue<${1:Integer}> ${2:pq} = new PriorityQueue<>();',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: 'PriorityQueue declaration'
            }
          ];
          return { suggestions };
        }
      });
    }

    // Add intelligent context-aware suggestions based on problem keywords
    const addContextAwareSuggestions = () => {
      const problemDescription = currentQuestion?.description?.toLowerCase() || '';
      const problemTitle = currentQuestion?.title?.toLowerCase() || '';
      const fullContext = (problemDescription + ' ' + problemTitle).toLowerCase();

      // Detect algorithm types based on keywords
      const contextSuggestions = [];
      
      if (fullContext.includes('sort') || fullContext.includes('sorted')) {
        if (currentLang === 'python') {
          contextSuggestions.push({
            label: 'sort_array',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '${1:arr}.sort()  # In-place sort\n# OR\nsorted_arr = sorted(${1:arr})  # Returns new sorted array',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Array sorting methods'
          });
        } else if (currentLang === 'java') {
          contextSuggestions.push({
            label: 'sort_array',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'Arrays.sort(${1:arr});  // In-place sort\n// OR\nList<Integer> list = Arrays.asList(${1:arr});\nCollections.sort(list);',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Array sorting methods'
          });
        }
      }

      if (fullContext.includes('tree') || fullContext.includes('binary tree')) {
        if (currentLang === 'python') {
          contextSuggestions.push({
            label: 'tree_node',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'class TreeNode:\n    def __init__(self, val=0, left=None, right=None):\n        self.val = val\n        self.left = left\n        self.right = right',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Binary tree node definition'
          });
        } else if (currentLang === 'java') {
          contextSuggestions.push({
            label: 'tree_node',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'class TreeNode {\n    int val;\n    TreeNode left;\n    TreeNode right;\n    TreeNode() {}\n    TreeNode(int val) { this.val = val; }\n    TreeNode(int val, TreeNode left, TreeNode right) {\n        this.val = val;\n        this.left = left;\n        this.right = right;\n    }\n}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Binary tree node definition'
          });
        }
      }

      if (fullContext.includes('graph') || fullContext.includes('path') || fullContext.includes('connected')) {
        if (currentLang === 'python') {
          contextSuggestions.push({
            label: 'graph_adjacency',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '# Adjacency list representation\ngraph = {}\nfor i in range(${1:n}):\n    graph[i] = []\n\n# Add edge\ngraph[${2:u}].append(${3:v})\ngraph[${3:v}].append(${2:u})  # For undirected graph',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Graph adjacency list setup'
          });
        }
      }

      return contextSuggestions;
    };

    // Register context-aware suggestions
    if (currentQuestion && (currentLang === 'python' || currentLang === 'java')) {
      const contextSuggestions = addContextAwareSuggestions();
      if (contextSuggestions.length > 0) {
        monaco.languages.registerCompletionItemProvider(currentLang, {
          provideCompletionItems: (model, position) => {
            return { suggestions: contextSuggestions };
          }
        });
      }
    }
  }, [test]);

  // Run example test case (Ctrl+')
  const runExampleTestCase = useCallback(async () => {
    if (!test || !test.coding || !test.coding.questions || !test.coding.questions[currentQuestionIndex]) {
      toast.error('Test data not loaded properly');
      return;
    }

    const currentQuestion = test.coding.questions[currentQuestionIndex];
    const currentCode = questionCodes[currentQuestion.id] || '';
    
    if (!currentCode.trim()) {
      toast.warning('Please write some code first');
      return;
    }

    // Get first example case
    const exampleCase = currentQuestion.examples?.[0];
    if (!exampleCase) {
      toast.warning('No example test case available');
      return;
    }

    setRunningExampleCase(true);
    setConsoleOutput('Running example test case...\n');
    setShowConsole(true);

    try {
      const language = getLanguageForBoard(test.board);
      console.log('🔍 Running example test case with:', {
        endpoint: '/api/student/run-code',
        language,
        input: exampleCase.input,
        codeLength: currentCode.length
      });
      
      const response = await axios.post('/api/student/run-code', {
        code: currentCode,
        language,
        input: exampleCase.input
      });

      console.log('🎯 Example test response:', response.data);

      const output = response.data.output || '';
      const error = response.data.error || '';
      
      let consoleText = `Input:\n${exampleCase.input}\n\n`;
      consoleText += `Expected Output:\n${exampleCase.output}\n\n`;
      consoleText += `Your Output:\n${output}\n\n`;
      
      if (error) {
        consoleText += `Error:\n${error}\n`;
      }
      
      const isCorrect = output.trim() === exampleCase.output.trim();
      consoleText += `Result: ${isCorrect ? '✅ PASSED' : '❌ FAILED'}\n`;
      
      setConsoleOutput(consoleText);
      
      // Set example result for popup (simplified for LeetCode-style)
      setExampleResult({
        input: exampleCase.input,
        expected: exampleCase.output,
        actual: output,
        error: error,
        passed: isCorrect,
        testCase: exampleCase,
        totalTestCases: 1,
        passedTestCases: isCorrect ? 1 : 0
      });
      
      // Show popup instead of just console
      setShowExampleModal(true);
      
      toast.success(`Example test case ${isCorrect ? 'passed' : 'failed'}`);
      
    } catch (error) {
      console.error('💥 Error running example:', error);
      setConsoleOutput('Error running code:\n' + (error.response?.data?.message || error.message));
      toast.error('Failed to run example');
    } finally {
      setRunningExampleCase(false);
    }
  }, [test, currentQuestionIndex, questionCodes]);

  // Reset code to starter code
  const resetCode = useCallback(() => {
    const currentQuestion = test?.coding?.questions?.[currentQuestionIndex];
    if (!currentQuestion) return;

    const confirmReset = window.confirm(
      'Are you sure you want to reset your code? This will restore the starter code and all your changes will be lost.'
    );
    
    if (!confirmReset) return;

    const language = getLanguageForBoard(test?.board);
    const starterCode = currentQuestion.starterCode?.[language] || '';
    
    const newCodes = {
      ...questionCodes,
      [currentQuestion.id]: starterCode
    };
    
    setQuestionCodes(newCodes);
    
    // Update localStorage
    try {
      localStorage.setItem(getStorageKey(), JSON.stringify(newCodes));
    } catch (error) {
      console.warn('Failed to update saved code in localStorage:', error);
    }
    
    // Clear console output
    setShowConsole(false);
    setConsoleOutput('');
    
    toast.success('Code reset to starter template');
  }, [test, currentQuestionIndex, questionCodes]);

  // Submit entire test (Ctrl+Enter)
  const handleSubmit = useCallback(async () => {
    if (submitted) return;

    const confirmSubmit = window.confirm(
      'Are you sure you want to submit your test? This action cannot be undone.'
    );
    
    if (!confirmSubmit) return;

    setSubmitting(true);
    
    try {
      const language = getLanguageForBoard(test?.board);
      
      // Get monitoring data from the enhanced monitoring system
      let monitoringData = {};
      try {
        monitoringData = await TestMonitoringSystem.getMonitoringStats();
      } catch (error) {
        console.warn('Failed to get monitoring stats:', error);
        monitoringData = {
          violations: [],
          totalViolations: 0,
          screenshots: [],
          suspiciousActivities: []
        };
      }
      
      const submissionData = {
        testId,
        language,
        questions: test?.coding?.questions?.map(question => ({
          questionId: question.id,
          code: questionCodes[question.id] || '',
          testCases: question.testCases
        })) || [],
        // Include enhanced monitoring data
        violations: monitoringData.violations || [],
        totalViolations: monitoringData.totalViolations || 0,
        monitoringImages: monitoringData.screenshots || [],
        suspiciousActivities: monitoringData.suspiciousActivities || [],
        cameraMonitoring: test?.cameraMonitoring?.enabled || false,
        proctoringSettings: test?.proctoringSettings || {},
        timeTaken: testStartTimeRef.current ? Math.floor((Date.now() - testStartTimeRef.current) / 1000) : 0, // in seconds
        submissionTime: new Date().toISOString()
      };

      console.log('🔍 Submitting test with enhanced monitoring data:', {
        endpoint: '/api/student/submit-coding-test',
        testId,
        language,
        questionsCount: submissionData.questions.length,
        totalViolations: submissionData.totalViolations,
        monitoringImagesCount: submissionData.monitoringImages.length,
        suspiciousActivitiesCount: submissionData.suspiciousActivities.length,
        questions: submissionData.questions.map(q => ({
          questionId: q.questionId,
          codeLength: q.code.length,
          testCasesCount: q.testCases?.length
        }))
      });

      const response = await axios.post('/api/student/submit-coding-test', submissionData);
      
      console.log('🎯 Submit response:', response.data);
      
      // End monitoring session with the result ID
      if (response.data.resultId) {
        await TestMonitoringSystem.endMonitoring(response.data.resultId);
      } else {
        await TestMonitoringSystem.endMonitoring();
      }
      
      setSubmitted(true);
      
      // Clear saved codes from localStorage on successful submission
      try {
        localStorage.removeItem(getStorageKey());
      } catch (error) {
        console.warn('Failed to clear saved codes from localStorage:', error);
      }
      
      // Show prominent SweetAlert success
      await Swal.fire({
        title: 'Submitted!',
        text: 'Your coding test was submitted successfully.',
        icon: 'success',
        confirmButtonText: 'Go to Dashboard'
      });

      // Redirect to dashboard
      navigate('/student/dashboard');
      
    } catch (error) {
      console.error('💥 Error submitting test:', error);
      toast.error('Failed to submit test: ' + (error.response?.data?.message || error.message));
    } finally {
      setSubmitting(false);
    }
  }, [submitted, test, testId, questionCodes, navigate]);

  // Set up global functions for keyboard shortcuts
  useEffect(() => {
    window.runExampleTestCase = runExampleTestCase;
    window.handleSubmitTest = handleSubmit;
    
    return () => {
      delete window.runExampleTestCase;
      delete window.handleSubmitTest;
    };
  }, [runExampleTestCase, handleSubmit]);

  // Proctoring violation handler
  const handleViolation = useCallback(async (type, message) => {
    const currentTime = Date.now();
    const violationKey = `${type}_${message}`;
    
    // Record violation in monitoring system
    try {
      await TestMonitoringSystem.recordViolation(type, message);
      
      // Update local violation count
      setTotalViolations(prev => prev + 1);
      
      // Prevent showing the same violation modal multiple times within 5 seconds
      const timeSinceLastViolation = currentTime - lastViolationTime;
      const hasRecentlyShownSimilar = shownViolations.has(violationKey) && timeSinceLastViolation < 5000;
      
      if (!hasRecentlyShownSimilar) {
        setViolationMessage(message);
        setShowViolationModal(true);
        setLastViolationTime(currentTime);
        
        // Add this violation to shown violations and clean old ones
        setShownViolations(prev => {
          const newSet = new Set(prev);
          newSet.add(violationKey);
          
          // Clean old violations after 30 seconds to prevent memory buildup
          setTimeout(() => {
            setShownViolations(current => {
              const updated = new Set(current);
              updated.delete(violationKey);
              return updated;
            });
          }, 30000);
          
          return newSet;
        });
        
        console.warn(`Proctoring violation - ${type}:`, message);
      } else {
        // Just log without showing modal for repeated violations
        console.warn(`Proctoring violation (suppressed) - ${type}:`, message);
      }
      
      // Auto-submit if too many violations
      if (test?.proctoringSettings?.maxViolations && 
          totalViolations + 1 >= test.proctoringSettings.maxViolations) {
        toast.error(`Too many violations (${totalViolations + 1}). Test will be auto-submitted.`);
        setTimeout(() => {
          handleSubmit();
        }, 3000);
      }
      
    } catch (error) {
      console.error('Failed to record violation:', error);
    }
  }, [test, handleSubmit, lastViolationTime, shownViolations, totalViolations]);

  // Load test data
  useEffect(() => {
    const fetchTest = async () => {
      try {
        console.log('🔍 Fetching coding test:', testId);
        const token = localStorage.getItem('token');
        const response = await axios.get(`/api/student/coding-test/${testId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        console.log('📡 Raw API response:', response.data);
        let testData = response.data;
        
        // Handle different response structures
        if (testData.success && testData.test) {
          console.log('📋 Using legacy structure with testData.test');
          testData = testData.test;
        } else if (testData.success) {
          console.log('📋 Using modern structure, removing success flag');
          const { success, ...actualTestData } = testData;
          testData = actualTestData;
        }

        // Check for resume capability from response
        if (response.data.canResume && response.data.existingResult) {
          console.log('🔄 Coding test can be resumed:', response.data.existingResult);
          setExistingResult(response.data.existingResult);
          
          if (isResumeSession) {
            // Auto-resume for coding test
            console.log('🔄 Auto-resuming coding test from existing result');
            toast.success('✅ Coding test resumed from where you left off');
            
            // Load saved question codes if available
            try {
              const savedCodes = localStorage.getItem(getStorageKey());
              if (savedCodes) {
                const parsedCodes = JSON.parse(savedCodes);
                setQuestionCodes(parsedCodes);
                console.log('📄 Restored saved question codes:', Object.keys(parsedCodes).length, 'questions');
              }
            } catch (error) {
              console.warn('Failed to load saved codes for resume:', error);
            }
          } else {
            // Show resume dialog for coding test
            const shouldResume = await new Promise((resolve) => {
              const resumeDialog = window.confirm(
                'You have a previous attempt at this coding test. Would you like to resume from where you left off?\n\n' +
                '✅ Resume - Continue your previous work\n' +
                '❌ Start Fresh - Begin the test again (previous work will be lost)'
              );
              resolve(resumeDialog);
            });

            if (shouldResume) {
              console.log('🔄 User chose to resume coding test');
              toast.success('✅ Coding test resumed from where you left off');
              
              // Load saved question codes
              try {
                const savedCodes = localStorage.getItem(getStorageKey());
                if (savedCodes) {
                  const parsedCodes = JSON.parse(savedCodes);
                  setQuestionCodes(parsedCodes);
                  console.log('� Restored saved question codes for resume');
                }
              } catch (error) {
                console.warn('Failed to load saved codes for resume:', error);
              }
            } else {
              console.log('🆕 User chose to start fresh');
              toast.info('Starting fresh coding test');
              
              // Clear any saved codes for fresh start
              try {
                localStorage.removeItem(getStorageKey());
              } catch (error) {
                console.warn('Failed to clear saved codes:', error);
              }
            }
          }
        }
        
        console.log('�📊 Processed test data:', testData);
        console.log('📊 Has coding:', !!testData.coding);
        console.log('📊 Has coding.questions:', !!testData.coding?.questions);
        console.log('📊 Questions count:', testData.coding?.questions?.length || 0);
        
        if (!testData.coding || !testData.coding.questions || testData.coding.questions.length === 0) {
          console.error('❌ Invalid test data structure:', testData);
          throw new Error('Invalid coding test data - missing questions');
        }
        
        console.log('Valid test data loaded:', testData);
        
        setTest(testData);
        
        // Initialize question codes with starter code (if not already set by resume)
        const language = getLanguageForBoard(testData.board);
        let initialCodes = { ...questionCodes }; // Keep any resumed codes
        
        // Try to load from localStorage if not resuming or no codes yet
        if (Object.keys(initialCodes).length === 0) {
          try {
            const savedCodes = localStorage.getItem(getStorageKey());
            if (savedCodes) {
              Object.assign(initialCodes, JSON.parse(savedCodes));
            }
          } catch (error) {
            console.warn('Failed to load saved codes from localStorage:', error);
          }
        }
        
        // Set up initial code states (merge with saved codes)
        testData.coding.questions.forEach(question => {
          if (!initialCodes[question.id]) {
            initialCodes[question.id] = question.starterCode?.[language] || '';
          }
        });
        
        setQuestionCodes(initialCodes);
        
        // Set up timer
        const duration = testData.duration * 60; // Convert to seconds
        setTimeLeft(duration);
        testStartTimeRef.current = Date.now();
        
        // Start countdown
        timerRef.current = setInterval(() => {
          setTimeLeft(prev => {
            if (prev <= 1) {
              clearInterval(timerRef.current);
              // Auto-submit when timer expires
              toast.warning('Test auto-submitted due to time expiry');
              setTimeout(async () => {
                if (!submitted) {
                  try {
                    const language = getLanguageForBoard(testData.board);
                    
                    // Get monitoring data from enhanced system
                    let monitoringData = {};
                    try {
                      monitoringData = await TestMonitoringSystem.getMonitoringStats();
                    } catch (error) {
                      console.warn('Failed to get monitoring stats for auto-submit:', error);
                      monitoringData = {
                        violations: [],
                        totalViolations: 0,
                        screenshots: [],
                        suspiciousActivities: []
                      };
                    }
                    
                    const submissionData = {
                      testId,
                      language,
                      questions: testData.coding.questions.map(question => ({
                        questionId: question.id,
                        code: questionCodes[question.id] || '',
                        testCases: question.testCases
                      })),
                      // Include enhanced monitoring data for auto-submit
                      violations: monitoringData.violations || [],
                      totalViolations: monitoringData.totalViolations || 0,
                      monitoringImages: monitoringData.screenshots || [],
                      suspiciousActivities: monitoringData.suspiciousActivities || [],
                      cameraMonitoring: testData?.cameraMonitoring?.enabled || false,
                      proctoringSettings: testData?.proctoringSettings || {},
                      timeTaken: testStartTimeRef.current ? Math.floor((Date.now() - testStartTimeRef.current) / 1000) : 0,
                      submissionTime: new Date().toISOString(),
                      submissionType: 'auto_submit',
                      exitReason: 'time_expired'
                    };
                    
                    await axios.post('/api/student/submit-coding-test', submissionData);
                    
                    // End monitoring session
                    await TestMonitoringSystem.endMonitoring();
                    
                    setSubmitted(true);
                    toast.success('Test submitted successfully!');
                    navigate('/student/dashboard');
                  } catch (error) {
                    console.error('Error auto-submitting test:', error);
                    navigate('/student/dashboard');
                  }
                }
              }, 1000);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
        
      } catch (error) {
        console.error('Error loading test:', error);
        console.error('Error details:', error.response?.data || error.message);
        toast.error(`Failed to load test: ${error.response?.data?.message || error.message}`);
        navigate('/student/dashboard');
      } finally {
        setLoading(false);
      }
    };

    fetchTest();
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [testId, navigate, isResumeSession]); // Added isResumeSession dependency

  // Initialize enhanced monitoring after test loads and permissions are granted
  useEffect(() => {
    if (test && !proctoringInitialized && testAllowedToStart && 
        (!test.cameraMonitoring?.enabled || cameraPermissionGranted)) {
      const initializeMonitoring = async () => {
        try {
          // Initialize the enhanced monitoring system
          const monitoringConfig = {
            testId: test._id,
            testType: 'coding',
            settings: {
              cameraMonitoring: test.cameraMonitoring?.enabled || false,
              proctoringSettings: test.proctoringSettings || {},
              fullscreen: test.proctoringSettings?.requireFullscreen || false,
              captureInterval: 30000, // 30 seconds
              screenshotInterval: 30000, // 30 seconds
              browserLockdown: test.proctoringSettings?.browserLockdown || false
            }
          };

          console.log('🔧 Initializing enhanced monitoring with config:', monitoringConfig);
          
          // Start monitoring session with correct parameters
          const result = await TestMonitoringSystem.startMonitoring(test._id, monitoringConfig.settings);
          
          if (result.success) {
            console.log('✅ Monitoring started successfully:', result.sessionId);
            
            // Request fullscreen if required
            if (test.proctoringSettings?.requireFullscreen) {
              try {
                await document.documentElement.requestFullscreen();
              } catch (err) {
                console.warn('Fullscreen request failed:', err);
                await TestMonitoringSystem.recordViolation('fullscreen', 'Failed to enter fullscreen mode');
              }
            }

            setProctoringInitialized(true);
            toast.success('✅ Monitoring system initialized successfully');
          } else {
            throw new Error(result.message || 'Failed to start monitoring session');
          }
          
        } catch (error) {
          console.error('Failed to initialize monitoring system:', error);
          setMonitoringError(`Failed to initialize monitoring: ${error.message}`);
          toast.error('❌ Failed to initialize monitoring system: ' + error.message);
          
          // Still set as initialized to prevent infinite retries, but show error
          setProctoringInitialized(true);
        }
      };

      initializeMonitoring();
    }
  }, [test, proctoringInitialized, testAllowedToStart, cameraPermissionGranted]);

  // Track fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isCurrentlyFullscreen);
      
      // Show warning overlay if fullscreen is exited during test and fullscreen is required
      if (!isCurrentlyFullscreen && proctoringInitialized && test?.proctoringSettings?.requireFullscreen) {
        setShowFullscreenWarning(true);
        // Record violation
        TestMonitoringSystem.recordViolation('fullscreen', 'Exited fullscreen mode during test').catch(error => {
          console.error('Error recording fullscreen violation:', error);
        });
      } else if (isCurrentlyFullscreen && proctoringInitialized) {
        setShowFullscreenWarning(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [proctoringInitialized, test]);

  // Cleanup monitoring system on unmount
  useEffect(() => {
    return () => {
      if (proctoringInitialized) {
        console.log('🧹 Cleaning up monitoring system...');
        TestMonitoringSystem.endMonitoring().catch(error => {
          console.error('Error cleaning up monitoring system:', error);
        });
      }
    };
  }, [proctoringInitialized]);

  // Fullscreen helper function
  const enterFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen();
      setShowFullscreenWarning(false);
      toast.success('✅ Returned to fullscreen mode');
    } catch (err) {
      console.warn('Fullscreen request failed:', err);
      toast.error('❌ Failed to enter fullscreen mode');
    }
  };

  // Format time display
  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Switch questions
  const switchQuestion = (index) => {
    if (!test?.coding?.allowQuestionSwitching) {
      toast.warning('Question switching is not allowed for this test');
      return;
    }
    
    if (index >= 0 && index < (test?.coding?.questions?.length || 0)) {
      setCurrentQuestionIndex(index);
      setShowConsole(false);
      setConsoleOutput('');
    }
  };

  // Run all test cases
  const runAllTestCases = async () => {
    if (!test || !test.coding || !test.coding.questions || !test.coding.questions[currentQuestionIndex]) {
      toast.error('Test data not loaded properly');
      return;
    }

    const currentQuestion = test.coding.questions[currentQuestionIndex];
    const currentCode = questionCodes[currentQuestion.id] || '';
    
    if (!currentCode.trim()) {
      toast.warning('Please write some code first');
      return;
    }

    setTestingQuestion(currentQuestion.id);
    setConsoleOutput('Running all test cases...\n');
    setShowConsole(true);
    
    try {
      const language = getLanguageForBoard(test.board);
      const visibleTestCases = currentQuestion.testCases?.filter(tc => !tc.isHidden) || [];
      console.log('🔍 Running test cases with:', {
        endpoint: `/api/coding-test/${test._id}/test-question`,
        questionId: currentQuestion.id,
        language,
        codeLength: currentCode.length,
        visibleTestCasesCount: visibleTestCases.length,
        totalTestCasesCount: currentQuestion.testCases?.length || 0,
        willSendTestCases: visibleTestCases.length > 0
      });
      
      // Filter visible test cases first
      // If no visible test cases, let the backend decide what to run (don't send empty array)
      const testCasesToSend = visibleTestCases.length > 0 ? visibleTestCases : undefined;
      
      const response = await axios.post(`/api/coding-test/${test._id}/test-question`, {
        questionId: currentQuestion.id,
        code: currentCode,
        language,
        testCases: testCasesToSend
      });

      console.log('🎯 Test cases response:', response.data);

      if (response.data.success) {
        const results = response.data;
        setQuestionResults(prev => ({
          ...prev,
          [currentQuestion.id]: results
        }));
        
        let consoleText = `Test Results: ${results.passedTestCases}/${results.totalTestCases} passed (${results.percentage?.toFixed(1)}%)\n\n`;
        
        results.results?.forEach((result, index) => {
          consoleText += `Test Case ${result.testCaseNumber || index + 1}: ${result.passed ? '✅ PASSED' : '❌ FAILED'}\n`;
          consoleText += `  Input: ${result.input}\n`;
          consoleText += `  Expected: ${result.expectedOutput}\n`;
          consoleText += `  Your Output: ${result.actualOutput}\n`;
          if (result.stderr) {
            consoleText += `  Error: ${result.stderr}\n`;
          }
          if (result.executionTime) {
            consoleText += `  Time: ${result.executionTime}ms\n`;
          }
          consoleText += '\n';
        });
        
        setConsoleOutput(consoleText);
        toast.success(`${results.passedTestCases}/${results.totalTestCases} test cases passed!`);
      } else {
        console.error('❌ Test cases failed:', response.data);
        setConsoleOutput('Error running test cases:\n' + response.data.message);
        toast.error('Failed to run test cases');
      }
    } catch (error) {
      console.error('💥 Error running test cases:', error);
      setConsoleOutput('Error running test cases:\n' + (error.response?.data?.message || error.message));
      toast.error('Failed to run test cases');
    } finally {
      setTestingQuestion(null);
    }
  };

  if (loading) {
    return (
      <div className="leetcode-loading">
        <div className="loading-spinner"></div>
        <p>Loading your coding test...</p>
      </div>
    );
  }

  if (!test) {
    return (
      <div className="leetcode-error">
        <h2>Test Not Found</h2>
        <button onClick={() => navigate('/student/dashboard')}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  // Show permission request screen if camera is required but not granted
  if (test.cameraMonitoring?.enabled && !testAllowedToStart) {
    return (
      <div className="leetcode-permission-screen">
        <div className="permission-container">
          <div className="permission-header">
            <h2>🎥 Camera Permission Required</h2>
            <p>This test requires camera monitoring for proctoring purposes.</p>
          </div>
          
          {monitoringError ? (
            <div className="permission-error">
              <div className="error-icon">⚠️</div>
              <div className="error-message">
                <h3>Permission Required</h3>
                <p>{monitoringError}</p>
              </div>
            </div>
          ) : (
            <div className="permission-status">
              <div className="status-icon">📹</div>
              <div className="status-message">
                <h3>Requesting Camera Access...</h3>
                <p>Please allow camera permissions when prompted by your browser.</p>
              </div>
            </div>
          )}

          <div className="permission-actions">
            <button 
              className="btn-grant-permission"
              onClick={requestCameraPermission}
              disabled={!monitoringError}
            >
              🎥 Grant Camera Permission
            </button>
            <button 
              className="btn-back-dashboard"
              onClick={() => navigate('/student/dashboard')}
            >
              ← Back to Dashboard
            </button>
          </div>

          <div className="permission-note">
            <p><strong>Note:</strong> Camera monitoring ensures test integrity. Your privacy is protected and recordings are only used for academic purposes.</p>
          </div>
        </div>
        
        <style jsx>{`
          .leetcode-permission-screen {
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
          }
          
          .permission-container {
            background: white;
            border-radius: 16px;
            padding: 40px;
            max-width: 500px;
            width: 100%;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            text-align: center;
          }
          
          .permission-header h2 {
            color: #333;
            margin-bottom: 10px;
          }
          
          .permission-header p {
            color: #666;
            margin-bottom: 30px;
          }
          
          .permission-error {
            display: flex;
            align-items: center;
            background: #fee;
            border: 1px solid #fcc;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
          }
          
          .permission-status {
            display: flex;
            align-items: center;
            background: #eff8ff;
            border: 1px solid #bde;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
          }
          
          .error-icon, .status-icon {
            font-size: 2em;
            margin-right: 15px;
          }
          
          .error-message h3, .status-message h3 {
            margin: 0 0 5px 0;
            color: #333;
          }
          
          .error-message p, .status-message p {
            margin: 0;
            color: #666;
          }
          
          .permission-actions {
            margin: 30px 0;
            display: flex;
            flex-direction: column;
            gap: 10px;
          }
          
          .btn-grant-permission {
            background: #4CAF50;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 16px;
            cursor: pointer;
            transition: background 0.2s;
          }
          
          .btn-grant-permission:hover:not(:disabled) {
            background: #45a049;
          }
          
          .btn-grant-permission:disabled {
            background: #ccc;
            cursor: not-allowed;
          }
          
          .btn-back-dashboard {
            background: #6c757d;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            transition: background 0.2s;
          }
          
          .btn-back-dashboard:hover {
            background: #5a6268;
          }
          
          .permission-note {
            margin-top: 20px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
            border-left: 4px solid #007bff;
          }
          
          .permission-note p {
            margin: 0;
            font-size: 14px;
            color: #666;
          }
        `}</style>
      </div>
    );
  }

  const currentQuestion = test.coding?.questions?.[currentQuestionIndex];
  const language = getLanguageForBoard(test.board);
  const currentCode = questionCodes[currentQuestion?.id] || '';

  if (!currentQuestion) {
    return (
      <div className="leetcode-error">
        <h2>Question Not Found</h2>
        <p>Unable to load question {currentQuestionIndex + 1}.</p>
        <button onClick={() => navigate('/student/dashboard')}>
          Back to Dashboard
        </button>
        <button onClick={() => window.location.reload()}>
          Reload Page
        </button>
      </div>
    );
  }

  return (
    <div className="leetcode-interface">
      {/* Proctoring Elements */}
      {test.cameraMonitoring?.enabled && (
        <>
          <video 
            ref={videoRef} 
            autoPlay 
            muted 
            className="proctoring-video"
            style={{ display: 'none' }}
          />
          <canvas 
            ref={canvasRef}
            style={{ display: 'none' }}
          />
        </>
      )}

      {/* Fullscreen Warning Overlay */}
      {showFullscreenWarning && (
        <div className="fullscreen-warning-overlay">
          <div className="fullscreen-warning-content">
            <div className="warning-icon">⚠️</div>
            <h2>You are not in fullscreen mode</h2>
            <p>This test requires fullscreen mode for security purposes.</p>
            <p>Please click the button below to return to fullscreen mode.</p>
            <button 
              className="fullscreen-return-btn"
              onClick={enterFullscreen}
            >
              Return to Fullscreen
            </button>
          </div>
        </div>
      )}

      {/* Header Bar */}
      <div className="leetcode-header">
        <div className="header-left">
          <h1 className="test-title">{test.title}</h1>
          <div className="question-tabs">
            {test.coding?.questions?.map((question, index) => (
              <button
                key={question.id}
                className={`question-tab ${index === currentQuestionIndex ? 'active' : ''} ${
                  questionResults[question.id] ? 'solved' : ''
                }`}
                onClick={() => switchQuestion(index)}
                disabled={!test.coding.allowQuestionSwitching && index !== currentQuestionIndex}
              >
                {index + 1}
              </button>
            ))}
          </div>
        </div>
        
        <div className="header-right">
          <div className="timer-display">
            <span className={`timer ${timeLeft <= 300 ? 'urgent' : ''}`}>
              {formatTime(timeLeft)}
            </span>
          </div>
          
          <div className="violations-display">
            <span className="violations-count">
              Violations: {totalViolations}/{test.proctoringSettings?.maxViolations || 10}
            </span>
          </div>

          {!isFullscreen && test.proctoringSettings?.requireFullscreen && (
            <button 
              className="fullscreen-btn"
              onClick={enterFullscreen}
            >
              Fullscreen
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="leetcode-main">
        {/* Left Panel - Problem Description (Hidden on mobile) */}
        {!isMobile && (
          <div className="problem-panel">
          <div className="problem-header">
            <h2 className="problem-title">{currentQuestion.title}</h2>
            <div className="problem-meta">
              <span className={`difficulty-badge ${currentQuestion.difficulty}`}>
                {currentQuestion.difficulty?.toUpperCase() || 'MEDIUM'}
              </span>
              <span className="marks-badge">{currentQuestion.marks} marks</span>
            </div>
          </div>
          
          <div className="problem-content">
            <div className="problem-description">
              <p>{currentQuestion.description}</p>
            </div>

            {currentQuestion.examples && currentQuestion.examples.length > 0 && (
              <div className="problem-examples">
                {currentQuestion.examples.map((example, index) => (
                  <div key={index} className="example-block">
                    <h4>Example {index + 1}:</h4>
                    <div className="example-content">
                      <div className="example-input">
                        <strong>Input:</strong>
                        <pre>{example.input}</pre>
                      </div>
                      <div className="example-output">
                        <strong>Output:</strong>
                        <pre>{example.output}</pre>
                      </div>
                      {example.explanation && (
                        <div className="example-explanation">
                          <strong>Explanation:</strong>
                          <p>{example.explanation}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {currentQuestion.constraints && (
              <div className="problem-constraints">
                <h4>Constraints:</h4>
                <pre>{currentQuestion.constraints}</pre>
              </div>
            )}

            {currentQuestion.inputFormat && (
              <div className="problem-format">
                <h4>Input Format:</h4>
                <pre>{currentQuestion.inputFormat}</pre>
              </div>
            )}

            {currentQuestion.outputFormat && (
              <div className="problem-format">
                <h4>Output Format:</h4>
                <pre>{currentQuestion.outputFormat}</pre>
              </div>
            )}
          </div>
        </div>
        )}

        {/* Right Panel - Code Editor */}
        <div className="code-panel">
          <div className="code-header">
            <div className="language-selector">
              <span className="language-label">{language.toUpperCase()}</span>
            </div>
            <div className="code-actions">
              {isMobile ? (
                <>
                  {/* Mobile Menu Button */}
                  <button 
                    className="mobile-menu-btn"
                    onClick={() => setShowMobileMenu(!showMobileMenu)}
                    title="Show Actions Menu"
                  >
                    ⚡ Actions {showMobileMenu ? '▲' : '▼'}
                  </button>
                  
                  {/* Mobile Actions Menu */}
                  {showMobileMenu && (
                    <div className="mobile-actions-menu">
                      <button 
                        className="mobile-problem-btn"
                        onClick={() => {
                          setShowProblemModal(true);
                          setShowMobileMenu(false);
                        }}
                        title="View Problem Statement"
                      >
                        📄 Problem
                      </button>
                      <button 
                        className="mobile-examples-btn"
                        onClick={() => {
                          setShowExamplesModal(true);
                          setShowMobileMenu(false);
                        }}
                        title="View Examples"
                      >
                        📋 Examples
                      </button>
                      <button 
                        className="reset-code-btn"
                        onClick={() => {
                          resetCode();
                          setShowMobileMenu(false);
                        }}
                        disabled={!currentCode || currentCode === (currentQuestion.starterCode?.[language] || '')}
                        title="Reset to starter code"
                      >
                        🔄 Reset
                      </button>
                      <button 
                        className="run-example-btn"
                        onClick={() => {
                          runExampleTestCase();
                          setShowMobileMenu(false);
                        }}
                        disabled={runningExampleCase}
                        title="Run Example (Ctrl+')"
                      >
                        {runningExampleCase ? 'Running...' : 'Run Example'}
                      </button>
                      <button 
                        className="run-tests-btn"
                        onClick={() => {
                          runAllTestCases();
                          setShowMobileMenu(false);
                        }}
                        disabled={testingQuestion === currentQuestion.id}
                      >
                        {testingQuestion === currentQuestion.id ? 'Testing...' : 'Run Tests'}
                      </button>
                      <button 
                        className="submit-btn"
                        onClick={() => {
                          handleSubmit();
                          setShowMobileMenu(false);
                        }}
                        disabled={submitting || submitted}
                        title="Submit Solution (Ctrl+Enter)"
                      >
                        {submitting ? 'Submitting...' : submitted ? 'Submitted' : 'Submit'}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Desktop Layout - All buttons visible */}
                  <button 
                    className="reset-code-btn"
                    onClick={resetCode}
                    disabled={!currentCode || currentCode === (currentQuestion.starterCode?.[language] || '')}
                    title="Reset to starter code"
                  >
                    🔄 Reset
                  </button>
                  <button 
                    className="run-example-btn"
                    onClick={runExampleTestCase}
                    disabled={runningExampleCase}
                    title="Run Example (Ctrl+')"
                  >
                    {runningExampleCase ? 'Running...' : 'Run Example'}
                  </button>
                  <button 
                    className="run-tests-btn"
                    onClick={runAllTestCases}
                    disabled={testingQuestion === currentQuestion.id}
                  >
                    {testingQuestion === currentQuestion.id ? 'Testing...' : 'Run Tests'}
                  </button>
                  <button 
                    className="submit-btn"
                    onClick={handleSubmit}
                    disabled={submitting || submitted}
                    title="Submit Solution (Ctrl+Enter)"
                  >
                    {submitting ? 'Submitting...' : submitted ? 'Submitted' : 'Submit'}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="editor-container">
            <Editor
              height="100%"
              language={language}
              theme="vs-dark"
              value={currentCode}
              onMount={handleEditorDidMount}
              onChange={(value) => {
                const newCodes = {
                  ...questionCodes,
                  [currentQuestion.id]: value || ''
                };
                setQuestionCodes(newCodes);
                
                // Save to localStorage
                try {
                  localStorage.setItem(getStorageKey(), JSON.stringify(newCodes));
                } catch (error) {
                  console.warn('Failed to save code to localStorage:', error);
                }
              }}
              options={{
                fontSize: isMobile ? 16 : 14,
                minimap: { enabled: !isMobile },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                wordWrap: 'on',
                lineNumbers: 'on',
                tabSize: 4,
                insertSpaces: true,
                formatOnType: true,
                formatOnPaste: true,
                autoIndent: 'advanced',
                bracketPairColorization: { enabled: true },
                guides: {
                  indentation: true,
                  bracketPairs: true
                },
                // Enhanced IntelliSense and suggestions
                suggestOnTriggerCharacters: true,
                acceptSuggestionOnCommitCharacter: true,
                acceptSuggestionOnEnter: 'on',
                tabCompletion: 'on',
                wordBasedSuggestions: true,
                quickSuggestions: {
                  other: true,
                  comments: true,
                  strings: true
                },
                quickSuggestionsDelay: 100,
                suggest: {
                  showWords: true,
                  showKeywords: true,
                  showSnippets: true,
                  showClasses: true,
                  showFunctions: true,
                  showConstructors: true,
                  showFields: true,
                  showVariables: true,
                  showInterfaces: true,
                  showModules: true,
                  showProperties: true,
                  showEvents: true,
                  showValues: true,
                  showConstants: true,
                  showEnums: true,
                  showMethods: true,
                  filterGraceful: true,
                  snippetsPreventQuickSuggestions: false
                },
                // Mobile optimizations
                scrollbar: {
                  verticalScrollbarSize: isMobile ? 8 : 14,
                  horizontalScrollbarSize: isMobile ? 8 : 14
                },
                mouseWheelZoom: !isMobile,
                // Better touch support
                selectOnLineNumbers: !isMobile,
                glyphMargin: !isMobile,
                folding: !isMobile,
                // Code completion improvements
                parameterHints: {
                  enabled: true,
                  cycle: true
                },
                hover: {
                  enabled: true,
                  delay: 300,
                  sticky: true
                }
              }}
            />
          </div>

          {/* Console Panel */}
          {showConsole && (
            <div className="console-panel">
              <div className="console-header">
                <span>Console</span>
                <button 
                  className="close-console"
                  onClick={() => setShowConsole(false)}
                >
                  ×
                </button>
              </div>
              <div className="console-content">
                <pre>{consoleOutput}</pre>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Keyboard Shortcuts Helper */}
      <div className="shortcuts-help">
        <div className="shortcut-item">
          <kbd>Ctrl</kbd> + <kbd>'</kbd> Run Example Test Case
        </div>
        <div className="shortcut-item">
          <kbd>Ctrl</kbd> + <kbd>Enter</kbd> Submit Solution
        </div>
      </div>

      {/* Example Test Case Result Modal - LeetCode Style */}
      {showExampleModal && exampleResult && (
        <div className="example-modal-overlay" onClick={() => setShowExampleModal(false)}>
          <div className="example-modal" onClick={(e) => e.stopPropagation()}>
            <div className="example-header">
              <h3>Example Test Case</h3>
              <button 
                className="close-btn"
                onClick={() => setShowExampleModal(false)}
              >
                ×
              </button>
            </div>
            <div className="example-content">
              <div className={`test-result-summary ${exampleResult.passed ? 'passed' : 'failed'}`}>
                {exampleResult.passed ? '✅ Test Passed' : '❌ Test Failed'}
                <div style={{ fontSize: '0.9em', marginTop: '0.25rem' }}>
                  {exampleResult.passedTestCases} / {exampleResult.totalTestCases} test cases passed
                </div>
              </div>
              
              <div className="test-case-section">
                <h4>Input:</h4>
                <pre className="test-case-text">{exampleResult.input}</pre>
              </div>
              
              <div className="test-case-section">
                <h4>Expected Output:</h4>
                <pre className="test-case-text expected">{exampleResult.expected}</pre>
              </div>
              
              <div className="test-case-section">
                <h4>Your Output:</h4>
                <pre className={`test-case-text ${exampleResult.passed ? 'passed' : 'failed'}`}>
                  {exampleResult.actual || '(no output)'}
                </pre>
              </div>
              
              {exampleResult.error && (
                <div className="test-case-section error">
                  <h4>Runtime Error:</h4>
                  <pre className="test-case-text error-text">{exampleResult.error}</pre>
                </div>
              )}
            </div>
            <div className="example-footer">
              <button 
                className="close-modal-btn"
                onClick={() => setShowExampleModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Violation Modal */}
      {showViolationModal && (
        <div className="violation-modal-overlay">
          <div className="violation-modal">
            <h3>⚠️ Proctoring Violation Detected</h3>
            <p>{violationMessage}</p>
            <div className="violation-stats">
              <p>Total Violations: {totalViolations}/{test.proctoringSettings?.maxViolations || 10}</p>
              <p className="warning-text">
                {totalViolations >= (test.proctoringSettings?.maxViolations || 10) - 2 &&
                  'Warning: You are close to the maximum violation limit!'}
              </p>
            </div>
            <div className="violation-actions">
              <button 
                className="acknowledge-btn"
                onClick={() => setShowViolationModal(false)}
              >
                I Understand
              </button>
              <button 
                className="suppress-btn"
                onClick={() => {
                  setShowViolationModal(false);
                  // Clear shown violations to allow new unique violations but suppress repeated ones
                  setShownViolations(new Set());
                }}
                title="Dismiss this warning and similar ones temporarily"
              >
                Don't Show Similar Warnings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Problem Statement Modal */}
      {showProblemModal && (
        <div className="mobile-modal-overlay" onClick={() => setShowProblemModal(false)}>
          <div className="mobile-modal-content" onClick={e => e.stopPropagation()}>
            <div className="mobile-modal-header">
              <h2>{currentQuestion.title}</h2>
              <button 
                className="mobile-modal-close"
                onClick={() => setShowProblemModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="mobile-modal-body">
              <div className="problem-meta">
                <span className={`difficulty-badge ${currentQuestion.difficulty}`}>
                  {currentQuestion.difficulty?.toUpperCase() || 'MEDIUM'}
                </span>
                <span className="marks-badge">{currentQuestion.marks} marks</span>
              </div>
              
              <div className="problem-description">
                <p>{currentQuestion.description}</p>
              </div>

              {currentQuestion.constraints && (
                <div className="problem-constraints">
                  <h4>Constraints:</h4>
                  <pre>{currentQuestion.constraints}</pre>
                </div>
              )}

              {currentQuestion.inputFormat && (
                <div className="problem-format">
                  <h4>Input Format:</h4>
                  <pre>{currentQuestion.inputFormat}</pre>
                </div>
              )}

              {currentQuestion.outputFormat && (
                <div className="problem-format">
                  <h4>Output Format:</h4>
                  <pre>{currentQuestion.outputFormat}</pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Examples Modal */}
      {showExamplesModal && (
        <div className="mobile-modal-overlay" onClick={() => setShowExamplesModal(false)}>
          <div className="mobile-modal-content" onClick={e => e.stopPropagation()}>
            <div className="mobile-modal-header">
              <h2>Examples</h2>
              <button 
                className="mobile-modal-close"
                onClick={() => setShowExamplesModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="mobile-modal-body">
              {currentQuestion.examples && currentQuestion.examples.length > 0 ? (
                <div className="problem-examples">
                  {currentQuestion.examples.map((example, index) => (
                    <div key={index} className="example-block">
                      <h4>Example {index + 1}:</h4>
                      <div className="example-content">
                        <div className="example-input">
                          <strong>Input:</strong>
                          <pre>{example.input}</pre>
                        </div>
                        <div className="example-output">
                          <strong>Output:</strong>
                          <pre>{example.output}</pre>
                        </div>
                        {example.explanation && (
                          <div className="example-explanation">
                            <strong>Explanation:</strong>
                            <p>{example.explanation}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p>No examples available for this question.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default MultiQuestionCodingInterface;

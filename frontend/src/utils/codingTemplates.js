// Auto-coding templates and snippets for Python and Java
const PYTHON_TEMPLATES = {
  // Basic imports
  imports: {
    'import math': 'import math',
    'import sys': 'import sys',
    'import collections': 'import collections',
    'from collections import defaultdict': 'from collections import defaultdict',
    'from collections import Counter': 'from collections import Counter',
    'import heapq': 'import heapq',
    'import bisect': 'import bisect',
    'import itertools': 'import itertools',
    'import functools': 'import functools',
    'import re': 'import re'
  },
  
  // Control structures
  loops: {
    'for_range': 'for i in range(n):\n    pass',
    'for_enumerate': 'for i, val in enumerate(arr):\n    pass',
    'for_zip': 'for a, b in zip(arr1, arr2):\n    pass',
    'while': 'while condition:\n    pass',
    'for_dict': 'for key, value in dict.items():\n    pass'
  },
  
  conditionals: {
    'if': 'if condition:\n    pass',
    'if_else': 'if condition:\n    pass\nelse:\n    pass',
    'if_elif_else': 'if condition1:\n    pass\nelif condition2:\n    pass\nelse:\n    pass',
    'ternary': 'value1 if condition else value2'
  },
  
  // Data structures
  dataStructures: {
    'list_comp': '[expr for item in iterable]',
    'dict_comp': '{key: value for item in iterable}',
    'set_comp': '{expr for item in iterable}',
    'defaultdict': 'defaultdict(int)',
    'counter': 'Counter(iterable)',
    'deque': 'collections.deque()',
    'heap': 'heapq.heappush(heap, item)\nheapq.heappop(heap)'
  },
  
  // Common patterns
  patterns: {
    'binary_search': 'left, right = 0, len(arr) - 1\nwhile left <= right:\n    mid = (left + right) // 2\n    if arr[mid] == target:\n        return mid\n    elif arr[mid] < target:\n        left = mid + 1\n    else:\n        right = mid - 1\nreturn -1',
    
    'dfs': 'def dfs(node):\n    if not node:\n        return base_case\n    \n    # Process current node\n    # logic here\n    \n    # Recursive calls\n    left_result = dfs(node.left)\n    right_result = dfs(node.right)\n    \n    return combined_result',
    
    'bfs': 'from collections import deque\n\nqueue = deque([start])\nvisited = set([start])\n\nwhile queue:\n    current = queue.popleft()\n    \n    # Process current\n    # logic here\n    \n    # Add neighbors\n    for neighbor in get_neighbors(current):\n        if neighbor not in visited:\n            visited.add(neighbor)\n            queue.append(neighbor)'
  }
};

const JAVA_TEMPLATES = {
  // Basic imports
  imports: {
    'import java.util.*': 'import java.util.*;',
    'import java.io.*': 'import java.io.*;',
    'import java.math.*': 'import java.math.*;',
    'import java.util.stream.*': 'import java.util.stream.*;',
    'Scanner': 'Scanner sc = new Scanner(System.in);',
    'ArrayList': 'List<Type> list = new ArrayList<>();',
    'HashMap': 'Map<KeyType, ValueType> map = new HashMap<>();',
    'HashSet': 'Set<Type> set = new HashSet<>();'
  },
  
  // Control structures
  loops: {
    'for_i': 'for (int i = 0; i < n; i++) {\n    // code\n}',
    'for_enhanced': 'for (Type item : collection) {\n    // code\n}',
    'while': 'while (condition) {\n    // code\n}',
    'do_while': 'do {\n    // code\n} while (condition);'
  },
  
  conditionals: {
    'if': 'if (condition) {\n    // code\n}',
    'if_else': 'if (condition) {\n    // code\n} else {\n    // code\n}',
    'if_elif_else': 'if (condition1) {\n    // code\n} else if (condition2) {\n    // code\n} else {\n    // code\n}',
    'switch': 'switch (variable) {\n    case value1:\n        // code\n        break;\n    case value2:\n        // code\n        break;\n    default:\n        // code\n        break;\n}',
    'ternary': 'condition ? value1 : value2'
  },
  
  // Data structures and collections
  dataStructures: {
    'arraylist': 'List<Type> list = new ArrayList<>();',
    'linkedlist': 'List<Type> list = new LinkedList<>();',
    'hashmap': 'Map<KeyType, ValueType> map = new HashMap<>();',
    'hashset': 'Set<Type> set = new HashSet<>();',
    'treemap': 'Map<KeyType, ValueType> map = new TreeMap<>();',
    'treeset': 'Set<Type> set = new TreeSet<>();',
    'priorityqueue': 'PriorityQueue<Type> pq = new PriorityQueue<>();',
    'stack': 'Stack<Type> stack = new Stack<>();',
    'deque': 'Deque<Type> deque = new ArrayDeque<>();'
  },
  
  // Common patterns
  patterns: {
    'binary_search': 'int left = 0, right = arr.length - 1;\nwhile (left <= right) {\n    int mid = left + (right - left) / 2;\n    if (arr[mid] == target) {\n        return mid;\n    } else if (arr[mid] < target) {\n        left = mid + 1;\n    } else {\n        right = mid - 1;\n    }\n}\nreturn -1;',
    
    'dfs': 'public ReturnType dfs(TreeNode node) {\n    if (node == null) {\n        return baseCase;\n    }\n    \n    // Process current node\n    // logic here\n    \n    // Recursive calls\n    ReturnType leftResult = dfs(node.left);\n    ReturnType rightResult = dfs(node.right);\n    \n    return combinedResult;\n}',
    
    'bfs': 'Queue<Type> queue = new LinkedList<>();\nSet<Type> visited = new HashSet<>();\n\nqueue.offer(start);\nvisited.add(start);\n\nwhile (!queue.isEmpty()) {\n    Type current = queue.poll();\n    \n    // Process current\n    // logic here\n    \n    // Add neighbors\n    for (Type neighbor : getNeighbors(current)) {\n        if (!visited.contains(neighbor)) {\n            visited.add(neighbor);\n            queue.offer(neighbor);\n        }\n    }\n}'
  }
};

// Function to get templates by language
function getTemplates(language) {
  switch (language.toLowerCase()) {
    case 'python':
      return PYTHON_TEMPLATES;
    case 'java':
      return JAVA_TEMPLATES;
    default:
      return {};
  }
}

// Function to insert template at cursor position
function insertTemplate(editor, template) {
  const cursor = editor.getCursor();
  const lines = template.split('\n');
  
  // Replace ${n:placeholder} with actual placeholders
  let placeholderIndex = 1;
  const processedLines = lines.map(line => {
    return line.replace(/\$\{(\d+):([^}]+)\}/g, (match, index, placeholder) => {
      return placeholder;
    });
  });
  
  editor.replaceRange(processedLines.join('\n'), cursor);
}

// Export for use in frontend
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PYTHON_TEMPLATES,
    JAVA_TEMPLATES,
    getTemplates,
    insertTemplate
  };
}

// For browser usage
if (typeof window !== 'undefined') {
  window.CodingTemplates = {
    PYTHON_TEMPLATES,
    JAVA_TEMPLATES,
    getTemplates,
    insertTemplate
  };
}
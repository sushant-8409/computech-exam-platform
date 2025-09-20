import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import './CodingPracticeAdmin.css';

const CodingPracticeAdmin = () => {
  const [activeTab, setActiveTab] = useState('problems');
  const [problems, setProblems] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);

  // Problem creation state
  const [singleProblem, setSingleProblem] = useState({
    title: '',
    difficulty: 'Easy',
    description: '',
    constraints: '',
    examples: [{ input: '', output: '', explanation: '' }],
    testCases: [{ input: '', expectedOutput: '', isHidden: false, points: 1 }],
    topics: [],
    companies: [],
    starterCode: {
      python: '',
      java: '',
      cpp: '',
      c: ''
    },
    solution: {
      approach: '',
      explanation: '',
      code: {
        python: '',
        java: '',
        cpp: '',
        c: ''
      },
      timeComplexity: '',
      spaceComplexity: ''
    }
  });

  const [bulkProblemsJson, setBulkProblemsJson] = useState('');
  const [jsonError, setJsonError] = useState('');
  const [showCopyPrompt, setShowCopyPrompt] = useState(false);
  const [showAdvancedEditor, setShowAdvancedEditor] = useState(false);
  const [advancedProblemJson, setAdvancedProblemJson] = useState('');

  // Group management state
  const [newGroup, setNewGroup] = useState({
    name: '',
    description: '',
    difficulty: 'Beginner',
    allowedStudentClasses: []
  });

  const [selectedGroup, setSelectedGroup] = useState(null);
  const [availableProblems, setAvailableProblems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingGroup, setEditingGroup] = useState(null);
  const [editGroupData, setEditGroupData] = useState({
    name: '',
    description: '',
    difficulty: 'Beginner',
    allowedStudentClasses: []
  });

  // Student stats state
  const [studentStats, setStudentStats] = useState([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);

  useEffect(() => {
    fetchProblems();
    fetchGroups();
  }, []);

  const fetchProblems = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/coding-practice/admin/problems', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProblems(response.data.problems);
      setAvailableProblems(response.data.problems);
    } catch (error) {
      console.error('Error fetching problems:', error);
      toast.error('Failed to fetch problems');
    }
  };

  const fetchGroups = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/coding-practice/admin/groups', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setGroups(response.data.groups);
    } catch (error) {
      console.error('Error fetching groups:', error);
      toast.error('Failed to fetch groups');
    }
  };

  const fetchStudentStats = async () => {
    setStatsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/coding-practice/admin/student-stats', {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Student Stats Response:', response.data);
      
      if (response.data.success && Array.isArray(response.data.data)) {
        setStudentStats(response.data.data);
        toast.success(`Loaded ${response.data.data.length} student records`);
      } else {
        console.warn('Invalid response format:', response.data);
        setStudentStats([]);
        toast.warning('No valid student data received');
      }
    } catch (error) {
      console.error('Error fetching student stats:', error);
      toast.error(`Failed to fetch student statistics: ${error.response?.data?.message || error.message}`);
      setStudentStats([]);
    } finally {
      setStatsLoading(false);
    }
  };

  const syncStudentData = async () => {
    setSyncLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/coding-practice/admin/sync-student-data', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success(`${response.data.message}. ${response.data.data.synced} synced, ${response.data.data.updated} updated, ${response.data.data.existing} already existed.`);
      
      // Refresh student stats after sync
      fetchStudentStats();
    } catch (error) {
      console.error('Error syncing student data:', error);
      toast.error('Failed to sync student data');
    } finally {
      setSyncLoading(false);
    }
  };

  // Create single problem
  const handleCreateProblem = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      if (singleProblem._id) {
        // Update existing problem
        await axios.put(`/api/coding-practice/admin/problems/${singleProblem._id}`, singleProblem, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Problem updated successfully!');
      } else {
        // Create new problem
        await axios.post('/api/coding-practice/admin/problems', singleProblem, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Problem created successfully!');
      }
      setSingleProblem({
        title: '',
        difficulty: 'Easy',
        description: '',
        constraints: '',
        examples: [{ input: '', output: '', explanation: '' }],
        testCases: [{ input: '', expectedOutput: '', isHidden: false, points: 1 }],
        topics: [],
        companies: [],
        starterCode: { python: '', java: '', cpp: '', c: '' }
      });
      setAdvancedProblemJson('');
      setShowAdvancedEditor(false);
      fetchProblems();
    } catch (error) {
      console.error('Error creating problem:', error);
      toast.error('Failed to save problem');
    } finally {
      setLoading(false);
    }
  };

  // Bulk create problems from JSON
  const handleBulkCreate = async () => {
    if (!bulkProblemsJson.trim()) {
      toast.error('Please enter JSON data');
      return;
    }

    try {
      const problems = JSON.parse(bulkProblemsJson);
      setJsonError('');
      setLoading(true);

      const token = localStorage.getItem('token');
      const response = await axios.post('/api/coding-practice/admin/problems/bulk', 
        { problems }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success(`${response.data.created} problems created successfully!`);
      if (response.data.errors > 0) {
        toast.warning(`${response.data.errors} problems had errors`);
      }
      
      setBulkProblemsJson('');
      fetchProblems();
    } catch (error) {
      if (error.name === 'SyntaxError') {
        setJsonError('Invalid JSON format');
      } else {
        console.error('Error bulk creating problems:', error);
        toast.error('Failed to create problems');
      }
    } finally {
      setLoading(false);
    }
  };

  // Create group
  const handleCreateGroup = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/coding-practice/admin/groups', newGroup, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Group created successfully!');
      setNewGroup({
        name: '',
        description: '',
        difficulty: 'Beginner',
        allowedStudentClasses: []
      });
      fetchGroups();
    } catch (error) {
      console.error('Error creating group:', error);
      toast.error('Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  // Add problems to group
  const handleAddProblemsToGroup = async (problemIds) => {
    if (!selectedGroup || problemIds.length === 0) return;

    try {
      const token = localStorage.getItem('token');
      await axios.post(`/api/coding-practice/admin/groups/${selectedGroup._id}/problems`, 
        { problemIds }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Problems added to group successfully!');
      fetchGroups();
    } catch (error) {
      console.error('Error adding problems to group:', error);
      toast.error('Failed to add problems to group');
    }
  };

  // Edit problem
  const handleEditProblem = (problem) => {
    setSingleProblem({
      ...problem,
      examples: problem.examples || [{ input: '', output: '', explanation: '' }],
      testCases: problem.testCases || [{ input: '', expectedOutput: '', isHidden: false, points: 1 }],
      starterCode: problem.starterCode || { python: '', java: '', cpp: '', c: '' },
      solution: problem.solution || {
        approach: '',
        explanation: '',
        code: { python: '', java: '', cpp: '', c: '' },
        timeComplexity: '',
        spaceComplexity: ''
      }
    });
    setActiveTab('problems');
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast.info('Problem loaded for editing');
  };

  // Edit group
  const handleEditGroup = (group) => {
    setEditingGroup(group);
    setEditGroupData({
      name: group.name,
      description: group.description,
      difficulty: group.difficulty,
      allowedStudentClasses: group.allowedStudentClasses || []
    });
  };

  // Update group
  const handleUpdateGroup = async (e) => {
    e.preventDefault();
    if (!editingGroup) return;

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      await axios.put(`/api/coding-practice/admin/groups/${editingGroup._id}`, editGroupData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Group updated successfully!');
      setEditingGroup(null);
      setEditGroupData({ name: '', description: '', difficulty: 'Beginner', allowedStudentClasses: [] });
      fetchGroups();
    } catch (error) {
      console.error('Error updating group:', error);
      toast.error('Failed to update group');
    } finally {
      setLoading(false);
    }
  };

  // Delete group
  const handleDeleteGroup = async (groupId) => {
    const group = groups.find(g => g._id === groupId);
    const confirmMessage = `Are you sure you want to delete the group "${group?.name}"?\n\n⚠️ This will remove the group and all its problem associations.\nThis action cannot be undone.`;
    
    if (!window.confirm(confirmMessage)) return;

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      await axios.delete(`/api/coding-practice/admin/groups/${groupId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Group deleted successfully!');
      fetchGroups();
    } catch (error) {
      console.error('Error deleting group:', error);
      toast.error('Failed to delete group');
    } finally {
      setLoading(false);
    }
  };

  // Delete problem
  const handleDeleteProblem = async (problemId) => {
    const problem = problems.find(p => p._id === problemId);
    const confirmMessage = `Are you sure you want to delete Problem #${problem?.problemNumber}: "${problem?.title}"?\n\n⚠️ IMPORTANT: This will automatically renumber all subsequent problems to maintain continuous numbering.\n\nThis action cannot be undone.`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      await axios.delete(`/api/coding-practice/admin/problems/${problemId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Problem deleted successfully! Problem numbering has been updated.');
      fetchProblems();
    } catch (error) {
      console.error('Error deleting problem:', error);
      toast.error('Failed to delete problem');
    } finally {
      setLoading(false);
    }
  };

  // Filter available problems for group assignment
  const filteredProblems = availableProblems?.filter(problem =>
    problem.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    problem.topics?.some(topic => topic.toLowerCase().includes(searchTerm.toLowerCase()))
  ) || [];

  const sampleJsonFormat = {
    "title": "Two Sum",
    "difficulty": "Easy",
    "description": "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.",
    "constraints": "2 <= nums.length <= 10^4\n-10^9 <= nums[i] <= 10^9\n-10^9 <= target <= 10^9",
    "examples": [
      {
        "input": "nums = [2,7,11,15], target = 9",
        "output": "[0,1]",
        "explanation": "Because nums[0] + nums[1] == 9, we return [0, 1]."
      }
    ],
    "testCases": [
      {
        "input": "2 7 11 15\n9",
        "expectedOutput": "0 1",
        "isHidden": false,
        "points": 1
      },
      {
        "input": "3 2 4\n6",
        "expectedOutput": "1 2",
        "isHidden": true,
        "points": 1
      }
    ],
    "topics": ["Array", "Hash Table"],
    "companies": ["Amazon", "Google"],
    "starterCode": {
      "python": "def twoSum(nums, target):\n    # Your code here\n    pass",
      "java": "public int[] twoSum(int[] nums, int target) {\n    // Your code here\n    return new int[]{};\n}"
    },
    "solution": {
      "python": "def twoSum(nums, target):\n    num_map = {}\n    for i, num in enumerate(nums):\n        complement = target - num\n        if complement in num_map:\n            return [num_map[complement], i]\n        num_map[num] = i\n    return []",
      "java": "public int[] twoSum(int[] nums, int target) {\n    Map<Integer, Integer> map = new HashMap<>();\n    for (int i = 0; i < nums.length; i++) {\n        int complement = target - nums[i];\n        if (map.containsKey(complement)) {\n            return new int[] { map.get(complement), i };\n        }\n        map.put(nums[i], i);\n    }\n    return new int[0];\n}",
      "explanation": "Use a hash map to store numbers and their indices. For each number, check if its complement (target - number) exists in the map."
    }
  };

  const copyPromptTemplate = `Create a coding problem in JSON format with the following structure:

{
  "title": "Problem Title",
  "difficulty": "Easy/Medium/Hard",
  "description": "Detailed problem description with clear requirements",
  "constraints": "Input constraints and limits (e.g., 1 <= n <= 10^5)",
  "examples": [
    {
      "input": "Example input",
      "output": "Expected output", 
      "explanation": "Step-by-step explanation of why this output"
    }
  ],
  "testCases": [
    {
      "input": "Test input",
      "expectedOutput": "Expected output",
      "isHidden": false,
      "points": 1
    }
  ],
  "topics": ["Array", "Hash Table", "Two Pointers"],
  "companies": ["Google", "Amazon", "Microsoft"],
  "starterCode": {
    "python": "# Complete solution with main function and I/O handling\\nfrom typing import List\\nimport sys\\n\\ndef solution(params):\\n    \\"\\"\\"\\n    Your solution here\\n    \\"\\"\\"\\n    pass\\n\\nif __name__ == '__main__':\\n    # Read input\\n    # Call solution\\n    # Print output",
    "java": "import java.io.*;\\nimport java.util.*;\\n\\npublic class Solution {\\n    public static void main(String[] args) throws IOException {\\n        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));\\n        // Read input\\n        // Call solution\\n        // Print output\\n    }\\n    \\n    public static ReturnType solution(InputType input) {\\n        // Your solution here\\n        return null;\\n    }\\n}",
    "cpp": "#include <iostream>\\n#include <vector>\\n#include <string>\\nusing namespace std;\\n\\nclass Solution {\\npublic:\\n    ReturnType solution(InputType input) {\\n        // Your solution here\\n    }\\n};\\n\\nint main() {\\n    // Read input\\n    Solution sol;\\n    // Call solution\\n    // Print output\\n    return 0;\\n}",
    "c": "#include <stdio.h>\\n#include <stdlib.h>\\n#include <string.h>\\n\\nReturnType solution(InputType input) {\\n    // Your solution here\\n}\\n\\nint main() {\\n    // Read input\\n    // Call solution\\n    // Print output\\n    return 0;\\n}"
  },
  "solution": {
    "approach": "Detailed step-by-step approach explanation",
    "explanation": "Comprehensive explanation of the solution logic",
    "code": {
      "python": "def solution(params):\\n    \\"\\"\\"Complete working solution\\"\\"\\"\\n    # Implementation here\\n    return result",
      "java": "public static ReturnType solution(InputType input) {\\n    // Complete working solution\\n    return result;\\n}",
      "cpp": "ReturnType solution(InputType input) {\\n    // Complete working solution\\n    return result;\\n}",
      "c": "ReturnType solution(InputType input) {\\n    // Complete working solution\\n    return result;\\n}"
    },
    "timeComplexity": "O(n) or O(n log n) etc.",
    "spaceComplexity": "O(1) or O(n) etc."
  }
}

IMPORTANT REQUIREMENTS:
1. Include COMPLETE working solutions for all 4 languages
2. Solutions must handle I/O properly (read from stdin, write to stdout)
3. Include detailed approach and explanation
4. Provide time and space complexity analysis
5. Add at least 3-5 comprehensive test cases
6. Ensure starter code has proper main functions for execution
7. Make the problem description clear and unambiguous

Please create a coding problem following this exact format with all required fields populated.`;

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Copied to clipboard!');
    }).catch(() => {
      toast.error('Failed to copy to clipboard');
    });
  };

  return (
    <div className="coding-practice-admin">
      <div className="admin-header">
        <h2>🔧 Coding Practice Administration</h2>
        <div className="tab-buttons">
          <button 
            className={`tab-btn ${activeTab === 'problems' ? 'active' : ''}`}
            onClick={() => setActiveTab('problems')}
          >
            Problems ({problems.length})
          </button>
          <button 
            className={`tab-btn ${activeTab === 'groups' ? 'active' : ''}`}
            onClick={() => setActiveTab('groups')}
          >
            Groups ({groups.length})
          </button>
          <button 
            className={`tab-btn ${activeTab === 'student-stats' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('student-stats');
              fetchStudentStats();
            }}
          >
            Student Statistics ({studentStats.length})
          </button>
        </div>
      </div>

      {activeTab === 'problems' && (
        <div className="problems-tab">
          <div className="creation-methods">
            <div className="method-card">
              <h3>📝 {singleProblem._id ? 'Edit Problem' : 'Create Single Problem'}</h3>
              <form onSubmit={handleCreateProblem} className="single-problem-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Title:</label>
                    <input
                      type="text"
                      value={singleProblem.title}
                      onChange={(e) => setSingleProblem({...singleProblem, title: e.target.value})}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Difficulty:</label>
                    <select
                      value={singleProblem.difficulty}
                      onChange={(e) => setSingleProblem({...singleProblem, difficulty: e.target.value})}
                    >
                      <option value="Easy">Easy</option>
                      <option value="Medium">Medium</option>
                      <option value="Hard">Hard</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Description:</label>
                  <textarea
                    value={singleProblem.description}
                    onChange={(e) => setSingleProblem({...singleProblem, description: e.target.value})}
                    rows="4"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Constraints:</label>
                  <textarea
                    value={singleProblem.constraints}
                    onChange={(e) => setSingleProblem({...singleProblem, constraints: e.target.value})}
                    rows="2"
                    placeholder="e.g., 1 <= n <= 10^5"
                  />
                </div>

                <div className="form-group">
                  <label>Topics (comma-separated):</label>
                  <input
                    type="text"
                    value={singleProblem.topics?.join(', ') || ''}
                    placeholder="Array, Hash Table, Two Pointers"
                    onChange={(e) => setSingleProblem({
                      ...singleProblem, 
                      topics: e.target.value.split(',').map(t => t.trim()).filter(t => t)
                    })}
                  />
                </div>

                <div className="form-group">
                  <label>Companies (comma-separated):</label>
                  <input
                    type="text"
                    value={singleProblem.companies?.join(', ') || ''}
                    placeholder="Google, Amazon, Microsoft"
                    onChange={(e) => setSingleProblem({
                      ...singleProblem, 
                      companies: e.target.value.split(',').map(c => c.trim()).filter(c => c)
                    })}
                  />
                </div>

                {/* Examples Section */}
                <div className="form-section">
                  <h4>Examples</h4>
                  {singleProblem.examples?.map((example, index) => (
                    <div key={index} className="example-group">
                      <div className="example-header">
                        <span>Example {index + 1}</span>
                        <button 
                          type="button" 
                          onClick={() => {
                            const newExamples = singleProblem.examples.filter((_, i) => i !== index);
                            setSingleProblem({...singleProblem, examples: newExamples});
                          }}
                          className="remove-btn"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Input:</label>
                          <textarea
                            value={example.input}
                            onChange={(e) => {
                              const newExamples = [...singleProblem.examples];
                              newExamples[index].input = e.target.value;
                              setSingleProblem({...singleProblem, examples: newExamples});
                            }}
                            rows="2"
                          />
                        </div>
                        <div className="form-group">
                          <label>Output:</label>
                          <textarea
                            value={example.output}
                            onChange={(e) => {
                              const newExamples = [...singleProblem.examples];
                              newExamples[index].output = e.target.value;
                              setSingleProblem({...singleProblem, examples: newExamples});
                            }}
                            rows="2"
                          />
                        </div>
                      </div>
                      <div className="form-group">
                        <label>Explanation:</label>
                        <textarea
                          value={example.explanation}
                          onChange={(e) => {
                            const newExamples = [...singleProblem.examples];
                            newExamples[index].explanation = e.target.value;
                            setSingleProblem({...singleProblem, examples: newExamples});
                          }}
                          rows="2"
                        />
                      </div>
                    </div>
                  ))}
                  <button 
                    type="button" 
                    onClick={() => {
                      setSingleProblem({
                        ...singleProblem, 
                        examples: [...(singleProblem.examples || []), { input: '', output: '', explanation: '' }]
                      });
                    }}
                    className="add-btn"
                  >
                    Add Example
                  </button>
                </div>

                {/* Test Cases Section */}
                <div className="form-section">
                  <h4>Test Cases</h4>
                  {singleProblem.testCases?.map((testCase, index) => (
                    <div key={index} className="testcase-group">
                      <div className="testcase-header">
                        <span>Test Case {index + 1}</span>
                        <button 
                          type="button" 
                          onClick={() => {
                            const newTestCases = singleProblem.testCases.filter((_, i) => i !== index);
                            setSingleProblem({...singleProblem, testCases: newTestCases});
                          }}
                          className="remove-btn"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Input:</label>
                          <textarea
                            value={testCase.input}
                            onChange={(e) => {
                              const newTestCases = [...singleProblem.testCases];
                              newTestCases[index].input = e.target.value;
                              setSingleProblem({...singleProblem, testCases: newTestCases});
                            }}
                            rows="2"
                          />
                        </div>
                        <div className="form-group">
                          <label>Expected Output:</label>
                          <textarea
                            value={testCase.expectedOutput}
                            onChange={(e) => {
                              const newTestCases = [...singleProblem.testCases];
                              newTestCases[index].expectedOutput = e.target.value;
                              setSingleProblem({...singleProblem, testCases: newTestCases});
                            }}
                            rows="2"
                          />
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>
                            <input
                              type="checkbox"
                              checked={testCase.isHidden}
                              onChange={(e) => {
                                const newTestCases = [...singleProblem.testCases];
                                newTestCases[index].isHidden = e.target.checked;
                                setSingleProblem({...singleProblem, testCases: newTestCases});
                              }}
                            />
                            Hidden Test Case
                          </label>
                        </div>
                        <div className="form-group">
                          <label>Points:</label>
                          <input
                            type="number"
                            value={testCase.points}
                            onChange={(e) => {
                              const newTestCases = [...singleProblem.testCases];
                              newTestCases[index].points = parseInt(e.target.value);
                              setSingleProblem({...singleProblem, testCases: newTestCases});
                            }}
                            min="1"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  <button 
                    type="button" 
                    onClick={() => {
                      setSingleProblem({
                        ...singleProblem, 
                        testCases: [...(singleProblem.testCases || []), { input: '', expectedOutput: '', isHidden: false, points: 1 }]
                      });
                    }}
                    className="add-btn"
                  >
                    Add Test Case
                  </button>
                </div>

                {/* Starter Code Section */}
                <div className="form-section">
                  <h4>Starter Code</h4>
                  {['python', 'java', 'cpp', 'c'].map(lang => (
                    <div key={lang} className="form-group">
                      <label>{lang.toUpperCase()}:</label>
                      <textarea
                        value={singleProblem.starterCode[lang]}
                        onChange={(e) => setSingleProblem({
                          ...singleProblem, 
                          starterCode: {...singleProblem.starterCode, [lang]: e.target.value}
                        })}
                        rows="4"
                        placeholder={`Starter code for ${lang}`}
                      />
                    </div>
                  ))}
                </div>

                {/* Solution Section */}
                <div className="form-section">
                  <h4>Solution</h4>
                  <div className="form-group">
                    <label>Approach:</label>
                    <textarea
                      value={singleProblem.solution?.approach || ''}
                      onChange={(e) => setSingleProblem({
                        ...singleProblem, 
                        solution: {...(singleProblem.solution || {}), approach: e.target.value}
                      })}
                      rows="3"
                      placeholder="Describe the solution approach"
                    />
                  </div>
                  <div className="form-group">
                    <label>Explanation:</label>
                    <textarea
                      value={singleProblem.solution?.explanation || ''}
                      onChange={(e) => setSingleProblem({
                        ...singleProblem, 
                        solution: {...(singleProblem.solution || {}), explanation: e.target.value}
                      })}
                      rows="4"
                      placeholder="Detailed explanation of the solution"
                    />
                  </div>
                  {['python', 'java', 'cpp', 'c'].map(lang => (
                    <div key={lang} className="form-group">
                      <label>Solution Code ({lang.toUpperCase()}):</label>
                      <textarea
                        value={singleProblem.solution?.code?.[lang] || ''}
                        onChange={(e) => setSingleProblem({
                          ...singleProblem, 
                          solution: {
                            ...(singleProblem.solution || {}),
                            code: {...(singleProblem.solution?.code || {}), [lang]: e.target.value}
                          }
                        })}
                        rows="6"
                        placeholder={`Complete solution in ${lang}`}
                      />
                    </div>
                  ))}
                  <div className="form-row">
                    <div className="form-group">
                      <label>Time Complexity:</label>
                      <input
                        type="text"
                        value={singleProblem.solution?.timeComplexity || ''}
                        onChange={(e) => setSingleProblem({
                          ...singleProblem, 
                          solution: {...(singleProblem.solution || {}), timeComplexity: e.target.value}
                        })}
                        placeholder="e.g., O(n log n)"
                      />
                    </div>
                    <div className="form-group">
                      <label>Space Complexity:</label>
                      <input
                        type="text"
                        value={singleProblem.solution?.spaceComplexity || ''}
                        onChange={(e) => setSingleProblem({
                          ...singleProblem, 
                          solution: {...(singleProblem.solution || {}), spaceComplexity: e.target.value}
                        })}
                        placeholder="e.g., O(1)"
                      />
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label>Advanced JSON Editor (optional):</label>
                  <div style={{display:'flex', gap:'8px', marginBottom:'8px'}}>
                    <button type="button" className="copy-btn copy-sample" onClick={() => {
                      try {
                        setAdvancedProblemJson(JSON.stringify(singleProblem, null, 2));
                        setShowAdvancedEditor(true);
                        toast.info('Loaded current problem into JSON editor');
                      } catch {
                        toast.error('Failed to serialize problem');
                      }
                    }}>Export Current</button>
                    <button type="button" className="copy-btn copy-prompt" onClick={() => {
                      try {
                        const parsed = JSON.parse(advancedProblemJson);
                        setSingleProblem(parsed);
                        toast.success('Applied JSON to form');
                      } catch {
                        toast.error('Invalid JSON');
                      }
                    }}>Apply JSON</button>
                    <button type="button" className="copy-btn" onClick={() => setShowAdvancedEditor(v => !v)}>
                      {showAdvancedEditor ? 'Hide Editor' : 'Show Editor'}
                    </button>
                  </div>
                  {showAdvancedEditor && (
                    <textarea
                      className={`json-input ${jsonError ? 'error' : ''}`}
                      value={advancedProblemJson}
                      onChange={(e) => setAdvancedProblemJson(e.target.value)}
                      placeholder="Edit full problem JSON here to modify testCases, examples, starterCode, and solution"
                      rows="12"
                    />
                  )}
                </div>

                <button type="submit" className="create-btn" disabled={loading}>
                  {loading ? (singleProblem._id ? 'Saving...' : 'Creating...') : (singleProblem._id ? 'Save Changes' : 'Create Problem')}
                </button>
              </form>
            </div>

            <div className="method-card">
              <h3>📋 Bulk Create from JSON</h3>
              <div className="json-creator">
                <div className="json-help">
                  <div className="json-help-header">
                    <details>
                      <summary>📖 JSON Format Guide</summary>
                      <pre className="json-sample">
                        {JSON.stringify([sampleJsonFormat], null, 2)}
                      </pre>
                    </details>
                    <div className="copy-buttons">
                      <button 
                        className="copy-btn copy-sample"
                        onClick={() => copyToClipboard(JSON.stringify([sampleJsonFormat], null, 2))}
                        title="Copy sample JSON format"
                      >
                        📋 Copy Sample
                      </button>
                      <button 
                        className="copy-btn copy-prompt"
                        onClick={() => copyToClipboard(copyPromptTemplate)}
                        title="Copy AI prompt template for generating problems"
                      >
                        🤖 Copy AI Prompt
                      </button>
                    </div>
                  </div>
                </div>

                <textarea
                  className={`json-input ${jsonError ? 'error' : ''}`}
                  value={bulkProblemsJson}
                  onChange={(e) => setBulkProblemsJson(e.target.value)}
                  placeholder="Paste JSON array of problems here..."
                  rows="12"
                />
                {jsonError && <div className="error-message">{jsonError}</div>}

                <button 
                  onClick={handleBulkCreate} 
                  className="bulk-create-btn"
                  disabled={loading || !bulkProblemsJson.trim()}
                >
                  {loading ? 'Creating...' : 'Bulk Create Problems'}
                </button>
              </div>
            </div>
          </div>

          <div className="problems-list">
            <h3>📚 Existing Problems</h3>
            <div className="problems-grid">
              {problems.map(problem => (
                <div key={problem._id} className="problem-card">
                  <div className="problem-header">
                    <span className="problem-number">#{problem.problemNumber}</span>
                    <span className={`difficulty ${problem.difficulty?.toLowerCase() || 'easy'}`}>
                      {problem.difficulty || 'Easy'}
                    </span>
                  </div>
                  <h4>{problem.title}</h4>
                  <div className="problem-stats">
                    <span>✅ {problem.acceptedSubmissions || 0}</span>
                    <span>📊 {problem.totalSubmissions || 0}</span>
                    <span>📈 {problem.acceptanceRate?.toFixed(1) || 0}%</span>
                  </div>
                  <div className="problem-topics">
                    {problem.topics?.slice(0, 3).map(topic => (
                      <span key={topic} className="topic-tag">{topic}</span>
                    ))}
                  </div>
                  <div className="problem-actions">
                    <button 
                      className="action-btn edit-btn"
                      onClick={() => handleEditProblem(problem)}
                      title="Edit Problem"
                    >
                      ✏️ Edit
                    </button>
                    <button 
                      className="action-btn delete-btn"
                      onClick={() => handleDeleteProblem(problem._id)}
                      title="Delete Problem"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'groups' && (
        <div className="groups-tab">
          <div className="group-creation">
            <div className="method-card">
              <h3>🏫 Create Problem Group</h3>
              <form onSubmit={handleCreateGroup} className="group-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Group Name:</label>
                    <input
                      type="text"
                      value={newGroup.name}
                      onChange={(e) => setNewGroup({...newGroup, name: e.target.value})}
                      placeholder="e.g., Class 10, Class 11"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Difficulty Level:</label>
                    <select
                      value={newGroup.difficulty}
                      onChange={(e) => setNewGroup({...newGroup, difficulty: e.target.value})}
                    >
                      <option value="Beginner">Beginner</option>
                      <option value="Intermediate">Intermediate</option>
                      <option value="Advanced">Advanced</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Description:</label>
                  <textarea
                    value={newGroup.description}
                    onChange={(e) => setNewGroup({...newGroup, description: e.target.value})}
                    placeholder="Describe this problem group..."
                    rows="3"
                  />
                </div>

                <div className="form-group">
                  <label>Allowed Student Classes (comma-separated):</label>
                  <input
                    type="text"
                    placeholder="10, 11, 12 (empty = all classes)"
                    onChange={(e) => setNewGroup({
                      ...newGroup, 
                      allowedStudentClasses: e.target.value.split(',').map(c => c.trim()).filter(c => c)
                    })}
                  />
                </div>

                <button type="submit" className="create-btn" disabled={loading}>
                  {loading ? 'Creating...' : 'Create Group'}
                </button>
              </form>
            </div>
          </div>

          <div className="groups-management">
            <h3>📁 Existing Groups</h3>
            <div className="groups-list">
              {groups.map(group => (
                <div key={group._id} className="group-card">
                  <div className="group-header">
                    <h4>{group.name}</h4>
                    <span className={`group-difficulty ${group.difficulty.toLowerCase()}`}>
                      {group.difficulty}
                    </span>
                  </div>
                  <p>{group.description}</p>
                  <div className="group-stats">
                    <span>📚 {group.totalProblems} problems</span>
                    <span>🎓 Classes: {group.allowedStudentClasses.join(', ') || 'All'}</span>
                  </div>
                  <div className="group-actions">
                    <button 
                      className="manage-btn"
                      onClick={() => setSelectedGroup(group)}
                    >
                      📝 Manage Problems
                    </button>
                    <button 
                      className="edit-btn"
                      onClick={() => handleEditGroup(group)}
                      title="Edit group details"
                    >
                      ✏️ Edit
                    </button>
                    <button 
                      className="delete-btn"
                      onClick={() => handleDeleteGroup(group._id)}
                      title="Delete group"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {selectedGroup && (
            <div className="group-management-modal">
              <div className="modal-content">
                <div className="modal-header">
                  <h3>Manage Problems for {selectedGroup.name}</h3>
                  <button 
                    className="close-btn"
                    onClick={() => setSelectedGroup(null)}
                  >
                    ✕
                  </button>
                </div>
                
                <div className="modal-body">
                  <div className="search-bar">
                    <input
                      type="text"
                      placeholder="Search problems by title or topic..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>

                  <div className="problems-selection">
                    <h4>Available Problems</h4>
                    <div className="problems-checklist">
                      {filteredProblems.map(problem => {
                        const isInGroup = selectedGroup.problems?.some(p => p._id === problem._id);
                        return (
                          <div key={problem._id} className="problem-checkbox">
                            <input
                              type="checkbox"
                              id={`problem-${problem._id}`}
                              checked={isInGroup}
                              onChange={async (e) => {
                                const token = localStorage.getItem('token');
                                try {
                                  if (e.target.checked && !isInGroup) {
                                    await handleAddProblemsToGroup([problem._id]);
                                  } else if (!e.target.checked && isInGroup) {
                                    await axios.delete(`/api/coding-practice/admin/groups/${selectedGroup._id}/problems/${problem._id}`, {
                                      headers: { Authorization: `Bearer ${token}` }
                                    });
                                    toast.info('Problem removed from group');
                                    fetchGroups();
                                  }
                                } catch (err) {
                                  console.error('Error updating group problems:', err);
                                  toast.error('Failed to update group');
                                }
                              }}
                            />
                            <label htmlFor={`problem-${problem._id}`} className="problem-details-label">
                              <div className="problem-header">
                                <span className="problem-number">#{problem.problemNumber || 'N/A'}</span>
                                <span className="problem-title">{problem.title}</span>
                                <span className={`difficulty ${problem.difficulty?.toLowerCase() || 'easy'}`}>
                                  {problem.difficulty || 'Easy'}
                                </span>
                              </div>
                              <div className="problem-description">
                                {problem.description ? (
                                  <p className="description-text">
                                    {problem.description.length > 150 
                                      ? `${problem.description.substring(0, 150)}...` 
                                      : problem.description
                                    }
                                  </p>
                                ) : (
                                  <p className="no-description">No description available</p>
                                )}
                              </div>
                              {problem.topics && problem.topics.length > 0 && (
                                <div className="problem-topics">
                                  {problem.topics.slice(0, 3).map((topic, index) => (
                                    <span key={index} className="topic-tag">{topic}</span>
                                  ))}
                                  {problem.topics.length > 3 && <span className="more-topics">+{problem.topics.length - 3} more</span>}
                                </div>
                              )}
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {editingGroup && (
            <div className="group-management-modal">
              <div className="modal-content">
                <div className="modal-header">
                  <h3>Edit Group: {editingGroup.name}</h3>
                  <button 
                    className="close-btn"
                    onClick={() => setEditingGroup(null)}
                  >
                    ✕
                  </button>
                </div>
                
                <div className="modal-body">
                  <form onSubmit={handleUpdateGroup} className="edit-group-form">
                    <div className="form-group">
                      <label>Group Name:</label>
                      <input
                        type="text"
                        value={editGroupData.name}
                        onChange={(e) => setEditGroupData({...editGroupData, name: e.target.value})}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>Difficulty Level:</label>
                      <select
                        value={editGroupData.difficulty}
                        onChange={(e) => setEditGroupData({...editGroupData, difficulty: e.target.value})}
                      >
                        <option value="Beginner">Beginner</option>
                        <option value="Intermediate">Intermediate</option>
                        <option value="Advanced">Advanced</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Description:</label>
                      <textarea
                        value={editGroupData.description}
                        onChange={(e) => setEditGroupData({...editGroupData, description: e.target.value})}
                        placeholder="Describe this problem group..."
                        rows="3"
                      />
                    </div>

                    <div className="form-group">
                      <label>Allowed Student Classes (comma-separated):</label>
                      <input
                        type="text"
                        value={editGroupData.allowedStudentClasses.join(', ')}
                        placeholder="10, 11, 12 (empty = all classes)"
                        onChange={(e) => setEditGroupData({
                          ...editGroupData, 
                          allowedStudentClasses: e.target.value.split(',').map(c => c.trim()).filter(c => c)
                        })}
                      />
                    </div>

                    <div className="form-actions">
                      <button type="button" className="cancel-btn" onClick={() => setEditingGroup(null)}>
                        Cancel
                      </button>
                      <button type="submit" className="update-btn" disabled={loading}>
                        {loading ? 'Updating...' : 'Update Group'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'student-stats' && (
        <div className="student-stats-tab">
          <div className="stats-header">
            <h3>📊 Student Coding Practice Statistics</h3>
            <div className="stats-actions">
              <button 
                onClick={syncStudentData}
                className="sync-btn"
                disabled={syncLoading}
                title="Sync student data between main database and coding practice database"
              >
                {syncLoading ? '⏳ Syncing...' : '🔄 Sync Students'}
              </button>
              <button 
                onClick={fetchStudentStats}
                className="refresh-btn"
                disabled={statsLoading}
              >
                {statsLoading ? '⏳ Loading...' : '🔄 Refresh'}
              </button>
            </div>
          </div>

          {statsLoading ? (
            <div className="loading-spinner">
              <div className="spinner"></div>
              <p>Loading student statistics...</p>
            </div>
          ) : studentStats.length > 0 ? (
            <div className="stats-container">
              <div className="stats-summary">
                <div className="summary-card">
                  <h4>Total Students</h4>
                  <span className="big-number">{studentStats.length}</span>
                </div>
                <div className="summary-card">
                  <h4>Active Students</h4>
                  <span className="big-number">
                    {studentStats.filter(s => s.problemsSolved > 0).length}
                  </span>
                </div>
                <div className="summary-card">
                  <h4>Total Problems Solved</h4>
                  <span className="big-number">
                    {studentStats.reduce((sum, s) => sum + (Number(s.problemsSolved) || 0), 0)}
                  </span>
                </div>
                <div className="summary-card">
                  <h4>Total Submissions</h4>
                  <span className="big-number">
                    {studentStats.reduce((sum, s) => sum + s.totalSubmissions, 0)}
                  </span>
                </div>
              </div>

              <div className="rankings-table">
                <h4>🏆 Student Rankings</h4>
                <div className="table-responsive">
                  <table className="stats-table">
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Student</th>
                        <th>Email</th>
                        <th>Score</th>
                        <th>Problems Solved</th>
                        <th>Easy</th>
                        <th>Medium</th>
                        <th>Hard</th>
                        <th>Submissions</th>
                        <th>Accuracy</th>
                        <th>Languages</th>
                        <th>Last Activity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentStats.map((student) => (
                        <tr key={student.studentId}>
                          <td>
                            <span className={`rank-badge rank-${student.rank <= 3 ? student.rank : 'other'}`}>
                              #{student.rank}
                            </span>
                          </td>
                          <td className="student-name">{student.studentName}</td>
                          <td className="student-email">{student.email}</td>
                          <td>
                            <span className="score-badge">{student.totalScore}</span>
                          </td>
                          <td>
                            <span className="problems-solved">{student.problemsSolved}</span>
                          </td>
                          <td>
                            <span className="difficulty-count easy">{student.easyProblems}</span>
                          </td>
                          <td>
                            <span className="difficulty-count medium">{student.mediumProblems}</span>
                          </td>
                          <td>
                            <span className="difficulty-count hard">{student.hardProblems}</span>
                          </td>
                          <td>
                            <span className="submissions-count">
                              {student.totalSubmissions || 0}
                            </span>
                          </td>
                          <td>
                            {(() => {
                              const acc = Number(student.accuracyRate) || 0;
                              const cls = acc >= 70 ? 'high' : acc >= 50 ? 'medium' : 'low';
                              return (
                                <span className={`accuracy ${cls}`}>
                                  {acc.toFixed(1)}%
                                </span>
                              );
                            })()}
                          </td>
                          <td>
                            <div className="languages-used">
                              {student.languageStats && student.languageStats.map((lang) => (
                                <span key={lang._id} className="language-tag">
                                  {lang._id}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td>
                            <span className="last-activity">
                              {student.lastSolved ? 
                                new Date(student.lastSolved).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric'
                                }) : 
                                'No activity'
                              }
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="no-data">
              <div className="no-data-icon">📈</div>
              <h3>No Student Data Available</h3>
              <p>This could mean:</p>
              <ul style={{textAlign: 'left', maxWidth: '300px', margin: '0 auto'}}>
                <li>No students have started coding practice yet</li>
                <li>Database connection issues</li>
                <li>Students haven't made any submissions</li>
              </ul>
              <button 
                className="refresh-btn" 
                onClick={fetchStudentStats}
                style={{marginTop: '15px'}}
              >
                🔄 Retry Loading
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CodingPracticeAdmin;
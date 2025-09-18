import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Editor from '@monaco-editor/react';
import { toast } from 'react-toastify';
import CodeSnippetToolbar from './CodeSnippetToolbar';
import './CodingInterface.css';

// AI Doubt Solver Component
// const DoubtSolver = ({ problem, code, language, onClose }) => {
//   const [query, setQuery] = useState('');
//   const [response, setResponse] = useState('');
//   const [loading, setLoading] = useState(false);
//   const [doubtHistory, setDoubtHistory] = useState([]);

//   useEffect(() => {
//     fetchDoubtHistory();
//   }, []);

//   const fetchDoubtHistory = async () => {
//     try {
//       const token = localStorage.getItem('token');
//       const response = await axios.get(`/api/coding-practice/problems/${problem._id}/doubts`, {
//         headers: { Authorization: `Bearer ${token}` }
//       });
//       setDoubtHistory(response.data.doubts || []);
//     } catch (error) {
//       console.error('Error fetching doubt history:', error);
//     }
//   };

//   const askGemini = async () => {
//     if (!query.trim()) return;

//     setLoading(true);
//     try {
//       const token = localStorage.getItem('token');
//       const response = await axios.post('/api/coding-practice/ask-gemini', {
//         problemId: problem._id,
//         problemDescription: problem.description,
//         studentCode: code,
//         language: language,
//         query: query.trim()
//       }, {
//         headers: { Authorization: `Bearer ${token}` }
//       });

//       setResponse(response.data.response);
//       setDoubtHistory([response.data.doubt, ...doubtHistory]);
//       setQuery('');
//     } catch (error) {
//       console.error('Error asking Gemini:', error);
//       setResponse('Sorry, I encountered an error. Please try again.');
//     } finally {
//       setLoading(false);
//     }
//   };

//   const formatDate = (dateString) => {
//     const date = new Date(dateString);
//     return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
//   };

//   return (
//     <div className="doubt-solver-overlay">
//       <div className="doubt-solver-modal">
//         <div className="doubt-solver-header">
//           <div className="doubt-solver-title">
//             <span className="ai-icon">🤖</span>
//             AI Doubt Solver
//           </div>
//           <button className="close-btn" onClick={onClose}>×</button>
//         </div>
        
//         <div className="doubt-solver-content">
//           <div className="doubt-input-section">
//             <textarea
//               value={query}
//               onChange={(e) => setQuery(e.target.value)}
//               placeholder="Ask me anything about this problem... I have access to the problem description and your current code."
//               className="doubt-textarea"
//               rows="4"
//             />
//             <button 
//               onClick={askGemini}
//               disabled={loading || !query.trim()}
//               className="ask-btn"
//             >
//               {loading ? 'Thinking...' : 'Ask AI'}
//             </button>
//           </div>

//           {response && (
//             <div className="ai-response">
//               <div className="response-header">
//                 <span className="ai-icon">🤖</span>
//                 AI Response
//               </div>
//               <div className="response-content" dangerouslySetInnerHTML={{__html: response.replace(/\n/g, '<br>')}} />
//             </div>
//           )}

//           <div className="doubt-history">
//             <h4>Previous Questions</h4>
//             {doubtHistory.length === 0 ? (
//               <p className="no-history">No previous questions yet.</p>
//             ) : (
//               <div className="history-list">
//                 {doubtHistory.slice(0, 5).map((doubt, index) => (
//                   <div key={index} className="history-item">
//                     <div className="history-question">
//                       <strong>Q:</strong> {doubt.query}
//                     </div>
//                     <div className="history-answer">
//                       <strong>A:</strong> {doubt.response.substring(0, 200)}...
//                     </div>
//                     <div className="history-date">{formatDate(doubt.createdAt)}</div>
//                   </div>
//                 ))}
//               </div>
//             )}
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// AI Response Formatter
const formatAIResponse = (response) => {
  const lines = response.split('\n');
  const formattedContent = [];
  let currentCodeBlock = [];
  let inCodeBlock = false;
  let listItems = [];
  let inList = false;

  lines.forEach((line, index) => {
    const trimmedLine = line.trim();
    
    // Handle code blocks
    if (trimmedLine.startsWith('```') || trimmedLine.includes('```')) {
      if (inCodeBlock) {
        // End code block
        formattedContent.push(
          <pre key={`code-${index}`} className="ai-code-block">
            <code>{currentCodeBlock.join('\n')}</code>
          </pre>
        );
        currentCodeBlock = [];
        inCodeBlock = false;
      } else {
        // Start code block
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      currentCodeBlock.push(line);
      return;
    }

    // Handle inline code
    if (trimmedLine.includes('`') && !inCodeBlock) {
      const parts = line.split(/(`[^`]+`)/g);
      const processedLine = parts.map((part, partIndex) => {
        if (part.startsWith('`') && part.endsWith('`')) {
          return <code key={partIndex} className="ai-inline-code">{part.slice(1, -1)}</code>;
        }
        return part;
      });
      formattedContent.push(<p key={index} className="ai-text">{processedLine}</p>);
      return;
    }

    // Handle lists
    if (trimmedLine.match(/^[\-\*\+]\s+/) || trimmedLine.match(/^\d+\.\s+/)) {
      if (!inList) {
        inList = true;
        listItems = [];
      }
      const listContent = trimmedLine.replace(/^[\-\*\+\d\.]\s*/, '');
      listItems.push(<li key={`list-${index}`} className="ai-list-item">{listContent}</li>);
      return;
    } else if (inList && trimmedLine === '') {
      // End of list
      formattedContent.push(
        <ul key={`list-container-${index}`} className="ai-list">
          {listItems}
        </ul>
      );
      listItems = [];
      inList = false;
      return;
    }

    // Handle headers
    if (trimmedLine.startsWith('#')) {
      const level = trimmedLine.match(/^#+/)[0].length;
      const text = trimmedLine.replace(/^#+\s*/, '');
      const HeaderTag = `h${Math.min(level + 2, 6)}`;
      formattedContent.push(
        React.createElement(HeaderTag, {
          key: index,
          className: `ai-header ai-h${level}`
        }, text)
      );
      return;
    }

    // Handle bold text
    if (trimmedLine.includes('**')) {
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      const processedLine = parts.map((part, partIndex) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={partIndex} className="ai-bold">{part.slice(2, -2)}</strong>;
        }
        return part;
      });
      formattedContent.push(<p key={index} className="ai-text">{processedLine}</p>);
      return;
    }

    // Regular paragraphs
    if (trimmedLine) {
      formattedContent.push(<p key={index} className="ai-text">{line}</p>);
    } else {
      formattedContent.push(<div key={index} className="ai-spacer"></div>);
    }
  });

  // Handle any remaining list items
  if (inList && listItems.length > 0) {
    formattedContent.push(
      <ul key="final-list" className="ai-list">
        {listItems}
      </ul>
    );
  }

  return formattedContent;
};

// AI Doubt Solver Component
const DoubtSolver = ({ problem, code, language, onClose }) => {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [doubts, setDoubts] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    fetchDoubtHistory();
  }, []);

  const fetchDoubtHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/coding-practice/problems/${problem._id}/doubts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDoubts(response.data.doubts || []);
    } catch (error) {
      console.error('Error fetching doubt history:', error);
    }
  };

  const askAI = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setResponse('');

    try {
      const token = localStorage.getItem('token');
      const apiResponse = await axios.post('/api/coding-practice/ask-gemini', {
        problemId: problem._id,
        problemDescription: problem.description,
        studentCode: code,
        language,
        query: query.trim()
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setResponse(apiResponse.data.response);
      setDoubts([apiResponse.data.doubt, ...doubts]);
      setQuery('');
    } catch (error) {
      console.error('Error asking AI:', error);
      setResponse(error.response?.data?.message || 'Failed to get AI response. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  };

  return (
    <div className="doubt-solver-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="doubt-solver-modal">
        <div className="doubt-solver-header">
          <div className="doubt-solver-title">
            <span className="ai-icon">🤖</span>
            AI Problem Solver
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="doubt-solver-content">
          <div className="doubt-input-section">
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask me anything about this problem! For example:
- I'm getting a runtime error, can you help?
- How do I optimize this solution?
- What's the best approach for this problem?
- Can you explain the algorithm needed here?"
              className="doubt-textarea"
            />
            <button 
              onClick={askAI}
              disabled={loading || !query.trim()}
              className="ask-btn"
            >
              {loading ? 'Thinking...' : 'Ask AI'}
            </button>
          </div>

          {response && (
            <div className="ai-response">
              <div className="response-header">
                <span>🤖</span>
                AI Assistant
                <button 
                  className="copy-response-btn"
                  onClick={() => navigator.clipboard.writeText(response)}
                  title="Copy response"
                >
                  📋
                </button>
              </div>
              <div className="response-content">
                {formatAIResponse(response)}
              </div>
            </div>
          )}

          <div className="doubt-history">
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <h4>Previous Questions ({doubts.length})</h4>
              <button 
                className="sort-btn"
                onClick={() => setShowHistory(!showHistory)}
              >
                {showHistory ? 'Hide' : 'Show'} History
              </button>
            </div>
            
            {showHistory && (
              <div className="history-list">
                {doubts.length === 0 ? (
                  <div className="no-history">No previous questions yet.</div>
                ) : (
                  doubts.slice(0, 10).map((doubt) => (
                    <div key={doubt._id} className="history-item">
                      <div className="history-question"><strong>Q:</strong> {doubt.query}</div>
                      <div className="history-answer"><strong>A:</strong> {doubt.response.substring(0, 200)}...</div>
                      <div className="history-date">{formatDate(doubt.createdAt)}</div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Discussion Tab Component (GeeksforGeeks Style)
const DiscussionTab = ({ problemId }) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sortBy, setSortBy] = useState('newest');
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyContent, setReplyContent] = useState('');

  useEffect(() => {
    fetchComments();
  }, [problemId]);

  const fetchComments = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/coding-practice/problems/${problemId}/comments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setComments(response.data.comments || []);
    } catch (error) {
      console.error('Error fetching comments:', error);
      setComments([]);
    } finally {
      setLoading(false);
    }
  };

  const submitComment = async () => {
    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`/api/coding-practice/problems/${problemId}/comments`, {
        content: newComment.trim()
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setComments([response.data.comment, ...comments]);
      setNewComment('');
    } catch (error) {
      console.error('Error submitting comment:', error);
      alert('Failed to submit comment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 30) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';
  };

  const handleVote = async (commentId, voteType) => {
    try {
      const token = localStorage.getItem('token');
      
      // Optimistic update
      setComments(prevComments => 
        prevComments.map(comment => {
          if (comment._id === commentId) {
            const newComment = { ...comment };
            
            // Remove user from both arrays first
            let newUpvotes = comment.upvoteCount || 0;
            let newDownvotes = comment.downvoteCount || 0;
            
            if (comment.userVote === 'upvote') newUpvotes--;
            if (comment.userVote === 'downvote') newDownvotes--;
            
            // Add to new vote type if different from current
            if (voteType === 'upvote' && comment.userVote !== 'upvote') {
              newUpvotes++;
              newComment.userVote = 'upvote';
            } else if (voteType === 'downvote' && comment.userVote !== 'downvote') {
              newDownvotes++;
              newComment.userVote = 'downvote';
            } else {
              newComment.userVote = null; // Toggle off
            }
            
            newComment.upvoteCount = Math.max(0, newUpvotes);
            newComment.downvoteCount = Math.max(0, newDownvotes);
            
            return newComment;
          }
          return comment;
        })
      );

      const response = await axios.post(`/api/coding-practice/comments/${commentId}/vote`, {
        type: voteType
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        // Confirm with server response
        setComments(prevComments => 
          prevComments.map(comment => 
            comment._id === commentId ? {
              ...comment,
              upvoteCount: response.data.upvotes,
              downvoteCount: response.data.downvotes,
              userVote: response.data.userVote
            } : comment
          )
        );
      }
    } catch (error) {
      console.error('Error voting:', error);
      // Revert optimistic update by refetching comments
      fetchComments();
      alert('Failed to vote. Please try again.');
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/coding-practice/comments/${commentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setComments(comments.filter(comment => comment._id !== commentId));
    } catch (error) {
      console.error('Error deleting comment:', error);
      alert('Failed to delete comment. Please try again.');
    }
  };

  const handleReply = async (commentId, replyContent) => {
    if (!replyContent.trim()) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`/api/coding-practice/comments/${commentId}/reply`, {
        content: replyContent.trim()
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Update the comment with new reply
      setComments(comments.map(comment => 
        comment._id === commentId 
          ? { ...comment, replies: [...(comment.replies || []), response.data.reply] }
          : comment
      ));
    } catch (error) {
      console.error('Error posting reply:', error);
      alert('Failed to post reply. Please try again.');
    }
  };

  const sortedComments = [...comments].sort((a, b) => {
    if (sortBy === 'newest') return new Date(b.createdAt) - new Date(a.createdAt);
    return new Date(a.createdAt) - new Date(b.createdAt);
  });

  if (loading) {
    return <div className="discussion-loading">Loading discussion...</div>;
  }

  return (
    <div className="discussion-content">
      <div className="discussion-header">
        <div className="discussion-title">Discussion ({comments.length})</div>
        <div className="discussion-stats">
          <span>{comments.length} comments</span>
        </div>
      </div>

      <div className="comment-form">
        <div className="comment-form-header">
          <div className="user-avatar">
            {getInitials('You')}
          </div>
          <div className="comment-form-title">Add your comment</div>
        </div>
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Share your approach, ask questions, or help others understand the solution..."
          className="comment-textarea"
        />
        <div className="comment-form-actions">
          <div className="comment-guidelines">
            Be respectful and constructive in your comments
          </div>
          <button 
            onClick={submitComment}
            disabled={submitting || !newComment.trim()}
            className="comment-submit-btn"
          >
            {submitting ? 'Posting...' : 'Post Comment'}
          </button>
        </div>
      </div>

      {comments.length > 0 && (
        <div className="comments-section">
          <div className="comments-header">
            <div className="comments-count">{comments.length} Comments</div>
            <div className="sort-options">
              <button 
                className={`sort-btn ${sortBy === 'newest' ? 'active' : ''}`}
                onClick={() => setSortBy('newest')}
              >
                Newest
              </button>
              <button 
                className={`sort-btn ${sortBy === 'oldest' ? 'active' : ''}`}
                onClick={() => setSortBy('oldest')}
              >
                Oldest
              </button>
            </div>
          </div>
          
          <div className="comments-list">
            {sortedComments.map((comment) => (
              <div key={comment._id} className="comment">
                <div className="comment-header">
                  <div className="comment-avatar">
                    {getInitials(comment.author.name)}
                  </div>
                  <div className="comment-meta">
                    <span className="comment-author">{comment.author.name}</span>
                    <div className="comment-date">{formatDate(comment.createdAt)}</div>
                  </div>
                  <div className="comment-actions">
                    <button 
                      className="comment-action-btn"
                      onClick={() => setReplyingTo(replyingTo === comment._id ? null : comment._id)}
                    >
                      Reply
                    </button>
                    {comment.isOwner && (
                      <button 
                        className="comment-action-btn delete-btn"
                        onClick={() => handleDeleteComment(comment._id)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
                <div className="comment-content">
                  {comment.content}
                </div>
                <div className="comment-footer">
                  <div className="comment-votes">
                    <button 
                      className={`vote-btn ${comment.userVote === 'upvote' ? 'active upvote' : ''}`}
                      onClick={() => handleVote(comment._id, comment.userVote === 'upvote' ? null : 'upvote')}
                    >
                      <span>👍</span> {comment.upvoteCount || 0}
                    </button>
                    <button 
                      className={`vote-btn ${comment.userVote === 'downvote' ? 'active downvote' : ''}`}
                      onClick={() => handleVote(comment._id, comment.userVote === 'downvote' ? null : 'downvote')}
                    >
                      <span>👎</span> {comment.downvoteCount || 0}
                    </button>
                  </div>
                </div>
                
                {/* Replies */}
                {comment.replies && comment.replies.length > 0 && (
                  <div className="comment-replies">
                    {comment.replies.map((reply, index) => (
                      <div key={index} className="reply">
                        <div className="reply-header">
                          <div className="reply-avatar">
                            {getInitials(reply.author.name)}
                          </div>
                          <div className="reply-meta">
                            <span className="reply-author">{reply.author.name}</span>
                            <div className="reply-date">{formatDate(reply.createdAt)}</div>
                          </div>
                        </div>
                        <div className="reply-content">
                          {reply.content}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Reply Form */}
                {replyingTo === comment._id && (
                  <div className="reply-form">
                    <textarea
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      placeholder="Write your reply..."
                      className="reply-textarea"
                    />
                    <div className="reply-form-actions">
                      <button 
                        onClick={() => {
                          setReplyingTo(null);
                          setReplyContent('');
                        }}
                        className="reply-cancel-btn"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={() => {
                          handleReply(comment._id, replyContent);
                          setReplyContent('');
                          setReplyingTo(null);
                        }}
                        disabled={!replyContent.trim()}
                        className="reply-submit-btn"
                      >
                        Reply
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {comments.length === 0 && (
        <div className="no-comments">
          <h3>Start the Discussion!</h3>
          <p>Be the first to share your thoughts, approach, or ask questions about this problem.</p>
        </div>
      )}
    </div>
  );
};

const CodingInterface = () => {
  const { problemId } = useParams();
  const navigate = useNavigate();
  
  const onBack = () => {
    navigate('/student/coding-practice');
  };
  const [problem, setProblem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('python');
  const [runOutput, setRunOutput] = useState('');
  const [submitOutput, setSubmitOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [testResults, setTestResults] = useState(null);
  const [activeTab, setActiveTab] = useState('description');
  const [fontSize, setFontSize] = useState(14);
  const [showDoubtSolver, setShowDoubtSolver] = useState(false);
  
  // AI Button dragging state
  const [aiButtonPosition, setAiButtonPosition] = useState({ x: 20, y: 20 });
  const [isDraggingAI, setIsDraggingAI] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const aiButtonRef = useRef(null);
  const [headerVisible, setHeaderVisible] = useState(false);
  const [hasSolved, setHasSolved] = useState(false);
  const [lastSubmittedCode, setLastSubmittedCode] = useState('');
  const [isRunResults, setIsRunResults] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(50); // Percentage
  const [isResizing, setIsResizing] = useState(false);
  
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const editorRef = useRef(null);
  const containerRef = useRef(null);

  // Language configurations
  const languageConfig = {
    python: {
      monaco: 'python',
      extension: 'py',
      defaultCode: `from typing import List

def solution(nums: List[int], target: int) -> List[int]:
    """
    Solve the problem here
    
    Args:
        nums: List of integers
        target: Target integer value
    
    Returns:
        List of integers as result
    """
    # Write your solution here
    # Example: Two Sum problem
    # for i in range(len(nums)):
    #     for j in range(i + 1, len(nums)):
    #         if nums[i] + nums[j] == target:
    #             return [i, j]
    return []

def main():
    """
    Main function for testing your solution
    """
    # Test cases - modify these for your problem
    test_cases = [
        {"nums": [2, 7, 11, 15], "target": 9, "expected": [0, 1]},
        {"nums": [3, 2, 4], "target": 6, "expected": [1, 2]},
        {"nums": [3, 3], "target": 6, "expected": [0, 1]}
    ]
    
    for i, test in enumerate(test_cases):
        result = solution(test["nums"], test["target"])
        print(f"Test {i + 1}: {result} (Expected: {test['expected']})")
        print("✓ PASS" if result == test["expected"] else "✗ FAIL")
        print()

if __name__ == "__main__":
    main()`
    },
    java: {
      monaco: 'java',
      extension: 'java',
      defaultCode: `import java.util.*;

public class Solution {
    
    /**
     * Solve the problem here
     * 
     * @param nums Array of integers
     * @param target Target integer value
     * @return Array of integers as result
     */
    public int[] twoSum(int[] nums, int target) {
        // Write your solution here
        // Example: Two Sum problem
        // Map<Integer, Integer> map = new HashMap<>();
        // for (int i = 0; i < nums.length; i++) {
        //     int complement = target - nums[i];
        //     if (map.containsKey(complement)) {
        //         return new int[]{map.get(complement), i};
        //     }
        //     map.put(nums[i], i);
        // }
        return new int[]{};
    }
    
    public static void main(String[] args) {
        Solution solution = new Solution();
        
        // Test cases - modify these for your problem
        int[][] testNums = {
            {2, 7, 11, 15},
            {3, 2, 4},
            {3, 3}
        };
        int[] testTargets = {9, 6, 6};
        int[][] expected = {{0, 1}, {1, 2}, {0, 1}};
        
        for (int i = 0; i < testNums.length; i++) {
            int[] result = solution.twoSum(testNums[i], testTargets[i]);
            System.out.printf("Test %d: %s (Expected: %s)%n", 
                i + 1, Arrays.toString(result), Arrays.toString(expected[i]));
            boolean pass = Arrays.equals(result, expected[i]);
            System.out.println(pass ? "✓ PASS" : "✗ FAIL");
            System.out.println();
        }
    }
}`
    },
    cpp: {
      monaco: 'cpp',
      extension: 'cpp',
      defaultCode: `#include <iostream>
#include <vector>
#include <string>
#include <sstream>
#include <map>
using namespace std;

/*
 * Solve the problem here
 * 
 * Note: C++ doesn't have built-in JSON parsing
 * For simplicity, this template shows basic input/output
 * Modify input parsing based on problem requirements
 */
string solution(const vector<int>& nums, int target) {
    // Write your solution here
    
    // Example: Two Sum problem
    // for (int i = 0; i < nums.size(); i++) {
    //     for (int j = i + 1; j < nums.size(); j++) {
    //         if (nums[i] + nums[j] == target) {
    //             return "[" + to_string(i) + "," + to_string(j) + "]";
    //         }
    //     }
    // }
    
    return "result";
}

int main() {
    // Example input parsing
    // Modify based on problem input format
    
    vector<int> nums = {2, 7, 11, 15};
    int target = 9;
    
    // For actual submission, parse from stdin:
    // string line;
    // getline(cin, line);
    // Parse the input format as needed
    
    string result = solution(nums, target);
    cout << result << endl;
    
    return 0;
}`
    },
    c: {
      monaco: 'c',
      extension: 'c',
      defaultCode: `#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/*
 * Solve the problem here
 * 
 * Note: C doesn't have built-in JSON parsing
 * This template shows basic input/output structure
 * Modify input parsing based on problem requirements
 */
char* solution(int* nums, int numsSize, int target) {
    // Write your solution here
    
    // Example: Two Sum problem
    // for (int i = 0; i < numsSize; i++) {
    //     for (int j = i + 1; j < numsSize; j++) {
    //         if (nums[i] + nums[j] == target) {
    //             char* result = malloc(20);
    //             sprintf(result, "[%d,%d]", i, j);
    //             return result;
    //         }
    //     }
    // }
    
    char* result = malloc(10);
    strcpy(result, "result");
    return result;
}

int main() {
    // Example input
    int nums[] = {2, 7, 11, 15};
    int numsSize = 4;
    int target = 9;
    
    // For actual submission, parse from stdin:
    // char line[1000];
    // fgets(line, sizeof(line), stdin);
    // Parse the input format as needed
    
    char* result = solution(nums, numsSize, target);
    printf("%s\\n", result);
    
    free(result);
    return 0;
}`
    }
  };

  useEffect(() => {
    fetchProblem();
    startTimer();
    
    // Add keyboard shortcuts
    const handleKeyDown = (event) => {
      if (event.ctrlKey && event.key === "'") {
        event.preventDefault();
        runCode();
      } else if (event.ctrlKey && event.key === 'Enter') {
        event.preventDefault();
        submitCode();
      } else if (event.key === 'F11') {
        event.preventDefault();
        setHeaderVisible(!headerVisible);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [problemId]);

  useEffect(() => {
    if (problem && problem.starterCode && problem.starterCode[language]) {
      setCode(problem.starterCode[language]);
    } else {
      setCode(languageConfig[language].defaultCode);
    }
  }, [language, problem]);

  // Keyboard shortcuts: Ctrl+' for run, Ctrl+Enter for submit
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Ctrl+' for run (also handle key code for single quote)
      if (event.ctrlKey && (event.key === "'" || event.code === "Quote")) {
        event.preventDefault();
        if (!loading && code.trim()) {
          runCode();
        }
      }
      // Ctrl+Enter for submit
      else if (event.ctrlKey && event.key === 'Enter') {
        event.preventDefault();
        if (!loading && code.trim()) {
          submitCode();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [code, loading]);

  // Handle panel resizing
  const handleMouseDown = (e) => {
    setIsResizing(true);
    e.preventDefault();
  };

  const handleMouseMove = (e) => {
    if (!isResizing || !containerRef.current) return;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
    
    // Constrain between 20% and 80%
    const constrainedWidth = Math.min(Math.max(newWidth, 20), 80);
    setLeftPanelWidth(constrainedWidth);
  };

  const handleMouseUp = () => {
    setIsResizing(false);
  };

  // Add global mouse events for resizing
  React.useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  const fetchProblem = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/coding-practice/student/problems/${problemId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
  console.log('Problem API Response:', response.data); // Debug log
  setProblem(response.data.problem); // Fixed: access nested problem object
      
      // Set initial code based on problem starter code or default
      const initialCode = response.data.problem.starterCode?.[language] || languageConfig[language].defaultCode;
      setCode(initialCode);

      // Preload latest submission results (show earlier submission under Submit Results)
      const latest = (response.data.submissions || [])[0];
      if (latest) {
        setTestResults(latest);
        setLastSubmittedCode(latest.code || '');
      } else {
        setLastSubmittedCode('');
      }
      // Mark as solved if any previous submission was Accepted
      // Prefer explicit hasSolved from API; fallback to compute from submissions
      const solved = response.data.hasSolved !== undefined
        ? !!response.data.hasSolved
        : (response.data.submissions || []).some(s => s.status === 'Accepted');
      setHasSolved(solved);
    } catch (error) {
      console.error('Error fetching problem:', error);
    } finally {
      setLoading(false);
    }
  };

  const startTimer = () => {
    startTimeRef.current = Date.now();
    setTimerActive(true);
    timerRef.current = setInterval(() => {
      setTimeElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const runCode = async () => {
    if (!code.trim()) {
      setRunOutput('Please write some code first.');
      setActiveTab('output');
      return;
    }

    setIsRunning(true);
    setRunOutput('Running...');
    setTestResults(null);
    setActiveTab('output');

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`/api/coding-practice/student/problems/${problemId}/run`, {
        code,
        language
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Handle run output in LeetCode style
      if (response.data.result && response.data.result.testResults) {
        setTestResults(response.data.result);
        setIsRunResults(true);
        setActiveTab('submit'); // Switch to submit tab to show test results
        
        // Create LeetCode-style run output
        const testResults = response.data.result.testResults;
        const firstFailed = testResults.find(test => !test.passed);
        
        if (firstFailed) {
          const output = `Wrong Answer\n\nInput:\n${firstFailed.input}\n\nOutput:\n${firstFailed.actualOutput}\n\nExpected:\n${firstFailed.expectedOutput}`;
          setRunOutput(output);
        } else {
          setRunOutput(`Accepted\n\nAll sample test cases passed!`);
        }
      } else {
        setRunOutput(response.data.output || 'Code executed successfully (no output)');
      }
    } catch (error) {
      console.error('Run code error:', error);
      setRunOutput(error.response?.data?.message || error.response?.data?.error || 'Execution failed');
    } finally {
      setIsRunning(false);
    }
  };

  const submitCode = async () => {
    if (!code.trim()) {
      setSubmitOutput('Please write some code first.');
      setActiveTab('submit');
      return;
    }

    setIsSubmitting(true);
    setSubmitOutput('Submitting...');
    setActiveTab('submit');

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`/api/coding-practice/student/problems/${problemId}/submit`, {
        code,
        language,
        timeSpent: timeElapsed
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setTestResults(response.data.submission);
      setIsRunResults(false); // Mark as submit results (show all test cases)
      const statusMsg = response.data.submission.status === 'Accepted' 
        ? `✅ ${response.data.message} (${response.data.submission.passedTestCases}/${response.data.submission.totalTestCases} passed)`
        : `❌ ${response.data.submission.status} (${response.data.submission.passedTestCases}/${response.data.submission.totalTestCases} passed)`;
      setSubmitOutput(statusMsg);
      
      // Stop timer on successful submission and unlock solution
      if (response.data.submission.status === 'Accepted') {
        setTimerActive(false);
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
        setHasSolved(true);
      }
    } catch (error) {
      console.error('Submit code error:', error);
      setSubmitOutput(error.response?.data?.message || error.response?.data?.error || 'Submission failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // AI Button drag handlers
  const handleAIMouseDown = (e) => {
    if (e.target.closest('.ai-text') || e.target.closest('.ai-icon')) {
      setIsDraggingAI(true);
      const rect = aiButtonRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
      e.preventDefault();
    }
  };

  const handleAIMouseMove = (e) => {
    if (isDraggingAI) {
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;
      
      // Keep within viewport bounds
      const maxX = window.innerWidth - 120; // button width
      const maxY = window.innerHeight - 50; // button height
      
      setAiButtonPosition({
        x: Math.max(0, Math.min(maxX, newX)),
        y: Math.max(0, Math.min(maxY, newY))
      });
    }
  };

  const handleAIMouseUp = () => {
    setIsDraggingAI(false);
  };

  // Add global mouse events for AI dragging
  useEffect(() => {
    if (isDraggingAI) {
      document.addEventListener('mousemove', handleAIMouseMove);
      document.addEventListener('mouseup', handleAIMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleAIMouseMove);
        document.removeEventListener('mouseup', handleAIMouseUp);
      };
    }
  }, [isDraggingAI, dragOffset]);

  const resetCode = () => {
    const defaultCode = problem?.starterCode?.[language] || languageConfig[language].defaultCode;
    setCode(defaultCode);
    setRunOutput('');
    setSubmitOutput('');
    setTestResults(null);
    setActiveTab('description');
  };

  const handleLanguageChange = (newLanguage) => {
    setLanguage(newLanguage);
    setRunOutput('');
    setSubmitOutput('');
    setTestResults(null);
  };

  if (loading) {
    return (
      <div className="coding-interface-loading">
        <div className="loading-spinner"></div>
        <p>Loading problem...</p>
      </div>
    );
  }

  if (!problem) {
    return (
      <div className="coding-interface-error">
        <h2>Problem not found</h2>
        <button onClick={onBack} className="back-btn">Go Back</button>
      </div>
    );
  }

  // Restore last submitted code
  const handleRestoreLastCode = () => {
    if (lastSubmittedCode) {
      setCode(lastSubmittedCode);
      toast.success('Restored last submitted code!');
    } else {
      toast.info('No previous submission found.');
    }
  };

  return (
    <div className="coding-interface coding-interface-headerless">
      {/* No header - maximized coding space */}
      
      {/* Floating Back Button */}
      <button onClick={onBack} className="floating-back-btn" title="Back to Problems">
        ← Back
      </button>
      
      {/* Floating Timer */}
      <div className="floating-timer" title="Time Elapsed">
        <span className="timer-icon">⏱️</span>
        <span className="timer-text">{formatTime(timeElapsed)}</span>
      </div>

      <div className="coding-body" ref={containerRef}>
        {/* Left Panel - Problem Description */}
        <div className="left-panel" style={{ width: `${leftPanelWidth}%` }}>
          <div className="panel-tabs">
            <button 
              className={`tab ${activeTab === 'description' ? 'active' : ''}`}
              onClick={() => setActiveTab('description')}
            >
              Description
            </button>
            <button 
              className={`tab ${activeTab === 'output' ? 'active' : ''}`}
              onClick={() => setActiveTab('output')}
            >
              Run Output
            </button>
            <button 
              className={`tab ${activeTab === 'submit' ? 'active' : ''}`}
              onClick={() => setActiveTab('submit')}
            >
              Submit Results
            </button>
            <button 
              className={`tab ${activeTab === 'solution' ? 'active' : ''}`}
              onClick={() => setActiveTab('solution')}
            >
              Solution
            </button>
            <button 
              className={`tab ${activeTab === 'discussion' ? 'active' : ''}`}
              onClick={() => setActiveTab('discussion')}
            >
              Discussion
            </button>
          </div>

          <div className="panel-content">
            {activeTab === 'description' && (
              <div className="problem-description">
                {/* Professional Problem Header */}
                <div className="problem-header">
                  <div className="problem-title">
                    <h1>{problem.problemNumber}. {problem.title}</h1>
                    <div className="problem-metadata">
                      <span className={`difficulty-badge ${problem.difficulty?.toLowerCase()}`}>
                        {problem.difficulty}
                      </span>
                      <span className="acceptance-rate">
                        Acceptance: {problem.acceptanceRate?.toFixed(1) || 0}%
                      </span>
                      {hasSolved && (
                        <span className="solved-badge">
                          ✅ Solved
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="description-content">
                  {problem.description ? (
                    <div dangerouslySetInnerHTML={{__html: problem.description.replace(/\n/g, '<br>')}} />
                  ) : (
                    <p style={{color: '#ff5252'}}>
                      <strong>Problem description not available.</strong>
                      <br />
                      Please contact admin or check backend data for this problem.
                    </p>
                  )}

                  {problem.examples && problem.examples.length > 0 && (
                    <div className="examples">
                      <h4>Examples:</h4>
                      {problem.examples.map((example, index) => (
                        <div key={index} className="example">
                          <strong>Example {index + 1}:</strong>
                          <pre className="example-code">
                            <div><strong>Input:</strong> {example.input}</div>
                            <div><strong>Output:</strong> {example.output}</div>
                            {example.explanation && (
                              <div><strong>Explanation:</strong> {example.explanation}</div>
                            )}
                          </pre>
                        </div>
                      ))}
                    </div>
                  )}

                  {problem.constraints && (
                    <div className="constraints">
                      <h4>Constraints:</h4>
                      {Array.isArray(problem.constraints) ? (
                        <ul>
                          {problem.constraints.map((constraint, index) => (
                            <li key={index}>{constraint}</li>
                          ))}
                        </ul>
                      ) : (
                        <p>{problem.constraints}</p>
                      )}
                    </div>
                  )}

                  {problem.topics && problem.topics.length > 0 && (
                    <div className="topics">
                      <h4>Topics:</h4>
                      <div className="topic-tags">
                        {problem.topics.map((topic, index) => (
                          <span key={index} className="topic-tag">{topic}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {problem.companies && problem.companies.length > 0 && (
                    <div className="companies">
                      <h4>Companies:</h4>
                      <div className="company-tags">
                        {problem.companies.map((company, index) => (
                          <span key={index} className="company-tag">{company}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'output' && (
              <div className="output-panel">
                <h4>Run Output</h4>
                <pre className="output-content">{runOutput || 'Click "Run" to test your code with sample inputs.'}</pre>
              </div>
            )}

            {activeTab === 'submit' && (
              <div className="submit-panel">
                <h4>Submission Results</h4>
                {testResults ? (
                  <div className="test-results">
                    <div className={`result-summary ${testResults.status === 'Accepted' ? 'success' : 'failed'}`}>
                      <div className="status-icon">
                        {testResults.status === 'Accepted' ? '✅' : '❌'}
                      </div>
                      <div className="status-text">
                        <h3>{testResults.status}</h3>
                        <p>{testResults.passedTestCases}/{testResults.totalTestCases} test cases passed</p>
                      </div>
                    </div>
                    
                    <div className="test-stats">
                      <div className="stat-item">
                        <span className="stat-label">Score</span>
                        <span className="stat-value">{testResults.score}/{testResults.maxScore} ({testResults.percentage.toFixed(1)}%)</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">Execution Time</span>
                        <span className="stat-value">{testResults.executionTime?.toFixed(2) || 0}ms</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">Total Time</span>
                        <span className="stat-value">{formatTime(timeElapsed)}</span>
                      </div>
                    </div>

                    {testResults.submittedCode && (
                      <div className="submitted-code-section">
                        <h5>Your Submitted Code ({language}):</h5>
                        <div className="submitted-code-container">
                          <pre className="submitted-code">
                            <code>{testResults.submittedCode}</code>
                          </pre>
                        </div>
                      </div>
                    )}
                    
                    {testResults.status === 'Accepted' && (
                      <div className="success-message">
                        <p>🎉 Congratulations! You've successfully solved this problem!</p>
                        <p>Check the "Solution" tab to see the official solution and approach.</p>
                      </div>
                    )}
                    
                    {/* Detailed test case results */}
                    <div className="detailed-results">
                      <div className="test-cases-header">
                        <h5>Test Case Details:</h5>
                        {isRunResults && testResults.testCaseResults?.length > 2 && (
                          <div className="test-cases-info">
                            <span className="info-icon">ℹ️</span>
                            Showing first 2 test cases. Submit to see all {testResults.testCaseResults.length} test cases.
                          </div>
                        )}
                      </div>
                      <div className="test-cases-grid">
                        {(isRunResults ? testResults.testCaseResults?.slice(0, 2) : testResults.testCaseResults)?.map((testCase, index) => (
                          <div key={index} className={`test-case ${testCase.passed ? 'passed' : 'failed'}`}>
                            <div className="test-case-header">
                              <div className="test-case-title">
                                <span className="test-status-icon">
                                  {testCase.passed ? '✅' : '❌'}
                                </span>
                                <span className="test-case-name">Test Case {testCase.testCaseNumber || index + 1}</span>
                              </div>
                              <span className="test-execution-time">
                                {testCase.executionTime?.toFixed(2) || 0}ms
                              </span>
                            </div>
                            <div className="test-case-details">
                              <div className="test-detail-section">
                                <div className="test-detail-label">Input</div>
                                <div className="test-detail-content">
                                  {testCase.input || 'No input provided'}
                                </div>
                              </div>
                              <div className="test-detail-section">
                                <div className="test-detail-label">Expected Output</div>
                                <div className="test-detail-content success">
                                  {testCase.expectedOutput || 'No expected output'}
                                </div>
                              </div>
                              <div className="test-detail-section">
                                <div className="test-detail-label">Your Output</div>
                                <div className={`test-detail-content ${testCase.passed ? 'success' : 'mismatch'}`}>
                                  {testCase.actualOutput || 'No output generated'}
                                </div>
                              </div>
                              {testCase.stderr && (
                                <div className="test-detail-section">
                                  <div className="test-detail-label">Error</div>
                                  <div className="test-detail-content error">
                                    {testCase.stderr}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="no-results">
                    <p>{submitOutput || 'Click "Submit" to run all test cases and get your final score.'}</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'solution' && (
              <div className="solution-panel">
                <h4>Official Solution</h4>
                {!hasSolved ? (
                  <div className="solution-locked">
                    <p>🔒 The official solution is locked. Solve the problem to unlock the solution.</p>
                    <p>Tip: You can use the Discussion tab to get hints from others.</p>
                  </div>
                ) : problem.solution ? (
                  <div className="solution-content">
                    <div className="solution-approach">
                      <h5>Approach:</h5>
                      <div dangerouslySetInnerHTML={{__html: problem.solution.approach?.replace(/\n/g, '<br>') || 'No approach description available.'}} />
                    </div>
                    
                    {problem.solution.code && (
                      <div className="solution-code">
                        <h5>Solution Code ({language}):</h5>
                        {problem.solution.code[language] || problem.solution.code.python ? (
                          <pre className="solution-code-block">
                            <code>{problem.solution.code[language] || problem.solution.code.python}</code>
                          </pre>
                        ) : (
                          <p>Solution code is not available for this language.</p>
                        )}
                      </div>
                    )}
                    
                    <div className="complexity-analysis">
                      <h5>Complexity Analysis:</h5>
                      <p><strong>Time Complexity:</strong> {problem.solution.timeComplexity || 'Not specified'}</p>
                      <p><strong>Space Complexity:</strong> {problem.solution.spaceComplexity || 'Not specified'}</p>
                    </div>
                  </div>
                ) : (
                  <p>Official solution is not available for this problem yet.</p>
                )}
              </div>
            )}

            {activeTab === 'discussion' && (
              <div className="discussion-panel">
                <h4>Discussion</h4>
                <DiscussionTab problemId={problemId} />
              </div>
            )}
          </div>
        </div>

        {/* Resizer Handle */}
        <div 
          className={`panel-resizer ${isResizing ? 'resizing' : ''}`}
          onMouseDown={handleMouseDown}
        >
          <div className="resizer-line"></div>
        </div>

        {/* Right Panel - Code Editor */}
        <div className="right-panel" style={{ width: `${100 - leftPanelWidth}%` }}>
          <div className="editor-header">
            <button 
              onClick={handleRestoreLastCode} 
              className="restore-btn" 
              style={{marginRight: 12, padding: '8px', minWidth: '40px'}}
              title="Restore Last Submitted Code"
            >
              ♻️
            </button>
            <div className="language-selector">
              <label>Language:</label>
              <select value={language} onChange={(e) => handleLanguageChange(e.target.value)}>
                <option value="python">Python</option>
                <option value="java">Java</option>
                <option value="cpp">C++</option>
                <option value="c">C</option>
              </select>
            </div>
            {hasSolved && (
              <div title="You have solved this problem before" style={{
                color: '#22c55e',
                fontWeight: 700
              }}>
                ✅ Solved
              </div>
            )}
            <button onClick={resetCode} className="reset-btn">
              🔄 Reset
            </button>
          </div>

          <CodeSnippetToolbar 
            language={language} 
            editor={editorRef.current}
            onInsertSnippet={(snippet) => {
              console.log('Inserted snippet:', snippet);
            }}
          />

          <div className="editor-container">
            <Editor
              height="100%"
              language={languageConfig[language].monaco}
              value={code}
              onChange={setCode}
              onMount={(editor) => {
                editorRef.current = editor;
              }}
              theme="vs-dark"
              options={{
                fontSize: fontSize,
                minimap: { enabled: false },
                wordWrap: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                insertSpaces: true
              }}
            />
          </div>

          <div className="editor-actions">
            <button 
              onClick={runCode} 
              disabled={isRunning}
              className="run-btn"
              title="Run Code (Ctrl+')"
            >
              {isRunning ? 'Running...' : '▶️ Run (Ctrl+\')'}
            </button>
            <button 
              onClick={submitCode} 
              disabled={isSubmitting}
              className="submit-btn"
              title="Submit Code (Ctrl+Enter)"
            >
              {isSubmitting ? 'Submitting...' : '🚀 Submit (Ctrl+Enter)'}
            </button>
          </div>

          {/* Professional Status Console */}
          <div className="status-console">
            <div className="console-header">
              <span className="console-title">Console</span>
              <div className="console-info">
                <span>Lang: {language.toUpperCase()}</span>
                <span>•</span>
                <span>Lines: {code.split('\n').length}</span>
                <span>•</span>
                <span>Chars: {code.length}</span>
              </div>
            </div>
            <div className="console-content">
              {isRunning && <div className="console-message running">🔄 Running code...</div>}
              {isSubmitting && <div className="console-message submitting">📤 Submitting solution...</div>}
              {!isRunning && !isSubmitting && (
                <div className="console-message ready">✅ Ready to run • Press Ctrl+' to run, Ctrl+Enter to submit</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Floating AI Doubt Solver Button */}
      <button 
        ref={aiButtonRef}
        className={`floating-ai-btn ${isDraggingAI ? 'dragging' : ''}`}
        style={{
          position: 'fixed',
          left: `${aiButtonPosition.x}px`,
          top: `${aiButtonPosition.y}px`,
          zIndex: 1001
        }}
        onClick={(e) => {
          if (!isDraggingAI) {
            setShowDoubtSolver(true);
          }
        }}
        onMouseDown={handleAIMouseDown}
        title="Ask AI for help (Drag to move)"
      >
        <span className="ai-icon">🤖</span>
        <span className="ai-text">Ask AI</span>
      </button>

      {/* AI Doubt Solver Modal */}
      {showDoubtSolver && (
        <DoubtSolver 
          problem={problem}
          code={code}
          language={language}
          onClose={() => setShowDoubtSolver(false)}
        />
      )}
    </div>
  );
};

export default CodingInterface;
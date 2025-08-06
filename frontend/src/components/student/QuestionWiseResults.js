// src/components/student/QuestionWiseResults.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate }       from 'react-router-dom';
import { useAuth }                      from '../../App';
import axios                            from 'axios';
import LoadingSpinner                   from '../LoadingSpinner';
import { toast }                        from 'react-toastify';
import { enhanceEmbedUrl }              from '../../utils/googleDriveUtils';

export default function QuestionWiseResults() {
  const { resultId } = useParams();
  const { user }     = useAuth();
  const navigate     = useNavigate();

  const [result, setResult] = useState(null);
  const [test,   setTest]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [showAnswerKey, setShowAnswerKey] = useState(false);

  // In src/components/student/QuestionWiseResults.jsx

// ... (imports and other component code remain the same)

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // ✅ UPDATED: Call the same consolidated endpoint
        const { data } = await axios.get(
          `/api/student/results/${resultId}`
        );
        if (!data.success) {
          throw new Error(data.message || 'Failed to load result');
        }
        
        // ✅ UPDATED: Set state from the new, consistent data structure
        setResult(data.result);
        setTest(data.test);

      } catch (err) {
        console.error(err);
        setError(err.response?.data?.message || 'Failed to load result details');
        toast.error('Could not load detailed results');
      } finally {
        setLoading(false);
      }
    })();
  }, [resultId]);

// ... (the rest of the component code will now function correctly)

  if (loading) {
    return <LoadingSpinner text="Loading detailed results..." />;
  }
  if (error || !result || !test) {
    return (
      <div className="result-error">
        <h2>❌ {error || 'Results Not Found'}</h2>
        <button className="btn btn-primary" onClick={() => navigate('/student')}>
          Return to Dashboard
        </button>
      </div>
    );
  }

  // Calculate percentage and grade
  const pct = test.totalMarks
    ? (result.marksObtained / test.totalMarks) * 100
    : 0;
  const pctDisplay = `${pct.toFixed(1)}%`;
  const gradeInfo = (() => {
    if (pct >= 90) return { grade: 'A+', color: '#059669' };
    if (pct >= 80) return { grade: 'A',  color: '#0891b2' };
    if (pct >= 70) return { grade: 'B+', color: '#7c3aed' };
    if (pct >= 60) return { grade: 'B',  color: '#dc2626' };
    if (pct >= 50) return { grade: 'C',  color: '#ea580c' };
    return { grade: 'F',    color: '#991b1b' };
  })();

  // Determine status display
  const isPublished = result.status === 'published';
  const isReviewed  = result.status === 'reviewed';

  return (
    <div className="question-wise-results">
      <button className="btn btn-link" onClick={() => navigate('/student')}>
        ← Back to Dashboard
      </button>
      <h1>{test.title}</h1>

      {/* Summary Card */}
      <div className="result-summary-card">
        <div className="summary-stats">
          <div className="stat-item">
            <div className="stat-value">
              {result.marksObtained != null ? result.marksObtained : 'Pending'}
            </div>
            <div className="stat-label">Marks Obtained</div>
          </div>

          <div className="stat-item">
            <div className="stat-value">{test.totalMarks}</div>
            <div className="stat-label">Total Marks</div>
          </div>

          <div className="stat-item">
            <div className="stat-value">{pctDisplay}</div>
            <div className="stat-label">Percentage</div>
          </div>

          <div className="stat-item">
            <div
              className="stat-value"
              style={{ color: gradeInfo.color }}
            >
              {gradeInfo.grade}
            </div>
            <div className="stat-label">Grade</div>
          </div>
        </div>

        <div className="summary-details">
          <div className="detail-row">
            <span>Result Status:</span>
            <span className="status">
              {isPublished
                ? '✅ Final'
                : isReviewed
                ? '🔍 Reviewed'
                : '⏳ Under Review'}
            </span>
            {isPublished && (
              <button
                className="btn btn-sm btn-outline"
                onClick={() => navigate(`/student/request-review/${result._id}`)}
              >
                Request Review
              </button>
            )}
          </div>

          {result.adminComments && (
            <div className="detail-row">
              <span>Comments:</span>
              <span className="comments">{result.adminComments}</span>
            </div>
          )}

          <div className="detail-row">
            <span>Taken On:</span>
            <span>{new Date(result.submittedAt).toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Question-by-Question Breakdown */}
      <h2>Question-wise Marks</h2>
      <table className="breakdown-table">
        <thead>
          <tr>
            <th>Q No.</th>
            <th>Max Marks</th>
            <th>Obtained</th>
            <th>Remarks</th>
          </tr>
        </thead>
        <tbody>
          {result.questionWiseMarks.map((q, idx) => (
            <tr key={idx}>
              <td>{q.questionNo}</td>
              <td>{q.maxMarks}</td>
              <td>{q.obtainedMarks}</td>
              <td>{q.remarks || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Answer Key Viewer */}
      {test.answerKeyURL && (
        <div className="answer-key-section">
          <button
            className="btn btn-sm"
            onClick={() => setShowAnswerKey(v => !v)}
          >
            {showAnswerKey ? 'Hide' : 'View'} Answer Key
          </button>
          {showAnswerKey && (
            <div style={{ position: 'relative' }}>
              <iframe
                src={enhanceEmbedUrl(test.answerKeyURL)}
                title="Answer Key"
                width="100%"
                height="600"
                style={{ border: '1px solid #ccc', marginTop: '1rem' }}
                sandbox="allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox"
                scrolling="yes"
                referrerPolicy="no-referrer-when-downgrade"
                allow="fullscreen"
                onError={() => {
                  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                  if (isMobile) {
                    console.warn('Mobile device detected - Answer Key iframe may be blocked');
                  }
                }}
              />
              <div style={{
                position: 'absolute',
                top: 15,
                right: 10,
                zIndex: 10
              }}>
                <button
                  style={{
                    padding: '4px 8px',
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                  onClick={() => window.open(test.answerKeyURL, '_blank', 'noopener,noreferrer')}
                >
                  📄 Open in Tab
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import LoadingSpinner from '../LoadingSpinner'; // It's good practice to have a loading state
import styles from './ReviewRequestPage.module.css';

export default function ReviewRequestPage() {
  const { resultId } = useParams();
  const navigate = useNavigate();

  // ✅ State to hold the actual question data from the result
  const [questions, setQuestions] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [comments, setComments] = useState('');
  const [loading, setLoading] = useState(true); // Add loading state

  // ✅ Updated data fetching logic
  useEffect(() => {
    const loadResultDetails = async () => {
      setLoading(true);
      try {
        // Use the correct, consolidated endpoint
        const { data } = await axios.get(
          `/api/student/results/${resultId}`
        );
        
        // Use the questionWiseMarks array from the result as the source of truth
        if (data.success && data.result?.questionWiseMarks) {
          setQuestions(data.result.questionWiseMarks);
        } else {
          throw new Error(data.message || 'Result data is incomplete or not found.');
        }
      } catch (err) {
        toast.error(err.message || 'Failed to load result details.');
        setQuestions([]); // Ensure questions is an empty array on error
      } finally {
        setLoading(false);
      }
    };

    loadResultDetails();
  }, [resultId]);

  const toggle = (qNo) => {
    setSelected((s) => {
      const next = new Set(s);
      next.has(qNo) ? next.delete(qNo) : next.add(qNo);
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selected.size === 0) {
      toast.error('Please select at least one question to send for review.');
      return;
    }
    if (!comments.trim()) {
        toast.error('Please provide a reason or comment for your review request.');
        return;
    }

    try {
      await axios.post(`/api/student/results/${resultId}/request-review`, {
        questionNumbers: [...selected],
        comments,
      });
      toast.success('Your review request has been submitted successfully!');
      navigate('/student/results'); // Navigate to the results list
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit request.');
    }
  };

  if (loading) {
    return <LoadingSpinner text="Loading result questions..." />;
  }

  return (
    <main className={styles.container}>
      <div className={styles.requestReview}>
        <header className={styles.header}>
            <button onClick={() => navigate(-1)} className={styles.backButton}>
             ← Back
            </button>
            <h2>Request a Re-evaluation</h2>
        </header>
        <p className={styles.instructions}>
          If you believe there was an error in grading, please select the specific questions you would like reviewed and provide a clear reason in the comments section.
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.qGrid}>
            <label id="q-grid-label" className={styles.gridLabel}>Select Question(s) for Review:</label>

            <div className={styles.gridContainer} role="group" aria-labelledby="q-grid-label">
                {questions.length > 0 ? (
                    questions.map((q) => (
                        <label key={q.questionNo} className={styles.checkboxLabel}>
                        <input
                            type="checkbox"
                            checked={selected.has(q.questionNo)}
                            onChange={() => toggle(q.questionNo)}
                        />
                        <span>Question {q.questionNo}</span>
                        </label>
                    ))
                ) : (
                    <p>No questions found in this result to review.</p>
                )}
            </div>
          </div>

          <div className={styles.commentBlock}>
            <label htmlFor="comments-textarea">Reason for Review Request</label>
            <textarea
              id="comments-textarea"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Please provide a clear and concise reason for your review request..."
              required
              rows="5"
            />
          </div>

          <button 
            type="submit" 
            className={styles.submitBtn} 
            disabled={selected.size === 0 || !comments.trim()}
          >
            Submit Review Request
          </button>
        </form>
      </div>
    </main>
  );
}
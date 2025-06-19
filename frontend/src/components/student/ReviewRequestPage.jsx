import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';

import styles from './ReviewRequestPage.module.css';   // ⬅️  CSS-module

export default function ReviewRequestPage() {
  const { resultId }  = useParams();
  const navigate      = useNavigate();

  const [count, setCount]       = useState(0);
  const [selected, setSelected] = useState(new Set());
  const [comments, setComments] = useState('');

  /* ─── original logic (unchanged) ─────────────────────────── */
  useEffect(() => {
    async function loadTest() {
      try {
        const { data } = await axios.get(
          `/api/student/result/${resultId}/detailed`
        );
        setCount(data.test.questionsCount);
      } catch {
        toast.error('Failed to load test info');
      }
    }
    loadTest();
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
      toast.error('Select at least one question');
      return;
    }
    try {
      await axios.post(`/api/student/results/${resultId}/request-review`, {
        questionNumbers: [...selected],
        comments,
      });
      toast.success('Review requested');
      navigate('/student');
    } catch {
      toast.error('Failed to submit request');
    }
  };

  /* ─── render ─────────────────────────────────────────────── */
  return (
    <div className={styles.requestReview}>
      <h2>Request a Review</h2>

      <form onSubmit={handleSubmit}>

        {/* comment textarea */}
        <div className={styles.commentBlock}>
          <label>Comments</label>
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            required
          />
        </div>

        {/* question check-boxes */}
        <div className={styles.qGrid}>
          <p>Select question(s):</p>

          {[...Array(count)].map((_, idx) => {
            const qNo = idx + 1;
            return (
              <label key={qNo}>
                <input
                  type="checkbox"
                  checked={selected.has(qNo)}
                  onChange={() => toggle(qNo)}
                />
                Q{qNo}
              </label>
            );
          })}
        </div>

        <button type="submit" className={styles.submitBtn}>
          Submit Review Request
        </button>
      </form>
    </div>
  );
}

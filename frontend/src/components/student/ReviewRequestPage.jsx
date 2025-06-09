import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';

export default function ReviewRequestPage() {
  const { resultId } = useParams();
  const navigate = useNavigate();

  const [count, setCount]       = useState(0);
  const [selected, setSelected] = useState(new Set());
  const [comments, setComments] = useState('');

  useEffect(() => {
    async function loadTest() {
      try {
        const { data } = await axios.get(`/api/student/result/${resultId}/detailed`);
        setCount(data.test.questionsCount);
      } catch {
        toast.error('Failed to load test info');
      }
    }
    loadTest();
  }, [resultId]);

  const toggle = qNo => {
    setSelected(s => {
      const next = new Set(s);
      next.has(qNo) ? next.delete(qNo) : next.add(qNo);
      return next;
    });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (selected.size === 0) {
      toast.error('Select at least one question');
      return;
    }
    try {
      await axios.post(`/api/student/results/${resultId}/request-review`, {
        questionNumbers: [...selected],
        comments
      });
      toast.success('Review requested');
      navigate('/student');
    } catch {
      toast.error('Failed to submit request');
    }
  };

  return (
    <div className="request-review">
      <h2>Request a Review</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Comments</label><br/>
          <textarea
            value={comments}
            onChange={e => setComments(e.target.value)}
            required
          />
        </div>
        <div>
          <p>Select question(s):</p>
          {[...Array(count)].map((_, i) => (
            <label key={i+1}>
              <input
                type="checkbox"
                checked={selected.has(i+1)}
                onChange={() => toggle(i+1)}
              />
              Q{i+1}
            </label>
          ))}
        </div>
        <button type="submit" className="btn btn-primary">
          Submit Review Request
        </button>
      </form>
    </div>
  );
}

// src/components/admin/AnswerSheetReview.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import LoadingSpinner from '../LoadingSpinner';
import './AnswerSheetReview.css';

export default function AnswerSheetReview() {
  const [results, setResults]           = useState([]);
  const [selectedResult, setSelectedResult] = useState(null);
  const [loading, setLoading]           = useState(false);
  const [questionMarks, setQuestionMarks]   = useState({});
  const [adminComments, setAdminComments]   = useState('');
  const [currentQuestion, setCurrentQuestion] = useState(1);
  const [searchTerm, setSearchTerm]      = useState('');

  // 1) Load pending results
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await axios.get('/api/admin/results-for-review');
        setResults(data.results || []);
      } catch {
        toast.error('Failed to fetch results');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 2) Select a result and init questionMarks
  const handleSelectResult = (r) => {
    setSelectedResult(r);
    setAdminComments(r.adminComments || '');
    setCurrentQuestion(1);

    const totalMarks = r.testId.totalMarks || 0;
    const qCount     = r.testId.questionsCount || 0;
    const perQuestion = totalMarks / Math.max(qCount, 1);

    // Initialize each question’s max/obtained/remarks
    const init = {};
    for (let i = 1; i <= qCount; i++) {
      const existing = r.questionWiseMarks?.find(q => q.questionNo === i);
      init[i] = {
        maxMarks:       existing?.maxMarks ?? perQuestion,
        obtainedMarks:  existing?.obtainedMarks ?? 0,
        remarks:        existing?.remarks ?? ''
      };
    }
    setQuestionMarks(init);
  };

  // 3) Clamp and update marks
  const handleQuestionMarkChange = (qNo, field, value) => {
    setQuestionMarks(prev => {
      const updated = { ...prev };
      const totalMarks = selectedResult?.testId?.totalMarks || 0;

      if (field === 'maxMarks') {
        // 3a) Sum of all other maxMarks
        const sumOther = Object.entries(prev)
          .filter(([key]) => +key !== qNo)
          .reduce((sum, [, qm]) => sum + qm.maxMarks, 0);

        // 3b) Compute how much we can allocate to this question
        const allowed = Math.max(0, totalMarks - sumOther);

        // 3c) Clamp input to [0, allowed]
        let numVal = parseFloat(value) || 0;
        numVal = Math.min(Math.max(0, numVal), allowed);

        updated[qNo] = {
          ...updated[qNo],
          maxMarks: numVal,
          // also clamp obtainedMarks if it exceeds new maxMarks
          obtainedMarks: Math.min(updated[qNo].obtainedMarks, numVal)
        };
      }
      else if (field === 'obtainedMarks') {
        // Clamp obtainedMarks to [0, maxMarks]
        const max = prev[qNo].maxMarks;
        let numVal = parseFloat(value) || 0;
        numVal = Math.min(Math.max(0, numVal), max);
        updated[qNo] = { ...updated[qNo], obtainedMarks: numVal };
      }
      else {
        // Remarks
        updated[qNo] = { ...updated[qNo], remarks: value };
      }

      return updated;
    });
  };

  // 4) Compute total obtained marks
  const calculateTotal = () =>
    Object.values(questionMarks).reduce((sum, q) => sum + q.obtainedMarks, 0);

  // 5) Save & approve marks
  const handleUpdateMarks = async () => {
    if (!selectedResult) return;
    setLoading(true);
    try {
      const totalObtained = calculateTotal();
      const denom         = selectedResult.testId.totalMarks || 1;
      const percentage    = +((totalObtained / denom) * 100).toFixed(2);

      const payload = {
        questionWiseMarks: Object.entries(questionMarks).map(([no, qm]) => ({
          questionNo:   +no,
          maxMarks:     qm.maxMarks,
          obtainedMarks:qm.obtainedMarks,
          remarks:      qm.remarks
        })),
        marksObtained: totalObtained,
        percentage,
        adminComments,
        marksApproved: true
      };

      const { data } = await axios.patch(
        `/api/admin/results/${selectedResult._id}/marks`,
        payload,
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );

      if (data.success) {
        toast.success('Marks saved!');
        setSelectedResult(null);
        const { data: fresh } = await axios.get('/api/admin/results-for-review');
        setResults(fresh.results || []);
      } else {
        throw new Error(data.message);
      }
    } catch {
      toast.error('Failed to update marks');
    } finally {
      setLoading(false);
    }
  };

  // Spinner when loading list
  if (loading && !selectedResult) {
    return <LoadingSpinner text="Loading…" />;
  }

  // Filter results by student or test
  const filtered = results.filter(r => {
    const name  = r.studentId?.name?.toLowerCase() || '';
    const title = r.testId?.title?.toLowerCase() || '';
    const term  = searchTerm.toLowerCase();
    return name.includes(term) || title.includes(term);
  });

  return (
    <div className="answer-sheet-review">
      <h2>Answer Sheet Review</h2>
      <div className="two-pane">
        {/* Left: results list */}
        <div className="search">
          <input
            type="text"
            placeholder="Search by student or test…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="results-list">
          {filtered.map(r => r.testId && (
            <div
              key={r._id}
              className={`item ${selectedResult?._id === r._id ? 'active' : ''}`}
              onClick={() => handleSelectResult(r)}
            >
              <strong>{r.testId.title}</strong>
              <div>{r.studentId.name}</div>
              <div className={`status ${r.marksApproved ? 'ok' : 'pending'}`}>
                {r.marksApproved ? 'Reviewed' : 'Pending'}
              </div>
            </div>
          ))}
        </div>

        {/* Right: marking panel */}
        {selectedResult && (
          <div className="marking-panel">
            <button className="btn btn-link" onClick={() => setSelectedResult(null)}>
              ← Back
            </button>
            <h3>{selectedResult.testId.title}</h3>
            <p>Total Marks: {selectedResult.testId.totalMarks}</p>

            {/* Question navigation */}
            <div className="nav">
              <button
                disabled={currentQuestion === 1}
                onClick={() => setCurrentQuestion(q => q - 1)}
              >←</button>
              Question {currentQuestion} of {selectedResult.testId.questionsCount}
              <button
                disabled={currentQuestion === selectedResult.testId.questionsCount}
                onClick={() => setCurrentQuestion(q => q + 1)}
              >→</button>
            </div>

            {/* Marking fields */}
            <div className="marking-fields">
              {/* Max Marks input */}
              {(() => {
                const totalMarks = selectedResult.testId.totalMarks || 0;
                const sumOther   = Object.entries(questionMarks)
                  .filter(([k]) => +k !== currentQuestion)
                  .reduce((s, [, qm]) => s + qm.maxMarks, 0);
                // cannot exceed totalMarks nor push sum > totalMarks
                const allowedMax = Math.max(0, totalMarks - sumOther);

                return (
                  <label>
                    Max marks:
                    <input
                      type="number"
                      min={0}
                      max={allowedMax}            // UI clamp
                      value={questionMarks[currentQuestion]?.maxMarks || 0}
                      onChange={e =>
                        handleQuestionMarkChange(
                          currentQuestion,
                          'maxMarks',
                          e.target.value
                        )
                      }
                    />
                    / {allowedMax}
                  </label>
                );
              })()}

              {/* Obtained Marks input */}
              <label>
                Obtained:
                <input
                  type="number"
                  min={0}
                  max={questionMarks[currentQuestion]?.maxMarks || 0}
                  value={questionMarks[currentQuestion]?.obtainedMarks || 0}
                  onChange={e =>
                    handleQuestionMarkChange(
                      currentQuestion,
                      'obtainedMarks',
                      e.target.value
                    )
                  }
                />
              </label>

              {/* Remarks */}
              <label>
                Remarks:
                <textarea
                  value={questionMarks[currentQuestion]?.remarks || ''}
                  onChange={e =>
                    handleQuestionMarkChange(
                      currentQuestion,
                      'remarks',
                      e.target.value
                    )
                  }
                />
              </label>
            </div>

            {/* Admin Comments */}
            <div>
              <h4>Comments</h4>
              <textarea
                value={adminComments}
                onChange={e => setAdminComments(e.target.value)}
              />
            </div>

            {/* Footer: total, percentage & save */}
            <footer>
              {(() => {
                const totalObtained = calculateTotal();
                const denom         = selectedResult.testId.totalMarks || 1;
                const pct           = ((totalObtained / denom) * 100).toFixed(1);
                return (
                  <strong>
                    Total: {totalObtained}/{denom} ({pct}%)
                  </strong>
                );
              })()}
              <button
                className="btn btn-primary"
                onClick={handleUpdateMarks}
                disabled={loading}
              >
                {loading ? 'Saving…' : 'Save & Approve'}
              </button>
            </footer>
          </div>
        )}
      </div>
    </div>
  );
}

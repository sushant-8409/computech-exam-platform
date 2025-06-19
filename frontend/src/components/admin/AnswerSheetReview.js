// AnswerSheetReview.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import styles from './AnswerSheetReview.module.css';

const authHeader = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
});

export default function AnswerSheetReview() {
  /* ---------- state ---------- */
  const [rows,     setRows]   = useState([]);
  const [current,  setCurr]   = useState(null);     // selected row
  const [qIndex,   setIdx]    = useState(1);        // pointer to question
  const [marks,    setMarks]  = useState({});       // editable map
  const [comment,  setCmt]    = useState('');
  const [search,   setSrch]   = useState('');
  const [busy,     setBusy]   = useState(false);

  /* ---------- fetch list on mount ---------- */
  useEffect(() => { fetchList(); }, []);

  const fetchList = async () => {
    try {
      setBusy(true);
      const { data } = await axios.get(
        '/api/admin/results-for-review',
        authHeader()
      );
      setRows(data.results || []);
    } catch {
      toast.error('Could not load list');
    } finally { setBusy(false); }
  };

  /* ---------- select a row ---------- */
  const choose = (row) => {
    setCurr(row);
    setCmt(row.adminComments || '');
    setIdx(1);

    const obj = {};
    if (row.reviewMode) {
      row.questionWiseMarks.forEach(q => (obj[q.questionNo] = { ...q }));
    } else {
      const perQ = row.testId.totalMarks / row.testId.questionsCount;
      for (let i = 1; i <= row.testId.questionsCount; i++) {
        const old = row.questionWiseMarks.find(q => q.questionNo === i);
        obj[i] = old
          ? { ...old }
          : { maxMarks: perQ, obtainedMarks: 0, remarks: '' };
      }
    }
    setMarks(obj);
  };

  /* ---------- helpers ---------- */
  const totalObtained = () =>
    Object.values(marks).reduce((s, q) => s + Number(q.obtainedMarks), 0);

  const updateField = (qNo, field, value) =>
    setMarks(p => ({ ...p, [qNo]: { ...p[qNo], [field]: value } }));

  /* ---------- save handler ---------- */
  const save = async () => {
    if (!current) return;
    setBusy(true);

    try {
      if (current.reviewMode) {
        // only changed questions
        const changed = Object.entries(marks)
          .filter(([n, q]) => {
            const old = current.questionWiseMarks.find(o => o.questionNo === +n);
            return (
              !old ||
              old.maxMarks      !== q.maxMarks ||
              old.obtainedMarks !== q.obtainedMarks ||
              old.remarks       !== q.remarks
            );
          })
          .map(([n, q]) => ({ ...q, questionNo: +n }));

        await axios.patch(
          `/api/admin/review-results/${current._id}/marks`,
          { questionWiseMarks: changed, adminComments: comment },
          authHeader()
        );
      } else {
        // full marking for pending results
        const list = Object.entries(marks).map(([n, q]) => ({
          ...q, questionNo: +n
        }));
        const percent =
          +((totalObtained() / current.testId.totalMarks) * 100).toFixed(2);

        await axios.patch(
          `/api/admin/results/${current._id}/marks`,
          {
            questionWiseMarks: list,
            marksObtained: totalObtained(),
            percentage: percent,
            adminComments: comment
          },
          authHeader()
        );
      }

      toast.success('Saved');
      setCurr(null);
      fetchList();
    } catch {
      toast.error('Save error');
    } finally { setBusy(false); }
  };

  /* ---------- filtered rows ---------- */
  const filtered = rows.filter(r => {
    const s = search.toLowerCase();
    return (
      (r.studentName || '').toLowerCase().includes(s) ||
      (r.testTitle   || '').toLowerCase().includes(s)
    );
  });

  /* ---------- render ---------- */
  return (
    <div className={styles.page}>
      <h2>Answer-Sheet Review</h2>

      <div className={styles.wrapper}>
        {/* list pane */}
        <aside className={styles.listPane}>
          <input
            className={styles.search}
            placeholder="Search…"
            value={search}
            onChange={e => setSrch(e.target.value)}
          />

          <div className={styles.list}>
            {filtered.map(r => (
              <div
                key={r._id}
                className={`${styles.row} ${
                  current?._id === r._id ? styles.active : ''
                }`}
                onClick={() => choose(r)}
              >
                <strong>{r.testTitle}</strong>
                <span>{r.studentName}</span>
                <span
                  className={
                    r.reviewMode
                      ? styles.under
                      : r.status === 'pending'
                      ? styles.pending
                      : styles.done
                  }
                >
                  {r.reviewMode ? 'under review' : r.status}
                </span>
              </div>
            ))}
          </div>
        </aside>

        {/* editor pane */}
        {current && (
          <main className={styles.editor}>
            <button className={styles.back} onClick={() => setCurr(null)}>
              ← back
            </button>

            <h3>{current.testTitle}</h3>
            <p>
              {current.studentName} — {current.testId.class}/
              {current.testId.board}
            </p>

            {current.answerSheetUrl ? (
              <div className={styles.viewer}>
                <iframe
                  title="Answer-sheet PDF"
                  sandbox="allow-same-origin allow-scripts"
                  src={`${current.answerSheetUrl}#toolbar=0&navpanes=0`}
                />
                <div className={styles.cover} />
              </div>
            ) : (
              <p className={styles.noPdf}>No answer-sheet uploaded.</p>
            )}

            {!current.reviewMode && (
              <div className={styles.nav}>
                <button
                  onClick={() => setIdx(i => i - 1)}
                  disabled={qIndex === 1}
                >
                  ‹
                </button>
                Q&nbsp;{qIndex}/{current.testId.questionsCount}
                <button
                  onClick={() => setIdx(i => i + 1)}
                  disabled={qIndex === current.testId.questionsCount}
                >
                  ›
                </button>
              </div>
            )}

            {/* mark form */}
            <div className={styles.form}>
              {(() => {
                const q   = marks[qIndex] || {};
                const max = current.testId.totalMarks;

                const others = Object.entries(marks)
                  .filter(([n]) => +n !== qIndex)
                  .reduce((s, [, v]) => s + Number(v.maxMarks), 0);

                const allow = Math.max(0, max - others);

                return (
                  <>
                    <label>
                      Max
                      <input
                        type="number"
                        min="0"
                        max={allow}
                        value={q.maxMarks}
                        onChange={e =>
                          updateField(
                            qIndex,
                            'maxMarks',
                            Math.min(allow, +e.target.value || 0)
                          )
                        }
                      />
                    </label>

                    <label>
                      Obtained
                      <input
                        type="number"
                        min="0"
                        max={q.maxMarks}
                        value={q.obtainedMarks}
                        onChange={e =>
                          updateField(
                            qIndex,
                            'obtainedMarks',
                            Math.min(q.maxMarks, +e.target.value || 0)
                          )
                        }
                      />
                    </label>

                    <label>
                      Remarks
                      <textarea
                        value={q.remarks}
                        onChange={e =>
                          updateField(qIndex, 'remarks', e.target.value)
                        }
                      />
                    </label>
                  </>
                );
              })()}
            </div>

            <textarea
              className={styles.comment}
              placeholder="Overall comment…"
              value={comment}
              onChange={e => setCmt(e.target.value)}
            />

            <footer className={styles.footer}>
              {!current.reviewMode && (
                <strong>
                  Total {totalObtained()}/{current.testId.totalMarks}
                </strong>
              )}
              <button
                className={styles.save}
                onClick={save}
                disabled={busy}
              >
                {busy ? 'Saving…' : 'Save & approve'}
              </button>
            </footer>
          </main>
        )}
      </div>
    </div>
  );
}

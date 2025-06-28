import { useEffect, useState } from 'react';
import axios   from 'axios';
import styles  from './AnswerSheetReview.module.css';

export default function AnswerSheetReview() {
  const [list,        setList]        = useState([]);
  const [active,      setActive]      = useState(null);
  const [qNums,       setQNums]       = useState([]);
  const [maxMarks,    setMaxMarks]    = useState([]);  // ← NEW: editable max marks
  const [marks,       setMarks]       = useState([]);
  const [remarks,     setRemarks]     = useState([]);  // ← NEW: remarks for each question
  const [origMaxMarks, setOrigMaxMarks] = useState([]);
  const [origMarks,   setOrigMarks]   = useState([]);
  const [origRemarks, setOrigRemarks] = useState([]);
  const [saving,      setSaving]      = useState(false);
  const [flash,       setFlash]       = useState('');

  /* ───────── load left-pane list ───────── */
  const loadList = async () => {
    const { data } = await axios.get('/api/admin/reviews');
    setList(data);
  };
  useEffect(() => { loadList(); }, []);

  /* ───────── when user clicks a row ─────── */
  /* ───────── when user clicks a row ─────── */
  const open = async (resObj) => {
    setActive(resObj); 
    setFlash('');
    
    const { data } = await axios.get(`/api/admin/reviews/${resObj._id}/questions`);
    
    // Use `|| []` to ensure we always have an array, even if API data is missing.
    const questions = data.questions || [];
    const maxMarksData = data.maxMarks || [];

    setQNums(questions);
    setMaxMarks(maxMarksData);
    setOrigMaxMarks([...maxMarksData]);
    
    /* fetch current marks AND remarks from the result object */
    // Now we can safely map over `questions` because it's guaranteed to be an array.
    const gridMarks = questions.map(q => {
      const row = (resObj.questionWiseMarks || []).find(x => x.questionNo === q);
      return row ? row.obtainedMarks : 0;
    });
    
    const gridRemarks = questions.map(q => {
      const row = (resObj.questionWiseMarks || []).find(x => x.questionNo === q);
      return row ? (row.remarks || '') : '';
    });
    
    setMarks(gridMarks);
    setRemarks(gridRemarks);
    setOrigMarks([...gridMarks]);
    setOrigRemarks([...gridRemarks]);
  };

  /* ───────── edit max marks ───────── */
  const tweakMaxMarks = (idx, val) => {
    const clone = [...maxMarks];
    clone[idx] = Math.max(0, +val || 0);
    setMaxMarks(clone);
  };

  /* ───────── edit obtained marks ───────── */
  const tweakMarks = (idx, val) => {
    const clone = [...marks];
    clone[idx] = Math.max(0, Math.min(maxMarks[idx], +val || 0)); // cap at maxMarks
    setMarks(clone);
  };

  /* ───────── edit remarks ───────── */
  const tweakRemarks = (idx, val) => {
    const clone = [...remarks];
    clone[idx] = val;
    setRemarks(clone);
  };

  const totalMax = maxMarks.reduce((s, n) => s + n, 0);
  const totalGot = marks.reduce((s, n) => s + n, 0);
  
  const maxChanged = maxMarks.join('|') !== origMaxMarks.join('|');
  const marksChanged = marks.join('|') !== origMarks.join('|');
  const remarksChanged = remarks.join('|') !== origRemarks.join('|');
  const changed = maxChanged || marksChanged || remarksChanged;

  /* ───────── save patches ───────── */
  const save = async () => {
    if (!changed) return;
    setSaving(true);
    
    try {
      await axios.put(`/api/admin/reviews/${active._id}/grade`, {
        marks: qNums.map((q, i) => ({ 
          q, 
          maxMarks: maxMarks[i],
          obtainedMarks: marks[i],
          remarks: remarks[i] || ''
        }))
      });
      
      setSaving(false);
      setFlash('✔ Saved');
      await loadList();
      setActive(null);
    } catch (error) {
      setSaving(false);
      setFlash('❌ Save failed');
      console.error('Save error:', error);
    }
  };

  /* ───────── UI ───────── */
  return (
    <div className={styles.page}>
      {/* LEFT PANEL */}
      <aside className={styles.left}>
        <h2>Pending / Under-review</h2>
        <ul className={styles.rows}>
          {list.map(r => (
            <li key={r._id}
                onClick={() => open(r)}
                className={active && active._id === r._id ? styles.sel : ''}>
              <span>{r.student.name} – {r.test.title}</span>
              <span className={`${styles.tag} ${
                   r.status === 'pending'      ? styles.pending :
                   r.status === 'under review' ? styles.under :
                   ''}`}>{r.status}</span>
            </li>
          ))}
        </ul>
      </aside>

      {/* RIGHT PANEL */}
      {active && (
        <section className={styles.right}>
          <header>
            <h3>{active.student.name} | {active.test.title}</h3>
            <small>Status: {active.status}</small>
          </header>

          <div className={styles.iframeBox}>
            {active.answerSheetUrl
              ? <iframe title="Answer-sheet" src={active.answerSheetUrl} frameBorder="0" />
              : <div className={styles.nosheet}>No answer-sheet URL</div>}
          </div>

          <table className={styles.grid}>
            <thead>
              <tr>
                <th>Q #</th>
                <th>Max Marks</th>
                <th>Obtained</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {qNums.map((q, i) => (
                <tr key={q}>
                  <td>{q}</td>
                  <td>
                    <input 
                      type="number"
                      value={maxMarks[i]}
                      onChange={e => tweakMaxMarks(i, e.target.value)}
                      min="0"
                      className={styles.maxInput}
                    />
                  </td>
                  <td>
                    <input 
                      type="number"
                      value={marks[i]}
                      onChange={e => tweakMarks(i, e.target.value)}
                      min="0" 
                      max={maxMarks[i]}
                      className={styles.marksInput}
                    />
                  </td>
                  <td>
                    <input 
                      type="text"
                      value={remarks[i]}
                      onChange={e => tweakRemarks(i, e.target.value)}
                      placeholder="Add remarks..."
                      className={styles.remarksInput}
                    />
                  </td>
                </tr>
              ))}
              <tr className={styles.total}>
                <td><strong>Total</strong></td>
                <td><strong>{totalMax}</strong></td>
                <td><strong>{totalGot}</strong></td>
                <td><strong>-</strong></td>
              </tr>
            </tbody>
          </table>

          <button onClick={save} disabled={!changed || saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          {flash && <p className={styles.flash}>{flash}</p>}
        </section>
      )}
    </div>
  );
}

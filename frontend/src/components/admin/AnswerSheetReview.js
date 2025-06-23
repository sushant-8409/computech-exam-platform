import { useEffect, useState } from 'react';
import axios   from 'axios';
import styles  from './AnswerSheetReview.module.css';

export default function AnswerSheetReview() {
  const [list,      setList]      = useState([]);
  const [active,    setActive]    = useState(null);  // current result object
  const [qNums,     setQNums]     = useState([]);
  const [qMax,      setQMax]      = useState([]);
  const [marks,     setMarks]     = useState([]);
  const [origMarks, setOrigMarks] = useState([]);
  const [saving,    setSaving]    = useState(false);
  const [flash,     setFlash]     = useState('');

  /* ───────── load left-pane list ───────── */
  const loadList = async () => {
    const { data } = await axios.get('/api/admin/reviews');
    setList(data);
  };
  useEffect(() => { loadList(); }, []);

  /* ───────── when user clicks a row ─────── */
  const open = async (resObj) => {
    setActive(resObj); setFlash('');
    const { data } = await axios.get(`/api/admin/reviews/${resObj._id}/questions`);
    setQNums(data.questions);
    setQMax(data.maxMarks);
    /* fetch the CURRENT marks from the result object */
    const gridMarks = data.questions.map(q => {
      const row = (resObj.questionWiseMarks || []).find(x => x.questionNo === q);
      return row ? row.obtainedMarks : 0;
    });
    setMarks(gridMarks);
    setOrigMarks(gridMarks);
  };

  /* ───────── edit one cell ───────── */
  const tweak = (idx, val) => {
    const clone = [...marks];
    clone[idx]  = Math.max(0, Math.min(qMax[idx], +val || 0));
    setMarks(clone);
  };

  const totalMax  = qMax.reduce((s, n) => s + n, 0);
  const totalGot  = marks.reduce((s, n) => s + n, 0);
  const changed   = marks.join('|') !== origMarks.join('|');

  /* ───────── save patches ───────── */
  const save = async () => {
    if (!changed) return;
    setSaving(true);
    await axios.put(`/api/admin/reviews/${active._id}/grade`, {
      marks: qNums.map((q, i) => ({ q, marks: marks[i] }))
    });
    setSaving(false);
    setFlash('✔ Saved');
    await loadList();                         // refresh left pane
    setActive(null);                          // close right pane
  };

  /* ───────── UI ───────── */
  return (
    <div className={styles.page}>
      {/* LEFT  */}
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

      {/* RIGHT – only if a result is open */}
      {active && (
        <section className={styles.right}>
          <header>
            <h3>{active.student.name} | {active.test.title}</h3>
            <small>Status : {active.status}</small>
          </header>

          <div className={styles.iframeBox}>
            {active.answerSheetUrl
              ? <iframe title="Answer-sheet" src={active.answerSheetUrl} />
              : <div className={styles.nosheet}>No answer-sheet URL</div>}
          </div>

          <table className={styles.grid}>
            <thead><tr><th>Q #</th><th>Max</th><th>Obtained</th></tr></thead>
            <tbody>
              {qNums.map((q, i) => (
                <tr key={q}>
                  <td>{q}</td>
                  <td>{qMax[i]}</td>
                  <td>
                    <input type="number"
                           value={marks[i]}
                           onChange={e => tweak(i, e.target.value)}
                           min="0" max={qMax[i]} />
                  </td>
                </tr>
              ))}
              <tr className={styles.total}><td>Total</td><td>{totalMax}</td><td>{totalGot}</td></tr>
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

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2'; // Import SweetAlert2 for user-friendly pop-ups
import styles from './AnswerSheetReview.module.css';
import { toast } from 'react-toastify';
// Make sure you have a way to navigate, e.g., from react-router-dom
import { useNavigate } from 'react-router-dom';
import { enhanceEmbedUrl } from '../../utils/googleDriveUtils';

export default function AnswerSheetReview() {
  // State for the list and active item
  const [list, setList] = useState([]);
  const [active, setActive] = useState(null);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate(); // Hook for navigation

  // State for view toggle
  const [viewMode, setViewMode] = useState('answerSheet');

  // State for the grading grid
  const [qNums, setQNums] = useState([]);
  const [qMax, setQMax] = useState([]);
  const [marks, setMarks] = useState([]);
  const [remarks, setRemarks] = useState([]);
  const [adminComments, setAdminComments] = useState('');

  // State for tracking changes
  const [origQMax, setOrigQMax] = useState([]);
  const [origMarks, setOrigMarks] = useState([]);
  const [origRemarks, setOrigRemarks] = useState([]);
  const [origAdminComments, setOrigAdminComments] = useState('');

  const loadList = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error("No auth token found.");
      const { data } = await axios.get('/api/admin/results-for-review', { headers: { Authorization: `Bearer ${token}` } });
      if (data.success) setList(data.results);
    } catch (err) {
      toast.error("Failed to load review list.");
      if (err.response?.status === 401) navigate('/login'); // Redirect if initial load fails auth
    }
  };
  useEffect(() => { loadList(); }, []);

  // Function to get the current iframe URL based on viewMode
  const getCurrentUrl = () => {
    if (!active) return null;
    
    switch (viewMode) {
      case 'questionPaper':
        return active.questionPaperUrl;
      case 'answerKey':
        return active.answerKeyUrl;
      case 'answerSheet':
      default:
        return active.answerSheetUrl;
    }
  };

  // Function to get the current iframe title based on viewMode
  const getCurrentTitle = () => {
    switch (viewMode) {
      case 'questionPaper':
        return 'Question Paper';
      case 'answerKey':
        return 'Answer Key';
      case 'answerSheet':
      default:
        return 'Answer Sheet';
    }
  };

  const open = async (resObj) => {
    setActive(resObj);
    setViewMode('answerSheet'); // Reset to answer sheet when opening new item
    const url = resObj.reviewMode
      ? `/api/admin/review-results/${resObj._id}/questions`
      : `/api/admin/results/${resObj._id}/questions`;

    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error("No auth token found.");
      const { data } = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!data.success) throw new Error(data.message);

      setQNums(data.questions);
      setQMax(data.maxMarks);
      setOrigQMax(data.maxMarks);

      const gridMarks = [], gridRemarks = [];
      data.questions.forEach(qNum => {
        const row = (resObj.questionWiseMarks || []).find(x => x.questionNo === qNum);
        gridMarks.push(row?.obtainedMarks ?? 0);
        gridRemarks.push(row?.remarks ?? '');
      });
      setMarks(gridMarks);
      setOrigMarks(gridMarks);
      setRemarks(gridRemarks);
      setOrigRemarks(gridRemarks);
      setAdminComments(resObj.adminComments || '');
      setOrigAdminComments(resObj.adminComments || '');
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not load question details.");
    }
  };

  const tweak = (idx, val) => setMarks(m => m.map((orig, i) => i === idx ? Math.max(0, Math.min(qMax[i] || 0, +val || 0)) : orig));
  const tweakMax = (idx, val) => setQMax(m => m.map((orig, i) => i === idx ? Math.max(0, +val || 0) : orig));
  const tweakRemarks = (idx, val) => setRemarks(r => r.map((orig, i) => i === idx ? val : orig));

  const totalMax = qMax.reduce((s, n) => s + (Number(n) || 0), 0);
  const totalGot = marks.reduce((s, n) => s + (Number(n) || 0), 0);

  const changed = JSON.stringify(marks) !== JSON.stringify(origMarks) ||
    JSON.stringify(qMax) !== JSON.stringify(origQMax) ||
    JSON.stringify(remarks) !== JSON.stringify(origRemarks) ||
    adminComments !== origAdminComments;

  // ✅ UPDATED SAVE FUNCTION WITH BETTER ERROR HANDLING
  const save = async () => {
    if (!changed) return;
    setSaving(true);

    const url = active.reviewMode
      ? `/api/admin/review-results/${active._id}/marks`
      : `/api/admin/results/${active._id}/marks`;

    const payload = {
      questionWiseMarks: qNums.map((num, i) => ({
        questionNo: num, obtainedMarks: marks[i],
        maxMarks: qMax[i], remarks: remarks[i] || ''
      })),
      adminComments: adminComments
    };

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        // This case handles if the user is already logged out in another tab
        throw new Error("Authentication Error: No token found.");
      }

      await axios.patch(url, payload, { headers: { Authorization: `Bearer ${token}` } });

      toast.success('Grades saved successfully!');
      await loadList();
      setActive(null);

    } catch (err) {
      console.error("Save error:", err);

      // ✅ This block specifically handles the 401 Unauthorized error
      if (err.response?.status === 401) {
        Swal.fire({
          title: 'Session Expired',
          text: 'Your session has timed out. Please log in again to save your work.',
          icon: 'warning',
          confirmButtonText: 'Go to Login',
          confirmButtonColor: '#3085d6'
        }).then(() => {
          // Here you would typically call a global logout function from your AuthContext
          // For now, we'll navigate directly to the login page.
          navigate('/login');
        });
      } else {
        toast.error(err.response?.data?.message || 'Failed to save changes.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.page}>
      <aside className={styles.left}>
        <h2>Pending / Under-review</h2>
        <ul className={styles.rows}>
          {(list || []).map(r => (
            <li key={r._id} onClick={() => open(r)} className={active?._id === r._id ? styles.sel : ''}>
              <span>{r.studentName} – {r.testTitle}</span>
              <span className={`${styles.tag} ${r.status === 'pending' ? styles.pending : styles.under}`}>{r.status}</span>
            </li>
          ))}
        </ul>
      </aside>
      {active && (
        <section className={styles.right}>
          <header className={styles.header}>
            <h3>{active.studentName} | {active.testTitle}</h3>
            <small>Status: {active.status}</small>
          </header>
          {active.status === 'under review' && active.studentComments && (
            <div className={styles.studentComment}>
              <h5>Student's comment</h5>
              <p>{active.studentComments}</p>
            </div>
          )}
          
          {/* Toggle buttons for different document views */}
          <div className={styles.toggleButtons}>
            <button 
              className={`${styles.toggleButton} ${viewMode === 'answerSheet' ? styles.active : ''}`}
              onClick={() => setViewMode('answerSheet')}
            >
              Answer Sheet
            </button>
            <button 
              className={`${styles.toggleButton} ${viewMode === 'questionPaper' ? styles.active : ''}`}
              onClick={() => setViewMode('questionPaper')}
              disabled={!active.questionPaperUrl}
            >
              Question Paper
            </button>
            <button 
              className={`${styles.toggleButton} ${viewMode === 'answerKey' ? styles.active : ''}`}
              onClick={() => setViewMode('answerKey')}
              disabled={!active.answerKeyUrl}
            >
              Answer Key
            </button>
          </div>

          <div className={styles.contentGrid}>
            <div className={styles.iframeBox}>
              {getCurrentUrl() ? (
                <iframe 
                  title={getCurrentTitle()} 
                  src={enhanceEmbedUrl(getCurrentUrl())}
                  sandbox="allow-same-origin allow-scripts"
                  scrolling="yes"
                />
              ) : (
                <div className={styles.nosheet}>No {getCurrentTitle()} URL Available</div>
              )}
            </div>
            <div className={styles.gradingBox}>
              <table className={styles.grid}>
                <thead><tr><th>Q #</th><th>Max</th><th>Obtained</th><th>Remarks</th></tr></thead>
                <tbody>
                  {qNums.map((q, i) => (
                    <tr key={q}>
                      <td>{q}</td>
                      <td><input type="number" value={qMax[i] ?? ''} onChange={e => tweakMax(i, e.target.value)} min="0" className={styles.inputField} /></td>
                      <td><input type="number" value={marks[i] ?? ''} onChange={e => tweak(i, e.target.value)} min="0" max={qMax[i]} className={styles.inputField} /></td>
                      <td><input type="text" value={remarks[i] ?? ''} onChange={e => tweakRemarks(i, e.target.value)} placeholder="Remarks..." className={styles.remarksInput} /></td>
                    </tr>
                  ))}
                  <tr className={styles.total}>
                    <td>Total</td><td>{totalMax}</td><td>{totalGot}</td><td>-</td>
                  </tr>
                </tbody>
              </table>
              <div className={styles.commentsSection}>
                <label htmlFor='admin-comments'>Overall Admin Comments</label>
                <textarea id='admin-comments' value={adminComments} onChange={e => setAdminComments(e.target.value)} placeholder='Add overall feedback here...' rows='4'></textarea>
              </div>
              <button onClick={save} disabled={!changed || saving} className={styles.saveButton}>
                {saving ? 'Saving…' : 'Save & Approve Marks'}
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

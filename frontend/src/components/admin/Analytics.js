// src/components/admin/AdminAnalytics.jsx
import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend
} from 'chart.js';

import { Modal, Button, Form } from 'react-bootstrap';
import styles from './AdminAnalytics.module.css';
import logo from '../../assets/logo192.png';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const AdminAnalytics = () => {
  /* ---------------- state ---------------- */
  const [loading, setLoading] = useState(true);
  const [overall, setOverall] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [error, setError] = useState('');

  const [query, setQuery] = useState('');
  const [student, setStudent] = useState(null);
  const [searching, setSearching] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [testChecks, setTestChecks] = useState({});

  /* ---------------- data fetch ---------------- */
  useEffect(() => {
    (async () => {
      try {
        const { data } = await axios.get('/api/admin/analytics');
        setOverall(data.overall);
        setSubjects(data.subjectPerformance);
      } catch {
        setError('Failed to load analytics');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ---------------- helpers ---------------- */
  const debounce = (fn, delay = 400) => {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
  };

  const searchStudent = useCallback(
    debounce(async term => {
      if (!term) { setStudent(null); return; }
      setSearching(true);
      try {
        const { data } = await axios.get('/api/students/search', { params: { query: term } });
        setStudent(data);
      } finally {
        setSearching(false);
      }
    }),
    []);

  const handleQuery = e => {
    const v = e.target.value;
    setQuery(v);
    searchStudent(v.trim());
  };

  /* ------------- PDF generation ------------- */
  const addHeader = (doc, title) => {
    doc.addImage(logo, 'PNG', 40, 20, 40, 40);
    doc.setFontSize(22).text('Computech', 90, 45);
    doc.setFontSize(16).text(title, 40, 80);
  };

  const downloadOverallPDF = () => {
    const doc = new jsPDF('p', 'pt', 'a4');
    addHeader(doc, 'Overall Performance Report');

    let y = 110;
    doc.setFontSize(12);
    doc.text(`Total Students : ${overall.totalStudents}`, 40, y);
    doc.text(`Average Score  : ${overall.averageScore.toFixed(2)}%`, 40, y + 18);
    doc.text(`Pass Rate      : ${overall.passRate.toFixed(2)}%`, 40, y + 36);

    autoTable(doc, {
      head: [['Subject', 'Average %']],
      body: subjects.map(s => [s.subject, s.average.toFixed(2)]),
      startY: y + 60,
      theme: 'grid'
    });

    doc.save('computech-overall-report.pdf');
  };

  const downloadStudentPDF = () => {
    if (!student) return;
    const chosen = student.results.filter(r => testChecks[r._id]);
    if (!chosen.length) return alert('Select at least one test');

    const doc = new jsPDF('p', 'pt', 'a4');
    addHeader(doc, `Student Report - ${student.name}`);

    doc.setFontSize(12);
    doc.text(`Email : ${student.email}`, 40, 110);
    doc.text(`Roll  : ${student.rollNo || '-'}`, 40, 128);

    let curY = 150;
    chosen.forEach((r, idx) => {
      if (idx) curY += 30;
      doc.setFontSize(14).text(`Test ${idx + 1}: ${r.testTitle}`, 40, curY);
      curY += 16;

      autoTable(doc, {
        head: [['Subject', 'Marks', 'Total', '%', 'Status', 'Date']],
        body: [[
          r.subject,
          r.marksObtained,
          r.totalMarks,
          ((r.marksObtained / r.totalMarks) * 100).toFixed(2) + '%',
          r.status,
          new Date(r.submittedAt).toLocaleDateString()
        ]],
        startY: curY,
        theme: 'striped'
      });
      curY = doc.lastAutoTable.finalY;
    });

    doc.save(`report-${student.name.replace(/\s+/g, '_')}.pdf`);
    setShowModal(false);
  };

  /* ---------------- render ---------------- */
  if (loading) return <p>Loading…</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;

  return (
    <div className={styles.analyticsRoot}>
      <h2>📊 Site Analytics</h2>

      {/* ---------- overview cards ---------- */}
      <div className={styles.statGrid}>
        <Card label="Total Students" value={overall.totalStudents} />
        <Card label="Average Score" value={`${overall.averageScore.toFixed(1)}%`} />
        <Card label="Pass Rate" value={`${overall.passRate.toFixed(1)}%`} />
      </div>

      {/* ---------- subject averages ---------- */}
      <h4>Subject-wise Averages</h4>
      {subjects.length ? (
        <>
          <Bar
            data={{
              labels: subjects.map(s => s.subject),
              datasets: [{ data: subjects.map(s => s.average), backgroundColor: '#36a2eb' }]
            }}
            options={{ plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100 } } }}
            height={200}
          />

          <table className={styles.table}>
            <thead><tr><th>Subject</th><th>Average %</th></tr></thead>
            <tbody>
              {subjects.map(s => (
                <tr key={s.subject}><td>{s.subject}</td><td>{s.average.toFixed(2)}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      ) : <p>No subject data yet.</p>}

      {/* ---------- student search ---------- */}
      <h4>🔍 Student Search</h4>
      <div className={styles.searchBox}>
        <input
          className={styles.searchInput}
          placeholder="Type name / email / roll-no"
          value={query}
          onChange={handleQuery}
        />
      </div>

      {searching && <p>Searching…</p>}

      {student && !searching && (
        <div className={styles.studentCard}>
          <div className={styles.studentHeader}>{student.name}</div>
          <div className={styles.studentSub}>{student.email}</div>
          <p>Roll&nbsp;No&nbsp;: {student.rollNo || '-'}</p>

          {student.results?.length ? (
            <ul className={styles.resultList}>
              {student.results.map(r => (
                <li key={r._id} className={styles.resultItem}>
                  <strong>{r.subject}</strong> – {r.testTitle} : {r.marksObtained}/{r.totalMarks}
                  {' '}({((r.marksObtained / r.totalMarks) * 100).toFixed(1)}%)
                </li>
              ))}
            </ul>
          ) : <p>No results yet.</p>}

          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() => {
              const init = {}; student.results.forEach(r => { init[r._id] = true; });
              setTestChecks(init); setShowModal(true);
            }}
          >
            Generate Report
          </button>
        </div>
      )}

      {/* ---------- overall PDF button ---------- */}
      <div style={{ textAlign: 'center', marginTop: '3rem' }}>
        <button className={`${styles.btn} ${styles.btnSuccess}`} onClick={downloadOverallPDF}>
          Download Overall PDF
        </button>
      </div>

      {/* ---------- modal ---------- */}
      <Modal
        show={showModal}
        onHide={() => setShowModal(false)}
        size="lg"              /* wider modal[5]            */
        centered               /* vertically centred[2]     */
        scrollable             /* body can scroll           */
        dialogClassName={styles.reportModal} /* custom skin[4] */
      >
        <Modal.Header closeButton>
          <Modal.Title>Select tests for {student?.name}</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <Form.Check
            type="checkbox"
            label="Select / Deselect All"
            className={styles.selectAll}
            checked={Object.values(testChecks).every(Boolean)}
            onChange={e => {
              const all = e.target.checked;
              const obj = {};
              Object.keys(testChecks).forEach(id => (obj[id] = all));
              setTestChecks(obj);
            }}
          />

          {/* scrollable list */}
          <ul className={styles.testList}>
            {student?.results.map(r => (
              <li key={r._id} className={styles.testItem}>
                <Form.Check
                  type="checkbox"
                  checked={testChecks[r._id] || false}
                  onChange={e =>
                    setTestChecks({ ...testChecks, [r._id]: e.target.checked })
                  }
                />

                {/*-- right side info --*/}
                <div className={styles.testInfo}>
                  <div className={styles.testTitle}>{r.testTitle}</div>

                  <div className={styles.testMeta}>
                    {new Date(r.submittedAt).toLocaleDateString()} • {r.subject} •&nbsp;
                    {r.marksObtained}/{r.totalMarks}&nbsp;
                    ({((r.marksObtained / r.totalMarks) * 100).toFixed(1)}%)
                  </div>
                </div>
              </li>

            ))}
          </ul>
        </Modal.Body>

        <Modal.Footer className={styles.modalFooter}>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Close
          </Button>
          <Button variant="primary" onClick={downloadStudentPDF}>
            Download PDF
          </Button>
        </Modal.Footer>
      </Modal>

    </div>
  );
};

/* ---------- tiny card component ---------- */
const Card = ({ label, value }) => (
  <div className={styles.statCard}>
    <span className={styles.statValue}>{value}</span>
    <div className={styles.statLabel}>{label}</div>
  </div>
);

export default AdminAnalytics;

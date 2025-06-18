import React, { useState, useEffect, useRef } from 'react';
import styles from './ResultDetail.module.css';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import LoadingSpinner from '../LoadingSpinner';
import ErrorMessage from '../ErrorMessage';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import logo from '../../assets/logo192.png';

const StatusBadge = ({ status }) => {
  const statusLabels = {
    pending: 'Pending',
    reviewed: 'Reviewed',
    published: 'Published',
    'under review': 'Under Review'
  };
  const statusStyles = {
    pending: styles.statusPending,
    reviewed: styles.statusReviewed,
    published: styles.statusPublished,
    'under review': styles.statusReview
  };
  return (
    <span
      className={`${styles.statusBadge} ${statusStyles[status] || styles.statusPending}`}
      aria-label={`Status: ${statusLabels[status] || status}`}
      tabIndex={0}
    >
      {statusLabels[status] || status}
    </span>
  );
};

const getGrade = (percentage) => {
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B+';
  if (percentage >= 60) return 'B';
  if (percentage >= 50) return 'C';
  if (percentage >= 40) return 'D';
  return 'F';
};

const ResultDetail = () => {
  const { resultId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [test, setTest] = useState(null);
  const [showDoc, setShowDoc] = useState(''); // 'question', 'answer', 'key'
  const [qrDataUrl, setQrDataUrl] = useState('');
  const pdfRef = useRef();

  // Accessibility: focus management
  const btnRefs = [useRef(), useRef(), useRef()];

  useEffect(() => {
    const fetchResult = async () => {
      try {
        const { data } = await axios.get(`/api/student/result/${resultId}`);
        if (!data.success) throw new Error(data.message);
        setResult(data.result);
        setTest(data.result.test);
      } catch (err) {
        setError(err.response?.data?.message || err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchResult();
  }, [resultId]);

  // Fetch QR code for PDF
  useEffect(() => {
    if (!resultId) return;
    const qrUrl = `${window.location.origin}/result/${resultId}`;
    axios
      .get(`/api/student/qr`, {
        params: { data: qrUrl },
        responseType: 'arraybuffer'
      })
      .then((res) => {
        const base64 = btoa(
          new Uint8Array(res.data).reduce(
            (data, byte) => data + String.fromCharCode(byte),
            ''
          )
        );
        setQrDataUrl(`data:image/png;base64,${base64}`);
      })
      .catch(() => setQrDataUrl(''));
  }, [resultId]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  if (!result || !test) return null;

  // Calculations
  const percentage = result.totalMarks
    ? ((result.marksObtained / result.totalMarks) * 100).toFixed(2)
    : '0.00';
  const grade = getGrade(percentage);
  const isPass = result.marksObtained >= (test.passingMarks || 0);

  // Document URLs
  const questionPaperURL = test.questionPaperURL;
  const answerSheetURL = result.answerSheetUrl;
  const answerKeyURL = test.answerKeyVisible ? test.answerKeyURL : null;

  // PDF generation (with QR and branding)
  const handleDownloadPDF = async () => {
    const pdf = new jsPDF('p', 'mm', 'a4');
    // Header
    pdf.setFillColor(25, 118, 210);
    pdf.rect(0, 0, 210, 30, 'F');
    pdf.addImage(logo, 'PNG', 10, 6, 18, 18, undefined, 'FAST');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(22);
    pdf.text('Computech Examination Result', 33, 20, { baseline: 'middle' });

    // Main info
    pdf.setTextColor(33, 33, 33);
    pdf.setFontSize(14);
    pdf.text(`Student Name: ${result.studentId?.name || 'N/A'}`, 14, 42);
    pdf.text(`Test Title: ${test.title}`, 14, 52);
    pdf.text(`Subject: ${test.subject}`, 14, 62);
    pdf.text(`Class: ${result.studentId?.class || test.class}`, 14, 72);
    pdf.text(`Board: ${result.studentId?.board || test.board}`, 14, 82);
    pdf.text(`Date: ${result.submittedAt ? new Date(result.submittedAt).toLocaleDateString() : 'N/A'}`, 14, 92);

    // Marks
    pdf.setFontSize(14);
    pdf.text(`Total Marks: ${result.totalMarks}`, 120, 42);
    pdf.text(`Passing Marks: ${test.passingMarks}`, 120, 52);
    pdf.text(`Marks Obtained: ${result.marksObtained}`, 120, 62);
    pdf.text(`Percentage: ${percentage}%`, 120, 72);
    pdf.text(`Grade: ${grade}`, 120, 82);
    pdf.setFontSize(16);
    pdf.setTextColor(isPass ? 56 : 211, isPass ? 142 : 47, isPass ? 60 : 47);
    pdf.text(`Status: ${isPass ? 'PASS' : 'FAIL'}`, 120, 92);

    // Table: Question-wise
    pdf.setFontSize(13);
    pdf.setTextColor(33, 33, 33);
    pdf.text('Question-wise Marks:', 14, 108);
    pdf.setFontSize(11);
    let y = 114;
    pdf.setDrawColor(25, 118, 210);
    pdf.setLineWidth(0.3);
    pdf.rect(14, y, 182, 8, 'S');
    pdf.text('Q.No', 18, y + 6);
    pdf.text('Max', 38, y + 6);
    pdf.text('Obtained', 58, y + 6);
    pdf.text('Remarks', 78, y + 6);
    y += 8;
    result.questionWiseMarks?.forEach((q) => {
      pdf.rect(14, y, 182, 8, 'S');
      pdf.text(String(q.questionNo), 18, y + 6);
      pdf.text(String(q.maxMarks), 38, y + 6);
      pdf.text(String(q.obtainedMarks), 58, y + 6);
      pdf.text(q.remarks || '-', 78, y + 6);
      y += 8;
      if (y > 260) { pdf.addPage(); y = 20; }
    });

    // Comments
    if (result.adminComments) {
      pdf.setFontSize(12);
      pdf.setTextColor(255, 179, 0);
      pdf.text('Examiner Comments:', 14, y + 10);
      pdf.setTextColor(33, 33, 33);
      pdf.text(result.adminComments, 14, y + 18, { maxWidth: 180 });
      y += 26;
    }

    // Guardian Signature
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.5);
    pdf.text('Guardian Signature:', 14, y + 16);
    pdf.line(50, y + 16, 110, y + 16);
    pdf.text('Date:', 120, y + 16);
    pdf.line(135, y + 16, 170, y + 16);

    // QR code with result link
    if (qrDataUrl) {
      pdf.setFontSize(10);
      pdf.text('Scan for online result & authenticity:', 14, y + 32);
      pdf.addImage(qrDataUrl, 'PNG', 14, y + 34, 32, 32, undefined, 'FAST');
      pdf.setTextColor(25, 118, 210);
      pdf.textWithLink('computech-exam-platform.onrender.com', 50, y + 48, { url: `https://computech-exam-platform.onrender.com/result/${resultId}` });
    }

    pdf.save(`${test.title}_Result.pdf`);
  };

  // Accessibility: handle keyboard navigation for document buttons
  const handleKeyDown = (e, idx) => {
    if (e.key === 'ArrowRight') {
      btnRefs[(idx + 1) % 3].current.focus();
    } else if (e.key === 'ArrowLeft') {
      btnRefs[(idx + 2) % 3].current.focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      setShowDoc(['question', 'answer', 'key'][idx]);
    }
  };

  return (
    <main className={styles.container} aria-labelledby="result-detail-heading">
      <header className={styles.headerRow}>
        <Link to="/dashboard" className={styles.backBtn}>
          ← Back to Dashboard
        </Link>
        <StatusBadge status={result.status} />
      </header>

      <h1 id="result-detail-heading" className={styles.srOnly}>
        Examination Result Details
      </h1>

      <section className={styles.card} aria-label="Test and Result Information">
        <div className={styles.cardBody}>
          <h2 className={styles.cardTitle}>{test.title}</h2>
          <div className={styles.infoGrid}>
            <div>
              <p><strong>Subject:</strong> {test.subject}</p>
              <p><strong>Class:</strong> {result.studentId?.class || test.class}</p>
              <p><strong>Board:</strong> {result.studentId?.board || test.board}</p>
              <p><strong>School:</strong> {result.studentId?.school}</p>
              <p><strong>Submitted At:</strong> {result.submittedAt ? new Date(result.submittedAt).toLocaleString() : 'N/A'}</p>
            </div>
            <div>
              <p><strong>Total Marks:</strong> {result.totalMarks}</p>
              <p><strong>Passing Marks:</strong> {test.passingMarks}</p>
              <p><strong>Obtained Marks:</strong> {result.marksObtained ?? 'Pending'}</p>
              <p>
                <strong>Percentage:</strong> {percentage}%
                <span className={isPass ? styles.pass : styles.fail}>
                  {isPass ? ' (Pass)' : ' (Fail)'}
                </span>
              </p>
              <p>
                <strong>Grade:</strong> <span className={styles.grade}>{grade}</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Document Viewer Buttons */}
      <nav className={styles.viewerBtns} aria-label="Document Viewer Navigation">
        <button
          ref={btnRefs[0]}
          className={`${styles.viewerBtn} ${showDoc === 'question' ? styles.activeBtn : ''}`}
          onClick={() => setShowDoc('question')}
          disabled={!questionPaperURL}
          aria-pressed={showDoc === 'question'}
          tabIndex={0}
          aria-label="Show Question Paper"
          onKeyDown={(e) => handleKeyDown(e, 0)}
        >
          📄 Question Paper
        </button>
        <button
          ref={btnRefs[1]}
          className={`${styles.viewerBtn} ${showDoc === 'answer' ? styles.activeBtn : ''}`}
          onClick={() => setShowDoc('answer')}
          disabled={!answerSheetURL}
          aria-pressed={showDoc === 'answer'}
          tabIndex={0}
          aria-label="Show Answer Sheet"
          onKeyDown={(e) => handleKeyDown(e, 1)}
        >
          📝 Answer Sheet
        </button>
        <button
          ref={btnRefs[2]}
          className={`${styles.viewerBtn} ${showDoc === 'key' ? styles.activeBtn : ''}`}
          onClick={() => setShowDoc('key')}
          disabled={!answerKeyURL}
          aria-pressed={showDoc === 'key'}
          tabIndex={0}
          aria-label="Show Answer Key"
          onKeyDown={(e) => handleKeyDown(e, 2)}
        >
          🔑 Answer Key
        </button>
      </nav>

      {/* Only one iframe visible */}
      <section className={styles.iframeContainer} aria-live="polite">
        {showDoc === 'question' && questionPaperURL && (
          <iframe
            src={questionPaperURL}
            title="Question Paper"
            className={styles.iframe}
            aria-label="Question Paper PDF"
          />
        )}
        {showDoc === 'answer' && answerSheetURL && (
          <iframe
            src={answerSheetURL}
            title="Answer Sheet"
            className={styles.iframe}
            aria-label="Student Answer Sheet PDF"
          />
        )}
        {showDoc === 'key' && answerKeyURL && (
          <iframe
            src={answerKeyURL}
            title="Answer Key"
            className={styles.iframe}
            aria-label="Official Answer Key PDF"
          />
        )}
      </section>

      {/* Question-wise breakdown */}
      {result.questionWiseMarks?.length > 0 && (
        <section className={styles.card} aria-label="Question-wise Marks Breakdown">
          <div className={styles.cardBody}>
            <h3 className={styles.sectionTitle}>Detailed Breakdown</h3>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <caption className={styles.srOnly}>Question-wise marks</caption>
                <thead>
                  <tr>
                    <th scope="col">Question</th>
                    <th scope="col">Max Marks</th>
                    <th scope="col">Obtained</th>
                    <th scope="col">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {result.questionWiseMarks.map((q, idx) => (
                    <tr key={idx}>
                      <td>#{q.questionNo}</td>
                      <td>{q.maxMarks}</td>
                      <td className={q.obtainedMarks < (q.maxMarks * 0.4) ? styles.lowMark : ''}>
                        {q.obtainedMarks}
                      </td>
                      <td>{q.remarks || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Admin comments */}
      {result.adminComments && (
        <section className={styles.card + ' ' + styles.commentCard} aria-label="Examiner Comments">
          <div className={styles.cardBody}>
            <h4 className={styles.commentTitle}>Examiner Comments</h4>
            <p>{result.adminComments}</p>
          </div>
        </section>
      )}

      {/* PDF Download */}
      <button
        className={styles.downloadBtn}
        onClick={handleDownloadPDF}
        aria-label="Download formal PDF result card"
      >
        ⬇️ Download Report Card
      </button>
    </main>
  );
};

export default ResultDetail;

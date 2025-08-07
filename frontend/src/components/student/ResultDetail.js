import React, { useState, useEffect, useRef } from 'react';
import styles from './ResultDetail.module.css';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../App';
import LoadingSpinner from '../LoadingSpinner';
import ErrorMessage from '../ErrorMessage';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import logo from '../../assets/logo192.png';
import { enhanceEmbedUrl, isMobileDevice, getMobileAlternatives } from '../../utils/googleDriveUtils';

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
const DrivePdf = ({ src, title }) => {
  const [iframeFailed, setIframeFailed] = useState(false);
  const isMobile = isMobileDevice();
  const alternatives = getMobileAlternatives(src);
  
  return (
    <div className={styles.driveWrapper}>
      <iframe
        sandbox="allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox"
        src={enhanceEmbedUrl(src)}
        title={title}
        className={styles.driveIframe}
        scrolling="yes"
        referrerPolicy="no-referrer-when-downgrade"
        allow="fullscreen"
        onError={() => setIframeFailed(true)}
        onLoad={() => setIframeFailed(false)}
      />
      <div className={styles.driveOverlay} />
      
      {/* Mobile alternatives - show always on mobile or when iframe fails */}
      {(isMobile || iframeFailed) && alternatives.length > 0 && (
        <div className={styles.mobileAlternatives}>
          <p><strong>📱 Alternative viewing options:</strong></p>
          {alternatives.map((alt, index) => (
            <button
              key={index}
              onClick={() => window.open(alt.url, '_blank', 'noopener,noreferrer')}
              className={styles.alternativeBtn}
              title={alt.description}
            >
              {alt.label}
            </button>
          ))}
        </div>
      )}
    </div>
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
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [test, setTest] = useState(null);
  const [student, setStudent] = useState(null); // Add student state to store API response data
  const [showDoc, setShowDoc] = useState(''); // 'question', 'answer', 'key'
  const [qrDataUrl, setQrDataUrl] = useState('');
  const pdfRef = useRef();

  // Accessibility: focus management
  const btnRefs = [useRef(), useRef(), useRef()];

  // In src/components/student/ResultDetail.js

// ... (imports and other component code remain the same)

  useEffect(() => {
    const fetchResult = async () => {
      try {
        console.log('🔍 Current user from auth context:', user);
        console.log('🔍 User data in localStorage:', JSON.parse(localStorage.getItem('user') || '{}'));
        
        // Use admin endpoint if user is admin, otherwise use student endpoint
        const apiEndpoint = user?.role === 'admin' 
          ? `/api/admin/result/${resultId}`
          : `/api/student/results/${resultId}`;
        
        const { data } = await axios.get(apiEndpoint);
        if (!data.success) throw new Error(data.message);
        
        // ✅ UPDATED: Set state from the new, clean data structure
        setResult(data.result);
        setTest(data.test);
        // Store student data from API response for comprehensive fallback
        if (data.student) {
          setStudent(data.student);
        }

        console.log('API Response Debug:', {
          result: data.result,
          test: data.test,
          student: data.student,
          userFromAuth: user
        }); 

      } catch (err) {
        setError(err.response?.data?.message || err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchResult();
  }, [resultId, user?.role]);

// ... (the rest of the component code, including PDF generation, should now work correctly)

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

  // Document URLs - Handle both naming conventions for backwards compatibility
  const questionPaperURL = test.questionPaperURL || test.questionPaperUrl;
  const answerSheetURL = result.answerSheetURL || result.answerSheetUrl; // Handle both uppercase and lowercase
  const answerKeyURL = test.answerKeyVisible ? (test.answerKeyURL || test.answerKeyUrl) : 
                      (result.isManualEntry ? (test.answerKeyURL || test.answerKeyUrl) : null); // Show for manual entries even if not marked visible

  // PDF generation (with QR and branding)
  const handleDownloadPDF = async () => {
    // Debug logging to understand data structure
    console.log('PDF Generation Data Debug:');
    console.log('User:', user);
    console.log('Result:', result);
    console.log('Test:', test);
    
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Formal Header Design
    // Header border
    pdf.setDrawColor(0, 51, 102); // Dark blue
    pdf.setLineWidth(3);
    pdf.rect(10, 10, pageWidth - 20, 50);
    
    // Institution letterhead background
    pdf.setFillColor(245, 247, 250); // Light gray background
    pdf.rect(12, 12, pageWidth - 24, 46, 'F');
    
    // Main institution logo area
    pdf.setFillColor(0, 51, 102); // Dark blue header bar
    pdf.rect(12, 12, pageWidth - 24, 15, 'F');
    
    // Add logo and QR code if available
    if (logo) {
      try {
        pdf.addImage(logo, 'PNG', 15, 15, 12, 12, undefined, 'FAST');
      } catch (e) {
        console.log('Logo could not be added to PDF');
      }
    }
    
    // Add QR Code in top right corner of header
    if (qrDataUrl) {
      try {
        pdf.addImage(qrDataUrl, 'PNG', pageWidth - 35, 15, 20, 20, undefined, 'FAST');
        
        // QR code label
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7);
        pdf.setTextColor(255, 255, 255);
        pdf.text('Scan to Verify', pageWidth - 25, 37, { align: 'center' });
      } catch (e) {
        console.log('QR code could not be added to PDF header');
      }
    }
    
    // Institution name
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.setTextColor(255, 255, 255);
    pdf.text('COMPUTECH EDUCATIONAL INSTITUTE', pageWidth / 2, 22, { align: 'center' });
    
    // Sub-header
    pdf.setFontSize(10);
    pdf.setTextColor(255, 255, 255);
    pdf.text('Excellence in Academic Assessment & Student Evaluation', pageWidth / 2, 26, { align: 'center' });
    
    // Report title
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.setTextColor(0, 51, 102);
    pdf.text('OFFICIAL EXAMINATION RESULT CERTIFICATE', pageWidth / 2, 38, { align: 'center' });
    
    // Certificate number and date
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(100, 100, 100);
    const certNumber = `CERT/${new Date().getFullYear()}/${resultId?.slice(-8) || '00000000'}`;
    pdf.text(`Certificate No: ${certNumber}`, 20, 48);
    pdf.text(`Issue Date: ${new Date().toLocaleDateString('en-GB')}`, 20, 53);
    
    // Student Information Section
    let yPosition = 75;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(0, 51, 102);
    pdf.text('STUDENT INFORMATION', 20, yPosition);
    
    // Student info table
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.5);
    
    // Enhanced fallback logic using API student data, user auth data, and result data
    const studentName = student?.name || user?.name || result?.studentId?.name || 'Student Name Not Available';
    const registrationNumber = student?.rollNo || 
                              user?.rollNo || 
                              user?.registrationNumber || 
                              result?.studentId?.rollNo ||
                              result?.studentId?.registrationNumber ||
                              resultId?.slice(-8) || 
                              'REG-NOT-AVAILABLE';
    
    const studentClass = student?.class || 
                        user?.class || 
                        result?.studentId?.class || 
                        test?.class || 
                        'Class Not Available';
    
    const studentBoard = student?.board || 
                        user?.board || 
                        result?.studentId?.board || 
                        test?.board || 
                        'Board Not Available';
    
    const studentSchool = student?.school || 
                         user?.school || 
                         result?.studentId?.school || 
                         test?.school || 
                         'School Not Available';
    const examDate = result?.submittedAt ? 
                    new Date(result.submittedAt).toLocaleDateString('en-GB') : 
                    result?.createdAt ? 
                    new Date(result.createdAt).toLocaleDateString('en-GB') : 
                    'Date Not Available';
    
    
    console.log('Student info debug in certificate:', {
      apiStudent: student,
      userFromAuth: { class: user?.class, board: user?.board, school: user?.school },
      resultStudentId: result?.studentId,
      finalValues: {
        name: studentName,
        class: studentClass,
        board: studentBoard,
        school: studentSchool,
        regNum: registrationNumber
      }
    });
    
    const studentData = [
      ['Student Name:', studentName],
      ['Registration Number:', registrationNumber],
      ['Class/Grade:', studentClass],
      ['Board/Curriculum:', studentBoard],
      ['School:', studentSchool],
      ['Examination Date:', examDate]
    ];
    
    yPosition += 8;
    studentData.forEach((row, index) => {
      const rowY = yPosition + (index * 7);
      // Row background
      if (index % 2 === 0) {
        pdf.setFillColor(248, 250, 252);
        pdf.rect(20, rowY - 2, pageWidth - 40, 6, 'F');
      }
      
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(60, 60, 60);
      pdf.text(row[0], 25, rowY + 2);
      
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(20, 20, 20);
      pdf.text(row[1], 90, rowY + 2);
    });
    
    yPosition += 50; // Increased to accommodate the additional school field

    // Examination Details Section
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(0, 51, 102);
    pdf.text('EXAMINATION DETAILS', 20, yPosition);
    
    // Extract test details with comprehensive fallback logic
    console.log('Test data structure:', test);
    console.log('Result data structure:', result);
    
    // Try multiple field names for duration (based on Test model: duration field is in minutes)
    const testDuration = test?.duration || 
                        test?.timeLimit || 
                        result?.duration ||
                        result?.timeLimit;
    
    // Try multiple field names for questions count (based on Test model: questionsCount field)
    const testQuestions = test?.questionsCount ||     // Primary field from Test model
                         test?.questions?.length || 
                         test?.totalQuestions || 
                         test?.questionCount ||
                         result?.questionWiseMarks?.length ||  // From Result model
                         result?.totalQuestions || 
                         result?.questions?.length ||
                         result?.questionCount;
    
    console.log('Extracted test details:', {
      duration: testDuration,
      questions: testQuestions,
      testType: test?.testType || test?.type,
      availableFields: {
        testDuration: test?.duration,
        testTimeLimit: test?.timeLimit,
        testQuestions: test?.questions?.length,
        testTotalQuestions: test?.totalQuestions,
        testQuestionsCount: test?.questionsCount,
        resultTotalQuestions: result?.totalQuestions
      }
    });
    
    const testType = test?.testType || test?.type || 'Standard Assessment';
    
    yPosition += 10;
    const examData = [
      ['Examination Title:', test?.title || 'Academic Assessment'],
      ['Subject:', test?.subject || 'General'],
      ['Duration:', testDuration && testDuration > 0 ? `${testDuration} minutes` : 'Duration Not Specified'],
      ['Total Questions:', testQuestions && testQuestions > 0 ? testQuestions.toString() : 'Questions Count Not Available'],
      ['Test Type:', testType]
    ];
    
    examData.forEach((row, index) => {
      const rowY = yPosition + (index * 7);
      if (index % 2 === 0) {
        pdf.setFillColor(248, 250, 252);
        pdf.rect(20, rowY - 2, pageWidth - 40, 6, 'F');
      }
      
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(60, 60, 60);
      pdf.text(row[0], 25, rowY + 2);
      
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(20, 20, 20);
      pdf.text(row[1], 90, rowY + 2);
    });
    
    yPosition += 45;

    // Performance Summary Section
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(0, 51, 102);
    pdf.text('PERFORMANCE SUMMARY', 20, yPosition);
    
    yPosition += 10;
    
    // Performance summary table with colored background
    const performanceData = [
      ['Total Marks', result.totalMarks?.toString() || '0'],
      ['Passing Marks', test.passingMarks?.toString() || '0'],
      ['Marks Obtained', result.marksObtained?.toString() || '0'],
      ['Percentage Score', `${percentage}%`],
      ['Letter Grade', grade],
      ['Result Status', isPass ? 'PASS' : 'FAIL']
    ];
    
    // Table border
    pdf.setDrawColor(0, 51, 102);
    pdf.setLineWidth(1);
    pdf.rect(20, yPosition - 3, pageWidth - 40, (performanceData.length * 10) + 6);
    
    // Table header
    pdf.setFillColor(0, 51, 102);
    pdf.rect(20, yPosition - 3, pageWidth - 40, 10, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(255, 255, 255);
    pdf.text('Assessment Criteria', 25, yPosition + 3);
    pdf.text('Achievement', pageWidth - 60, yPosition + 3);
    
    yPosition += 10;
    
    performanceData.forEach((row, index) => {
      const rowY = yPosition + (index * 10);
      
      // Alternating row colors
      if (index % 2 === 0) {
        pdf.setFillColor(248, 250, 252);
        pdf.rect(20, rowY - 3, pageWidth - 40, 10, 'F');
      }
      
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(40, 40, 40);
      pdf.text(row[0], 25, rowY + 3);
      
      // Color-code important values
      if (row[0] === 'Result Status') {
        if (isPass) {
          pdf.setTextColor(34, 139, 34);
        } else {
          pdf.setTextColor(220, 20, 60);
        }
        pdf.setFont('helvetica', 'bold');
      } else if (row[0] === 'Letter Grade') {
        const gradeColors = {
          'A+': [34, 139, 34], 'A': [34, 139, 34],
          'B+': [255, 140, 0], 'B': [255, 140, 0],
          'C+': [255, 193, 7], 'C': [255, 193, 7],
          'F': [220, 20, 60]
        };
        const color = gradeColors[grade] || [40, 40, 40];
        pdf.setTextColor(color[0], color[1], color[2]);
        pdf.setFont('helvetica', 'bold');
      } else if (row[0] === 'Percentage Score') {
        const score = parseFloat(percentage);
        if (score >= 80) {
          pdf.setTextColor(34, 139, 34);
        } else if (score >= 60) {
          pdf.setTextColor(255, 140, 0);
        } else if (score >= 40) {
          pdf.setTextColor(255, 193, 7);
        } else {
          pdf.setTextColor(220, 20, 60);
        }
        pdf.setFont('helvetica', 'bold');
      } else {
        pdf.setTextColor(40, 40, 40);
        pdf.setFont('helvetica', 'normal');
      }
      
      pdf.text(row[1], pageWidth - 60, rowY + 3);
    });
    
    yPosition += performanceData.length * 10 + 20;
    // Question-wise Performance Analysis
    if (result.questionWiseMarks && result.questionWiseMarks.length > 0) {
      // Check if we need a new page
      if (yPosition > pageHeight - 100) {
        pdf.addPage();
        yPosition = 30;
      }
      
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.setTextColor(0, 51, 102);
      pdf.text('QUESTION-WISE PERFORMANCE ANALYSIS', 20, yPosition);
      
      yPosition += 15;
      
      // Table border
      const tableHeight = (result.questionWiseMarks.length + 1) * 8 + 6;
      pdf.setDrawColor(0, 51, 102);
      pdf.setLineWidth(1);
      pdf.rect(20, yPosition - 3, pageWidth - 40, Math.min(tableHeight, pageHeight - yPosition - 50));
      
      // Table headers
      pdf.setFillColor(0, 51, 102);
      pdf.rect(20, yPosition - 3, pageWidth - 40, 8, 'F');
      
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(255, 255, 255);
      pdf.text('Q.No', 25, yPosition + 2);
      pdf.text('Max Marks', 50, yPosition + 2);
      pdf.text('Obtained', 85, yPosition + 2);
      pdf.text('Performance', 120, yPosition + 2);
      pdf.text('Remarks', 155, yPosition + 2);
      
      yPosition += 8;
      
      result.questionWiseMarks.forEach((q, index) => {
        const rowY = yPosition + (index * 8);
        
        // Check for page break
        if (rowY > pageHeight - 30) {
          pdf.addPage();
          yPosition = 30;
          // Repeat headers on new page
          pdf.setFillColor(0, 51, 102);
          pdf.rect(20, yPosition - 3, pageWidth - 40, 8, 'F');
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(10);
          pdf.setTextColor(255, 255, 255);
          pdf.text('Q.No', 25, yPosition + 2);
          pdf.text('Max Marks', 50, yPosition + 2);
          pdf.text('Obtained', 85, yPosition + 2);
          pdf.text('Performance', 120, yPosition + 2);
          pdf.text('Remarks', 155, yPosition + 2);
          yPosition += 8;
          rowY = yPosition + (index * 8);
        }
        
        // Alternating row colors
        if (index % 2 === 0) {
          pdf.setFillColor(248, 250, 252);
          pdf.rect(20, rowY - 3, pageWidth - 40, 8, 'F');
        }
        
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(40, 40, 40);
        pdf.text(String(q.questionNo), 27, rowY + 2);
        pdf.text(String(q.maxMarks), 55, rowY + 2);
        pdf.text(String(q.obtainedMarks), 90, rowY + 2);
        
        // Performance percentage with color
        const qPerformance = ((q.obtainedMarks / q.maxMarks) * 100).toFixed(0);
        if (qPerformance >= 80) {
          pdf.setTextColor(34, 139, 34);
        } else if (qPerformance >= 60) {
          pdf.setTextColor(255, 140, 0);
        } else if (qPerformance >= 40) {
          pdf.setTextColor(255, 193, 7);
        } else {
          pdf.setTextColor(220, 20, 60);
        }
        pdf.text(`${qPerformance}%`, 125, rowY + 2);
        
        // Remarks
        pdf.setTextColor(60, 60, 60);
        const remarks = q.remarks || (q.obtainedMarks === q.maxMarks ? 'Excellent' : 
                        q.obtainedMarks >= (q.maxMarks * 0.8) ? 'Good' :
                        q.obtainedMarks >= (q.maxMarks * 0.5) ? 'Satisfactory' : 'Needs Improvement');
        const truncatedRemarks = remarks.length > 12 ? remarks.substring(0, 12) + '...' : remarks;
        pdf.text(truncatedRemarks, 157, rowY + 2);
      });
      
      yPosition += result.questionWiseMarks.length * 8 + 15;
    }

    // Examiner Comments Section
    if (result.adminComments) {
      if (yPosition > pageHeight - 50) {
        pdf.addPage();
        yPosition = 30;
      }
      
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.setTextColor(0, 51, 102);
      pdf.text('EXAMINER COMMENTS', 20, yPosition);
      
      yPosition += 10;
      
      pdf.setFillColor(255, 248, 220); // Light yellow background
      pdf.rect(20, yPosition - 5, pageWidth - 40, 25, 'F');
      pdf.setDrawColor(255, 193, 7);
      pdf.setLineWidth(1);
      pdf.rect(20, yPosition - 5, pageWidth - 40, 25);
      
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(40, 40, 40);
      const splitComments = pdf.splitTextToSize(result.adminComments, pageWidth - 50);
      pdf.text(splitComments, 25, yPosition + 2);
      
      yPosition += 35;
    }

    // Official Footer Section
    yPosition = Math.max(yPosition, pageHeight - 60);
    
    // Guardian signature section
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(40, 40, 40);
    pdf.text('Guardian Signature:', 25, yPosition);
    pdf.text('Date:', 120, yPosition);
    
    // Signature lines
    pdf.setDrawColor(100, 100, 100);
    pdf.setLineWidth(0.5);
    pdf.line(60, yPosition, 110, yPosition);
    pdf.line(135, yPosition, 180, yPosition);
    
    yPosition += 15;
    
    // Online verification link (without QR code since it's now in header)
    if (qrDataUrl) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(0, 51, 102);
      pdf.text('Online Verification Available at:', 25, yPosition);
      pdf.textWithLink('https://computech-exam-platform.onrender.com', 25, yPosition + 6, { 
        url: `https://computech-exam-platform.onrender.com/result/${resultId}` 
      });
      yPosition += 20;
    }
    
    // Official Footer
    yPosition = Math.max(yPosition, pageHeight - 30);
    
    // Footer border
    pdf.setDrawColor(0, 51, 102);
    pdf.setLineWidth(1);
    pdf.line(20, yPosition, pageWidth - 20, yPosition);
    
    // Footer content
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(8);
    pdf.setTextColor(100, 100, 100);
    pdf.text('This is a computer-generated result certificate and does not require physical signature.', pageWidth / 2, yPosition + 6, { align: 'center' });
    pdf.text('For queries and verification, contact: examination@computech.edu', pageWidth / 2, yPosition + 10, { align: 'center' });
    
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(0, 51, 102);
    pdf.text('COMPUTECH EDUCATIONAL INSTITUTE', pageWidth / 2, yPosition + 16, { align: 'center' });

    // Save with formal naming using extracted data
    const dateStamp = new Date().toISOString().split('T')[0];
    const cleanStudentName = studentName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '') || 'Student';
    const cleanTestName = test?.title?.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '') || 'Test';
    pdf.save(`${cleanStudentName}_${cleanTestName}_Result_Certificate_${dateStamp}.pdf`);
  };

  // Enhanced fallback logic for UI display (same as PDF generation)
  const getStudentInfo = () => {
    const studentName = student?.name || user?.name || result?.studentId?.name || 'Student Name Not Available';
    const studentClass = student?.class || user?.class || result?.studentId?.class || test?.class || 'Class Not Available';
    const studentBoard = student?.board || user?.board || result?.studentId?.board || test?.board || 'Board Not Available';
    const studentSchool = student?.school || user?.school || result?.studentId?.school || test?.school || 'School Not Available';
    
    console.log('UI Student info debug:', {
      apiStudent: student,
      userFromAuth: { class: user?.class, board: user?.board, school: user?.school },
      resultStudentId: result?.studentId,
      testData: { class: test?.class, board: test?.board, school: test?.school },
      finalUIValues: {
        name: studentName,
        class: studentClass,
        board: studentBoard,
        school: studentSchool
      }
    });

    return { studentName, studentClass, studentBoard, studentSchool };
  };

  const studentInfo = getStudentInfo();

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
              <p><strong>Class:</strong> {studentInfo.studentClass}</p>
              <p><strong>Board:</strong> {studentInfo.studentBoard}</p>
              <p><strong>School:</strong> {studentInfo.studentSchool}</p>
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
      <section className={styles.iframeSection} aria-live="polite">
        {showDoc === 'question' && questionPaperURL && (
          <DrivePdf src={questionPaperURL} title="Question Paper" />
        )}

        {showDoc === 'answer' && answerSheetURL && (
          <DrivePdf src={answerSheetURL} title="Answer Sheet" />
        )}

        {showDoc === 'key' && answerKeyURL && (
          <DrivePdf src={answerKeyURL} title="Answer Key" />
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

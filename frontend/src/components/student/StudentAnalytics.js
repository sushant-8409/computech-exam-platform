import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useTheme } from '../../App';
import { toast } from 'react-toastify';
import axios from 'axios';
import { Line, Bar, Doughnut, Radar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  RadialLinearScale,
} from 'chart.js';
import jsPDF from 'jspdf';
import styles from './StudentAnalytics.module.css';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  RadialLinearScale
);

const StudentAnalytics = ({ results = [], tests = [], isVisible, onClose }) => {
  const { user } = useAuth();
  const { darkMode } = useTheme();
  const navigate = useNavigate();
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const [analyticsView, setAnalyticsView] = useState('overview'); // overview, performance, trends, subjects, rankings
  const [rankings, setRankings] = useState([]);
  const [loadingRankings, setLoadingRankings] = useState(false);
  const [studentRank, setStudentRank] = useState(null);

  // Fetch rankings data
  const fetchRankings = async () => {
    if (!isVisible) return;
    
    setLoadingRankings(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const [rankingsResponse, studentRankResponse] = await Promise.all([
        axios.get('/api/coding-practice/rankings', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get('/api/coding-practice/student-rank', {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (rankingsResponse.data.success) {
        setRankings(rankingsResponse.data.data || []);
      }

      if (studentRankResponse.data.success && studentRankResponse.data.rank) {
        setStudentRank(studentRankResponse.data.rank);
      }
    } catch (error) {
      console.error('Error fetching rankings:', error);
      // Don't show error toast for rankings as it's supplementary data
    } finally {
      setLoadingRankings(false);
    }
  };

  // Fetch rankings when analytics is opened
  useEffect(() => {
    if (isVisible) {
      fetchRankings();
    }
  }, [isVisible]);

  // Calculate comprehensive analytics
  const analytics = useMemo(() => {
    if (!results || results.length === 0) {
      return {
        totalTests: 0,
        averageScore: 0,
        highestScore: 0,
        lowestScore: 0,
        passingRate: 0,
        improvementTrend: 0,
        subjectPerformance: {},
        monthlyProgress: [],
        gradeDistribution: {},
        strengths: [],
        weaknesses: []
      };
    }

    const validResults = results.filter(r => 
      r?.marksObtained !== undefined && 
      r?.totalMarks > 0 && 
      ['published', 'reviewed'].includes(r?.status)
    );

    if (validResults.length === 0) {
      return {
        totalTests: 0,
        averageScore: 0,
        highestScore: 0,
        lowestScore: 0,
        passingRate: 0,
        improvementTrend: 0,
        subjectPerformance: {},
        monthlyProgress: [],
        gradeDistribution: {},
        strengths: [],
        weaknesses: []
      };
    }

    // Basic statistics
    const scores = validResults.map(r => (r.marksObtained / r.totalMarks) * 100);
    const totalTests = validResults.length;
    const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const highestScore = Math.max(...scores);
    const lowestScore = Math.min(...scores);
    
    // Calculate passing rate (assuming 40% is passing)
    const passingScores = scores.filter(score => score >= 40);
    const passingRate = (passingScores.length / scores.length) * 100;

    // Calculate improvement trend (compare first half vs second half)
    const mid = Math.floor(scores.length / 2);
    const firstHalf = scores.slice(0, mid);
    const secondHalf = scores.slice(mid);
    const firstHalfAvg = firstHalf.length > 0 ? firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length : 0;
    const secondHalfAvg = secondHalf.length > 0 ? secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length : 0;
    const improvementTrend = secondHalfAvg - firstHalfAvg;

    // Subject-wise performance
    const subjectPerformance = {};
    validResults.forEach(r => {
      const subject = r.testTitle?.split(' ')[0] || r.testId?.subject || 'General';
      if (!subjectPerformance[subject]) {
        subjectPerformance[subject] = { scores: [], totalMarks: 0, totalObtained: 0 };
      }
      const percentage = (r.marksObtained / r.totalMarks) * 100;
      subjectPerformance[subject].scores.push(percentage);
      subjectPerformance[subject].totalMarks += r.totalMarks;
      subjectPerformance[subject].totalObtained += r.marksObtained;
    });

    // Calculate subject averages
    Object.keys(subjectPerformance).forEach(subject => {
      const data = subjectPerformance[subject];
      data.average = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
      data.percentage = (data.totalObtained / data.totalMarks) * 100;
    });

    // Monthly progress
    const monthlyProgress = {};
    validResults.forEach(r => {
      if (r.submittedAt) {
        const date = new Date(r.submittedAt);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!monthlyProgress[monthKey]) {
          monthlyProgress[monthKey] = { scores: [], count: 0 };
        }
        monthlyProgress[monthKey].scores.push((r.marksObtained / r.totalMarks) * 100);
        monthlyProgress[monthKey].count++;
      }
    });

    const monthlyProgressArray = Object.keys(monthlyProgress)
      .sort()
      .map(month => ({
        month,
        average: monthlyProgress[month].scores.reduce((a, b) => a + b, 0) / monthlyProgress[month].scores.length,
        count: monthlyProgress[month].count
      }));

    // Grade distribution
    const gradeDistribution = {
      'A+ (90-100%)': scores.filter(s => s >= 90).length,
      'A (80-89%)': scores.filter(s => s >= 80 && s < 90).length,
      'B+ (70-79%)': scores.filter(s => s >= 70 && s < 80).length,
      'B (60-69%)': scores.filter(s => s >= 60 && s < 70).length,
      'C (50-59%)': scores.filter(s => s >= 50 && s < 60).length,
      'D (40-49%)': scores.filter(s => s >= 40 && s < 50).length,
      'F (Below 40%)': scores.filter(s => s < 40).length,
    };

    // Strengths and weaknesses
    const sortedSubjects = Object.entries(subjectPerformance)
      .sort(([,a], [,b]) => b.average - a.average);
    
    const strengths = sortedSubjects.slice(0, Math.ceil(sortedSubjects.length / 2))
      .map(([subject, data]) => ({ subject, score: data.average.toFixed(1) }));
    
    const weaknesses = sortedSubjects.slice(Math.ceil(sortedSubjects.length / 2))
      .map(([subject, data]) => ({ subject, score: data.average.toFixed(1) }));

    return {
      totalTests,
      averageScore,
      highestScore,
      lowestScore,
      passingRate,
      improvementTrend,
      subjectPerformance,
      monthlyProgress: monthlyProgressArray,
      gradeDistribution,
      strengths,
      weaknesses
    };
  }, [results]);

  // Handle subject performance click - navigate to results filtered by subject
  const handleSubjectClick = (subject) => {
    
    // Find all results for this subject with more flexible matching
    const subjectResults = results.filter(result => {
      // Try to find the test by different ID fields
      const test = tests.find(t => 
        t._id === result.testId || 
        t._id === result.test || 
        t.id === result.testId ||
        t.id === result.test
      );
      

      
      // More flexible subject matching
      const subjectMatch = test && (
        test.subject === subject ||
        test.subject?.toLowerCase() === subject?.toLowerCase() ||
        test.title?.toLowerCase().includes(subject?.toLowerCase())
      );
      
      const statusMatch = ['published', 'reviewed'].includes(result?.status);
      
      return subjectMatch && statusMatch;
    });



    if (subjectResults.length > 0) {
      // Navigate to the most recent result for this subject
      const mostRecentResult = subjectResults.sort((a, b) => {
        const dateA = new Date(a.submittedAt || a.createdAt || a.updatedAt || 0);
        const dateB = new Date(b.submittedAt || b.createdAt || b.updatedAt || 0);
        return dateB - dateA;
      })[0];
      

      
      // Navigate to result detail with subject context
      navigate(`/student/result/${mostRecentResult._id}?subject=${encodeURIComponent(subject)}`);
      onClose(); // Close the analytics modal
    } else {
      console.log('No results found for subject:', subject);
      
      // Try to show all results for debugging
      if (results.length > 0) {
        console.log('Available test subjects:');
        results.forEach(result => {
          const test = tests.find(t => t._id === result.testId);
          if (test) {
            console.log(`- ${test.subject} (${test.title})`);
          }
        });
        
        // Navigate to the first available result as fallback
        const firstResult = results.find(r => ['published', 'reviewed'].includes(r?.status));
        if (firstResult) {
          console.log('Using fallback result:', firstResult._id);
          navigate(`/student/result/${firstResult._id}?subject=${encodeURIComponent(subject)}`);
          onClose();
          toast.info(`Showing results - specific ${subject} results may not be available`);
        } else {
          toast.info(`No detailed results available for ${subject}`);
        }
      } else {
        toast.info(`No detailed results available for ${subject}`);
      }
    }
  };

  // Chart configurations
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: darkMode ? '#f9fafb' : '#1f2937',
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: darkMode ? '#d1d5db' : '#6b7280',
        },
        grid: {
          color: darkMode ? '#374151' : '#e5e7eb',
        },
      },
      y: {
        ticks: {
          color: darkMode ? '#d1d5db' : '#6b7280',
        },
        grid: {
          color: darkMode ? '#374151' : '#e5e7eb',
        },
      },
    },
  };

  // Performance trend chart data
  const performanceTrendData = {
    labels: analytics.monthlyProgress.map(item => {
      const [year, month] = item.month.split('-');
      return new Date(year, month - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }),
    datasets: [
      {
        label: 'Average Score (%)',
        data: analytics.monthlyProgress.map(item => item.average.toFixed(1)),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
      },
    ],
  };

  // Subject performance chart data
  const subjectPerformanceData = {
    labels: Object.keys(analytics.subjectPerformance),
    datasets: [
      {
        label: 'Average Score (%)',
        data: Object.values(analytics.subjectPerformance).map(subject => subject.average.toFixed(1)),
        backgroundColor: [
          '#ef4444', '#f59e0b', '#10b981', '#3b82f6', 
          '#8b5cf6', '#f97316', '#06b6d4', '#84cc16'
        ],
        borderColor: [
          '#dc2626', '#d97706', '#059669', '#2563eb',
          '#7c3aed', '#ea580c', '#0891b2', '#65a30d'
        ],
        borderWidth: 2,
      },
    ],
  };

  // Grade distribution chart data
  const gradeDistributionData = {
    labels: Object.keys(analytics.gradeDistribution),
    datasets: [
      {
        data: Object.values(analytics.gradeDistribution),
        backgroundColor: [
          '#10b981', '#34d399', '#6ee7b7', '#fbbf24', '#fb923c', '#f87171', '#ef4444'
        ],
        borderColor: [
          '#059669', '#10b981', '#34d399', '#d97706', '#ea580c', '#dc2626', '#b91c1c'
        ],
        borderWidth: 2,
      },
    ],
  };

  // Performance radar chart data
  const radarData = {
    labels: Object.keys(analytics.subjectPerformance).slice(0, 6), // Limit to 6 subjects for clarity
    datasets: [
      {
        label: 'Performance (%)',
        data: Object.values(analytics.subjectPerformance).slice(0, 6).map(subject => subject.average),
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        borderColor: '#3b82f6',
        borderWidth: 2,
        pointBackgroundColor: '#3b82f6',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: '#3b82f6',
      },
    ],
  };

  const radarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: darkMode ? '#f9fafb' : '#1f2937',
        },
      },
    },
    scales: {
      r: {
        angleLines: {
          color: darkMode ? '#374151' : '#e5e7eb',
        },
        grid: {
          color: darkMode ? '#374151' : '#e5e7eb',
        },
        ticks: {
          color: darkMode ? '#d1d5db' : '#6b7280',
          backdropColor: 'transparent',
        },
        pointLabels: {
          color: darkMode ? '#f9fafb' : '#1f2937',
        },
        min: 0,
        max: 100,
      },
    },
  };

  // Download PDF function with formal institutional design
  const downloadPerformancePDF = async () => {
    setDownloadingPDF(true);
    try {
      console.log('Starting PDF generation with data:', {
        studentInfo: user,
        analytics,
        subjectPerformance: analytics.subjectPerformance,
        results: results?.length,
        tests: tests?.length
      });

      if (!user || !analytics || !analytics.subjectPerformance || Object.keys(analytics.subjectPerformance).length === 0) {
        console.error('Missing required data for PDF generation:', {
          user: !!user,
          analytics: !!analytics,
          subjectPerformance: !!analytics.subjectPerformance
        });
        throw new Error('Missing required data for PDF generation');
      }

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
      
      // Institution name
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(18);
      pdf.setTextColor(255, 255, 255);
      pdf.text('COMPUTECH EDUCATIONAL INSTITUTE', pageWidth / 2, 22, { align: 'center' });
      
      // Sub-header
      pdf.setFontSize(10);
      pdf.setTextColor(255, 255, 255);
      pdf.text('Excellence in Academic Assessment & Performance Analytics', pageWidth / 2, 26, { align: 'center' });
      
      // Report title
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(16);
      pdf.setTextColor(0, 51, 102);
      pdf.text('STUDENT PERFORMANCE ANALYTICS REPORT', pageWidth / 2, 38, { align: 'center' });
      
      // Academic session info
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 100);
      const currentDate = new Date();
      const academicYear = `${currentDate.getFullYear()}-${currentDate.getFullYear() + 1}`;
      pdf.text(`Academic Session: ${academicYear}`, pageWidth / 2, 45, { align: 'center' });
      pdf.text(`Report Generated: ${currentDate.toLocaleDateString('en-GB')} at ${currentDate.toLocaleTimeString('en-GB')}`, pageWidth / 2, 50, { align: 'center' });
      
      // Student Information Section
      let yPosition = 75;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.setTextColor(0, 51, 102);
      pdf.text('STUDENT INFORMATION', 20, yPosition);
      
      // Student info table
      pdf.setDrawColor(200, 200, 200);
      pdf.setLineWidth(0.5);
      
      // Table headers
      // Enhanced fallback logic for student information
      const studentName = user?.name || 'Student Name Not Available';
      const registrationNumber = user?.registrationNumber || 
                                user?.rollNo || 
                                user?._id?.slice(-8) || 
                                'REG-NOT-AVAILABLE';
      
      // Try multiple sources for class, board, and school information
      // Check user auth data, then first result's student data, then test data
      const firstResultWithStudent = results.find(r => r.studentId);
      const studentClass = user?.class || 
                          firstResultWithStudent?.studentId?.class || 
                          tests[0]?.class || 
                          'Class Not Available';
      
      const studentBoard = user?.board || 
                          firstResultWithStudent?.studentId?.board || 
                          tests[0]?.board || 
                          'Board Not Available';
      
      const studentSchool = user?.school || 
                           firstResultWithStudent?.studentId?.school || 
                           tests[0]?.school || 
                           'School Not Available';
      
      console.log('Student info debug:', {
        userAuth: { class: user?.class, board: user?.board, school: user?.school },
        firstResultStudent: firstResultWithStudent?.studentId,
        firstTest: tests[0],
        finalValues: {
          class: studentClass,
          board: studentBoard,
          school: studentSchool
        }
      });
      
      const infoData = [
        ['Student Name:', studentName],
        ['Registration Number:', registrationNumber],
        ['Class/Grade:', studentClass],
        ['Board/Curriculum:', studentBoard],
        ['School:', studentSchool],
        ['Assessment Period:', `${new Date(results[results.length - 1]?.submittedAt || new Date()).toLocaleDateString('en-GB')} to ${new Date().toLocaleDateString('en-GB')}`]
      ];
      
      yPosition += 8;
      infoData.forEach((row, index) => {
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
        pdf.text(row[1], 80, rowY + 2);
      });
      
      yPosition += 50; // Increased to accommodate the additional school field
      
      // Examination Details Section
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.setTextColor(0, 51, 102);
      pdf.text('EXAMINATION DETAILS', 20, yPosition);
      
      // Get test details from available data
      const testDetails = [];
      results.forEach(result => {
        const test = tests.find(t => t._id === result.testId);
        if (test) {
          testDetails.push({
            title: test.title,
            subject: test.subject,
            duration: test.duration || test.timeLimit,
            questions: test.questions?.length || test.totalQuestions || result.totalQuestions,
            testType: test.testType || test.type
          });
        }
      });
      
      // Use the most common or recent values
      const mostRecentTest = testDetails[testDetails.length - 1] || {};
      const avgDuration = testDetails.length > 0 
        ? Math.round(testDetails.reduce((sum, test) => sum + (test.duration || 0), 0) / testDetails.length)
        : 0;
      
      const avgQuestions = testDetails.length > 0 
        ? Math.round(testDetails.reduce((sum, test) => sum + (test.questions || 0), 0) / testDetails.length)
        : 0;
      
      // Get the most common subject
      const subjectCounts = {};
      testDetails.forEach(test => {
        if (test.subject) {
          subjectCounts[test.subject] = (subjectCounts[test.subject] || 0) + 1;
        }
      });
      const mostCommonSubject = Object.keys(subjectCounts).length > 0 
        ? Object.keys(subjectCounts).reduce((a, b) => subjectCounts[a] > subjectCounts[b] ? a : b)
        : Object.keys(analytics.subjectPerformance)[0] || 'General';
      
      // Examination info table
      const examData = [
        ['Examination Title:', mostRecentTest.title || 'Academic Assessment'],
        ['Subject:', mostCommonSubject],
        ['Duration:', avgDuration > 0 ? `${avgDuration} minutes` : (testDetails.length === 1 ? 'Single Assessment' : 'Variable Duration')],
        ['Total Questions:', avgQuestions > 0 ? avgQuestions.toString() : (testDetails.length === 1 ? 'Single Test Format' : 'Variable Count')],
        ['Test Type:', mostRecentTest.testType || 'Standard Assessment']
      ];
      
      yPosition += 8;
      examData.forEach((row, index) => {
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
        pdf.text(row[1], 80, rowY + 2);
      });
      
      yPosition += 45;
      
      // Overall Performance Summary Section
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.setTextColor(0, 51, 102);
      pdf.text('OVERALL PERFORMANCE SUMMARY', 20, yPosition);
      
      // Performance summary table
      yPosition += 10;
      const summaryData = [
        ['Total Assessments Completed', analytics.totalTests.toString()],
        ['Overall Average Score', `${analytics.averageScore.toFixed(1)}%`],
        ['Highest Achievement', `${analytics.highestScore.toFixed(1)}%`],
        ['Lowest Score Recorded', `${analytics.lowestScore.toFixed(1)}%`],
        ['Success Rate (≥40%)', `${analytics.passingRate.toFixed(1)}%`],
        ['Performance Trajectory', `${analytics.improvementTrend >= 0 ? '+' : ''}${analytics.improvementTrend.toFixed(1)}%`]
      ];
      
      // Table border
      pdf.setDrawColor(0, 51, 102);
      pdf.setLineWidth(1);
      pdf.rect(20, yPosition - 3, pageWidth - 40, (summaryData.length * 8) + 6);
      
      // Table header
      pdf.setFillColor(0, 51, 102);
      pdf.rect(20, yPosition - 3, pageWidth - 40, 8, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(255, 255, 255);
      pdf.text('Performance Metric', 25, yPosition + 2);
      pdf.text('Value', pageWidth - 60, yPosition + 2);
      
      yPosition += 8;
      summaryData.forEach((row, index) => {
        const rowY = yPosition + (index * 8);
        
        // Alternating row colors
        if (index % 2 === 0) {
          pdf.setFillColor(248, 250, 252);
          pdf.rect(20, rowY - 3, pageWidth - 40, 8, 'F');
        }
        
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.setTextColor(40, 40, 40);
        pdf.text(row[0], 25, rowY + 2);
        
        // Color-code performance values
        const value = parseFloat(row[1]);
        if (!isNaN(value)) {
          if (row[0].includes('Average') || row[0].includes('Highest') || row[0].includes('Success')) {
            if (value >= 80) {
              pdf.setTextColor(34, 139, 34);  // Green for excellent
            } else if (value >= 60) {
              pdf.setTextColor(255, 140, 0);  // Orange for good
            } else {
              pdf.setTextColor(220, 20, 60);  // Red for needs improvement
            }
          } else {
            pdf.setTextColor(40, 40, 40);
          }
        } else {
          pdf.setTextColor(40, 40, 40);
        }
        
        pdf.setFont('helvetica', 'bold');
        pdf.text(row[1], pageWidth - 60, rowY + 2);
      });
      
      yPosition += summaryData.length * 8 + 15;
      
      // Subject-wise Performance Analysis
      if (Object.keys(analytics.subjectPerformance).length > 0) {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(12);
        pdf.setTextColor(0, 51, 102);
        pdf.text('SUBJECT-WISE PERFORMANCE ANALYSIS', 20, yPosition);
        
        yPosition += 10;
        
        // Subject performance table
        const subjectEntries = Object.entries(analytics.subjectPerformance);
        const tableHeight = (subjectEntries.length + 1) * 10 + 6;
        
        // Table border
        pdf.setDrawColor(0, 51, 102);
        pdf.setLineWidth(1);
        pdf.rect(20, yPosition - 3, pageWidth - 40, tableHeight);
        
        // Table headers
        pdf.setFillColor(0, 51, 102);
        pdf.rect(20, yPosition - 3, pageWidth - 40, 10, 'F');
        
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.setTextColor(255, 255, 255);
        pdf.text('Subject', 25, yPosition + 3);
        pdf.text('Tests', 80, yPosition + 3);
        pdf.text('Average %', 110, yPosition + 3);
        pdf.text('Highest %', 140, yPosition + 3);
        pdf.text('Grade', 170, yPosition + 3);
        
        yPosition += 10;
        
        subjectEntries.forEach(([subject, data], index) => {
          const rowY = yPosition + (index * 10);
          
          // Alternating row colors
          if (index % 2 === 0) {
            pdf.setFillColor(248, 250, 252);
            pdf.rect(20, rowY - 3, pageWidth - 40, 10, 'F');
          }
          
          // Subject name
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(9);
          pdf.setTextColor(40, 40, 40);
          const truncatedSubject = subject.length > 15 ? subject.substring(0, 15) + '...' : subject;
          pdf.text(truncatedSubject, 25, rowY + 3);
          
          // Tests count
          pdf.text(data.scores.length.toString(), 85, rowY + 3);
          
          // Average with color coding
          const avgScore = data.average;
          if (avgScore >= 80) {
            pdf.setTextColor(34, 139, 34);  // Green
          } else if (avgScore >= 60) {
            pdf.setTextColor(255, 140, 0);  // Orange
          } else if (avgScore >= 40) {
            pdf.setTextColor(255, 193, 7);  // Yellow
          } else {
            pdf.setTextColor(220, 20, 60);  // Red
          }
          pdf.setFont('helvetica', 'bold');
          pdf.text(avgScore.toFixed(1), 115, rowY + 3);
          
          // Highest score
          pdf.setTextColor(34, 139, 34);
          pdf.text(Math.max(...data.scores).toFixed(1), 145, rowY + 3);
          
          // Grade calculation and color coding
          const grade = avgScore >= 90 ? 'A+' :
                       avgScore >= 80 ? 'A' :
                       avgScore >= 70 ? 'B+' :
                       avgScore >= 60 ? 'B' :
                       avgScore >= 50 ? 'C+' :
                       avgScore >= 40 ? 'C' : 'F';
          
          if (grade.startsWith('A')) {
            pdf.setTextColor(34, 139, 34);   // Green
          } else if (grade.startsWith('B')) {
            pdf.setTextColor(255, 140, 0);   // Orange
          } else if (grade.startsWith('C')) {
            pdf.setTextColor(255, 193, 7);   // Yellow
          } else {
            pdf.setTextColor(220, 20, 60);   // Red
          }
          pdf.text(grade, 175, rowY + 3);
          
          if (yPosition > pageHeight - 50) {
            pdf.addPage();
            yPosition = 20;
          }
        });
        
        yPosition += subjectEntries.length * 10 + 15;
      }
      
      // Academic Performance Analysis
      if (analytics.strengths.length > 0 || analytics.weaknesses.length > 0) {
        // Check if we need a new page
        if (yPosition > pageHeight - 80) {
          pdf.addPage();
          yPosition = 30;
        }
        
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(12);
        pdf.setTextColor(0, 51, 102);
        pdf.text('ACADEMIC PERFORMANCE ANALYSIS', 20, yPosition);
        yPosition += 15;
        
        // Strengths Section
        if (analytics.strengths.length > 0) {
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(11);
          pdf.setTextColor(34, 139, 34);
          pdf.text('AREAS OF STRENGTH:', 25, yPosition);
          yPosition += 8;
          
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(10);
          pdf.setTextColor(40, 40, 40);
          
          analytics.strengths.slice(0, 3).forEach((strength, index) => {
            pdf.text(`${index + 1}. ${strength.subject}: Excellent performance with ${strength.score}% average`, 30, yPosition);
            yPosition += 6;
          });
          yPosition += 5;
        }
        
        // Areas for Improvement Section
        if (analytics.weaknesses.length > 0) {
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(11);
          pdf.setTextColor(220, 20, 60);
          pdf.text('AREAS FOR IMPROVEMENT:', 25, yPosition);
          yPosition += 8;
          
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(10);
          pdf.setTextColor(40, 40, 40);
          
          analytics.weaknesses.slice(0, 3).forEach((weakness, index) => {
            pdf.text(`${index + 1}. ${weakness.subject}: Requires attention - ${weakness.score}% average`, 30, yPosition);
            yPosition += 6;
          });
          yPosition += 10;
        }
      }
      
      // Grade Distribution Analysis
      if (yPosition > pageHeight - 60) {
        pdf.addPage();
        yPosition = 30;
      }
      
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.setTextColor(0, 51, 102);
      pdf.text('GRADE DISTRIBUTION SUMMARY', 20, yPosition);
      yPosition += 10;
      
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(40, 40, 40);
      
      const gradeEntries = Object.entries(analytics.gradeDistribution).filter(([_, count]) => count > 0);
      gradeEntries.forEach(([grade, count]) => {
        const percentage = ((count / analytics.totalTests) * 100).toFixed(1);
        pdf.text(`• Grade ${grade}: ${count} tests (${percentage}%)`, 25, yPosition);
        yPosition += 6;
      });
      
      // Official Footer
      yPosition = pageHeight - 40;
      
      // Footer border
      pdf.setDrawColor(0, 51, 102);
      pdf.setLineWidth(1);
      pdf.line(20, yPosition, pageWidth - 20, yPosition);
      
      // Footer content
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(8);
      pdf.setTextColor(100, 100, 100);
      pdf.text('This report is computer-generated and contains confidential academic information.', 20, yPosition + 8);
      pdf.text('For queries regarding this report, please contact the Academic Office.', 20, yPosition + 14);
      
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.setTextColor(0, 51, 102);
      pdf.text('COMPUTECH EDUCATIONAL INSTITUTE', pageWidth / 2, yPosition + 25, { align: 'center' });
      
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7); // Slightly smaller to fit better
      pdf.setTextColor(100, 100, 100);
      
      // Split contact info into two lines for better readability
      pdf.text('📞 Contact: +91 8100648132 | 📧 Email: computechmailer@gmail.com', pageWidth / 2, yPosition + 30, { align: 'right' });
      pdf.text('🌐 Website: https://computech-07f0.onrender.com', pageWidth / 2, yPosition + 35, { align: 'right' });
      
      // Save PDF with formal naming
      const dateStamp = new Date().toISOString().split('T')[0];
      const fileName = `${user?.name?.replace(/\s+/g, '_') || 'Student'}_Academic_Report_${dateStamp}.pdf`;
      
      console.log('Saving PDF with filename:', fileName);
      pdf.save(fileName);
      
      toast.success('📄 Formal academic report downloaded successfully!');
      console.log('PDF generation completed successfully');
    } catch (error) {
      console.error('Error generating formal academic report:', error);
      console.error('Error stack:', error.stack);
      console.error('Error details:', {
        message: error.message,
        name: error.name,
        userData: !!user,
        analyticsData: !!analytics,
        subjectPerformanceCount: Object.keys(analytics?.subjectPerformance || {}).length
      });
      toast.error(`Failed to generate academic report: ${error.message || 'Unknown error'}`);
    } finally {
      setDownloadingPDF(false);
    }
  };

  if (!isVisible) return null;

  return (
    <div className={`${styles.analyticsOverlay} ${darkMode ? styles.dark : styles.light}`}>
      <div className={styles.analyticsModal}>
        {/* Header */}
        <div className={styles.analyticsHeader}>
          <div className={styles.headerLeft}>
            <h2>📊 Performance Analytics</h2>
            <p>Comprehensive insights into your academic performance</p>
          </div>
          <div className={styles.headerRight}>
            <button
              className={styles.downloadBtn}
              onClick={downloadPerformancePDF}
              disabled={downloadingPDF}
            >
              {downloadingPDF ? '⏳ Generating...' : '📄 Download PDF'}
            </button>
            <button className={styles.closeBtn} onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className={styles.analyticsNav}>
          <button
            className={`${styles.navTab} ${analyticsView === 'overview' ? styles.active : ''}`}
            onClick={() => setAnalyticsView('overview')}
          >
            📈 Overview
          </button>
          <button
            className={`${styles.navTab} ${analyticsView === 'performance' ? styles.active : ''}`}
            onClick={() => setAnalyticsView('performance')}
          >
            🎯 Performance
          </button>
          <button
            className={`${styles.navTab} ${analyticsView === 'trends' ? styles.active : ''}`}
            onClick={() => setAnalyticsView('trends')}
          >
            📊 Trends
          </button>
          <button
            className={`${styles.navTab} ${analyticsView === 'subjects' ? styles.active : ''}`}
            onClick={() => setAnalyticsView('subjects')}
          >
            📚 Subjects
          </button>
          <button
            className={`${styles.navTab} ${analyticsView === 'rankings' ? styles.active : ''}`}
            onClick={() => setAnalyticsView('rankings')}
          >
            🏆 Rankings
          </button>
        </div>

        {/* Content */}
        <div className={styles.analyticsContent}>
          {analyticsView === 'overview' && (
            <div className={styles.overviewSection}>
              {/* Stats Cards */}
              <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                  <div className={styles.statIcon}>🎯</div>
                  <div className={styles.statInfo}>
                    <h3>{analytics.totalTests}</h3>
                    <p>Tests Completed</p>
                  </div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statIcon}>📊</div>
                  <div className={styles.statInfo}>
                    <h3>{analytics.averageScore.toFixed(1)}%</h3>
                    <p>Average Score</p>
                  </div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statIcon}>🏆</div>
                  <div className={styles.statInfo}>
                    <h3>{analytics.highestScore.toFixed(1)}%</h3>
                    <p>Best Performance</p>
                  </div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statIcon}>
                    {analytics.improvementTrend >= 0 ? '📈' : '📉'}
                  </div>
                  <div className={styles.statInfo}>
                    <h3 className={analytics.improvementTrend >= 0 ? styles.positive : styles.negative}>
                      {analytics.improvementTrend >= 0 ? '+' : ''}{analytics.improvementTrend.toFixed(1)}%
                    </h3>
                    <p>Performance Trend</p>
                  </div>
                </div>
              </div>

              {/* Quick Insights */}
              <div className={styles.insightsGrid}>
                {analytics.strengths.length > 0 && (
                  <div className={styles.insightCard}>
                    <h4>💪 Your Strengths</h4>
                    <div className={styles.strengthsList}>
                      {analytics.strengths.slice(0, 3).map((strength, index) => (
                        <div key={index} className={styles.strengthItem}>
                          <span className={styles.strengthSubject}>{strength.subject}</span>
                          <span className={styles.strengthScore}>{strength.score}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {analytics.weaknesses.length > 0 && (
                  <div className={styles.insightCard}>
                    <h4>🎯 Areas for Improvement</h4>
                    <div className={styles.weaknessesList}>
                      {analytics.weaknesses.slice(0, 3).map((weakness, index) => (
                        <div key={index} className={styles.weaknessItem}>
                          <span className={styles.weaknessSubject}>{weakness.subject}</span>
                          <span className={styles.weaknessScore}>{weakness.score}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {analyticsView === 'performance' && analytics.monthlyProgress.length > 0 && (
            <div className={styles.performanceSection}>
              <div className={styles.chartContainer}>
                <h3>📈 Performance Trend Over Time</h3>
                <div className={styles.chartWrapper}>
                  <Line data={performanceTrendData} options={chartOptions} />
                </div>
              </div>

              {Object.keys(analytics.subjectPerformance).length > 0 && (
                <div className={styles.chartContainer}>
                  <h3>🎯 Performance Radar</h3>
                  <div className={styles.radarWrapper}>
                    <Radar data={radarData} options={radarOptions} />
                  </div>
                </div>
              )}
            </div>
          )}

          {analyticsView === 'trends' && (
            <div className={styles.trendsSection}>
              <div className={styles.chartContainer}>
                <h3>🏆 Grade Distribution</h3>
                <div className={styles.chartWrapper}>
                  <Doughnut 
                    data={gradeDistributionData} 
                    options={{
                      ...chartOptions,
                      plugins: {
                        ...chartOptions.plugins,
                        legend: {
                          position: 'right',
                          labels: {
                            color: darkMode ? '#f9fafb' : '#1f2937',
                            usePointStyle: true,
                          },
                        },
                      },
                    }} 
                  />
                </div>
              </div>

              <div className={styles.trendInsights}>
                <h4>📊 Key Insights</h4>
                <div className={styles.insightsList}>
                  <div className={styles.insightItem}>
                    <span className={styles.insightLabel}>Passing Rate:</span>
                    <span className={`${styles.insightValue} ${
                      analytics.passingRate >= 80 ? styles.excellent :
                      analytics.passingRate >= 60 ? styles.good :
                      analytics.passingRate >= 40 ? styles.average : styles.needsWork
                    }`}>
                      {analytics.passingRate.toFixed(1)}%
                    </span>
                  </div>
                  <div className={styles.insightItem}>
                    <span className={styles.insightLabel}>Consistency:</span>
                    <span className={styles.insightValue}>
                      {analytics.highestScore - analytics.lowestScore < 20 ? 
                        '🟢 High' : analytics.highestScore - analytics.lowestScore < 40 ? 
                        '🟡 Moderate' : '🔴 Variable'}
                    </span>
                  </div>
                  <div className={styles.insightItem}>
                    <span className={styles.insightLabel}>Improvement:</span>
                    <span className={`${styles.insightValue} ${
                      analytics.improvementTrend > 5 ? styles.excellent :
                      analytics.improvementTrend > 0 ? styles.good :
                      analytics.improvementTrend > -5 ? styles.average : styles.needsWork
                    }`}>
                      {analytics.improvementTrend >= 0 ? '📈 Improving' : '📉 Declining'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {analyticsView === 'subjects' && Object.keys(analytics.subjectPerformance).length > 0 && (
            <div className={styles.subjectsSection}>
              <div className={styles.chartContainer}>
                <h3>📚 Subject-wise Performance</h3>
                <div className={styles.chartWrapper}>
                  <Bar data={subjectPerformanceData} options={chartOptions} />
                </div>
              </div>

              <div className={styles.subjectsList}>
                <h4>📊 Detailed Subject Analysis</h4>
                <p className={styles.clickHint}>💡 Click on any subject to view detailed results</p>
                <div className={styles.subjectsGrid}>
                  {Object.entries(analytics.subjectPerformance).map(([subject, data]) => (
                    <div 
                      key={subject} 
                      className={`${styles.subjectCard} ${styles.clickable}`}
                      onClick={() => handleSubjectClick(subject)}
                      title={`Click to view detailed results for ${subject}`}
                    >
                      <div className={styles.subjectHeader}>
                        <h5>{subject}</h5>
                        <span className={`${styles.subjectScore} ${
                          data.average >= 80 ? styles.excellent :
                          data.average >= 60 ? styles.good :
                          data.average >= 40 ? styles.average : styles.needsWork
                        }`}>
                          {data.average.toFixed(1)}%
                        </span>
                      </div>
                      <div className={styles.subjectDetails}>
                        <p>Tests: {data.scores.length}</p>
                        <p>Best: {Math.max(...data.scores).toFixed(1)}%</p>
                        <p>Lowest: {Math.min(...data.scores).toFixed(1)}%</p>
                      </div>
                      <div className={styles.subjectProgress}>
                        <div 
                          className={styles.progressBar}
                          style={{ width: `${data.average}%` }}
                        ></div>
                      </div>
                      <div className={styles.clickIndicator}>
                        <span>👆 Click for details</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {analyticsView === 'rankings' && (
            <div className={styles.rankingsSection}>
              <div className={styles.rankingCards}>
                {/* Student's Current Rank */}
                {studentRank && (
                  <div className={styles.currentRankCard}>
                    <div className={styles.rankBadge}>
                      <span className={styles.rankNumber}>#{studentRank.rank}</span>
                      <span className={styles.rankTitle}>Your Rank</span>
                    </div>
                    <div className={styles.rankStats}>
                      <div className={styles.rankStat}>
                        <span className={styles.statLabel}>Score</span>
                        <span className={styles.statValue}>{studentRank.totalScore || 0}</span>
                      </div>
                      <div className={styles.rankStat}>
                        <span className={styles.statLabel}>Problems Solved</span>
                        <span className={styles.statValue}>{studentRank.problemsSolved || 0}</span>
                      </div>
                      <div className={styles.rankStat}>
                        <span className={styles.statLabel}>Accuracy</span>
                        <span className={styles.statValue}>
                          {studentRank.accuracy ? `${studentRank.accuracy.toFixed(1)}%` : '0%'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Performance Summary */}
                <div className={styles.performanceSummaryCard}>
                  <h3>📈 Performance Summary</h3>
                  <div className={styles.summaryStats}>
                    <div className={styles.summaryItem}>
                      <span className={styles.summaryLabel}>Traditional Tests</span>
                      <span className={styles.summaryValue}>
                        {results.filter(r => !r.isCodingTest).length}
                      </span>
                    </div>
                    <div className={styles.summaryItem}>
                      <span className={styles.summaryLabel}>Coding Tests</span>
                      <span className={styles.summaryValue}>
                        {results.filter(r => r.isCodingTest).length}
                      </span>
                    </div>
                    <div className={styles.summaryItem}>
                      <span className={styles.summaryLabel}>Average Score</span>
                      <span className={styles.summaryValue}>
                        {analytics.averageScore.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Leaderboard */}
              <div className={styles.leaderboardSection}>
                <h3>🏆 Leaderboard</h3>
                {loadingRankings ? (
                  <div className={styles.loadingState}>
                    <div className={styles.spinner}></div>
                    <p>Loading rankings...</p>
                  </div>
                ) : rankings.length > 0 ? (
                  <div className={styles.leaderboard}>
                    <div className={styles.leaderboardHeader}>
                      <span>Rank</span>
                      <span>Student</span>
                      <span>Score</span>
                      <span>Problems</span>
                      <span>Accuracy</span>
                    </div>
                    {rankings.slice(0, 20).map((student, index) => {
                      const isCurrentStudent = student.studentId === user?.id;
                      return (
                        <div 
                          key={student.studentId || index}
                          className={`${styles.leaderboardRow} ${isCurrentStudent ? styles.currentStudent : ''}`}
                        >
                          <span className={styles.rankPosition}>{index + 1}</span>
                          <span className={styles.studentName}>
                            {isCurrentStudent ? 'You' : student.name || `Student ${index + 1}`}
                            {isCurrentStudent && <span className={styles.youLabel}>👈</span>}
                          </span>
                          <span className={styles.studentScore}>{student.totalScore || 0}</span>
                          <span className={styles.problemsSolved}>{student.problemsSolved || 0}</span>
                          <span className={styles.accuracy}>
                            {student.accuracy ? `${student.accuracy.toFixed(1)}%` : '0%'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className={styles.noRankingsState}>
                    <div className={styles.noDataIcon}>🏆</div>
                    <h4>No Rankings Available</h4>
                    <p>Complete some coding problems to see rankings!</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {analyticsView === 'overview' && analytics.totalTests === 0 && (
            <div className={styles.noDataState}>
              <div className={styles.noDataIcon}>📊</div>
              <h3>No Analytics Available</h3>
              <p>Complete some tests to view your performance analytics!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentAnalytics;

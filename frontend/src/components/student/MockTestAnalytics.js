import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../../App';
import { toast } from 'react-toastify';
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
import styles from './MockTestAnalytics.module.css';

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

const MockTestAnalytics = ({ mockTestResults = [], isVisible, onClose }) => {
  const { darkMode } = useTheme();
  const [loading, setLoading] = useState(false);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const [analyticsView, setAnalyticsView] = useState('overview'); // overview, performance, trends, subjects

  // Calculate comprehensive analytics for mock tests
  const analytics = useMemo(() => {
    if (!mockTestResults || mockTestResults.length === 0) {
      return {
        totalTests: 0,
        averageScore: 0,
        highestScore: 0,
        lowestScore: 0,
        passingRate: 0,
        improvementTrend: 0,
        subjectPerformance: {},
        questionTypePerformance: {},
        difficultyPerformance: {},
        monthlyProgress: [],
        gradeDistribution: {},
        strengths: [],
        weaknesses: [],
        avgTimeTaken: 0,
        completionRate: 0
      };
    }

    const validResults = mockTestResults.filter(r => 
      r?.marksObtained !== undefined && 
      r?.totalMarks > 0 && 
      r?.status === 'completed'
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
        questionTypePerformance: {},
        difficultyPerformance: {},
        monthlyProgress: [],
        gradeDistribution: {},
        strengths: [],
        weaknesses: [],
        avgTimeTaken: 0,
        completionRate: 0
      };
    }

    // Basic statistics
    const scores = validResults.map(r => (r.marksObtained / r.totalMarks) * 100);
    const totalTests = validResults.length;
    const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const highestScore = Math.max(...scores);
    const lowestScore = Math.min(...scores);
    
    // Calculate passing rate (assuming 40% is passing for mock tests)
    const passingScores = scores.filter(score => score >= 40);
    const passingRate = (passingScores.length / scores.length) * 100;

    // Calculate completion rate
    const totalAttempted = mockTestResults.length;
    const completionRate = totalAttempted > 0 ? (totalTests / totalAttempted) * 100 : 0;

    // Calculate average time taken (in minutes)
    const avgTimeTaken = validResults.reduce((sum, r) => sum + (r.timeTaken || 0), 0) / validResults.length / 60;

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
      const subject = r.subject || 'General';
      if (!subjectPerformance[subject]) {
        subjectPerformance[subject] = { scores: [], totalMarks: 0, totalObtained: 0, timeTaken: [] };
      }
      const percentage = (r.marksObtained / r.totalMarks) * 100;
      subjectPerformance[subject].scores.push(percentage);
      subjectPerformance[subject].totalMarks += r.totalMarks;
      subjectPerformance[subject].totalObtained += r.marksObtained;
      subjectPerformance[subject].timeTaken.push(r.timeTaken || 0);
    });

    // Calculate subject averages
    Object.keys(subjectPerformance).forEach(subject => {
      const data = subjectPerformance[subject];
      data.average = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
      data.percentage = (data.totalObtained / data.totalMarks) * 100;
      data.avgTime = data.timeTaken.reduce((a, b) => a + b, 0) / data.timeTaken.length / 60; // minutes
    });

    // Question type performance
    const questionTypePerformance = {};
    validResults.forEach(r => {
      const type = r.questionType || 'Unknown';
      if (!questionTypePerformance[type]) {
        questionTypePerformance[type] = { scores: [], count: 0 };
      }
      const percentage = (r.marksObtained / r.totalMarks) * 100;
      questionTypePerformance[type].scores.push(percentage);
      questionTypePerformance[type].count++;
    });

    Object.keys(questionTypePerformance).forEach(type => {
      const data = questionTypePerformance[type];
      data.average = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
    });

    // Difficulty level performance (if available)
    const difficultyPerformance = {
      easy: { scores: [], count: 0 },
      medium: { scores: [], count: 0 },
      hard: { scores: [], count: 0 }
    };

    // Monthly progress
    const monthlyProgress = {};
    validResults.forEach(r => {
      if (r.submittedAt || r.evaluatedAt) {
        const date = new Date(r.submittedAt || r.evaluatedAt);
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
      questionTypePerformance,
      difficultyPerformance,
      monthlyProgress: monthlyProgressArray,
      gradeDistribution,
      strengths,
      weaknesses,
      avgTimeTaken,
      completionRate
    };
  }, [mockTestResults]);

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

  // Question type performance chart data
  const questionTypeData = {
    labels: Object.keys(analytics.questionTypePerformance),
    datasets: [
      {
        label: 'Average Score (%)',
        data: Object.values(analytics.questionTypePerformance).map(type => type.average.toFixed(1)),
        backgroundColor: [
          '#10b981', '#3b82f6', '#f59e0b', '#ef4444'
        ],
        borderColor: [
          '#059669', '#2563eb', '#d97706', '#dc2626'
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

  // Download PDF function
  const downloadPerformancePDF = async () => {
    setDownloadingPDF(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      // Header
      pdf.setFontSize(20);
      pdf.setTextColor(59, 130, 246);
      pdf.text('CompuTech Mock Test Analytics Report', pageWidth / 2, 20, { align: 'center' });
      
      pdf.setFontSize(16);
      pdf.setTextColor(0, 0, 0);
      pdf.text('Mock Test Performance Analytics Report', pageWidth / 2, 30, { align: 'center' });
      
      pdf.setFontSize(12);
      pdf.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 45);
      
      // Line separator
      pdf.setDrawColor(59, 130, 246);
      pdf.line(20, 50, pageWidth - 20, 50);
      
      let yPosition = 60;
      
      // Overall Statistics
      pdf.setFontSize(14);
      pdf.setTextColor(59, 130, 246);
      pdf.text('📊 Overall Mock Test Performance Statistics', 20, yPosition);
      yPosition += 10;
      
      pdf.setFontSize(11);
      pdf.setTextColor(0, 0, 0);
      
      const stats = [
        `Total Mock Tests Completed: ${analytics.totalTests}`,
        `Average Score: ${analytics.averageScore.toFixed(1)}%`,
        `Highest Score: ${analytics.highestScore.toFixed(1)}%`,
        `Lowest Score: ${analytics.lowestScore.toFixed(1)}%`,
        `Passing Rate: ${analytics.passingRate.toFixed(1)}%`,
        `Completion Rate: ${analytics.completionRate.toFixed(1)}%`,
        `Average Time Taken: ${analytics.avgTimeTaken.toFixed(1)} minutes`,
        `Performance Trend: ${analytics.improvementTrend >= 0 ? '+' : ''}${analytics.improvementTrend.toFixed(1)}%`
      ];
      
      stats.forEach(stat => {
        pdf.text(`• ${stat}`, 25, yPosition);
        yPosition += 6;
      });
      
      yPosition += 10;
      
      // Subject Performance
      if (Object.keys(analytics.subjectPerformance).length > 0) {
        pdf.setFontSize(14);
        pdf.setTextColor(59, 130, 246);
        pdf.text('📚 Subject-wise Performance', 20, yPosition);
        yPosition += 10;
        
        pdf.setFontSize(11);
        pdf.setTextColor(0, 0, 0);
        
        Object.entries(analytics.subjectPerformance).forEach(([subject, data]) => {
          pdf.text(`• ${subject}: ${data.average.toFixed(1)}% (${data.scores.length} tests, avg ${data.avgTime.toFixed(1)} min)`, 25, yPosition);
          yPosition += 6;
          
          if (yPosition > pageHeight - 30) {
            pdf.addPage();
            yPosition = 20;
          }
        });
        
        yPosition += 10;
      }

      // Question Type Performance
      if (Object.keys(analytics.questionTypePerformance).length > 0) {
        pdf.setFontSize(14);
        pdf.setTextColor(59, 130, 246);
        pdf.text('🎯 Question Type Performance', 20, yPosition);
        yPosition += 10;
        
        pdf.setFontSize(11);
        pdf.setTextColor(0, 0, 0);
        
        Object.entries(analytics.questionTypePerformance).forEach(([type, data]) => {
          const typeNames = {
            'mcq': 'Multiple Choice Questions',
            'subjective': 'Subjective Questions', 
            'coding': 'Coding Problems'
          };
          pdf.text(`• ${typeNames[type] || type}: ${data.average.toFixed(1)}% (${data.count} tests)`, 25, yPosition);
          yPosition += 6;
        });
        
        yPosition += 10;
      }
      
      // Strengths and Weaknesses
      if (analytics.strengths.length > 0 || analytics.weaknesses.length > 0) {
        pdf.setFontSize(14);
        pdf.setTextColor(16, 185, 129);
        pdf.text('💪 Strengths', 20, yPosition);
        yPosition += 8;
        
        pdf.setFontSize(11);
        pdf.setTextColor(0, 0, 0);
        
        analytics.strengths.slice(0, 3).forEach(strength => {
          pdf.text(`• ${strength.subject}: ${strength.score}%`, 25, yPosition);
          yPosition += 6;
        });
        
        yPosition += 5;
        
        if (analytics.weaknesses.length > 0) {
          pdf.setFontSize(14);
          pdf.setTextColor(239, 68, 68);
          pdf.text('🎯 Areas for Improvement', 20, yPosition);
          yPosition += 8;
          
          pdf.setFontSize(11);
          pdf.setTextColor(0, 0, 0);
          
          analytics.weaknesses.slice(0, 3).forEach(weakness => {
            pdf.text(`• ${weakness.subject}: ${weakness.score}%`, 25, yPosition);
            yPosition += 6;
          });
        }
      }
      
      // Grade Distribution
      if (Object.keys(analytics.gradeDistribution).some(grade => analytics.gradeDistribution[grade] > 0)) {
        yPosition += 10;
        pdf.setFontSize(14);
        pdf.setTextColor(59, 130, 246);
        pdf.text('🏆 Grade Distribution', 20, yPosition);
        yPosition += 8;
        
        pdf.setFontSize(11);
        pdf.setTextColor(0, 0, 0);
        
        Object.entries(analytics.gradeDistribution).forEach(([grade, count]) => {
          if (count > 0) {
            pdf.text(`• ${grade}: ${count} tests`, 25, yPosition);
            yPosition += 6;
          }
        });
      }
      
      // Footer
      pdf.setFontSize(8);
      pdf.setTextColor(128, 128, 128);
      pdf.text('Generated by CompuTech Exam Platform - Mock Test Analytics', pageWidth / 2, pageHeight - 10, { align: 'center' });
      
      // Save PDF
      pdf.save(`Mock_Test_Performance_Report_${new Date().toISOString().split('T')[0]}.pdf`);
      
      toast.success('📄 Mock test performance report downloaded successfully!');
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF report');
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
            <h2>🧪 Mock Test Analytics</h2>
            <p>Comprehensive insights into your mock test performance</p>
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
            className={`${styles.navTab} ${analyticsView === 'types' ? styles.active : ''}`}
            onClick={() => setAnalyticsView('types')}
          >
            🎨 Question Types
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
                    <p>Mock Tests Completed</p>
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
                  <div className={styles.statIcon}>⏱️</div>
                  <div className={styles.statInfo}>
                    <h3>{analytics.avgTimeTaken.toFixed(1)} min</h3>
                    <p>Avg Time Taken</p>
                  </div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statIcon}>✅</div>
                  <div className={styles.statInfo}>
                    <h3>{analytics.completionRate.toFixed(1)}%</h3>
                    <p>Completion Rate</p>
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

          {analyticsView === 'types' && (
            <div className={styles.typesSection}>
              <div className={styles.chartContainer}>
                <h3>🎨 Question Type Performance</h3>
                <div className={styles.chartWrapper}>
                  <Bar data={questionTypeData} options={chartOptions} />
                </div>
              </div>

              {Object.keys(analytics.subjectPerformance).length > 0 && (
                <div className={styles.chartContainer}>
                  <h3>📚 Subject-wise Performance</h3>
                  <div className={styles.chartWrapper}>
                    <Bar data={subjectPerformanceData} options={chartOptions} />
                  </div>
                </div>
              )}

              <div className={styles.subjectsList}>
                <h4>📊 Detailed Subject Analysis</h4>
                <div className={styles.subjectsGrid}>
                  {Object.entries(analytics.subjectPerformance).map(([subject, data]) => (
                    <div key={subject} className={styles.subjectCard}>
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
                        <p>Avg Time: {data.avgTime.toFixed(1)} min</p>
                      </div>
                      <div className={styles.subjectProgress}>
                        <div 
                          className={styles.progressBar}
                          style={{ width: `${data.average}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {analytics.totalTests === 0 && (
            <div className={styles.noDataState}>
              <div className={styles.noDataIcon}>🧪</div>
              <h3>No Mock Test Analytics Available</h3>
              <p>Complete some mock tests to view your performance analytics!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MockTestAnalytics;

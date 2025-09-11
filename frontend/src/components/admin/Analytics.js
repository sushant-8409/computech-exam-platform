// src/components/admin/AdminAnalytics.jsx
import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { Bar, Line, Doughnut, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend,
  Title
} from 'chart.js';

import { Modal, Button, Form } from 'react-bootstrap';
import styles from './AdminAnalytics.module.css';
import logo from '../../assets/logo192.png';
import { useTheme } from '../../App';

// OverviewCard Component
const OverviewCard = ({ icon, label, value, trend, color }) => {
  return (
    <div className={`overviewCard ${color}`}>
      <div className="cardIcon">{icon}</div>
      <div className="cardContent">
        <h3>{value}</h3>
        <p className="cardLabel">{label}</p>
        <span className="cardTrend">{trend}</span>
      </div>
    </div>
  );
};

ChartJS.register(
  CategoryScale, 
  LinearScale, 
  BarElement, 
  LineElement, 
  PointElement, 
  ArcElement, 
  Tooltip, 
  Legend, 
  Title
);

const AdminAnalytics = () => {
  /* ---------------- state ---------------- */
  const { darkMode } = useTheme();
  const [loading, setLoading] = useState(true);
  const [overall, setOverall] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [gradeDistribution, setGradeDistribution] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [topPerformers, setTopPerformers] = useState([]);
  const [error, setError] = useState('');

  const [query, setQuery] = useState('');
  const [student, setStudent] = useState(null);
  const [searching, setSearching] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showStudentModal, setShowStudentModal] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [testChecks, setTestChecks] = useState({});

  const [activeTab, setActiveTab] = useState('overview');
  const [chartType, setChartType] = useState('bar');
  const [timeRange, setTimeRange] = useState('all');

  /* ---------------- data fetch ---------------- */
  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const [analyticsRes, gradeRes, activityRes] = await Promise.all([
        axios.get('/api/admin/analytics'),
        axios.get('/api/admin/analytics/grade-distribution'),
        axios.get('/api/admin/analytics/recent-activity')
      ]);

      setOverall(analyticsRes.data.overall);
      setSubjects(analyticsRes.data.subjectPerformance);
      setGradeDistribution(gradeRes.data.gradeDistribution || []);
      setRecentActivity(activityRes.data.recentActivity || []);
      setTopPerformers(analyticsRes.data.topPerformers || []);
    } catch (err) {
      console.error('Analytics error:', err);
      setError('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

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

  const handleStudentClick = async (studentInfo) => {
    try {
      setSelectedStudent(studentInfo);
      setShowStudentModal(true);
    } catch (err) {
      console.error('Error loading student details:', err);
    }
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

  /* ---------------- Chart Data Generators ---------------- */
  const getChartColors = () => {
    return darkMode ? {
      primary: '#60a5fa',
      secondary: '#34d399',
      tertiary: '#fbbf24',
      quaternary: '#f87171',
      background: 'rgba(96, 165, 250, 0.1)',
      text: '#e5e7eb'
    } : {
      primary: '#3b82f6',
      secondary: '#10b981',
      tertiary: '#f59e0b',
      quaternary: '#ef4444',
      background: 'rgba(59, 130, 246, 0.1)',
      text: '#374151'
    };
  };

  const getSubjectChartData = () => {
    const colors = getChartColors();
    const data = {
      labels: subjects.map(s => s.subject),
      datasets: [{
        label: 'Average Score (%)',
        data: subjects.map(s => s.average),
        backgroundColor: subjects.map((_, i) => [
          colors.primary,
          colors.secondary,
          colors.tertiary,
          colors.quaternary,
          '#8b5cf6',
          '#06b6d4'
        ][i % 6]),
        borderColor: subjects.map((_, i) => [
          colors.primary,
          colors.secondary,
          colors.tertiary,
          colors.quaternary,
          '#8b5cf6',
          '#06b6d4'
        ][i % 6]),
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false,
      }]
    };

    return data;
  };

  const getGradeDistributionData = () => {
    const colors = getChartColors();
    const gd = Array.isArray(gradeDistribution) ? gradeDistribution : [];
    return {
      labels: gd.map(g => g._id || g.grade),
      datasets: [{
        data: gd.map(g => g.count),
        backgroundColor: [
          colors.secondary, // A grades
          colors.primary,   // B grades  
          colors.tertiary,  // C grades
          colors.quaternary, // D grades
          '#8b5cf6',       // F grades
        ],
        borderWidth: 0,
        hoverBorderWidth: 2
      }]
    };
  };

  /* ---------------- render ---------------- */
  if (loading) return (
    <div className={styles.loadingContainer}>
      <div className={styles.spinner}></div>
      <p>Loading Analytics...</p>
    </div>
  );
  
  if (error) return (
    <div className={styles.errorContainer}>
      <p>⚠️ {error}</p>
      <button onClick={loadAnalytics} className={styles.retryBtn}>Retry</button>
    </div>
  );

  const colors = getChartColors();

  return (
    <div className={`${styles.analyticsRoot} ${darkMode ? styles.dark : ''}`}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1>📊 Analytics Dashboard</h1>
          <p>Last updated: {new Date().toLocaleTimeString()}</p>
        </div>
        <div className={styles.headerRight}>
          <button onClick={loadAnalytics} className={styles.refreshBtn}>
            🔄 Refresh All Data
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabContainer}>
        <button 
          className={`${styles.tab} ${activeTab === 'overview' ? styles.active : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          📊 Overview
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'subjects' ? styles.active : ''}`}
          onClick={() => setActiveTab('subjects')}
        >
          📚 Subjects
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'students' ? styles.active : ''}`}
          onClick={() => setActiveTab('students')}
        >
          👥 Students
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'reports' ? styles.active : ''}`}
          onClick={() => setActiveTab('reports')}
        >
          📄 Reports
        </button>
      </div>

      {/* Tab Content */}
      <div className={styles.tabContent}>
        {activeTab === 'overview' && (
          <div className={styles.overviewTab}>
            {/* Overview Cards */}
            <div className={styles.statGrid}>
              <OverviewCard 
                icon="👥" 
                label="Total Students" 
                value={overall.totalStudents} 
                trend="+0 this month"
                color="primary"
              />
              <OverviewCard 
                icon="📊" 
                label="Total Tests" 
                value={overall.totalTests || 36} 
                trend="+0 active"
                color="secondary"
              />
              <OverviewCard 
                icon="📝" 
                label="Submissions" 
                value={overall.totalSubmissions || 35} 
                trend="+0 today"
                color="tertiary"
              />
              <OverviewCard 
                icon="🎯" 
                label="Average Score" 
                value={`${overall.averageScore.toFixed(1)}%`} 
                trend="Overall performance"
                color="success"
              />
              <OverviewCard 
                icon="📋" 
                label="Pending Reviews" 
                value={overall.pendingReviews || 2} 
                trend="Needs attention"
                color="warning"
              />
              <OverviewCard 
                icon="✅" 
                label="Pass Rate" 
                value={`${overall.passRate.toFixed(1)}%`} 
                trend="Students passing"
                color="success"
              />
            </div>

            {/* Grade Distribution Chart */}
            {gradeDistribution.length > 0 && (
              <div className={styles.chartSection}>
                <div className={styles.chartHeader}>
                  <h3>📈 Grade Distribution</h3>
                  <div className={styles.chartControls}>
                    <select 
                      value={chartType} 
                      onChange={(e) => setChartType(e.target.value)}
                      className={styles.select}
                    >
                      <option value="doughnut">Doughnut Chart</option>
                      <option value="pie">Pie Chart</option>
                      <option value="bar">Bar Chart</option>
                    </select>
                  </div>
                </div>
                <div className={styles.chartContainer}>
                  {chartType === 'doughnut' && (
                    <Doughnut 
                      data={getGradeDistributionData()} 
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { position: 'bottom' },
                          title: { display: true, text: 'Student Grade Distribution' }
                        }
                      }} 
                    />
                  )}
                  {chartType === 'pie' && (
                    <Pie 
                      data={getGradeDistributionData()} 
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { position: 'bottom' },
                          title: { display: true, text: 'Student Grade Distribution' }
                        }
                      }} 
                    />
                  )}
                  {chartType === 'bar' && (
                    <Bar 
                      data={{
                        labels: (Array.isArray(gradeDistribution) ? gradeDistribution : []).map(g => g._id || g.grade),
                        datasets: [{
                          label: 'Number of Students',
                          data: (Array.isArray(gradeDistribution) ? gradeDistribution : []).map(g => g.count),
                          backgroundColor: colors.primary,
                          borderRadius: 8
                        }]
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { display: false },
                          title: { display: true, text: 'Student Grade Distribution' }
                        },
                        scales: { y: { beginAtZero: true } }
                      }} 
                    />
                  )}
                </div>
              </div>
            )}

            {/* Recent Activity */}
            <div className={styles.recentActivity}>
              <h3>🕒 Recent Activity</h3>
              <div className={styles.activityList}>
                {recentActivity.length > 0 ? (
                  recentActivity.slice(0, 10).map((activity, index) => (
                    <div key={index} className={styles.activityItem}>
                      <div className={styles.activityIcon}>📝</div>
                      <div className={styles.activityDetails}>
                        <p>{activity.studentName} completed {activity.testTitle}</p>
                        <span>{activity.subject} • {new Date(activity.submittedAt).toLocaleDateString()}</span>
                      </div>
                      <div className={styles.activityScore}>
                        {activity.percentage?.toFixed(1)}%
                      </div>
                    </div>
                  ))
                ) : (
                  <p className={styles.noData}>No recent activity found</p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'subjects' && (
          <div className={styles.subjectsTab}>
            <div className={styles.sectionHeader}>
              <h3>📚 Subject Performance Analysis</h3>
              <div className={styles.chartControls}>
                <select 
                  value={chartType} 
                  onChange={(e) => setChartType(e.target.value)}
                  className={styles.select}
                >
                  <option value="bar">Bar Chart</option>
                  <option value="line">Line Chart</option>
                </select>
              </div>
            </div>

            {subjects.length ? (
              <>
                <div className={styles.chartContainer}>
                  {chartType === 'bar' ? (
                    <Bar
                      data={getSubjectChartData()}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { 
                          legend: { display: false },
                          title: { display: true, text: 'Subject-wise Average Performance' }
                        },
                        scales: { y: { beginAtZero: true, max: 100 } }
                      }}
                    />
                  ) : (
                    <Line
                      data={{
                        ...getSubjectChartData(),
                        datasets: [{
                          ...getSubjectChartData().datasets[0],
                          fill: true,
                          backgroundColor: colors.background,
                          borderColor: colors.primary,
                          pointBackgroundColor: colors.primary,
                          pointBorderColor: '#fff',
                          pointBorderWidth: 2,
                          pointRadius: 6,
                          tension: 0.4
                        }]
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { 
                          legend: { display: false },
                          title: { display: true, text: 'Subject Performance Trend' }
                        },
                        scales: { y: { beginAtZero: true, max: 100 } }
                      }}
                    />
                  )}
                </div>

                <div className={styles.subjectGrid}>
                  {subjects.map((subject, index) => (
                    <div key={subject.subject} className={styles.subjectCard}>
                      <div className={styles.subjectIcon}>
                        {['📊', '💻', '🔬', '📐', '🌍', '📖'][index % 6]}
                      </div>
                      <div className={styles.subjectInfo}>
                        <h4>{subject.subject}</h4>
                        <div className={styles.subjectStats}>
                          <span className={styles.average}>{subject.average.toFixed(1)}%</span>
                          <span className={styles.count}>{subject.count || 0} tests</span>
                        </div>
                        <div className={styles.progressBar}>
                          <div 
                            className={styles.progressFill} 
                            style={{ width: `${subject.average}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className={styles.noData}>
                <p>📚 No subject data available yet</p>
              </div>
            )}
          </div>
        )}        {activeTab === 'students' && (
          <div className={styles.studentsTab}>
            <div className={styles.sectionHeader}>
              <h3>👥 Student Management & Analytics</h3>
            </div>

            {/* Student Search */}
            <div className={styles.searchSection}>
              <div className={styles.searchBox}>
                <input
                  className={styles.searchInput}
                  placeholder="🔍 Search by name, email, or roll number..."
                  value={query}
                  onChange={handleQuery}
                />
                {searching && <div className={styles.searchSpinner}>⏳</div>}
              </div>
            </div>

            {/* Top Performers */}
            <div className={styles.topPerformers}>
              <h4>🏆 Top Performers</h4>
              <div className={styles.performerGrid}>
                {topPerformers.slice(0, 6).map((performer, index) => (
                  <div 
                    key={performer._id || index} 
                    className={styles.performerCard}
                    onClick={() => handleStudentClick(performer)}
                  >
                    <div className={styles.performerRank}>#{index + 1}</div>
                    <div className={styles.performerInfo}>
                      <h5>{performer.name}</h5>
                      <p>{performer.email}</p>
                      <div className={styles.performerStats}>
                        <span className={styles.avgScore}>{performer.avgScore?.toFixed(1)}%</span>
                        <span className={styles.testCount}>{performer.testCount} tests</span>
                      </div>
                    </div>
                    <div className={styles.performerBadge}>
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🌟'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Search Results */}
            {student && !searching && (
              <div className={styles.searchResults}>
                <h4>🔍 Search Results</h4>
                <div 
                  className={styles.studentCard}
                  onClick={() => handleStudentClick(student)}
                >
                  <div className={styles.studentHeader}>
                    <div className={styles.studentInfo}>
                      <h5>{student.name}</h5>
                      <p>{student.email}</p>
                      <span>Roll No: {student.rollNo || 'N/A'}</span>
                    </div>
                    <div className={styles.studentStats}>
                      <div className={styles.stat}>
                        <span className={styles.statValue}>
                          {student.results?.length || 0}
                        </span>
                        <span className={styles.statLabel}>Tests</span>
                      </div>
                      <div className={styles.stat}>
                        <span className={styles.statValue}>
                          {student.avgScore?.toFixed(1) || 'N/A'}%
                        </span>
                        <span className={styles.statLabel}>Avg</span>
                      </div>
                    </div>
                    <div className={styles.viewDetailsBtn}>
                      👁️ View Details
                    </div>
                  </div>

                  {student.results?.length > 0 && (
                    <div className={styles.recentTests}>
                      <h6>Recent Tests:</h6>
                      <div className={styles.testList}>
                        {student.results.slice(0, 3).map(result => (
                          <div key={result._id} className={styles.testItem}>
                            <span className={styles.testName}>{result.testTitle}</span>
                            <span className={styles.testSubject}>{result.subject}</span>
                            <span className={styles.testScore}>
                              {((result.marksObtained / result.totalMarks) * 100).toFixed(1)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'reports' && (
          <div className={styles.reportsTab}>
            <div className={styles.sectionHeader}>
              <h3>📄 Reports & Export</h3>
            </div>

            <div className={styles.reportOptions}>
              <div className={styles.reportCard}>
                <div className={styles.reportIcon}>📊</div>
                <div className={styles.reportContent}>
                  <h4>Overall Performance Report</h4>
                  <p>Comprehensive analytics including all subjects and students</p>
                  <button 
                    className={`${styles.btn} ${styles.btnPrimary}`} 
                    onClick={downloadOverallPDF}
                  >
                    📥 Download PDF
                  </button>
                </div>
              </div>

              <div className={styles.reportCard}>
                <div className={styles.reportIcon}>👥</div>
                <div className={styles.reportContent}>
                  <h4>Student Reports</h4>
                  <p>Generate individual student performance reports</p>
                  <button 
                    className={`${styles.btn} ${styles.btnSecondary}`}
                    onClick={() => {
                      if (!student) {
                        alert('Please search and select a student first');
                        setActiveTab('students');
                        return;
                      }
                      const init = {};
                      student.results.forEach(r => { init[r._id] = true; });
                      setTestChecks(init);
                      setShowModal(true);
                    }}
                  >
                    📄 Generate Report
                  </button>
                </div>
              </div>

              <div className={styles.reportCard}>
                <div className={styles.reportIcon}>📈</div>
                <div className={styles.reportContent}>
                  <h4>Analytics Export</h4>
                  <p>Export detailed analytics data in various formats</p>
                  <button 
                    className={`${styles.btn} ${styles.btnTertiary}`}
                    onClick={() => alert('Export feature coming soon!')}
                  >
                    📊 Export Data
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Student Details Modal */}
      <Modal
        show={showStudentModal}
        onHide={() => setShowStudentModal(false)}
        size="xl"
        centered
        className={styles.studentModal}
      >
        <Modal.Header closeButton>
          <Modal.Title>
            👤 Student Analytics - {selectedStudent?.name}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedStudent && (
            <div className={styles.studentAnalytics}>
              <div className={styles.studentOverview}>
                <div className={styles.studentBasicInfo}>
                  <h5>{selectedStudent.name}</h5>
                  <p>{selectedStudent.email}</p>
                  <p>Roll No: {selectedStudent.rollNo || 'N/A'}</p>
                </div>
                <div className={styles.studentQuickStats}>
                  <div className={styles.quickStat}>
                    <span className={styles.quickStatValue}>
                      {selectedStudent.results?.length || 0}
                    </span>
                    <span className={styles.quickStatLabel}>Total Tests</span>
                  </div>
                  <div className={styles.quickStat}>
                    <span className={styles.quickStatValue}>
                      {selectedStudent.avgScore?.toFixed(1) || 'N/A'}%
                    </span>
                    <span className={styles.quickStatLabel}>Average Score</span>
                  </div>
                  <div className={styles.quickStat}>
                    <span className={styles.quickStatValue}>
                      {selectedStudent.passRate?.toFixed(1) || 'N/A'}%
                    </span>
                    <span className={styles.quickStatLabel}>Pass Rate</span>
                  </div>
                </div>
              </div>

              {selectedStudent.results?.length > 0 && (
                <div className={styles.studentTestHistory}>
                  <h6>📊 Test Performance History</h6>
                  <div className={styles.testHistoryList}>
                    {selectedStudent.results.map((result, index) => (
                      <div key={result._id} className={styles.testHistoryItem}>
                        <div className={styles.testInfo}>
                          <h6>{result.testTitle}</h6>
                          <p>{result.subject}</p>
                          <span>{new Date(result.submittedAt).toLocaleDateString()}</span>
                        </div>
                        <div className={styles.testScore}>
                          <span className={styles.scorePercentage}>
                            {((result.marksObtained / result.totalMarks) * 100).toFixed(1)}%
                          </span>
                          <span className={styles.scoreBreakdown}>
                            {result.marksObtained}/{result.totalMarks}
                          </span>
                          <span className={`${styles.testStatus} ${result.status === 'completed' ? styles.completed : styles.pending}`}>
                            {result.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowStudentModal(false)}>
            Close
          </Button>
          <Button 
            variant="primary" 
            onClick={() => {
              if (selectedStudent?.results) {
                setStudent(selectedStudent);
                const init = {};
                selectedStudent.results.forEach(r => { init[r._id] = true; });
                setTestChecks(init);
                setShowStudentModal(false);
                setShowModal(true);
              }
            }}
          >
            📄 Generate Report
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ---------- Report Generation Modal ---------- */}
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

export default AdminAnalytics;

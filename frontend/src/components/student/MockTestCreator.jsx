import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import styles from './MockTestCreator.module.css';

// --- Static Data ---
const ALL_SUBJECTS = [
  'Computer Science', 'Computer Application', 'Mathematics', 'Physics',
  'English Literature', 'English Language', 'Biology', 'History',
  'Geography', 'Economic Applications', 'Chemistry'
];

// --- Helper Components ---
const LoadingSpinner = ({ text }) => (
  <div className={styles.loadingOverlay}>
    <div className={styles.spinner}></div>
    <p>{text || 'Loading...'}</p>
  </div>
);

// This is the component where the change is made
const TestHistory = ({ history }) => (
    <div className={styles.historySection}>
        <div className={styles.card}>
            <h3>Test History</h3>
            {history.length > 0 ? (
                <div className={styles.historyList}>
                    {history.map(item => (
                        <div key={item._id} className={styles.historyItem}>
                            <div className={styles.historyInfo}>
                                <h4>{item.testTitle}</h4>
                                <p><strong>Subject:</strong> {item.subject}</p>
                                <p><strong>Date:</strong> {new Date(item.submittedAt).toLocaleDateString()}</p>
                            </div>

                            {/* ====================================================== */}
                            {/* ✅ CHANGED LOGIC: Unconditionally display the score. */}
                            {/* This removes the "Pending" status text.              */}
                            {/* ====================================================== */}
                            <div className={styles.historyScore}>
                                <span className={styles.score}>
                                  {item.marksObtained} / {item.totalMarks}
                                </span>
                                <span className={styles.percentage}>
                                  {item.percentage}%
                                </span>
                            </div>

                        </div>
                    ))}
                </div>
            ) : (
                <p>You have not attempted any mock tests yet.</p>
            )}
        </div>
    </div>
);


// --- Main Component (No changes below this line, provided for completeness) ---
const MockTestCreator = () => {
  const [loading, setLoading] = useState(true);
  const [generatingTest, setGeneratingTest] = useState(false);
  const [viewMode, setViewMode] = useState('FORM'); // FORM, PREVIEW, TESTING, MCQ_RESULTS, SUBJECTIVE_EVAL

  const [studentData, setStudentData] = useState(null);
  const [testHistory, setTestHistory] = useState([]);
  
  const [formData, setFormData] = useState({
    subject: '',
    chapters: '',
    timeLimit: 60,
    numberOfQuestions: 10,
    questionType: 'mcq',
    difficultyLevel: 'medium'
  });

  const [generatedTest, setGeneratedTest] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [answers, setAnswers] = useState({});

  // --- Data Fetching and Effects ---
  useEffect(() => {
    const fetchStudentData = async () => {
        try {
            setLoading(true);
            const response = await axios.get('/api/student/profile');
            if (response.data && response.data.success) {
                setStudentData(response.data.student);
                fetchTestHistory();
            } else {
                toast.error('Could not fetch student profile. Please log in again.');
            }
        } catch (error) {
            console.error("Error fetching student profile:", error);
            toast.error(error.response?.data?.message || 'Failed to fetch student profile.');
        } finally {
            setLoading(false);
        }
    };
    fetchStudentData();
  }, []);

  useEffect(() => {
    let timer;
    if (viewMode === 'TESTING' && timeRemaining > 0) {
      timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            toast.warn("Time's up! Submitting your test automatically.");
            handleSubmitTest();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [viewMode, timeRemaining]);
  
  const filteredSubjects = useMemo(() => {
      if (!studentData) return [];
      const studentClassStr = (studentData.class || '').replace(/\D/g, ''); 
      const studentClass = parseInt(studentClassStr, 10);
      
      if (studentClass === 9) {
          return ALL_SUBJECTS;
      }
      if (studentClass === 10) {
          if (formData.subject !== 'Computer Application') {
              setFormData(prev => ({ ...prev, subject: 'Computer Application'}));
          }
          return ['Computer Application'];
      }
      if (formData.subject !== 'Computer Science') {
          setFormData(prev => ({ ...prev, subject: 'Computer Science'}));
      }
      return ['Computer Science'];
  }, [studentData, formData.subject]);

  // --- API Calls and Handlers ---
  const fetchTestHistory = async () => {
    try {
      const response = await axios.get('/api/student/mock-tests/history');
      setTestHistory(response.data.tests || []);
    } catch (error) {
      console.error('Error fetching test history:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const generateMockTest = async () => {
    if (!formData.subject || !formData.chapters.trim()) {
      return toast.error('Please select a subject and enter chapter names.');
    }
    setGeneratingTest(true);
    try {
      const payload = {
        ...formData,
        studentClass: studentData.class,
        studentBoard: studentData.board,
        chapters: formData.chapters.split(',').map(ch => ch.trim())
      };
      const response = await axios.post('/api/student/mock-tests/generate', payload);
      setGeneratedTest(response.data.test);
      setViewMode('PREVIEW');
      toast.success('Mock test generated successfully!');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to generate test.');
    } finally {
      setGeneratingTest(false);
    }
  };

  const startTest = () => {
    setTimeRemaining(formData.timeLimit * 60);
    setAnswers(Array(generatedTest.questions.length).fill(null));
    setViewMode('TESTING');
    toast.info('Test started! Good luck!');
  };

  const handleAnswerChange = (questionIndex, answer) => {
    const newAnswers = [...answers];
    newAnswers[questionIndex] = answer;
    setAnswers(newAnswers);
  };

  const handleSubmitTest = async () => {
    setLoading(true);
    try {
      const submissionData = {
        testId: generatedTest._id,
        answers,
        timeTaken: (formData.timeLimit * 60) - timeRemaining,
        questionType: formData.questionType
      };
      const response = await axios.post('/api/student/mock-tests/submit', submissionData);
      setTestResult(response.data.result);
      fetchTestHistory();
      
      if (formData.questionType === 'mcq') {
        setViewMode('MCQ_RESULTS');
        toast.success('Test automatically evaluated!');
      } else {
        setViewMode('SUBJECTIVE_EVAL');
        toast.info('Test submitted! Please evaluate your answers.');
      }
    } catch (error) {
      toast.error('Failed to submit test.');
    } finally {
      setLoading(false);
    }
  };

  const resetToForm = () => {
      setGeneratedTest(null);
      setTestResult(null);
      setAnswers({});
      setViewMode('FORM');
  }

  // --- Rendering Logic ---
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const renderForm = () => (
    <div className={styles.mainGrid}>
      <div className={styles.creatorSection}>
        <div className={styles.card}>
          <h3>Create New Mock Test</h3>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label>Subject</label>
              <select name="subject" value={formData.subject} onChange={handleInputChange} className={styles.formControl} disabled={filteredSubjects.length === 1}>
                {filteredSubjects.length > 1 && <option value="">Select Subject</option>}
                {filteredSubjects.map(subject => (
                  <option key={subject} value={subject}>{subject}</option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup}>
                <label>Chapter Names (comma-separated)</label>
                <input type="text" name="chapters" value={formData.chapters} onChange={handleInputChange} placeholder="e.g., Algebra, Trigonometry" className={styles.formControl} />
            </div>
            <div className={styles.formGroup}>
                <label>Time Limit (minutes)</label>
                <input type="number" name="timeLimit" value={formData.timeLimit} onChange={handleInputChange} min="10" max="180" className={styles.formControl} />
            </div>
            <div className={styles.formGroup}>
                <label>Number of Questions</label>
                <input type="number" name="numberOfQuestions" value={formData.numberOfQuestions} onChange={handleInputChange} min="5" max="50" className={styles.formControl} />
            </div>
            <div className={styles.formGroup}>
                <label>Question Type</label>
                <select name="questionType" value={formData.questionType} onChange={handleInputChange} className={styles.formControl}>
                    <option value="mcq">Multiple Choice (AI Graded)</option>
                    <option value="subjective">Subjective (Self Graded)</option>
                </select>
            </div>
            <div className={styles.formGroup}>
                <label>Difficulty Level</label>
                <select name="difficultyLevel" value={formData.difficultyLevel} onChange={handleInputChange} className={styles.formControl}>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                </select>
            </div>
          </div>
          <button className={styles.btnPrimary} onClick={generateMockTest} disabled={generatingTest}>
            {generatingTest ? 'Generating...' : 'Generate Mock Test'}
          </button>
        </div>
      </div>
      <TestHistory history={testHistory} />
    </div>
  );

  const renderTestPreview = () => (
    <div className={styles.previewCard}>
        <h3>Generated Test Preview</h3>
        <p><strong>Title:</strong> {generatedTest.title}</p>
        <p><strong>Questions:</strong> {generatedTest.questions.length}</p>
        <p><strong>Total Marks:</strong> {generatedTest.totalMarks}</p>
        <p><strong>Time Limit:</strong> {formData.timeLimit} minutes</p>
        <div className={styles.previewActions}>
            <button className={styles.btnSecondary} onClick={resetToForm}>Cancel</button>
            <button className={styles.btnSuccess} onClick={startTest}>Start Test</button>
        </div>
    </div>
  );

  const renderTestInterface = () => (
    <div className={styles.testInterface}>
      <div className={styles.testHeader}>
        <h2>{generatedTest.title}</h2>
        <div className={`${styles.testTimer} ${timeRemaining < 300 ? styles.timerWarning : ''}`}>
          Time Left: {formatTime(timeRemaining)}
        </div>
      </div>
      <div className={styles.testContent}>
        {generatedTest.questions.map((q, index) => (
          <div key={index} className={styles.questionCard}>
            <div className={styles.questionHeader}>
              <span className={styles.questionNumber}>Q{index + 1}</span>
              <span className={styles.questionMarks}>[{q.marks} marks]</span>
            </div>
            <div className={styles.questionText}><pre>{q.question}</pre></div>
            {formData.questionType === 'mcq' ? (
              <div className={styles.mcqOptions}>
                {q.options.map((option, optIndex) => (
                  <label key={optIndex} className={styles.optionLabel}>
                    <input type="radio" name={`q_${index}`} value={option} onChange={(e) => handleAnswerChange(index, e.target.value)} checked={answers[index] === option} />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            ) : (
              <textarea className={styles.subjectiveAnswer} placeholder="Write your answer here..." value={answers[index] || ''} onChange={(e) => handleAnswerChange(index, e.target.value)} rows={8} />
            )}
          </div>
        ))}
      </div>
      <div className={styles.testFooter}>
        <button className={styles.btnPrimary} onClick={handleSubmitTest}>Submit Test</button>
      </div>
    </div>
  );

  const renderMCQResults = () => {
    const { marksObtained, totalMarks, percentage, questionWiseMarks } = testResult;
    return (
        <div className={styles.resultsContainer}>
            <div className={styles.card}>
                <h2>Test Results</h2>
                <div className={styles.summaryScore}>
                    <p>Your Score</p>
                    <span>{marksObtained} / {totalMarks}</span>
                    <p>Percentage: {percentage}%</p>
                </div>
                <hr />
                <h3>Question Breakdown</h3>
                {questionWiseMarks.map((item, index) => (
                    <div key={index} className={`${styles.questionResult} ${item.isCorrect ? styles.correct : styles.incorrect}`}>
                        <p className={styles.questionText}><strong>Q{index + 1}:</strong> <pre>{item.question}</pre></p>
                        <p>Your Answer: <strong>{item.studentAnswer}</strong></p>
                        {!item.isCorrect && <p>Correct Answer: <strong>{item.correctAnswer}</strong></p>}
                        <div className={styles.explanation}>
                            <strong>Explanation:</strong> {item.feedback}
                        </div>
                    </div>
                ))}
                <button className={styles.btnPrimary} onClick={resetToForm}>Back to Creator</button>
            </div>
        </div>
    );
  };

  const SubjectiveEvaluationForm = () => {
      const [scores, setScores] = useState(Array(generatedTest.questions.length).fill(0));
      const [submitting, setSubmitting] = useState(false);

      const handleScoreChange = (index, value) => {
          const maxMarks = generatedTest.questions[index].marks;
          const newScores = [...scores];
          newScores[index] = Math.max(0, Math.min(maxMarks, Number(value)));
          setScores(newScores);
      };

      const submitEvaluation = async () => {
          setSubmitting(true);
          try {
              const questionWiseMarks = generatedTest.questions.map((q, i) => ({
                  questionNo: i + 1,
                  question: q.question,
                  studentAnswer: testResult.answers[i],
                  maxMarks: q.marks,
                  obtainedMarks: scores[i]
              }));
              
              const payload = { resultId: testResult._id, questionWiseMarks };
              const response = await axios.post('/api/student/mock-tests/evaluate-subjective', payload);
              
              setTestResult(response.data.result);
              toast.success("Evaluation submitted successfully!");
              setViewMode('MCQ_RESULTS'); 
          } catch(error) {
              toast.error("Failed to submit evaluation.");
          } finally {
              setSubmitting(false);
          }
      };

      return (
          <div className={styles.evaluationContainer}>
              <div className={styles.card}>
                  <h2>Self-Evaluation</h2>
                  <p>Review your answers against the expected points and marking scheme. Grade yourself honestly.</p>
                  <hr />
                  {generatedTest.questions.map((q, index) => (
                      <div key={index} className={styles.evalCard}>
                          <p className={styles.questionText}><strong>Q{index + 1}:</strong> <pre>{q.question}</pre></p>
                          <div className={styles.evalSection}>
                              <h4>Your Answer:</h4>
                              <pre className={styles.studentAnswer}>{testResult.answers[index] || "Not Answered"}</pre>
                          </div>
                          <div className={styles.evalSection}>
                              <h4>Expected Answer / Key Points:</h4>
                              <p className={styles.markingScheme}>{q.expectedAnswer}</p>
                          </div>
                          <div className={styles.evalSection}>
                              <h4>Marking Scheme:</h4>
                              <p className={styles.markingScheme}>{q.markingScheme}</p>
                          </div>
                          <div className={styles.scoreInputGroup}>
                              <label>Your Score (out of {q.marks}):</label>
                              <input type="number" value={scores[index]} onChange={(e) => handleScoreChange(index, e.target.value)} max={q.marks} min="0" className={styles.scoreInput} />
                          </div>
                      </div>
                  ))}
                  <button className={styles.btnPrimary} onClick={submitEvaluation} disabled={submitting}>
                      {submitting ? 'Submitting...' : 'Submit Final Evaluation'}
                  </button>
              </div>
          </div>
      )
  };

  const renderContent = () => {
    switch(viewMode) {
      case 'PREVIEW': return renderTestPreview();
      case 'TESTING': return renderTestInterface();
      case 'MCQ_RESULTS': return renderMCQResults();
      case 'SUBJECTIVE_EVAL': return <SubjectiveEvaluationForm />;
      case 'FORM':
      default:
        return renderForm();
    }
  }

  if (loading) return <LoadingSpinner text="Fetching Profile..." />;
  if (!studentData) return <div className={styles.mockTestCreator}><p>Could not load student data. Please try again.</p></div>

  return (
    <div className={styles.mockTestCreator}>
      {generatingTest && <LoadingSpinner text="Generating Your Test..." />}
      <div className={styles.pageHeader}>
        <h1>🧪 Mock Test Creator</h1>
        <p>Generate AI-powered practice tests tailored to your curriculum</p>
      </div>
      
      {studentData && viewMode === 'FORM' && (
        <div className={styles.studentInfoCard}>
          <div className={styles.infoItem}><strong>Student:</strong> {studentData.name}</div>
          <div className={styles.infoItem}><strong>Class:</strong> {studentData.class}</div>
          <div className={styles.infoItem}><strong>Board:</strong> {studentData.board}</div>
        </div>
      )}
      {renderContent()}
    </div>
  );
};

export default MockTestCreator;
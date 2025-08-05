import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import styles from './MockTestCreator.module.css';
import { useNavigate } from 'react-router-dom';
import MockTestAnalytics from './MockTestAnalytics';
//==================================================================
// 1. HELPER & DISPLAY COMPONENTS
// These are the small, reusable building blocks for the main UI.
//==================================================================

const LoadingSpinner = ({ text }) => (
    <div className={styles.loadingOverlay}>
        <div className={styles.spinner}></div>
        <p>{text || 'Loading...'}</p>
    </div>
);

const TestHistory = ({ history, onResultClick, onAnalyticsClick }) => (
    <div className={styles.historySection}>
        <div className={styles.card}>
            <div className={styles.historyHeader}>
                <div>
                    <h3>Test History</h3>
                    <p className={styles.historySubtext}>Click on a past result to view its details.</p>
                </div>
                {history.length > 0 && (
                    <button 
                        className={styles.analyticsBtn}
                        onClick={onAnalyticsClick}
                        title="View detailed analytics"
                    >
                        📊 Analytics
                    </button>
                )}
            </div>
            {history.length > 0 ? (
                <div className={styles.historyList}>
                    {history.map(item => (
                        <div key={item._id} className={styles.historyItem} onClick={() => onResultClick(item)} title="Click to view details">
                            <div className={styles.historyInfo}>
                                <h4>{item.testTitle}</h4>
                                <p><strong>Subject:</strong> {item.subject} | <strong>Date:</strong> {new Date(item.submittedAt || item.evaluatedAt).toLocaleDateString()}</p>
                                <p><strong>Type:</strong> {item.questionType} | <strong>Time:</strong> {Math.round((item.timeTaken || 0) / 60)} min</p>
                            </div>
                            <div className={styles.historyScore}>
                                <span className={styles.score}>
                                    {item.status === 'pending_evaluation' ? 'Pending Eval' : `${item.marksObtained} / ${item.totalMarks}`}
                                </span>
                                {item.status !== 'pending_evaluation' && <span className={styles.percentage}>{item.percentage}%</span>}
                                <span className={`${styles.statusBadge} ${styles[item.status] || styles.completed}`}>
                                    {item.status === 'pending_evaluation' ? '⏳ Pending' : '✅ Completed'}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <p>You haven't attempted any mock tests yet.</p>
            )}
        </div>
    </div>
);
const SubjectiveEvaluationForm = ({ test, result, onEvaluationComplete }) => {
    // State to hold the scores the student gives themselves for each question
    const [scores, setScores] = useState(() => Array(test.questions.length).fill(0));
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleScoreChange = (index, value) => {
        const maxMarks = test.questions[index].marks;
        const newScores = [...scores];
        // Ensure the score is a number and within the valid range [0, maxMarks]
        newScores[index] = Math.max(0, Math.min(maxMarks, Number(value) || 0));
        setScores(newScores);
    };

    const submitEvaluation = async () => {
        setIsSubmitting(true);
        try {
            const questionWiseMarks = test.questions.map((q, i) => ({
                questionNo: i + 1,
                question: q.question,
                studentAnswer: result.answers[i] || "Not Answered",
                maxMarks: q.marks,
                obtainedMarks: scores[i], // The self-assigned score
                feedback: `Self-evaluated score.`
            }));
            
            const payload = { resultId: result._id, questionWiseMarks };
            const token = localStorage.getItem('token');
            if (!token) throw new Error("Authentication token not found.");
            
            const response = await axios.post('/api/student/mock-tests/evaluate-subjective', payload, {
                 headers: { Authorization: `Bearer ${token}` }
            });
            
            if (response.data.success) {
                // Pass the final, evaluated result back to the parent component
                onEvaluationComplete(response.data.result);
            } else {
                throw new Error(response.data.message);
            }
        } catch(error) {
            toast.error(error.response?.data?.message || "Failed to submit evaluation.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className={styles.evaluationContainer}>
            <div className={styles.card}>
                <h2>Self-Evaluation Required</h2>
                <p className={styles.historySubtext}>Review your answers against the expected points and marking scheme below. Grade yourself honestly to complete the test.</p>
                <hr />
                {test.questions.map((q, index) => (
                    <div key={index} className={styles.evalCard}>
                        <p className={styles.questionText}><strong>Q{index + 1}:</strong> <pre>{q.question}</pre></p>
                        <div className={styles.evalSection}>
                            <h4>Your Answer:</h4>
                            <pre className={styles.studentAnswer}>{result.answers[index] || "Not Answered"}</pre>
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
                <button className={styles.btnPrimary} onClick={submitEvaluation} disabled={isSubmitting}>
                    {isSubmitting ? 'Submitting...' : 'Submit Final Evaluation'}
                </button>
            </div>
        </div>
    );
};

//==================================================================
// 2. CORE UI COMPONENTS FOR EACH VIEW
// Each component represents a major state of the mock test process.
//==================================================================

/**
 * Component for the initial form where the user creates a test.
 */
const TestCreationForm = ({ studentData, testHistory, onGenerate, onHistoryClick, onAnalyticsClick }) => {
    const [formData, setFormData] = useState({
        subject: '', chapters: '', timeLimit: 60, numberOfQuestions: 10,
        questionType: 'mcq', difficultyLevel: 'medium'
    });
    
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // Auto-select subject based on student's name and class
    const filteredSubjects = useMemo(() => {
        if (!studentData?.class) return [];
        
        const allSubjects = [
            'Computer Science',
            'Computer Application',
            'Mathematics',
            'Physics',
            'English Literature',
            'English Language',
            'Biology',
            'History',
            'Geography',
            'Economic Applications',
            'Chemistry'
        ];
        
        const studentName = studentData?.name || studentData?.firstName || '';
        const studentClass = parseInt(String(studentData.class).replace(/\D/g, ''), 10);
        
        // Special case for Nomaan: show all subjects except Computer Science and Computer Application
        if (studentName.toLowerCase().includes('nomaan')) {
            return allSubjects.filter(subject => 
                subject !== 'Computer Science' && subject !== 'Computer Application'
            );
        }
        
        // Class 9 or 10: show Computer Application only
        if (studentClass === 9 || studentClass === 10) {
            return ['Computer Application'];
        }
        
        // Other classes: show Computer Science only
        return ['Computer Science'];
    }, [studentData]);
    
    useEffect(() => {
        if(filteredSubjects.length === 1 && formData.subject !== filteredSubjects[0]) {
             setFormData(prev => ({ ...prev, subject: filteredSubjects[0]}));
        }
    }, [filteredSubjects, formData.subject]);

    return (
        <div className={styles.mainGrid}>
            <div className={styles.creatorSection}>
                <div className={styles.card}>
                    <h3>Create New Mock Test</h3>
                    <div className={styles.formGrid}>
                        <div className={styles.formGroup}>
                            <label>Subject</label>
                            <select name="subject" value={formData.subject} onChange={handleInputChange} className={styles.formControl} disabled={filteredSubjects.length===1}>
                                <option value="">Select Subject</option>{filteredSubjects.map(s=><option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className={styles.formGroup}>
                            <label>Chapter Names (comma-separated)</label>
                            <input type="text" name="chapters" value={formData.chapters} onChange={handleInputChange} placeholder="e.g., Arrays, Recursion" className={styles.formControl} />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Time Limit (minutes)</label>
                            <input type="number" name="timeLimit" value={formData.timeLimit} onChange={handleInputChange} min="10" max="180" step="5" className={styles.formControl} />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Number of Questions</label>
                            <input type="number" name="numberOfQuestions" value={formData.numberOfQuestions} onChange={handleInputChange} min="5" max="50" className={styles.formControl} />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Question Type</label>
                            <select name="questionType" value={formData.questionType} onChange={handleInputChange} className={styles.formControl}>
                                <option value="mcq">Multiple Choice (AI Graded)</option>
                                <option value="coding">Coding Problems (AI Graded)</option>
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
                    <button className={styles.btnPrimary} onClick={() => onGenerate(formData)}>Generate Mock Test</button>
                </div>
            </div>
            <TestHistory history={testHistory} onResultClick={onHistoryClick} onAnalyticsClick={onAnalyticsClick} />
        </div>
    );
};

/**
 * Component to preview the generated test before starting.
 */
const TestPreview = ({ test, onStart, onCancel }) => (
    <div className={styles.card}>
        <h3>Generated Test Preview</h3>
        <p><strong>Title:</strong> {test.title}</p>
        <p><strong>Questions:</strong> {test.questions.length}</p>
        <p><strong>Total Marks:</strong> {test.totalMarks}</p>
        <p><strong>Time Limit:</strong> {test.timeLimit} minutes</p>
        <div className={styles.previewActions}>
            <button className={styles.btnSecondary} onClick={onCancel}>Cancel & Create New</button>
            <button className={styles.btnSuccess} onClick={onStart}>Start Test</button>
        </div>
    </div>
);

/**
 * Component for the active test-taking interface.
 */
const ActiveTestInterface = ({ test, timeLimit, onSubmit }) => {
    const [timeRemaining, setTimeRemaining] = useState(timeLimit * 60);
    const [answers, setAnswers] = useState(() => Array(test.questions.length).fill(""));

    const handleAnswerChange = useCallback((index, answer) => {
        setAnswers(prev => prev.map((a, i) => i === index ? answer : a));
    }, []);

    useEffect(() => {
        if (timeRemaining <= 0) return;
        const timer = setInterval(() => setTimeRemaining(prev => prev - 1), 1000);
        return () => clearInterval(timer);
    }, [timeRemaining]);
    
    useEffect(() => {
        if (timeRemaining === 0) {
            toast.warn("Time's up! Submitting your test automatically.");
            onSubmit(answers, timeLimit * 60);
        }
    }, [timeRemaining, onSubmit, answers, timeLimit]);

    const formatTime = (seconds) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;

    return (
        <div className={styles.testInterface}>
            <div className={styles.testHeader}>
                <h2>{test.title}</h2>
                <div className={`${styles.testTimer} ${timeRemaining < 300 ? styles.timerWarning : ''}`}>Time Left: {formatTime(timeRemaining)}</div>
            </div>
            <div className={styles.testContent}>
                {test.questions.map((q, index) => (
                    <div key={index} className={styles.questionCard}>
                        <div className={styles.questionHeader}><span className={styles.questionNumber}>Q{index + 1}</span><span className={styles.questionMarks}>[{q.marks} marks]</span></div>
                        <div className={styles.questionText}><pre>{q.question}</pre></div>
                        {test.questionType === 'coding' ? (
                            <div className={styles.codingArea}><label>Your Code (Language: {getProgrammingLanguage(test.studentBoard, test.subject)})</label><textarea className={styles.codeEditor} defaultValue={q.boilerplate || ''} onChange={(e) => handleAnswerChange(index, e.target.value)} rows={15} spellCheck="false" /></div>
                        ) : test.questionType === 'mcq' ? (
                            <div className={styles.mcqOptions}>{q.options.map((option, optIndex) => (<label key={optIndex} className={styles.optionLabel}><input type="radio" name={`q_${index}`} value={option} onChange={(e) => handleAnswerChange(index, e.target.value)} /><span>{option}</span></label>))}</div>
                        ) : (
                            <textarea className={styles.subjectiveAnswer} placeholder="Write your answer here..." value={answers[index] || ''} onChange={(e) => handleAnswerChange(index, e.target.value)} rows={8} />
                        )}
                    </div>
                ))}
            </div>
            <div className={styles.testFooter}><button className={styles.btnPrimary} onClick={() => onSubmit(answers, (timeLimit * 60) - timeRemaining)}>Submit Test</button></div>
        </div>
    );
};

/**
 * Component to display results for both MCQ and Coding tests.
 */
// In src/components/student/MockTestCreator.js

/**
 * ✅ UPDATED: Component to display results for both MCQ and AI-graded Coding tests.
 */
const TestResultsDisplay = ({ result, onRestart }) => (
    <div className={styles.resultsContainer}>
        <div className={styles.card}>
            <h2>Test Results: {result.testTitle}</h2>
            <div className={styles.summaryScore}>
                <p>Your Final Score</p>
                <span>{result.status === 'pending_evaluation' ? 'Pending' : `${result.marksObtained} / ${result.totalMarks}`}</span>
                {result.status !== 'pending_evaluation' && <p>Percentage: {result.percentage}%</p>}
            </div>
            <hr />
            <h3>Question Breakdown</h3>
            {(result.questionWiseMarks || []).map((item, index) => (
                <div key={index} className={`${styles.questionResult} ${item.isCorrect ? styles.correct : styles.incorrect}`}>
                    <p className={styles.questionText}><strong>Q{index + 1}:</strong> <pre>{item.question}</pre></p>
                    
                    {result.questionType === 'coding' ? (
                        <>
                            <h4>Your Submitted Code:</h4>
                            <pre className={styles.codeBlock}>{item.studentAnswer || "// No code submitted"}</pre>
                            
                            {/* Display AI Feedback instead of compiler output */}
                            <div className={styles.explanation}>
                                <strong>AI Feedback:</strong> {item.feedback}
                            </div>
                        </>
                    ) : ( // MCQ
                        <>
                            <p>Your Answer: <strong>{item.studentAnswer}</strong></p>
                            {!item.isCorrect && <p>Correct Answer: <strong>{item.correctAnswer}</strong></p>}
                            <div className={styles.explanation}>
                                <strong>Explanation:</strong> {item.feedback}
                            </div>
                        </>
                    )}
                     <div className={styles.verdict}>
                        Score for this question: <strong>{item.obtainedMarks} / {item.maxMarks}</strong>
                    </div>
                </div>
            ))}
            <button className={styles.btnPrimary} onClick={onRestart}>Create Another Test</button>
        </div>
    </div>
);


//==================================================================
// 4. MAIN CONTAINER COMPONENT
// This component manages state and renders the correct sub-component.
//==================================================================

const MockTestCreator = () => {
    const [viewMode, setViewMode] = useState('FORM');
    const [loading, setLoading] = useState(true);
    const [generatingTest, setGeneratingTest] = useState(false);
    const [studentData, setStudentData] = useState(null);
    const [testHistory, setTestHistory] = useState([]);
    const [generatedTest, setGeneratedTest] = useState(null);
    const [testResult, setTestResult] = useState(null);
    const [showAnalytics, setShowAnalytics] = useState(false);
    const navigate = useNavigate();
    const fetchInitialData = useCallback(async () => {
        try {
            setLoading(true);
            const profilePromise = axios.get('/api/student/profile');
            const historyPromise = axios.get('/api/student/mock-tests/history');
            const [profileResponse, historyResponse] = await Promise.all([profilePromise, historyPromise]);
            
            if (profileResponse.data.success) setStudentData(profileResponse.data.student);
            if (historyResponse.data.success) setTestHistory(historyResponse.data.tests || []);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to fetch initial data.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchInitialData();
    }, [fetchInitialData]);

    const handleGenerateTest = useCallback(async (formData) => {
        if (!formData.subject || !formData.chapters.trim()) {
            return toast.error('Please select a subject and enter chapter names.');
        }
        setGeneratingTest(true);
        try {
            const payload = { ...formData, studentClass: studentData.class, studentBoard: studentData.board, chapters: formData.chapters.split(',').map(ch => ch.trim()) };
            const response = await axios.post('/api/student/mock-tests/generate', payload);
            setGeneratedTest(response.data.test);
            setViewMode('PREVIEW');
            toast.success('Mock test generated successfully!');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to generate test.');
        } finally {
            setGeneratingTest(false);
        }
    }, [studentData]);

    const handleSubmitTest = useCallback(async (answers, timeTaken) => {
        if (!generatedTest) return;
        setLoading(true);
        try {
            const submissionData = { testId: generatedTest._id, answers, timeTaken, questionType: generatedTest.questionType };
            const response = await axios.post('/api/student/mock-tests/submit', submissionData);
            setTestResult(response.data.result);
            fetchInitialData();
            if (generatedTest.questionType === 'subjective') {
                setViewMode('SUBJECTIVE_EVAL');
                toast.info('Test submitted! Please evaluate your answers.');
            } else {
                setViewMode('RESULTS');
                toast.success('Test automatically graded!');
            }
            toast.success('Test submitted and evaluated!');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to submit test.');
        } finally {
            setLoading(false);
        }
    }, [generatedTest, fetchInitialData]);

    const resetToForm = () => {
        setGeneratedTest(null);
        setTestResult(null);
        setViewMode('FORM');
    };

    const handleViewHistory = (result) => {
        setTestResult(result);
        setViewMode('RESULTS');
    };

    const handleShowAnalytics = () => {
        setShowAnalytics(true);
    };
    const renderContent = () => {
        if (loading) return <LoadingSpinner text="Fetching Your Profile..." />;
        if (!studentData) return <div className={styles.card}><p>Could not load student data.</p></div>;
        
        const profileIsIncomplete = !studentData.class || studentData.class.trim() === '' || !studentData.board || studentData.board.trim() === '';
        if (profileIsIncomplete) { /* ... (unchanged profile warning) ... */ }

        switch(viewMode) {
            case 'PREVIEW':
                return <TestPreview test={generatedTest} onStart={() => setViewMode('TESTING')} onCancel={resetToForm} />;
            case 'TESTING':
                return <ActiveTestInterface test={generatedTest} timeLimit={generatedTest.timeLimit} onSubmit={handleSubmitTest} />;
            case 'RESULTS':
                return <TestResultsDisplay result={testResult} onRestart={resetToForm} />;
            case 'SUBJECTIVE_EVAL':
                return <SubjectiveEvaluationForm 
                            test={generatedTest} 
                            result={testResult}
                            onEvaluationComplete={(finalResult) => {
                                setTestResult(finalResult);
                                setViewMode('RESULTS');
                                toast.success("Evaluation complete!");
                            }}
                        />;
            case 'FORM':
            default:
                return <TestCreationForm studentData={studentData} testHistory={testHistory} onGenerate={handleGenerateTest} onHistoryClick={handleViewHistory} onAnalyticsClick={handleShowAnalytics} />;
        }
      };

  

    return (
        <div className={styles.mockTestCreator}>
            {generatingTest && <LoadingSpinner text="Generating Your Personalised Test..." />}
            <div className={styles.pageHeader}>
                <div className={styles.headerContent}>
                    <div className={styles.headerText}>
                        <h1>🧪 AI Powered Mock Test Generator</h1>
                        <p>Create unlimited, personalized practice tests for any subject using our own AI technology.</p>
                    </div>
                    {testHistory.length > 0 && (
                        <div className={styles.quickStats}>
                            <div className={styles.statItem}>
                                <span className={styles.statValue}>{testHistory.length}</span>
                                <span className={styles.statLabel}>Tests Taken</span>
                            </div>
                            <div className={styles.statItem}>
                                <span className={styles.statValue}>
                                    {testHistory.filter(t => t.status === 'completed').length > 0
                                        ? Math.round(
                                            testHistory
                                                .filter(t => t.status === 'completed')
                                                .reduce((sum, t) => sum + t.percentage, 0) /
                                            testHistory.filter(t => t.status === 'completed').length
                                        ) + '%'
                                        : '0%'
                                    }
                                </span>
                                <span className={styles.statLabel}>Avg Score</span>
                            </div>
                            <div className={styles.statItem}>
                                <span className={styles.statValue}>
                                    {testHistory.filter(t => t.status === 'completed').length > 0
                                        ? Math.max(...testHistory.filter(t => t.status === 'completed').map(t => t.percentage)) + '%'
                                        : '0%'
                                    }
                                </span>
                                <span className={styles.statLabel}>Best Score</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            
            
            <div className={styles.contentArea}>
                {renderContent()}
            </div>

            {/* Mock Test Analytics Modal */}
            <MockTestAnalytics 
                mockTestResults={testHistory}
                isVisible={showAnalytics}
                onClose={() => setShowAnalytics(false)}
            />
        </div>
    );
};

// Helper function to determine programming language based on board and subject
function getProgrammingLanguage(board, subject) {
    const lowerCaseBoard = (board || '').toLowerCase();
    const lowerCaseSubject = (subject || '').toLowerCase();
    if (lowerCaseSubject.includes('computer')) {
        if (lowerCaseBoard.includes('icse') || lowerCaseBoard.includes('isc')) return 'Java';
        if (lowerCaseBoard.includes('wbchse')) return 'C++'; // As per curriculum
        if (lowerCaseBoard.includes('cbse')) return 'Python';
    }
    return 'an appropriate programming language';
}

export default MockTestCreator;
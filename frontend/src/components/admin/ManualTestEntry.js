import React, { useState, useEffect } from 'react';
import { useAuth, useTheme } from '../../App';
import { toast } from 'react-toastify';
import styles from './ManualTestEntry.module.css';

// Subject options (same as in AdminDashboard)
const SUBJECT_OPTIONS = [
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

// Class options (9-12)
const CLASS_OPTIONS = [9, 10, 11, 12];

// Board options
const BOARD_OPTIONS = ['CBSE', 'ICSE', 'State Board'];

const ManualTestEntry = () => {
  const { user } = useAuth();
  const { darkMode } = useTheme();
  
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [searching, setSearching] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    // Test Details
    title: '',
    subject: '',
    class: '',
    board: '',
    school: '',
    testType: 'offline',
    testDate: '',
    duration: '',
    totalQuestions: 1,
    instructions: '',
    
    // File uploads
    questionPaper: null,
    answerSheet: null,
    answerKey: null
  });

  // Question-wise marks state
  const [questions, setQuestions] = useState([
    { questionNo: 1, maxMarks: 1, obtainedMarks: 0, remarks: '' }
  ]);

  // Calculate total marks automatically
  const totalMarks = questions.reduce((sum, q) => sum + (parseFloat(q.maxMarks) || 0), 0);
  const marksObtained = questions.reduce((sum, q) => sum + (parseFloat(q.obtainedMarks) || 0), 0);
  const percentage = totalMarks > 0 ? ((marksObtained / totalMarks) * 100) : 0;
  const grade = percentage >= 90 ? 'A+' :
                percentage >= 80 ? 'A' :
                percentage >= 70 ? 'B+' :
                percentage >= 60 ? 'B' :
                percentage >= 50 ? 'C+' :
                percentage >= 40 ? 'C' : 'F';
  
  const [uploadProgress, setUploadProgress] = useState({
    questionPaper: 0,
    answerSheet: 0,
    answerKey: 0
  });

  // Search for students
  const searchStudents = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      console.log('🔍 Searching for students with query:', query);
      
      const token = localStorage.getItem('token');
      console.log('🔑 Token exists:', !!token);
      console.log('🔑 Token length:', token ? token.length : 0);
      
      const response = await fetch(`/api/admin/manual-test/search-students?query=${encodeURIComponent(query)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('📡 Search response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Search results:', data);
        setSearchResults(data.students || []);
      } else {
        console.error('❌ Search failed with status:', response.status);
        const errorData = await response.text();
        console.error('❌ Error response:', errorData);
        setSearchResults([]);
      }
    } catch (error) {
      console.error('❌ Error searching students:', error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  // Handle search query change with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchStudents(searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Update questions array when total questions changes
  const updateQuestions = (totalQuestions) => {
    const count = parseInt(totalQuestions) || 1;
    const newQuestions = [];
    
    for (let i = 1; i <= count; i++) {
      const existingQ = questions.find(q => q.questionNo === i);
      newQuestions.push(existingQ || {
        questionNo: i,
        maxMarks: 1,
        obtainedMarks: 0,
        remarks: ''
      });
    }
    
    setQuestions(newQuestions);
  };

  // Handle question marks change
  const handleQuestionChange = (questionNo, field, value) => {
    setQuestions(prev => prev.map(q => 
      q.questionNo === questionNo 
        ? { ...q, [field]: field.includes('Marks') ? Math.max(0, parseFloat(value) || 0) : value }
        : q
    ));
  };

  useEffect(() => {
    updateQuestions(1); // Initialize with 1 question
  }, []);

  const handleInputChange = (e) => {
    const { name, value, type, files } = e.target;
    
    if (name === 'totalQuestions') {
      setFormData(prev => ({ ...prev, [name]: value }));
      updateQuestions(value);
      return;
    }
    
    if (type === 'file') {
      const file = files[0];
      if (file) {
        // Validate file size (10MB limit)
        if (file.size > 10 * 1024 * 1024) {
          toast.error('File size should not exceed 10MB');
          return;
        }
        
        // Validate file type
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        if (!allowedTypes.includes(file.type)) {
          toast.error('Only PDF, JPG, JPEG, and PNG files are allowed');
          return;
        }
        
        setFormData(prev => ({
          ...prev,
          [name]: file
        }));
      }
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const uploadFile = async (file, fileType) => {
    const uploadFormData = new FormData();
    uploadFormData.append('file', file);
    uploadFormData.append('fileType', fileType);
    uploadFormData.append('category', 'manual-test');

    try {
      console.log(`📤 Uploading ${fileType} file:`, file.name);
      
      const response = await fetch('/api/admin/manual-test/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: uploadFormData
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ ${fileType} upload successful:`, data);
        console.log(`🔗 File URL received: ${data.fileUrl}`);
        console.log(`💾 Storage method: ${data.storage}`);
        return data.fileUrl;
      } else {
        const errorData = await response.json();
        console.error(`❌ ${fileType} upload failed:`, errorData);
        throw new Error(`File upload failed: ${errorData.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error(`❌ Error uploading ${fileType} file:`, error);
      throw error;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.title || !formData.subject || !selectedStudent) {
      toast.error('Please fill in all required fields and select a student');
      return;
    }
    
    if (!formData.totalQuestions || parseInt(formData.totalQuestions) <= 0) {
      toast.error('Please enter valid number of questions');
      return;
    }
    
    if (questions.length === 0) {
      toast.error('Please configure question-wise marks');
      return;
    }

    // Validate question-wise marks
    for (const question of questions) {
      if (question.maxMarks <= 0) {
        toast.error(`Question ${question.questionNo}: Please enter valid maximum marks`);
        return;
      }
      
      if (question.obtainedMarks < 0 || question.obtainedMarks > question.maxMarks) {
        toast.error(`Question ${question.questionNo}: Obtained marks cannot exceed maximum marks`);
        return;
      }
    }

    try {
      setSubmitting(true);
      
      // Upload files if provided
      const fileUrls = {};
      
      if (formData.questionPaper) {
        setUploadProgress(prev => ({ ...prev, questionPaper: 25 }));
        fileUrls.questionPaper = await uploadFile(formData.questionPaper, 'questionPaper');
        console.log('📄 Question Paper URL set:', fileUrls.questionPaper);
        setUploadProgress(prev => ({ ...prev, questionPaper: 100 }));
      }
      
      if (formData.answerSheet) {
        setUploadProgress(prev => ({ ...prev, answerSheet: 25 }));
        fileUrls.answerSheet = await uploadFile(formData.answerSheet, 'answerSheet');
        console.log('📋 Answer Sheet URL set:', fileUrls.answerSheet);
        setUploadProgress(prev => ({ ...prev, answerSheet: 100 }));
      }
      
      if (formData.answerKey) {
        setUploadProgress(prev => ({ ...prev, answerKey: 25 }));
        fileUrls.answerKey = await uploadFile(formData.answerKey, 'answerKey');
        console.log('🔑 Answer Key URL set:', fileUrls.answerKey);
        setUploadProgress(prev => ({ ...prev, answerKey: 100 }));
      }

      console.log('📁 All file URLs collected:', fileUrls);

      // Prepare test data
      const testData = {
        title: formData.title,
        subject: formData.subject,
        class: formData.class || selectedStudent.class,
        board: formData.board || selectedStudent.board,
        school: formData.school || selectedStudent.school,
        testType: formData.testType,
        testDate: formData.testDate,
        duration: parseInt(formData.duration) || 0,
        totalQuestions: parseInt(formData.totalQuestions),
        instructions: formData.instructions,
        createdBy: user._id
      };

      // Submit the manual test entry
      console.log('🚀 Submitting manual test with data:', {
        testData: testData.title,
        studentId: selectedStudent._id,
        questionsCount: questions.length,
        fileUrlsCount: Object.keys(fileUrls).length,
        fileUrls
      });
      
      const response = await fetch('/api/admin/manual-test/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          testData,
          studentId: selectedStudent._id,
          questions,
          fileUrls
        })
      });

      if (response.ok) {
        const result = await response.json();
        toast.success('🎉 Manual test entry created successfully with reviewed status!');
        
        // Reset form
        setFormData({
          title: '',
          subject: '',
          class: '',
          board: '',
          school: '',
          testType: 'offline',
          testDate: '',
          duration: '',
          totalQuestions: 1,
          instructions: '',
          questionPaper: null,
          answerSheet: null,
          answerKey: null
        });
        
        setSelectedStudent(null);
        setSearchQuery('');
        setSearchResults([]);
        setQuestions([{ questionNo: 1, maxMarks: 1, obtainedMarks: 0, remarks: '' }]);
        
        setUploadProgress({
          questionPaper: 0,
          answerSheet: 0,
          answerKey: 0
        });
        
        // Reset file inputs
        const fileInputs = document.querySelectorAll('input[type="file"]');
        fileInputs.forEach(input => input.value = '');
        
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create test and result');
      }
      
    } catch (error) {
      console.error('Error creating manual test entry:', error);
      toast.error(`Failed to create test entry: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`${styles.manualTestEntry} ${darkMode ? styles.dark : styles.light}`}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1>📝 Manual Test Entry</h1>
          <p>Create offline test records and enter student results manually with question-wise marks</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className={styles.entryForm}>
        {/* Test Details Section */}
        <div className={styles.section}>
          <h2>📋 Test Details</h2>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label>Test Title *</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="e.g., Mathematics Unit Test 1"
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label>Subject *</label>
              <select
                name="subject"
                value={formData.subject}
                onChange={handleInputChange}
                required
              >
                <option value="">Select Subject</option>
                {SUBJECT_OPTIONS.map(subject => (
                  <option key={subject} value={subject}>{subject}</option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>Class</label>
              <select
                name="class"
                value={formData.class}
                onChange={handleInputChange}
              >
                <option value="">Select Class</option>
                {CLASS_OPTIONS.map(classNum => (
                  <option key={classNum} value={classNum}>{classNum}</option>
                ))}
              </select>
              {selectedStudent && formData.class && (
                <small className={styles.success}>✅ Auto-filled from student profile</small>
              )}
            </div>

            <div className={styles.formGroup}>
              <label>Board</label>
              <select
                name="board"
                value={formData.board}
                onChange={handleInputChange}
              >
                <option value="">Select Board</option>
                {BOARD_OPTIONS.map(board => (
                  <option key={board} value={board}>{board}</option>
                ))}
              </select>
              {selectedStudent && formData.board && (
                <small className={styles.success}>✅ Auto-filled from student profile</small>
              )}
            </div>

            <div className={styles.formGroup}>
              <label>School</label>
              <input
                type="text"
                name="school"
                value={formData.school}
                onChange={handleInputChange}
                placeholder={selectedStudent ? "Auto-filled from student data" : "e.g., XYZ High School"}
              />
              {selectedStudent && formData.school && (
                <small className={styles.success}>✅ Auto-filled from student profile</small>
              )}
            </div>

            <div className={styles.formGroup}>
              <label>Test Type</label>
              <select
                name="testType"
                value={formData.testType}
                onChange={handleInputChange}
              >
                <option value="offline">Offline Test</option>
                <option value="manual">Manual Entry</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>Test Date</label>
              <input
                type="date"
                name="testDate"
                value={formData.testDate}
                onChange={handleInputChange}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Duration (minutes)</label>
              <input
                type="number"
                name="duration"
                value={formData.duration}
                onChange={handleInputChange}
                placeholder="e.g., 60"
                min="1"
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label>Instructions</label>
            <textarea
              name="instructions"
              value={formData.instructions}
              onChange={handleInputChange}
              placeholder="Any special instructions or notes about the test..."
              rows={3}
            />
          </div>
        </div>

        {/* Student Selection Section */}
        <div className={styles.section}>
          <h2>👨‍🎓 Student Selection</h2>
          <div className={styles.studentSearch}>
            <div className={styles.searchBox}>
              <input
                type="text"
                placeholder="Search student by name, email, or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.searchInput}
              />
              {searching && <div className={styles.searchStatus}>Searching...</div>}
              {searchQuery && searchResults.length > 0 && (
                <div className={styles.searchResults}>
                  {searchResults.slice(0, 10).map(student => (
                    <div
                      key={student._id}
                      className={styles.studentOption}
                      onClick={() => {
                        setSelectedStudent(student);
                        setSearchQuery(student.name);
                        setSearchResults([]);
                        
                        // Auto-fill form fields based on student data
                        setFormData(prev => ({
                          ...prev,
                          class: student.class || prev.class,
                          board: student.board || prev.board,
                          school: student.school || prev.school,
                          // Auto-fill subject if student has a preferred subject
                          subject: student.subject || prev.subject
                        }));
                      }}
                    >
                      <div className={styles.studentInfo}>
                        <strong>{student.name}</strong>
                        <span>{student.email}</span>
                      </div>
                      <div className={styles.studentMeta}>
                        {student.rollNo && <span>Roll: {student.rollNo}</span>}
                        {student.class && <span>Class: {student.class}</span>}
                        {student.phone && <span>📞 {student.phone}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {selectedStudent && (
              <div className={styles.selectedStudent}>
                <h3>✅ Selected Student:</h3>
                <div className={styles.studentCard}>
                  <div className={styles.studentDetails}>
                    <strong>{selectedStudent.name}</strong>
                    <span>📧 {selectedStudent.email}</span>
                    {selectedStudent.rollNo && <span>🆔 Roll: {selectedStudent.rollNo}</span>}
                    {selectedStudent.class && <span>🎓 Class: {selectedStudent.class}</span>}
                    {selectedStudent.phone && <span>📞 {selectedStudent.phone}</span>}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Question Configuration Section */}
        <div className={styles.section}>
          <h2>❓ Question Configuration</h2>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label>Total Questions *</label>
              <input
                type="number"
                name="totalQuestions"
                value={formData.totalQuestions}
                onChange={handleInputChange}
                min="1"
                max="100"
                required
              />
              <small>Number of questions in the test</small>
            </div>
            
            <div className={styles.formGroup}>
              <label>Total Marks (Auto-calculated)</label>
              <input
                type="number"
                value={totalMarks.toFixed(1)}
                readOnly
                className={styles.readOnly}
              />
              <small>Sum of all question marks</small>
            </div>
            
            <div className={styles.formGroup}>
              <label>Marks Obtained (Auto-calculated)</label>
              <input
                type="number"
                value={marksObtained.toFixed(1)}
                readOnly
                className={styles.readOnly}
              />
              <small>Sum of marks obtained in all questions</small>
            </div>
            
            <div className={styles.formGroup}>
              <label>Percentage (Auto-calculated)</label>
              <input
                type="text"
                value={`${percentage.toFixed(2)}%`}
                readOnly
                className={styles.readOnly}
              />
              <small>Percentage score</small>
            </div>

            <div className={styles.formGroup}>
              <label>Grade (Auto-calculated)</label>
              <input
                type="text"
                value={grade}
                readOnly
                className={styles.readOnly}
              />
              <small>Automatic grade based on percentage</small>
            </div>
          </div>
        </div>

        {/* Question-wise Marks Entry */}
        <div className={styles.section}>
          <h2>📝 Question-wise Marks Entry</h2>
          <div className={styles.questionsGrid}>
            {questions.map((question) => (
              <div key={question.questionNo} className={styles.questionCard}>
                <h4>Question {question.questionNo}</h4>
                <div className={styles.questionInputs}>
                  <div className={styles.formGroup}>
                    <label>Max Marks</label>
                    <input
                      type="number"
                      value={question.maxMarks}
                      onChange={(e) => handleQuestionChange(question.questionNo, 'maxMarks', e.target.value)}
                      min="0"
                      step="0.5"
                      placeholder="Max marks"
                    />
                  </div>
                  
                  <div className={styles.formGroup}>
                    <label>Obtained Marks</label>
                    <input
                      type="number"
                      value={question.obtainedMarks}
                      onChange={(e) => handleQuestionChange(question.questionNo, 'obtainedMarks', e.target.value)}
                      min="0"
                      max={question.maxMarks}
                      step="0.5"
                      placeholder="Marks obtained"
                    />
                  </div>
                  
                  <div className={styles.formGroup}>
                    <label>Remarks (Optional)</label>
                    <input
                      type="text"
                      value={question.remarks}
                      onChange={(e) => handleQuestionChange(question.questionNo, 'remarks', e.target.value)}
                      placeholder="Any remarks for this question..."
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* File Upload Section */}
        <div className={styles.section}>
          <h2>📎 File Uploads (Optional)</h2>
          <div className={styles.fileUploads}>
            <div className={styles.fileGroup}>
              <label>Question Paper (PDF)</label>
              <input
                type="file"
                name="questionPaper"
                onChange={handleInputChange}
                accept=".pdf,image/*"
                className={styles.fileInput}
              />
              {uploadProgress.questionPaper > 0 && uploadProgress.questionPaper < 100 && (
                <div className={styles.progressBar}>
                  <div 
                    className={styles.progress} 
                    style={{ width: `${uploadProgress.questionPaper}%` }}
                  ></div>
                </div>
              )}
            </div>

            <div className={styles.fileGroup}>
              <label>Answer Sheet (PDF/Image)</label>
              <input
                type="file"
                name="answerSheet"
                onChange={handleInputChange}
                accept=".pdf,image/*"
                className={styles.fileInput}
              />
              {uploadProgress.answerSheet > 0 && uploadProgress.answerSheet < 100 && (
                <div className={styles.progressBar}>
                  <div 
                    className={styles.progress} 
                    style={{ width: `${uploadProgress.answerSheet}%` }}
                  ></div>
                </div>
              )}
            </div>

            <div className={styles.fileGroup}>
              <label>Answer Key (PDF/Image)</label>
              <input
                type="file"
                name="answerKey"
                onChange={handleInputChange}
                accept=".pdf,image/*"
                className={styles.fileInput}
              />
              {uploadProgress.answerKey > 0 && uploadProgress.answerKey < 100 && (
                <div className={styles.progressBar}>
                  <div 
                    className={styles.progress} 
                    style={{ width: `${uploadProgress.answerKey}%` }}
                  ></div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Submit Section */}
        <div className={styles.submitSection}>
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={submitting || !selectedStudent}
          >
            {submitting ? (
              <>
                <div className={styles.spinner}></div>
                Creating Entry...
              </>
            ) : (
              <>
                💾 Create Manual Test Entry
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ManualTestEntry;
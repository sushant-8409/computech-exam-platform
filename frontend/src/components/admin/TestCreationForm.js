import React, { useState } from 'react';
import { toast } from 'react-toastify';
import axios from 'axios';

const TestCreationForm = ({ onTestCreated }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    subject: '',
    class: '',
    board: '',
    duration: '',
    totalMarks: '',
    passingMarks: '',
    questionsCount: '', // NEW: Required field
    startDate: '',
    endDate: '',
    resumeEnabled: true,
    answerKeyVisible: false,
    proctoringSettings: {
      strictMode: true,
      allowTabSwitch: 0,
      requireFullscreen: true,
      blockRightClick: true,
      blockKeyboardShortcuts: true
    }
  });

  const [files, setFiles] = useState({
    questionPaper: null, // COMPULSORY
    answerSheet: null,   // COMPULSORY
    answerKey: null      // OPTIONAL
  });

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: type === 'checkbox' ? checked : type === 'number' ? parseInt(value) || 0 : value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : type === 'number' ? parseInt(value) || 0 : value
      }));
    }
  };

  const handleFileChange = (e) => {
    const { name, files: selectedFiles } = e.target;
    const file = selectedFiles[0];
    
    if (!file) return;

    // Validate file types
    const allowedTypes = {
      questionPaper: ['application/pdf'],
      answerSheet: ['application/pdf'],
      answerKey: ['application/pdf']
    };

    if (!allowedTypes[name].includes(file.type)) {
      toast.error(`${name} must be a PDF file`);
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      toast.error('File size must be less than 10MB');
      return;
    }

    setFiles(prev => ({
      ...prev,
      [name]: file
    }));
  };

  const uploadFile = async (file, type, testId) => {
    const formData = new FormData();
    formData.append(type, file);
    
    try {
      const response = await axios.post(`/api/upload/${type}/${testId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(prev => ({
            ...prev,
            [type]: percentCompleted
          }));
        }
      });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to upload ${type}: ${error.response?.data?.message || error.message}`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!files.questionPaper) {
      toast.error('Question paper upload is compulsory');
      return;
    }

    if (parseInt(formData.questionsCount) <= 0) {
      toast.error('Number of questions must be greater than 0');
      return;
    }

    if (parseInt(formData.passingMarks) > parseInt(formData.totalMarks)) {
      toast.error('Passing marks cannot be greater than total marks');
      return;
    }

    setUploading(true);
    
    try {
      // Step 1: Create test
      const testResponse = await axios.post('/api/admin/tests', formData);
      const testId = testResponse.data.test._id;

      toast.info('Test created. Uploading files...');

      // Step 2: Upload compulsory files
      await uploadFile(files.questionPaper, 'question-paper', testId);
      setUploadProgress(prev => ({ ...prev, questionPaper: 100 }));
      if(files.answerSheet){
      await uploadFile(files.answerSheet, 'answer-sheet', testId);
      setUploadProgress(prev => ({ ...prev, answerSheet: 100 }));
      }

      // Step 3: Upload optional answer key
      if (files.answerKey) {
        await uploadFile(files.answerKey, 'answer-key', testId);
        setUploadProgress(prev => ({ ...prev, answerKey: 100 }));
      }

      toast.success('✅ Test created successfully with all uploads!');
      
      // Reset form
      setFormData({
        title: '', description: '', subject: '', class: '', board: '',
        duration: '', totalMarks: '', passingMarks: '', questionsCount: '',
        startDate: '', endDate: '', resumeEnabled: true, answerKeyVisible: false,
        proctoringSettings: {
          strictMode: true, allowTabSwitch: 0, requireFullscreen: true,
          blockRightClick: true, blockKeyboardShortcuts: true
        }
      });
      setFiles({ questionPaper: null, answerSheet: null, answerKey: null });
      setUploadProgress({});

      if (onTestCreated) onTestCreated();

    } catch (error) {
      console.error('Test creation error:', error);
      toast.error(error.message || 'Failed to create test');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="test-creation-form">
      <h2>Create New Test</h2>
      
      <form onSubmit={handleSubmit} className="form-grid">
        {/* Basic Information */}
        <div className="form-section">
          <h3>Basic Information</h3>
          
          <div className="form-group">
            <label>Test Title *</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              required
              placeholder="Enter test title"
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Enter test description"
              rows="3"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Subject *</label>
              <input
                type="text"
                name="subject"
                value={formData.subject}
                onChange={handleInputChange}
                required
                placeholder="e.g., Mathematics"
              />
            </div>

            <div className="form-group">
              <label>Class *</label>
              <select
                name="class"
                value={formData.class}
                onChange={handleInputChange}
                required
              >
                <option value="">Select Class</option>
                {Array.from({length: 12}, (_, i) => (
                  <option key={i+1} value={i+1}>{i+1}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Board *</label>
              <select
                name="board"
                value={formData.board}
                onChange={handleInputChange}
                required
              >
                <option value="">Select Board</option>
                <option value="CBSE">CBSE</option>
                <option value="ICSE">ICSE</option>
                <option value="State Board">State Board</option>
              </select>
            </div>
          </div>
        </div>

        {/* Test Configuration */}
        <div className="form-section">
          <h3>Test Configuration</h3>
          
          <div className="form-row">
            <div className="form-group">
              <label>Duration (minutes) *</label>
              <input
                type="number"
                name="duration"
                value={formData.duration}
                onChange={handleInputChange}
                required
                min="1"
                placeholder="e.g., 120"
              />
            </div>

            <div className="form-group">
              <label>Total Questions * 🆕</label>
              <input
                type="number"
                name="questionsCount"
                value={formData.questionsCount}
                onChange={handleInputChange}
                required
                min="1"
                placeholder="e.g., 50"
              />
            </div>

            <div className="form-group">
              <label>Total Marks *</label>
              <input
                type="number"
                name="totalMarks"
                value={formData.totalMarks}
                onChange={handleInputChange}
                required
                min="1"
                placeholder="e.g., 100"
              />
            </div>

            <div className="form-group">
              <label>Passing Marks *</label>
              <input
                type="number"
                name="passingMarks"
                value={formData.passingMarks}
                onChange={handleInputChange}
                required
                min="1"
                placeholder="e.g., 40"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Start Date & Time *</label>
              <input
                type="datetime-local"
                name="startDate"
                value={formData.startDate}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="form-group">
              <label>End Date & Time *</label>
              <input
                type="datetime-local"
                name="endDate"
                value={formData.endDate}
                onChange={handleInputChange}
                required
              />
            </div>
          </div>
        </div>

        {/* File Uploads */}
        <div className="form-section">
          <h3>File Uploads</h3>
          
          {/* Question Paper - COMPULSORY */}
          <div className="form-group">
            <label className="required">Question Paper (PDF) * 🔴 COMPULSORY</label>
            <input
              type="file"
              name="questionPaper"
              onChange={handleFileChange}
              accept=".pdf"
              required
              className="file-input"
            />
            {files.questionPaper && (
              <div className="file-info">
                ✅ {files.questionPaper.name} ({(files.questionPaper.size / 1024 / 1024).toFixed(2)} MB)
              </div>
            )}
            {uploadProgress.questionPaper > 0 && (
              <div className="progress-bar">
                <div className="progress-fill" style={{width: `${uploadProgress.questionPaper}%`}}></div>
                <span>{uploadProgress.questionPaper}%</span>
              </div>
            )}
          </div>

          {/* Answer Sheet - COMPULSORY */}
          <div className="form-group">
            <label className="required">Sample Answer Sheet (PDF) * 🔴 COMPULSORY</label>
            <input
              type="file"
              name="answerSheet"
              onChange={handleFileChange}
              accept=".pdf"
              className="file-input"
            />
            {files.answerSheet && (
              <div className="file-info">
                ✅ {files.answerSheet.name} ({(files.answerSheet.size / 1024 / 1024).toFixed(2)} MB)
              </div>
            )}
            {uploadProgress.answerSheet > 0 && (
              <div className="progress-bar">
                <div className="progress-fill" style={{width: `${uploadProgress.answerSheet}%`}}></div>
                <span>{uploadProgress.answerSheet}%</span>
              </div>
            )}
          </div>

          {/* Answer Key - OPTIONAL */}
          <div className="form-group">
            <label>Answer Key (PDF) 🟡 OPTIONAL</label>
            <input
              type="file"
              name="answerKey"
              onChange={handleFileChange}
              accept=".pdf"
              className="file-input"
            />
            {files.answerKey && (
              <div className="file-info">
                ✅ {files.answerKey.name} ({(files.answerKey.size / 1024 / 1024).toFixed(2)} MB)
              </div>
            )}
            {uploadProgress.answerKey > 0 && (
              <div className="progress-bar">
                <div className="progress-fill" style={{width: `${uploadProgress.answerKey}%`}}></div>
                <span>{uploadProgress.answerKey}%</span>
              </div>
            )}
            
            <div className="checkbox-group">
              <label>
                <input
                  type="checkbox"
                  name="answerKeyVisible"
                  checked={formData.answerKeyVisible}
                  onChange={handleInputChange}
                />
                Show answer key to students after test completion
              </label>
            </div>
          </div>
        </div>

        {/* Enhanced Proctoring Settings */}
        <div className="form-section">
          <h3>🔒 Enhanced Proctoring Settings</h3>
          
          <div className="checkbox-group">
            <label>
              <input
                type="checkbox"
                name="proctoringSettings.strictMode"
                checked={formData.proctoringSettings.strictMode}
                onChange={handleInputChange}
              />
              Enable Strict Proctoring Mode
            </label>
          </div>

          <div className="form-group">
            <label>Allowed Tab Switches</label>
            <select
              name="proctoringSettings.allowTabSwitch"
              value={formData.proctoringSettings.allowTabSwitch}
              onChange={handleInputChange}
            >
              <option value={0}>No tab switches allowed</option>
              <option value={1}>1 tab switch allowed</option>
              <option value={2}>2 tab switches allowed</option>
              <option value={3}>3 tab switches allowed</option>
            </select>
          </div>

          <div className="checkbox-group">
            <label>
              <input
                type="checkbox"
                name="proctoringSettings.requireFullscreen"
                checked={formData.proctoringSettings.requireFullscreen}
                onChange={handleInputChange}
              />
              Require Fullscreen Mode
            </label>
          </div>

          <div className="checkbox-group">
            <label>
              <input
                type="checkbox"
                name="proctoringSettings.blockRightClick"
                checked={formData.proctoringSettings.blockRightClick}
                onChange={handleInputChange}
              />
              Block Right Click
            </label>
          </div>

          <div className="checkbox-group">
            <label>
              <input
                type="checkbox"
                name="proctoringSettings.blockKeyboardShortcuts"
                checked={formData.proctoringSettings.blockKeyboardShortcuts}
                onChange={handleInputChange}
              />
              Block Keyboard Shortcuts
            </label>
          </div>

          <div className="checkbox-group">
            <label>
              <input
                type="checkbox"
                name="resumeEnabled"
                checked={formData.resumeEnabled}
                onChange={handleInputChange}
              />
              🔄 Enable Test Resume (if interrupted)
            </label>
          </div>
        </div>

        {/* Submit Button */}
        <div className="form-actions">
          <button
            type="submit"
            className="btn btn-primary btn-large"
            disabled={uploading}
          >
            {uploading ? '📤 Creating Test & Uploading Files...' : '🚀 Create Test'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TestCreationForm;

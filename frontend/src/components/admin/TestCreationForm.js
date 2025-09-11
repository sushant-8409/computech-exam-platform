import React, { useState } from 'react';
import { CLASS_OPTIONS, BOARD_OPTIONS } from '../../constants/classBoardOptions';
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
      blockKeyboardShortcuts: true,
      maxViolations: 10
    },
    // Camera Monitoring Settings
    cameraMonitoring: {
      enabled: false,
      captureInterval: 60,
      saveToGoogleDrive: true,
      requireCameraAccess: false,
      faceDetection: false,
      suspiciousActivityDetection: true
    },
    // Paper submission settings
    paperSubmissionRequired: false,
    paperUploadTimeLimit: 15,
    paperUploadAllowedDuringTest: false
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
          blockRightClick: true, blockKeyboardShortcuts: true, maxViolations: 10
        },
        cameraMonitoring: {
          enabled: false, captureInterval: 60, saveToGoogleDrive: true,
          requireCameraAccess: false, faceDetection: false, suspiciousActivityDetection: true
        },
        paperSubmissionRequired: false,
        paperUploadTimeLimit: 15,
        paperUploadAllowedDuringTest: false
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
                {CLASS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
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
                {BOARD_OPTIONS.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
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

          <div className="form-group">
            <label>Maximum Violations Allowed</label>
            <input
              type="number"
              name="proctoringSettings.maxViolations"
              value={formData.proctoringSettings.maxViolations}
              onChange={handleInputChange}
              min="1"
              max="10"
              placeholder="e.g., 10"
            />
            <small>Students will be automatically flagged if they exceed this limit (Max: 10)</small>
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

        {/* Camera Monitoring Settings */}
        <div className="form-section">
          <h3>📷 Camera Monitoring Settings</h3>
          
          <div className="checkbox-group">
            <label>
              <input
                type="checkbox"
                name="cameraMonitoring.enabled"
                checked={formData.cameraMonitoring.enabled}
                onChange={handleInputChange}
              />
              Enable Camera Monitoring
            </label>
            <small>Automatically capture photos during the test for proctoring</small>
          </div>

          {formData.cameraMonitoring.enabled && (
            <>
              <div className="checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    name="cameraMonitoring.requireCameraAccess"
                    checked={formData.cameraMonitoring.requireCameraAccess}
                    onChange={handleInputChange}
                  />
                  Require Camera Access (Test cannot start without camera)
                </label>
              </div>

              <div className="form-group">
                <label>Photo Capture Interval (seconds)</label>
                <select
                  name="cameraMonitoring.captureInterval"
                  value={formData.cameraMonitoring.captureInterval}
                  onChange={handleInputChange}
                >
                  <option value={30}>Every 30 seconds</option>
                  <option value={60}>Every 1 minute</option>
                  <option value={120}>Every 2 minutes</option>
                  <option value={300}>Every 5 minutes</option>
                </select>
              </div>

              <div className="checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    name="cameraMonitoring.saveToGoogleDrive"
                    checked={formData.cameraMonitoring.saveToGoogleDrive}
                    onChange={handleInputChange}
                  />
                  Save Photos to Google Drive
                </label>
                <small>Photos will be automatically uploaded to Google Drive for storage</small>
              </div>

              <div className="checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    name="cameraMonitoring.suspiciousActivityDetection"
                    checked={formData.cameraMonitoring.suspiciousActivityDetection}
                    onChange={handleInputChange}
                  />
                  Enable Suspicious Activity Detection
                </label>
                <small>AI-powered detection of potential cheating behaviors</small>
              </div>

              <div className="checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    name="cameraMonitoring.faceDetection"
                    checked={formData.cameraMonitoring.faceDetection}
                    onChange={handleInputChange}
                  />
                  Enable Face Detection
                </label>
                <small>Detect multiple faces or absence of the test taker</small>
              </div>
            </>
          )}
        </div>

        {/* Paper Submission Settings */}
        <div className="form-section">
          <h3>📄 Paper Submission Settings</h3>
          
          <div className="checkbox-group">
            <label>
              <input
                type="checkbox"
                name="paperSubmissionRequired"
                checked={formData.paperSubmissionRequired}
                onChange={handleInputChange}
              />
              📝 Require Paper Submission
            </label>
          </div>

          {formData.paperSubmissionRequired && (
            <>
              <div className="form-group">
                <label>Paper Upload Time Limit (minutes)</label>
                <input
                  type="number"
                  name="paperUploadTimeLimit"
                  value={formData.paperUploadTimeLimit}
                  onChange={handleInputChange}
                  min="5"
                  max="60"
                  placeholder="e.g., 15"
                />
                <small>Time allocated after test completion for paper upload</small>
              </div>

              <div className="checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    name="paperUploadAllowedDuringTest"
                    checked={formData.paperUploadAllowedDuringTest}
                    onChange={handleInputChange}
                  />
                  Allow Paper Upload During Test
                </label>
                <small>If enabled, students can upload their answer sheets during the test</small>
              </div>
            </>
          )}
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

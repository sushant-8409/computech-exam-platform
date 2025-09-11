import React, { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'react-toastify';
import axios from 'axios';
import { jsPDF } from 'jspdf';
import './PaperUpload.module.css';

const PaperUpload = ({ testId, test, user, onUploadComplete, disabled = false }) => {
  const [capturedImages, setCapturedImages] = useState([]);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [answerSheetUrl, setAnswerSheetUrl] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [timerActive, setTimerActive] = useState(false);

  const cameraRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const timerRef = useRef(null);

  // Paper upload timer (15 minutes after test completion)
  useEffect(() => {
    if (test?.paperSubmissionRequired && test?.paperUploadTimeLimit && timerActive) {
      setTimeLeft(test.paperUploadTimeLimit * 60); // Convert minutes to seconds
      
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setTimerActive(false);
            toast.error('Paper upload time expired!');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };
    }
  }, [test, timerActive]);

  const startTimer = useCallback(() => {
    if (test?.paperSubmissionRequired) {
      setTimerActive(true);
    }
  }, [test]);

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        cameraRef.current = stream;
        setIsCameraActive(true);
      }
    } catch (error) {
      console.error('Camera access failed:', error);
      toast.error('Unable to access camera. Please check permissions.');
    }
  };

  const stopCamera = () => {
    if (cameraRef.current) {
      cameraRef.current.getTracks().forEach(track => track.stop());
      cameraRef.current = null;
    }
    setIsCameraActive(false);
  };

  const captureImage = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      const pageNumber = capturedImages.length + 1;
      const imageFile = new File([blob], `answer-page-${pageNumber}.jpg`, { type: 'image/jpeg' });
      
      setCapturedImages(prev => [...prev, {
        file: imageFile,
        url: URL.createObjectURL(blob),
        pageNumber
      }]);

      toast.success(`Page ${pageNumber} captured successfully!`);
    }, 'image/jpeg', 0.9);
  };

  const removeImage = (index) => {
    setCapturedImages(prev => {
      const newImages = prev.filter((_, i) => i !== index);
      // Renumber pages
      return newImages.map((img, i) => ({
        ...img,
        pageNumber: i + 1
      }));
    });
  };

  const convertToPDF = async () => {
    if (capturedImages.length === 0) {
      toast.error('Please capture at least one page');
      return null;
    }

    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      for (let i = 0; i < capturedImages.length; i++) {
        if (i > 0) pdf.addPage();

        const img = capturedImages[i];
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const image = new Image();

        await new Promise((resolve, reject) => {
          image.onload = () => {
            canvas.width = image.width;
            canvas.height = image.height;
            ctx.drawImage(image, 0, 0);

            const imgData = canvas.toDataURL('image/jpeg', 0.9);
            const imgWidth = pageWidth - 20; // 10mm margin on each side
            const imgHeight = (image.height * imgWidth) / image.width;

            // Center the image and maintain aspect ratio
            const x = 10; // 10mm left margin
            const y = Math.max(10, (pageHeight - imgHeight) / 2); // Center vertically

            pdf.addImage(imgData, 'JPEG', x, y, imgWidth, Math.min(imgHeight, pageHeight - 20));

            // Add page number
            pdf.setFontSize(10);
            pdf.text(`Page ${i + 1}`, pageWidth - 30, pageHeight - 10);

            resolve();
          };
          image.onerror = reject;
          image.src = img.url;
        });
      }

      // Add header information
      pdf.setFontSize(12);
      pdf.text(`Student: ${user?.name || 'Unknown'}`, 10, 10);
      pdf.text(`Test: ${test?.title || 'Unknown Test'}`, 10, 20);
      pdf.text(`Submitted: ${new Date().toLocaleString()}`, 10, 30);

      return pdf.output('blob');
    } catch (error) {
      console.error('PDF conversion failed:', error);
      toast.error('Failed to convert images to PDF');
      return null;
    }
  };

  const uploadPDF = async () => {
    if (capturedImages.length === 0) {
      toast.error('Please capture at least one page before uploading');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const pdfBlob = await convertToPDF();
      if (!pdfBlob) return;

      const formData = new FormData();
      const fileName = `answer-sheet-${user?.name?.replace(/[^a-zA-Z0-9]/g, '-')}-${testId}-${Date.now()}.pdf`;
      formData.append('answerSheet', pdfBlob, fileName);
      formData.append('testId', testId);
      formData.append('studentId', user?._id);

      const response = await axios.post('/api/student/upload-answer-sheet', formData, {
        headers: { 
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        }
      });

      if (response.data.success) {
        setAnswerSheetUrl(response.data.url);
        toast.success('Answer sheet uploaded successfully!');
        
        // Clear captured images after successful upload
        setCapturedImages([]);
        
        if (onUploadComplete) {
          onUploadComplete(response.data.url);
        }
      }
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error(error.response?.data?.message || 'Failed to upload answer sheet');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  if (!test?.paperSubmissionRequired) {
    return null;
  }

  return (
    <div className="paper-upload-container">
      <div className="paper-upload-header">
        <h3>📄 Answer Sheet Submission</h3>
        {timerActive && timeLeft > 0 && (
          <div className="upload-timer">
            <span className="timer-label">Time remaining:</span>
            <span className={`timer-value ${timeLeft < 300 ? 'urgent' : ''}`}>
              {formatTime(timeLeft)}
            </span>
          </div>
        )}
      </div>

      {answerSheetUrl ? (
        <div className="upload-success">
          <div className="success-message">
            <span className="success-icon">✅</span>
            <span>Answer sheet uploaded successfully!</span>
          </div>
          <a href={answerSheetUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
            View Uploaded Sheet
          </a>
        </div>
      ) : (
        <>
          <div className="capture-section">
            <div className="capture-controls">
              <button
                className="btn btn-primary"
                onClick={() => setShowCameraModal(true)}
                disabled={disabled || isUploading || (timerActive && timeLeft === 0)}
              >
                📸 Capture Answer Sheets
              </button>
              
              {capturedImages.length > 0 && (
                <button
                  className="btn btn-success"
                  onClick={uploadPDF}
                  disabled={disabled || isUploading || (timerActive && timeLeft === 0)}
                >
                  {isUploading ? `🔄 Uploading... ${uploadProgress}%` : '📤 Upload PDF'}
                </button>
              )}
            </div>

            {capturedImages.length > 0 && (
              <div className="captured-images">
                <h4>Captured Pages ({capturedImages.length})</h4>
                <div className="images-grid">
                  {capturedImages.map((img, index) => (
                    <div key={index} className="image-card">
                      <img src={img.url} alt={`Page ${img.pageNumber}`} />
                      <div className="image-overlay">
                        <span className="page-number">Page {img.pageNumber}</span>
                        <button
                          className="remove-btn"
                          onClick={() => removeImage(index)}
                          disabled={isUploading}
                        >
                          ❌
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Camera Modal */}
          {showCameraModal && (
            <div className="camera-modal-overlay">
              <div className="camera-modal">
                <div className="camera-header">
                  <h3>📸 Capture Answer Sheet</h3>
                  <button
                    className="close-btn"
                    onClick={() => {
                      setShowCameraModal(false);
                      stopCamera();
                    }}
                  >
                    ❌
                  </button>
                </div>

                <div className="camera-content">
                  {!isCameraActive ? (
                    <div className="camera-start">
                      <p>Click "Start Camera" to begin capturing your answer sheets</p>
                      <button className="btn btn-primary" onClick={startCamera}>
                        📹 Start Camera
                      </button>
                    </div>
                  ) : (
                    <div className="camera-view">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="camera-video"
                      />
                      <canvas ref={canvasRef} style={{ display: 'none' }} />
                      
                      <div className="camera-controls">
                        <button
                          className="btn btn-success capture-btn"
                          onClick={captureImage}
                        >
                          📸 Capture Page {capturedImages.length + 1}
                        </button>
                        <button
                          className="btn btn-secondary"
                          onClick={() => {
                            setShowCameraModal(false);
                            stopCamera();
                          }}
                        >
                          ✅ Done Capturing
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PaperUpload;

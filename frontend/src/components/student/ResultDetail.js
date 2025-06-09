import React, { useState, useEffect } from 'react';
import './ResultDetail.css';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import LoadingSpinner from '../LoadingSpinner';
import ErrorMessage from '../ErrorMessage';

// Custom status badge component
const StatusBadge = ({ status }) => {
  const statusStyles = {
    pending: 'bg-secondary',
    reviewed: 'bg-warning',
    published: 'bg-success'
  };

  return (
    <span className={`badge ${statusStyles[status] || 'bg-secondary'} text-white p-2 rounded-pill`}>
      {status}
    </span>
  );
};

const ResultDetail = () => {
  const { resultId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    const fetchResult = async () => {
      try {
        const { data } = await axios.get(`/api/student/result/${resultId}`);
        if (!data.success) throw new Error(data.message);
        
        setResult({
          ...data.result,
          testTitle: data.result.test?.title || 'Deleted Test',
          subject: data.result.test?.subject || 'N/A'
        });
      } catch (err) {
        setError(err.response?.data?.message || err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchResult();
  }, [resultId]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div className="container py-4 result-detail">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <Link to="/dashboard" className="btn btn-outline-primary">
          Back to Dashboard
        </Link>
        <StatusBadge status={result.status} />
      </div>

      <div className="card shadow-sm mb-4">
        <div className="card-body">
          <h2 className="card-title mb-3">{result.testTitle}</h2>
          <div className="row">
            <div className="col-md-6">
              <p><strong>Subject:</strong> {result.subject}</p>
              <p><strong>Submitted At:</strong> {new Date(result.submittedAt).toLocaleString()}</p>
            </div>
            <div className="col-md-6">
              <p><strong>Total Marks:</strong> {result.totalMarks}</p>
              <p className="h5">
                <strong>Obtained Marks:</strong> {result.marksObtained ?? 'Pending'}
                {result.percentage && ` (${result.percentage}%)`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {result.answerSheetUrl && (
        <div className="card shadow-sm mb-4">
          <div className="card-body">
            <h4 className="mb-3">Answer Sheet</h4>
            <div className="ratio ratio-16x9">
              <iframe 
                src={result.answerSheetUrl} 
                title="Answer Sheet"
                className="rounded"
              />
            </div>
            <a 
              href={result.answerSheetUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="btn btn-link mt-3"
            >
              Open in New Tab
            </a>
          </div>
        </div>
      )}

      {result.questionWiseMarks?.length > 0 && (
        <div className="card shadow-sm">
          <div className="card-body">
            <h4 className="mb-3">Detailed Breakdown</h4>
            <div className="table-responsive">
              <table className="table table-hover">
                <thead className="table-light">
                  <tr>
                    <th>Question</th>
                    <th>Max Marks</th>
                    <th>Obtained</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {result.questionWiseMarks.map((q, index) => (
                    <tr key={index}>
                      <td>#{q.questionNo}</td>
                      <td>{q.maxMarks}</td>
                      <td className={q.obtainedMarks < (q.maxMarks * 0.4) ? 'text-danger' : ''}>
                        {q.obtainedMarks}
                      </td>
                      <td className="text-muted">{q.remarks || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {result.adminComments && (
        <div className="card shadow-sm mt-4 border-warning">
          <div className="card-body">
            <h5 className="text-warning">Examiner Comments</h5>
            <p className="mb-0">{result.adminComments}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResultDetail;

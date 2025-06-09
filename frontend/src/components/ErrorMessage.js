import React from 'react';
import { Alert } from 'react-bootstrap';

const ErrorMessage = ({ message }) => {
  return (
    <div className="error-message mt-4">
      <Alert variant="danger">
        <i className="bi bi-exclamation-octagon-fill me-2"></i>
        {message || 'An error occurred'}
      </Alert>
    </div>
  );
};

export default ErrorMessage;

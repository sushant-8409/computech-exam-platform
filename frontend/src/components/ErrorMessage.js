import React from 'react';

const ErrorMessage = ({ message }) => {
  return (
    <div className="error-message mt-4">
        <i className="bi bi-exclamation-octagon-fill me-2"></i>
        {message || 'An error occurred'}
    </div>
  );
};

export default ErrorMessage;

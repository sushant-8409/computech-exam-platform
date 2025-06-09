import React from 'react';
import { Badge } from 'react-bootstrap';

const statusColors = {
  pending: 'secondary',
  reviewed: 'warning',
  published: 'success'
};

const ResultStatusBadge = ({ status }) => {
  return (
    <Badge bg={statusColors[status]} className="text-capitalize">
      <i className="bi bi-circle-fill me-2"></i>
      {status}
    </Badge>
  );
};

export default ResultStatusBadge;

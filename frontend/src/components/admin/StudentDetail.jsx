// src/components/admin/StudentDetailPage.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate }        from 'react-router-dom';
import axios                              from 'axios';
import './StudentDetail.css'; // ensure this file exists and is named lowercase
const StudentDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);

  useEffect(() => {
    axios.get(`/api/admin/students/${id}`)
      .then(({ data }) => setStudent(data.data))
      .catch(() => alert('Failed to load student'));
  }, [id]);

  if (!student) return <p>Loading…</p>;

  return (
    <div className="student-detail-page">
      <h1>Student Details</h1>
      <button onClick={() => navigate(-1)}>← Back</button>
      <dl>
        <dt>Name:</dt><dd>{student.name}</dd>
        <dt>Email:</dt><dd>{student.email}</dd>
        <dt>Class:</dt><dd>{student.class}</dd>
        <dt>Board:</dt><dd>{student.board}</dd>
        <dt>Roll No:</dt><dd>{student.rollNo || 'N/A'}</dd>
        <dt>Approved:</dt><dd>{student.approved ? 'Yes' : 'No'}</dd>
        {/* add other fields as needed */}
      </dl>
    </div>
  );
};

export default StudentDetailPage;

import React from 'react';
import { useNavigate } from 'react-router-dom';
import CodingPracticeDashboard from './CodingPracticeDashboard';

const CodingPracticeContainer = () => {
  const navigate = useNavigate();

  const handleProblemSelect = (problemId) => {
    navigate(`/student/coding-interface/${problemId}`);
  };

  return (
    <CodingPracticeDashboard 
      onProblemSelect={handleProblemSelect} 
    />
  );
};

export default CodingPracticeContainer;
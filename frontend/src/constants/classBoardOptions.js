// Centralized class and board options used across the frontend
export const CLASS_OPTIONS = [
  { value: '9', label: 'Class 9' },
  { value: '10', label: 'Class 10' },
  { value: '11', label: 'Class 11' },
  { value: '12', label: 'Class 12' }
];

export const BOARD_OPTIONS = [
  'CBSE',
  'ICSE',
  'ISC',
  'WBCHSE',
  'Other'
];

// Optional helper for recommended language per board (used in some components)
export const BOARD_LANGUAGE_RECOMMENDATION = {
  CBSE: { language: 'python', label: 'Python (Recommended for CBSE)' },
  ICSE: { language: 'java', label: 'Java (Recommended for ICSE)' },
  ISC: { language: 'java', label: 'Java (Recommended for ISC)' },
  WBCHSE: { language: 'cpp', label: 'C++ (Recommended for WBCHSE)' },
  Other: { language: 'cpp', label: 'C++ (Default)' }
};

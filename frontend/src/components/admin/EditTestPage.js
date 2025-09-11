// src/components/admin/EditTestPage.jsx

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate }      from 'react-router-dom';
import axios                           from 'axios';
import { CLASS_OPTIONS, BOARD_OPTIONS, BOARD_LANGUAGE_RECOMMENDATION } from '../../constants/classBoardOptions';
import './EditTestPage.css';            // ensure this file exists and is named lowercase

const EditTestPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [original, setOriginal] = useState({});
  const [form, setForm]         = useState({});
  const [loading, setLoading]   = useState(true);
  const [testType, setTestType] = useState('traditional'); // Track test type for UI changes

  useEffect(() => {
    if (!id) return;
    axios.get(`/api/admin/tests/${id}`)
      .then(({ data }) => {
        if (data.success) {
          const t = data.data;
          setOriginal(t);
          setTestType(t.type || 'traditional'); // Set test type for UI management
          setForm({
            title:            t.title            || '',
            description:      t.description      || '',
            subject:          t.subject          || '',
            class:            t.class            || '',
            board:            t.board            || '',
            duration:         t.duration         || 0,
            totalMarks:       t.totalMarks       || 0,
            passingMarks:     t.passingMarks     || 0,
            questionsCount:   t.questionsCount   || 0,
            questionPaperURL: t.questionPaperURL || '',
            answerSheetURL:   t.answerSheetURL   || '',
            answerKeyURL:     t.answerKeyURL     || '',
            answerKeyVisible: t.answerKeyVisible || false,
            startDate:        t.startDate        ? t.startDate.slice(0,16) : '',
            endDate:          t.endDate          ? t.endDate.slice(0,16)   : '',
            active:           t.active           || false,
            type:             t.type             || 'traditional'
          });
        }
      })
      .catch(err => alert('Fetch failed: ' + err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p>Loading…</p>;

  const handleChange = e => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;
    
    // Update test type state for UI management
    if (name === 'type') {
      setTestType(value);
    }
    
    setForm(f => ({ ...f, [name]: newValue }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    const diff = {};
    Object.keys(form).forEach(key => {
      const newVal = (key==='startDate'||key==='endDate') ? new Date(form[key]) : form[key];
      if (newVal !== original[key]) diff[key] = newVal;
    });
    if (!Object.keys(diff).length) return alert('No changes to save');
    try {
      await axios.patch(`/api/admin/tests/${id}`, diff);
      alert('Test updated');
      navigate('/admin/tests');
    } catch (err) {
      alert('Update failed: ' + (err.response?.data?.message||err.message));
    }
  };

  return (
    <div className={`edit-test-page ${testType === 'coding' ? 'coding-test-theme' : 'traditional-test-theme'}`}>
      <div className="container form-wrapper">
        <h1>Edit Test - {testType === 'coding' ? 'Coding Test' : 'Traditional Test'}</h1>
        <form onSubmit={handleSubmit}>
          <label>
            Test Type
            <select name="type" value={form.type} onChange={handleChange}>
              <option value="traditional">Traditional Test</option>
              <option value="coding">Coding Test</option>
            </select>
          </label>

          <label>
            Title
            <input name="title" value={form.title} onChange={handleChange} />
          </label>

          <label>
            Description
            <textarea name="description" value={form.description} onChange={handleChange} />
          </label>

          <label>
            Subject
            <input name="subject" value={form.subject} onChange={handleChange} />
          </label>

          <label>
            Class
            <select name="class" value={form.class} onChange={handleChange}>
              <option value="">Select Class</option>
              {CLASS_OPTIONS.map(cls => (
                <option key={cls.value} value={cls.value}>{cls.label}</option>
              ))}
            </select>
          </label>

          <label>
            Board
            <select name="board" value={form.board} onChange={handleChange}>
              <option value="">Select Board</option>
              {BOARD_OPTIONS.map(board => (
                <option key={board} value={board}>{board}</option>
              ))}
            </select>
          </label>

          <label>
            Duration (minutes)
            <input type="number" name="duration" value={form.duration} onChange={handleChange} />
          </label>

          <label>
            Total Marks
            <input type="number" name="totalMarks" value={form.totalMarks} onChange={handleChange} />
          </label>

          <label>
            Passing Marks
            <input type="number" name="passingMarks" value={form.passingMarks} onChange={handleChange} />
          </label>

          <label>
            Questions Count
            <input type="number" name="questionsCount" value={form.questionsCount} onChange={handleChange} />
          </label>

          {/* Traditional Test specific fields */}
          {testType === 'traditional' && (
            <>
              <label>
                Question Paper URL
                <input type="url" name="questionPaperURL" value={form.questionPaperURL} onChange={handleChange} />
              </label>

              <label>
                Answer Sheet URL
                <input type="url" name="answerSheetURL" value={form.answerSheetURL} onChange={handleChange} />
              </label>

              <label>
                Answer Key URL
                <input type="url" name="answerKeyURL" value={form.answerKeyURL} onChange={handleChange} />
              </label>
            </>
          )}

          {/* Coding Test specific message */}
          {testType === 'coding' && (
            <div className="coding-test-info">
              <p><strong>Note:</strong> Coding test questions and problems are managed through the coding test interface. Only basic test settings can be edited here.</p>
            </div>
          )}

          <div className="checkbox-group">
            {testType === 'traditional' && (
              <label>
                <input
                  type="checkbox"
                  name="answerKeyVisible"
                  checked={form.answerKeyVisible}
                  onChange={handleChange}
                /> Show Answer Key
              </label>
            )}
            <label>
              <input
                type="checkbox"
                name="active"
                checked={form.active}
                onChange={handleChange}
              /> Active
            </label>
          </div>

          <label>
            Start Date & Time
            <input
              type="datetime-local"
              name="startDate"
              value={form.startDate}
              onChange={handleChange}
            />
          </label>

          <label>
            End Date & Time
            <input
              type="datetime-local"
              name="endDate"
              value={form.endDate}
              onChange={handleChange}
            />
          </label>

          <div className="button-group">
            <button type="button" className="secondary" onClick={() => navigate(-1)}>
              Cancel
            </button>
            <button type="submit" className="primary">
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditTestPage;

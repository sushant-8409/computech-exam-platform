// src/components/admin/EditStudentPage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate }        from 'react-router-dom';
import axios                              from 'axios';
 // Assuming you have a CSS module for styles
const EditStudentPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [original, setOriginal] = useState({});
  const [form, setForm]         = useState({});
  const [loading, setLoading]   = useState(true);

  // Load student on mount
  useEffect(() => {
    axios.get(`/api/admin/students/${id}`)
      .then(({ data }) => {
        setOriginal(data.data);
        setForm({
          name:           data.data.name || '',
          email:          data.data.email || '',
          class:          data.data.class || '',
          board:          data.data.board || '',
          school:         data.data.school || '',
          rollNo:         data.data.rollNo || '',
          mobile:         data.data.mobile || '',
          approved:       data.data.approved || false
        });
      })
      .catch(() => alert('Load failed'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p>Loading…</p>;

  const handleChange = e => {
    const { name, value, type, checked } = e.target;
    setForm(f => ({
      ...f,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    // Build diff
    const diff = {};
    Object.keys(form).forEach(key => {
      if (form[key] !== original[key]) {
        diff[key] = form[key];
      }
    });
    if (!Object.keys(diff).length) {
      return alert('No changes to save');
    }
    try {
      await axios.patch(`/api/admin/students/${id}`, diff);
      alert('Student updated');
      navigate(-1);
    } catch {
      alert('Update failed');
    }
  };

  return (
    <div className="edit-student-page">
      <h1>Edit Student</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Name
          <input name="name" value={form.name} onChange={handleChange} />
        </label>
        <label>
          Email
          <input name="email" value={form.email} onChange={handleChange} />
        </label>
        <label>
          Class
          <input name="class" value={form.class} onChange={handleChange} />
        </label>
        <label>
          Board
          <input name="board" value={form.board} onChange={handleChange} />
        </label>
        <label>
          School
          <input name="school" value={form.school} onChange={handleChange} />
        </label>
        <label>
          Roll No
          <input name="rollNo" value={form.rollNo} onChange={handleChange} />
        </label>
        <label>
          Mobile
          <input name="mobile" value={form.mobile} onChange={handleChange} />
        </label>
        <label>
          Approved
          <input
            type="checkbox"
            name="approved"
            checked={form.approved}
            onChange={handleChange}
          />
        </label>

        <div className="button-group">
          <button type="button" onClick={() => navigate(-1)}>
            Cancel
          </button>
          <button type="submit">Save Changes</button>
        </div>
      </form>
    </div>
  );
};

export default EditStudentPage;

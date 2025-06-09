// controllers/studentController.js
const Student = require('../models/Student');

// GET /api/admin/students/:id
exports.getStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id).lean();
    if (!student) {
      return res.status(404).json({ success:false, message:'Student not found' });
    }
    res.json({ success:true, data: student });
  } catch (err) {
    res.status(500).json({ success:false, message: err.message });
  }
};

// PATCH /api/admin/students/:id/approval
exports.setApproval = async (req, res) => {
  try {
    const { approved } = req.body; // expect { approved: true|false }
    const student = await Student.findByIdAndUpdate(
      req.params.id,
      { approved: !!approved },
      { new:true }
    ).lean();
    if (!student) {
      return res.status(404).json({ success:false, message:'Student not found' });
    }
    res.json({ success:true, data: student });
  } catch (err) {
    res.status(500).json({ success:false, message: err.message });
  }
};

// PATCH /api/admin/students/:id
exports.updateStudent = async (req, res) => {
  try {
    const updates = req.body; // only fields being changed
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ success:false, message:'Student not found' });
    }
    // Apply only provided fields
    Object.keys(updates).forEach(key => {
      student[key] = updates[key];
    });
    await student.save();
    res.json({ success:true, data: student });
  } catch (err) {
    res.status(400).json({ success:false, message: err.message });
  }
};

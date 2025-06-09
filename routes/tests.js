const express = require('express');
const router = express.Router();
const Test = require('../models/Test');
const { body, validationResult } = require('express-validator');
router.get('/:id/url', async (req, res, next) => {
  try {
    const { id } = req.params;
    const test = await Test
      .findById(id)
      .select('questionPaperURL')
      .lean();
    if (!test) {
      return res.status(404).json({ success:false, message:'Test not found' });
    }
    res.json({ success:true, url: test.questionPaperURL });
  } catch (err) {
    next(err);
  }
});
module.exports = router;
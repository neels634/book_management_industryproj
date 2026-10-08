const router = require('express').Router();

router.use('/auth', require('./auth.routes'));
router.use('/users', require('./user.routes'));
router.use('/books', require('./book.routes'));
router.use('/members', require('./member.routes'));
router.use('/categories', require('./category.routes'));
router.use('/transactions', require('./transaction.routes'));
router.use('/issues', require('./issue.routes'));
router.use('/reports', require('./report.routes'));
router.use('/settings', require('./setting.routes'));

module.exports = router;

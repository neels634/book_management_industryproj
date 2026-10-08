const router = require('express').Router();
const controller = require('../controllers/report.controller');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const schemas = require('../validators/report.validator');
const { STAFF_ROLES } = require('../utils/constants');

router.use(authenticate, authorize(...STAFF_ROLES));

router.get('/dashboard', controller.dashboard);
router.get('/overdue', validate({ query: schemas.overdue }), controller.overdue);
router.get('/popular-books', validate({ query: schemas.popularBooks }), controller.popularBooks);
router.get('/books', validate({ query: schemas.booksReport }), controller.books);
router.get('/categories', validate({ query: schemas.categoryStats }), controller.categoryStats);
router.get('/fines', validate({ query: schemas.fines }), controller.fines);
router.get('/member-history', validate({ query: schemas.memberHistory }), controller.memberHistory);
router.get('/monthly', validate({ query: schemas.monthly }), controller.monthly);

module.exports = router;

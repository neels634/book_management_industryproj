const router = require('express').Router();
const controller = require('../controllers/transaction.controller');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const schemas = require('../validators/transaction.validator');
const { idParam } = require('../validators/common');
const { STAFF_ROLES } = require('../utils/constants');

const staffOnly = authorize(...STAFF_ROLES);

router.use(authenticate);

// Members may call the read endpoints; results are scoped to their own loans.
router.get('/', validate({ query: schemas.listTransactions }), controller.list);
router.post('/issue', staffOnly, validate({ body: schemas.issueBook }), controller.issue);
router.post('/return', staffOnly, validate({ body: schemas.returnBook }), controller.returnBook);
router.get('/:id', validate({ params: idParam }), controller.getById);
router.post('/:id/renew', staffOnly, validate({ params: idParam, body: schemas.renew }), controller.renew);
router.post('/:id/lost', staffOnly, validate({ params: idParam, body: schemas.markLost }), controller.markLost);
router.post('/:id/fine', staffOnly, validate({ params: idParam, body: schemas.settleFine }), controller.settleFine);

module.exports = router;

const router = require('express').Router();
const controller = require('../controllers/book.controller');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const schemas = require('../validators/book.validator');
const { listTransactions } = require('../validators/transaction.validator');
const { idParam } = require('../validators/common');
const { STAFF_ROLES } = require('../utils/constants');

const staffOnly = authorize(...STAFF_ROLES);

router.use(authenticate);

router.get('/', validate({ query: schemas.listBooks }), controller.list);
router.get('/:id', validate({ params: idParam }), controller.getById);
router.get('/:id/transactions', staffOnly, validate({ params: idParam, query: listTransactions }), controller.history);
router.post('/', staffOnly, validate({ body: schemas.createBook }), controller.create);
router.put('/:id', staffOnly, validate({ params: idParam, body: schemas.updateBook }), controller.update);
router.patch('/:id/copies', staffOnly, validate({ params: idParam, body: schemas.adjustCopies }), controller.adjustCopies);
router.delete('/:id', staffOnly, validate({ params: idParam }), controller.deactivate);

module.exports = router;

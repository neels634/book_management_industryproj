const router = require('express').Router();
const controller = require('../controllers/member.controller');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const schemas = require('../validators/member.validator');
const { listTransactions } = require('../validators/transaction.validator');
const { idParam } = require('../validators/common');
const { STAFF_ROLES } = require('../utils/constants');

// Members see their own profile via GET /api/auth/me, not through this router.
router.use(authenticate, authorize(...STAFF_ROLES));

router.get('/', validate({ query: schemas.listMembers }), controller.list);
router.get('/:id', validate({ params: idParam }), controller.getById);
router.get('/:id/transactions', validate({ params: idParam, query: listTransactions }), controller.history);
router.post('/', validate({ body: schemas.createMember }), controller.create);
router.put('/:id', validate({ params: idParam, body: schemas.updateMember }), controller.update);
router.delete('/:id', validate({ params: idParam }), controller.deactivate);

module.exports = router;

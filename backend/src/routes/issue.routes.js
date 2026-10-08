/**
 * /api/issues - circulation-desk view of open loans. Thin aliases over the
 * transaction controller so both URL styles share the same business logic.
 */
const router = require('express').Router();
const controller = require('../controllers/transaction.controller');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const schemas = require('../validators/transaction.validator');
const { idParam, z, optionalText, date } = require('../validators/common');
const { STAFF_ROLES, RETURN_CONDITION } = require('../utils/constants');

const returnById = z.object({
  returnDate: date.optional(),
  condition: z.enum(Object.values(RETURN_CONDITION)).default(RETURN_CONDITION.GOOD),
  remarks: optionalText(500),
});

router.use(authenticate, authorize(...STAFF_ROLES));

router.get('/', validate({ query: schemas.listTransactions }), controller.listOpen);
router.post('/', validate({ body: schemas.issueBook }), controller.issue);
router.post('/:id/return', validate({ params: idParam, body: returnById }), controller.returnBook);

module.exports = router;

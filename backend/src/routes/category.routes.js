const router = require('express').Router();
const controller = require('../controllers/category.controller');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const schemas = require('../validators/category.validator');
const { idParam } = require('../validators/common');
const { ROLES } = require('../utils/constants');

const adminOnly = authorize(ROLES.ADMIN);

router.use(authenticate);

router.get('/', validate({ query: schemas.listCategories }), controller.list);
router.post('/', adminOnly, validate({ body: schemas.createCategory }), controller.create);
router.put('/:id', adminOnly, validate({ params: idParam, body: schemas.updateCategory }), controller.update);
router.delete('/:id', adminOnly, validate({ params: idParam }), controller.deactivate);

module.exports = router;

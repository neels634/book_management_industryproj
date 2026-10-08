const router = require('express').Router();
const controller = require('../controllers/user.controller');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const schemas = require('../validators/auth.validator');
const { idParam } = require('../validators/common');
const { ROLES } = require('../utils/constants');

router.use(authenticate, authorize(ROLES.ADMIN));

router.get('/', validate({ query: schemas.listUsers }), controller.list);
router.post('/', validate({ body: schemas.register }), controller.create);
router.put('/:id', validate({ params: idParam, body: schemas.updateUser }), controller.update);
router.delete('/:id', validate({ params: idParam }), controller.deactivate);

module.exports = router;

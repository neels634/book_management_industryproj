const router = require('express').Router();
const controller = require('../controllers/setting.controller');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { updateSettings } = require('../validators/setting.validator');
const { ROLES } = require('../utils/constants');

router.use(authenticate);

// Everyone needs loan period, currency and fine rate to render correctly.
router.get('/', controller.get);
router.put('/', authorize(ROLES.ADMIN), validate({ body: updateSettings }), controller.update);

module.exports = router;

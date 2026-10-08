const router = require('express').Router();
const controller = require('../controllers/auth.controller');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const schemas = require('../validators/auth.validator');
const { ROLES } = require('../utils/constants');

router.post('/login', authLimiter, validate({ body: schemas.login }), controller.login);
router.post('/register', authenticate, authorize(ROLES.ADMIN), validate({ body: schemas.register }), controller.register);
router.get('/me', authenticate, controller.me);
router.post('/logout', authenticate, controller.logout);
router.put('/password', authenticate, validate({ body: schemas.changePassword }), controller.changePassword);

module.exports = router;

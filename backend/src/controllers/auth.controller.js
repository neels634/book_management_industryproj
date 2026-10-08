const authService = require('../services/auth.service');
const userService = require('../services/user.service');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendCreated } = require('../utils/apiResponse');

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  sendSuccess(res, { data: result, message: 'Logged in successfully' });
});

/** Account creation. Only an ADMIN may register users (see routes). */
const register = asyncHandler(async (req, res) => {
  const user = await userService.createUser(req.body);
  sendCreated(res, user, 'User registered successfully');
});

const me = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await authService.getProfile(req.user.id) });
});

const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.user.id);
  sendSuccess(res, { message: 'Logged out successfully' });
});

const changePassword = asyncHandler(async (req, res) => {
  const result = await authService.changePassword(req.user.id, req.body);
  sendSuccess(res, { data: result, message: 'Password changed. Other sessions have been signed out.' });
});

module.exports = { login, register, me, logout, changePassword };

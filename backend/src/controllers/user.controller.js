const userService = require('../services/user.service');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendCreated, sendPaginated } = require('../utils/apiResponse');

const list = asyncHandler(async (req, res) => {
  sendPaginated(res, await userService.listUsers(req.query));
});

const create = asyncHandler(async (req, res) => {
  sendCreated(res, await userService.createUser(req.body), 'User created');
});

const update = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await userService.updateUser(req.params.id, req.body, req.user), message: 'User updated' });
});

const deactivate = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await userService.deactivateUser(req.params.id, req.user), message: 'User deactivated' });
});

module.exports = { list, create, update, deactivate };

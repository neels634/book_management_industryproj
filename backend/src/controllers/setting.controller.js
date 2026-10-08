const settingService = require('../services/setting.service');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');

const get = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await settingService.getSettings() });
});

const update = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await settingService.updateSettings(req.body, req.user), message: 'Settings saved' });
});

module.exports = { get, update };

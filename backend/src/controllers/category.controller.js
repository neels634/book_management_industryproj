const categoryService = require('../services/category.service');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendCreated } = require('../utils/apiResponse');

const list = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await categoryService.listCategories(req.query, req.user) });
});

const create = asyncHandler(async (req, res) => {
  sendCreated(res, await categoryService.createCategory(req.body), 'Category created');
});

const update = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await categoryService.updateCategory(req.params.id, req.body), message: 'Category updated' });
});

const deactivate = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await categoryService.deactivateCategory(req.params.id), message: 'Category deactivated' });
});

module.exports = { list, create, update, deactivate };

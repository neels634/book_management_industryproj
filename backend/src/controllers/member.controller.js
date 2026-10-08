const memberService = require('../services/member.service');
const transactionService = require('../services/transaction.service');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendCreated, sendPaginated } = require('../utils/apiResponse');

const list = asyncHandler(async (req, res) => {
  sendPaginated(res, await memberService.listMembers(req.query));
});

const getById = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await memberService.getMember(req.params.id) });
});

const create = asyncHandler(async (req, res) => {
  sendCreated(res, await memberService.createMember(req.body), 'Member registered');
});

const update = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await memberService.updateMember(req.params.id, req.body), message: 'Member updated' });
});

const deactivate = asyncHandler(async (req, res) => {
  sendSuccess(res, {
    data: await memberService.deactivateMember(req.params.id),
    message: 'Membership closed. Borrowing history has been kept.',
  });
});

const history = asyncHandler(async (req, res) => {
  sendPaginated(res, await transactionService.listTransactions({ ...req.query, member: req.params.id }, req.user));
});

module.exports = { list, getById, create, update, deactivate, history };

const transactionService = require('../services/transaction.service');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendCreated, sendPaginated } = require('../utils/apiResponse');

const list = asyncHandler(async (req, res) => {
  sendPaginated(res, await transactionService.listTransactions(req.query, req.user));
});

const getById = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await transactionService.getTransaction(req.params.id, req.user) });
});

const issue = asyncHandler(async (req, res) => {
  const txn = await transactionService.issueBook(req.body, req.user);
  sendCreated(res, txn, `Issued "${txn.book.title}" to ${txn.member.name}`);
});

const returnBook = asyncHandler(async (req, res) => {
  const body = req.params.id ? { ...req.body, transaction: req.params.id } : req.body;
  const txn = await transactionService.returnBook(body, req.user);
  const fineNote = txn.fine > 0 ? ` A fine of ${txn.fine} is due.` : '';
  sendSuccess(res, { data: txn, message: `"${txn.book.title}" returned.${fineNote}` });
});

const renew = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await transactionService.renewLoan(req.params.id, req.body), message: 'Loan renewed' });
});

const markLost = asyncHandler(async (req, res) => {
  sendSuccess(res, {
    data: await transactionService.markLost(req.params.id, req.body, req.user),
    message: 'Book marked as lost',
  });
});

const settleFine = asyncHandler(async (req, res) => {
  const txn = await transactionService.settleFine(req.params.id, req.body, req.user);
  sendSuccess(res, { data: txn, message: req.body.action === 'PAY' ? 'Fine payment recorded' : 'Fine waived' });
});

/** GET /api/issues - currently open loans (alias of /transactions?status=ISSUED). */
const listOpen = asyncHandler(async (req, res) => {
  sendPaginated(
    res,
    await transactionService.listTransactions({ ...req.query, status: req.query.status || 'ISSUED' }, req.user)
  );
});

module.exports = { list, getById, issue, returnBook, renew, markLost, settleFine, listOpen };

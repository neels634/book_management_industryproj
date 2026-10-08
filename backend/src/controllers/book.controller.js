const bookService = require('../services/book.service');
const transactionService = require('../services/transaction.service');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendCreated, sendPaginated } = require('../utils/apiResponse');

const list = asyncHandler(async (req, res) => {
  sendPaginated(res, await bookService.listBooks(req.query, req.user));
});

const getById = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await bookService.getBook(req.params.id, req.user) });
});

const create = asyncHandler(async (req, res) => {
  sendCreated(res, await bookService.createBook(req.body, req.user), 'Book added to the catalogue');
});

const update = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await bookService.updateBook(req.params.id, req.body), message: 'Book updated' });
});

const deactivate = asyncHandler(async (req, res) => {
  sendSuccess(res, {
    data: await bookService.deactivateBook(req.params.id),
    message: 'Book deactivated. Its transaction history has been kept.',
  });
});

const adjustCopies = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await bookService.adjustCopies(req.params.id, req.body), message: 'Inventory updated' });
});

const history = asyncHandler(async (req, res) => {
  sendPaginated(res, await transactionService.listTransactions({ ...req.query, book: req.params.id }, req.user));
});

module.exports = { list, getById, create, update, deactivate, adjustCopies, history };

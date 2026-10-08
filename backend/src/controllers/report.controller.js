const reportService = require('../services/report.service');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');

const handler = (fn) => asyncHandler(async (req, res) => sendSuccess(res, { data: await fn(req.query) }));

module.exports = {
  dashboard: handler(() => reportService.dashboard()),
  overdue: handler(reportService.overdueReport),
  popularBooks: handler(reportService.popularBooks),
  books: handler(reportService.booksReport),
  categoryStats: handler(reportService.categoryStats),
  fines: handler(reportService.finesReport),
  memberHistory: handler(reportService.memberHistory),
  monthly: handler((query) => reportService.monthlyActivity(query.months)),
};

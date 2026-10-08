const { calculateOverdueDays, calculateOverdueFine } = require('../src/utils/fine');
const { isValidIsbn, normalizeIsbn, completeIsbn13 } = require('../src/utils/isbn');
const { endOfDay } = require('../src/utils/dates');
const { scrub } = require('../src/middleware/sanitize');
const { escapeRegex } = require('../src/utils/query');

describe('fine calculation', () => {
  const due = endOfDay(new Date(2026, 9, 10)); // 10 Oct, end of day

  it.each([
    ['same day as due date', new Date(2026, 9, 10, 18), 0],
    ['just after midnight', new Date(2026, 9, 11, 0, 5), 1],
    ['three days late (spec example)', new Date(2026, 9, 13, 10), 3],
    ['early return', new Date(2026, 9, 1), 0],
  ])('%s', (_, returned, days) => {
    expect(calculateOverdueDays(due, returned)).toBe(days);
  });

  it('multiplies by the configured daily rate and rounds to cents', () => {
    expect(calculateOverdueFine(3, 5)).toBe(15);
    expect(calculateOverdueFine(3, 0.1)).toBe(0.3);
    expect(calculateOverdueFine(0, 5)).toBe(0);
  });
});

describe('ISBN validation', () => {
  it('accepts valid ISBN-10 / ISBN-13 and normalises formatting', () => {
    expect(isValidIsbn('0-306-40615-2')).toBe(true);
    expect(isValidIsbn('978-0-306-40615-7')).toBe(true);
    expect(isValidIsbn('080442957X')).toBe(true);
    expect(normalizeIsbn(' 978 0306 40615-7 ')).toBe('9780306406157');
  });

  it('rejects wrong check digits and wrong lengths', () => {
    expect(isValidIsbn('978-0-306-40615-8')).toBe(false);
    expect(isValidIsbn('12345')).toBe(false);
    expect(isValidIsbn('abcdefghij')).toBe(false);
  });

  it('completeIsbn13 always produces a valid ISBN', () => {
    expect(isValidIsbn(completeIsbn13('978030640615'))).toBe(true);
  });
});

describe('input sanitising', () => {
  it('removes Mongo operators and dotted keys recursively', () => {
    const input = { username: { $ne: null }, nested: [{ 'a.b': 1, ok: 2 }], $where: 'x' };
    expect(scrub(input)).toEqual({ username: {}, nested: [{ ok: 2 }] });
  });

  it('escapes regex metacharacters', () => {
    expect(new RegExp(escapeRegex('(a+)+$')).test('(a+)+$')).toBe(true);
  });
});

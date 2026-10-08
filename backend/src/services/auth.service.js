const bcrypt = require('bcryptjs');
const config = require('../config/env');
const { User } = require('../models');
const ApiError = require('../utils/ApiError');
const { signToken } = require('../middleware/auth');
const { USER_STATUS } = require('../utils/constants');

// Compared against when the username does not exist, so response time does
// not reveal which usernames are registered.
let dummyHash;
const getDummyHash = () => {
  if (!dummyHash) dummyHash = bcrypt.hashSync('not-a-real-password-1', config.bcryptRounds);
  return dummyHash;
};

async function getProfile(userId) {
  const user = await User.findById(userId).populate(
    'member',
    'memberId name email phone membershipStatus membershipType borrowingLimit currentBorrowedCount membershipDate membershipExpiry'
  );
  if (!user) throw ApiError.notFound('User');
  return user;
}

async function login({ username, password }) {
  const user = await User.findOne({ username }).select('+passwordHash +tokenVersion');
  const passwordOk = user ? await user.comparePassword(password) : await bcrypt.compare(password, getDummyHash());

  if (!user || !passwordOk) {
    throw ApiError.unauthorized('Invalid username or password', 'INVALID_CREDENTIALS');
  }
  if (user.status !== USER_STATUS.ACTIVE) {
    throw ApiError.forbidden('This account has been deactivated. Contact the library administrator.', 'ACCOUNT_INACTIVE');
  }

  await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });
  return { token: signToken(user), user: await getProfile(user._id) };
}

/** Revokes every token issued to the user so far. */
async function logout(userId) {
  await User.updateOne({ _id: userId }, { $inc: { tokenVersion: 1 } });
}

async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await User.findById(userId).select('+passwordHash +tokenVersion');
  if (!user) throw ApiError.notFound('User');
  if (!(await user.comparePassword(currentPassword))) {
    throw ApiError.badRequest('Current password is incorrect', 'INVALID_PASSWORD');
  }
  user.passwordHash = await User.hashPassword(newPassword);
  user.tokenVersion += 1;
  await user.save();
  return { token: signToken(user) };
}

module.exports = { login, logout, getProfile, changePassword };

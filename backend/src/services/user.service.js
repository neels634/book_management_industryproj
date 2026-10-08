const { User, Member } = require('../models');
const ApiError = require('../utils/ApiError');
const { ROLES, USER_STATUS } = require('../utils/constants');
const { containsRegex, paginationFrom } = require('../utils/query');

async function listUsers(query) {
  const { page, limit, skip } = paginationFrom(query);
  const filter = {};
  if (query.role) filter.role = query.role;
  if (query.status) filter.status = query.status;
  if (query.q) {
    const rx = containsRegex(query.q);
    filter.$or = [{ name: rx }, { username: rx }];
  }
  const [items, total] = await Promise.all([
    User.find(filter).populate('member', 'memberId name').sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);
  return { items, total, page, limit };
}

async function createUser({ name, username, password, role, member }) {
  if (await User.exists({ username })) {
    throw ApiError.conflict('DUPLICATE_USERNAME', 'This username is already taken');
  }
  let linkedMember = null;
  if (member) {
    if (role !== ROLES.MEMBER) {
      throw ApiError.badRequest('Only MEMBER accounts can be linked to a library member', 'INVALID_ROLE');
    }
    linkedMember = await Member.findById(member);
    if (!linkedMember) throw ApiError.notFound('Member');
    if (linkedMember.user) throw ApiError.conflict('MEMBER_HAS_ACCOUNT', 'This member already has a login account');
  }

  const user = await User.create({
    name,
    username,
    role,
    passwordHash: await User.hashPassword(password),
    member: linkedMember ? linkedMember._id : null,
  });
  if (linkedMember) await Member.updateOne({ _id: linkedMember._id }, { $set: { user: user._id } });
  return user;
}

/** Prevents the system from ending up with no active administrator. */
async function assertAnotherActiveAdmin(userId) {
  const others = await User.countDocuments({ _id: { $ne: userId }, role: ROLES.ADMIN, status: USER_STATUS.ACTIVE });
  if (others === 0) {
    throw ApiError.conflict('LAST_ADMIN', 'At least one active administrator must remain');
  }
}

async function updateUser(id, changes, actor) {
  const user = await User.findById(id).select('+tokenVersion');
  if (!user) throw ApiError.notFound('User');

  const isSelf = user._id.toString() === actor.id;
  if (isSelf && changes.role && changes.role !== user.role) {
    throw ApiError.badRequest('You cannot change your own role', 'SELF_ROLE_CHANGE');
  }
  if (isSelf && changes.status === USER_STATUS.INACTIVE) {
    throw ApiError.badRequest('You cannot deactivate your own account', 'SELF_DEACTIVATION');
  }
  const losesAdmin =
    user.role === ROLES.ADMIN &&
    ((changes.role && changes.role !== ROLES.ADMIN) || changes.status === USER_STATUS.INACTIVE);
  if (losesAdmin) await assertAnotherActiveAdmin(user._id);
  if (changes.role && changes.role !== ROLES.MEMBER && user.member) {
    throw ApiError.badRequest('A member-linked account must keep the MEMBER role', 'INVALID_ROLE');
  }

  if (changes.name) user.name = changes.name;
  if (changes.role) user.role = changes.role;
  if (changes.status) {
    if (changes.status !== user.status) user.tokenVersion += 1;
    user.status = changes.status;
  }
  if (changes.password) {
    user.passwordHash = await User.hashPassword(changes.password);
    user.tokenVersion += 1;
  }
  await user.save();
  return User.findById(user._id).populate('member', 'memberId name');
}

async function deactivateUser(id, actor) {
  return updateUser(id, { status: USER_STATUS.INACTIVE }, actor);
}

module.exports = { listUsers, createUser, updateUser, deactivateUser };

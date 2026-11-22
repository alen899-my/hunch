const service = require('./auth.service');
const { ok, created, serverError } = require('../../utils/response');

// Shared error handler for service-thrown status errors
const handleError = (res, err) => {
  if (err.status) return res.status(err.status).json({ success: false, message: err.message });
  return serverError(res, err);
};

const register = async (req, res) => {
  try {
    const result = await service.register(req.body);
    created(res, result, 'Account created');
  } catch (err) { handleError(res, err); }
};

const login = async (req, res) => {
  try {
    const result = await service.login(req.body);
    ok(res, result, 'Login successful');
  } catch (err) { handleError(res, err); }
};

const googleAuth = async (req, res) => {
  try {
    const result = await service.googleAuth(req.body);
    ok(res, result, 'Google auth successful');
  } catch (err) { handleError(res, err); }
};

const getMe = async (req, res) => {
  try {
    const user = await service.getMe(req.user.id);
    ok(res, { user });
  } catch (err) { handleError(res, err); }
};

module.exports = { register, login, googleAuth, getMe };

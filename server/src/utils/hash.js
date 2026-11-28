const bcrypt = require('bcryptjs');

const BCRYPT_ROUNDS = 12;

const hashPassword = (plain) => bcrypt.hash(plain, BCRYPT_ROUNDS);
const comparePassword = (plain, hashed) => bcrypt.compare(plain, hashed);

module.exports = { hashPassword, comparePassword };

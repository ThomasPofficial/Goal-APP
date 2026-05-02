// Set test secret BEFORE any module that reads process.env.JWT_SECRET
process.env.JWT_SECRET = 'test_secret';

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

let mongod;

async function startDB() {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}

async function stopDB() {
  await mongoose.disconnect();
  await mongod.stop();
}

async function clearDB() {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}

function makeToken(userId) {
  return jwt.sign({ id: userId.toString() }, process.env.JWT_SECRET);
}

module.exports = { startDB, stopDB, clearDB, makeToken };

process.env.JWT_SECRET = 'test_secret';
const jwt = require('jsonwebtoken');
const { verifyToken, requireAuth, socketAuth } = require('../../middleware/auth');

const SECRET = 'test_secret';
const userId = '507f1f77bcf86cd799439011';

describe('verifyToken', () => {
  it('returns decoded payload for a valid token', () => {
    const token = jwt.sign({ id: userId }, SECRET);
    const result = verifyToken(token, SECRET);
    expect(result.id).toBe(userId);
  });
  it('throws for an invalid token', () => {
    expect(() => verifyToken('bad.token.here', SECRET)).toThrow();
  });
  it('throws for an expired token', () => {
    const token = jwt.sign({ id: userId }, SECRET, { expiresIn: -1 });
    expect(() => verifyToken(token, SECRET)).toThrow();
  });
});

describe('requireAuth', () => {
  function makeRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  }
  it('calls next() and sets req.user for a valid Bearer token', () => {
    const token = jwt.sign({ id: userId }, SECRET);
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = makeRes();
    const next = jest.fn();
    requireAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user.id).toBe(userId);
  });
  it('returns 401 when Authorization header is missing', () => {
    const req = { headers: {} };
    const res = makeRes();
    requireAuth(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });
  it('returns 401 for an invalid token', () => {
    const req = { headers: { authorization: 'Bearer bad.token' } };
    const res = makeRes();
    requireAuth(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('socketAuth', () => {
  it('sets socket.user and calls next() for a valid token', () => {
    const token = jwt.sign({ id: userId }, SECRET);
    const socket = { handshake: { auth: { token } } };
    const next = jest.fn();
    socketAuth(socket, next);
    expect(next).toHaveBeenCalledWith();
    expect(socket.user.id).toBe(userId);
  });
  it('calls next(Error) when token is missing', () => {
    const socket = { handshake: { auth: {} } };
    const next = jest.fn();
    socketAuth(socket, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
  it('calls next(Error) for an invalid token', () => {
    const socket = { handshake: { auth: { token: 'bad.token' } } };
    const next = jest.fn();
    socketAuth(socket, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

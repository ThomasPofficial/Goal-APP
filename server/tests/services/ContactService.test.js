const { startDB, stopDB, clearDB } = require('../helpers');
const ContactService = require('../../services/ContactService');
const User = require('../../models/User');
const ContactRequest = require('../../models/ContactRequest');

beforeAll(startDB);
afterAll(stopDB);
beforeEach(clearDB);

let alice, bob;
beforeEach(async () => {
  alice = await User.create({ name: 'Alice', email: 'alice@test.com' });
  bob = await User.create({ name: 'Bob', email: 'bob@test.com' });
});

describe('sendRequest', () => {
  it('creates a contact request', async () => {
    const req = await ContactService.sendRequest(alice._id, bob._id, 'Hey!');
    expect(req.sender_id.toString()).toBe(alice._id.toString());
    expect(req.recipient_id.toString()).toBe(bob._id.toString());
    expect(req.message).toBe('Hey!');
    expect(req.status).toBe('pending');
  });
  it('throws DUPLICATE_REQUEST if request already exists', async () => {
    await ContactService.sendRequest(alice._id, bob._id);
    await expect(ContactService.sendRequest(alice._id, bob._id)).rejects.toMatchObject({ code: 'DUPLICATE_REQUEST' });
  });
});

describe('acceptRequest', () => {
  it('sets status to accepted and returns a thread', async () => {
    const req = await ContactService.sendRequest(alice._id, bob._id);
    const thread = await ContactService.acceptRequest(req._id, bob._id);
    expect(thread.participants.map(String)).toEqual(expect.arrayContaining([alice._id.toString(), bob._id.toString()]));
    const updated = await ContactRequest.findById(req._id);
    expect(updated.status).toBe('accepted');
  });
  it('throws if userId is not the recipient', async () => {
    const req = await ContactService.sendRequest(alice._id, bob._id);
    await expect(ContactService.acceptRequest(req._id, alice._id)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('rejectRequest', () => {
  it('sets status to rejected', async () => {
    const req = await ContactService.sendRequest(alice._id, bob._id);
    await ContactService.rejectRequest(req._id, bob._id);
    const updated = await ContactRequest.findById(req._id);
    expect(updated.status).toBe('rejected');
  });
});

describe('cancelRequest', () => {
  it('deletes the request if sender and pending', async () => {
    const req = await ContactService.sendRequest(alice._id, bob._id);
    await ContactService.cancelRequest(req._id, alice._id);
    const found = await ContactRequest.findById(req._id);
    expect(found).toBeNull();
  });
  it('throws FORBIDDEN if not sender', async () => {
    const req = await ContactService.sendRequest(alice._id, bob._id);
    await expect(ContactService.cancelRequest(req._id, bob._id)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
  it('throws FORBIDDEN if already accepted', async () => {
    const req = await ContactService.sendRequest(alice._id, bob._id);
    await ContactService.acceptRequest(req._id, bob._id);
    await expect(ContactService.cancelRequest(req._id, alice._id)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('getPendingRequests', () => {
  it('returns only pending requests for the recipient', async () => {
    await ContactService.sendRequest(alice._id, bob._id, 'Hi');
    const requests = await ContactService.getPendingRequests(bob._id);
    expect(requests).toHaveLength(1);
    expect(requests[0].sender_id.name).toBe('Alice');
  });
});

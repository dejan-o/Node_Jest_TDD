const app = require('../src/app');
const request = require('supertest');
const User = require('../src/user/User');
const sequelize = require('../src/config/database');
const nodemailerStub = require('nodemailer-stub');

beforeAll(() => {
  return sequelize.sync();
});

beforeEach(() => {
  return User.destroy({ truncate: true });
});

const validUser = {
  username: 'user1',
  email: 'user1@mail.com',
  password: 'P4assword',
};

const postUser = (user = validUser, options = {}) => {
  const agent = request(app).post('/api/1.0/users');
  if (options.language) {
    agent.set('Accept-Language', options.language);
  }
  return agent.send(user);
};

describe('userRegistration', () => {
  it('returns 200 OK when signup request is valid', async () => {
    const response = await postUser();
    expect(response.status).toBe(200);
  });

  it('returns success msg when signup request is valid', async () => {
    const response = await postUser();
    expect(response.body.message).toBe('User created');
  });

  it('Save user to database', async () => {
    await postUser();
    const userList = await User.findAll();
    expect(userList.length).toBe(1);
  });

  it('saves username and email to database', async () => {
    await postUser();
    const userList = await User.findAll();
    const savedUser = userList[0];
    expect(savedUser.username).toBe('user1');
    expect(savedUser.email).toBe('user1@mail.com');
  });

  it('hashes password in database', async () => {
    await postUser();
    const userList = await User.findAll();
    const savedUser = userList[0];
    expect(savedUser.password).not.toBe('P4assword');
  });

  it('returns status 400 when username is null', async () => {
    const response = await postUser({
      username: null,
      email: 'user1@mail.com',
      password: 'P4assword',
    });
    expect(response.status).toBe(400);
  });

  it('returns validationErrors field in response body when validation errors ocurrs', async () => {
    const response = await postUser({
      username: null,
      email: 'user1@mail.com',
      password: 'P4assword',
    });
    const body = response.body;
    expect(body.validationErrors).not.toBeUndefined();
  });

  /*it('returns Username cannot be null when username is null', async () => {
    const response = await postUser({
      username: null,
      email: 'user1@mail',
      password: 'P4assword',
    });
    const body = response.body;
    expect(body.validationErrors.username).toBe('Username cannot be null');
  });

  it('returns Email cannot be null when email is null', async () => {
    const response = await postUser({
      username: 'user1',
      email: null,
      password: 'P4assword',
    });
    const body = response.body;
    expect(body.validationErrors.email).toBe('Email cannot be null');
  });
*/

  it('response have all validationError properties if there are errors', async () => {
    const response = await postUser({
      username: null,
      email: null,
      password: 'P4assword',
    });
    const body = response.body;
    expect(Object.keys(body.validationErrors)).toEqual(['username', 'email']);
  });
  const username_null = 'Username cannot be null';
  const username_length = 'Username must be min 4 and max 32 characters long';
  const email_null = 'Email cannot be null';
  const email_invalid = 'Email is not valid';
  const password_null = 'Password cannot be null';
  const password_pattern = 'Password must contain 1 uppercase letter, 1 lowercase letter and 1 number';
  const password_length = 'Password must be at least 6 characters long';
  const email_inuse = 'Email already in use';

  it.each`
    field         | value              | expectedMessage
    ${'username'} | ${null}            | ${username_null}
    ${'username'} | ${'usr'}           | ${username_length}
    ${'username'} | ${'a'.repeat(33)}  | ${username_length}
    ${'email'}    | ${null}            | ${email_null}
    ${'email'}    | ${'mail.com'}      | ${email_invalid}
    ${'email'}    | ${'user.mail.com'} | ${email_invalid}
    ${'email'}    | ${'user@mail'}     | ${email_invalid}
    ${'password'} | ${null}            | ${password_null}
    ${'password'} | ${'aaaaaaaa'}      | ${password_pattern}
    ${'password'} | ${'BBBBBBB'}       | ${password_pattern}
    ${'password'} | ${'b1sasss'}       | ${password_pattern}
    ${'password'} | ${'B2BBBBBB'}      | ${password_pattern}
    ${'password'} | ${'B2Ba'}          | ${password_length}
  `('returns $expectedMessage when $field is $value', async ({ field, expectedMessage, value }) => {
    const user = {
      username: 'user1',
      email: 'user1@mail.com',
      password: 'P4ssword',
    };
    user[field] = value;
    const response = await postUser(user);
    const body = response.body;
    expect(body.validationErrors[field]).toBe(expectedMessage);
  });

  it('returns email in use when email is already in use', async () => {
    await User.create({ ...validUser });
    const response = await postUser();
    expect(response.body.validationErrors.email).toBe(email_inuse);
  });

  it('returns errors for both username is null and email already in use', async () => {
    await User.create({ ...validUser });
    const user = {
      username: null,
      email: validUser.email,
      password: 'P4ssword',
    };
    const response = await postUser(user);
    const body = response.body;
    expect(Object.keys(body.validationErrors)).toEqual(['username', 'email']);
  });

  it('creates user in inactive mode', async () => {
    await postUser();
    const users = await User.findAll();
    const savedUser = users[0];
    expect(savedUser.inactive).toBe(true);
  });

  it('creates user in inactive mode even body contains inactive as false', async () => {
    const newUser = { ...validUser, inactive: false };
    await postUser(newUser);
    const users = await User.findAll();
    const savedUser = users[0];
    expect(savedUser.inactive).toBe(true);
  });

  it('creates activation token for new user', async () => {
    await postUser();
    const users = await User.findAll();
    const savedUser = users[0];
    expect(savedUser.activationToken).toBeTruthy;
  });

  it('sends account activation email with activation token', async () => {
    await postUser();
    const lastMail = nodemailerStub.interactsWithMail.lastMail();
    expect(lastMail.to[0]).toBe('user1@mail.com');
    const users = await User.findAll();
    const savedUser = users[0];
    expect(lastMail.content).toContain(savedUser.activationToken);
  });
});

describe('internationalization', () => {
  const username_null = 'Turkish Username cannot be null';
  const username_length = 'Turkish Username must be min 4 and max 32 characters long';
  const email_null = 'Email cannot be null';
  const email_invalid = 'Email is not valid';
  const password_null = 'Password cannot be null';
  const password_pattern = 'Password must contain 1 uppercase letter, 1 lowercase letter and 1 number';
  const password_length = 'Password must be at least 6 characters long';
  const email_inuse = 'Email already in use';

  it.each`
    field         | value              | expectedMessage
    ${'username'} | ${null}            | ${username_null}
    ${'username'} | ${'usr'}           | ${username_length}
    ${'username'} | ${'a'.repeat(33)}  | ${username_length}
    ${'email'}    | ${null}            | ${email_null}
    ${'email'}    | ${'mail.com'}      | ${email_invalid}
    ${'email'}    | ${'user.mail.com'} | ${email_invalid}
    ${'email'}    | ${'user@mail'}     | ${email_invalid}
    ${'password'} | ${null}            | ${password_null}
    ${'password'} | ${'aaaaaaaa'}      | ${password_pattern}
    ${'password'} | ${'BBBBBBB'}       | ${password_pattern}
    ${'password'} | ${'b1sasss'}       | ${password_pattern}
    ${'password'} | ${'B2BBBBBB'}      | ${password_pattern}
    ${'password'} | ${'B2Ba'}          | ${password_length}
  `('returns $expectedMessage when $field is $value', async ({ field, expectedMessage, value }) => {
    const user = {
      username: 'user1',
      email: 'user1@mail.com',
      password: 'P4ssword',
    };
    user[field] = value;
    const response = await postUser(user, { language: 'tr' });
    const body = response.body;
    expect(body.validationErrors[field]).toBe(expectedMessage);
  });

  it('returns email in use when email is already in use', async () => {
    await User.create({ ...validUser });
    const response = await postUser({ ...validUser }, { language: 'tr' });
    expect(response.body.validationErrors.email).toBe(email_inuse);
  });
});

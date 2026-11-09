// Tests the sharing rules: owner, shared user, and a user with no access.
var test = require('node:test');
var assert = require('node:assert');
var os = require('os');
var path = require('path');

process.env.DATA_FILE = path.join(os.tmpdir(), 'ajaia-test-' + Date.now() + '.json');
var app = require('../server');

function call(base, user, method, url, body) {
  return fetch(base + url, {
    method: method,
    headers: { 'Content-Type': 'application/json', 'x-user-id': user },
    body: body ? JSON.stringify(body) : undefined
  });
}

test('sharing gives access only to the chosen user', async function () {
  var server = app.listen(0);
  var base = 'http://localhost:' + server.address().port;

  var created = await (await call(base, 'alice', 'POST', '/api/docs', { title: 'Plan', content: '<p>hi</p>' })).json();

  // bob has no access yet
  assert.strictEqual((await call(base, 'bob', 'GET', '/api/docs/' + created.id)).status, 403);

  // bob cannot share alice's document
  assert.strictEqual((await call(base, 'bob', 'POST', '/api/docs/' + created.id + '/share', { userId: 'carol' })).status, 403);

  // alice shares with bob, now bob can read it and sees it as not owned
  assert.strictEqual((await call(base, 'alice', 'POST', '/api/docs/' + created.id + '/share', { userId: 'bob' })).status, 200);
  var asBob = await (await call(base, 'bob', 'GET', '/api/docs/' + created.id)).json();
  assert.strictEqual(asBob.owned, false);

  // carol still has no access
  assert.strictEqual((await call(base, 'carol', 'GET', '/api/docs/' + created.id)).status, 403);

  server.close();
});

test('upload rejects unsupported file types', async function () {
  var server = app.listen(0);
  var base = 'http://localhost:' + server.address().port;
  var res = await call(base, 'alice', 'POST', '/api/upload', { filename: 'a.exe', text: 'x' });
  assert.strictEqual(res.status, 400);
  server.close();
});

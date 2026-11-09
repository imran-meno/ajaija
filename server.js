// Simple document editor backend: Express + a JSON file as the database.
var express = require('express');
var fs = require('fs');
var path = require('path');

var app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

var DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data.json');

// seeded users (mock login, no passwords)
var USERS = [
  { id: 'alice', name: 'Alice' },
  { id: 'bob', name: 'Bob' },
  { id: 'carol', name: 'Carol' }
];

// ---------- tiny storage helpers ----------
function loadDb() {
  if (!fs.existsSync(DATA_FILE)) return { docs: [] };
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function saveDb(db) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

// remove script tags and inline event handlers (basic protection, see ARCHITECTURE.md)
function cleanHtml(html) {
  html = String(html || '');
  html = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  html = html.replace(/\son\w+="[^"]*"/gi, '');
  html = html.replace(/\son\w+='[^']*'/gi, '');
  html = html.replace(/javascript:/gi, '');
  return html;
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// turn plain text / simple markdown into html for the editor
function textToHtml(text, isMarkdown) {
  var lines = text.split(/\r?\n/);
  var html = '';
  var inList = false;
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var isItem = isMarkdown && /^\s*[-*]\s+/.test(line);
    if (inList && !isItem) { html += '</ul>'; inList = false; }
    if (line.trim() === '') continue;
    if (isMarkdown && /^##\s+/.test(line)) {
      html += '<h2>' + escapeHtml(line.replace(/^##\s+/, '')) + '</h2>';
    } else if (isMarkdown && /^#\s+/.test(line)) {
      html += '<h1>' + escapeHtml(line.replace(/^#\s+/, '')) + '</h1>';
    } else if (isItem) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += '<li>' + escapeHtml(line.replace(/^\s*[-*]\s+/, '')) + '</li>';
    } else {
      html += '<p>' + escapeHtml(line) + '</p>';
    }
  }
  if (inList) html += '</ul>';
  return html;
}

// ---------- middleware ----------
// mock auth: the browser sends the chosen user in the x-user-id header
function needUser(req, res, next) {
  var id = req.headers['x-user-id'];
  var user = USERS.find(function (u) { return u.id === id; });
  if (!user) return res.status(401).json({ error: 'Pick a user to log in first.' });
  req.user = user;
  next();
}

// loads the doc and checks the user is allowed to see it
function loadDoc(req, res, next) {
  var db = loadDb();
  var doc = db.docs.find(function (d) { return d.id === req.params.id; });
  if (!doc) return res.status(404).json({ error: 'Document not found.' });
  var allowed = doc.ownerId === req.user.id || doc.sharedWith.indexOf(req.user.id) !== -1;
  if (!allowed) return res.status(403).json({ error: 'You do not have access to this document.' });
  req.db = db;
  req.doc = doc;
  next();
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ---------- routes ----------
app.get('/api/users', function (req, res) {
  res.json(USERS);
});

// list documents the user owns or that were shared with them
app.get('/api/docs', needUser, function (req, res) {
  var db = loadDb();
  var mine = db.docs.filter(function (d) {
    return d.ownerId === req.user.id || d.sharedWith.indexOf(req.user.id) !== -1;
  });
  var list = mine.map(function (d) {
    return { id: d.id, title: d.title, ownerId: d.ownerId, owned: d.ownerId === req.user.id, updatedAt: d.updatedAt };
  });
  list.sort(function (a, b) { return b.updatedAt.localeCompare(a.updatedAt); });
  res.json(list);
});

app.post('/api/docs', needUser, function (req, res) {
  var title = (req.body.title || 'Untitled document').trim();
  if (title.length > 100) return res.status(400).json({ error: 'Title must be 100 characters or less.' });
  var db = loadDb();
  var doc = {
    id: newId(), title: title, content: cleanHtml(req.body.content),
    ownerId: req.user.id, sharedWith: [], updatedAt: new Date().toISOString()
  };
  db.docs.push(doc);
  saveDb(db);
  res.status(201).json(doc);
});

app.get('/api/docs/:id', needUser, loadDoc, function (req, res) {
  res.json({
    id: req.doc.id, title: req.doc.title, content: req.doc.content,
    ownerId: req.doc.ownerId, owned: req.doc.ownerId === req.user.id,
    sharedWith: req.doc.sharedWith
  });
});

// rename and/or save content (owner or shared users can edit)
app.put('/api/docs/:id', needUser, loadDoc, function (req, res) {
  if (req.body.title !== undefined) {
    var title = String(req.body.title).trim();
    if (title === '') return res.status(400).json({ error: 'Title cannot be empty.' });
    if (title.length > 100) return res.status(400).json({ error: 'Title must be 100 characters or less.' });
    req.doc.title = title;
  }
  if (req.body.content !== undefined) req.doc.content = cleanHtml(req.body.content);
  req.doc.updatedAt = new Date().toISOString();
  saveDb(req.db);
  res.json({ ok: true, updatedAt: req.doc.updatedAt });
});

// only the owner can share
app.post('/api/docs/:id/share', needUser, loadDoc, function (req, res) {
  if (req.doc.ownerId !== req.user.id) return res.status(403).json({ error: 'Only the owner can share this document.' });
  var target = USERS.find(function (u) { return u.id === req.body.userId; });
  if (!target) return res.status(400).json({ error: 'That user does not exist.' });
  if (target.id === req.user.id) return res.status(400).json({ error: 'You already own this document.' });
  if (req.doc.sharedWith.indexOf(target.id) === -1) req.doc.sharedWith.push(target.id);
  saveDb(req.db);
  res.json({ sharedWith: req.doc.sharedWith });
});

// upload a .txt or .md file (browser sends the file text) and make a new document
app.post('/api/upload', needUser, function (req, res) {
  var filename = String(req.body.filename || '');
  var text = req.body.text;
  var ext = path.extname(filename).toLowerCase();
  if (ext !== '.txt' && ext !== '.md') return res.status(400).json({ error: 'Only .txt and .md files are supported.' });
  if (typeof text !== 'string' || text.trim() === '') return res.status(400).json({ error: 'The file is empty.' });
  if (text.length > 500000) return res.status(400).json({ error: 'File is too big (500 KB max).' });
  var db = loadDb();
  var doc = {
    id: newId(), title: path.basename(filename, ext), content: textToHtml(text, ext === '.md'),
    ownerId: req.user.id, sharedWith: [], updatedAt: new Date().toISOString()
  };
  db.docs.push(doc);
  saveDb(db);
  res.status(201).json(doc);
});

module.exports = app;

if (require.main === module) {
  var port = process.env.PORT || 3000;
  app.listen(port, function () { console.log('Running on http://localhost:' + port); });
}

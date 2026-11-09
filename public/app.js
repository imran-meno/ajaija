// Front end: plain JavaScript, no build step.
var currentUser = localStorage.getItem('user') || 'alice';
var users = [];
var currentDoc = null;
var saveTimer = null;

var $ = function (id) { return document.getElementById(id); };

// ---------- helper to talk to the server ----------
function api(method, url, body) {
  return fetch(url, {
    method: method,
    headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser },
    body: body ? JSON.stringify(body) : undefined
  }).then(function (res) {
    return res.json().then(function (data) {
      if (!res.ok) throw new Error(data.error || 'Something went wrong.');
      return data;
    });
  });
}

function showMessage(text, isError) {
  $('message').textContent = text;
  $('message').className = isError ? 'error' : '';
}

function nameOf(id) {
  var u = users.find(function (x) { return x.id === id; });
  return u ? u.name : id;
}

// ---------- document list ----------
function loadList() {
  api('GET', '/api/docs').then(function (docs) {
    $('myList').innerHTML = '';
    $('sharedList').innerHTML = '';
    docs.forEach(function (d) {
      var li = document.createElement('li');
      li.textContent = d.title;
      if (currentDoc && currentDoc.id === d.id) li.className = 'active';
      if (!d.owned) {
        var b = document.createElement('span');
        b.className = 'badge';
        b.textContent = 'from ' + nameOf(d.ownerId);
        li.appendChild(b);
      }
      li.onclick = function () { openDoc(d.id); };
      (d.owned ? $('myList') : $('sharedList')).appendChild(li);
    });
    if (!$('myList').children.length) $('myList').innerHTML = '<li>No documents yet</li>';
    if (!$('sharedList').children.length) $('sharedList').innerHTML = '<li>Nothing shared with you</li>';
  }).catch(function (e) { showMessage(e.message, true); });
}

// ---------- open / save ----------
function openDoc(id) {
  api('GET', '/api/docs/' + id).then(function (doc) {
    currentDoc = doc;
    $('emptyState').hidden = true;
    $('editorArea').hidden = false;
    $('titleInput').value = doc.title;
    $('editor').innerHTML = doc.content;
    $('saveStatus').textContent = '';
    // only the owner can share
    $('shareBox').hidden = !doc.owned;
    fillShareSelect();
    $('shareInfo').textContent = doc.sharedWith.length ? 'Shared with: ' + doc.sharedWith.map(nameOf).join(', ') : 'Not shared yet';
    showMessage('');
    loadList();
  }).catch(function (e) { showMessage(e.message, true); });
}

function saveDoc() {
  if (!currentDoc) return;
  $('saveStatus').textContent = 'Saving...';
  api('PUT', '/api/docs/' + currentDoc.id, {
    title: $('titleInput').value,
    content: $('editor').innerHTML
  }).then(function () {
    $('saveStatus').textContent = 'Saved';
    showMessage('');
    loadList();
  }).catch(function (e) {
    $('saveStatus').textContent = 'Not saved';
    showMessage(e.message, true);
  });
}

// autosave 1.5 seconds after the user stops typing
function queueSave() {
  $('saveStatus').textContent = 'Unsaved changes';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveDoc, 1500);
}

function fillShareSelect() {
  $('shareSelect').innerHTML = '';
  users.forEach(function (u) {
    if (u.id === currentUser) return;
    var o = document.createElement('option');
    o.value = u.id;
    o.textContent = u.name;
    $('shareSelect').appendChild(o);
  });
}

// ---------- events ----------
$('newBtn').onclick = function () {
  api('POST', '/api/docs', { title: 'Untitled document', content: '' })
    .then(function (doc) { openDoc(doc.id); })
    .catch(function (e) { showMessage(e.message, true); });
};

$('fileInput').onchange = function () {
  var file = this.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function () {
    api('POST', '/api/upload', { filename: file.name, text: reader.result })
      .then(function (doc) { showMessage('Imported ' + file.name); openDoc(doc.id); })
      .catch(function (e) { showMessage(e.message, true); });
  };
  reader.readAsText(file);
  this.value = '';
};

$('saveBtn').onclick = saveDoc;
$('titleInput').oninput = queueSave;
$('editor').oninput = queueSave;

document.querySelectorAll('.toolbar [data-cmd]').forEach(function (btn) {
  // mousedown + preventDefault keeps the text selection in the editor
  btn.onmousedown = function (e) { e.preventDefault(); };
  btn.onclick = function () {
    document.execCommand(btn.dataset.cmd, false, btn.dataset.val || null);
    queueSave();
  };
});

$('shareBtn').onclick = function () {
  api('POST', '/api/docs/' + currentDoc.id + '/share', { userId: $('shareSelect').value })
    .then(function (data) {
      currentDoc.sharedWith = data.sharedWith;
      $('shareInfo').textContent = 'Shared with: ' + data.sharedWith.map(nameOf).join(', ');
      showMessage('Document shared.');
    })
    .catch(function (e) { showMessage(e.message, true); });
};

$('userSelect').onchange = function () {
  currentUser = this.value;
  localStorage.setItem('user', currentUser);
  currentDoc = null;
  $('editorArea').hidden = true;
  $('emptyState').hidden = false;
  showMessage('');
  loadList();
};

// ---------- start ----------
fetch('/api/users').then(function (r) { return r.json(); }).then(function (list) {
  users = list;
  users.forEach(function (u) {
    var o = document.createElement('option');
    o.value = u.id;
    o.textContent = u.name;
    if (u.id === currentUser) o.selected = true;
    $('userSelect').appendChild(o);
  });
  loadList();
});

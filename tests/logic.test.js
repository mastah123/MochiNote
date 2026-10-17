const assert = require('assert');
const L = require('../js/logic.js');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };

t('tags normalize + dedupe', () => assert.deepStrictEqual(L.extractTags('Hi #Ideas and #ideas #Work-1 #123 url.com/#frag a#b'), ['ideas', 'work-1']));
t('htmlToText', () => assert.strictEqual(L.htmlToText('<p>Hello&nbsp;<b>w</b></p><ul><li>a</li><li>b</li></ul>'), 'Hello w\na\nb'));
t('bare first line + <div> do not glue (tag on line 2 is found)', () => {
  const txt = L.htmlToText('one two<div>#projectx </div><div><ul><li>x #Y</li></ul></div>');
  assert.strictEqual(txt, 'one two\n#projectx\nx #Y'); assert.deepStrictEqual(L.extractTags(txt), ['projectx', 'y']);
});
const folders = [{ id: 'f1', name: 'Projects', parentId: null }, { id: 'f2', name: 'Sub', parentId: 'f1' }, { id: 'f3', name: 'Personal', parentId: null }];
const mk = (id, o) => Object.assign({ id, title: id, text: '', tags: [], folderId: null, pinned: false, archived: false, trashed: false, created: 1, updated: 1 }, o);
const notes = [
  mk('a', { title: 'Banana', text: 'yellow fruit #food', tags: ['food'], folderId: 'f1', created: 1, updated: 50, pinned: true }),
  mk('b', { title: 'apple', text: 'red', tags: ['food', 'red'], folderId: 'f2', created: 3, updated: 20 }),
  mk('c', { title: 'Cherry', text: 'plan trip', tags: [], folderId: 'f3', created: 2, updated: 90 }),
  mk('d', { title: 'old', archived: true }), mk('e', { title: 'gone', trashed: true }), mk('g', { title: 'loose' })
];
const ids = l => l.map(x => x.id).join('');
t('search title/body/tag/folder', () => {
  const q = query => ids(L.filterNotes(notes, folders, { view: 'all', query }));
  assert.strictEqual(q('banana'), 'a'); assert.strictEqual(q('trip'), 'c'); assert.strictEqual(q('#red'), 'b'); assert.strictEqual(q('personal'), 'c'); assert.strictEqual(q('projects'), 'ab');
});
t('folder + tag combine, subfolders included', () => assert.strictEqual(ids(L.filterNotes(notes, folders, { view: 'all', folderId: 'f1', tag: 'Food' })), 'ab'));
t('no-folder filter', () => assert.strictEqual(ids(L.filterNotes(notes, folders, { view: 'all', folderId: L.NO_FOLDER })), 'g'));
t('views hide archived/trashed', () => { assert.strictEqual(ids(L.filterNotes(notes, folders, { view: 'all' })), 'abcg'); assert.strictEqual(ids(L.filterNotes(notes, folders, { view: 'archive' })), 'd'); assert.strictEqual(ids(L.filterNotes(notes, folders, { view: 'trash' })), 'e'); assert.strictEqual(ids(L.filterNotes(notes, folders, { view: 'pinned' })), 'a'); });
t('recent filter', () => assert.strictEqual(ids(L.filterNotes(notes, folders, { view: 'all', recentOnly: true, now: 100 })), 'abcg'.replace('g', '') + 'g'));
const sorted = (s, pf) => ids(L.sortNotes(L.filterNotes(notes, folders, { view: 'all' }), s, pf));
t('sorts (g created=1 ties with a; id breaks ties)', () => {
  assert.strictEqual(sorted('edited', false), 'cabg');
  assert.strictEqual(sorted('created-desc', false), 'bcag');
  assert.strictEqual(sorted('created-asc', false), 'agcb');
  assert.strictEqual(sorted('title-asc', false), 'bacg');
  assert.strictEqual(sorted('title-desc', false), 'gcab');
});
t('pinned first keeps chosen sort within groups', () => { assert.strictEqual(sorted('title-desc', true), 'agcb'); });
t('sort inside folder + tag filter', () => {
  const l = L.filterNotes(notes, folders, { view: 'all', folderId: 'f1', tag: 'food' });
  assert.strictEqual(ids(L.sortNotes(l, 'title-asc', false)), 'ba'); assert.strictEqual(ids(L.sortNotes(l, 'edited', false)), 'ab');
});
const good = () => ({ app: 'little-notes', version: 1, folders: [{ id: 'x', name: 'X' }], notes: [{ id: 'n1', title: 'T', html: '<p>hi #Tag</p>', folderId: 'x', color: 'pink', pinned: true }] });
t('import ok', () => { const r = L.validateImport(good()); assert.strictEqual(r.notes[0].tags[0], 'tag'); assert.strictEqual(r.notes[0].folderId, 'x'); assert.strictEqual(r.notes[0].pinned, true); });
t('import rejects junk', () => { [null, [], 'x', {}, { app: 'other', version: 1, notes: [] }, { app: 'little-notes', version: 99, notes: [] }, { app: 'little-notes', version: 1 }].forEach(d => assert.throws(() => L.validateImport(d))); });
t('import skips bad items, fixes dangling refs, dupes', () => {
  const d = good(); d.notes.push(null, 5, { id: 'n1', title: 'dup', html: '' }, { id: 'n3', title: 'o', html: '', folderId: 'missing', color: 'neon' }); d.folders.push({ id: 'y', name: '' }, { id: 'p', name: 'P', parentId: 'q' }, { id: 'q', name: 'Q', parentId: 'p' });
  const r = L.validateImport(d); assert.strictEqual(r.skippedNotes, 2); assert.strictEqual(r.skippedFolders, 1);
  assert.strictEqual(new Set(r.notes.map(x => x.id)).size, r.notes.length);
  const n3 = r.notes.find(x => x.id === 'n3'); assert.strictEqual(n3.folderId, null); assert.strictEqual(n3.color, 'default');
  assert.ok(r.folders.filter(f => f.id === 'p' || f.id === 'q').some(f => f.parentId === null));
});
console.log('\n' + n + ' tests passed');
t('flattenFolders lifts subfolders to top level and reports what changed', () => { const fs = [{ id: 'a', name: 'A', parentId: null }, { id: 'b', name: 'B', parentId: 'a' }, { id: 'c', name: 'C', parentId: 'b' }]; const ch = L.flattenFolders(fs); assert.deepStrictEqual(ch.map(f => f.id), ['b', 'c']); assert.ok(fs.every(f => f.parentId === null)); assert.strictEqual(L.flattenFolders(fs).length, 0); });

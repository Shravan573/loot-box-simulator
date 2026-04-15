// ============================================================
// BRANDING - update your LinkedIn URL here
// ============================================================
const LINKEDIN_URL = 'https://www.linkedin.com/in/shravan573'; // <-- replace with your URL
const AUTHOR_NAME  = 'Shravan';

// ============================================================
// EMOJI SETS
// ============================================================
const BUNDLE_EMOJIS = [
  '📦','🎁','🎲','🎯','🏆','💼','🗃️','🎰','🃏','🎮',
  '🌀','⭐','🪅','🎪','🔮','🧧','💝','🎊','🌟','🎭',
  '🎀','💫','🏅','🎗️','🎈','🪄','🎸','🧩','🔑','🌈',
];
const ITEM_EMOJIS = [
  '⚔️','🛡️','🏹','🔮','💎','🧪','📜','🗝️','🪙','💰',
  '🎖️','🦋','🌟','🔥','❄️','⚡','🌙','🌺','🎁','🎀',
  '🐉','🦅','🎭','🎸','🪄','🔑','💫','🍀','🌈','🐺',
  '✨','🍄','🦊','🐬','🌊','🪸','🫧','🧬','⚗️','🔭',
];

// ============================================================
// STATE & PERSISTENCE
// ============================================================
const state = {
  bundles: (JSON.parse(localStorage.getItem('lb_bundles') || '[]')).map(b => ({
    entries: [], items: [], ...b
  })),
  items: JSON.parse(localStorage.getItem('lb_items') || '[]'),
  history: [],
};

function persist()      { localStorage.setItem('lb_bundles', JSON.stringify(state.bundles)); }
function persistItems() { localStorage.setItem('lb_items',   JSON.stringify(state.items));   }

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ============================================================
// THEME
// ============================================================

function initTheme() {
  const saved = localStorage.getItem('lb_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('lb_theme', next);
}

// ============================================================
// EMOJI PICKER HELPER
// ============================================================

function populateEmojiPicker(pickerId, emojis, currentEmoji, onSelect) {
  const picker = document.getElementById(pickerId);
  picker.innerHTML = emojis.map(em =>
    `<button type="button" class="emoji-btn${em === currentEmoji ? ' selected' : ''}" data-em="${esc(em)}">${em}</button>`
  ).join('');
  picker.querySelectorAll('.emoji-btn').forEach(btn => {
    btn.onclick = e => {
      e.stopPropagation();
      picker.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      onSelect(btn.dataset.em);
      picker.classList.add('hidden');
    };
  });
}

// ============================================================
// ROLLING LOGIC
// ============================================================

function pickWeighted(items) {
  const total = items.reduce((s, x) => s + (Number(x.probability) || 0), 0);
  if (total <= 0) return null;
  let r = Math.random() * total;
  for (const item of items) {
    r -= Number(item.probability) || 0;
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

function rollBundle(bundle, depth) {
  depth = depth || 0;
  if (!bundle || depth > 8) return null;

  if (bundle.type === 'inclusive') {
    const items = bundle.items || [];
    const picked = pickWeighted(items);
    return {
      kind: 'inclusive',
      bundleName: bundle.name,
      item: picked ? picked.name : '(empty pool)',
      itemId: picked?.itemId || null,
    };
  }

  const drops = [];
  for (const entry of (bundle.entries || [])) {
    const prob = Number(entry.probability) || 0;
    if (Math.random() * 100 < prob) {
      if (entry.subBundleId) {
        const sub = state.bundles.find(b => b.id === entry.subBundleId);
        const subResult = sub ? rollBundle(sub, depth + 1) : null;
        drops.push({ name: entry.name || (sub ? sub.name : 'Unknown'), isNested: true, subResult });
      } else {
        drops.push({ name: entry.name || '(unnamed)', isNested: false, itemId: entry.itemId || null });
      }
    }
  }
  return { kind: 'exclusive', bundleName: bundle.name, drops };
}

// ============================================================
// BUNDLES GRID
// ============================================================

function renderGrid() {
  const grid = document.getElementById('bundles-grid');
  grid.innerHTML = '';

  state.bundles.forEach(b => {
    const count = b.type === 'inclusive'
      ? `${(b.items || []).length} item${(b.items || []).length !== 1 ? 's' : ''}`
      : `${(b.entries || []).length} entr${(b.entries || []).length !== 1 ? 'ies' : 'y'}`;

    const icon = b.emoji || (b.type === 'inclusive' ? '🎯' : '🎲');
    const card = document.createElement('div');
    card.className = 'bundle-card';
    card.innerHTML = `
      <span class="badge badge-${b.type}">${b.type}</span>
      <div class="card-icon">${esc(icon)}</div>
      <h3 class="card-name">${esc(b.name)}</h3>
      <p class="card-meta">${count}</p>
      <div class="card-actions">
        <button class="btn-edit" data-id="${b.id}">Edit</button>
        <button class="btn-del"  data-id="${b.id}">Delete</button>
      </div>
    `;
    card.querySelector('.btn-edit').onclick = () => openModal(b.id);
    card.querySelector('.btn-del').onclick  = () => deleteBundle(b.id);
    grid.appendChild(card);
  });

  const addCard = document.createElement('div');
  addCard.className = 'bundle-card add-card';
  addCard.innerHTML = '<div class="add-plus">+</div><p>Create New</p>';
  addCard.onclick = () => openModal(null);
  grid.appendChild(addCard);
}

function deleteBundle(id) {
  if (!confirm('Delete this bundle?')) return;
  state.bundles = state.bundles.filter(b => b.id !== id);
  persist();
  renderGrid();
  syncRollSelect();
}

// ============================================================
// ROLL TAB
// ============================================================

function syncRollSelect() {
  const sel = document.getElementById('roll-sel');
  const prev = sel.value;
  sel.innerHTML = '<option value="">Select a bundle…</option>';
  state.bundles.forEach(b => sel.appendChild(new Option(b.name, b.id)));
  if (state.bundles.find(b => b.id === prev)) sel.value = prev;
  document.getElementById('roll-btn').disabled = !sel.value;
}

function renderResult(result) {
  const el = document.getElementById('roll-result');
  el.classList.remove('hidden');
  el.innerHTML = buildResultHTML(result, false);
  el.querySelectorAll('.chip').forEach((c, i) => { c.style.animationDelay = `${i * 75}ms`; });
}

function renderResultParams(itemId) {
  if (!itemId) return '';
  const item = state.items.find(x => x.id === itemId);
  if (!item || !item.params || item.params.length === 0) return '';
  const tags = item.params.map(p =>
    `<span class="param-tag">
      <span class="param-key">${esc(p.key)}</span>
      <span class="param-val">${esc(p.value)}</span>
    </span>`
  ).join('');
  return `<div class="result-params">${tags}</div>`;
}

function buildResultHTML(result, isNested) {
  if (!result) return '<span class="chip chip-empty">Sub-bundle not found</span>';

  const title = isNested
    ? `<span class="nested-label">${esc(result.bundleName)}</span>`
    : `<p class="result-from">From <strong>${esc(result.bundleName)}</strong>:</p>`;

  const wrapper = isNested ? 'nested-result' : 'top-result';

  if (result.kind === 'inclusive') {
    return `
      <div class="${wrapper}">
        ${title}
        <div class="chips">
          <div class="result-item-wrap">
            <span class="chip">${esc(result.item)}</span>
            ${renderResultParams(result.itemId)}
          </div>
        </div>
      </div>`;
  }

  let chipsHTML;
  if (result.drops.length === 0) {
    chipsHTML = '<span class="chip chip-empty">Nothing dropped</span>';
  } else {
    chipsHTML = result.drops.map(drop => {
      if (drop.isNested && drop.subResult) {
        return `<div class="nested-chip">
          <span class="chip chip-nested">${esc(drop.name)}</span>
          ${buildResultHTML(drop.subResult, true)}
        </div>`;
      }
      return `<div class="result-item-wrap">
        <span class="chip">${esc(drop.name)}</span>
        ${renderResultParams(drop.itemId)}
      </div>`;
    }).join('');
  }

  return `
    <div class="${wrapper}">
      ${title}
      <div class="chips">${chipsHTML}</div>
    </div>`;
}

function addHistory(result) {
  const summary = summarizeResult(result);
  state.history.unshift({ time: new Date().toLocaleTimeString(), bundleName: result ? result.bundleName : '?', summary });
  if (state.history.length > 50) state.history.pop();
  renderHistory();
}

function summarizeResult(result) {
  if (!result) return '-';
  if (result.kind === 'inclusive') return result.item;
  if (!result.drops || result.drops.length === 0) return '(nothing)';
  return result.drops.map(d => {
    if (d.isNested && d.subResult) return `${d.name} -> [${summarizeResult(d.subResult)}]`;
    return d.name;
  }).join(', ');
}

function renderHistory() {
  const list = document.getElementById('history-list');
  if (state.history.length === 0) { list.innerHTML = '<p class="empty-msg">No rolls yet.</p>'; return; }
  list.innerHTML = state.history.map(h => `
    <div class="hist-row">
      <span class="hist-time">${h.time}</span>
      <span class="hist-name">${esc(h.bundleName)}</span>
      <span class="hist-summary">${esc(h.summary)}</span>
    </div>
  `).join('');
}

// ============================================================
// EXPORT / IMPORT
// ============================================================

function buildItemsSheet() {
  const paramKeys = [...new Set(state.items.flatMap(it => (it.params || []).map(p => p.key)))];
  const header = ['Name', 'Emoji', 'Value', ...paramKeys];
  const rows = [header];
  state.items.forEach(item => {
    const paramMap = {};
    (item.params || []).forEach(p => { paramMap[p.key] = p.value; });
    rows.push([item.name, item.emoji || '', item.value || '', ...paramKeys.map(k => paramMap[k] ?? '')]);
  });
  return rows;
}

function buildBundlesSheet() {
  const header = ['Bundle Name', 'Bundle Type', 'Bundle Emoji', 'Entry Name', 'Probability', 'Linked Item', 'Sub-bundle'];
  const rows = [header];
  state.bundles.forEach(b => {
    if (b.type === 'inclusive') {
      (b.items || []).forEach(item => {
        const linked = item.itemId ? state.items.find(x => x.id === item.itemId) : null;
        rows.push([b.name, b.type, b.emoji || '', item.name, item.probability, linked ? linked.name : '', '']);
      });
    } else {
      (b.entries || []).forEach(entry => {
        const sub = entry.subBundleId ? state.bundles.find(x => x.id === entry.subBundleId) : null;
        rows.push([b.name, b.type, b.emoji || '', entry.name, entry.probability, '', sub ? sub.name : '']);
      });
    }
    if ((b.type === 'inclusive' ? b.items : b.entries || []).length === 0) {
      rows.push([b.name, b.type, b.emoji || '', '', '', '', '']);
    }
  });
  return rows;
}

function buildHistorySheet() {
  const header = ['Time', 'Bundle', 'Result'];
  const rows = [header];
  state.history.forEach(h => rows.push([h.time, h.bundleName, h.summary]));
  return rows;
}

function exportToSheets() {
  if (typeof XLSX === 'undefined') { alert('Export library not loaded. Please check your internet connection and reload.'); return; }

  const wb = XLSX.utils.book_new();

  const ws1 = XLSX.utils.aoa_to_sheet(buildItemsSheet());
  XLSX.utils.book_append_sheet(wb, ws1, 'Items');

  const ws2 = XLSX.utils.aoa_to_sheet(buildBundlesSheet());
  XLSX.utils.book_append_sheet(wb, ws2, 'Bundles');

  const ws3 = XLSX.utils.aoa_to_sheet(buildHistorySheet());
  XLSX.utils.book_append_sheet(wb, ws3, 'Roll History');

  XLSX.writeFile(wb, 'lootbox-data.xlsx');
}

function handleImport(file) {
  if (!file) return;
  if (typeof XLSX === 'undefined') { alert('Import library not loaded. Please check your internet connection and reload.'); return; }

  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array' });

      // Import Items
      if (wb.SheetNames.includes('Items')) {
        const data = XLSX.utils.sheet_to_json(wb.Sheets['Items']);
        const importedItems = data.map(row => {
          const reserved = ['Name', 'Emoji', 'Value'];
          const paramKeys = Object.keys(row).filter(k => !reserved.includes(k));
          const params = paramKeys
            .filter(k => row[k] !== undefined && row[k] !== '')
            .map(k => ({ key: k, value: String(row[k]) }));
          return {
            id: uid(),
            name: String(row['Name'] || '').trim(),
            emoji: String(row['Emoji'] || ''),
            value: Number(row['Value']) || 0,
            params,
          };
        }).filter(it => it.name);

        if (importedItems.length > 0) {
          if (confirm(`Import ${importedItems.length} item(s)? This will replace existing items.`)) {
            state.items = importedItems;
            persistItems();
          }
        }
      }

      // Import Bundles
      if (wb.SheetNames.includes('Bundles')) {
        const data = XLSX.utils.sheet_to_json(wb.Sheets['Bundles']);
        const bundleMap = {};
        data.forEach(row => {
          const bName = String(row['Bundle Name'] || '').trim();
          if (!bName) return;
          if (!bundleMap[bName]) {
            bundleMap[bName] = {
              id: uid(),
              name: bName,
              type: String(row['Bundle Type'] || 'inclusive').toLowerCase(),
              emoji: String(row['Bundle Emoji'] || ''),
              items: [],
              entries: [],
            };
          }
          const b = bundleMap[bName];
          const entryName = String(row['Entry Name'] || '').trim();
          if (!entryName) return;
          const prob = Number(row['Probability']) || 0;

          if (b.type === 'inclusive') {
            const linkedName = String(row['Linked Item'] || '').trim();
            const linked = linkedName ? state.items.find(x => x.name === linkedName) : null;
            b.items.push({ id: uid(), name: entryName, probability: prob, itemId: linked ? linked.id : null });
          } else {
            b.entries.push({ id: uid(), name: entryName, probability: prob, subBundleId: null });
          }
        });

        const importedBundles = Object.values(bundleMap);
        if (importedBundles.length > 0) {
          if (confirm(`Import ${importedBundles.length} bundle(s)? This will replace existing bundles.`)) {
            state.bundles = importedBundles;
            persist();
          }
        }
      }

      renderGrid();
      renderItemsGrid();
      syncRollSelect();
      alert('Import complete.');
    } catch(err) {
      alert('Import failed: ' + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

// ============================================================
// MODAL (BUNDLES)
// ============================================================

let draft = null;

function openModal(id) {
  if (id) {
    const b = state.bundles.find(x => x.id === id);
    draft = JSON.parse(JSON.stringify(b));
  } else {
    draft = { id: uid(), name: '', type: 'inclusive', items: [], entries: [], emoji: '' };
  }
  document.getElementById('modal-title').textContent = id ? 'Edit Bundle' : 'Create Bundle';
  document.getElementById('bundle-emoji-picker').classList.add('hidden');
  renderModal();
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('bundle-emoji-picker').classList.add('hidden');
  draft = null;
}

function renderModal() {
  document.getElementById('inp-name').value = draft.name;

  const defaultEmoji = draft.type === 'inclusive' ? '🎯' : '🎲';
  const emojiBtn = document.getElementById('bundle-emoji-btn');
  emojiBtn.textContent = draft.emoji || defaultEmoji;
  populateEmojiPicker('bundle-emoji-picker', BUNDLE_EMOJIS, draft.emoji, em => {
    draft.emoji = em;
    document.getElementById('bundle-emoji-btn').textContent = em;
  });

  document.querySelectorAll('.type-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.type === draft.type);
  });

  const isInclusive = draft.type === 'inclusive';
  document.getElementById('sect-inclusive').classList.toggle('hidden', !isInclusive);
  document.getElementById('sect-exclusive').classList.toggle('hidden',  isInclusive);

  if (isInclusive) renderIncItems();
  else             renderExcEntries();
}

function itemPickerOpts(currentItemId) {
  return state.items.map(it =>
    `<option value="${it.id}" ${currentItemId === it.id ? 'selected' : ''}>${esc(it.name)}</option>`
  ).join('');
}

function renderIncItems() {
  const list = document.getElementById('inc-list');
  list.innerHTML = '';
  (draft.items || []).forEach((item, i) => list.appendChild(makeIncRow(item, i)));
  updateIncTotal();
}

function makeIncRow(item, i) {
  const row = document.createElement('div');
  row.className = 'item-row bnd-inc-row';
  row.innerHTML = `
    <input class="inp inp-name" type="text" placeholder="Item name" value="${esc(item.name)}">
    <select class="inp item-picker" title="Link to a defined item (optional)">
      <option value="">Link item</option>
      ${itemPickerOpts(item.itemId)}
    </select>
    <div class="prob-group">
      <input class="inp inp-prob" type="number" min="0" max="100" step="0.1"
             value="${item.probability !== 0 ? item.probability : ''}">
      <span class="pct">%</span>
    </div>
    <button class="rm-btn" title="Remove">×</button>
  `;
  row.querySelector('.inp-name').oninput = e => {
    draft.items[i].name = e.target.value;
    draft.items[i].itemId = null;
    row.querySelector('.item-picker').value = '';
  };
  row.querySelector('.item-picker').onchange = e => {
    const linkedId = e.target.value || null;
    draft.items[i].itemId = linkedId;
    if (linkedId) {
      const linked = state.items.find(x => x.id === linkedId);
      if (linked) { draft.items[i].name = linked.name; row.querySelector('.inp-name').value = linked.name; }
    }
  };
  row.querySelector('.inp-prob').oninput = e => {
    draft.items[i].probability = parseFloat(e.target.value) || 0;
    updateIncTotal();
  };
  row.querySelector('.rm-btn').onclick = () => { draft.items.splice(i, 1); renderIncItems(); };
  return row;
}

function updateIncTotal() {
  const total = (draft.items || []).reduce((s, x) => s + (Number(x.probability) || 0), 0);
  const el = document.getElementById('inc-total');
  el.textContent = `Total: ${total.toFixed(1)}%`;
  el.className = 'prob-total' + (Math.abs(total - 100) < 0.5 ? ' ok' : total > 100 ? ' over' : '');
}

function renderExcEntries() {
  const list = document.getElementById('exc-list');
  list.innerHTML = '';
  (draft.entries || []).forEach((entry, i) => list.appendChild(makeExcRow(entry, i)));
}

function makeExcRow(entry, i) {
  const others = state.bundles.filter(b => b.id !== draft.id);
  const bundleOpts = others.map(b =>
    `<option value="${b.id}" ${entry.subBundleId === b.id ? 'selected' : ''}>${esc(b.name)}</option>`
  ).join('');

  const row = document.createElement('div');
  row.className = 'item-row exc-row';
  row.innerHTML = `
    <input class="inp inp-name" type="text" placeholder="Entry name" value="${esc(entry.name)}">
    <div class="prob-group">
      <input class="inp inp-prob" type="number" min="0" max="100" step="0.1"
             value="${entry.probability !== 0 ? entry.probability : ''}">
      <span class="pct">%</span>
    </div>
    <select class="sub-sel" title="Link to a sub-bundle (optional)">
      <option value="">Direct item</option>
      ${bundleOpts}
    </select>
    <button class="rm-btn" title="Remove">×</button>
  `;
  row.querySelector('.inp-name').oninput = e => { draft.entries[i].name = e.target.value; };
  row.querySelector('.inp-prob').oninput = e => { draft.entries[i].probability = parseFloat(e.target.value) || 0; };
  row.querySelector('.sub-sel').onchange = e => { draft.entries[i].subBundleId = e.target.value || null; };
  row.querySelector('.rm-btn').onclick   = () => { draft.entries.splice(i, 1); renderExcEntries(); };
  return row;
}

// ============================================================
// AUTO WEIGHT (INVERSE VALUE)
// ============================================================

function autoAssignProbabilities() {
  const items = draft.items || [];
  if (items.length === 0) return;

  const entries = items.map((it, i) => {
    if (it.itemId) {
      const linked = state.items.find(x => x.id === it.itemId);
      if (linked && Number(linked.value) > 0) return { i, val: Number(linked.value) };
    }
    return null;
  }).filter(Boolean);

  if (entries.length === 0) {
    alert('Link items with a Value greater than 0 to use Auto Weights.');
    return;
  }

  const invWeights = entries.map(e => 1 / e.val);
  const totalInv   = invWeights.reduce((s, w) => s + w, 0);

  items.forEach(it => { it.probability = 0; });
  entries.forEach((e, j) => {
    items[e.i].probability = parseFloat(((invWeights[j] / totalInv) * 100).toFixed(1));
  });

  const sumNow = items.reduce((s, it) => s + it.probability, 0);
  const diff   = parseFloat((100 - sumNow).toFixed(1));
  if (diff !== 0 && entries.length > 0) {
    items[entries[0].i].probability = parseFloat((items[entries[0].i].probability + diff).toFixed(1));
  }

  renderIncItems();
}

function saveBundle() {
  draft.name = (document.getElementById('inp-name').value || '').trim();
  if (!draft.name) { alert('Please enter a bundle name.'); return; }

  const idx = state.bundles.findIndex(b => b.id === draft.id);
  if (idx >= 0) state.bundles[idx] = draft;
  else state.bundles.push(draft);

  persist();
  closeModal();
  renderGrid();
  syncRollSelect();
}

// ============================================================
// ITEMS GRID
// ============================================================

function renderItemsGrid() {
  const grid = document.getElementById('items-grid');
  grid.innerHTML = '';

  state.items.forEach(item => {
    const initial  = (item.name || '?')[0].toUpperCase();
    const hasValue = item.value && Number(item.value) > 0;
    const preview  = (item.params || []).slice(0, hasValue ? 2 : 3);
    const extra    = (item.params || []).length - preview.length;

    const valueTag = hasValue
      ? `<span class="param-tag value-tag"><span class="param-key">value</span><span class="param-val">${esc(String(item.value))}</span></span>`
      : '';

    const tagsHTML = valueTag + preview.map(p =>
      `<span class="param-tag"><span class="param-key">${esc(p.key)}</span><span class="param-val">${esc(p.value)}</span></span>`
    ).join('') + (extra > 0 ? `<span class="param-more">+${extra}</span>` : '');

    const iconHTML = item.emoji
      ? `<div class="card-icon">${item.emoji}</div>`
      : `<div class="card-initial">${esc(initial)}</div>`;

    const card = document.createElement('div');
    card.className = 'bundle-card item-card';
    card.innerHTML = `
      ${iconHTML}
      <h3 class="card-name">${esc(item.name)}</h3>
      <div class="params-preview">${tagsHTML || '<span class="card-meta">No parameters</span>'}</div>
      <div class="card-actions">
        <button class="btn-edit" data-id="${item.id}">Edit</button>
        <button class="btn-del"  data-id="${item.id}">Delete</button>
      </div>
    `;
    card.querySelector('.btn-edit').onclick = () => openItemModal(item.id);
    card.querySelector('.btn-del').onclick  = () => deleteItem(item.id);
    grid.appendChild(card);
  });

  const addCard = document.createElement('div');
  addCard.className = 'bundle-card add-card';
  addCard.innerHTML = '<div class="add-plus">+</div><p>Create New</p>';
  addCard.onclick = () => openItemModal(null);
  grid.appendChild(addCard);
}

function deleteItem(id) {
  if (!confirm('Delete this item?')) return;
  state.items = state.items.filter(i => i.id !== id);
  persistItems();
  renderItemsGrid();
}

// ============================================================
// ITEM MODAL
// ============================================================

let itemDraft = null;

function openItemModal(id) {
  if (id) {
    const found = state.items.find(x => x.id === id);
    itemDraft = JSON.parse(JSON.stringify(found));
  } else {
    itemDraft = { id: uid(), name: '', value: 0, params: [], emoji: '' };
  }
  document.getElementById('item-modal-title').textContent = id ? 'Edit Item' : 'Create Item';
  document.getElementById('item-inp-name').value  = itemDraft.name;
  document.getElementById('item-inp-value').value = itemDraft.value || '';

  const emojiBtn = document.getElementById('item-emoji-btn');
  emojiBtn.textContent = itemDraft.emoji || '✨';
  document.getElementById('item-emoji-picker').classList.add('hidden');
  populateEmojiPicker('item-emoji-picker', ITEM_EMOJIS, itemDraft.emoji, em => {
    itemDraft.emoji = em;
    document.getElementById('item-emoji-btn').textContent = em;
  });

  renderParamsList();
  document.getElementById('item-overlay').classList.remove('hidden');
}

function closeItemModal() {
  document.getElementById('item-overlay').classList.add('hidden');
  document.getElementById('item-emoji-picker').classList.add('hidden');
  itemDraft = null;
}

function renderParamsList() {
  const list = document.getElementById('params-list');
  list.innerHTML = '';
  (itemDraft.params || []).forEach((param, i) => {
    const row = document.createElement('div');
    row.className = 'item-row param-row';
    row.innerHTML = `
      <input class="inp" type="text" placeholder="e.g. strength" value="${esc(param.key)}">
      <input class="inp" type="text" placeholder="e.g. 50 or Epic" value="${esc(param.value)}">
      <button class="rm-btn" title="Remove">×</button>
    `;
    const [keyInp, valInp] = row.querySelectorAll('.inp');
    keyInp.oninput = e => { itemDraft.params[i].key   = e.target.value; };
    valInp.oninput = e => { itemDraft.params[i].value = e.target.value; };
    row.querySelector('.rm-btn').onclick = () => { itemDraft.params.splice(i, 1); renderParamsList(); };
    list.appendChild(row);
  });
}

function saveItem() {
  itemDraft.name  = (document.getElementById('item-inp-name').value  || '').trim();
  if (!itemDraft.name) { alert('Please enter an item name.'); return; }
  itemDraft.value = parseFloat(document.getElementById('item-inp-value').value) || 0;

  const idx = state.items.findIndex(i => i.id === itemDraft.id);
  if (idx >= 0) state.items[idx] = itemDraft;
  else state.items.push(itemDraft);

  persistItems();
  closeItemModal();
  renderItemsGrid();
}

// ============================================================
// HELP - COPY BUTTONS
// ============================================================

function initCopyButtons() {
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.onclick = () => {
      const target = document.getElementById(btn.dataset.target);
      if (!target) return;
      navigator.clipboard.writeText(target.textContent).then(() => {
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 2000);
      }).catch(() => {
        // Fallback for browsers without clipboard API
        const ta = document.createElement('textarea');
        ta.value = target.textContent;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 2000);
      });
    };
  });
}

// ============================================================
// INIT
// ============================================================

document.addEventListener('DOMContentLoaded', () => {

  // Theme
  initTheme();
  document.getElementById('theme-toggle').onclick = toggleTheme;

  // Branding
  document.getElementById('linkedin-link').href = LINKEDIN_URL;

  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    };
  });

  // Export / Import
  document.getElementById('export-btn').onclick = exportToSheets;
  document.getElementById('import-btn').onclick  = () => document.getElementById('import-file').click();
  document.getElementById('import-file').onchange = e => {
    handleImport(e.target.files[0]);
    e.target.value = ''; // reset so same file can be re-imported
  };

  // Help copy buttons
  initCopyButtons();

  // Close emoji pickers when clicking anywhere outside
  document.addEventListener('click', () => {
    document.getElementById('bundle-emoji-picker').classList.add('hidden');
    document.getElementById('item-emoji-picker').classList.add('hidden');
  });

  document.getElementById('bundle-emoji-btn').onclick = e => {
    e.stopPropagation();
    document.getElementById('bundle-emoji-picker').classList.toggle('hidden');
    document.getElementById('item-emoji-picker').classList.add('hidden');
  };

  document.getElementById('item-emoji-btn').onclick = e => {
    e.stopPropagation();
    document.getElementById('item-emoji-picker').classList.toggle('hidden');
    document.getElementById('bundle-emoji-picker').classList.add('hidden');
  };

  document.getElementById('bundle-emoji-picker').onclick = e => e.stopPropagation();
  document.getElementById('item-emoji-picker').onclick   = e => e.stopPropagation();

  // Modal open/close
  document.getElementById('modal-close').onclick   = closeModal;
  document.getElementById('cancel-btn').onclick    = closeModal;
  document.getElementById('modal-overlay').onclick = e => { if (e.target.id === 'modal-overlay') closeModal(); };
  document.getElementById('save-btn').onclick      = saveBundle;

  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.onclick = () => { if (!draft) return; draft.type = btn.dataset.type; renderModal(); };
  });

  document.getElementById('inp-name').oninput = e => { if (draft) draft.name = e.target.value; };

  document.getElementById('add-inc-item').onclick = () => {
    draft.items.push({ id: uid(), name: '', probability: 0 });
    renderIncItems();
  };
  document.getElementById('add-exc-entry').onclick = () => {
    draft.entries.push({ id: uid(), name: '', probability: 0, subBundleId: null });
    renderExcEntries();
  };

  document.getElementById('auto-prob-btn').onclick = autoAssignProbabilities;

  // Roll
  document.getElementById('roll-sel').onchange = e => {
    document.getElementById('roll-btn').disabled = !e.target.value;
    document.getElementById('roll-result').classList.add('hidden');
  };
  document.getElementById('roll-btn').onclick = () => {
    const id = document.getElementById('roll-sel').value;
    const bundle = state.bundles.find(b => b.id === id);
    if (!bundle) return;

    const btn  = document.getElementById('roll-btn');
    const anim = document.getElementById('roll-anim');
    btn.disabled = true;
    document.getElementById('roll-result').classList.add('hidden');
    anim.classList.remove('hidden');

    setTimeout(() => {
      anim.classList.add('hidden');
      const result = rollBundle(bundle, 0);
      renderResult(result);
      addHistory(result);
      btn.disabled = false;
    }, 500);
  };

  // Item modal
  document.getElementById('item-modal-close').onclick = closeItemModal;
  document.getElementById('item-cancel-btn').onclick  = closeItemModal;
  document.getElementById('item-overlay').onclick = e => { if (e.target.id === 'item-overlay') closeItemModal(); };
  document.getElementById('item-inp-name').oninput  = e => { if (itemDraft) itemDraft.name  = e.target.value; };
  document.getElementById('item-inp-value').oninput = e => { if (itemDraft) itemDraft.value = parseFloat(e.target.value) || 0; };
  document.getElementById('item-save-btn').onclick  = saveItem;
  document.getElementById('add-param').onclick = () => {
    itemDraft.params.push({ key: '', value: '' });
    renderParamsList();
  };

  // Initial render
  renderGrid();
  renderItemsGrid();
  syncRollSelect();
  renderHistory();
});

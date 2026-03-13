
const state = {
  artifacts: [],
  artifactsMap: {},
  inventory: {},
  beltContainers: 5,
  slots: [],
  pickerSlotIndex: null,
  variants: null
};

const STORAGE_KEY = 'stalker-build-helper-v5';

const NAME_ALIASES = {
  'Шнурвал': 'Измененный штурвал',
  'Травий': 'Гравий',
  'Золотая Рыбка': 'Золотая рыбка'
};

function canonicalName(name) {
  return NAME_ALIASES[name] || name;
}

const totalsMeta = [
  ['health', 'Здоровье'],
  ['blood', 'Кровь'],
  ['shock', 'Шок'],
  ['water', 'Вода'],
  ['food', 'Еда'],
  ['radOut', 'Вывод радиации'],
  ['radIn', 'Накопление радиации'],
  ['radBalance', 'Баланс радиации'],
  ['bleedChance', 'Шанс пореза'],
  ['bleedHeal', 'Лечение пореза']
];

const beltSelect = document.getElementById('beltSelect');
const inventoryList = document.getElementById('inventoryList');
const containersRoot = document.getElementById('containersRoot');
const totalsGrid = document.getElementById('totalsGrid');
const needsList = document.getElementById('needsList');
const ownedSuggestions = document.getElementById('ownedSuggestions');
const missingSuggestions = document.getElementById('missingSuggestions');
const inventorySearch = document.getElementById('inventorySearch');
const pickerModal = document.getElementById('pickerModal');
const pickerTitle = document.getElementById('pickerTitle');
const pickerList = document.getElementById('pickerList');
const pickerSearch = document.getElementById('pickerSearch');
const pickerOwnedOnly = document.getElementById('pickerOwnedOnly');
const slotCountLabel = document.getElementById('slotCountLabel');
const filledCountLabel = document.getElementById('filledCountLabel');
const ownedUsageLabel = document.getElementById('ownedUsageLabel');
const variantsRoot = document.getElementById('variantsRoot');

function normalizeArt(a) {
  return {
    ...a,
    name: canonicalName(a.name),
    health: Number(a.health || 0),
    blood: Number(a.blood || 0),
    shock: Number(a.shock || 0),
    water: Number(a.water || 0),
    food: Number(a.food || 0),
    radOut: Number(a.radOut || 0),
    radIn: Number(a.radIn || 0),
    radBalance: Number(a.radBalance || 0),
    bleedChance: Number(a.bleedChance || 0),
    bleedHeal: Number(a.bleedHeal || 0),
    isFish: Boolean(a.isFish || canonicalName(a.name).toLowerCase() === 'золотая рыбка'),
    image: a.image || 'assets/artifacts/placeholder.png'
  };
}

function defaultSlots(count) {
  return Array.from({ length: count * 3 }, () => null);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);

    if (saved.inventory && typeof saved.inventory === 'object') {
      const nextInventory = {};
      Object.entries(saved.inventory).forEach(([name, qty]) => {
        const fixed = canonicalName(name);
        nextInventory[fixed] = (nextInventory[fixed] || 0) + Number(qty || 0);
      });
      state.inventory = nextInventory;
    }

    if (saved.beltContainers === 4 || saved.beltContainers === 5) state.beltContainers = saved.beltContainers;

    if (Array.isArray(saved.slots)) {
      state.slots = saved.slots.map(name => name ? canonicalName(name) : null);
    }
  } catch {}
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    inventory: state.inventory,
    beltContainers: state.beltContainers,
    slots: state.slots
  }));
}

function ensureSlotsLength() {
  const wanted = state.beltContainers * 3;
  if (!Array.isArray(state.slots) || state.slots.length === 0) {
    state.slots = defaultSlots(state.beltContainers);
  } else if (state.slots.length > wanted) {
    state.slots = state.slots.slice(0, wanted);
  } else if (state.slots.length < wanted) {
    state.slots = state.slots.concat(Array.from({ length: wanted - state.slots.length }, () => null));
  }
}

function countSelected(slots = state.slots) {
  const counts = {};
  slots.forEach(name => {
    if (!name) return;
    counts[name] = (counts[name] || 0) + 1;
  });
  return counts;
}

function usedCountFor(name, slots = state.slots) {
  return countSelected(slots)[name] || 0;
}

function remainingInventory(name) {
  const owned = Number(state.inventory[name] || 0);
  const used = usedCountFor(name);
  return Math.max(0, owned - used);
}

function remainingInventoryExcludingSlot(name, slotIndex) {
  const owned = Number(state.inventory[name] || 0);
  let used = 0;
  state.slots.forEach((slotName, idx) => {
    if (idx === slotIndex) return;
    if (slotName === name) used += 1;
  });
  return Math.max(0, owned - used);
}

function getTotals(slots = state.slots) {
  const totals = {
    health: 0, blood: 0, shock: 0, water: 0, food: 0,
    radOut: 0, radIn: 0, radBalance: 0, bleedChance: 0, bleedHeal: 0
  };
  slots.forEach(name => {
    if (!name) return;
    const art = state.artifactsMap[name];
    if (!art) return;
    totals.health += art.health;
    totals.blood += art.blood;
    totals.shock += art.shock;
    totals.water += art.water;
    totals.food += art.food;
    totals.radOut += art.radOut;
    totals.radIn += art.radIn;
    totals.radBalance += art.radBalance;
    totals.bleedChance += art.bleedChance;
    totals.bleedHeal += art.bleedHeal;
  });
  return totals;
}

function cloneTotals(t) {
  return { ...t };
}

function addArtToTotals(totals, art) {
  const t = totals;
  t.health += art.health;
  t.blood += art.blood;
  t.shock += art.shock;
  t.water += art.water;
  t.food += art.food;
  t.radOut += art.radOut;
  t.radIn += art.radIn;
  t.radBalance += art.radBalance;
  t.bleedChance += art.bleedChance;
  t.bleedHeal += art.bleedHeal;
  return t;
}

function subArtFromTotals(totals, art) {
  const t = totals;
  t.health -= art.health;
  t.blood -= art.blood;
  t.shock -= art.shock;
  t.water -= art.water;
  t.food -= art.food;
  t.radOut -= art.radOut;
  t.radIn -= art.radIn;
  t.radBalance -= art.radBalance;
  t.bleedChance -= art.bleedChance;
  t.bleedHeal -= art.bleedHeal;
  return t;
}

function isSafeTotals(totals) {
  return (
    totals.health >= 0 &&
    totals.blood >= 0 &&
    totals.shock >= 0 &&
    totals.radBalance >= 0
  );
}

function hungryFriendly(totalHealth) {
  return totalHealth > 0;
}

function getNeeds(totals) {
  const needs = [];
  if (totals.health < 0) needs.push({ key: 'health', name: 'Здоровье', amount: Math.abs(totals.health) });
  if (totals.blood < 0) needs.push({ key: 'blood', name: 'Кровь', amount: Math.abs(totals.blood) });
  if (totals.shock < 0) needs.push({ key: 'shock', name: 'Шок', amount: Math.abs(totals.shock) });
  if (totals.radBalance < 0) needs.push({ key: 'radBalance', name: 'Баланс радиации', amount: Math.abs(totals.radBalance) });
  if (totals.bleedChance > 0) needs.push({ key: 'antiBleed', name: 'Шанс пореза', amount: totals.bleedChance });
  if (totals.bleedHeal < 0) needs.push({ key: 'bleedHeal', name: 'Лечение пореза', amount: Math.abs(totals.bleedHeal) });

  const hungerAllowed = hungryFriendly(totals.health);
  if (!hungerAllowed && totals.water < 0) needs.push({ key: 'water', name: 'Вода', amount: Math.abs(totals.water) });
  if (!hungerAllowed && totals.food < 0) needs.push({ key: 'food', name: 'Еда', amount: Math.abs(totals.food) });

  return needs;
}

function contributionForNeed(art, needKey) {
  switch (needKey) {
    case 'health': return Math.max(0, art.health);
    case 'blood': return Math.max(0, art.blood);
    case 'shock': return Math.max(0, art.shock);
    case 'radBalance': return Math.max(0, art.radBalance);
    case 'antiBleed': return Math.max(0, -art.bleedChance);
    case 'bleedHeal': return Math.max(0, art.bleedHeal);
    case 'water': return Math.max(0, art.water);
    case 'food': return Math.max(0, art.food);
    default: return 0;
  }
}

function fishPenaltyFactor(art) {
  return art.isFish ? 0.35 : 1;
}

function getSuggestionsForNeed(need, ownedOnly) {
  const selectedCounts = countSelected();
  const rows = [];
  state.artifacts.forEach(art => {
    const contrib = contributionForNeed(art, need.key);
    if (contrib <= 0) return;
    const remaining = ownedOnly
      ? Math.max(0, Number(state.inventory[art.name] || 0) - (selectedCounts[art.name] || 0))
      : Number(state.inventory[art.name] || 0);
    if (ownedOnly && remaining <= 0) return;

    const potential = ownedOnly ? contrib * remaining : contrib;
    rows.push({
      art,
      remaining,
      contrib,
      potential,
      score: (ownedOnly ? potential : contrib) * fishPenaltyFactor(art)
    });
  });

  rows.sort((a, b) => b.score - a.score || b.contrib - a.contrib || a.art.name.localeCompare(b.art.name, 'ru'));
  return rows.slice(0, 5);
}

function estimateMissing(need) {
  const suggestions = getSuggestionsForNeed(need, false);
  const best = suggestions[0];
  if (!best) return null;
  const countNeeded = Math.ceil(need.amount / Math.max(best.contrib, 1));
  return { art: best.art, countNeeded };
}

function renderTotals() {
  const totals = getTotals();
  totalsGrid.innerHTML = '';
  totalsMeta.forEach(([key, label]) => {
    const val = totals[key];
    const rowKey = document.createElement('div');
    rowKey.className = 'total-key';
    rowKey.textContent = label;

    const rowVal = document.createElement('div');
    rowVal.className = 'total-val';
    let positive = null;
    if (key === 'bleedChance') positive = val <= 0;
    else positive = val >= 0;
    rowVal.classList.add(positive ? 'pos' : 'neg');
    rowVal.textContent = `${val > 0 ? '+' : ''}${val}`;

    totalsGrid.appendChild(rowKey);
    totalsGrid.appendChild(rowVal);
  });

  const needs = getNeeds(totals);
  renderNeeds(needs);
}

function renderNeeds(needs) {
  needsList.innerHTML = '';
  ownedSuggestions.innerHTML = '';
  missingSuggestions.innerHTML = '';

  if (!needs.length) {
    const ok1 = document.createElement('div');
    ok1.className = 'empty-state';
    ok1.textContent = 'Критичных минусов нет. Сборка безопасна по здоровью / крови / шоку / радиации.';
    needsList.appendChild(ok1);

    const ok2 = document.createElement('div');
    ok2.className = 'empty-state';
    ok2.textContent = 'Сейчас ничего дополнительно закрывать не нужно.';
    ownedSuggestions.appendChild(ok2);

    const ok3 = document.createElement('div');
    ok3.className = 'empty-state';
    ok3.textContent = 'Для безопасной сборки сейчас ничего искать не нужно.';
    missingSuggestions.appendChild(ok3);
    return;
  }

  needs.forEach(need => {
    const needEl = document.createElement('div');
    needEl.className = 'need-item';
    needEl.innerHTML = `
      <div class="need-head">
        <div class="need-name">${need.name}</div>
        <div class="badge no">Нужно закрыть ${need.amount}</div>
      </div>
    `;
    needsList.appendChild(needEl);

    const owned = getSuggestionsForNeed(need, true);
    const totalPotential = owned.reduce((sum, x) => sum + x.potential, 0);

    const ownWrap = document.createElement('div');
    ownWrap.className = 'suggest-item';
    ownWrap.innerHTML = `
      <div class="suggest-head">
        <div class="suggest-name">${need.name}</div>
        <div class="badge ${totalPotential >= need.amount ? 'ok' : 'no'}">${totalPotential >= need.amount ? 'Закрывается' : 'Не хватает'}</div>
      </div>
    `;
    if (owned.length) {
      owned.forEach(x => {
        const line = document.createElement('div');
        line.className = 'helper-line';
        line.textContent = `${x.art.name} — +${x.contrib} за слот, доступно ${x.remaining}, максимум закроет ${x.potential}`;
        ownWrap.appendChild(line);
      });
    } else {
      const line = document.createElement('div');
      line.className = 'helper-line';
      line.textContent = 'Из твоего инвентаря сейчас нечем закрыть этот минус.';
      ownWrap.appendChild(line);
    }
    ownedSuggestions.appendChild(ownWrap);

    const missing = estimateMissing(need);
    const missWrap = document.createElement('div');
    missWrap.className = 'suggest-item';
    missWrap.innerHTML = `<div class="suggest-head"><div class="suggest-name">${need.name}</div></div>`;
    const line = document.createElement('div');
    line.className = 'helper-line';
    if (missing) {
      line.textContent = `Если искать отдельно: ${missing.art.name} ×${missing.countNeeded}. ${missing.art.isFish ? 'Рыбка имеет низкий приоритет и берётся только когда нормальной замены мало.' : ''}`;
    } else {
      line.textContent = 'Нет подходящих артов в базе.';
    }
    missWrap.appendChild(line);
    missingSuggestions.appendChild(missWrap);
  });
}

function artStatsChips(art) {
  const chips = [];
  const add = (label, value) => {
    if (!value) return;
    chips.push(`<span class="stat-chip ${value > 0 ? 'pos' : 'neg'}">${label} ${value > 0 ? '+' : ''}${value}</span>`);
  };
  add('ХП', art.health);
  add('Кровь', art.blood);
  add('Шок', art.shock);
  add('Вода', art.water);
  add('Еда', art.food);
  add('Рад', art.radBalance);
  add('Порез', art.bleedChance);
  add('Леч.пореза', art.bleedHeal);
  return chips.join('');
}

function renderInventory() {
  const q = inventorySearch.value.trim().toLowerCase();
  inventoryList.innerHTML = '';
  state.artifacts
    .filter(art => !q || art.name.toLowerCase().includes(q))
    .forEach(art => {
      const item = document.createElement('div');
      item.className = 'inventory-item';

      const info = document.createElement('div');
      info.className = 'inventory-main';

      const thumb = document.createElement('div');
      thumb.className = 'inventory-thumb';
      setThumb(thumb, art, '');

      const textWrap = document.createElement('div');
      const name = document.createElement('div');
      name.className = 'inventory-name';
      name.textContent = art.name;
      const meta = document.createElement('div');
      meta.className = 'inventory-meta';
      meta.innerHTML = artStatsChips(art);
      textWrap.append(name, meta);
      info.append(thumb, textWrap);

      const currentQty = Number(state.inventory[art.name] || 0);
      const stepper = buildStepper(
        currentQty,
        () => {
          state.inventory[art.name] = Math.max(0, Number(state.inventory[art.name] || 0) - 1);
          saveState();
          renderAll();
        },
        () => {
          state.inventory[art.name] = Math.max(0, Number(state.inventory[art.name] || 0) + 1);
          saveState();
          renderAll();
        }
      );

      item.append(info, stepper);
      inventoryList.appendChild(item);
    });
}

function initialFor(name) {
  return name.split(/\s+/).slice(0,2).map(x => x[0]).join('').toUpperCase();
}


function artImageUrl(art) {
  return (art && art.image) ? art.image : 'assets/artifacts/placeholder.png';
}

function setThumb(el, art, placeholder = '+') {
  if (!el) return;
  if (art) {
    el.classList.add('has-image');
    el.innerHTML = `<img src="${artImageUrl(art)}" alt="${art.name}" loading="lazy" />`;
  } else {
    el.classList.remove('has-image');
    el.textContent = placeholder;
  }
}

function buildStepper(currentValue, onMinus, onPlus) {
  const wrap = document.createElement('div');
  wrap.className = 'qty-stepper';
  const minus = document.createElement('button');
  minus.type = 'button';
  minus.className = 'qty-btn';
  minus.textContent = '−';
  minus.addEventListener('click', onMinus);
  const value = document.createElement('div');
  value.className = 'qty-value';
  value.textContent = String(currentValue);
  const plus = document.createElement('button');
  plus.type = 'button';
  plus.className = 'qty-btn';
  plus.textContent = '+';
  plus.addEventListener('click', onPlus);
  wrap.append(minus, value, plus);
  return wrap;
}

function slotCanUseArt(name, slotIndex) {
  return remainingInventoryExcludingSlot(name, slotIndex) > 0 || state.slots[slotIndex] === name;
}

function renderBuilder() {
  ensureSlotsLength();
  containersRoot.innerHTML = '';
  const slotTemplate = document.getElementById('slotTemplate');
  const used = countSelected();
  slotCountLabel.textContent = String(state.beltContainers * 3);
  filledCountLabel.textContent = String(state.slots.filter(Boolean).length);
  ownedUsageLabel.textContent = String(Object.values(used).reduce((a,b)=>a+b,0));

  for (let c = 0; c < state.beltContainers; c++) {
    const card = document.createElement('section');
    card.className = 'container-card';
    card.innerHTML = `
      <div class="container-head">
        <div class="container-title">Контейнер на 3 слота</div>
        <div class="pill">Контейнер ${c + 1}</div>
      </div>
      <div class="container-slots"></div>
    `;
    const slotsWrap = card.querySelector('.container-slots');
    for (let s = 0; s < 3; s++) {
      const slotIndex = c * 3 + s;
      const slot = slotTemplate.content.firstElementChild.cloneNode(true);
      const btn = slot.querySelector('.slot-main');
      const icon = slot.querySelector('.slot-icon');
      const nameEl = slot.querySelector('.slot-name');
      const dupBtn = slot.querySelector('.duplicate-btn');
      const delBtn = slot.querySelector('.remove-btn');
      const artName = state.slots[slotIndex];
      if (artName && state.artifactsMap[artName]) {
        const art = state.artifactsMap[artName];
        setThumb(icon, art, '');
        nameEl.innerHTML = `<div>${art.name}</div><div class="muted small">${artStatsChips(art)}</div>`;
      } else {
        setThumb(icon, null, '+');
        nameEl.textContent = 'Выбрать арт';
      }

      if (artName && (used[artName] || 0) > Number(state.inventory[artName] || 0)) {
        btn.classList.add('invalid');
      }

      btn.addEventListener('click', () => openPicker(slotIndex));
      delBtn.addEventListener('click', () => {
        state.slots[slotIndex] = null;
        saveState();
        renderAll();
      });
      dupBtn.addEventListener('click', () => {
        if (!artName) return;
        const freeIndex = state.slots.findIndex((x, idx) => idx !== slotIndex && !x);
        if (freeIndex === -1) return alert('Свободных слотов нет.');
        if (!slotCanUseArt(artName, freeIndex)) {
          return alert('Этого арта в инвентаре больше нет.');
        }
        state.slots[freeIndex] = artName;
        saveState();
        renderAll();
      });

      slotsWrap.appendChild(slot);
    }
    containersRoot.appendChild(card);
  }
}

function openPicker(slotIndex) {
  state.pickerSlotIndex = slotIndex;
  pickerSearch.value = '';
  pickerTitle.textContent = `Слот ${slotIndex + 1}: выбор артефакта`;
  pickerModal.classList.remove('hidden');
  pickerModal.setAttribute('aria-hidden', 'false');
  renderPicker();
}

function closePicker() {
  pickerModal.classList.add('hidden');
  pickerModal.setAttribute('aria-hidden', 'true');
  state.pickerSlotIndex = null;
}

function renderPicker() {
  const q = pickerSearch.value.trim().toLowerCase();
  const ownedOnly = pickerOwnedOnly.checked;
  pickerList.innerHTML = '';
  const slotIndex = state.pickerSlotIndex;

  const list = state.artifacts.filter(art => {
    if (q && !art.name.toLowerCase().includes(q)) return false;
    if (ownedOnly && !slotCanUseArt(art.name, slotIndex)) return false;
    return true;
  });

  if (!list.length) {
    pickerList.innerHTML = `<div class="empty-state">Ничего не найдено.</div>`;
    return;
  }

  list.forEach(art => {
    const remaining = remainingInventoryExcludingSlot(art.name, slotIndex);
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'pick-card';
    card.innerHTML = `
      <div class="pick-head">
        <div class="pick-thumb"><img src="${artImageUrl(art)}" alt="${art.name}" loading="lazy" /></div>
        <div class="pick-name">${art.name}</div>
        <div class="badge">${ownedOnly ? `Доступно ${remaining}` : `Есть ${state.inventory[art.name] || 0}`}</div>
      </div>
      <div class="pick-meta">${artStatsChips(art)}</div>
      <div class="pick-footer">
        <span>${art.isFish ? 'Рыбка: сильный штраф в подборе' : 'Обычный приоритет'}</span>
      </div>
    `;
    card.addEventListener('click', () => {
      if (ownedOnly && remaining <= 0 && state.slots[slotIndex] !== art.name) return;
      state.slots[slotIndex] = art.name;
      saveState();
      renderAll();
      closePicker();
    });
    pickerList.appendChild(card);
  });
}

function inventoryQtyArray() {
  return state.artifacts.map(a => Number(state.inventory[a.name] || 0));
}

function countsArrayFromSlots(slots) {
  const counts = Array(state.artifacts.length).fill(0);
  slots.forEach(name => {
    const idx = state.artifacts.findIndex(a => a.name === name);
    if (idx >= 0) counts[idx] += 1;
  });
  return counts;
}

function materializeSlotsFromCounts(counts) {
  const items = [];
  const sortable = [];
  counts.forEach((count, idx) => {
    if (!count) return;
    sortable.push({ idx, count, name: state.artifacts[idx].name });
  });
  sortable.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ru'));
  sortable.forEach(x => {
    for (let i = 0; i < x.count; i++) items.push(state.artifacts[x.idx].name);
  });
  return items;
}

function countFishFromCounts(counts) {
  let n = 0;
  counts.forEach((count, idx) => {
    if (count && state.artifacts[idx].isFish) n += count;
  });
  return n;
}

function signatureFromCounts(counts) {
  return counts.join('|');
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function normalizedCore(totals) {
  return {
    health: clamp(Math.max(0, totals.health) / 10, 0, 1.5),
    blood: clamp(Math.max(0, totals.blood) / 100, 0, 1.5),
    shock: clamp(Math.max(0, totals.shock) / 50, 0, 1.5),
    radBalance: clamp(Math.max(0, totals.radBalance) / 20, 0, 1.5)
  };
}

function balancedCoreScore(totals, slotUsage = 0) {
  const n = normalizedCore(totals);
  const weakest = Math.min(n.health, n.blood, n.shock, n.radBalance);
  const strongest = Math.max(n.health, n.blood, n.shock, n.radBalance);
  const avg = (n.health + n.blood + n.shock + n.radBalance) / 4;
  const spreadPenalty = (strongest - weakest) * 10000;
  const comfortBonus =
    Math.max(0, totals.health - 10) * 180 +
    Math.max(0, totals.blood - 100) * 10 +
    Math.max(0, totals.shock - 50) * 55 +
    Math.max(0, totals.radBalance - 20) * 45;
  return weakest * 45000 + avg * 12000 - spreadPenalty + comfortBonus + slotUsage * 4;
}

function penalties(totals, fishCount, phase = 'base') {
  const waterPenalty = Math.max(0, -totals.water);
  const foodPenalty = Math.max(0, -totals.food);
  const bleedPenalty = Math.max(0, totals.bleedChance) * (phase === 'final' ? 120 : 18) + Math.max(0, -totals.bleedHeal) * (phase === 'final' ? 45 : 8);
  const fishPenalty = fishCount * (phase === 'final' ? 12000 : 1500);
  const softPenalty = waterPenalty * (phase === 'final' ? 0.8 : 0.15) + foodPenalty * (phase === 'final' ? 0.8 : 0.15);
  const hardPenalty =
    Math.max(0, -totals.health) * (phase === 'final' ? 250000 : 15000) +
    Math.max(0, -totals.blood) * (phase === 'final' ? 120000 : 7000) +
    Math.max(0, -totals.shock) * (phase === 'final' ? 140000 : 9000) +
    Math.max(0, -totals.radBalance) * (phase === 'final' ? 150000 : 10000);
  return { waterPenalty, foodPenalty, bleedPenalty, fishPenalty, softPenalty, hardPenalty };
}

function scoreByObjective(totals, fishCount, objective, slotUsage = 0, phase = 'base') {
  const n = normalizedCore(totals);
  const balance = balancedCoreScore(totals, slotUsage);
  const p = penalties(totals, fishCount, phase);
  const common = balance - p.softPenalty - p.bleedPenalty - p.fishPenalty - p.hardPenalty;

  switch (objective) {
    case 'health':
      return common + n.health * (phase === 'final' ? 12000 : 1400) + totals.health * (phase === 'final' ? 220 : 28) + n.shock * 700 + n.radBalance * 700 + n.blood * 600;
    case 'blood':
      return common + n.blood * (phase === 'final' ? 12000 : 1400) + totals.blood * (phase === 'final' ? 22 : 3) + n.health * 900 + n.shock * 650 + n.radBalance * 650;
    case 'shock':
      return common + n.shock * (phase === 'final' ? 12500 : 1450) + totals.shock * (phase === 'final' ? 120 : 15) + n.health * 850 + n.blood * 650 + n.radBalance * 600;
    case 'radBalance':
      return common + n.radBalance * (phase === 'final' ? 12500 : 1450) + totals.radBalance * (phase === 'final' ? 120 : 16) + n.health * 850 + n.blood * 650 + n.shock * 600;
    case 'balanced':
    default:
      return common + n.health * (phase === 'final' ? 8200 : 980) + n.blood * (phase === 'final' ? 7600 : 920) + n.shock * (phase === 'final' ? 7600 : 920) + n.radBalance * (phase === 'final' ? 8200 : 980) + slotUsage * (phase === 'final' ? 4 : 1);
  }
}

function baseObjectiveScore(totals, fishCount, objective, slotUsage = 0) {
  return scoreByObjective(totals, fishCount, objective, slotUsage, 'base');
}

function finalObjectiveScore(totals, fishCount, objective, slotUsage = 0) {
  return scoreByObjective(totals, fishCount, objective, slotUsage, 'final');
}

function beamSearch(slotCount, objective, beamWidth = 240) {
  const qty = inventoryQtyArray();
  const totalOwned = qty.reduce((a, b) => a + b, 0);
  const maxDepth = Math.min(slotCount, totalOwned);
  if (maxDepth <= 0) return { all: [], lastBeam: [] };

  let beam = [{
    counts: Array(state.artifacts.length).fill(0),
    totals: { health: 0, blood: 0, shock: 0, water: 0, food: 0, radOut: 0, radIn: 0, radBalance: 0, bleedChance: 0, bleedHeal: 0 },
    fishCount: 0,
    slotUsage: 0,
    score: 0
  }];
  const all = [];

  for (let depth = 0; depth < maxDepth; depth++) {
    const nextMap = new Map();
    beam.forEach(cand => {
      for (let idx = 0; idx < state.artifacts.length; idx++) {
        if ((qty[idx] || 0) <= cand.counts[idx]) continue;
        const art = state.artifacts[idx];
        const counts = cand.counts.slice();
        counts[idx] += 1;
        const totals = cloneTotals(cand.totals);
        addArtToTotals(totals, art);
        const fishCount = cand.fishCount + (art.isFish ? 1 : 0);
        const slotUsage = cand.slotUsage + 1;
        const score = baseObjectiveScore(totals, fishCount, objective, slotUsage);
        const sig = signatureFromCounts(counts);
        const existing = nextMap.get(sig);
        if (!existing || score > existing.score) {
          nextMap.set(sig, { counts, totals, fishCount, slotUsage, score });
        }
      }
    });
    beam = [...nextMap.values()].sort((a, b) => b.score - a.score).slice(0, beamWidth);
    all.push(...beam);
  }
  return { all, lastBeam: beam };
}

function multisetDistance(countsA, countsB) {
  let d = 0;
  for (let i = 0; i < countsA.length; i++) d += Math.abs((countsA[i] || 0) - (countsB[i] || 0));
  return d;
}

function hillClimb(candidate, objective) {
  let current = {
    counts: candidate.counts.slice(),
    totals: cloneTotals(candidate.totals),
    fishCount: candidate.fishCount,
    slotUsage: candidate.slotUsage
  };
  let improved = true;
  let guard = 0;
  const qty = inventoryQtyArray();

  while (improved && guard < 30) {
    guard += 1;
    improved = false;
    const currentScore = finalObjectiveScore(current.totals, current.fishCount, objective, current.slotUsage);
    let best = null;

    for (let oldIdx = 0; oldIdx < current.counts.length; oldIdx++) {
      if (!current.counts[oldIdx]) continue;
      const oldArt = state.artifacts[oldIdx];
      const baseCounts = current.counts.slice();
      baseCounts[oldIdx] -= 1;
      const baseTotals = cloneTotals(current.totals);
      subArtFromTotals(baseTotals, oldArt);
      const baseFish = current.fishCount - (oldArt.isFish ? 1 : 0);

      for (let newIdx = 0; newIdx < state.artifacts.length; newIdx++) {
        if (newIdx === oldIdx) continue;
        if (baseCounts[newIdx] >= (qty[newIdx] || 0)) continue;
        const newArt = state.artifacts[newIdx];
        const counts = baseCounts.slice();
        counts[newIdx] += 1;
        const totals = cloneTotals(baseTotals);
        addArtToTotals(totals, newArt);
        if (!isSafeTotals(totals)) continue;
        const fishCount = baseFish + (newArt.isFish ? 1 : 0);
        const score = finalObjectiveScore(totals, fishCount, objective, current.slotUsage);
        if (score > currentScore + 1e-6 && (!best || score > best.score)) {
          best = { counts, totals, fishCount, slotUsage: current.slotUsage, score };
        }
      }
    }
    if (best) { current = best; improved = true; }
  }
  return current;
}

function buildCandidatePool(slotCount) {
  const objectives = ['balanced', 'health', 'blood', 'shock', 'radBalance'];
  const pool = new Map();
  objectives.forEach(obj => {
    const { all } = beamSearch(slotCount, obj, obj === 'balanced' ? 320 : 240);
    all.forEach(c => {
      const sig = signatureFromCounts(c.counts);
      const existing = pool.get(sig);
      const score = baseObjectiveScore(c.totals, c.fishCount, 'balanced', c.slotUsage);
      if (!existing || score > baseObjectiveScore(existing.totals, existing.fishCount, 'balanced', existing.slotUsage)) {
        pool.set(sig, c);
      }
    });
  });
  return [...pool.values()];
}

function pickTopBalancedVariants(pool, desired = 5) {
  let candidates = pool
    .filter(c => isSafeTotals(c.totals))
    .sort((a, b) => finalObjectiveScore(b.totals, b.fishCount, 'balanced', b.slotUsage) - finalObjectiveScore(a.totals, a.fishCount, 'balanced', a.slotUsage));

  const improved = [];
  candidates.slice(0, 48).forEach(c => improved.push(hillClimb(c, 'balanced')));

  const merged = new Map();
  [...candidates, ...improved].forEach(c => {
    const sig = signatureFromCounts(c.counts);
    const existing = merged.get(sig);
    const sc = finalObjectiveScore(c.totals, c.fishCount, 'balanced', c.slotUsage);
    if (!existing || sc > finalObjectiveScore(existing.totals, existing.fishCount, 'balanced', existing.slotUsage)) {
      merged.set(sig, c);
    }
  });

  candidates = [...merged.values()]
    .filter(c => isSafeTotals(c.totals))
    .sort((a, b) => finalObjectiveScore(b.totals, b.fishCount, 'balanced', b.slotUsage) - finalObjectiveScore(a.totals, a.fishCount, 'balanced', a.slotUsage));

  const result = [];
  const thresholds = [4, 2, 0];
  thresholds.forEach(threshold => {
    candidates.forEach(c => {
      if (result.length >= desired) return;
      const same = result.some(x => signatureFromCounts(x.counts) === signatureFromCounts(c.counts));
      if (same) return;
      const tooClose = result.some(x => multisetDistance(x.counts, c.counts) <= threshold);
      if (!tooClose) result.push(c);
    });
  });
  return result.slice(0, desired);
}

function getFallbackUnsafeCandidate(slotCount) {
  const pool = buildCandidatePool(slotCount).sort((a, b) => baseObjectiveScore(b.totals, b.fishCount, 'balanced', b.slotUsage) - baseObjectiveScore(a.totals, a.fishCount, 'balanced', a.slotUsage));
  return pool[0] || null;
}

function renderVariants() {
  variantsRoot.innerHTML = '';
  const slotCount = state.beltContainers * 3;
  const totalOwned = Object.values(state.inventory).reduce((a, b) => a + Number(b || 0), 0);

  if (!totalOwned) {
    variantsRoot.innerHTML = `<div class="empty-state">Сначала заполни инвентарь. После этого появятся сбалансированные варианты сборок.</div>`;
    state.variants = null;
    return;
  }

  const pool = buildCandidatePool(slotCount);
  const safePool = pool.filter(c => isSafeTotals(c.totals));

  if (!safePool.length) {
    const fallback = getFallbackUnsafeCandidate(slotCount);
    let html = `<div class="empty-state">Из текущего инвентаря не найдено ни одной безопасной сборки. Сайт не будет предлагать билд, который ломает здоровье / кровь / шок / радиацию.</div>`;
    if (fallback) {
      const needs = getNeeds(fallback.totals);
      if (needs.length) {
        html += `<div class="empty-state"><b>Что стоит добрать, чтобы выйти в плюс:</b><br>${needs.map(n => {
          const miss = estimateMissing(n);
          return `${n.name}: нужно ${n.amount}${miss ? `, лучше искать ${miss.art.name} ×${miss.countNeeded}` : ''}`;
        }).join('<br>')}</div>`;
      }
    }
    variantsRoot.innerHTML = html;
    state.variants = null;
    return;
  }

  const variants = pickTopBalancedVariants(pool, 5);
  state.variants = { balanced: variants };

  const wrap = document.createElement('div');
  wrap.className = 'variant-group';
  wrap.innerHTML = `
    <div class="variant-group-title">
      <div class="variant-name">Альтернативные баланс-сборки</div>
      <div class="badge">Топ-5</div>
    </div>
    <div class="variant-cards"></div>
  `;
  const cardsRoot = wrap.querySelector('.variant-cards');

  variants.forEach((cand, idx) => {
    const slots = materializeSlotsFromCounts(cand.counts);
    const fishUsed = cand.fishCount > 0;
    const counts = countSelected(slots);
    const lines = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ru')).map(([name, qty]) => `${name} ×${qty}`).join('<br>');
    const emptySlots = slotCount - cand.slotUsage;
    const card = document.createElement('div');
    card.className = 'variant-card';
    card.innerHTML = `
      <div class="variant-head">
        <div class="variant-name">Вариант ${idx + 1}</div>
        <div class="badge ${fishUsed ? 'no' : 'ok'}">${fishUsed ? 'Есть рыбка' : 'Без рыбки'}</div>
      </div>
      <div class="variant-stats">
        <span class="stat-chip pos">ХП ${cand.totals.health > 0 ? '+' : ''}${cand.totals.health}</span>
        <span class="stat-chip pos">Кровь ${cand.totals.blood > 0 ? '+' : ''}${cand.totals.blood}</span>
        <span class="stat-chip pos">Шок ${cand.totals.shock > 0 ? '+' : ''}${cand.totals.shock}</span>
        <span class="stat-chip pos">Рад ${cand.totals.radBalance > 0 ? '+' : ''}${cand.totals.radBalance}</span>
        <span class="stat-chip ${cand.totals.water >= 0 ? 'pos' : 'neg'}">Вода ${cand.totals.water > 0 ? '+' : ''}${cand.totals.water}</span>
        <span class="stat-chip ${cand.totals.food >= 0 ? 'pos' : 'neg'}">Еда ${cand.totals.food > 0 ? '+' : ''}${cand.totals.food}</span>
      </div>
      <div class="helper-line">Слотов занято: ${cand.slotUsage}/${slotCount}${emptySlots > 0 ? `, свободно ${emptySlots}` : ''}</div>
      <div class="variant-list">${lines}</div>
      <div class="variant-actions"><button class="btn tiny primary">Применить</button></div>
    `;
    card.querySelector('button').addEventListener('click', () => {
      state.slots = slots.slice();
      while (state.slots.length < slotCount) state.slots.push(null);
      saveState();
      renderAll(false);
    });
    cardsRoot.appendChild(card);
  });

  variantsRoot.appendChild(wrap);
}

function applyBestBuild() {
  const slotCount = state.beltContainers * 3;
  const pool = buildCandidatePool(slotCount).filter(c => isSafeTotals(c.totals));
  if (!pool.length) {
    alert('Безопасная сборка из текущего инвентаря не найдена. Сначала добери арты, которые закроют здоровье / кровь / шок / радиацию.');
    return;
  }
  const best = pickTopBalancedVariants(pool, 1)[0] || pool.sort((a, b) => finalObjectiveScore(b.totals, b.fishCount, 'balanced', b.slotUsage) - finalObjectiveScore(a.totals, a.fishCount, 'balanced', a.slotUsage))[0];
  if (!best) {
    alert('Безопасная сборка из текущего инвентаря не найдена.');
    return;
  }
  state.slots = materializeSlotsFromCounts(best.counts);
  while (state.slots.length < slotCount) state.slots.push(null);
  saveState();
  renderAll(false);
}

function clearBuild() {
  state.slots = defaultSlots(state.beltContainers);
  saveState();
  renderAll();
}

function renderAll(recomputeVariants = true) {
  ensureSlotsLength();
  renderInventory();
  renderBuilder();
  renderTotals();
  if (recomputeVariants) renderVariants();
}

async function init() {
  const resp = await fetch('artifacts.json');
  const artifacts = (await resp.json()).map(normalizeArt);
  artifacts.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  state.artifacts = artifacts;
  state.artifactsMap = Object.fromEntries(artifacts.map(a => [a.name, a]));

  loadState();
  beltSelect.value = String(state.beltContainers);
  ensureSlotsLength();
  renderAll();
}

document.getElementById('applyBestBtn').addEventListener('click', applyBestBuild);
document.getElementById('refreshVariantsBtn').addEventListener('click', renderVariants);
document.getElementById('clearBuildBtn').addEventListener('click', clearBuild);
document.getElementById('saveStateBtn').addEventListener('click', () => {
  saveState();
  alert('Сохранено локально в браузере.');
});
beltSelect.addEventListener('change', () => {
  state.beltContainers = Number(beltSelect.value);
  ensureSlotsLength();
  saveState();
  renderAll();
});
inventorySearch.addEventListener('input', renderInventory);
pickerSearch.addEventListener('input', renderPicker);
pickerOwnedOnly.addEventListener('change', renderPicker);
pickerModal.addEventListener('click', (e) => {
  if (e.target.dataset.closePicker === '1') closePicker();
});
window.addEventListener('beforeunload', saveState);

init();

const STORAGE_KEY = 'expense_tracker_data';

const CATEGORY_META = {
  'Food & Dining':  { icon: '🍔', color: '#f97316' },
  'Transport':      { icon: '🚗', color: '#3b82f6' },
  'Housing':        { icon: '🏠', color: '#8b5cf6' },
  'Entertainment':  { icon: '🎬', color: '#ec4899' },
  'Healthcare':     { icon: '💊', color: '#10b981' },
  'Shopping':       { icon: '🛍️', color: '#f59e0b' },
  'Utilities':      { icon: '⚡', color: '#6366f1' },
  'Education':      { icon: '📚', color: '#14b8a6' },
  'Other':          { icon: '📦', color: '#94a3b8' },
};

const BAR_COLORS = [
  '#4f46e5','#10b981','#f59e0b','#ef4444',
  '#3b82f6','#8b5cf6','#ec4899','#14b8a6','#94a3b8'
];

// ── State ──────────────────────────────────────────────
let expenses = loadExpenses();
let pendingDeleteId = null;
let activeFilter = '';

// ── DOM refs ──────────────────────────────────────────
const form            = document.getElementById('expenseForm');
const descInput       = document.getElementById('description');
const amountInput     = document.getElementById('amount');
const categoryInput   = document.getElementById('category');
const dateInput       = document.getElementById('date');
const expenseList     = document.getElementById('expenseList');
const emptyState      = document.getElementById('emptyState');
const totalAmountEl   = document.getElementById('totalAmount');
const monthAmountEl   = document.getElementById('monthAmount');
const totalCountEl    = document.getElementById('totalCount');
const filterSelect    = document.getElementById('filterCategory');
const clearAllBtn     = document.getElementById('clearAllBtn');
const modalOverlay    = document.getElementById('modalOverlay');
const cancelDeleteBtn = document.getElementById('cancelDelete');
const confirmDeleteBtn= document.getElementById('confirmDelete');
const breakdownSection= document.getElementById('breakdownSection');
const breakdownList   = document.getElementById('breakdownList');

// ── Init ──────────────────────────────────────────────
dateInput.value = todayISO();
render();

// ── Event listeners ───────────────────────────────────
form.addEventListener('submit', e => {
  e.preventDefault();
  const expense = {
    id: Date.now(),
    description: descInput.value.trim(),
    amount: parseFloat(amountInput.value),
    category: categoryInput.value,
    date: dateInput.value,
  };
  expenses.unshift(expense);
  saveExpenses();
  form.reset();
  dateInput.value = todayISO();
  render();
});

filterSelect.addEventListener('change', () => {
  activeFilter = filterSelect.value;
  render();
});

clearAllBtn.addEventListener('click', () => {
  if (expenses.length === 0) return;
  pendingDeleteId = 'ALL';
  modalOverlay.classList.add('active');
});

cancelDeleteBtn.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });
confirmDeleteBtn.addEventListener('click', () => {
  if (pendingDeleteId === 'ALL') {
    expenses = [];
  } else {
    expenses = expenses.filter(ex => ex.id !== pendingDeleteId);
  }
  saveExpenses();
  closeModal();
  render();
});

// ── Render ─────────────────────────────────────────────
function render() {
  renderSummary();
  renderList();
  renderBreakdown();
}

function renderSummary() {
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const now = new Date();
  const monthTotal = expenses
    .filter(e => {
      const d = new Date(e.date + 'T00:00:00');
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    })
    .reduce((s, e) => s + e.amount, 0);

  totalAmountEl.textContent = fmt(total);
  monthAmountEl.textContent = fmt(monthTotal);
  totalCountEl.textContent  = expenses.length;
}

function renderList() {
  const filtered = activeFilter
    ? expenses.filter(e => e.category === activeFilter)
    : expenses;

  expenseList.innerHTML = '';

  if (filtered.length === 0) {
    expenseList.appendChild(emptyState);
    emptyState.style.display = '';
    return;
  }
  emptyState.style.display = 'none';

  filtered.forEach(expense => {
    const meta = CATEGORY_META[expense.category] || CATEGORY_META['Other'];
    const item = document.createElement('div');
    item.className = 'expense-item';
    item.innerHTML = `
      <div class="expense-item__icon" style="background:${meta.color}22">${meta.icon}</div>
      <div class="expense-item__info">
        <div class="expense-item__desc">${escapeHtml(expense.description)}</div>
        <div class="expense-item__meta">${expense.category} · ${fmtDate(expense.date)}</div>
      </div>
      <div class="expense-item__amount">-${fmt(expense.amount)}</div>
      <div class="expense-item__actions">
        <button class="btn--icon" data-id="${expense.id}" title="Delete">✕</button>
      </div>
    `;
    item.querySelector('.btn--icon').addEventListener('click', () => {
      pendingDeleteId = expense.id;
      modalOverlay.classList.add('active');
    });
    expenseList.appendChild(item);
  });
}

function renderBreakdown() {
  if (expenses.length === 0) {
    breakdownSection.style.display = 'none';
    return;
  }
  breakdownSection.style.display = '';

  const totals = {};
  expenses.forEach(e => {
    totals[e.category] = (totals[e.category] || 0) + e.amount;
  });

  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const grandTotal = sorted.reduce((s, [, v]) => s + v, 0);

  breakdownList.innerHTML = '';
  sorted.forEach(([cat, amount], i) => {
    const meta = CATEGORY_META[cat] || CATEGORY_META['Other'];
    const pct = grandTotal > 0 ? (amount / grandTotal) * 100 : 0;
    const row = document.createElement('div');
    row.className = 'breakdown-item';
    row.innerHTML = `
      <div class="breakdown-item__label">
        <span>${meta.icon}</span><span>${cat}</span>
      </div>
      <div class="breakdown-item__bar-wrap">
        <div class="breakdown-item__bar" style="width:${pct}%;background:${BAR_COLORS[i % BAR_COLORS.length]}"></div>
      </div>
      <div class="breakdown-item__pct">${pct.toFixed(0)}%</div>
      <div class="breakdown-item__amount">${fmt(amount)}</div>
    `;
    breakdownList.appendChild(row);
  });
}

// ── Helpers ────────────────────────────────────────────
function closeModal() {
  modalOverlay.classList.remove('active');
  pendingDeleteId = null;
}

function loadExpenses() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch { return []; }
}

function saveExpenses() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
}

function fmt(n) {
  return '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function fmtDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
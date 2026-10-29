/**
 * TaskFlow – script.js
 * Vanilla JS · No dependencies · Safe DOM construction throughout.
 *
 * Architecture
 * ────────────
 *  state          : single source of truth (array of task objects)
 *  render()       : re-draws the entire list from state (filter + sort aware)
 *  updateStats()  : refreshes the four stat counters + progress bar + footer count
 *  buildTaskEl()  : creates a <li> element safely for one task object
 *  Input helpers  : showError / hideError
 *  Storage layer  : storageAvailable / saveTasks / loadTasks
 *  Event wiring   : all addEventListener calls in initEventListeners()
 *
 * Task object shape
 * ─────────────────
 *  {
 *    id        : string   – "task-" + timestamp + random suffix
 *    text      : string   – trimmed, user-entered description
 *    status    : "active" | "pending" | "completed"
 *    priority  : "high"   | "medium"  | "low"
 *    category  : "general"| "work"    | "personal" | "study" | "health"
 *    dueDate   : string   – ISO date string "YYYY-MM-DD" or ""
 *    createdAt : number   – Date.now() at creation time
 *  }
 *
 * localStorage schema
 * ───────────────────
 *  Key  : "taskflow_tasks"
 *  Value: JSON-stringified array of task objects (see shape above).
 */

'use strict';

/* ============================================================
   STORAGE CONSTANTS
   ============================================================ */

/** The single localStorage key used to persist all tasks. */
const STORAGE_KEY = 'taskflow_tasks';

/**
 * Valid status values – used during data validation on load.
 * @type {ReadonlyArray<string>}
 */
const VALID_STATUSES   = Object.freeze(['active', 'pending', 'completed']);
const VALID_PRIORITIES = Object.freeze(['high', 'medium', 'low']);
const VALID_CATEGORIES = Object.freeze(['general', 'work', 'personal', 'study', 'health']);

/* ============================================================
   APPLICATION STATE
   ============================================================ */

/** @type {Array<Object>} Master list – never mutated directly; replaced via helpers. */
let tasks = [];

/** Currently active filter tab: "all" | "active" | "pending" | "completed" */
let currentFilter = 'all';

/** Currently active sort: "newest" | "oldest" | "priority" | "name" */
let currentSort = 'newest';

/** Live search query (lower-cased). */
let searchQuery = '';

/**
 * The task ID currently being edited in the modal.
 * null when no modal is open.
 * @type {string|null}
 */
let editingTaskId = null;

/**
 * Whether the storage warning banner has already been injected.
 * Prevents the banner from appearing more than once per session.
 * @type {boolean}
 */
let storageBannerShown = false;

/* ============================================================
   PRIORITY CONFIG
   Maps priority value → { label, cssClass, rank (lower = higher priority) }
   ============================================================ */
const PRIORITY_CONFIG = {
  high:   { label: '🔴 High',   cssClass: 'priority-high',   rank: 0 },
  medium: { label: '⚡ Medium', cssClass: 'priority-medium', rank: 1 },
  low:    { label: '🟢 Low',    cssClass: 'priority-low',    rank: 2 },
};

/* Category value → display label */
const CATEGORY_LABELS = {
  general:  '📋 General',
  work:     '💼 Work',
  personal: '🏠 Personal',
  study:    '📚 Study',
  health:   '💪 Health',
};

/* ============================================================
   DOM REFERENCES
   All queried once at startup – never re-queried inside loops.
   ============================================================ */
const DOM = {
  // Input panel
  taskInput:        document.getElementById('task-input'),
  prioritySelect:   document.getElementById('priority-select'),
  categorySelect:   document.getElementById('category-select'),
  dueDateInput:     document.getElementById('due-date-input'),
  addTaskBtn:       document.getElementById('add-task-btn'),
  inputError:       document.getElementById('input-error'),
  inputErrorText:   document.getElementById('input-error-text'),

  // Stats
  countTotal:       document.getElementById('count-total'),
  countActive:      document.getElementById('count-active'),
  countPending:     document.getElementById('count-pending'),
  countCompleted:   document.getElementById('count-completed'),

  // Progress bar
  progressFill:     document.getElementById('progress-fill'),
  progressPercent:  document.getElementById('progress-percent'),
  progressTrack:    document.querySelector('.progress-track'),

  // Filter tabs
  filterAll:        document.getElementById('filter-all'),
  filterActive:     document.getElementById('filter-active'),
  filterPending:    document.getElementById('filter-pending'),
  filterCompleted:  document.getElementById('filter-completed'),

  // Search & sort
  searchInput:      document.getElementById('search-input'),
  sortSelect:       document.getElementById('sort-select'),

  // Task list & empty state
  taskList:         document.getElementById('task-list'),
  emptyState:       document.getElementById('empty-state'),
  emptyTitle:       document.getElementById('empty-title'),
  emptySubtitle:    document.getElementById('empty-subtitle'),

  // Footer
  remainingCount:   document.getElementById('remaining-count'),
  markAllBtn:       document.getElementById('mark-all-btn'),
  clearCompletedBtn:document.getElementById('clear-completed-btn'),

  // Edit modal
  editModal:        document.getElementById('edit-modal'),
  editTaskInput:    document.getElementById('edit-task-input'),
  editPriority:     document.getElementById('edit-priority-select'),
  editCategory:     document.getElementById('edit-category-select'),
  editDueDate:      document.getElementById('edit-due-date'),
  modalSaveBtn:     document.getElementById('modal-save-btn'),
  modalCancelBtn:   document.getElementById('modal-cancel-btn'),
  modalCloseBtn:    document.getElementById('modal-close-btn'),

  // Footer year
  footerYear:       document.getElementById('footer-year'),

  // Current date badge (populated by displayCurrentDate())
  currentDateEl:    document.getElementById('current-date-display'),
};

/* ============================================================
   LOCALSTORAGE LAYER
   ============================================================ */

/**
 * Tests whether localStorage is actually readable and writable.
 * Some browsers throw in private/incognito mode or when storage is full.
 * @returns {boolean}
 */
function storageAvailable() {
  try {
    const probe = '__taskflow_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Shows a single, non-blocking warning banner below the app header
 * when localStorage is unavailable or a save fails.
 * The banner is injected into the DOM only once per page load.
 * @param {string} reason – short explanation to show the user
 */
function showStorageWarning(reason) {
  if (storageBannerShown) return;
  storageBannerShown = true;

  const banner = document.createElement('div');
  banner.id = 'storage-warning-banner';
  banner.setAttribute('role', 'alert');
  banner.setAttribute('aria-live', 'polite');

  // Inline styles keep this self-contained – no new CSS class needed.
  Object.assign(banner.style, {
    display:        'flex',
    alignItems:     'center',
    gap:            '10px',
    maxWidth:       '860px',
    margin:         '0 auto 0',
    padding:        '10px 20px',
    background:     'hsl(38, 95%, 60%, .12)',
    border:         '1px solid hsl(38, 95%, 60%, .35)',
    borderRadius:   '10px',
    color:          'hsl(38, 95%, 75%)',
    fontSize:       '0.8125rem',
    fontWeight:     '500',
    lineHeight:     '1.5',
    width:          'calc(100% - 48px)',
    boxSizing:      'border-box',
  });

  // Warning icon (static, trusted SVG – no user content)
  const iconWrap = document.createElement('span');
  iconWrap.setAttribute('aria-hidden', 'true');
  iconWrap.style.flexShrink = '0';
  iconWrap.innerHTML =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
    'stroke-linejoin="round">' +
    '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>' +
    '<line x1="12" y1="9" x2="12" y2="13"></line>' +
    '<line x1="12" y1="17" x2="12.01" y2="17"></line>' +
    '</svg>';

  // Message text – reason is a developer-supplied constant, not user input
  const msg = document.createElement('span');
  msg.textContent = '\u26A0\uFE0F Storage unavailable: ' + reason +
    ' — your tasks will not be saved between page reloads.';

  // Dismiss button
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '\u00D7';
  closeBtn.setAttribute('aria-label', 'Dismiss storage warning');
  Object.assign(closeBtn.style, {
    marginLeft:   'auto',
    background:   'none',
    border:       'none',
    color:        'inherit',
    fontSize:     '1.1rem',
    cursor:       'pointer',
    lineHeight:   '1',
    padding:      '0 2px',
    flexShrink:   '0',
  });
  closeBtn.addEventListener('click', function () {
    banner.remove();
  });

  banner.appendChild(iconWrap);
  banner.appendChild(msg);
  banner.appendChild(closeBtn);

  // Insert immediately after the <header> so it is the very first thing
  // visible below the branding without disrupting the main dashboard.
  const header = document.getElementById('app-header');
  if (header && header.parentNode) {
    header.parentNode.insertBefore(banner, header.nextSibling);
  } else {
    // Fallback: prepend to body
    document.body.prepend(banner);
  }
}

/**
 * Serialises the current `tasks` array to JSON and writes it to
 * localStorage under STORAGE_KEY.
 *
 * Handles three failure scenarios gracefully:
 *   1. localStorage not available in this browser / origin.
 *   2. QuotaExceededError (storage full).
 *   3. Any other unexpected write error.
 *
 * In all error cases a non-blocking banner is shown once.
 */
function saveTasks() {
  if (!storageAvailable()) {
    showStorageWarning('localStorage is not accessible in this browser or context');
    return;
  }

  try {
    const json = JSON.stringify(tasks);
    localStorage.setItem(STORAGE_KEY, json);
  } catch (err) {
    // QuotaExceededError or SecurityError
    const reason = (err && err.name) ? err.name : 'unknown write error';
    showStorageWarning(reason);
  }
}

/**
 * Reads and validates the tasks array from localStorage.
 *
 * Validation rules applied to each task object:
 *   • id        – must be a non-empty string
 *   • text      – must be a non-empty string (≤ 200 chars)
 *   • status    – must be one of VALID_STATUSES; defaults to 'active'
 *   • priority  – must be one of VALID_PRIORITIES; defaults to 'medium'
 *   • category  – must be one of VALID_CATEGORIES; defaults to 'general'
 *   • dueDate   – must be a string (empty string is fine)
 *   • createdAt – must be a finite number; defaults to Date.now()
 *
 * Any item that cannot be salvaged (missing id or text) is silently
 * dropped. The rest are repaired with safe defaults.
 *
 * @returns {Array<Object>} A validated (possibly empty) array of tasks.
 */
function loadTasks() {
  if (!storageAvailable()) {
    showStorageWarning('localStorage is not accessible in this browser or context');
    return [];
  }

  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (err) {
    showStorageWarning('could not read saved data');
    return [];
  }

  // Nothing stored yet – perfectly normal on first visit.
  if (raw === null || raw === undefined) return [];

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (_) {
    // Corrupt JSON – wipe the bad entry so it doesn't block future saves.
    try { localStorage.removeItem(STORAGE_KEY); } catch (_2) { /* ignore */ }
    showStorageWarning('saved data was corrupted and has been cleared');
    return [];
  }

  // Top-level must be an array.
  if (!Array.isArray(parsed)) {
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) { /* ignore */ }
    showStorageWarning('saved data had an unexpected format and has been cleared');
    return [];
  }

  // Validate and sanitise each item.
  const validated = [];
  parsed.forEach(function (item) {
    // item must be a plain object
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;

    // id: required, non-empty string
    if (typeof item.id !== 'string' || item.id.trim() === '') return;

    // text: required, non-empty string
    if (typeof item.text !== 'string' || item.text.trim() === '') return;

    // Build a clean, fully-shaped task object with safe defaults.
    validated.push({
      id:        item.id.trim(),
      text:      item.text.trim().slice(0, 200),
      status:    VALID_STATUSES.includes(item.status)   ? item.status   : 'active',
      priority:  VALID_PRIORITIES.includes(item.priority) ? item.priority : 'medium',
      category:  VALID_CATEGORIES.includes(item.category) ? item.category : 'general',
      dueDate:   (typeof item.dueDate === 'string')    ? item.dueDate   : '',
      createdAt: (typeof item.createdAt === 'number' && isFinite(item.createdAt))
                   ? item.createdAt
                   : Date.now(),
    });
  });

  return validated;
}

/* ============================================================
   ID GENERATION
   ============================================================ */

/**
 * Returns a collision-resistant unique task ID.
 * Uses timestamp + 4-char random suffix.
 * @returns {string}
 */
function generateId() {
  return 'task-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
}

/* ============================================================
   ERROR DISPLAY HELPERS
   ============================================================ */

/** Show a validation error message below the input panel. */
function showError(message) {
  DOM.inputErrorText.textContent = message;
  DOM.inputError.style.display = 'flex';
  DOM.taskInput.setAttribute('aria-invalid', 'true');
}

/** Hide the validation error. */
function hideError() {
  DOM.inputError.style.display = 'none';
  DOM.taskInput.removeAttribute('aria-invalid');
}

/* ============================================================
   DATE FORMATTING
   ============================================================ */

/**
 * Formats an ISO date string "YYYY-MM-DD" into a human-readable string.
 * Returns "" if the input is empty or invalid.
 * @param {string} isoDate
 * @returns {string}
 */
function formatDueDate(isoDate) {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('-').map(Number);
  // Construct date in local time to avoid UTC offset surprises.
  const d = new Date(year, month - 1, day);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/* ============================================================
   SAFE SVG SNIPPET HELPERS
   These return pre-defined SVG strings for icons.
   They are only used as innerHTML on inert, trusted icon containers –
   never used to inject any user-provided content.
   ============================================================ */

/** Returns the check-mark SVG used inside task checkboxes. */
function checkSVG() {
  return '<svg class="checkbox-check" width="14" height="14" viewBox="0 0 24 24" ' +
    'fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" ' +
    'stroke-linejoin="round" aria-hidden="true">' +
    '<polyline points="20 6 9 17 4 12"></polyline></svg>';
}

/** Returns the edit (pencil) icon SVG. */
function editSVG() {
  return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>' +
    '<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>';
}

/** Returns the delete (trash) icon SVG. */
function deleteSVG() {
  return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<polyline points="3 6 5 6 21 6"></polyline>' +
    '<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>' +
    '</svg>';
}

/** Returns the calendar icon SVG used for due-date display. */
function calendarSVG() {
  return '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>' +
    '<line x1="16" y1="2" x2="16" y2="6"></line>' +
    '<line x1="8" y1="2" x2="8" y2="6"></line>' +
    '<line x1="3" y1="10" x2="21" y2="10"></line></svg>';
}

/** Returns the small check-mark SVG used inside the "Done" badge. */
function doneBadgeSVG() {
  return '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<polyline points="20 6 9 17 4 12"></polyline></svg>';
}

/* ============================================================
   DOM BUILDER – buildTaskEl()
   Constructs a complete <li> for a task object using createElement.
   User-entered content is always set via .textContent (never innerHTML).
   ============================================================ */

/**
 * Creates and returns a fully constructed <li> element for the given task.
 * @param {Object} task
 * @returns {HTMLLIElement}
 */
function buildTaskEl(task) {
  const isCompleted = task.status === 'completed';
  const pCfg = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;

  /* ── <li> ── */
  const li = document.createElement('li');
  li.className = 'task-item task-' + task.status;
  li.id = task.id;
  li.dataset.priority = task.priority;
  li.dataset.category = task.category;
  li.dataset.status = task.status;

  /* ── .task-row ── */
  const row = document.createElement('div');
  row.className = 'task-row';

  /* ── Checkbox button ── */
  const checkbox = document.createElement('button');
  checkbox.className = 'task-checkbox' + (isCompleted ? ' task-checkbox--done' : '');
  checkbox.setAttribute('aria-pressed', String(isCompleted));
  checkbox.setAttribute(
    'aria-label',
    isCompleted ? 'Mark task as incomplete' : 'Mark task as complete'
  );
  // Icon is static SVG – safe to set as innerHTML (no user content here).
  checkbox.innerHTML = checkSVG();
  checkbox.dataset.action = 'toggle';
  checkbox.dataset.taskId = task.id;

  /* ── .task-content ── */
  const content = document.createElement('div');
  content.className = 'task-content';

  /* Task text – user content → textContent only */
  const textSpan = document.createElement('span');
  textSpan.className = 'task-text';
  textSpan.textContent = task.text; // ← safe: never innerHTML

  /* Meta row */
  const meta = document.createElement('div');
  meta.className = 'task-meta';

  /* Priority badge */
  const priorityBadge = document.createElement('span');
  priorityBadge.className = 'task-priority ' + pCfg.cssClass;
  priorityBadge.textContent = pCfg.label;

  /* Category chip */
  const categoryChip = document.createElement('span');
  categoryChip.className = 'task-category';
  categoryChip.textContent = CATEGORY_LABELS[task.category] || task.category;

  meta.appendChild(priorityBadge);
  meta.appendChild(categoryChip);

  /* Due date chip (conditional) */
  if (task.dueDate) {
    const dueDateSpan = document.createElement('span');
    dueDateSpan.className = 'task-due-date';
    // Icon is static, safe to set via innerHTML on its own child.
    const calIcon = document.createElement('span');
    calIcon.innerHTML = calendarSVG();
    const dateText = document.createTextNode(' Due: ' + formatDueDate(task.dueDate));
    dueDateSpan.appendChild(calIcon);
    dueDateSpan.appendChild(dateText);
    meta.appendChild(dueDateSpan);
  }

  /* "Done" badge for completed tasks */
  if (isCompleted) {
    const doneBadge = document.createElement('span');
    doneBadge.className = 'task-completed-badge';
    const doneIcon = document.createElement('span');
    doneIcon.innerHTML = doneBadgeSVG();
    const doneText = document.createTextNode(' Done');
    doneBadge.appendChild(doneIcon);
    doneBadge.appendChild(doneText);
    meta.appendChild(doneBadge);
  }

  content.appendChild(textSpan);
  content.appendChild(meta);

  /* ── .task-actions ── */
  const actions = document.createElement('div');
  actions.className = 'task-actions';

  /* Edit button – only for non-completed tasks */
  if (!isCompleted) {
    const editBtn = document.createElement('button');
    editBtn.className = 'task-btn task-btn--edit';
    editBtn.setAttribute('aria-label', 'Edit task: ' + task.text);
    editBtn.title = 'Edit';
    editBtn.innerHTML = editSVG();
    editBtn.dataset.action = 'edit';
    editBtn.dataset.taskId = task.id;
    actions.appendChild(editBtn);
  }

  /* Delete button */
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'task-btn task-btn--delete';
  deleteBtn.setAttribute('aria-label', 'Delete task: ' + task.text);
  deleteBtn.title = 'Delete';
  deleteBtn.innerHTML = deleteSVG();
  deleteBtn.dataset.action = 'delete';
  deleteBtn.dataset.taskId = task.id;
  actions.appendChild(deleteBtn);

  /* ── Assemble ── */
  row.appendChild(checkbox);
  row.appendChild(content);
  row.appendChild(actions);
  li.appendChild(row);

  return li;
}

/* ============================================================
   FILTERING & SORTING
   ============================================================ */

/**
 * Returns a filtered + sorted copy of `tasks` according to the
 * current filter, sort, and search query.
 * @returns {Array<Object>}
 */
function getVisibleTasks() {
  let visible = tasks.slice(); // shallow copy – never mutate original

  /* 1. Filter by status tab.
     "pending" means "not yet completed" – covers status==='active' and
     any legacy status==='pending' items loaded from storage.
     "active" / "completed" match their status field exactly.          */
  if (currentFilter === 'pending') {
    visible = visible.filter(t => t.status !== 'completed');
  } else if (currentFilter !== 'all') {
    visible = visible.filter(t => t.status === currentFilter);
  }

  /* 2. Filter by search query */
  if (searchQuery.length > 0) {
    visible = visible.filter(t =>
      t.text.toLowerCase().includes(searchQuery) ||
      (CATEGORY_LABELS[t.category] || '').toLowerCase().includes(searchQuery) ||
      (PRIORITY_CONFIG[t.priority]?.label || '').toLowerCase().includes(searchQuery)
    );
  }

  /* 3. Sort */
  visible.sort((a, b) => {
    switch (currentSort) {
      case 'oldest':
        return a.createdAt - b.createdAt;
      case 'priority':
        return (PRIORITY_CONFIG[a.priority]?.rank ?? 99) -
               (PRIORITY_CONFIG[b.priority]?.rank ?? 99);
      case 'name':
        return a.text.localeCompare(b.text, undefined, { sensitivity: 'base' });
      case 'newest':
      default:
        return b.createdAt - a.createdAt;
    }
  });

  return visible;
}

/* ============================================================
   STATS & PROGRESS BAR
   ============================================================ */

/** Re-computes and paints stat counters, progress bar, and footer count. */
function updateStats() {
  const total     = tasks.length;
  const completed = tasks.filter(t => t.status === 'completed').length;
  const active    = tasks.filter(t => t.status === 'active').length;
  // "Pending" = every task that hasn't been completed yet (active + any
  // legacy 'pending'-status items).  This makes the counter meaningful
  // because addTask() always creates tasks with status:'active'.
  const pending   = total - completed;
  const remaining = pending;

  DOM.countTotal.textContent     = total;
  DOM.countActive.textContent    = active;
  DOM.countPending.textContent   = pending;
  DOM.countCompleted.textContent = completed;

  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  DOM.progressFill.style.width     = pct + '%';
  DOM.progressPercent.textContent  = pct + '%';
  DOM.progressTrack.setAttribute('aria-valuenow', String(pct));

  DOM.remainingCount.textContent = remaining;

  // ── Clear Completed button ──────────────────────────────────────────
  // Disable when there are no completed tasks to clear (Bug #6 fix).
  const hasDone = completed > 0;
  DOM.clearCompletedBtn.disabled = !hasDone;
  if (hasDone) {
    DOM.clearCompletedBtn.removeAttribute('aria-disabled');
    DOM.clearCompletedBtn.title = 'Clear all completed tasks';
  } else {
    DOM.clearCompletedBtn.setAttribute('aria-disabled', 'true');
    DOM.clearCompletedBtn.title = 'No completed tasks to clear';
  }

  // ── Mark All Done button ────────────────────────────────────────────
  // Disable when there are no tasks at all, or every task is already done
  // (Bug #7 fix).
  const allDone = total > 0 && completed === total;
  DOM.markAllBtn.disabled = allDone || total === 0;
  if (allDone || total === 0) {
    DOM.markAllBtn.setAttribute('aria-disabled', 'true');
    DOM.markAllBtn.title = total === 0 ? 'No tasks to mark done' : 'All tasks are already done';
  } else {
    DOM.markAllBtn.removeAttribute('aria-disabled');
    DOM.markAllBtn.title = '';
  }
}

/* ============================================================
   EMPTY STATE
   ============================================================ */

/**
 * Shows or hides the empty state panel and sets its text to match
 * whether there are no tasks at all, or no tasks matching the current filter.
 * @param {number} visibleCount – number of tasks currently shown
 */
function updateEmptyState(visibleCount) {
  if (visibleCount === 0) {
    DOM.emptyState.style.display = 'flex';

    if (tasks.length === 0) {
      // Truly empty list
      DOM.emptyTitle.textContent    = 'No tasks yet';
      DOM.emptySubtitle.textContent = 'Add your first task above to get started on your productivity journey.';

    } else if (searchQuery.length > 0) {
      // Search matched nothing
      DOM.emptyTitle.textContent    = 'No results found';
      DOM.emptySubtitle.textContent =
        'No tasks match \u201C' + searchQuery + '\u201D. Try a different keyword.';

    } else if (currentFilter === 'completed') {
      // Filter: completed — nothing done yet
      DOM.emptyTitle.textContent    = 'No completed tasks';
      DOM.emptySubtitle.textContent = 'Tick a task\u2019s checkbox to mark it complete.';

    } else if (currentFilter === 'pending') {
      // Filter: pending — everything is done
      DOM.emptyTitle.textContent    = 'All tasks complete \uD83C\uDF89';
      DOM.emptySubtitle.textContent = 'Great work! Add new tasks or review your completed ones.';

    } else if (currentFilter === 'active') {
      // Filter: active — no in-progress tasks
      DOM.emptyTitle.textContent    = 'No active tasks';
      DOM.emptySubtitle.textContent = 'Add a task above, or switch to the All filter to see everything.';

    } else {
      // Catch-all
      DOM.emptyTitle.textContent    = 'Nothing here';
      DOM.emptySubtitle.textContent = 'Switch filter or add a new task above.';
    }

  } else {
    DOM.emptyState.style.display = 'none';
  }
}

/* ============================================================
   RENDER
   Full re-draw of the task list from the current state.
   Uses a DocumentFragment for minimal reflow.
   ============================================================ */

/** Re-renders the task list, stats, and empty state. */
function render() {
  const visible = getVisibleTasks();

  // Build all task elements in a fragment first.
  const fragment = document.createDocumentFragment();
  visible.forEach(task => fragment.appendChild(buildTaskEl(task)));

  // Swap in the new content (one DOM write).
  DOM.taskList.innerHTML = '';
  DOM.taskList.appendChild(fragment);

  updateStats();
  updateEmptyState(visible.length);
}

/* ============================================================
   TASK OPERATIONS
   All helpers return the updated tasks array and call render().
   ============================================================ */

/**
 * Validates and adds a new task.
 * @param {string} rawText – value from the task input field
 */
function addTask(rawText) {
  const text = typeof rawText === 'string' ? rawText.trim() : '';

  if (text.length === 0) {
    showError('Please enter a task description.');
    DOM.taskInput.focus();
    return;
  }
  if (text.length > 200) {
    showError('Task description is too long (200 characters maximum).');
    DOM.taskInput.focus();
    return;
  }

  hideError();

  const priority = DOM.prioritySelect.value || 'medium';
  const category = DOM.categorySelect.value || 'general';
  const dueDate  = DOM.dueDateInput.value   || '';

  /** @type {Object} */
  const newTask = {
    id:        generateId(),
    text:      text,
    status:    'active',
    priority:  priority,
    category:  category,
    dueDate:   dueDate,
    createdAt: Date.now(),
  };

  tasks.unshift(newTask); // newest first in state
  saveTasks();             // persist immediately after mutation

  // Reset inputs
  DOM.taskInput.value      = '';
  DOM.prioritySelect.value = 'medium';
  DOM.categorySelect.value = 'general';
  DOM.dueDateInput.value   = '';
  DOM.taskInput.focus();

  render();
}

/**
 * Toggles a task between completed and its previous non-completed status.
 * Completed → active. Non-completed → completed.
 * @param {string} taskId
 */
function toggleTask(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  task.status = task.status === 'completed' ? 'active' : 'completed';
  saveTasks(); // persist immediately after mutation
  render();
}

/**
 * Permanently removes a task from state.
 * @param {string} taskId
 */
function deleteTask(taskId) {
  const idx = tasks.findIndex(t => t.id === taskId);
  if (idx === -1) return;

  tasks.splice(idx, 1);
  saveTasks(); // persist immediately after mutation
  render();
}

/**
 * Opens the edit modal pre-populated with the given task's data.
 * @param {string} taskId
 */
function openEditModal(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  editingTaskId = taskId;

  DOM.editTaskInput.value  = task.text;
  DOM.editPriority.value   = task.priority;
  DOM.editCategory.value   = task.category;
  DOM.editDueDate.value    = task.dueDate || '';

  DOM.editModal.style.display = 'flex';
  DOM.editModal.setAttribute('aria-hidden', 'false');
  // Move focus into modal for accessibility.
  DOM.editTaskInput.focus();
}

/** Closes the edit modal and clears editing state. */
function closeEditModal() {
  DOM.editModal.style.display = 'none';
  DOM.editModal.setAttribute('aria-hidden', 'true');
  editingTaskId = null;
}

/**
 * Saves the changes made in the edit modal back to state.
 */
function saveEdit() {
  if (!editingTaskId) return;

  const task = tasks.find(t => t.id === editingTaskId);
  if (!task) {
    closeEditModal();
    return;
  }

  const newText = DOM.editTaskInput.value.trim();
  if (newText.length === 0) {
    DOM.editTaskInput.focus();
    return;
  }

  task.text     = newText;
  task.priority = DOM.editPriority.value  || task.priority;
  task.category = DOM.editCategory.value  || task.category;
  task.dueDate  = DOM.editDueDate.value   || '';

  saveTasks(); // persist immediately after mutation
  closeEditModal();
  render();
}

/**
 * Marks all non-completed tasks as completed.
 */
function markAllDone() {
  tasks.forEach(t => {
    if (t.status !== 'completed') t.status = 'completed';
  });
  saveTasks(); // persist immediately after mutation
  render();
}

/**
 * Removes all tasks that are currently in completed status.
 */
function clearCompleted() {
  tasks = tasks.filter(t => t.status !== 'completed');
  saveTasks(); // persist immediately after mutation
  render();
}

/* ============================================================
   CURRENT DATE DISPLAY
   ============================================================ */

/**
 * Writes today's date into the #current-date-display <time> element.
 * Sets the machine-readable `datetime` attribute (YYYY-MM-DD) and fills
 * the element with a short, human-readable label (e.g. "Wed, 29 Oct 2026").
 * Safe to call repeatedly; only textContent changes.
 */
function displayCurrentDate() {
  if (!DOM.currentDateEl) return;

  const now = new Date();

  // Machine-readable ISO date for the <time datetime="..."> attribute
  const iso =
    now.getFullYear() + '-' +
    String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0');

  // Human-readable label, e.g. "Wed, 29 Oct 2026"
  const label = now.toLocaleDateString('en-US', {
    weekday: 'short',
    day:     'numeric',
    month:   'short',
    year:    'numeric',
  });

  DOM.currentDateEl.setAttribute('datetime', iso);
  DOM.currentDateEl.textContent = label;
}

/* ============================================================
   FILTER TAB HELPERS
   ============================================================ */

/**
 * Activates the given filter and de-activates the others.
 * @param {string} filter – "all" | "active" | "pending" | "completed"
 */
function setFilter(filter) {
  currentFilter = filter;

  const tabMap = {
    all:       DOM.filterAll,
    active:    DOM.filterActive,
    pending:   DOM.filterPending,
    completed: DOM.filterCompleted,
  };

  Object.entries(tabMap).forEach(([key, btn]) => {
    const isActive = key === filter;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', String(isActive));
  });

  render();
}

/* ============================================================
   EVENT LISTENERS
   All wired once, here. No inline handlers in buildTaskEl().
   ============================================================ */

function initEventListeners() {

  /* ── Add task button ── */
  DOM.addTaskBtn.addEventListener('click', function () {
    addTask(DOM.taskInput.value);
  });

  /* ── Enter key in task input ── */
  DOM.taskInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTask(DOM.taskInput.value);
    }
  });

  /* ── Hide error when user starts typing ── */
  DOM.taskInput.addEventListener('input', function () {
    if (DOM.taskInput.value.trim().length > 0) {
      hideError();
    }
  });

  /* ── Task list: delegated click handler (toggle / edit / delete) ──
     A single listener on the <ul> handles all task interactions.
     We read data-action and data-task-id from the closest matching button.
  */
  DOM.taskList.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    const taskId = btn.dataset.taskId;
    if (!taskId) return;

    switch (action) {
      case 'toggle': toggleTask(taskId);      break;
      case 'delete': deleteTask(taskId);      break;
      case 'edit':   openEditModal(taskId);   break;
    }
  });

  /* ── Filter tabs ── */
  DOM.filterAll.addEventListener('click',       () => setFilter('all'));
  DOM.filterActive.addEventListener('click',    () => setFilter('active'));
  DOM.filterPending.addEventListener('click',   () => setFilter('pending'));
  DOM.filterCompleted.addEventListener('click', () => setFilter('completed'));

  /* ── Search ── */
  DOM.searchInput.addEventListener('input', function () {
    searchQuery = this.value.trim().toLowerCase();
    render();
  });

  /* ── Sort ── */
  DOM.sortSelect.addEventListener('change', function () {
    currentSort = this.value;
    render();
  });

  /* ── Mark all done ── */
  DOM.markAllBtn.addEventListener('click', markAllDone);

  /* ── Clear completed ── */
  DOM.clearCompletedBtn.addEventListener('click', clearCompleted);

  /* ── Edit modal: save ── */
  DOM.modalSaveBtn.addEventListener('click', saveEdit);

  /* ── Edit modal: cancel / close buttons ── */
  DOM.modalCancelBtn.addEventListener('click', closeEditModal);
  DOM.modalCloseBtn.addEventListener('click',  closeEditModal);

  /* ── Edit modal: Enter key in textarea saves ── */
  DOM.editTaskInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      saveEdit();
    }
  });

  /* ── Edit modal: click on overlay backdrop (outside card) closes ── */
  DOM.editModal.addEventListener('click', function (e) {
    if (e.target === DOM.editModal) closeEditModal();
  });

  /* ── Edit modal: Escape key closes ── */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && DOM.editModal.style.display === 'flex') {
      closeEditModal();
    }
  });
}

/* ============================================================
   INITIALISATION
   Remove the static HTML example tasks, then start fresh.
   ============================================================ */

function init() {
  // Remove the static placeholder <li> items that were in the HTML.
  // They exist purely as design/CSS demos; JS takes over from here.
  DOM.taskList.innerHTML = '';

  // Set footer year dynamically.
  if (DOM.footerYear) {
    DOM.footerYear.textContent = new Date().getFullYear();
  }

  // Paint today's date in the header badge (Bug #1-3 fix).
  displayCurrentDate();

  // ── Restore persisted tasks ──────────────────────────────────────────
  // loadTasks() reads localStorage, validates every field, and returns a
  // clean array. If nothing is stored yet it returns [] without error.
  tasks = loadTasks();
  // ─────────────────────────────────────────────────────────────────────

  // Wire up all event listeners exactly once.
  initEventListeners();

  // Render with restored data (or empty state on first visit).
  render();
}

// Run after the DOM is fully parsed.
// Because script.js is loaded at the end of <body>, the DOM is already
// ready – but we guard with DOMContentLoaded as a safety net.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

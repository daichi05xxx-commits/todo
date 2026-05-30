"use strict";

// ── localStorage ───────────────────────────────────────
const DB = {
    load() {
        try { return JSON.parse(localStorage.getItem("todos") || "[]"); }
        catch { return []; }
    },
    save(todos) { localStorage.setItem("todos", JSON.stringify(todos)); },
    add(todo) {
        const list = this.load();
        list.unshift(todo);
        this.save(list);
    },
    update(id, patch) {
        const list = this.load();
        const i = list.findIndex(t => t.id === id);
        if (i < 0) return null;
        list[i] = { ...list[i], ...patch, updated_at: new Date().toISOString() };
        this.save(list);
        return list[i];
    },
    remove(id) { this.save(this.load().filter(t => t.id !== id)); },
    clearCompleted() { this.save(this.load().filter(t => !t.completed)); },
};

function genId() {
    return crypto.randomUUID
        ? crypto.randomUUID()
        : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0;
            return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
        });
}

// ── State ──────────────────────────────────────────────
let todos = [];
let currentFilter = "all";
let editingId = null;

// ── DOM ────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const inputTitle    = $("inputTitle");
const inputDesc     = $("inputDesc");
const inputPriority = $("inputPriority");
const inputDate     = $("inputDate");
const inputCategory = $("inputCategory");
const addDetails    = $("addDetails");
const btnAdd        = $("btnAdd");
const statsText     = $("statsText");
const btnClear      = $("btnClearCompleted");
const todoList      = $("todoList");
const emptyState    = $("emptyState");
const emptyIcon     = $("emptyIcon");
const emptyText     = $("emptyText");
const overlay       = $("overlay");
const editTitle     = $("editTitle");
const editDesc      = $("editDesc");
const editPriority  = $("editPriority");
const editDate      = $("editDate");
const editCategory  = $("editCategory");
const themeToggle   = $("themeToggle");

// ── Theme ──────────────────────────────────────────────
(function initTheme() {
    const saved = localStorage.getItem("theme") || "light";
    if (saved === "dark") {
        document.documentElement.setAttribute("data-theme", "dark");
        themeToggle.textContent = "☀️";
    }
})();

themeToggle.addEventListener("click", () => {
    const dark = document.documentElement.getAttribute("data-theme") === "dark";
    if (dark) {
        document.documentElement.removeAttribute("data-theme");
        themeToggle.textContent = "🌙";
        localStorage.setItem("theme", "light");
    } else {
        document.documentElement.setAttribute("data-theme", "dark");
        themeToggle.textContent = "☀️";
        localStorage.setItem("theme", "dark");
    }
});

// ── Helpers ────────────────────────────────────────────
function esc(s) {
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function formatDate(ds) {
    if (!ds) return null;
    const d = new Date(ds + "T00:00:00");
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const diff = Math.round((d - now) / 86400000);
    if (diff < 0)   return { label: `📅 ${ds}（期限切れ）`, overdue: true };
    if (diff === 0) return { label: "📅 今日", overdue: false };
    if (diff === 1) return { label: "📅 明日", overdue: false };
    return { label: `📅 ${ds}`, overdue: false };
}

const PRIORITY_LABEL = { high: "高", medium: "中", low: "低" };

// ── Render ─────────────────────────────────────────────
function filtered() {
    if (currentFilter === "active")    return todos.filter(t => !t.completed);
    if (currentFilter === "completed") return todos.filter(t =>  t.completed);
    return todos;
}

function render() {
    const list          = filtered();
    const activeCount   = todos.filter(t => !t.completed).length;
    const completedCount = todos.filter(t => t.completed).length;

    statsText.textContent   = `${activeCount} 件未完了`;
    btnClear.style.display  = completedCount > 0 ? "inline" : "none";
    todoList.innerHTML      = "";

    if (list.length === 0) {
        emptyState.style.display = "block";
        if (currentFilter === "active") {
            emptyIcon.textContent = "✅";
            emptyText.textContent = "未完了のタスクはありません";
        } else if (currentFilter === "completed") {
            emptyIcon.textContent = "📋";
            emptyText.textContent = "完了済みのタスクはありません";
        } else {
            emptyIcon.textContent = "📋";
            emptyText.textContent = "タスクがありません。上に追加してみましょう！";
        }
        return;
    }

    emptyState.style.display = "none";
    const frag = document.createDocumentFragment();
    list.forEach(t => frag.appendChild(buildCard(t)));
    todoList.appendChild(frag);
}

function buildCard(todo) {
    const div = document.createElement("div");
    div.className = `todo-item${todo.completed ? " completed" : ""}`;
    div.dataset.id       = todo.id;
    div.dataset.priority = todo.priority;

    const dateInfo = formatDate(todo.due_date);
    const datePart = dateInfo
        ? `<span class="tag${dateInfo.overdue ? " overdue" : ""}">${esc(dateInfo.label)}</span>` : "";
    const catPart = todo.category
        ? `<span class="tag">🏷 ${esc(todo.category)}</span>` : "";
    const metaHtml = [
        `<span class="badge badge-${todo.priority}">${PRIORITY_LABEL[todo.priority] || todo.priority}</span>`,
        catPart, datePart,
    ].filter(Boolean).join("");

    div.innerHTML = `
        <div class="check-ring" data-action="toggle">
            <span class="check-mark">✓</span>
        </div>
        <div class="todo-body">
            <div class="todo-title">${esc(todo.title)}</div>
            ${todo.description ? `<div class="todo-desc">${esc(todo.description)}</div>` : ""}
            <div class="todo-meta">${metaHtml}</div>
        </div>
        <div class="todo-actions">
            <button class="icon-btn"     data-action="edit"   title="編集">✏️</button>
            <button class="icon-btn del" data-action="delete" title="削除">🗑</button>
        </div>`;
    return div;
}

// ── Event delegation ───────────────────────────────────
todoList.addEventListener("click", e => {
    const btn  = e.target.closest("[data-action]");
    if (!btn) return;
    const card = btn.closest("[data-id]");
    if (!card) return;
    const id     = card.dataset.id;
    const action = btn.dataset.action;

    if (action === "toggle") {
        const completed = card.classList.contains("completed");
        DB.update(id, { completed: !completed });
        load();
    } else if (action === "edit") {
        openEdit(id);
    } else if (action === "delete") {
        card.style.transition = "opacity .2s";
        card.style.opacity = "0";
        setTimeout(() => { DB.remove(id); load(); }, 180);
    }
});

// ── Load ───────────────────────────────────────────────
function load() {
    todos = DB.load();
    render();
}

// ── Add ────────────────────────────────────────────────
inputTitle.addEventListener("focus", () => addDetails.classList.add("open"));

btnAdd.addEventListener("click", addTodo);
inputTitle.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addTodo(); }
});

function addTodo() {
    const title = inputTitle.value.trim();
    if (!title) {
        inputTitle.style.color = "var(--danger)";
        inputTitle.focus();
        setTimeout(() => inputTitle.style.color = "", 1200);
        return;
    }
    DB.add({
        id: genId(),
        title,
        description: inputDesc.value.trim(),
        completed: false,
        priority: inputPriority.value,
        category: inputCategory.value.trim(),
        due_date: inputDate.value,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    });
    inputTitle.value = inputDesc.value = inputDate.value = inputCategory.value = "";
    inputPriority.value = "medium";
    addDetails.classList.remove("open");
    inputTitle.focus();
    load();
}

// ── Clear completed ────────────────────────────────────
btnClear.addEventListener("click", () => {
    if (!confirm("完了済みのタスクをすべて削除しますか？")) return;
    DB.clearCompleted();
    load();
});

// ── Filters ───────────────────────────────────────────
$("filters").addEventListener("click", e => {
    const btn = e.target.closest(".f-btn");
    if (!btn) return;
    document.querySelectorAll(".f-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentFilter = btn.dataset.filter;
    render();
});

// ── Edit modal ─────────────────────────────────────────
function openEdit(id) {
    const t = todos.find(x => x.id === id);
    if (!t) return;
    editingId       = id;
    editTitle.value    = t.title;
    editDesc.value     = t.description || "";
    editPriority.value = t.priority;
    editDate.value     = t.due_date || "";
    editCategory.value = t.category || "";
    overlay.style.display = "flex";
    requestAnimationFrame(() => editTitle.focus());
}

function closeModal() {
    overlay.style.display = "none";
    editingId = null;
}

$("modalClose").addEventListener("click", closeModal);
$("editCancel").addEventListener("click", closeModal);
overlay.addEventListener("click", e => { if (e.target === overlay) closeModal(); });

$("editSave").addEventListener("click", () => {
    if (!editingId) return;
    const title = editTitle.value.trim();
    if (!title) { editTitle.style.borderColor = "var(--danger)"; editTitle.focus(); return; }
    editTitle.style.borderColor = "";
    DB.update(editingId, {
        title,
        description: editDesc.value.trim(),
        priority: editPriority.value,
        due_date: editDate.value,
        category: editCategory.value.trim(),
    });
    closeModal();
    load();
});

// ── Keyboard shortcuts ─────────────────────────────────
document.addEventListener("keydown", e => {
    if (e.key === "Escape" && overlay.style.display !== "none") { closeModal(); return; }
    if (e.key === "n" && overlay.style.display === "none" &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) {
        e.preventDefault();
        inputTitle.focus();
    }
});

// ── Init ───────────────────────────────────────────────
load();

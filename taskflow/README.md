# TaskFlow — Smart Todo List Application

> **College Assignment Submission**  
> Student: Jaffar Malik

---

## 1. Project Title

**TaskFlow — Smart Todo List Application**

---

## 2. Project Overview

TaskFlow is a fully client-side, browser-based task management application built as part of a college front-end web development assignment. It allows users to create, organise, filter, and track daily tasks entirely within their web browser — no server, no database, and no installation required.

All task data is saved automatically in the browser using the Web Storage API (`localStorage`), so tasks persist across page reloads and browser sessions on the same device.

The application is written in plain HTML, CSS, and JavaScript (no frameworks, no build tools, no external libraries) and can be opened directly in any modern web browser.

---

## 3. Objectives

1. Build a functional task management application using only vanilla HTML, CSS, and JavaScript.
2. Demonstrate client-side data persistence using `localStorage`.
3. Apply responsive web design techniques to support mobile, tablet, and desktop screen sizes.
4. Follow accessibility best practices (keyboard navigation, ARIA attributes, visible focus indicators).
5. Produce clean, well-commented, maintainable code that requires no external dependencies.

---

## 4. Features

| Feature | Description |
|---|---|
| **Add Tasks** | Type a task and press *Add Task* or hit the **Enter** key |
| **Task Priority** | Assign High 🔴, Medium ⚡, or Low 🟢 priority to every task |
| **Task Category** | Organise tasks as General, Work, Personal, Study, or Health |
| **Due Date** | Optional due date shown on each task card |
| **Complete Tasks** | Click the checkbox to mark a task done; click again to undo |
| **Delete Tasks** | Remove any task instantly with the trash-icon button |
| **Edit Tasks** | Edit task text, priority, category, and due date via a modal dialog |
| **Filter Tasks** | Switch between All, Active, Pending, and Completed views |
| **Search** | Live keyword search across task text, category, and priority |
| **Sort** | Sort by Newest, Oldest, Priority, or Name A–Z |
| **Statistics** | Live counters for Total, Active, Pending, and Completed tasks |
| **Progress Bar** | Visual percentage showing how much of the task list is complete |
| **Mark All Done** | Complete every outstanding task with one click |
| **Clear Completed** | Remove all finished tasks at once (button disables when none exist) |
| **Date Display** | Today's date shown in the application header |
| **localStorage** | All tasks automatically saved and restored on page refresh |
| **Responsive Design** | Works on screens from 320 px (small phones) to 1440 px+ (desktops) |
| **Keyboard Accessible** | All interactive controls reachable and operable by keyboard alone |
| **Safe Text Handling** | User input is never injected as HTML — XSS injection is prevented |
| **Storage Error Handling** | If `localStorage` is unavailable, a dismissible warning banner appears |

---

## 5. Technologies Used

| Technology | Purpose |
|---|---|
| **HTML5** | Page structure and semantic markup |
| **CSS3** | Styling, layout (Flexbox + Grid), animations, responsive breakpoints |
| **Vanilla JavaScript (ES6+)** | All application logic — no frameworks or libraries |
| **Web Storage API (`localStorage`)** | Client-side persistence of task data |
| **Google Fonts** | Typography — *Plus Jakarta Sans* and *JetBrains Mono* (loaded via CDN) |

**No frameworks, no Node.js, no build step, no npm packages.**

---

## 6. Project Folder Structure

```
taskflow/
│
├── index.html      ← Application shell: all HTML markup and structure
├── style.css       ← Complete design system: colours, layout, animations
├── script.js       ← All JavaScript logic: tasks, filters, storage, UI
└── README.md       ← This documentation file
```

All four files are **required**. The application will not work if any of them is missing or renamed.

---

## 7. Running the Project Locally

### Method A — Open directly in a browser (simplest)

1. Navigate to the `taskflow` folder on your computer.
2. Double-click **`index.html`**.
3. The application opens in your default browser.

> ⚠️ **Important:** Google Chrome and Microsoft Edge fully support `localStorage` when opening files directly (`file://`). Firefox may restrict it in some privacy modes. If tasks are not being saved, try Method B.

---

### Method B — VS Code Live Server (recommended for development)

1. Install [Visual Studio Code](https://code.visualstudio.com/).
2. Open the `taskflow` folder in VS Code (`File → Open Folder`).
3. Install the **Live Server** extension (by Ritwick Dey) from the Extensions panel.
4. Right-click `index.html` in the file tree and choose **Open with Live Server**.
5. The app opens at `http://127.0.0.1:5500/` (or similar).

---

### Method C — Python built-in HTTP server

Open a terminal in the `taskflow` folder and run:

```bash
# Python 3
python -m http.server 8080
```

Then open `http://localhost:8080` in your browser.

---

## 8. How localStorage Works in This Application

`localStorage` is a browser built-in feature that lets a website save small amounts of text data on the user's own device. The data stays available even after the browser tab is closed and the page is refreshed.

### How TaskFlow uses it

| Action | What happens |
|---|---|
| Add a task | Task is added to the in-memory array, then the entire array is serialised to JSON and written to `localStorage` |
| Complete / delete / edit a task | Same: state is updated in memory, then immediately saved to `localStorage` |
| Page loads / refreshes | `localStorage` is read, the JSON is parsed and validated, and tasks are restored to the application |
| Storage unavailable | An amber warning banner is shown — the app still works, but changes are not saved |

### The storage key

All tasks are stored under a single key:

```
localStorage["taskflow_tasks"] = "[{...}, {...}]"
```

The value is a JSON array of task objects. You can inspect it in any browser's Developer Tools under **Application → Local Storage**.

### Validation on load

When the app reads from `localStorage`, it validates every field of every task object. Corrupt data, unexpected data types, or missing required fields are handled gracefully — the app never crashes.

### Limitations of localStorage

- Data is stored **per browser, per device**. Tasks added in Chrome are not visible in Firefox on the same computer.
- The typical storage limit is **5 MB per origin** (per website / file path). For a todo list this limit will never be reached.
- `localStorage` is **not available in private / incognito mode** in some browsers (especially Firefox). In that case, the application shows a storage warning banner and tasks will not persist.
- `localStorage` is **not a database**. Data is not backed up, not synced across devices, and not encrypted.

---

## 9. Responsive Design Details

TaskFlow is designed to look and function correctly on every common screen size.

| Screen size | Width range | Layout behaviour |
|---|---|---|
| **Desktop** | > 768 px | Full dashboard layout; all four stat cards in a single row; date badge visible |
| **Tablet** | 481 px – 768 px | Slightly reduced padding and font sizes; layout still comfortable |
| **Mobile** | 321 px – 480 px | Filter tabs scrollable; "Clear Done" text hidden (icon only); stat cards in 2×2 grid; date badge hidden to save space |
| **Small phone** | ≤ 360 px | Stats wrap into a 2-column grid; filter tabs wrap to two rows |

### Techniques used

- `CSS Flexbox` for the header, input row, filter bar, and task rows.
- `CSS Grid` for the statistics cards.
- `@media` queries at 768 px, 480 px, and 360 px breakpoints.
- `min-width: 0` on flex children to prevent overflow on narrow screens.
- `overflow-x: hidden` on `body` to prevent horizontal scrolling.
- `max-width: 860px; margin: 0 auto` to centre the dashboard on large screens.

---

## 10. Deploying on GitHub Pages

GitHub Pages is a free hosting service that serves static HTML/CSS/JS files directly from a GitHub repository.

### Step-by-step instructions

**Step 1 — Create a GitHub account**  
Sign up at [github.com](https://github.com) if you do not have an account.

**Step 2 — Create a new repository**  
1. Click the **+** icon → **New repository**.  
2. Give it a name, e.g. `taskflow`.  
3. Set visibility to **Public**.  
4. Click **Create repository**.

**Step 3 — Upload the project files**  
Option A (GitHub website):  
1. On the repository page, click **Add file → Upload files**.  
2. Drag and drop all four files: `index.html`, `style.css`, `script.js`, `README.md`.  
3. Click **Commit changes**.

Option B (Git command line):
```bash
git init
git add index.html style.css script.js README.md
git commit -m "Initial commit: TaskFlow todo list"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/taskflow.git
git push -u origin main
```

**Step 4 — Enable GitHub Pages**  
1. In your repository, go to **Settings → Pages**.  
2. Under **Source**, select branch **`main`** and folder **`/ (root)`**.  
3. Click **Save**.  
4. Wait 1–2 minutes for GitHub Pages to build.

**Step 5 — Get your live URL**  
Refresh the Settings → Pages screen. GitHub will display a green banner with your public URL.

---

## 11. Expected Public Website URL Format

Once deployed, your site will be accessible at:

```
https://<your-github-username>.github.io/<repository-name>/
```

**Examples:**

| GitHub username | Repository name | Public URL |
|---|---|---|
| `jaffarmalik` | `taskflow` | `https://jaffarmalik.github.io/taskflow/` |
| `jaffarmalik` | `portfolio` (files in `taskflow/` subfolder) | `https://jaffarmalik.github.io/portfolio/taskflow/` |

> ⚠️ **Note:** This README does not claim the site is currently published. The URL above is a template only. Replace `<your-github-username>` and `<repository-name>` with your actual values once you have completed the deployment steps above.

---

## 12. Limitations

| Limitation | Detail |
|---|---|
| **Data is device-specific** | Tasks saved in one browser on one device are not available in another browser or on another device |
| **Private / incognito mode** | Firefox blocks `localStorage` in private mode; the app works but tasks are not saved between sessions |
| **Storage quota** | Browsers typically limit `localStorage` to ~5 MB per origin; this is not a practical limit for a todo list |
| **No user accounts** | There is no login system; anyone with access to the browser profile can see the tasks |
| **No cloud sync** | Tasks are stored locally only; clearing browser data or using a different browser removes them |
| **No offline-first PWA** | The application requires an internet connection only to load Google Fonts; all functionality otherwise works offline |
| **No multi-user support** | The application is single-user by design |
| **Google Fonts CDN** | The custom font (*Plus Jakarta Sans*) requires an internet connection. If offline, the browser falls back to the system sans-serif font — the app still works |
| **Browser support** | Requires a modern browser (Chrome 88+, Firefox 85+, Edge 88+, Safari 14+). Internet Explorer is not supported |

---

## File Verification Checklist

Before submission, confirm that all four project files are present:

| File | Purpose | Status |
|---|---|---|
| `index.html` | Application markup | ✅ Present |
| `style.css` | All styling | ✅ Present |
| `script.js` | All JavaScript logic | ✅ Present |
| `README.md` | This documentation | ✅ Present |

---

## Final Submission Checklist (for GUVI / College Portal)

Follow these steps before you submit the public website link to your college or GUVI assignment portal:

- [ ] **1.** All four files (`index.html`, `style.css`, `script.js`, `README.md`) are uploaded to your GitHub repository.
- [ ] **2.** GitHub Pages is enabled on the repository (**Settings → Pages → Source: main / root**).
- [ ] **3.** You have waited 1–2 minutes after enabling GitHub Pages.
- [ ] **4.** You have opened the public URL (e.g. `https://jaffarmalik.github.io/taskflow/`) in a browser and confirmed:
  - The page loads without errors.
  - You can add, complete, and delete a task.
  - Stats update correctly.
  - Refreshing the page keeps the task (localStorage works).
- [ ] **5.** Copy the public URL exactly as shown in **Settings → Pages** (no trailing slash issues).
- [ ] **6.** Paste the URL into the GUVI / college assignment submission field.
- [ ] **7.** Submit. Keep the repository **Public** — a private repository cannot be viewed by evaluators.

---

*Built with HTML · CSS · JavaScript — no frameworks, no build step.*  
*Jaffar Malik · © 2026*

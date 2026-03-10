import type { PatternLibraryStorage, PatternSnapshot, PatternData } from '../state/pattern-library-storage';
import { eventBus } from '../utils/event-bus';
import { showToast } from './toast';

function clearChildren(el: HTMLElement): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export class PatternLibrary {
  private overlay: HTMLElement;
  private listContainer: HTMLElement;
  private nameInput: HTMLInputElement;
  private visible = false;

  constructor(
    parent: HTMLElement,
    private storage: PatternLibraryStorage,
    private captureSnapshot: () => PatternData,
    private loadSnapshot: (data: PatternData) => void,
  ) {
    this.overlay = document.createElement('div');
    this.overlay.className = 'pattern-library-overlay';

    const modal = document.createElement('div');
    modal.className = 'pattern-library-modal';

    // Title bar
    const titleBar = document.createElement('div');
    titleBar.className = 'pattern-library-title-bar';

    const title = document.createElement('h2');
    title.className = 'pattern-library-title';
    title.textContent = 'Pattern Library';
    titleBar.appendChild(title);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'pattern-library-close';
    closeBtn.textContent = '\u00d7';
    closeBtn.addEventListener('click', () => this.hide());
    titleBar.appendChild(closeBtn);

    modal.appendChild(titleBar);

    // Save section
    const saveRow = document.createElement('div');
    saveRow.className = 'pattern-library-save-row';

    this.nameInput = document.createElement('input');
    this.nameInput.className = 'pattern-library-name-input';
    this.nameInput.type = 'text';
    this.nameInput.placeholder = 'Pattern name...';
    this.nameInput.maxLength = 50;
    saveRow.appendChild(this.nameInput);

    const saveBtn = document.createElement('button');
    saveBtn.className = 'pattern-library-save-btn';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', () => this.savePattern());
    saveRow.appendChild(saveBtn);

    // Import button
    const importBtn = document.createElement('button');
    importBtn.className = 'pattern-library-import-btn';
    importBtn.textContent = 'Import';
    importBtn.addEventListener('click', () => this.importPattern());
    saveRow.appendChild(importBtn);

    modal.appendChild(saveRow);

    // Pattern list
    this.listContainer = document.createElement('div');
    this.listContainer.className = 'pattern-library-list';
    modal.appendChild(this.listContainer);

    this.overlay.appendChild(modal);
    parent.appendChild(this.overlay);

    // Close on backdrop click
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.hide();
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.visible) {
        e.preventDefault();
        this.hide();
      }
    });

    // Enter to save
    this.nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.savePattern();
      }
      e.stopPropagation();
    });
  }

  toggle(): void {
    if (this.visible) this.hide();
    else this.show();
  }

  show(): void {
    this.visible = true;
    this.overlay.classList.add('pattern-library-overlay--visible');
    this.refreshList();
    this.nameInput.focus();
  }

  hide(): void {
    this.visible = false;
    this.overlay.classList.remove('pattern-library-overlay--visible');
  }

  private async savePattern(): Promise<void> {
    const name = this.nameInput.value.trim();
    if (!name) {
      showToast('Enter a pattern name', 'warning');
      return;
    }

    const data = this.captureSnapshot();
    const pattern: PatternSnapshot = {
      id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      createdAt: Date.now(),
      isFactory: false,
      data,
    };

    await this.storage.savePattern(pattern);
    this.nameInput.value = '';
    eventBus.emit('pattern:saved', name);
    showToast(`Pattern saved: ${name}`, 'success');
    this.refreshList();
  }

  private async refreshList(): Promise<void> {
    const patterns = await this.storage.loadAll();
    patterns.sort((a, b) => {
      if (a.isFactory !== b.isFactory) return a.isFactory ? -1 : 1;
      return b.createdAt - a.createdAt;
    });

    clearChildren(this.listContainer);

    if (patterns.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'pattern-library-empty';
      empty.textContent = 'No patterns saved yet';
      this.listContainer.appendChild(empty);
      return;
    }

    for (const pattern of patterns) {
      const item = document.createElement('div');
      item.className = 'pattern-library-item';
      if (pattern.isFactory) item.classList.add('pattern-library-item--factory');

      const info = document.createElement('div');
      info.className = 'pattern-library-item-info';

      const nameEl = document.createElement('span');
      nameEl.className = 'pattern-library-item-name';
      nameEl.textContent = pattern.isFactory ? `\uD83D\uDD12 ${pattern.name}` : pattern.name;
      info.appendChild(nameEl);

      const dateEl = document.createElement('span');
      dateEl.className = 'pattern-library-item-date';
      dateEl.textContent = pattern.isFactory ? 'Factory' : new Date(pattern.createdAt).toLocaleDateString();
      info.appendChild(dateEl);

      item.appendChild(info);

      const actions = document.createElement('div');
      actions.className = 'pattern-library-item-actions';

      const loadBtn = document.createElement('button');
      loadBtn.className = 'pattern-library-action-btn';
      loadBtn.textContent = 'Load';
      loadBtn.addEventListener('click', () => {
        this.loadSnapshot(pattern.data);
        eventBus.emit('pattern:loaded', pattern.name);
        showToast(`Pattern loaded: ${pattern.name}`, 'success');
        this.hide();
      });
      actions.appendChild(loadBtn);

      const exportBtn = document.createElement('button');
      exportBtn.className = 'pattern-library-action-btn';
      exportBtn.textContent = 'Export';
      exportBtn.addEventListener('click', () => this.exportPattern(pattern));
      actions.appendChild(exportBtn);

      if (!pattern.isFactory) {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'pattern-library-action-btn pattern-library-action-btn--danger';
        deleteBtn.textContent = 'Del';
        deleteBtn.addEventListener('click', async () => {
          await this.storage.deletePattern(pattern.id);
          eventBus.emit('pattern:deleted', pattern.name);
          showToast(`Pattern deleted: ${pattern.name}`);
          this.refreshList();
        });
        actions.appendChild(deleteBtn);
      }

      item.appendChild(actions);
      this.listContainer.appendChild(item);
    }
  }

  private exportPattern(pattern: PatternSnapshot): void {
    const json = JSON.stringify(pattern, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${pattern.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Exported: ${pattern.name}`, 'success');
  }

  private importPattern(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const pattern = JSON.parse(text) as PatternSnapshot;
        if (!pattern.data || !pattern.name) {
          showToast('Invalid pattern file', 'warning');
          return;
        }
        // Re-assign ID and mark as user pattern
        pattern.id = `imported-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        pattern.isFactory = false;
        pattern.createdAt = Date.now();
        await this.storage.savePattern(pattern);
        eventBus.emit('pattern:saved', pattern.name);
        showToast(`Imported: ${pattern.name}`, 'success');
        this.refreshList();
      } catch {
        showToast('Failed to import pattern', 'warning');
      }
    });
    input.click();
  }
}

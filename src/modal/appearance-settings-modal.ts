export interface AppearanceSettings {
  darkMode: { backgroundColor: string; textColor: string };
  lightMode: { backgroundColor: string; textColor: string };
  fontFamily: string;
  fontSize: string;
  lineHeight: string;
  flow: 'paginated' | 'scrolled';
  columns: 1 | 2;
  padding: string;
  margin: string;
}

interface ShowModalArgs {
  settings: AppearanceSettings;
  defaultSettings: AppearanceSettings;
  onApply: (updated: AppearanceSettings) => void;
  onReset: () => void;
  onClose?: () => void;
}

export function showAppearanceSettingsModal({ settings, defaultSettings, onApply, onReset, onClose }: ShowModalArgs): void {
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.5); z-index: 2000; display: flex;
    align-items: center; justify-content: center;
  `;

  const content = document.createElement('div');
  content.style.cssText = `
    background: var(--background-primary); border: 1px solid var(--background-modifier-border);
    border-radius: 8px; padding: 20px; max-width: 600px; max-height: 80vh; overflow-y: auto;
    color: var(--text-normal);
  `;

  content.innerHTML = `
    <h3 style="margin: 0 0 20px 0; color: var(--text-normal);">EPUB Viewer Settings</h3>

    <div style="margin-bottom: 20px;">
      <h4 style="margin: 0 0 10px 0; color: var(--text-normal);">Dark Mode</h4>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
        <label style="color: var(--text-normal);">Background Color:</label>
        <input type="color" id="dark-bg" value="${settings.darkMode.backgroundColor}" style="width: 100%;">
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
        <label style="color: var(--text-normal);">Text Color:</label>
        <input type="color" id="dark-text" value="${settings.darkMode.textColor}" style="width: 100%;">
      </div>
    </div>

    <div style="margin-bottom: 20px;">
      <h4 style="margin: 0 0 10px 0; color: var(--text-normal);">Light Mode</h4>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
        <label style="color: var(--text-normal);">Background Color:</label>
        <input type="color" id="light-bg" value="${settings.lightMode.backgroundColor}" style="width: 100%;">
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
        <label style="color: var(--text-normal);">Text Color:</label>
        <input type="color" id="light-text" value="${settings.lightMode.textColor}" style="width: 100%;">
      </div>
    </div>

    <div style="margin-bottom: 20px;">
      <h4 style="margin: 0 0 10px 0; color: var(--text-normal);">Typography</h4>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
        <label style="color: var(--text-normal);">Font Family:</label>
        <input type="text" id="font-family" value="${settings.fontFamily}" placeholder="e.g. Inter, 'SF Pro Text' (Arial fallback is auto)" style="width: 100%; padding: 4px; background: var(--background-secondary); color: var(--text-normal); border: 1px solid var(--background-modifier-border); border-radius: 3px;"/>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
        <label style="color: var(--text-normal);">Font Size:</label>
        <input type="text" id="font-size" value="${settings.fontSize}" style="width: 100%; padding: 4px; background: var(--background-secondary); color: var(--text-normal); border: 1px solid var(--background-modifier-border); border-radius: 3px;">
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
        <label style="color: var(--text-normal);">Line Height:</label>
        <input type="text" id="line-height" value="${settings.lineHeight}" style="width: 100%; padding: 4px; background: var(--background-secondary); color: var(--text-normal); border: 1px solid var(--background-modifier-border); border-radius: 3px;">
      </div>
    </div>

    <div style="margin-bottom: 20px;">
      <h4 style="margin: 0 0 10px 0; color: var(--text-normal);">Layout</h4>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
        <label style="color: var(--text-normal);">Flow Mode:</label>
        <select id="flow-mode" style="width: 100%; padding: 4px; background: var(--background-secondary); color: var(--text-normal); border: 1px solid var(--background-modifier-border); border-radius: 3px;">
          <option value="paginated" ${settings.flow === 'paginated' ? 'selected' : ''}>Paginated</option>
          <option value="scrolled" ${settings.flow === 'scrolled' ? 'selected' : ''}>Scrolled</option>
        </select>
      </div>
      <div id="columns-container" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; ${settings.flow === 'paginated' ? '' : 'display: none;'}">
        <label style="color: var(--text-normal);">Columns:</label>
        <select id="columns" style="width: 100%; padding: 4px; background: var(--background-secondary); color: var(--text-normal); border: 1px solid var(--background-modifier-border); border-radius: 3px;">
          <option value="1" ${settings.columns === 1 ? 'selected' : ''}>1 Column</option>
          <option value="2" ${settings.columns === 2 ? 'selected' : ''}>2 Columns</option>
        </select>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
        <label style="color: var(--text-normal);">Padding:</label>
        <input type="text" id="padding" value="${settings.padding}" style="width: 100%; padding: 4px; background: var(--background-secondary); color: var(--text-normal); border: 1px solid var(--background-modifier-border); border-radius: 3px;">
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
        <label style="color: var(--text-normal);">Margin:</label>
        <input type="text" id="margin" value="${settings.margin}" style="width: 100%; padding: 4px; background: var(--background-secondary); color: var(--text-normal); border: 1px solid var(--background-modifier-border); border-radius: 3px;">
      </div>
    </div>

    <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
      <button id="reset-settings" style="background: var(--interactive-normal); color: var(--text-normal); border: 1px solid var(--background-modifier-border); padding: 8px 16px; border-radius: 4px; cursor: pointer;">Reset to Default</button>
      <button id="apply-settings" style="background: var(--interactive-accent); color: var(--text-on-accent); border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Apply Settings</button>
      <button id="close-settings" style="background: var(--interactive-normal); color: var(--text-normal); border: 1px solid var(--background-modifier-border); padding: 8px 16px; border-radius: 4px; cursor: pointer;">Close</button>
    </div>
  `;

  // Flow change toggles columns input
  const flowSelect = content.querySelector('#flow-mode') as HTMLSelectElement | null;
  const columnsContainer = content.querySelector('#columns-container') as HTMLElement | null;
  flowSelect?.addEventListener('change', () => {
    if (!columnsContainer) return;
    columnsContainer.style.display = flowSelect.value === 'paginated' ? 'grid' : 'none';
    if (flowSelect.value !== 'paginated') {
      const columnsSel = content.querySelector('#columns') as HTMLSelectElement | null;
      if (columnsSel) columnsSel.value = '1';
    }
  });

  // Apply
  content.querySelector('#apply-settings')?.addEventListener('click', () => {
    const next: AppearanceSettings = {
      darkMode: {
        backgroundColor: (content.querySelector('#dark-bg') as HTMLInputElement)?.value || settings.darkMode.backgroundColor,
        textColor: (content.querySelector('#dark-text') as HTMLInputElement)?.value || settings.darkMode.textColor,
      },
      lightMode: {
        backgroundColor: (content.querySelector('#light-bg') as HTMLInputElement)?.value || settings.lightMode.backgroundColor,
        textColor: (content.querySelector('#light-text') as HTMLInputElement)?.value || settings.lightMode.textColor,
      },
      fontFamily: (content.querySelector('#font-family') as HTMLInputElement)?.value ?? settings.fontFamily,
      fontSize: (content.querySelector('#font-size') as HTMLInputElement)?.value || settings.fontSize,
      lineHeight: (content.querySelector('#line-height') as HTMLInputElement)?.value || settings.lineHeight,
      flow: ((content.querySelector('#flow-mode') as HTMLSelectElement)?.value as 'paginated' | 'scrolled') || settings.flow,
      columns: ((content.querySelector('#columns') as HTMLSelectElement)?.value ? parseInt((content.querySelector('#columns') as HTMLSelectElement).value, 10) : settings.columns) as 1 | 2,
      padding: (content.querySelector('#padding') as HTMLInputElement)?.value || settings.padding,
      margin: (content.querySelector('#margin') as HTMLInputElement)?.value || settings.margin,
    };

    onApply(next);
    modal.remove();
  });

  // Reset
  content.querySelector('#reset-settings')?.addEventListener('click', () => {
    onReset();
    modal.remove();
  });

  // Close
  content.querySelector('#close-settings')?.addEventListener('click', () => {
    onClose?.();
    modal.remove();
  });

  modal.appendChild(content);
  document.body.appendChild(modal);
}

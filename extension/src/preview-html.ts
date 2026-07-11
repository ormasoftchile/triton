import { themePresetNames } from '../../src/theme/preset.js';

interface PreviewWebview {
  readonly cspSource: string;
}

function nonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < 32; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, '&quot;');
}

function themeOptions(selectedTheme: string): string {
  const normalized = themePresetNames.includes(selectedTheme) ? selectedTheme : '';
  const options = [`<option value=""${normalized === '' ? ' selected' : ''}>Auto</option>`];
  for (const name of themePresetNames) {
    options.push(
      `<option value="${escapeAttr(name)}"${name === normalized ? ' selected' : ''}>${escapeHtml(name)}</option>`,
    );
  }
  return options.join('');
}

export function shellHtml(webview: PreviewWebview, title: string, selectedTheme = ''): string {
  const n = nonce();
  const csp = [
    `default-src 'none'`,
    `img-src ${webview.cspSource} data:`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${n}'`,
  ].join('; ');

  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light dark; }
    html, body { height: 100%; margin: 0; }
    body {
      font-family: var(--vscode-font-family, sans-serif);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      overflow: hidden;
    }
    #stage {
      position: absolute; inset: 0;
      display: flex; align-items: center; justify-content: center;
      overflow: auto; padding: 16px; box-sizing: border-box;
    }
    #stage.fit { padding: 0; }
    #content svg { display: block; height: auto; max-width: none; }
    #stage.fit #content svg { max-width: 100%; max-height: 100%; }
    /* Document mode: stacked Markdown blocks flow top-to-bottom and scroll,
       instead of being flex-centered (which collapses multiple responsive SVGs
       on top of each other). The inline per-SVG styles handle fit + centering. */
    body.doc-mode #stage { display: block; }
    body.doc-mode #fit, body.doc-mode #reset { display: none; }
    #error {
      position: absolute; left: 0; right: 0; bottom: 0;
      margin: 0; padding: 10px 14px;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 12px; white-space: pre-wrap;
      color: var(--vscode-inputValidation-errorForeground, #fff);
      background: var(--vscode-inputValidation-errorBackground, #5a1d1d);
      border-top: 1px solid var(--vscode-inputValidation-errorBorder, #be1100);
      display: none;
    }
    #error.show { display: block; }
    #toolbar {
      position: absolute; top: 8px; right: 8px;
      display: flex; align-items: center; gap: 6px; z-index: 10;
      font-size: 11px;
    }
    #toolbar label { opacity: .8; }
    #toolbar select {
      font: inherit;
      color: var(--vscode-dropdown-foreground);
      background: var(--vscode-dropdown-background);
      border: 1px solid var(--vscode-dropdown-border, transparent);
      border-radius: 3px;
      padding: 2px 20px 2px 6px;
    }
    #toolbar button {
      font: inherit; font-size: 11px;
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
      border: none; border-radius: 3px;
      padding: 3px 8px; cursor: pointer;
    }
    #toolbar button:hover { background: var(--vscode-button-hoverBackground); }
  </style>
</head>
<body>
  <div id="toolbar">
    <label for="theme">Theme</label>
    <select id="theme" title="Preview theme">${themeOptions(selectedTheme)}</select>
    <button id="fit" title="Toggle zoom to fit">Fit</button>
    <button id="reset" title="Actual size">1:1</button>
  </div>
  <div id="stage" class="fit"><div id="content"></div></div>
  <pre id="error"></pre>
  <script nonce="${n}">
    const vscodeApi = acquireVsCodeApi();
    const stage = document.getElementById('stage');
    const content = document.getElementById('content');
    const errorBox = document.getElementById('error');
    const themeSelect = document.getElementById('theme');

    document.getElementById('fit').addEventListener('click', () => stage.classList.add('fit'));
    document.getElementById('reset').addEventListener('click', () => stage.classList.remove('fit'));
    themeSelect.addEventListener('change', () => {
      const state = vscodeApi.getState() || {};
      vscodeApi.setState({ ...state, theme: themeSelect.value });
      vscodeApi.postMessage({ type: 'setTheme', name: themeSelect.value });
    });

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg.type === 'svg') {
        const doc = !!msg.doc;
        document.body.classList.toggle('doc-mode', doc);
        stage.classList.toggle('fit', !doc);
        content.innerHTML = msg.svg;
        errorBox.classList.remove('show');
        try { currentAnchors = msg.anchors ? JSON.parse(msg.anchors) : {}; } catch(_) { currentAnchors = {}; }
        vscodeApi.setState({ svg: msg.svg, anchors: msg.anchors, docUri: msg.docUri, doc: doc, theme: themeSelect.value });
        refreshAnchorListeners();
      } else if (msg.type === 'theme') {
        themeSelect.value = msg.name || '';
        const state = vscodeApi.getState() || {};
        vscodeApi.setState({ ...state, theme: themeSelect.value });
      } else if (msg.type === 'error') {
        // Keep the last good SVG visible; show the error as a non-destructive banner.
        errorBox.textContent = msg.message;
        errorBox.classList.add('show');
      }
    });

    const prev = vscodeApi.getState();
    if (prev && prev.svg) {
      document.body.classList.toggle('doc-mode', !!prev.doc);
      stage.classList.toggle('fit', !prev.doc);
      content.innerHTML = prev.svg;
      try { currentAnchors = prev.anchors ? JSON.parse(prev.anchors) : {}; } catch(_) { currentAnchors = {}; }
      refreshAnchorListeners();
    }
    // Tell the extension the webview is loaded and listening, so it can flush a
    // render that was produced before this script attached its listener (the
    // synchronous Markdown path would otherwise race the webview load).
    vscodeApi.postMessage({ type: 'ready' });

    // ─── Node-reference tooltip ───────────────────────────────────────────────
    // Alt+hover over any node in the diagram reveals its crosslink reference
    // string (e.g. "mytree.n0" or bare "n0"). Clicking the tooltip copies it.
    // Anchors arrive as a separate postMessage field (msg.anchors JSON string)
    // so the SVG string is never mutated and remains safe for innerHTML injection.

    let currentAnchors = {};
    let altDown = false;
    let tooltipTimer = null;

    const tooltip = document.createElement('div');
    tooltip.style.cssText =
      'position:fixed;z-index:9999;display:none;padding:6px 10px;border-radius:4px;' +
      'background:rgba(0,0,0,0.85);color:var(--vscode-foreground,#ccc);' +
      'font-family:var(--vscode-editor-font-family,monospace);font-size:12px;' +
      'pointer-events:auto;max-width:300px;cursor:pointer;' +
      'box-shadow:0 2px 8px rgba(0,0,0,0.4);' +
      'border:1px solid rgba(255,255,255,0.12);user-select:none;';
    document.body.appendChild(tooltip);

    function safeHtml(s) {
      return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function hideTooltip() {
      tooltip.style.display = 'none';
      tooltip.dataset.ref = '';
    }

    function showTooltip(manifest, e, svgEl) {
      const ctm = svgEl.getScreenCTM();
      if (!ctm) { hideTooltip(); return; }
      const pt = svgEl.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const sp = pt.matrixTransform(ctm.inverse());

      const hits = Object.keys(manifest).filter(k => {
        const b = manifest[k].bounds;
        return sp.x >= b.x && sp.x <= b.x + b.width && sp.y >= b.y && sp.y <= b.y + b.height;
      }).sort((a, b) => {
        const ba = manifest[a].bounds, bb = manifest[b].bounds;
        return (ba.width * ba.height) - (bb.width * bb.height);
      });

      if (hits.length === 0) { hideTooltip(); return; }
      const ref = hits[0];
      tooltip.innerHTML =
        '<span style="font-weight:600">' + safeHtml(ref) + '</span>' +
        '<br><span style="opacity:.55;font-size:10px">click to copy</span>';
      tooltip.dataset.ref = ref;
      const x = Math.min(e.clientX + 14, window.innerWidth - 240);
      const y = Math.min(e.clientY + 14, window.innerHeight - 56);
      tooltip.style.left = x + 'px';
      tooltip.style.top = y + 'px';
      tooltip.style.display = 'block';
    }

    tooltip.addEventListener('click', () => {
      const ref = tooltip.dataset.ref;
      if (!ref) return;
      navigator.clipboard.writeText(ref).then(() => {
        const saved = tooltip.innerHTML;
        tooltip.innerHTML = '<span style="color:var(--vscode-terminal-ansiGreen,#4ec9b0);font-weight:600">copied!</span>';
        setTimeout(() => { if (tooltip.style.display !== 'none') tooltip.innerHTML = saved; }, 1200);
      }).catch(() => {});
    });

    document.addEventListener('keydown', (e) => { if (e.key === 'Alt') altDown = true; });
    document.addEventListener('keyup', (e) => { if (e.key === 'Alt') { altDown = false; hideTooltip(); } });
    window.addEventListener('blur', () => { altDown = false; hideTooltip(); });

    function attachToSvg(svgEl) {
      if (svgEl._tritonAnchorsBound) return;
      svgEl._tritonAnchorsBound = true;
      svgEl.addEventListener('mousemove', (e) => {
        if (!altDown) { hideTooltip(); return; }
        if (tooltipTimer) clearTimeout(tooltipTimer);
        tooltipTimer = setTimeout(() => { showTooltip(currentAnchors, e, svgEl); }, 16);
      });
      svgEl.addEventListener('mouseleave', () => {
        if (tooltipTimer) { clearTimeout(tooltipTimer); tooltipTimer = null; }
        hideTooltip();
      });
    }

    function refreshAnchorListeners() {
      content.querySelectorAll('svg').forEach(s => attachToSvg(s));
    }
  </script>
</body>
</html>`;
}

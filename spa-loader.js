const FRAGMENTS = [
  'header.html',
  'home.html',
  'gyms.html',
  'nutrition.html',
  'calculator.html',
  'forms.html',
  'footer.html'
];

(function () {
  const app = document.getElementById('app');
  const loadingBanner = document.getElementById('loading-banner');

  function parseHTML(html) {
    return new DOMParser().parseFromString(html, 'text/html');
  }

  // Copy <style> and <link rel="stylesheet"> from fragment into main <head>
  function adoptStyles(doc) {
    const head = document.head;
    // inline <style>
    doc.querySelectorAll('style').forEach(tag => {
      const clone = document.createElement('style');
      // copy attributes
      for (let i = 0; i < tag.attributes.length; i++) {
        const a = tag.attributes[i];
        clone.setAttribute(a.name, a.value);
      }
      clone.textContent = tag.textContent;
      head.appendChild(clone);
    });

    // external CSS (skip duplicates)
    doc.querySelectorAll('link[rel="stylesheet"][href]').forEach(tag => {
      const href = (tag.getAttribute('href') || '').trim();
      if (!href) return;
      const exists = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
        .some(l => (l.getAttribute('href') || '').trim() === href);
      if (!exists) {
        const clone = document.createElement('link');
        for (let i = 0; i < tag.attributes.length; i++) {
          const a = tag.attributes[i];
          clone.setAttribute(a.name, a.value);
        }
        head.appendChild(clone);
      }
    });
  }

  // Execute a list of <script> nodes (preserves inline/external order).
  // Returns a Promise that resolves once all scripts are appended and external ones are loaded.
  function runScriptsFromNodes(scriptNodes) {
    return new Promise((resolve) => {
      const appendNext = (index) => {
        if (index >= scriptNodes.length) { resolve(); return; }
        const old = scriptNodes[index];
        const s = document.createElement('script');
        // copy attributes
        for (let i = 0; i < old.attributes.length; i++) {
          const a = old.attributes[i];
          s.setAttribute(a.name, a.value);
        }

        if (old.src) {
          // external script: load sequentially, wait for onload
          s.src = old.src;
          // ensure not async so scripts run in order
          s.async = false;
          s.onload = () => appendNext(index + 1);
          s.onerror = () => {
            console.warn('Fragment script failed to load:', old.src);
            appendNext(index + 1);
          };
          document.body.appendChild(s);
        } else {
          // inline script: execute immediately
          s.textContent = old.textContent;
          document.body.appendChild(s);
          // move to next script
          appendNext(index + 1);
        }
      };
      appendNext(0);
    });
  }

  // Choose the element to insert; keep the wrapper element (with its id/class)
  function pickRoot(doc) {
    return (
      doc.querySelector('section[id]') ||
      doc.querySelector('header[id]') ||
      doc.querySelector('footer[id]') ||
      doc.querySelector('section, header, footer, main') ||
      doc.body
    );
  }

  // Load a fragment, adopt styles, insert the node, and execute scripts that belong to it.
  async function loadFragment(path) {
    console.log('loader: fetching', path);
    const res = await fetch(path, { cache: 'no-store' });
    if (!res.ok) throw new Error(`${path} → ${res.status} ${res.statusText}`);
    const text = await res.text();
    const doc = parseHTML(text);

    // bring styles first so layout applies
    adoptStyles(doc);

    // pick the wrapper element
    const root = pickRoot(doc);

    // COLLECT scripts that are inside the root BEFORE removing them
    const scriptsInRoot = Array.from(root.querySelectorAll('script'));

    // remove the scripts from the root so importNode keeps a clean copy (we'll execute separately)
    scriptsInRoot.forEach(s => s.remove());

    // IMPORT THE NODE ITSELF (not just innerHTML) so we keep id/class
    const node = document.importNode(root, true);
    node.setAttribute('data-fragment', path);
    app.appendChild(node);

    // Execute scripts that were inside the root (in order)
    if (scriptsInRoot.length) {
      await runScriptsFromNodes(scriptsInRoot);
    }

    // Execute any remaining scripts in the doc that were outside the picked root (rare)
    const otherScripts = Array.from(doc.querySelectorAll('script')).filter(s => !scriptsInRoot.includes(s));
    if (otherScripts.length) {
      await runScriptsFromNodes(otherScripts);
    }

    console.log('loader: finished', path);
  }

  async function assemble() {
    if (loadingBanner) loadingBanner.textContent = 'Loading…';
    for (const f of FRAGMENTS) {
      if (loadingBanner) loadingBanner.textContent = `Loading ${f} ...`;
      try {
        await loadFragment(f);
      } catch (err) {
        console.error('Error loading fragment', f, err);
      }
    }
    if (loadingBanner) loadingBanner.style.display = 'none';

    // Smooth-scroll for in-page anchors (#home, #gyms, etc.)
    document.body.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const href = a.getAttribute('href') || '';
      if (href === '#' || href.trim() === '') { e.preventDefault(); return; }
      const id = href.slice(1);
      const el = document.getElementById(id);
      if (el) { e.preventDefault(); history.pushState(null,'','#'+id); el.scrollIntoView({behavior:'smooth'}); }
    });

    // Deep link support (index.html#gyms)
    if (location.hash) {
      const el = document.getElementById(location.hash.slice(1));
      if (el) el.scrollIntoView();
    }

    // Delegated submit hook:
    // If a fragment wants centralized submit handling, expose a global function:
    //   window.handleFormSubmit = function (form) { ... }
    // The loader will call it when a form is submitted. If not present, nothing is prevented here.
    document.addEventListener('submit', (e) => {
      const form = e.target;
      if (!form || form.nodeName !== 'FORM') return;
      // If page authors exposed a global hook, call it and let it control submission
      if (typeof window.handleFormSubmit === 'function') {
        e.preventDefault();
        try {
          window.handleFormSubmit(form);
        } catch (err) {
          console.error('handleFormSubmit error', err);
        }
      }
      // otherwise do nothing — fragment scripts can attach their own handlers
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', assemble);
  else assemble();
})();

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

  // Execute scripts from the fragment (inline + external)
  function runScripts(doc) {
    const scripts = Array.from(doc.querySelectorAll('script'));
    scripts.forEach(old => {
      const s = document.createElement('script');
      for (let i = 0; i < old.attributes.length; i++) {
        const a = old.attributes[i];
        s.setAttribute(a.name, a.value);
      }
      if (old.src) { s.src = old.src; s.async = false; }
      else { s.textContent = old.textContent; }
      document.body.appendChild(s);
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

  async function loadFragment(path) {
    const res = await fetch(path, { cache: 'no-store' });
    if (!res.ok) throw new Error(`${path} → ${res.status} ${res.statusText}`);
    const text = await res.text();
    const doc = parseHTML(text);

    // bring styles first so layout applies
    adoptStyles(doc);

    // pick the wrapper element and remove any <script> inside it (we execute separately)
    const root = pickRoot(doc);
    root.querySelectorAll('script').forEach(s => s.remove());

    // IMPORT THE NODE ITSELF (not just innerHTML) so we keep id/class
    const node = document.importNode(root, true);
    node.setAttribute('data-fragment', path);
    app.appendChild(node);

    // now execute scripts from the fragment
    runScripts(doc);
  }

  async function assemble() {
    if (loadingBanner) loadingBanner.textContent = 'Loading…';
    for (const f of FRAGMENTS) {
      if (loadingBanner) loadingBanner.textContent = `Loading ${f} ...`;
      await loadFragment(f);
    }
    if (loadingBanner) loadingBanner.style.display = 'none';

    // Smooth-scroll for in-page anchors (#home, #gyms, etc.)
    document.body.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute('href').slice(1);
      const el = document.getElementById(id);
      if (el) { e.preventDefault(); history.pushState(null,'','#'+id); el.scrollIntoView({behavior:'smooth'}); }
    });

    // Deep link support (index.html#gyms)
    if (location.hash) {
      const el = document.getElementById(location.hash.slice(1));
      if (el) el.scrollIntoView();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', assemble);
  else assemble();
})();
// spa-loader.js
// Files are at repo root (per your URL), so plain names:
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

  // Add <style> tags from the fragment into <head>
  function adoptStyles(doc) {
    const head = document.head;
    // Inline <style>
    doc.querySelectorAll('style').forEach(styleTag => {
      // clone to preserve contents
      const clone = document.createElement('style');
      // copy attributes like media if present
      for (let i = 0; i < styleTag.attributes.length; i++) {
        const attr = styleTag.attributes[i];
        clone.setAttribute(attr.name, attr.value);
      }
      clone.textContent = styleTag.textContent;
      head.appendChild(clone);
    });

    // External stylesheets in fragments (skip if same href already present)
    doc.querySelectorAll('link[rel="stylesheet"][href]').forEach(linkTag => {
      const href = linkTag.getAttribute('href');
      const exists = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
        .some(l => (l.getAttribute('href') || '').trim() === href.trim());
      if (!exists) {
        const clone = document.createElement('link');
        for (let i = 0; i < linkTag.attributes.length; i++) {
          const attr = linkTag.attributes[i];
          clone.setAttribute(attr.name, attr.value);
        }
        document.head.appendChild(clone);
      }
    });
  }

  // Execute <script> tags from the fragment in page context
  function runScripts(doc) {
    const scripts = Array.from(doc.querySelectorAll('script'));
    scripts.forEach(oldScript => {
      const s = document.createElement('script');
      for (let i = 0; i < oldScript.attributes.length; i++) {
        const attr = oldScript.attributes[i];
        s.setAttribute(attr.name, attr.value);
      }
      if (oldScript.src) { s.src = oldScript.src; s.async = false; }
      else { s.textContent = oldScript.textContent; }
      document.body.appendChild(s);
    });
  }

  // Turn "gyms.html#gyms" / "gyms.html" into "#gyms"
  function rewriteLinks(root) {
    root.querySelectorAll('a[href]').forEach(a => {
      const href = (a.getAttribute('href') || '').trim();
      if (!href) return;
      if (/^(https?:|mailto:|tel:|#)/i.test(href)) return;
      if (href.includes('.html#')) {
        a.setAttribute('href', '#' + href.split('#')[1]);
      } else if (href.endsWith('.html')) {
        let f = href.split('/').pop().replace('.html','');
        if (f === '' || f === 'index') f = 'home';
        a.setAttribute('href', '#' + f);
      }
    });
  }

  async function loadFragment(path) {
    const res = await fetch(path, { cache: 'no-store' });
    if (!res.ok) throw new Error(`${path} → ${res.status} ${res.statusText}`);
    const text = await res.text();
    const doc = parseHTML(text);

    // bring over styles BEFORE injecting HTML so they apply immediately
    adoptStyles(doc);

    // choose what HTML to inject: prefer a top-level <section>, else whole body
    const root = doc.querySelector('section') || doc.body;

    rewriteLinks(root);

    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-fragment', path);
    wrapper.innerHTML = root.innerHTML;
    app.appendChild(wrapper);

    // then run any scripts from the fragment
    runScripts(doc);
  }

  async function assemble() {
    if (loadingBanner) loadingBanner.textContent = 'Loading…';
    for (const f of FRAGMENTS) {
      if (loadingBanner) loadingBanner.textContent = `Loading ${f} ...`;
      await loadFragment(f);
    }
    if (loadingBanner) loadingBanner.style.display = 'none';

    // Smooth-scroll for in-page anchors
    document.body.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute('href').slice(1);
      const el = document.getElementById(id);
      if (el) { e.preventDefault(); history.pushState(null,'','#'+id); el.scrollIntoView({behavior:'smooth'}); }
    });

    // Deep link support (index.html#section)
    if (location.hash) {
      const el = document.getElementById(location.hash.slice(1));
      if (el) el.scrollIntoView();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', assemble);
  else assemble();
})();
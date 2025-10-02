// spa-loader.js (v3)
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
  const VERSION = 'v3'; // bump to bust cache any time

  function parseHTML(html) {
    return new DOMParser().parseFromString(html, 'text/html');
  }

  // Copy <style> and <link rel="stylesheet"> from fragment <head> and <body> into main <head>
  function adoptStyles(doc) {
    const head = document.head;

    // Inline styles anywhere in the fragment
    doc.querySelectorAll('style').forEach(styleTag => {
      const clone = document.createElement('style');
      // copy attributes like media if present
      for (let i = 0; i < styleTag.attributes.length; i++) {
        const attr = styleTag.attributes[i];
        clone.setAttribute(attr.name, attr.value);
      }
      clone.textContent = styleTag.textContent;
      head.appendChild(clone);
    });

    // External stylesheets (skip duplicates)
    doc.querySelectorAll('link[rel="stylesheet"][href]').forEach(linkTag => {
      const href = (linkTag.getAttribute('href') || '').trim();
      if (!href) return;
      const exists = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
        .some(l => (l.getAttribute('href') || '').trim() === href);
      if (!exists) {
        const clone = document.createElement('link');
        for (let i = 0; i < linkTag.attributes.length; i++) {
          const attr = linkTag.attributes[i];
          clone.setAttribute(attr.name, attr.value);
        }
        head.appendChild(clone);
      }
    });
  }

  // Execute scripts from the fragment
  function runScripts(doc) {
    const scripts = Array.from(doc.querySelectorAll('script'));
    scripts.forEach(old => {
      const s = document.createElement('script');
      for (let i = 0; i < old.attributes.length; i++) {
        const attr = old.attributes[i];
        s.setAttribute(attr.name, attr.value);
      }
      if (old.src) { s.src = old.src; s.async = false; }
      else { s.textContent = old.textContent; }
      document.body.appendChild(s);
    });
  }

  // Rewrite local links to in-page anchors
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
    // add cache-buster for GitHub Pages CDN
    const url = `${path}?${VERSION}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`${url} → ${res.status} ${res.statusText}`);
    const text = await res.text();
    const doc = parseHTML(text);

    // bring styles first
    adoptStyles(doc);

    // choose content to inject
    const root = doc.querySelector('section') || doc.body;

    rewriteLinks(root);

    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-fragment', path);
    wrapper.innerHTML = root.innerHTML;
    app.appendChild(wrapper);

    // then run scripts
    runScripts(doc);
  }

  async function assemble() {
    if (loadingBanner) loadingBanner.textContent = 'Loading…';
    for (const f of FRAGMENTS) {
      if (loadingBanner) loadingBanner.textContent = `Loading ${f} ...`;
      await loadFragment(f);
    }
    if (loadingBanner) loadingBanner.style.display = 'none';

    // smooth in-page anchors
    document.body.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute('href').slice(1);
      const el = document.getElementById(id);
      if (el) { e.preventDefault(); history.pushState(null,'','#'+id); el.scrollIntoView({behavior:'smooth'}); }
    });

    // deep link on first load
    if (location.hash) {
      const el = document.getElementById(location.hash.slice(1));
      if (el) el.scrollIntoView();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', assemble);
  else assemble();
})();
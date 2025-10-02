// spa-loader.js

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

  function runScripts(doc) {
    const scripts = Array.from(doc.querySelectorAll('script'));
    scripts.forEach(oldScript => {
      const s = document.createElement('script');
      // copy attributes
      for (let i = 0; i < oldScript.attributes.length; i++) {
        const attr = oldScript.attributes[i];
        s.setAttribute(attr.name, attr.value);
      }
      if (oldScript.src) { s.src = oldScript.src; s.async = false; }
      else { s.textContent = oldScript.textContent; }
      document.body.appendChild(s);
    });
  }

  function rewriteLinks(root) {
    // Turn "gyms.html#gyms" or "gyms.html" into "#gyms" for in-page navigation
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
    const root = doc.querySelector('section') || doc.body;

    rewriteLinks(root);

    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-fragment', path);
    wrapper.innerHTML = root.innerHTML;
    app.appendChild(wrapper);

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

    // Handle deep link (index.html#something)
    if (location.hash) {
      const el = document.getElementById(location.hash.slice(1));
      if (el) el.scrollIntoView();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', assemble);
  else assemble();
})();
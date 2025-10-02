// spa-loader.js
// Loads a list of HTML fragment files, injects their <section> (or body) content into #app,
// rewrites internal navigation links to anchor-only (so nav links still jump to sections),
// and executes any <script> tags found in the fragments so inline JS runs.

(function () {
  // Edit this array to match the filenames (relative to index.html) where you've stored fragments.
  const FRAGMENTS = [
    'header.html',      // optional header fragment (if you keep header inline in a fragment)
    'home.html',
    'gyms.html',
    'nutrition.html',
    'calculator.html',
    'forms.html',
    'footer.html'       // optional footer fragment
  ];

  const app = document.getElementById('app');
  const loadingBanner = document.getElementById('loading-banner');

  // Utility: fetch text of a fragment
  async function fetchFragment(url) {
    const res = await fetch(url, {cache: "no-store"});
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
    return await res.text();
  }

  // Utility: parse HTML and return a Document
  function parseHTML(html) {
    return new DOMParser().parseFromString(html, 'text/html');
  }

  // Utility: rewrite links in injected fragment
  // Converts links like "gyms.html#gyms" or "gyms.html" to "#gyms".
  function rewriteLinks(fragmentRoot) {
    const anchors = fragmentRoot.querySelectorAll('a[href]');
    anchors.forEach(a => {
      const href = a.getAttribute('href').trim();
      // If it's an absolute/remote link, leave it alone (starts with http, mailto, tel)
      if (/^(https?:|mailto:|tel:|#)/i.test(href)) return;

      // If link points to a local file fragment like "gyms.html#gyms" or "gyms.html"
      // Convert it to an anchor #id if the filename includes a # or the fragment contains an id we can detect.
      // Strategy:
      // 1) If href contains a hash -> use that hash (#gyms)
      // 2) Else if href ends with ".html" -> attempt to infer section id from filename (e.g., gyms.html -> #gyms)
      const hashIndex = href.indexOf('#');
      if (hashIndex !== -1) {
        const hash = href.slice(hashIndex);
        a.setAttribute('href', hash);
      } else if (href.endsWith('.html')) {
        let filename = href.split('/').pop().replace('.html','');
        // If "index" -> link to #home as fallback
        if (filename === 'index' || filename === '') filename = 'home';
        a.setAttribute('href', '#' + filename);
      } else {
        // Otherwise leave alone (maybe a relative anchor we can't handle)
      }
    });
  }

  // Utility: execute scripts extracted from parsed fragment (preserves src and inline)
  function runScripts(fragmentRoot) {
    const scripts = Array.from(fragmentRoot.querySelectorAll('script'));
    scripts.forEach(oldScript => {
      const newScript = document.createElement('script');
      // Copy attributes like type, src, async, defer
      for (let i = 0; i < oldScript.attributes.length; i++) {
        const attr = oldScript.attributes[i];
        newScript.setAttribute(attr.name, attr.value);
      }
      if (oldScript.src) {
        // External script: set src and append (will fetch and run)
        newScript.src = oldScript.src;
        // ensure it's loaded sequentially to avoid race issues with inline scripts in different fragments
        newScript.async = false;
      } else {
        // Inline script: copy text
        newScript.textContent = oldScript.textContent;
      }
      // Append to document body so it executes in page context
      document.body.appendChild(newScript);
      // Remove the original script from fragmentRoot so we don't duplicate if we re-parse
      oldScript.remove();
    });
  }

  // Main: sequentially fetch and inject fragments
  async function assemble() {
    try {
      for (const fragPath of FRAGMENTS) {
        // For user-friendly debug, show which fragment is loading
        if (loadingBanner) loadingBanner.textContent = `Loading ${fragPath} ...`;

        const text = await fetchFragment(fragPath);
        const doc = parseHTML(text);

        // Prefer to inject a top-level <section> if present, else inject the body innerHTML
        // This allows you to store each fragment as just the section (<section id="gyms"> ... </section>)
        let fragmentRoot = doc.querySelector('section') || doc.querySelector('main') || doc.body;

        // Before injecting, rewrite local links inside this fragment (so nav links become anchor-only)
        rewriteLinks(fragmentRoot);

        // Create a wrapper so we don't accidentally break page-level markup
        const wrapper = document.createElement('div');
        // Mark the wrapper with data-source for easier debugging
        wrapper.setAttribute('data-fragment', fragPath);
        wrapper.innerHTML = fragmentRoot.innerHTML;

        // Append to app
        app.appendChild(wrapper);

        // After DOM insertion, run any scripts from the parsed fragment (not from wrapper.innerHTML — we must parse original)
        // Use doc (original parsed doc) to find scripts and execute them in page context
        runScripts(doc);

        // tiny delay optionally to reduce jank for many fragments (comment out if undesired)
        // await new Promise(r => setTimeout(r, 10));
      }

      if (loadingBanner) loadingBanner.style.display = 'none';

      // After all fragments loaded, optionally handle initial hash
      if (location.hash) {
        const id = location.hash.slice(1);
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({behavior:'smooth'});
      }

      // Hook: turn links that were converted into anchors into smooth scroll behavior
      document.body.addEventListener('click', function(e){
        const a = e.target.closest('a[href^="#"]');
        if (!a) return;
        const href = a.getAttribute('href');
        if (href === '#' || href === '') return;
        const targetId = href.slice(1);
        const target = document.getElementById(targetId);
        if (target) {
          e.preventDefault();
          history.pushState(null, '', '#' + targetId);
          target.scrollIntoView({behavior:'smooth'});
        }
      });

    } catch (err) {
      console.error('Error assembling fragments:', err);
      if (loadingBanner) loadingBanner.textContent = 'Failed to load site content.';
    }
  }

  // Start assembly on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', assemble);
  } else {
    assemble();
  }
})();
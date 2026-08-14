(function () {
  'use strict';

  var loader = document.getElementById('fe-page-loader');
  if (!loader) return;

  var hideTimer = null;
  var safetyTimer = null;
  var MIN_VISIBLE_MS = 120;
  var MAX_WAIT_MS = 1200;
  var FADE_MS = 180;
  var shownAt = performance.now();
  var isHidden = false;
  var prefetched = Object.create(null);

  function showLoader() {
    if (hideTimer) {
      window.clearTimeout(hideTimer);
      hideTimer = null;
    }
    if (safetyTimer) {
      window.clearTimeout(safetyTimer);
      safetyTimer = null;
    }

    isHidden = false;
    loader.hidden = false;
    loader.removeAttribute('hidden');
    loader.setAttribute('aria-hidden', 'false');
    loader.classList.add('is-visible');
    shownAt = performance.now();
  }

  function hideLoader() {
    if (isHidden) return;

    var elapsed = performance.now() - shownAt;
    var wait = Math.max(0, MIN_VISIBLE_MS - elapsed);

    if (hideTimer) window.clearTimeout(hideTimer);
    if (safetyTimer) {
      window.clearTimeout(safetyTimer);
      safetyTimer = null;
    }

    hideTimer = window.setTimeout(function () {
      isHidden = true;
      loader.classList.remove('is-visible');
      loader.setAttribute('aria-hidden', 'true');
      window.setTimeout(function () {
        loader.hidden = true;
      }, FADE_MS);
      hideTimer = null;
    }, wait);
  }

  function revealWhenReady() {
    function done() {
      hideLoader();
    }

    // Prefer first paint of DOM over waiting for every image/font (window.load).
    if (document.readyState === 'interactive' || document.readyState === 'complete') {
      // Let the browser paint once, then lift the cover.
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(done);
      });
    } else {
      document.addEventListener('DOMContentLoaded', function () {
        window.requestAnimationFrame(function () {
          window.requestAnimationFrame(done);
        });
      }, { once: true });
    }

    // Hard cap so a slow third-party script can't leave the spinner forever.
    safetyTimer = window.setTimeout(done, MAX_WAIT_MS);
  }

  function isModifiedClick(event) {
    return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button === 1;
  }

  function shouldHandleLink(anchor) {
    if (!anchor || !anchor.href) return false;
    if (anchor.hasAttribute('download')) return false;
    if (anchor.target && anchor.target !== '_self') return false;
    if (anchor.hasAttribute('data-no-loader')) return false;

    var rel = (anchor.getAttribute('rel') || '').toLowerCase();
    if (rel.indexOf('external') !== -1) return false;

    var url;
    try {
      url = new URL(anchor.href, window.location.origin);
    } catch (error) {
      return false;
    }

    if (url.origin !== window.location.origin) return false;
    if (url.pathname === window.location.pathname && url.search === window.location.search) {
      return false;
    }
    if (url.protocol === 'javascript:' || url.protocol === 'mailto:' || url.protocol === 'tel:') {
      return false;
    }

    return true;
  }

  function prefetchLink(href) {
    if (!href || prefetched[href]) return;
    if (!('connection' in navigator) || !navigator.connection || !navigator.connection.saveData) {
      prefetched[href] = true;
      var link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = href;
      link.as = 'document';
      document.head.appendChild(link);
    }
  }

  revealWhenReady();

  // Back/forward cache: never re-show a stuck loader.
  window.addEventListener('pageshow', function () {
    hideLoader();
  });

  document.addEventListener(
    'click',
    function (event) {
      if (isModifiedClick(event)) return;
      if (event.defaultPrevented) return;

      var target = event.target;
      if (!(target instanceof Element)) return;

      var anchor = target.closest('a[href]');
      if (!shouldHandleLink(anchor)) return;

      showLoader();
    },
    true
  );

  document.addEventListener(
    'pointerover',
    function (event) {
      var target = event.target;
      if (!(target instanceof Element)) return;
      var anchor = target.closest('a[href]');
      if (!shouldHandleLink(anchor)) return;
      prefetchLink(anchor.href);
    },
    { capture: true, passive: true }
  );

  document.addEventListener(
    'submit',
    function (event) {
      if (event.defaultPrevented) return;
      var form = event.target;
      if (!(form instanceof HTMLFormElement)) return;

      if (
        form.classList.contains('js-wine-ajax-atc') ||
        form.classList.contains('product-card__collection-atc-form') ||
        form.getAttribute('data-type') === 'add-to-cart-form'
      ) {
        return;
      }

      var method = (form.getAttribute('method') || 'get').toLowerCase();
      if (method !== 'get' && method !== 'post') return;

      showLoader();
    },
    true
  );
})();

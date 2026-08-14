(function () {
  'use strict';

  var loader = document.getElementById('fe-page-loader');
  if (!loader) return;

  var hideTimer = null;
  var MIN_VISIBLE_MS = 250;
  var shownAt = Date.now();

  function showLoader() {
    if (hideTimer) {
      window.clearTimeout(hideTimer);
      hideTimer = null;
    }
    loader.hidden = false;
    loader.setAttribute('aria-hidden', 'false');
    loader.classList.add('is-visible');
    shownAt = Date.now();
  }

  function hideLoader() {
    var elapsed = Date.now() - shownAt;
    var wait = Math.max(0, MIN_VISIBLE_MS - elapsed);

    hideTimer = window.setTimeout(function () {
      loader.classList.remove('is-visible');
      loader.setAttribute('aria-hidden', 'true');
      window.setTimeout(function () {
        loader.hidden = true;
      }, 200);
      hideTimer = null;
    }, wait);
  }

  function isModifiedClick(event) {
    return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button === 1;
  }

  function shouldHandleLink(anchor) {
    if (!anchor || !anchor.href) return false;
    if (anchor.hasAttribute('download')) return false;
    if (anchor.target && anchor.target !== '_self') return false;

    var rel = (anchor.getAttribute('rel') || '').toLowerCase();
    if (rel.indexOf('external') !== -1) return false;

    var url;
    try {
      url = new URL(anchor.href, window.location.origin);
    } catch (error) {
      return false;
    }

    if (url.origin !== window.location.origin) return false;
    if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash) {
      return false;
    }
    if (url.protocol === 'javascript:') return false;

    return true;
  }

  // Keep covering the page until styles/assets settle, then fade out.
  function revealWhenReady() {
    if (document.readyState === 'complete') {
      hideLoader();
      return;
    }
    window.addEventListener('load', hideLoader, { once: true });
  }

  revealWhenReady();

  window.addEventListener('pageshow', function (event) {
    if (event.persisted) {
      hideLoader();
    }
  });

  window.addEventListener('pagehide', function () {
    showLoader();
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

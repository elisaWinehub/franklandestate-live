(function () {
  function updateCartCount(count) {
    var cartCountBadges = document.querySelectorAll('.fe-cart-count, [data-cart-count]');
    cartCountBadges.forEach(function (badge) {
      badge.textContent = String(count);
      if (count > 0) {
        badge.classList.remove('fe-cart-count--empty');
        badge.style.display = '';
      } else {
        badge.classList.add('fe-cart-count--empty');
      }
    });
  }

  function getCartSectionIds() {
    var ids = [];
    document.querySelectorAll('cart-items-component[data-section-id]').forEach(function (el) {
      if (el instanceof HTMLElement && el.dataset.sectionId) {
        ids.push(el.dataset.sectionId);
      }
    });
    return ids;
  }

  function tryOpenDrawer() {
    var drawer = document.querySelector('cart-drawer-component');
    if (drawer) {
      try {
        if (typeof drawer.open === 'function') {
          drawer.open();
          return true;
        }
        if (typeof drawer.showDialog === 'function') {
          drawer.showDialog();
          return true;
        }
      } catch (error) {
        // Fall through to trigger click.
      }
    }

    var trigger = document.querySelector('[data-testid="cart-drawer-trigger"]');
    if (trigger) {
      trigger.click();
      return true;
    }

    return false;
  }

  function openCartDrawer() {
    var openNow = function () {
      if (tryOpenDrawer()) return;
      window.setTimeout(tryOpenDrawer, 120);
    };

    if (window.customElements && typeof customElements.whenDefined === 'function') {
      customElements.whenDefined('cart-drawer-component').then(openNow).catch(openNow);
    } else {
      openNow();
    }
  }

  function dispatchCartUpdate(cart, sections) {
    document.dispatchEvent(
      new CustomEvent('cart:update', {
        bubbles: true,
        detail: {
          resource: cart,
          sourceId: 'wine-ajax-atc',
          data: {
            source: 'wine-ajax-atc',
            itemCount: (cart && cart.item_count) || 0,
            sections: sections || {}
          }
        }
      })
    );
  }

  function isAjaxCartForm(form) {
    if (!(form instanceof HTMLFormElement)) return false;
    return (
      form.classList.contains('js-wine-ajax-atc') || form.classList.contains('product-card__collection-atc-form')
    );
  }

  function buildAjaxCartFormData(form) {
    var fd = new FormData(form);
    var qty = fd.get('quantity');
    if (qty === null || String(qty).trim() === '') {
      fd.set('quantity', '1');
    }

    var sectionIds = getCartSectionIds();
    if (sectionIds.length) {
      fd.append('sections', sectionIds.join(','));
    }

    return fd;
  }

  document.addEventListener(
    'submit',
    function (event) {
      var form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      if (!isAjaxCartForm(form)) return;

      var idInput = form.querySelector('input[name="id"]');
      if (!idInput || !String(idInput.value || '').trim()) {
        event.preventDefault();
        window.alert('Unable to add item to cart.');
        return;
      }

      event.preventDefault();

      if (form.dataset.feAjaxCartSubmitting === 'true') return;
      form.dataset.feAjaxCartSubmitting = 'true';

      var submitButton = form.querySelector('button[type="submit"]');
      if (submitButton) submitButton.disabled = true;

      var formData = buildAjaxCartFormData(form);

      fetch('/cart/add.js', {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: formData
      })
        .then(function (response) {
          if (!response.ok) {
            return response.json().then(function (payload) {
              throw new Error((payload && payload.description) || 'Unable to add item to cart.');
            });
          }
          return response.json();
        })
        .then(function (addedItem) {
          return fetch('/cart.js', { headers: { Accept: 'application/json' } }).then(function (cartResponse) {
            if (!cartResponse.ok) throw new Error('Unable to read cart.');
            return cartResponse.json().then(function (cart) {
              return { addedItem: addedItem, cart: cart };
            });
          });
        })
        .then(function (result) {
          updateCartCount(result.cart.item_count || 0);
          dispatchCartUpdate(result.cart, result.addedItem.sections || {});
          // Wait for cart section morph listeners, then open drawer.
          window.requestAnimationFrame(function () {
            window.setTimeout(openCartDrawer, 60);
          });
        })
        .catch(function (error) {
          window.alert(error.message || 'Unable to add item to cart.');
        })
        .finally(function () {
          form.dataset.feAjaxCartSubmitting = 'false';
          if (submitButton) submitButton.disabled = false;
        });
    },
    true
  );
})();

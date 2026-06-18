(function () {
  var MODAL_ID = 'wine-atc-modal-global';

  /** @type {{ modal: HTMLElement, lastFocused: Element | null, dialog: Element | null } | null} */
  var activeModalState = null;

  function getFocusableElements(container) {
    if (!container) return [];
    return Array.prototype.slice
      .call(
        container.querySelectorAll(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      )
      .filter(function (element) {
        return !element.hasAttribute('hidden');
      });
  }

  function updateCartCount(count) {
    var cartCountBadges = document.querySelectorAll('.fe-cart-count');
    cartCountBadges.forEach(function (badge) {
      badge.textContent = String(count);
      badge.style.display = count > 0 ? 'inline-flex' : 'none';
    });

    var genericCountBadges = document.querySelectorAll('[data-cart-count], .cart-count-bubble');
    genericCountBadges.forEach(function (badge) {
      badge.textContent = String(count);
    });
  }

  function closeActiveModal() {
    if (!activeModalState) return;
    var state = activeModalState;
    var modal = state.modal;
    activeModalState = null;

    modal.classList.remove('is-open');
    window.setTimeout(function () {
      modal.setAttribute('hidden', '');
    }, 220);

    document.removeEventListener('keydown', onDocumentKeydown, true);

    if (state.lastFocused && typeof state.lastFocused.focus === 'function') {
      state.lastFocused.focus();
    }
  }

  function trapFocus(event) {
    if (!activeModalState || event.key !== 'Tab') return;
    var dialog = activeModalState.dialog;
    if (!dialog) return;

    var focusables = getFocusableElements(dialog);
    if (!focusables.length) return;

    var first = focusables[0];
    var last = focusables[focusables.length - 1];
    var active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function onDocumentKeydown(event) {
    if (!activeModalState) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeActiveModal();
      return;
    }
    trapFocus(event);
  }

  function openWineModal(modal, productTitle, itemCount) {
    closeActiveModal();

    var productTitleEl = modal.querySelector('[data-modal-product-title]');
    var countEl = modal.querySelector('[data-modal-count]');
    var dialog = modal.querySelector('.wine-atc-modal__dialog');

    if (productTitleEl) {
      productTitleEl.textContent = productTitle || 'Product';
    }

    if (countEl) {
      var label = itemCount === 1 ? 'item' : 'items';
      countEl.textContent = 'There is ' + itemCount + ' ' + label + ' in your shopping cart.';
    }

    activeModalState = {
      modal: modal,
      lastFocused: document.activeElement,
      dialog: dialog
    };

    modal.removeAttribute('hidden');
    window.requestAnimationFrame(function () {
      modal.classList.add('is-open');
    });

    document.addEventListener('keydown', onDocumentKeydown, true);

    var focusables = getFocusableElements(dialog);
    if (focusables.length) {
      focusables[0].focus();
    }
  }

  function isAjaxCartForm(form) {
    if (!(form instanceof HTMLFormElement)) return false;
    return (
      form.classList.contains('js-wine-ajax-atc') || form.classList.contains('product-card__collection-atc-form')
    );
  }

  function getFallbackProductTitle(form) {
    var dataTitle = form.getAttribute('data-product-title');
    if (dataTitle && String(dataTitle).trim()) {
      return String(dataTitle).trim();
    }

    var feCard = form.closest('.fe-product-card');
    if (feCard) {
      var titleLink = feCard.querySelector('.fe-product-card__title a');
      if (titleLink && titleLink.textContent) {
        return titleLink.textContent.trim();
      }
    }

    var card = form.closest('product-card');
    if (card) {
      var hiddenTitle = card.querySelector('.product-card__link .visually-hidden');
      if (hiddenTitle && hiddenTitle.textContent) {
        return hiddenTitle.textContent.trim();
      }
      var textBlock = card.querySelector('.text-block');
      if (textBlock && textBlock.textContent) {
        return textBlock.textContent.trim();
      }
    }

    var wineRoot = form.closest('[data-wine-product-main-section]');
    if (wineRoot) {
      var wineTitle = wineRoot.querySelector('.wine-product-title');
      if (wineTitle && wineTitle.textContent) {
        return wineTitle.textContent.trim();
      }
    }

    return 'Product';
  }

  function buildAjaxCartFormData(form) {
    var fd = new FormData(form);
    var qty = fd.get('quantity');
    if (qty === null || String(qty).trim() === '') {
      fd.set('quantity', '1');
    }
    return fd;
  }

  document.addEventListener(
    'submit',
    function (event) {
      var form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      if (!isAjaxCartForm(form)) return;

      var modal = document.getElementById(MODAL_ID);
      if (!modal) return;

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
      var fallbackTitle = getFallbackProductTitle(form);

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
          openWineModal(modal, result.addedItem.product_title || fallbackTitle, result.cart.item_count || 0);
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

  document.addEventListener('click', function (event) {
    var target = event.target;
    if (!(target instanceof Element)) return;

    var modalEl = target.closest('.wine-atc-modal');
    if (!modalEl || !modalEl.classList.contains('is-open')) return;

    if (target.closest('[data-modal-overlay]') || target.closest('[data-modal-close]')) {
      closeActiveModal();
    }
  });
})();

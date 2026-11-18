/*
 * The site's only behaviour script. Everything works without it:
 *   - the quote form posts as plain HTML;
 *   - the mobile menu and FAQs are <details>;
 *   - the desktop dropdowns open on hover and keyboard focus (CSS).
 * It adds: the form timing field, a double-submit guard, Escape to close
 * menus, and closing the mobile menu after a tap.
 */
(function () {
  'use strict';
  var doc = document;

  /* Quote form: milliseconds from page load to submit (the server's bot check). */
  var forms = doc.querySelectorAll('form.quote-form');
  for (var i = 0; i < forms.length; i++) {
    forms[i].addEventListener('submit', function (e) {
      var form = e.currentTarget;
      var field = form.querySelector('[data-elapsed]');
      if (field) field.value = String(Math.round(performance.now()));
      var btn = form.querySelector('button[type="submit"]');
      if (btn) {
        if (btn.getAttribute('data-busy') === '1') {
          e.preventDefault();
          return;
        }
        btn.setAttribute('data-busy', '1');
        btn.setAttribute('aria-disabled', 'true');
      }
    });
  }
  /* Coming back with the Back button: let the form be sent again. */
  window.addEventListener('pageshow', function () {
    var busy = doc.querySelectorAll('button[data-busy]');
    for (var j = 0; j < busy.length; j++) {
      busy[j].removeAttribute('data-busy');
      busy[j].removeAttribute('aria-disabled');
    }
  });

  /* Desktop dropdowns: Escape closes the open one and returns focus to its link. */
  var subs = doc.querySelectorAll('.has-sub');
  for (var k = 0; k < subs.length; k++) {
    (function (item) {
      item.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        item.classList.add('is-closed');
        var top = item.querySelector('a');
        if (top) top.focus();
      });
      item.addEventListener('mouseleave', function () {
        item.classList.remove('is-closed');
      });
      item.addEventListener('focusout', function (e) {
        if (!item.contains(e.relatedTarget)) item.classList.remove('is-closed');
      });
    })(subs[k]);
  }

  /* Mobile menu (<details>): close after a link is chosen, or on Escape. */
  var menu = doc.querySelector('details.m-menu');
  if (menu) {
    menu.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('a')) menu.open = false;
    });
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.open) {
        menu.open = false;
        var s = menu.querySelector('summary');
        if (s) s.focus();
      }
    });
  }
})();

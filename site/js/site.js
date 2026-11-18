/*
 * The site's only behaviour script.
 *   - Quote form: the timing field, a double-submit guard and, when the build
 *     has a Turnstile site key, the Turnstile check. Turnstile's script is
 *     only fetched on the first interaction with the form, so pages load no
 *     third-party script. If it cannot load, the form shows the phone number.
 *   - Escape closes the desktop dropdowns; the mobile menu closes after a tap.
 * Without JavaScript the menus and FAQs still work (CSS and <details>).
 */
(function () {
  'use strict';
  var doc = document;
  var TS_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  var TS_TIMEOUT_MS = 12000;

  /* ---- Turnstile loader (shared by every form on the page) ---------- */
  var tsState = 'idle'; // idle | loading | ready | failed
  var tsWaiting = [];
  function loadTurnstile(cb) {
    if (tsState === 'ready') return cb(true);
    if (tsState === 'failed') return cb(false);
    tsWaiting.push(cb);
    if (tsState === 'loading') return;
    tsState = 'loading';
    var done = function (ok) {
      if (tsState !== 'loading') return;
      tsState = ok && window.turnstile ? 'ready' : 'failed';
      var list = tsWaiting;
      tsWaiting = [];
      for (var i = 0; i < list.length; i++) list[i](tsState === 'ready');
    };
    var s = doc.createElement('script');
    s.src = TS_SRC;
    s.async = true;
    s.onload = function () {
      done(true);
    };
    s.onerror = function () {
      done(false);
    };
    setTimeout(function () {
      done(false);
    }, TS_TIMEOUT_MS);
    doc.head.appendChild(s);
  }

  /* ---- Quote forms --------------------------------------------------- */
  var forms = doc.querySelectorAll('form.quote-form');
  for (var f = 0; f < forms.length; f++) setupForm(forms[f]);

  function setupForm(form) {
    var slot = form.querySelector('[data-turnstile]');
    var statusEl = form.querySelector('[data-ts-status]');
    var failEl = form.querySelector('[data-ts-fail]');
    var btn = form.querySelector('button[type="submit"]');
    var widget = null;
    var token = '';
    var waiting = false;

    function status(text) {
      if (statusEl) statusEl.textContent = text;
    }
    function fail() {
      waiting = false;
      status('');
      if (failEl) failEl.hidden = false;
      release();
    }
    function release() {
      if (btn) {
        btn.removeAttribute('data-busy');
        btn.removeAttribute('aria-disabled');
      }
    }
    function submitNow() {
      if (typeof form.requestSubmit === 'function') form.requestSubmit();
      else form.submit();
    }
    function ensureWidget() {
      if (!slot || widget !== null) return;
      loadTurnstile(function (ok) {
        if (!ok) return fail();
        try {
          widget = window.turnstile.render(slot, {
            sitekey: slot.getAttribute('data-sitekey'),
            action: 'enquiry',
            appearance: 'interaction-only',
            size: 'flexible',
            callback: function (t) {
              token = t;
              if (waiting) {
                waiting = false;
                status('');
                submitNow();
              }
            },
            'expired-callback': function () {
              token = '';
            },
            'error-callback': function () {
              fail();
            },
          });
        } catch (e) {
          fail();
        }
      });
    }

    if (slot) {
      form.addEventListener('focusin', ensureWidget, { once: true });
      form.addEventListener('pointerdown', ensureWidget, { once: true });
    }

    form.addEventListener('submit', function (e) {
      if (btn && btn.getAttribute('data-busy') === '1') {
        e.preventDefault();
        return;
      }
      if (slot && !token) {
        // Wait for the spam check, then send on its own.
        e.preventDefault();
        if (failEl && !failEl.hidden) return;
        waiting = true;
        status('Running a quick spam check…');
        ensureWidget();
        setTimeout(function () {
          if (waiting) fail();
        }, TS_TIMEOUT_MS + 3000);
        return;
      }
      var field = form.querySelector('[data-elapsed]');
      if (field) field.value = String(Math.round(performance.now()));
      if (btn) {
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

  /* ---- Desktop dropdowns: Escape closes and returns focus ------------- */
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

  /* ---- Mobile menu (<details>) ---------------------------------------- */
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

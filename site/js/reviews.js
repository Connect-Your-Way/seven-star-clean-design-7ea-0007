/*
 * Live Google reviews - progressive enhancement over the built-in fallback.
 *
 * Asks /api/reviews (the Worker's stored copy of the Google Business Profile
 * reviews, refreshed twice a day) and, if it has data:
 *   - updates every [data-review-rating] / [data-review-count] figure;
 *   - replaces the review cards in [data-reviews-grid] one for one (same
 *     number, same fixed height, so nothing moves);
 *   - on /reviews/ (mode "all"), reveals "Show more reviews".
 * On any problem - no Worker (the static preview), REVIEWS_SOURCE "none",
 * nothing stored, a network error, an odd payload - it does nothing and the
 * built-in fallback stays.
 *
 * SAFETY: every string from the API is untrusted. It is only ever written with
 * textContent / createTextNode, never innerHTML, and no API value becomes a
 * URL: the only Google links on the page are the fixed ones in the HTML.
 */
(function () {
  'use strict';
  var doc = document;
  if (doc.documentElement.hasAttribute('data-static-preview')) return;
  if (!window.fetch || !window.JSON) return;

  var grid = doc.querySelector('[data-reviews-grid]');
  var mode = grid ? grid.getAttribute('data-reviews-mode') : null;
  var slots = grid ? parseInt(grid.getAttribute('data-reviews-slots') || '0', 10) || 0 : 0;
  var limit = mode === 'all' ? 200 : slots;
  var url = '/seven-star-clean-design-7ea-0007/site/api/reviews?limit=' + limit + (mode === 'home' ? '&written=1' : '');
  var SVG = 'http://www.w3.org/2000/svg';
  var OWNER = '7 Star Clean Service';

  function el(tag, cls, text) {
    var node = doc.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function str(v, max) {
    return typeof v === 'string' && v.length <= max ? v : null;
  }

  /* Re-check the payload shape here too: never trust the wire. */
  function clean(data) {
    if (!data || data.ok !== true) return null;
    var rating = data.rating;
    var count = data.count;
    if (typeof rating !== 'number' || !(rating >= 1 && rating <= 5)) return null;
    if (typeof count !== 'number' || count < 1 || Math.floor(count) !== count) return null;
    var out = [];
    var list = Array.isArray(data.reviews) ? data.reviews.slice(0, 200) : [];
    for (var i = 0; i < list.length; i++) {
      var r = list[i] || {};
      var author = str(r.author, 120);
      var text = str(r.text, 4096);
      var time = str(r.time, 40);
      var stars = r.rating;
      if (!author || text === null || !time) continue;
      if (typeof stars !== 'number' || stars < 1 || stars > 5 || Math.floor(stars) !== stars) continue;
      var reply = r.reply && str(r.reply.text, 4096) ? r.reply.text : null;
      out.push({ author: author, text: text, time: time, rating: stars, reply: reply });
    }
    return { rating: rating, count: count, fetchedAt: str(data.fetchedAt, 40), reviews: out };
  }

  function initials(name) {
    var parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
    var s = '';
    for (var i = 0; i < parts.length; i++) s += parts[i].charAt(0).toUpperCase();
    return s || 'G';
  }

  function ago(iso) {
    var ms = Date.parse(iso);
    if (!isFinite(ms)) return '';
    var days = Math.floor((Date.now() - ms) / 86400000);
    if (days < 1) return 'today';
    if (days < 2) return 'yesterday';
    if (days < 14) return days + ' days ago';
    if (days < 60) return Math.floor(days / 7) + ' weeks ago';
    if (days < 365) return Math.floor(days / 30) + ' months ago';
    var years = Math.floor(days / 365);
    return years === 1 ? 'a year ago' : years + ' years ago';
  }

  function starRow(n) {
    var wrap = el('span', 'stars');
    wrap.setAttribute('role', 'img');
    wrap.setAttribute('aria-label', n + ' out of 5 stars');
    for (var i = 1; i <= 5; i++) {
      var svg = doc.createElementNS(SVG, 'svg');
      svg.setAttribute('class', i > n ? 'ic off' : 'ic');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('focusable', 'false');
      var use = doc.createElementNS(SVG, 'use');
      use.setAttribute('href', '#i-star');
      svg.appendChild(use);
      wrap.appendChild(svg);
    }
    return wrap;
  }

  function card(r) {
    var fig = el('figure', 'review');
    fig.appendChild(starRow(r.rating));
    var quote = el('blockquote');
    if (r.text.trim()) {
      quote.textContent = r.text;
    } else {
      quote.textContent = 'Rated ' + r.rating + ' out of 5, with no written comment.';
      quote.className = 'empty';
    }
    fig.appendChild(quote);
    var more = el('button', 'review-more', 'Read more');
    more.type = 'button';
    more.setAttribute('aria-expanded', 'false');
    fig.appendChild(more);
    if (r.reply) {
      var reply = el('div', 'review-reply');
      reply.appendChild(el('strong', '', 'Reply from ' + OWNER));
      reply.appendChild(doc.createTextNode(r.reply));
      fig.appendChild(reply);
    }
    var cap = el('figcaption');
    var avatar = el('span', 'avatar', initials(r.author));
    avatar.setAttribute('aria-hidden', 'true');
    cap.appendChild(avatar);
    var who = el('div');
    who.appendChild(el('strong', '', r.author));
    var when = ago(r.time);
    who.appendChild(el('span', '', 'Google review' + (when ? ' · ' + when : '')));
    cap.appendChild(who);
    fig.appendChild(cap);
    return { node: fig, quote: quote, more: more, hasReply: !!r.reply };
  }

  function wire(c) {
    if (c.hasReply || c.quote.scrollHeight > c.quote.clientHeight + 2) {
      c.more.classList.add('on');
      c.more.addEventListener('click', function () {
        var open = c.node.classList.toggle('is-open');
        c.more.setAttribute('aria-expanded', open ? 'true' : 'false');
        c.more.textContent = open ? 'Show less' : 'Read more';
      });
    } else {
      c.more.setAttribute('aria-hidden', 'true');
      c.more.tabIndex = -1;
    }
  }

  function addCards(target, reviews) {
    var made = [];
    for (var i = 0; i < reviews.length; i++) {
      var c = card(reviews[i]);
      target.appendChild(c.node);
      made.push(c);
    }
    for (var j = 0; j < made.length; j++) wire(made[j]);
  }

  function formatDate(iso) {
    var ms = iso ? Date.parse(iso) : NaN;
    if (!isFinite(ms)) return '';
    try {
      return new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(ms));
    } catch (e) {
      return '';
    }
  }

  function apply(data) {
    var ratingText = data.rating.toFixed(1);
    var ratings = doc.querySelectorAll('[data-review-rating]');
    for (var i = 0; i < ratings.length; i++) ratings[i].textContent = ratingText;
    var counts = doc.querySelectorAll('[data-review-count]');
    for (var k = 0; k < counts.length; k++) counts[k].textContent = String(data.count);

    if (!grid || slots < 1 || data.reviews.length < slots) return;
    while (grid.firstChild) grid.removeChild(grid.firstChild);
    addCards(grid, data.reviews.slice(0, slots));

    var source = doc.querySelector('[data-reviews-source]');
    var updated = formatDate(data.fetchedAt);
    if (source) {
      source.textContent =
        (mode === 'all'
          ? 'All reviews from our Google Business Profile, newest first.'
          : 'The latest written reviews from our Google Business Profile.') +
        (updated ? ' Updated ' + updated + '.' : '');
    }

    if (mode === 'all') {
      var rest = data.reviews.slice(slots);
      var btn = doc.querySelector('[data-reviews-more]');
      if (!btn || rest.length === 0) return;
      var label = function () {
        btn.textContent = 'Show more reviews (' + rest.length + ' more)';
      };
      label();
      btn.hidden = false;
      btn.addEventListener('click', function () {
        addCards(grid, rest.splice(0, Math.max(slots, 6)));
        if (rest.length === 0) btn.hidden = true;
        else label();
      });
    }
  }

  fetch(url, { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
    .then(function (res) {
      return res.ok ? res.json() : null;
    })
    .then(function (data) {
      var cleaned = clean(data);
      if (cleaned) apply(cleaned);
    })
    .catch(function () {
      /* keep the built-in fallback */
    });
})();

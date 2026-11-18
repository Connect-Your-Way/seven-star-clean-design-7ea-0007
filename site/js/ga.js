/*
 * Google Analytics 4. Loaded only when src/site.config.ts `ga4Id` is set
 * (src/components/Analytics.astro), with the id in data-ga4 so there is no
 * inline script (the CSP allows no inline script).
 */
(function () {
  'use strict';
  var me = document.currentScript;
  var id = me && me.getAttribute('data-ga4');
  if (!id || !/^G-[A-Z0-9]{4,20}$/.test(id)) return;
  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', id);
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
  document.head.appendChild(s);
})();

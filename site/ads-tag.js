// ═══════════════════════════════════════════════════════════════════════════
// THE GOOGLE ADS TAG — the ONE place its numbers live   (site release 2026-10-20)
//
// [stated] Brad 2026-10-20: "lets do the paid deal with google", then "can we
// add the tag now" → "yes" to: the tag on the PUBLIC website only (the home page
// and the after-checkout welcome page), never inside the app.
//
// Google Ads account 179-556-7897 (support@therailroster.com).
// Conversion action "Free trial started" (Goals → Conversions; category
// Sign-up, value $75 = one year, count One, enhanced conversions OFF).
//
// Only two pages load this file: /index.html and /welcome/index.html.
// tests/ads_tag_tests.js fails if the numbers appear anywhere else, or if any
// file under app/ loads Google's ad script.
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  var RR_ADS = {
    id: 'AW-18527443500',                  // the account's Google tag (Conversion ID)
    signupLabel: '9u1SCKHK36MdEKy0yYJF'    // "Free trial started" (Conversion label)
  };
  window.RR_ADS = RR_ADS;
  window.dataLayer = window.dataLayer || [];
  // Google's own form: it must push the arguments object, not a copy.
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', RR_ADS.id);
  try {
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + RR_ADS.id;
    (document.head || document.documentElement).appendChild(s);
  } catch (e) {}
})();

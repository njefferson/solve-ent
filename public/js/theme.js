/* theme.js — the first frame, and the status bar. ONE copy, loaded by both pages.
 *
 * Synchronous and in the head on purpose: a stylesheet cannot read storage, and
 * a deferred script runs after the page has been painted in the mode nobody
 * asked for. It is small because it only has to get the FIRST frame right; the
 * application's own preference module takes over on the page that has one.
 *
 * IT ALSO PAINTS THE STATUS BAR, and that is the half that gets forgotten. A
 * static theme-color in the markup is wrong in whichever mode it was not
 * written for — which is precisely what the release-notes page shipped with,
 * because it has no application to correct it afterwards. The accessibility
 * gate reads the painted value against the mode's own chrome token on every
 * state, so it cannot go quietly wrong again.
 */
(function () {
  var root = document.documentElement;
  try {
    var mode = localStorage.getItem('solvent.mode');
    if (mode === 'day' || mode === 'night') root.setAttribute('data-theme', mode);
    var size = localStorage.getItem('solvent.text-size');
    if (size) root.setAttribute('data-text-size', size);
    var spacing = localStorage.getItem('solvent.spacing');
    if (spacing) root.setAttribute('data-spacing', spacing);
  } catch (e) {
    /* storage refused: the defaults are correct, and that is not a crash */
  }
  try {
    var chrome = getComputedStyle(root).getPropertyValue('--chrome').trim();
    var meta = document.querySelector('meta[name="theme-color"]');
    if (chrome && meta) meta.setAttribute('content', chrome);
  } catch (e) {
    /* a browser that cannot resolve it keeps the markup's value */
  }
})();

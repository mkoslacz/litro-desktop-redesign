/* ============================================================
   STAKEHOLDER COMMENT LAYER — start-up
   ============================================================

   proto-comments.js is a drop-in beside the demo panel, not an application
   dependency, so nothing starts it by itself. This file is the one line of
   wiring: start the layer once the panel has finished writing body.dataset.

   Order matters. A comment anchors to a *view*, not just to an element —
   page, viewport, language and the demo state it was written in — so a thread
   opened on "member account, zero inventory" reopens in that state instead of
   on whatever the next reader happens to have switched to. Both engines build
   the panel from their own DOMContentLoaded handler; this listener is
   registered after theirs and therefore runs after it.

   Everything else is configuration, read from comments.config.json as data:
   which state keys form the anchor, which Google-signed-in domains may
   comment, and which Firebase project stores the threads. Without that file
   the layer is an intentional quiet no-op, and so is any page opened from
   file:// — see README, "Stakeholder comments".                           */

(function () {
  'use strict';

  function start() {
    if (window.protoComments) protoComments.init();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();

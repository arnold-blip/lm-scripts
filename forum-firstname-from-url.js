/*!
 * forum-firstname-from-url.js  (v2)
 * Landmark Forum — Step 02 Success page (REG : Checkout : Step 02 Success + T&C's).
 *
 * Personalizes the greeting: replaces the default "Friend" with the buyer's
 * first name, read from the URL. The first name is carried in by the Ontraport
 * email button link, e.g.
 *
 *   https://lm.landmarkworldwide.com/registration-confirmed?cuid=[Unique ID]&cemail=[Email]&cfirstname=[First Name]
 *
 * Ontraport swaps the merge field for the real value at send time, so the page
 * only has to read the "cfirstname" query parameter.
 *
 * REQUIRED PAGE MARKUP (leave this in the Footer Code, inline):
 *   <span id="lm-first-name">Friend</span>
 *
 * v2: strips zero-width / invisible junk characters (U+200B etc.) that were
 * present in the source First Name data and were causing the value to be
 * rejected and fall back to "Friend".
 *
 * Safe by design:
 *   - writes with textContent, never innerHTML (URL values are untrusted)
 *   - validates the value; anything missing or odd leaves "Friend" in place
 *   - does nothing to registrations; this only changes display text
 */
(function () {
  'use strict';

  function hydrate() {
    var el = document.getElementById('lm-first-name');
    if (!el) return;

    var raw = '';
    try {
      raw = new URLSearchParams(window.location.search).get('cfirstname') || '';
    } catch (e) {
      return; // very old browser without URLSearchParams — keep "Friend"
    }

    // Clean the incoming value. The source data contained repeated zero-width
    // spaces (U+200B) after the name, which is why v1 rejected it.
    var name = raw
      .replace(/[​-‍⁠﻿]/g, '') // zero-width space, ZWNJ, ZWJ, word joiner, BOM
      .replace(/[\p{Cf}\p{Cc}]/gu, '')             // any remaining format / control chars
      .replace(/\s+/g, ' ')                        // collapse runs of whitespace
      .trim();

    if (!name || name.length > 40) return;               // missing or junk -> keep "Friend"
    if (!/^[\p{L}\p{M}'’.\- ]+$/u.test(name)) return;     // letters, marks, apostrophes, hyphens, spaces only

    el.textContent = name.charAt(0).toUpperCase() + name.slice(1);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hydrate);
  } else {
    hydrate();
  }
})();

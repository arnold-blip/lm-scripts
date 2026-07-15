/* ============================================================================
 * LM : REG : Forum Info Form — Contact From URL (script)  [PILOT]
 * Host at: https://arnold-blip.github.io/lm-scripts/forum-info-contact-from-url.js
 *
 * WHAT THIS DOES:
 *   Fills the Step 02 info form's hidden Contact + Email fields from the URL
 *   instead of the visitor cookie. The buyer arrives on a link that carries
 *   ?cuid=<Contact Unique ID>&cemail=<Email>, and we write those into the
 *   hidden inputs the form posts to Ontraport.
 *
 * WHY (the bug this fixes):
 *   The form's hidden Contact field was set to [Visitor//Unique ID] (a cookie).
 *   If the buyer came back later, switched device, or blocked cookies, the
 *   cookie was gone, the field posted EMPTY, and Ontraport created a
 *   registration with no contact — an orphan. Their answers were lost.
 *   A link parameter cannot go stale the way a cookie can, so this is reliable
 *   for both the post-checkout redirect AND the "you forgot to fill it out"
 *   reminder emails.
 *
 * WHY it overwrites unconditionally (not just when blank):
 *   The URL value is the person who just paid / who the email was sent to, so
 *   it is authoritative. This also cures the same-browser couple/session bug,
 *   where a second registration mis-linked to the first person's cookie. The
 *   URL wins over the cookie, so the right person is linked every time.
 *
 * PARAM NAMES:
 *   cuid / cemail are used on purpose. Ontraport already ships its own hidden
 *   input named "uid" on this page, so a ?uid= param would collide. Do not
 *   rename these without also updating the checkout redirect and the reminder
 *   email links.
 *
 * TARGET FIELDS (verified from the live page markup):
 *   f2213//unique_id  = Contact  (was empty)
 *   f2674             = Email    (was empty)
 *   f2214//unique_id  = Event    (hardcoded 3L8I7PS — left untouched)
 * ============================================================================ */
(function () {
  'use strict';

  function setHidden(name, value) {
    if (!value) return;
    var els = document.getElementsByName(name);
    for (var i = 0; i < els.length; i++) {
      els[i].value = value;
    }
  }

  function apply() {
    var p = new URLSearchParams(window.location.search);
    setHidden('f2213//unique_id', p.get('cuid'));   // Contact
    setHidden('f2674', p.get('cemail'));            // Email
  }

  // Run now (footer script — the form inputs already exist), again on DOM
  // ready as a belt-and-braces, and once more at submit-capture in case
  // Ontraport rewrites the field just before it posts.
  apply();
  document.addEventListener('DOMContentLoaded', apply);
  document.addEventListener('submit', apply, true);
})();

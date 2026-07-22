/* ============================================================================
 * LM : REG : Forum Info Form — Contact From URL (script)  [PILOT]   v2
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
 * v2 FIX — the "+" in email addresses:
 *   URLSearchParams follows form-encoding rules, where a literal "+" in the
 *   query string decodes to a SPACE. So cemail=a+b@gmail.com arrived as
 *   "a b@gmail.com" — an invalid address. Ontraport could not match it, and
 *   combined with a bad cuid it created a blank contact + duplicate
 *   registration. We now read the raw query string and use decodeURIComponent
 *   only, which leaves "+" intact. Email addresses cannot contain spaces, so
 *   treating "+" as a literal plus is always correct here.
 *
 * !! THE LINK MATTERS AS MUCH AS THIS SCRIPT !!
 *   cuid MUST be the CONTACT's unique id, not the Registration's. In a
 *   Registration-context email, [Unique ID] resolves to the REGISTRATION —
 *   which no contact will ever match, so Ontraport creates a new blank
 *   contact. You must use the relationship hop:
 *
 *     ?cuid=[Contact//Unique ID]&cemail=[Contact//Email]&cfirstname=[Contact//First Name]
 *
 *   Insert each token with the merge-field picker; typed tokens post literally.
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

  // Read a query param WITHOUT the "+" -> space conversion that
  // URLSearchParams performs. Also strips zero-width junk that has been
  // observed in the source contact data.
  function rawParam(name) {
    var m = new RegExp('[?&]' + name + '=([^&#]*)').exec(window.location.search);
    if (!m) return '';
    var value;
    try {
      value = decodeURIComponent(m[1]);
    } catch (e) {
      return ''; // malformed encoding — post nothing rather than garbage
    }
    return value
      .replace(/[​-‍⁠﻿]/g, '')
      .replace(/[\p{Cf}\p{Cc}]/gu, '')
      .trim();
  }

  function setHidden(name, value) {
    if (!value) return;
    var els = document.getElementsByName(name);
    for (var i = 0; i < els.length; i++) {
      els[i].value = value;
    }
  }

  function apply() {
    setHidden('f2213//unique_id', rawParam('cuid'));   // Contact
    setHidden('f2674', rawParam('cemail'));            // Email
  }

  // Run now (footer script — the form inputs already exist), again on DOM
  // ready as a belt-and-braces, and once more at submit-capture in case
  // Ontraport rewrites the field just before it posts.
  apply();
  document.addEventListener('DOMContentLoaded', apply);
  document.addEventListener('submit', apply, true);
})();

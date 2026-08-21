/* ---------- submit ---------- */

var ENDPOINT = 'https://tobinjarrett.awesomate.io/webhook/tuesday-graduate-survey';

/* Same 63 columns, same order, as the Sheet header row. */
var SCHEMA = ['submitted_at','rid','started_at','survey','version','forum_year','programs_count','prior_tuesdays','prev_overall_satisfaction','prev_inspiration_self','prev_inspiration_guests','prev_value_guests','prev_comfort_inviting','prev_confidence_guest_value','prev_represented_landmark','prev_clarity_learn','prev_ease_next_step','prev_freedom_choice','prev_enthusiasm_inviting','prev_valued','prev_wish_different','tonight_overall_satisfaction','tonight_inspiration_self','tonight_inspiration_guests','tonight_value_guests','tonight_comfort_inviting','tonight_confidence_guest_value','tonight_represented_landmark','tonight_clarity_learn','tonight_ease_next_step','tonight_freedom_choice','tonight_enthusiasm_inviting','room_welcomed','room_engaged','room_value','room_inspired','room_understanding','room_relevance','room_enough_info','room_clear_next_step','room_free_decision','invite_natural','invite_space_to_consider','invite_respected_freedom','invite_consistent_spirit','format_preference','tonight_worked_well','worked_for_others','would_change','retain_from_previous','contribute_pilots','contribute_research','contribute_expertise','contribute_advisory','contribute_technology','contribute_outreach','contribute_access','contribute_new_initiatives','contribute_other','contribute_not_now','contribute_other_text','future_areas','capacities'];

function getRid() {
  try {
    var m = window.location.search.match(/[?&]rid=([^&#]*)/);
    return m ? decodeURIComponent(m[1]) : '';
  } catch (e) { return ''; }
}

function buildPayload() {
  var payload = {
    survey: 'tuesday-evening-graduate-survey',
    version: 2,
    rid: getRid(),
    started_at: startedAt,
    submitted_at: new Date().toISOString()
  };
  SCHEMA.forEach(function (k) {
    if (payload[k] !== undefined) return;
    var v = answers[k];
    payload[k] = (v === undefined || v === null) ? '' : v;
  });
  return payload;
}

function setSubmitError(msg) {
  var err = document.getElementById('submitError');
  if (!err) return;
  err.textContent = msg || '';
  err.hidden = !msg;
}

function submitSurvey() {
  var btn = document.querySelector('.chapter[data-ch="12"] .btn-next');
  setSubmitError('');

  var payload = buildPayload();

  try { localStorage.setItem(SUBMIT_KEY, JSON.stringify(payload)); } catch (e) {}

  if (btn) { btn.disabled = true; btn.textContent = 'Submitting\u2026'; }

  fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      localStorage.removeItem(STORAGE_KEY);
      goTo(LAST_CH);
    })
    .catch(function (e) {
      if (btn) { btn.disabled = false; btn.textContent = 'Submit'; }
      setSubmitError('We could not save your responses just now. Please check your connection and press Submit again \u2014 your answers are still here.');
      if (window.console) console.error('[survey] submit failed:', e);
    });
}

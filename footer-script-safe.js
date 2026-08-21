<script>
/* =====================================================================
   Tuesday Evening Graduate Survey - New Era Landmark Forum Pilot
   Self-contained: no external file, no GitHub dependency.
   Submits to n8n -> Google Sheet.
   Requires in the page body:
     <p id="submitError" class="submit-error" hidden></p>   (chapter 12)
   ===================================================================== */

var STORAGE_KEY = 'landmark_tuesday_survey_draft_v1';
var SUBMIT_KEY  = 'landmark_tuesday_survey_submitted_v1';
var LAST_CH = 13;   // thank-you screen index

var ENDPOINT = 'https://tobinjarrett.awesomate.io/webhook/tuesday-graduate-survey';

/* ---------- question config ---------- */

// Q4 / Q7 - intentionally paired dimensions, same order.
var PAIRED_DIMS = [
  { key: 'overall_satisfaction',
    prev: 'Your overall satisfaction with the evening',
    tonight: 'Your overall satisfaction with the evening' },
  { key: 'inspiration_self',
    prev: 'The degree of inspiration and possibility you experienced',
    tonight: 'The degree of inspiration and possibility you experienced' },
  { key: 'inspiration_guests',
    prev: 'The degree of inspiration and possibility the evening provided to guests',
    tonight: 'The degree of inspiration and possibility the evening provided to guests' },
  { key: 'value_guests',
    prev: 'The value you felt the evening provided to guests',
    tonight: 'The value you felt the evening provided to guests' },
  { key: 'comfort_inviting',
    prev: 'How comfortable you felt inviting someone you cared about',
    tonight: 'How comfortable you felt having people you care about participate' },
  { key: 'confidence_guest_value',
    prev: 'How confident you felt that your guests would have a valuable experience',
    tonight: 'How confident you felt that guests would experience value' },
  { key: 'represented_landmark',
    prev: 'How well the evening represented what you value about Landmark',
    tonight: 'How well the evening represented what you value about Landmark' },
  { key: 'clarity_learn',
    prev: 'How clear it was for interested guests to learn about the Landmark Forum',
    tonight: 'How clear it was for interested guests to learn about the Landmark Forum' },
  { key: 'ease_next_step',
    prev: 'How easy it was for an interested guest to take a next step',
    tonight: 'How easy it was for an interested guest to take a next step' },
  { key: 'freedom_choice',
    prev: 'The degree to which guests seemed free to make their own choice about participating',
    tonight: 'The degree to which guests seemed free to make their own choice about participating' },
  { key: 'enthusiasm_inviting',
    prev: 'Your enthusiasm about inviting guests to another Tuesday Evening',
    tonight: 'Your enthusiasm about inviting guests to a future Tuesday Evening like this one' }
];
var PAIRED_SPLIT = 6; // first page shows dims 1-6, second page 7-11

// Q8 - 1 = Not at all / 10 = Extremely
var ROOM_DIMS = [
  { key: 'welcomed',        label: 'Feel welcomed and included' },
  { key: 'engaged',         label: 'Be engaged in the evening' },
  { key: 'value',           label: 'Experience value from participating' },
  { key: 'inspired',        label: 'Feel inspired by what they heard and experienced' },
  { key: 'understanding',   label: 'Gain a meaningful understanding of what the Landmark Forum is' },
  { key: 'relevance',       label: 'See how the Landmark Forum might be relevant to their own lives' },
  { key: 'enough_info',     label: 'Have enough information to decide whether they wanted to learn more' },
  { key: 'clear_next_step', label: 'Have a clear and easy way to take a next step if interested' },
  { key: 'free_decision',   label: 'Feel free to make that decision for themselves' }
];
var ROOM_SPLIT = 5; // first page 1-5, second page 6-9

// Q9 - 1 = Strongly Disagree / 10 = Strongly Agree
// ("The experience and possibilities..." item removed Aug 11 per Kate)
var INVITE_DIMS = [
  { key: 'natural',           label: 'The invitation to participate felt natural within the evening' },
  { key: 'space_to_consider', label: 'Guests had the space to consider whether the Landmark Forum was right for them' },
  { key: 'respected_freedom', label: 'The invitation respected each person’s freedom to choose' },
  { key: 'consistent_spirit', label: 'The way the Landmark Forum was presented was consistent with the spirit of Landmark’s work' }
];

var PROGRAMS_OPTS = [
  { value: '1',    label: '1' },
  { value: '2',    label: '2' },
  { value: '3-5',  label: '3–5' },
  { value: '6-10', label: '6–10' },
  { value: '10+',  label: 'More than 10' }
];

var PRIOR_TUESDAYS_OPTS = [
  { value: 'none', label: 'None — this was my first' },
  { value: '1-2',  label: '1–2' },
  { value: '3-5',  label: '3–5' },
  { value: '6-10', label: '6–10' },
  { value: '10+',  label: 'More than 10' }
];

// Q10 - overall preference measure
var PREFERENCE_OPTS = [
  { value: 'strongly_prefer_previous', label: 'Strongly prefer the <strong>previous format</strong>' },
  { value: 'somewhat_prefer_previous', label: 'Somewhat prefer the <strong>previous format</strong>' },
  { value: 'no_preference',            label: 'No preference' },
  { value: 'somewhat_prefer_new',      label: 'Somewhat prefer this <strong>new format</strong>' },
  { value: 'strongly_prefer_new',      label: 'Strongly prefer this <strong>new format</strong>' }
];

// Q16 - each stored individually
var CONTRIBUTE_OPTS = [
  { key: 'pilots',          label: 'Participating in future pilots or testing' },
  { key: 'research',        label: 'Providing feedback or participating in research' },
  { key: 'expertise',       label: 'Contributing professional expertise' },
  { key: 'advisory',        label: 'Participating in advisory groups or committees' },
  { key: 'technology',      label: 'Supporting technology or digital innovation' },
  { key: 'outreach',        label: 'Supporting community outreach and partnerships' },
  { key: 'access',          label: 'Helping expand access to Landmark’s programs' },
  { key: 'new_initiatives', label: 'Supporting new initiatives or areas of development' },
  { key: 'other',           label: 'Other:', other: true },
  { key: 'not_now',         label: 'Not at this time', exclusive: true }
];

/* Same 63 columns, same order, as the Sheet header row. */
var SCHEMA = ['submitted_at','rid','started_at','survey','version','forum_year','programs_count','prior_tuesdays','prev_overall_satisfaction','prev_inspiration_self','prev_inspiration_guests','prev_value_guests','prev_comfort_inviting','prev_confidence_guest_value','prev_represented_landmark','prev_clarity_learn','prev_ease_next_step','prev_freedom_choice','prev_enthusiasm_inviting','prev_valued','prev_wish_different','tonight_overall_satisfaction','tonight_inspiration_self','tonight_inspiration_guests','tonight_value_guests','tonight_comfort_inviting','tonight_confidence_guest_value','tonight_represented_landmark','tonight_clarity_learn','tonight_ease_next_step','tonight_freedom_choice','tonight_enthusiasm_inviting','room_welcomed','room_engaged','room_value','room_inspired','room_understanding','room_relevance','room_enough_info','room_clear_next_step','room_free_decision','invite_natural','invite_space_to_consider','invite_respected_freedom','invite_consistent_spirit','format_preference','tonight_worked_well','worked_for_others','would_change','retain_from_previous','contribute_pilots','contribute_research','contribute_expertise','contribute_advisory','contribute_technology','contribute_outreach','contribute_access','contribute_new_initiatives','contribute_other','contribute_not_now','contribute_other_text','future_areas','capacities'];

/* ---------- state ---------- */
var answers = {};
var currentChapter = 0;
var startedAt = null;

/* ---------- rendering ---------- */

function renderRatingGroup(containerId, dims, labelField, keyPrefix) {
  var el = document.getElementById(containerId);
  if (!el) return;
  var html = '';
  dims.forEach(function (d) {
    var fieldKey = keyPrefix + d.key;
    html += '<div class="rate-row" data-field="' + fieldKey + '">' +
              '<p class="rate-statement">' + (d[labelField] || d.label) + '</p>' +
              '<div class="rate-scale" role="radiogroup" aria-label="Rate 1 to 10">';
    for (var n = 1; n <= 10; n++) {
      html += '<button type="button" class="rate-btn" data-val="' + n + '" aria-label="' + n + '">' + n + '</button>';
    }
    html += '</div></div>';
  });
  el.innerHTML = html;
  el.addEventListener('click', function (e) {
    var btn = e.target.closest('.rate-btn');
    if (!btn) return;
    var row = btn.closest('.rate-row');
    row.querySelectorAll('.rate-btn').forEach(function (b) { b.classList.remove('sel'); });
    btn.classList.add('sel');
    answers[row.dataset.field] = parseInt(btn.dataset.val, 10);
    saveDraft();
  });
}

function renderOptions(containerId, opts, fieldKey) {
  var el = document.getElementById(containerId);
  if (!el) return;
  var html = '';
  opts.forEach(function (o) {
    html += '<button type="button" class="opt" data-val="' + o.value + '">' +
              '<span class="mark"></span><span>' + o.label + '</span></button>';
  });
  el.innerHTML = html;
  el.addEventListener('click', function (e) {
    var opt = e.target.closest('.opt');
    if (!opt) return;
    el.querySelectorAll('.opt').forEach(function (b) { b.classList.remove('sel'); });
    opt.classList.add('sel');
    answers[fieldKey] = opt.dataset.val;
    saveDraft();
  });
}

function renderContribute() {
  var el = document.getElementById('optsContribute');
  if (!el) return;
  var html = '';
  CONTRIBUTE_OPTS.forEach(function (o) {
    html += '<button type="button" class="opt check" data-ckey="' + o.key + '">' +
              '<span class="mark"></span><span>' + o.label + '</span>' +
              (o.other ? '<input type="text" class="other-input" id="contribOther" aria-label="Other">' : '') +
            '</button>';
  });
  el.innerHTML = html;
  el.addEventListener('click', function (e) {
    if (e.target.id === 'contribOther') return; // typing in Other field
    var opt = e.target.closest('.opt');
    if (!opt) return;
    var key = opt.dataset.ckey;
    var def = CONTRIBUTE_OPTS.find(function (o) { return o.key === key; });
    var willSelect = !opt.classList.contains('sel');
    if (willSelect && def.exclusive) {
      // "Not at this time" clears everything else
      el.querySelectorAll('.opt').forEach(function (b) { b.classList.remove('sel'); });
      CONTRIBUTE_OPTS.forEach(function (o) { answers['contribute_' + o.key] = false; });
    } else if (willSelect) {
      // selecting any real area clears "Not at this time"
      var nn = el.querySelector('[data-ckey="not_now"]');
      if (nn) nn.classList.remove('sel');
      answers['contribute_not_now'] = false;
    }
    opt.classList.toggle('sel', willSelect);
    answers['contribute_' + key] = willSelect;
    if (key === 'other' && willSelect) {
      var inp = document.getElementById('contribOther');
      if (inp) inp.focus();
    }
    saveDraft();
  });
  var otherField = document.getElementById('contribOther');
  if (otherField) {
    otherField.addEventListener('input', function (e) {
      answers['contribute_other_text'] = e.target.value;
      var otherOpt = el.querySelector('[data-ckey="other"]');
      if (e.target.value && !otherOpt.classList.contains('sel')) {
        otherOpt.classList.add('sel');
        answers['contribute_other'] = true;
      }
      saveDraft();
    });
  }
}

/* ---------- textareas: auto-expand + bind ---------- */
function bindTextareas() {
  document.querySelectorAll('textarea[data-key]').forEach(function (ta) {
    ta.addEventListener('input', function () {
      autoGrow(ta);
      answers[ta.dataset.key] = ta.value;
      saveDraft();
    });
  });
}
function autoGrow(ta) {
  ta.style.height = 'auto';
  ta.style.height = Math.max(84, ta.scrollHeight) + 'px';
}

/* ---------- year input ---------- */
function bindYear() {
  var y = document.getElementById('forumYear');
  if (!y) return;
  y.addEventListener('input', function () {
    y.value = y.value.replace(/[^0-9]/g, '').slice(0, 4);
    answers['forum_year'] = y.value;
    saveDraft();
  });
}

/* ---------- navigation ---------- */
function goTo(ch) {
  document.querySelectorAll('.chapter').forEach(function (s) { s.classList.remove('active'); });
  var target = document.querySelector('.chapter[data-ch="' + ch + '"]');
  if (!target) return;
  target.classList.add('active');
  currentChapter = ch;
  updateProgress();
  window.scrollTo({ top: 0, behavior: 'auto' });
  saveDraft();
}

function updateProgress() {
  var pct = currentChapter === 0 ? 0 : Math.min(100, Math.round((currentChapter / LAST_CH) * 100));
  if (currentChapter === LAST_CH) pct = 100;
  var fill = document.getElementById('progressFill');
  if (fill) fill.style.width = pct + '%';
}

function beginSurvey() {
  if (!startedAt) startedAt = new Date().toISOString();
  var draft = loadDraftRaw();
  if (draft && draft.chapter > 0 && draft.chapter < LAST_CH) {
    goTo(draft.chapter);
  } else {
    goTo(1);
  }
}

function startOver() {
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
}

/* ---------- draft persistence ---------- */
function saveDraft() {
  if (currentChapter === LAST_CH) return; // submitted - draft already cleared
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      answers: answers,
      chapter: currentChapter,
      started_at: startedAt
    }));
  } catch (e) { /* storage unavailable - continue without drafts */ }
}
function loadDraftRaw() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
function restoreDraft() {
  var draft = loadDraftRaw();
  if (!draft || !draft.answers) return;
  answers = draft.answers;
  startedAt = draft.started_at || null;

  // ratings
  document.querySelectorAll('.rate-row').forEach(function (row) {
    var v = answers[row.dataset.field];
    if (v) {
      var btn = row.querySelector('.rate-btn[data-val="' + v + '"]');
      if (btn) btn.classList.add('sel');
    }
  });
  // single-selects
  [['optsPrograms', 'programs_count'], ['optsPriorTuesdays', 'prior_tuesdays'], ['optsPreference', 'format_preference']]
    .forEach(function (pair) {
      var v = answers[pair[1]];
      if (v) {
        var b = document.querySelector('#' + pair[0] + ' .opt[data-val="' + v + '"]');
        if (b) b.classList.add('sel');
      }
    });
  // contribute checkboxes
  CONTRIBUTE_OPTS.forEach(function (o) {
    if (answers['contribute_' + o.key]) {
      var b = document.querySelector('#optsContribute .opt[data-ckey="' + o.key + '"]');
      if (b) b.classList.add('sel');
    }
  });
  var otherInp = document.getElementById('contribOther');
  if (otherInp && answers['contribute_other_text']) otherInp.value = answers['contribute_other_text'];
  // textareas
  document.querySelectorAll('textarea[data-key]').forEach(function (ta) {
    if (answers[ta.dataset.key]) { ta.value = answers[ta.dataset.key]; autoGrow(ta); }
  });
  // year
  var yearEl = document.getElementById('forumYear');
  if (yearEl && answers['forum_year']) yearEl.value = answers['forum_year'];

  if (draft.chapter > 0 && draft.chapter < LAST_CH) {
    var note = document.getElementById('resumeNote');
    if (note) note.hidden = false;
    var bb = document.getElementById('beginBtn');
    if (bb) bb.textContent = 'Continue where you left off';
  }
}

/* ---------- submit ---------- */

/* The emailed link carries ?rid= - the only thing tying a response to a
   person and a cohort. */
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
  /* Fill EVERY schema key. Skipped questions must become empty cells,
     not missing keys, or the Sheet columns drift row to row. */
  SCHEMA.forEach(function (k) {
    if (payload[k] !== undefined) return;
    var v = answers[k];
    payload[k] = (v === undefined || v === null) ? '' : v;
  });
  return payload;
}

function setSubmitError(msg) {
  var err = document.getElementById('submitError');
  if (!err) {                       // markup missing - never fail silently
    if (msg) window.alert(msg);
    return;
  }
  err.textContent = msg || '';
  err.hidden = !msg;
}

function submitSurvey() {
  var btn = document.querySelector('.chapter[data-ch="12"] .btn-next');
  setSubmitError('');

  var payload = buildPayload();

  /* Local copy kept as a safety net until the POST is confirmed. */
  try { localStorage.setItem(SUBMIT_KEY, JSON.stringify(payload)); } catch (e) {}

  if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; }

  fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      /* Only now is the draft safe to forget. */
      localStorage.removeItem(STORAGE_KEY);
      goTo(LAST_CH);
    })
    .catch(function (e) {
      /* Draft deliberately NOT cleared - answers survive a retry. */
      if (btn) { btn.disabled = false; btn.textContent = 'Submit'; }
      setSubmitError('We could not save your responses just now. Please check your connection and press Submit again — your answers are still here.');
      if (window.console) console.error('[survey] submit failed:', e);
    });
}

/* ---------- init ---------- */
function initSurvey() {
  renderRatingGroup('ratePrevA',    PAIRED_DIMS.slice(0, PAIRED_SPLIT), 'prev',    'prev_');
  renderRatingGroup('ratePrevB',    PAIRED_DIMS.slice(PAIRED_SPLIT),    'prev',    'prev_');
  renderRatingGroup('rateTonightA', PAIRED_DIMS.slice(0, PAIRED_SPLIT), 'tonight', 'tonight_');
  renderRatingGroup('rateTonightB', PAIRED_DIMS.slice(PAIRED_SPLIT),    'tonight', 'tonight_');
  renderRatingGroup('rateRoomA',    ROOM_DIMS.slice(0, ROOM_SPLIT),     'label',   'room_');
  renderRatingGroup('rateRoomB',    ROOM_DIMS.slice(ROOM_SPLIT),        'label',   'room_');
  renderRatingGroup('rateInvite',   INVITE_DIMS,                        'label',   'invite_');
  renderOptions('optsPrograms',      PROGRAMS_OPTS,       'programs_count');
  renderOptions('optsPriorTuesdays', PRIOR_TUESDAYS_OPTS, 'prior_tuesdays');
  renderOptions('optsPreference',    PREFERENCE_OPTS,     'format_preference');
  renderContribute();
  bindTextareas();
  bindYear();
  restoreDraft();
  updateProgress();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSurvey);
} else {
  initSurvey();
}
</script>

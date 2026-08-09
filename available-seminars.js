/* ============================================================================
 * SEM : SELECTION : Available Seminars (script)  [PILOT]
 * Host at: https://arnold-blip.github.io/lm-scripts/available-seminars.js
 *
 * WHAT THIS DOES:
 *   Drives the Available Seminars DCMS page (page bound to Registrations 10001;
 *   two grids loop over Events 10000). Runs identically on every OP-rendered card.
 *     1. hydrateSeminarCards() reads each card's hidden [Path//Field] merge spans
 *        (.mf-*) into card.dataset + sets the <img>, description, meeting pattern,
 *        and "Delivered in:" line. (OP merges resolve in text, NOT attributes,
 *        so we feed values through hidden spans and distribute them here.)
 *     2. enhanceCards() splits the course title, builds the compact date line and
 *        the Online/In-Person badge, derives country from the IANA timezone.
 *     3. Country/language filters for the "Other Available Seminars" grid.
 *     4. Confirm modal + DST-correct multi-session .ics ("add to calendar").
 *
 * WHY EXTERNAL (not inline in an OP Custom HTML block):
 *   Ontraport's Custom HTML sanitizer rejects large inline scripts (the Blob /
 *   URL.createObjectURL / a.click() download reads as "suspicious"). A single
 *   <script src> from GitHub Pages passes. All interactivity is wired via event
 *   delegation, so the OP markup carries NO inline on* handlers.
 *
 * 2026-08-09 UPDATE:
 *   - Card blurb: the field is Course Card Description (oCourses f3142). There is no
 *     "Course Short Description" field, so the old .mf-descshort-only lookup merged
 *     empty. The back now takes whichever of .mf-cardDesc / .mf-descshort / .mf-desc
 *     carries a value short enough to BE a blurb, so it works however the block is
 *     wired — including the live page, where .mf-desc itself was repointed at f3142.
 *   - Session Dates: event 272 was rewritten to "Sep 10, 17, 24, Oct 1, …" — the
 *     compact form, which carries no year — so every date came back y=0, datesValid()
 *     was false, and the confirm modal's range line ("Jul 20 – Oct 5") rendered blank.
 *     Yearless lists now get an inferred year for DISPLAY only and are flagged
 *     guessed:true. The .ics still requires a year someone actually typed, so a wrong
 *     guess can never put a real appointment on the wrong day.
 *
 * OP MARKUP CONTRACT (ids/classes this script drives):
 *   cards: .sem-card > .mf-* (hidden feed), .flip, .flip-cap .fc-eyebrow/.fc-title,
 *          .flip-back p, .sem-photo, .when-day, .when-dates, .sem-lang, .sem-badges,
 *          .sem-select
 *   filters (Other grid): #countryFilter #langFilter #othersGrid #noResults
 *                         #othersToggle #othersBody #othersHint
 *   modal: #confirmOverlay #cmTitle #cmSub #ssCount #ssRange #ssDates
 *          #regForm #regEvent #regCourse #exceptionCheck .confirm-close .confirm-back
 *          #confirmSuccess #successText #addCalBtn
 * ========================================================================== */
(function () {
  'use strict';
  if (window.__lmSeminarsInit) return;   // if the script is loaded twice, only the first copy runs
  window.__lmSeminarsInit = true;

  var MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  var DAY = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  var MONTH_IDX = {jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
  /* Anything longer than this in the blurb feed is the full rich-text Course Description,
     not a Course Card Description — treat it as the long fallback. */
  var CARD_DESC_MAX = 420;

  /* ---- dates ----
   * Session Dates is SUPPOSED to be one YYYY-MM-DD per line, but events in the wild also carry
   * "THURSDAY, 10 SEP 2026" per line and "March 2, 9, April 6, 13, 20" on one line. The old split-on-
   * comma parser turned both into raw text, which is what Kate saw. This scanner reads all three and
   * always renders the reference's compact "Jul 20, 27, Aug 3, …" line.
   * A date whose year we never saw gets y=0 -> datesValid() is false -> the .ics button stays hidden
   * rather than emitting a calendar file with a guessed year. */
  function monthNum(word){ return MONTH_IDX[(word||"").slice(0,3).toLowerCase()] || 0; }
  var DATE_RE = new RegExp(
    "(\\d{4})-(\\d{1,2})-(\\d{1,2})(?:\\s+(\\d{1,2}:\\d{2}\\s*(?:[AaPp][Mm])?))?" +  //  1-4  2026-09-10 [19:00]
    "|(\\d{1,2})(?:st|nd|rd|th)?\\s+([A-Za-z]{3,9})\\.?(?:\\s*,?\\s*(\\d{4})(?!\\d))?" +   //  5-7  10 Sep [2026]
    "|([A-Za-z]{3,9})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*,?\\s*(\\d{4})(?!\\d))?" +   //  8-10 Sep 10[, 2026]
    "|(\\d{1,2})(?:st|nd|rd|th)?",                                                   // 11    bare day, inherits month
    "g");
  function parseDates(raw){
    var s = String(raw==null?"":raw)
      .replace(/<[^>]*>/g," ")                                                        // rich-text feeds arrive wrapped in <p>
      .replace(/&nbsp;/gi," ")
      .replace(/\b(mon|tues?|wed(?:nes)?|thur?s?|fri|sat(?:ur)?|sun)(?:day)?\b\.?/gi," ")  // weekday names are noise
      .replace(/\s+/g," ");
    var out=[], m, curM=0, curY=0;
    DATE_RE.lastIndex=0;
    while((m=DATE_RE.exec(s))){
      if(m[0]==="") { DATE_RE.lastIndex++; continue; }
      var d=0, mo=0, y=0, tm=null;
      var after = s.charAt(m.index + m[0].length);
      if(m[1]){ y=+m[1]; mo=+m[2]; d=+m[3]; tm=m[4]||null; }
      else if(m[5] && m[6]){ if(/\d/.test(s.charAt(m.index-1))) continue; mo=monthNum(m[6]); d=+m[5]; y=m[7]?+m[7]:0; if(!m[7] && /\d/.test(after)) continue; }
      else if(m[8] && m[9]){ if(!m[10] && /\d/.test(after)) continue; mo=monthNum(m[8]); d=+m[9]; y=m[10]?+m[10]:0; }
      else if(m[11]){ if(/\d/.test(s.charAt(m.index-1)) || /\d/.test(after)) continue; d=+m[11]; mo=curM; }
      if(!mo || mo>12 || !d || d>31) continue;
      if(y) curY=y;
      else if(curY){ y = (curM && mo<curM) ? curY+1 : curY; curY=y; }                 // list rolls into the next year
      curM=mo;
      out.push({y:y,m:mo,d:d,time:tm});
    }
    for(var i=out.length-2;i>=0;i--){                                                 // back-fill years typed only once, at the end
      if(!out[i].y && out[i+1].y) out[i].y = out[i].m > out[i+1].m ? out[i+1].y-1 : out[i+1].y;
    }
    /* "Aug 4th - Aug 6th" is a span, not a session list — its two endpoints are not two
       sessions, so leave it yearless and let the caller fall back to the raw text. */
    return /\s[-–—]\s/.test(s) ? out : inferYears(out);
  }
  /* A list where NOBODY typed a year ("Sep 10, 17, 24, Oct 1, 8") still has to render a
     range in the confirm modal, so infer one and mark it guessed. Callers that write a
     real calendar entry use datesTyped() instead and skip these. */
  function inferYears(out){
    if(!out.length) return out;
    for(var i=0;i<out.length;i++){ if(out[i].y) return out; }                         // someone typed a year — trust the fill above
    var now=new Date(), y=now.getFullYear(), lastM=0;
    if(out[0].m < now.getMonth()+1-6) y++;                                            // starts well behind today -> next year's run
    out.forEach(function(o){ if(lastM && o.m<lastM) y++; o.y=y; o.guessed=true; lastM=o.m; });
    return out;
  }
  function compactDates(dates){
    var out=[],lastM=null;
    dates.forEach(function(o){ out.push(o.m!==lastM?MON[o.m-1]+" "+o.d:String(o.d)); lastM=o.m; });
    return out.join(", ");
  }
  function rangeLabel(dates){
    if(!dates.length) return "";
    var a=dates[0], b=dates[dates.length-1];
    var base=MON[a.m-1]+" "+a.d+" – "+MON[b.m-1]+" "+b.d;
    return b.y>a.y ? base+", "+b.y : base;
  }
  function datesValid(dates){ return dates.length>0 && dates.every(function(o){ return o.y>1900 && o.m>=1 && o.m<=12 && o.d>=1 && o.d<=31; }); }
  /* good enough to PRINT vs good enough to put in someone's calendar */
  function datesTyped(dates){ return datesValid(dates) && dates.every(function(o){ return !o.guessed; }); }
  function rawDateLine(raw){ return String(raw==null?"":raw).replace(/<[^>]*>/g," ").split(/[\n,]+/).map(function(s){return s.trim();}).filter(Boolean).join(", "); }
  function parseTime(str){ var m=(str||"").trim().match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i); if(!m) return null; var h=parseInt(m[1],10), mi=m[2]?parseInt(m[2],10):0, ap=(m[3]||"").toLowerCase(); if(ap==="pm"&&h<12)h+=12; if(ap==="am"&&h===12)h=0; return {h:h,m:mi}; }
  /* ---- date display on the CARD ----
     Kate, 2026-08: "you've got all the dates listed here, that's not right … only once somebody
     clicks here should it list all the dates." So the card carries the meeting pattern plus the
     span ("Sep 10 – Dec 3"), and the full session list lives in the confirm modal behind Select. */
  function dateLine(raw){
    var p=parseDates(raw);
    if(!datesValid(p)) return rawDateLine(raw);      // partial/unparseable -> show it exactly as typed
    return rangeLabel(p);
  }
  /* fallback for a blank Event Meeting Pattern, so the card never shows an empty bold line */
  function dayLine(dates,start){
    if(!dates.length || !dates[0].y) return "";
    var w=DAY[new Date(dates[0].y,dates[0].m-1,dates[0].d).getDay()];
    return w+"s"+(start?", "+String(start).trim():"");
  }

  /* ---- IANA + DST-correct wall-time -> UTC (no library) ---- */
  function ianaOf(t){ var m=(t||"").match(/\(([^)]+\/[^)]+)\)/); return m?m[1]:(t||"UTC"); }
  function tzOffset(date,tz){
    var dtf=new Intl.DateTimeFormat("en-US",{timeZone:tz,hour12:false,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit"});
    var p=dtf.formatToParts(date).reduce(function(a,x){a[x.type]=x.value;return a;},{});
    return Date.UTC(p.year,p.month-1,p.day,p.hour==="24"?0:p.hour,p.minute,p.second)-date.getTime();
  }
  function zonedToUTC(y,m,d,hh,mm,tz){ var g=Date.UTC(y,m-1,d,hh,mm,0); return new Date(g-tzOffset(new Date(g),tz)); }
  function icsStamp(dt){ return dt.toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,""); }
  function buildICS(data){
    var iana=ianaOf(data.tz);
    var st=parseTime(data.start)||{h:19,m:0};
    var en=parseTime(data.end)||{h:22,m:0};
    var L=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Landmark//Seminars//EN","CALSCALE:GREGORIAN"];
    data.dates.forEach(function(dt,i){
      var sH=st.h,sM=st.m,eH=en.h,eM=en.m;
      if(dt.time){ var t=parseTime(dt.time); if(t){ sH=t.h; sM=t.m; eH=t.h+3; eM=t.m; } }
      var s=zonedToUTC(dt.y,dt.m,dt.d,sH,sM,iana);
      var e=zonedToUTC(dt.y,dt.m,dt.d,eH,eM,iana);
      L.push("BEGIN:VEVENT","UID:"+data.eventId+"-s"+(i+1)+"@landmark","DTSTAMP:"+icsStamp(new Date()),
        "DTSTART:"+icsStamp(s),"DTEND:"+icsStamp(e),
        "SUMMARY:"+data.course+" – Session "+(i+1)+" of "+data.dates.length,
        "DESCRIPTION:"+(data.pattern||""),"LOCATION:"+(data.zoom||"Online (Zoom)"),"END:VEVENT");
    });
    L.push("END:VCALENDAR");
    return L.join("\r\n");
  }
  function downloadICS(data){
    if(!datesTyped(data.dates)) return;                     // never write a calendar file off a guessed year
    var blob=new Blob([buildICS(data)],{type:"text/calendar;charset=utf-8"});
    var a=document.createElement("a");
    a.href=URL.createObjectURL(blob);
    a.download=(data.course||"seminar").replace(/[^\w]+/g,"-").toLowerCase()+"-sessions.ics";
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
  }

  /* ---- IANA -> country (best-effort) ---- */
  var TZ_COUNTRY={"America/New_York":"United States","America/Chicago":"United States","America/Denver":"United States","America/Los_Angeles":"United States","America/Phoenix":"United States","America/Anchorage":"United States","Pacific/Honolulu":"United States","America/Mexico_City":"Mexico","America/Bogota":"Colombia","Europe/London":"United Kingdom","Europe/Paris":"Europe","Europe/Istanbul":"Turkey","Asia/Dubai":"United Arab Emirates","Asia/Kolkata":"India","Asia/Bangkok":"Thailand","Asia/Ho_Chi_Minh":"Vietnam","Asia/Singapore":"Singapore","Asia/Tokyo":"Japan","Australia/Sydney":"Australia","Pacific/Auckland":"New Zealand"};
  function countryFromTZ(t){ return TZ_COUNTRY[ianaOf(t)]||"Other"; }
  function splitTitle(name){ var i=(name||"").indexOf(":"); return i===-1?{eyebrow:name,main:""}:{eyebrow:name.slice(0,i).trim(),main:name.slice(i+1).trim()}; }
  /* trimmed value, or "" if the merge came back unresolved ("[Block//…]") — never paint a token */
  function val(s){ s=String(s==null?"":s).replace(/\s+/g," ").trim(); return /[\[\]]/.test(s)?"":s; }
  /* Event Language (Events f2321) is a dropdown, so OP merges either the label ("English") or the
     bare option id ("137") depending on how the block builds the token. Map the ids so the card
     reads the same either way. Option list verified against the account 2026-08-09. */
  var LANG_BY_ID={"134":"Hindi","135":"English (with Hindi as needed)","136":"Thai","137":"English"};
  function langLabel(v){ v=val(v); return LANG_BY_ID[v]||v; }
  /* OP sometimes delivers the field HTML-escaped; put <strong>/<em> back so the blurb can bold a phrase */
  function unwrapTags(s){
    s=String(s==null?"":s);
    if(!/<(strong|b|em|i)\b/i.test(s)) s=s.replace(/&lt;(\/?(?:strong|b|em|i))&gt;/gi,"<$1>");
    return s.replace(/&nbsp;/gi," ").trim();
  }
  /* The blurb feed, whatever the block calls it. Course Card Description (f3142) may be
     wired as .mf-cardDesc, as .mf-descshort, or straight into .mf-desc — the live page
     does the last of those. First span holding something short enough to be a blurb wins;
     a full rich-text Course Description falls through to the faded long treatment. */
  function backSource(card){
    var names=["cardDesc","descshort","desc"];
    for(var i=0;i<names.length;i++){
      var el=card.querySelector(".mf-"+names[i]);
      if(el && val(el.textContent) && val(el.textContent).length<=CARD_DESC_MAX) return el;
    }
    return null;
  }
  function cardData(card){
    var d=card.dataset;
    return {el:card,eventId:d.eventId,courseId:d.courseId,course:d.course,pattern:d.pattern,
      dates:parseDates(d.dates),datesRaw:d.dates,start:d.start,end:d.end,tz:d.tz,lang:d.lang,format:d.format,zoom:d.zoom};
  }

  /* ---- fill one card from its merge feed; skip if already done or not yet resolved ---- */
  /* No run-once latch. OP resolves this block's merges AFTER the script's first pass, so a card
     stamped data-ready on pass 1 was frozen half-built: the caption and description arrived later
     and never got split, centred or classed. Every pass now re-reads the card and re-applies only
     what actually changed, so the card heals itself the moment OP fills it in. Every write below is
     guarded by a difference check — without that, each write would retrigger the MutationObserver
     and the passes would never settle. data-ready is now a status flag, not a gate. */
  function fillCard(card){
    /* val() here, not raw text: an unresolved feed hands back the literal "[Block//…]" token, and
       anything downstream that consumed it did real damage — img.src="[Block//Course//Course Image
       ##link]" fired a 404, and splitTitle() found no colon in the token so the whole thing landed
       in the coral line. Treat a token as no data. */
    var mf=function(k){var el=card.querySelector(".mf-"+k);return el?val(el.textContent):"";};
    var keys=["eventId","courseId","course","image","desc","descshort","cardDesc","pattern","dates","start","end","tz","lang","format","zoom"];
    var anyData=false;
    keys.forEach(function(k){ var v=mf(k); card.dataset[k]=v; if(v) anyData=true; });
    var ebEl=card.querySelector(".fc-eyebrow");
    /* Fall back to whatever OP rendered into the card itself. On this page the block sometimes
       carries the course name and description inline instead of through .mf-* spans, and with no
       feed at all we would otherwise blank a card that was rendering fine. */
    if(!card.dataset.course) card.dataset.course=val(ebEl?ebEl.textContent:"");
    if(!anyData && !card.dataset.course) return;   // nothing to work with yet — a later pass will retry
    var img=card.querySelector(".sem-photo");
    if(img && card.dataset.image && img.getAttribute("src")!==card.dataset.image){ img.src=card.dataset.image; img.alt=card.dataset.course; }
    /* rebuild the flip-back as ONE clean paragraph. Prefer Course Card Description (the field the
       AI automation writes: one sentence, one <strong> phrase) and keep its bold; otherwise fall back
       to the long Course Description flattened to plain text, as before. */
    var back=card.querySelector(".flip-back");
    if(back){
      var mfs=backSource(card);
      /* No usable feed? Use whatever OP already rendered into the back. Length decides the
         treatment, not which span it came from: a blurb gets centred with its bold intact,
         a full rich-text description gets flattened and faded. */
      var srcHtml=unwrapTags(mfs?(mfs.innerHTML||""):(back.innerHTML||""));
      var probe=document.createElement("div");
      probe.innerHTML=srcHtml.replace(/<\/(p|li|div|ul|ol|h[1-6])>/gi," ").replace(/<br\s*\/?>/gi," ");
      var plain=(probe.textContent||"").replace(/\s+/g," ").trim();
      var bp;
      /* Re-render only when the source text actually changed — this is what lets a late OP merge
         land, while our own output on the next pass reads back identical and is left alone. */
      if(plain && plain!==card.getAttribute("data-back-src")){
        if(plain.length<=CARD_DESC_MAX){
          back.innerHTML=""; bp=document.createElement("p");
          bp.innerHTML=srcHtml.replace(/<(?!\/?(strong|b|em|i)\b)[^>]*>/gi,"").replace(/\s+/g," ").trim();
          back.appendChild(bp);
          card.classList.add("has-short-desc");   // lets the CSS centre it and drop the long-description fade
        } else {
          back.innerHTML=""; bp=document.createElement("p"); bp.textContent=plain; back.appendChild(bp);
          card.classList.remove("has-short-desc");
        }
        card.setAttribute("data-back-src",plain);
      }
    }
    /* Dates + language are rewritten, not filled-only: on the live page the block feeds the raw merge
       straight into these elements, so "fill only when empty" left Kate looking at
       "THURSDAY, 10 SEP 2026 …" and "Delivered in: .". */
    /* Only ever WRITE a line we have a value for. Blanking on missing data is what emptied the
       meeting pattern, the date list and the language line when the feed stopped resolving. */
    var set=function(el,txt){ if(el && (el.textContent||"")!==txt) el.textContent=txt; };   // write only on change
    var dsrc=card.dataset.dates || val((card.querySelector(".when-dates")||{}).textContent);
    var parsed=parseDates(dsrc);
    var wd=card.querySelector(".when-dates"); if(wd && dsrc) set(wd,dateLine(dsrc));
    var wday=card.querySelector(".when-day");
    if(wday){
      var pat=card.dataset.pattern || val(wday.textContent) || dayLine(parsed,card.dataset.start);
      if(pat) set(wday,pat);
      if(wday.style.display!==(pat?"":"none")) wday.style.display=pat?"":"none";
    }
    var lg=card.querySelector(".sem-lang");
    if(lg){
      var lang=langLabel(card.dataset.lang);
      if(lang) set(lg,"Delivered in: "+lang+".");
      if(lg.style.display!==(lang?"":"none")) lg.style.display=lang?"":"none";   // no orphan "Delivered in: ."
    }
    /* Split the caption even when the name was rendered inline by OP — that is why the whole
       "Breakthroughs: Living Outside the Box" sat in the coral line with no white subtext. */
    var t=splitTitle(card.dataset.course);
    var eb=ebEl, ti=card.querySelector(".fc-title");
    if(eb && t.eyebrow) set(eb,t.eyebrow);
    if(ti && t.main) set(ti,t.main);
    /* size bucket for the coral headline — long names like BREAKTHROUGHS: LIVING OUTSIDE THE BOX
       step down instead of blowing out of the photo (CSS drives the actual sizes) */
    if(eb){
      var n=(eb.textContent||"").trim().length, len=n<=11?"s":n<=17?"m":n<=25?"l":"xl";
      if(eb.getAttribute("data-len")!==len) eb.setAttribute("data-len",len);
    }
    var b=card.querySelector(".sem-badges");
    if(b&&!b.innerHTML){ var online=/online/i.test(card.dataset.format||""); b.innerHTML=online?'<span class="badge badge-online">Online</span>':'<span class="badge badge-inperson">In Person</span>'; }
    if(!card.dataset.country) card.dataset.country=countryFromTZ(card.dataset.tz);
    if(card.getAttribute("data-ready")!=="1") card.setAttribute("data-ready","1");   // status flag only — guarded so it can't retrigger the observer
  }
  var filtersReady=false, modalRoot=null;
  /* Always resolve modal fields INSIDE the live overlay. document.getElementById() picks the first
     match in the document, and OP can re-render a second copy of the block at any time — one stale
     duplicate and every value lands somewhere invisible. */
  function mEl(id){
    var root=(modalRoot&&modalRoot.parentNode)?modalRoot:document;
    return root.querySelector("#"+id) || document.getElementById(id);
  }
  /* OP wraps blocks in transformed containers, which traps a position:fixed overlay inside the
     block — a later opt-row then paints straight over the modal's dark header. Move the modal up
     to <body> so it covers the whole viewport.

     No run-once latch: OP re-renders the block after we move it (responsive copies, DCMS hydration),
     which puts a FRESH #confirmOverlay back inside the block. getElementById then returns that
     trapped copy — document order, and the body copy is last — so every subsequent open was the
     buried one. This re-checks on every pass instead. It is idempotent: once exactly one overlay
     exists and it is a child of <body>, nothing is touched, so the MutationObserver never re-fires. */
  function relocateModal(){
    var ovs=document.querySelectorAll("#confirmOverlay");
    if(!ovs.length) return;
    var keep=null;
    for(var i=0;i<ovs.length;i++){ if(ovs[i].parentNode===document.body){ keep=ovs[i]; break; } }  // prefer the one already moved — it may be open
    if(!keep) keep=ovs[0];
    /* Neutralise the duplicates by dropping their id rather than deleting the node. Removing a node
       from inside an OP block can make OP re-render and re-insert it, and with this function now
       running on every pass that becomes a remove/re-add loop. Stripping the id is a one-time edit:
       the element stops matching #confirmOverlay, so the next pass never sees it again. */
    for(var j=0;j<ovs.length;j++){
      if(ovs[j]===keep) continue;
      /* Strip the ids of the DESCENDANTS too, not just the overlay. getElementById returns the
         first match in document order, and the live copy is appended last — so leaving #cmTitle,
         #ssCount, #ssRange, #ssDates on a buried duplicate meant every value was written into the
         hidden copy and the visible modal stayed blank. */
      var inner=ovs[j].querySelectorAll("[id]");
      for(var k=0;k<inner.length;k++) inner[k].removeAttribute("id");
      ovs[j].removeAttribute("id");
      ovs[j].style.display="none";
    }
    if(keep.parentNode!==document.body) document.body.appendChild(keep);
    modalRoot=keep;
    if(keep.style.zIndex!=="99999") keep.style.zIndex="99999";         // out-rank every opt-row
  }
  function run(){
    relocateModal();
    var cards=document.querySelectorAll(".sem-card");
    if(!cards.length) return;
    cards.forEach(fillCard);
    othersGridEl();                                    // tag the grid block so the collapse CSS can reach it
    if(!filtersReady && othersCards().length){ populateFilters(); applyFilters(); filtersReady=true; }
  }

  /* ---- filters (Other grid) ---- */
  function populateFilters(){
    var cSel=document.getElementById("countryFilter"), lSel=document.getElementById("langFilter");
    if(!cSel||!lSel) return;
    var cards=Array.prototype.slice.call(othersCards());
    var uniq=function(a){return a.filter(function(v,i){return a.indexOf(v)===i;});};
    var countries=uniq(cards.map(function(c){return c.dataset.country;})).sort();
    countries=["United States"].concat(countries.filter(function(c){return c!=="United States";}));
    var langs=uniq(cards.map(function(c){return c.dataset.lang;})).sort();
    cSel.length=1; lSel.length=1;
    countries.forEach(function(c){ cSel.insertAdjacentHTML("beforeend",'<option value="'+c+'">'+c+'</option>'); });
    langs.forEach(function(l){ lSel.insertAdjacentHTML("beforeend",'<option value="'+l+'">'+l+'</option>'); });
    cSel.value="United States";
  }
  function applyFilters(){
    var cf=document.getElementById("countryFilter"); if(!cf) return;
    var country=cf.value, lang=document.getElementById("langFilter").value;
    cf.classList.toggle("selected",country!=="all");
    document.getElementById("langFilter").classList.toggle("selected",lang!=="all");
    var vis=0;
    Array.prototype.forEach.call(othersCards(),function(card){
      var show=(country==="all"||card.dataset.country===country)&&(lang==="all"||card.dataset.lang===lang);
      card.classList.toggle("hidden",!show); if(show)vis++;
    });
    var nr=document.getElementById("noResults"); if(nr) nr.classList.toggle("show",vis===0);
  }
  /* The "other seminars" grid is usually its own Ontraport block, so a custom HTML block cannot
     wrap it and #othersBody cannot contain it. Resolve it by id OR by the lm-others class that
     gets put on the OP block itself. */
  /* Prefer an explicit marker, but fall back to finding the grid ourselves: the "other" cards are
     the ones that come AFTER #othersToggle in document order. Walk up to the Ontraport row holding
     them and tag it .lm-others so the collapse CSS can reach it. Tagging at runtime rather than in
     the stylesheet keeps this fail-open — if the script never runs, the grid stays visible instead
     of being permanently hidden. */
  function othersGridEl(){
    var explicit=document.querySelector("#othersGrid, .lm-others");
    if(explicit) return explicit;
    var head=document.getElementById("othersToggle");
    if(!head) return null;
    var cards=document.querySelectorAll(".sem-card");
    for(var i=0;i<cards.length;i++){
      var c=cards[i];
      if(!(head.compareDocumentPosition(c) & 4)) continue;        // 4 = DOCUMENT_POSITION_FOLLOWING
      var n=c.parentNode, row=null;
      while(n && n!==document.body){                              // nearest OP row that does not also hold the heading
        if(n.classList && n.classList.contains("opt-row") && !n.contains(head)){ row=n; break; }
        n=n.parentNode;
      }
      if(!row) row=c.parentNode;
      if(row.classList && !row.classList.contains("lm-others")) row.classList.add("lm-others");
      return row;
    }
    return null;
  }
  function othersCards(){ var g=othersGridEl(); return g?g.querySelectorAll(".sem-card"):[]; }
  function toggleOthers(){
    var head=document.getElementById("othersToggle");
    if(!head) return;
    var open=!head.classList.contains("open");
    head.classList.toggle("open",open);
    head.setAttribute("aria-expanded",open);
    var body=document.getElementById("othersBody"); if(body) body.classList.toggle("open",open);
    /* Open state also goes on <body> so the CSS can collapse a grid that lives anywhere on the
       page, with no structural relationship to this block. */
    document.body.classList.toggle("lm-others-open",open);
    var hint=document.getElementById("othersHint"); if(hint) hint.style.display=open?"none":"";
    if(open && head.scrollIntoView) head.scrollIntoView({behavior:"smooth",block:"start"});
  }

  /* ---- confirm modal ---- */
  var currentData=null, submitting=false;
  function openConfirm(cardEl){
    var data=cardData(cardEl); currentData=data; submitting=false;
    var set=function(id,val){var el=document.getElementById(id); if(el) el.textContent=val;};
    set("cmTitle",data.course);
    set("cmSub",(data.pattern||"")+(data.format?" · "+data.format:""));
    var validDates=datesValid(data.dates);
    var count=validDates?data.dates.length:rawDateLine(data.datesRaw).split(",").filter(Boolean).length;
    set("ssCount",count?(count+" sessions"+(data.pattern?" · "+data.pattern.split(",")[0]:"")):"");
    set("ssRange",validDates?rangeLabel(data.dates):"");
    set("ssDates",validDates?compactDates(data.dates):rawDateLine(data.datesRaw));
    /* With no session data there is nothing to summarise — collapse the panel rather than
       showing an empty grey slab. */
    var ss=document.querySelector("#confirmOverlay .session-summary");
    if(ss) ss.style.display=count?"":"none";
    var ex=mEl("exceptionCheck"); if(ex) ex.checked=false;
    var re=mEl("regEvent"); if(re) re.value=data.eventId||"";
    var rc=mEl("regCourse"); if(rc) rc.value=data.courseId||"";
    var rf=mEl("regForm"); if(rf) rf.style.display="";
    var cs=mEl("confirmSuccess"); if(cs) cs.classList.remove("show");
    var ov=mEl("confirmOverlay"); if(ov) ov.classList.add("show");
    document.body.style.overflow="hidden";
  }
  function closeConfirm(){ var o=mEl("confirmOverlay"); if(o) o.classList.remove("show"); document.body.style.overflow=""; }
  /* n8n webhook (SEM : Create Seminar Registration). Empty = show success without booking. */
  var WEBHOOK_URL="https://landmarkworldwide.awesomate.io/webhook/pilot-seminar-select";
  function showSuccess(d){
    var st=mEl("successText"); if(st) st.textContent=d.course+" – "+(d.pattern||"")+".";
    var rf=mEl("regForm"); if(rf) rf.style.display="none";
    var cs=mEl("confirmSuccess"); if(cs) cs.classList.add("show");
    var addBtn=mEl("addCalBtn"); if(addBtn) addBtn.style.display=datesTyped(d.dates)?"":"none";
  }
  function confirmSelection(e){
    if(e) e.preventDefault();
    if(submitting) return false;                     // block double-fire within one instance
    var d=currentData; if(!d) return false;
    var cEl=document.getElementById("visitingContactId");
    var contactId=cEl?(cEl.textContent||"").trim():"";
    if(!contactId || /[\[\]]/.test(contactId)){       // empty or unresolved merge token -> don't create a contact-less record
      window.alert("We couldn't identify your account. Please refresh the page and try again.");
      return false;
    }
    var payload={ contactId:contactId, eventId:d.eventId||"", courseId:d.courseId||"",
      cantAttendFirst:(mEl("exceptionCheck")||{}).checked?1:0, course:d.course||"", pattern:d.pattern||"" };
    var btn=document.querySelector("#regForm .btn-confirm");
    if(!WEBHOOK_URL){ showSuccess(d); return false; }
    submitting=true;
    if(btn){ btn.disabled=true; btn.textContent="Booking..."; }
    fetch(WEBHOOK_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)})
      .then(function(r){ if(!r.ok) throw new Error("http "+r.status); return r.text(); })
      .then(function(){ showSuccess(d); })
      .catch(function(){ submitting=false; if(btn){ btn.disabled=false; btn.textContent="Confirm My Seminar"; } window.alert("Sorry, something went wrong booking your seminar. Please try again."); });
    return false;
  }

  /* ---- event delegation (replaces every inline on* handler) ---- */
  document.addEventListener("click",function(e){
    var sel=e.target.closest && e.target.closest(".sem-select");
    if(sel){ var card=sel.closest(".sem-card"); if(card) openConfirm(card); return; }
    var flip=e.target.closest && e.target.closest(".flip");
    if(flip){ flip.classList.toggle("flipped"); return; }
    if(e.target.closest && (e.target.closest(".confirm-close")||e.target.closest(".confirm-back"))){ closeConfirm(); return; }
    if(e.target.id==="confirmOverlay"){ closeConfirm(); return; }
    if(e.target.closest && e.target.closest("#othersToggle")){ toggleOthers(); return; }
    if(e.target.closest && e.target.closest("#addCalBtn")){ if(currentData) downloadICS(currentData); return; }
  });
  document.addEventListener("submit",function(e){ if(e.target.id==="regForm") confirmSelection(e); });
  document.addEventListener("change",function(e){ if(e.target.id==="countryFilter"||e.target.id==="langFilter") applyFilters(); });
  document.addEventListener("keydown",function(e){
    if(e.key==="Escape"){ closeConfirm(); return; }
    /* #othersToggle carries role="button", so it has to answer to Enter and Space as well as a
       click — a focusable control that only works with a mouse is worse than a plain heading. */
    if((e.key==="Enter"||e.key===" "||e.key==="Spacebar") && e.target.closest && e.target.closest("#othersToggle")){
      e.preventDefault(); toggleOthers();
    }
  });

  /* ---- init: run on ready + on load + retries + observe for late/re-rendered cards ---- */
  if(document.readyState!=="loading") run(); else document.addEventListener("DOMContentLoaded",run);
  window.addEventListener("load",run);
  [200,600,1200,2500,4000].forEach(function(ms){ setTimeout(run,ms); });
  if(window.MutationObserver){
    var _t=null;
    new MutationObserver(function(){ if(_t) return; _t=setTimeout(function(){ _t=null; run(); },150); })
      .observe(document.body,{childList:true,subtree:true});
  }
})();

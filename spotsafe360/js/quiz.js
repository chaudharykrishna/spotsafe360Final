/* SpotSafe 360 - quiz.js (module split, Phase 9.8).
   The quick-check quiz between round and review: paper draw, render,
   answer, next. */
"use strict";
/* Phase 11 (Shift Manager perk): points per correct answer, bonus included. */
function quizAward() { return CONFIG.quizPerCorrect + perkAmt("quizBonus"); }
/* ================= quick-check quiz (A7) ================= */
/* Draws CONFIG.quizCount questions from the QUIZ pool and shuffles each set
   of options. The correct text is captured before the shuffle, so the answer
   can never drift out of step with the order shown. */
function drawPaper() {
  var pool = (typeof QUIZ !== "undefined" && QUIZ) ? QUIZ : [];
  var want = Math.min(CONFIG.quizCount || 0, pool.length);
  /* Phase 16: in a duel both players must face the SAME three questions in
     the same order, so the draw is seeded with the challenge code instead
     of left to Math.random. */
  var pick = state.duelCode
    ? function (a) { return seededShuffle(a, state.duelCode); }
    : function (a) { return shuffle(a); };
  return pick(pool.slice(0, pool.length)).slice(0, want).map(function (q) {
    var right = q.options[0];
    return {
      ask: q.ask, because: q.because, right: right, ref: q.ref || null,
      options: pick(q.options.slice(0))
    };
  });
}
function startQuiz() {
  state.quiz = { paper: drawPaper(), at: 0, right: 0, answered: false, detail: [] };
  if (!state.quiz.paper.length) { showReview(); return; }
  $("quizTitle").textContent = STRINGS.quizTitle;
  $("quizIntro").textContent =
    STRINGS.quizIntro + quizAward() + STRINGS.quizIntroTail;
  $("quiz").classList.remove("hidden");
  $("phaseTag").textContent = STRINGS.quizPhaseTag;
  renderQuestion();
}
function renderQuestion() {
  var q = state.quiz.paper[state.quiz.at];
  state.quiz.answered = false;
  $("quizProgress").textContent =
    STRINGS.quizProgress + (state.quiz.at + 1) + STRINGS.quizOf + state.quiz.paper.length;
  $("quizAsk").textContent = q.ask;
  $("quizFeedback").className = "quiz-feedback hidden";
  $("btnQuizNext").classList.add("hidden");
  var box = $("quizOptions");
  box.innerHTML = "";
  q.options.forEach(function (text, i) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "quiz-opt";
    var key = document.createElement("span");
    key.className = "quiz-key";
    key.textContent = "ABC".charAt(i) || String(i + 1);
    var label = document.createElement("span");
    label.textContent = text;
    b.appendChild(key);
    b.appendChild(label);
    b.addEventListener("click", function () { answerQuestion(text); });
    box.appendChild(b);
  });
  var first = box.querySelector("button");
  if (first) { first.focus(); }
}
function answerQuestion(chosen) {
  if (state.quiz.answered) { return; }
  state.quiz.answered = true;
  var q = state.quiz.paper[state.quiz.at];
  var correct = chosen === q.right;
  if (correct) {
    state.quiz.right += 1;
    state.score += quizAward();
  }
  /* Phase 8 (CR-2): per-question detail feeds the dashboard's quiz
     accuracy by topic. The question's hazard ref travels with it. */
  state.quiz.detail.push({ h: q.ref || null, right: correct });
  /* Mark every option: the chosen one, and the right one when it was missed,
     so a wrong answer still teaches rather than just scoring. */
  Array.prototype.forEach.call($("quizOptions").children, function (b) {
    var text = b.lastChild.textContent;
    b.disabled = true;
    if (text === q.right) { b.classList.add("is-right"); }
    else if (text === chosen) { b.classList.add("is-wrong"); }
  });
  $("quizVerdict").textContent = correct
    ? STRINGS.quizRight + " +" + quizAward()
    : STRINGS.quizWrong;
  $("quizBecause").textContent = q.because;
  $("quizFeedback").className = "quiz-feedback " + (correct ? "is-right" : "is-wrong");
  unlockAudioOnce(); blip(correct ? 880 : 220);
  var last = state.quiz.at === state.quiz.paper.length - 1;
  var next = $("btnQuizNext");
  next.textContent = last ? STRINGS.quizFinish : STRINGS.quizNext;
  next.classList.remove("hidden");
  next.focus();
}
function nextQuestion() {
  if (!state.quiz.answered) { return; }
  if (state.quiz.at < state.quiz.paper.length - 1) {
    state.quiz.at += 1;
    renderQuestion();
    return;
  }
  $("quiz").classList.add("hidden");
  showReview();
}

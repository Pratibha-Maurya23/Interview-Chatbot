// Global State
let state = {
  view: 'setup',
  role: '',
  mode: '',
  domain: '',
  questionNumber: 0,
  conversationHistory: []
};

const MAX_QUESTIONS = 3;

// DOM
const setupView = document.getElementById('setup-view');
const interviewView = document.getElementById('interview-view');
const summaryView = document.getElementById('summary-view');
const questionDisplay = document.getElementById('question-display');
const userInput = document.getElementById('user-input');
const feedbackDisplay = document.getElementById('feedback-display');
const startBtn = document.getElementById('start-btn');
const submitBtn = document.getElementById('submit-btn');
const skipBtn = document.getElementById('skip-btn');
const retryBtn = document.getElementById('retry-btn');
const newInterviewBtn = document.getElementById('new-interview-btn');
const loadingSpinner = document.getElementById('loading-spinner');
const errorMessage = document.getElementById('error-message');

// View Switcher
function updateView() {
  setupView.classList.add('hidden');
  interviewView.classList.add('hidden');
  summaryView.classList.add('hidden');
  if (state.view === 'setup') setupView.classList.remove('hidden');
  if (state.view === 'interview') interviewView.classList.remove('hidden');
  if (state.view === 'summary') summaryView.classList.remove('hidden');
}

// Start Interview
async function startInterview() {
  state.role = document.getElementById('role').value;
  state.mode = document.getElementById('mode').value;
  state.domain = document.getElementById('domain').value;
  state.view = 'interview';
  state.questionNumber = 0;
  state.conversationHistory = [];
  feedbackDisplay.classList.add('hidden');
  userInput.value = '';
  updateView();
  await askNextQuestion();
}

// Ask Question
async function askNextQuestion() {
  state.questionNumber++;
  loadingSpinner.classList.remove('hidden');
  const payload = {
    action: 'ask_question',
    role: state.role,
    mode: state.mode,
    domain: state.domain,
    question_number: state.questionNumber
  };
  try {
    const res = await fetch('/api/interview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json();
    questionDisplay.innerHTML = data.question;
    state.conversationHistory.push({ role: 'bot', text: data.question });
  } catch {
    showError("Failed to get question");
  } finally {
    loadingSpinner.classList.add('hidden');
  }
}

// Submit Answer
async function submitAnswer() {
  const answer = userInput.value.trim();
  if (!answer) return;
  state.conversationHistory.push({ role: 'user', text: answer });
  if (state.questionNumber >= MAX_QUESTIONS) {
    await generateSummary();
    return;
  }
  loadingSpinner.classList.remove('hidden');
  try {
    const res = await fetch('/api/interview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'evaluate_answer', role: state.role, mode: state.mode, domain: state.domain, conversation_history: state.conversationHistory })
    });
    const data = await res.json();
    feedbackDisplay.innerHTML = data.feedback;
    feedbackDisplay.classList.remove('hidden');
    questionDisplay.innerHTML = data.question;
    userInput.value = '';
    state.conversationHistory.push({ role: 'bot', text: data.question });
    state.questionNumber++;
  } catch {
    showError("Failed to evaluate answer");
  } finally {
    loadingSpinner.classList.add('hidden');
  }
}

// Retry
async function handleRetry() {
  loadingSpinner.classList.remove('hidden');
  try {
    const res = await fetch('/api/interview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'retry_question', role: state.role, mode: state.mode, domain: state.domain })
    });
    const data = await res.json();
    questionDisplay.innerHTML = data.question;
  } catch {
    showError("Failed to retry");
  } finally {
    loadingSpinner.classList.add('hidden');
  }
}

// Skip
async function handleSkip() {
  state.conversationHistory.push({ role: 'user', text: 'skip' });
  await askNextQuestion();
}

// Summary
async function generateSummary() {
  loadingSpinner.classList.remove('hidden');
  try {
    const res = await fetch('/api/interview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'generate_summary', conversation_history: state.conversationHistory })
    });
    const data = await res.json();
    document.getElementById('summary-content').innerHTML = data.summary;
    state.view = 'summary';
    updateView();
  } catch {
    showError("Failed to generate summary");
  } finally {
    loadingSpinner.classList.add('hidden');
  }
}

// Error
function showError(msg) {
  errorMessage.textContent = msg;
  errorMessage.classList.remove('hidden');
}

// Event Listeners
startBtn.addEventListener('click', startInterview);
submitBtn.addEventListener('click', submitAnswer);
skipBtn.addEventListener('click', handleSkip);
retryBtn.addEventListener('click', handleRetry);
newInterviewBtn.addEventListener('click', () => { state.view = 'setup'; updateView(); });

// Init
updateView();

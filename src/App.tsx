/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Timer, 
  UserCircle, 
  BookOpen, 
  Calculator, 
  FlaskConical, 
  Microscope, 
  CheckCircle2, 
  ChevronLeft, 
  ChevronRight, 
  Flag, 
  Type, 
  LayoutGrid, 
  LogOut, 
  AlertCircle, 
  ArrowRight, 
  Printer, 
  Keyboard, 
  Compass, 
  ShieldCheck, 
  Info,
  User,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { googleSheetsService } from './services/googleSheetsService';
import { Student, ExamSettings, Question, ExamResult } from './types';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

// --- Types ---

type Screen = 'login' | 'confirm' | 'instructions' | 'exam' | 'completed';

interface ExamState {
  currentQuestionIndex: number;
  answers: Record<number, string>;
  flagged: Set<number>;
  timeLeft: number; // in seconds
  tabSwitches: number;
}

// --- Components ---

const getDirectImageUrl = (url: string) => {
  const fallback = "https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=400&h=400&fit=crop";
  
  if (!url || typeof url !== 'string' || url.trim() === '') {
    return fallback;
  }
  
  const trimmedUrl = url.trim();

  // Handle Base64 strings
  if (trimmedUrl.startsWith('data:image/')) {
    return trimmedUrl;
  }

  // Handle Google Drive links
  if (trimmedUrl.includes('drive.google.com') || trimmedUrl.includes('docs.google.com')) {
    try {
      let id = '';
      
      // Try to match /d/ID/ or /file/d/ID/
      const dMatch = trimmedUrl.match(/\/d\/([-\w]{25,})/);
      if (dMatch) {
        id = dMatch[1];
      } else {
        // Try to get id from query params (id=...)
        const idParamMatch = trimmedUrl.match(/[?&]id=([-\w]{25,})/);
        if (idParamMatch) {
          id = idParamMatch[1];
        } else {
          // Broad regex for anything that looks like a Drive ID (25+ chars of alphanumeric/hyphen/underscore)
          const idMatch = trimmedUrl.match(/[a-zA-Z0-9_-]{25,}/);
          if (idMatch) id = idMatch[0];
        }
      }

      if (id) {
        console.log('Detected Google Drive ID:', id);
        // Using lh3.googleusercontent.com is often more reliable for direct embedding
        return `https://lh3.googleusercontent.com/d/${id}`;
      }
    } catch (e) {
      console.error('Error parsing Google Drive URL:', e);
    }
  }
  
  // Handle Dropbox links
  if (trimmedUrl.includes('dropbox.com')) {
    return trimmedUrl.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('?dl=0', '').replace('&dl=0', '');
  }

  // Handle direct links that might be missing protocol
  if (trimmedUrl.startsWith('//')) {
    return `https:${trimmedUrl}`;
  }

  return trimmedUrl;
};

const RenderMath = ({ text }: { text: any }) => {
  if (text === null || text === undefined) return null;
  
  const content = String(text);
  if (!content.trim()) return null;

  // Split text by LaTeX delimiters: $$...$$ or $...$
  // Use a more robust regex to handle potential edge cases
  const parts = content.split(/(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/);

  return (
    <>
      {parts.map((part, i) => {
        try {
          if (part.startsWith('$$') && part.endsWith('$$')) {
            const math = part.slice(2, -2).trim();
            if (!math) return null;
            return <BlockMath key={i} math={math} />;
          } else if (part.startsWith('$') && part.endsWith('$')) {
            const math = part.slice(1, -1).trim();
            if (!math) return null;
            return <InlineMath key={i} math={math} />;
          }
          return <span key={i}>{part}</span>;
        } catch (e) {
          console.error('Math rendering error:', e, part);
          return <span key={i} className="text-red-500 underline decoration-dotted" title="Math Rendering Error">{part}</span>;
        }
      })}
    </>
  );
};

const Header = ({ screen, timeLeft, candidateName, regNo, photograph, title, onSubmit }: { 
  screen: Screen, 
  timeLeft?: number, 
  candidateName?: string, 
  regNo?: string,
  photograph?: string,
  title?: string,
  onSubmit?: () => void 
}) => {
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <header className="bg-white border-b border-gray-100 fixed top-0 w-full z-50 flex justify-between items-center px-6 py-2 shadow-sm h-14">
      <div className="flex items-center gap-3">
        <img 
          src="https://www.jamb.gov.ng/img/JAMB_logo_transparentBg.png" 
          alt="JAMB Logo" 
          className="h-10 w-auto object-contain"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = "https://jamb.gov.ng/assets/img/jamb-logo.png"; // Secondary fallback
          }}
        />
        <span className="text-sm md:text-lg font-bold text-[#004d27] truncate max-w-[150px] md:max-w-none">{title || 'JAMB Mock'}</span>
        {screen === 'exam' && (
          <>
            <div className="hidden md:block h-6 w-[1px] bg-gray-200"></div>
            <span className="text-gray-500 font-medium text-[10px] hidden lg:block">JAMB UTME - Mock Examination Center</span>
          </>
        )}
      </div>
      
      <div className="flex items-center gap-4">
        {timeLeft !== undefined && (
          <div className="flex items-center gap-2 px-3 py-1 bg-red-50 text-red-700 rounded-full font-bold">
            <Timer className="w-4 h-4" />
            <span className="text-lg tabular-nums">{formatTime(timeLeft)}</span>
          </div>
        )}
        
        <div className="flex items-center gap-4">
          {screen === 'exam' && onSubmit && (
            <button 
              onClick={onSubmit}
              className="px-4 py-1.5 bg-red-600 text-white font-bold rounded-lg text-xs hover:bg-red-700 transition-all active:scale-95 shadow-sm"
            >
              Submit Exam
            </button>
          )}

          {(candidateName || regNo) && (
            <div className="text-right hidden sm:block">
              <p className="text-[10px] font-bold text-gray-900 leading-tight truncate max-w-[100px]">{candidateName}</p>
              <p className="text-[8px] text-gray-500 uppercase tracking-widest">REG: {regNo}</p>
            </div>
          )}
          <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-emerald-100 bg-gray-100 flex items-center justify-center">
            {photograph ? (
              <img 
                src={getDirectImageUrl(photograph)} 
                alt="Candidate" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (!target.src.includes('unsplash')) {
                    target.src = "https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=400&h=400&fit=crop";
                  }
                }}
              />
            ) : (
              <User className="w-5 h-5 text-gray-400" />
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default function App() {
  const [screen, setScreen] = useState<Screen>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [student, setStudent] = useState<Student | null>(null);
  const [settings, setSettings] = useState<ExamSettings | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  
  const [examState, setExamState] = useState<ExamState>({
    currentQuestionIndex: 0,
    answers: {},
    flagged: new Set(),
    timeLeft: 7200,
    tabSwitches: 0,
  });
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [savedProgress, setSavedProgress] = useState<{ questions: Question[], state: any } | null>(null);
  const [submissionStatus, setSubmissionStatus] = useState<'idle' | 'success' | 'failed'>('idle');
  const [lastResult, setLastResult] = useState<ExamResult | null>(null);

  // Load settings on mount
  useEffect(() => {
    const scriptUrl = import.meta.env.VITE_GOOGLE_SCRIPT_URL;
    if (!scriptUrl) {
      setError('Configuration Missing: Please add VITE_GOOGLE_SCRIPT_URL to your environment variables in the Settings menu.');
      return;
    }
    if (!scriptUrl.startsWith('https://script.google.com/macros/s/')) {
      setError('Invalid URL: Your VITE_GOOGLE_SCRIPT_URL must start with "https://script.google.com/macros/s/". Please check your settings.');
      return;
    }
    if (scriptUrl.endsWith('/dev')) {
      setError('Invalid URL: You are using a "/dev" URL. Please deploy your script as a "Web App" and use the "/exec" URL instead.');
      return;
    }
    const loadSettings = async () => {
      const data = await googleSheetsService.getSettings();
      if (data) {
        setSettings(data);
        setExamState(prev => ({ ...prev, timeLeft: data.totalDuration * 60 }));
      } else {
        setError('Network Error: Failed to connect to your Google Script. This usually means: 1. "Who has access" is not set to "Anyone" in your deployment. 2. You are not using the correct "/exec" URL. 3. Your script has reached its daily quota.');
      }
    };
    loadSettings();
  }, []);

  // Tab switching monitoring
  useEffect(() => {
    if (screen === 'exam' && settings?.tabMonitoring) {
      const handleVisibilityChange = () => {
        if (document.hidden) {
          setExamState(prev => ({ ...prev, tabSwitches: prev.tabSwitches + 1 }));
          console.warn('Tab switch detected!');
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
  }, [screen, settings]);

  // Timer
  useEffect(() => {
    if (screen === 'exam' && examState.timeLeft > 0) {
      const timer = setInterval(() => {
        setExamState(prev => {
          if (prev.timeLeft <= 1) {
            clearInterval(timer);
            handleSubmit(); // Auto-submit when time is up
            return { ...prev, timeLeft: 0 };
          }
          return { ...prev, timeLeft: prev.timeLeft - 1 };
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [screen, examState.timeLeft]);

  // Auto-save logic
  useEffect(() => {
    if (screen === 'exam' && student) {
      const interval = setInterval(() => {
        const progress = {
          questions,
          state: {
            ...examState,
            flagged: Array.from(examState.flagged)
          },
          timestamp: Date.now()
        };
        localStorage.setItem(`jamb_progress_${student.regNo}`, JSON.stringify(progress));
        console.log('Progress auto-saved');
      }, 60000); // Every 60 seconds
      return () => clearInterval(interval);
    }
  }, [screen, student, questions, examState]);

  // Clear progress on successful submission
  useEffect(() => {
    if (screen === 'completed' && submissionStatus === 'success' && student) {
      localStorage.removeItem(`jamb_progress_${student.regNo}`);
    }
  }, [screen, submissionStatus, student]);

  const handleLogin = async (regNo: string) => {
    setLoading(true);
    setError(null);
    const data = await googleSheetsService.getStudent(regNo);
    if (data) {
      // Parse subjectCombination if it's a string (e.g., "Math, Physics")
      if (typeof data.subjectCombination === 'string') {
        data.subjectCombination = (data.subjectCombination as string).split(',').map(s => s.trim());
      }
      setStudent(data);
      setScreen('confirm');
    } else {
      setError('Invalid Registration Number. Please check and try again.');
    }
    setLoading(false);
  };

  const loadQuestions = async (forceNew = false) => {
    if (!student) return;
    
    // Check for saved progress
    const saved = localStorage.getItem(`jamb_progress_${student.regNo}`);
    if (saved && !forceNew) {
      try {
        const parsed = JSON.parse(saved);
        // Only restore if progress is less than 24 hours old
        if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
          setSavedProgress(parsed);
          setShowRestoreModal(true);
          return;
        }
      } catch (e) {
        console.error('Failed to parse saved progress', e);
      }
    }

    setLoading(true);
    const data = await googleSheetsService.getQuestions(student.subjectCombination);
    
    // Apply shuffling if enabled
    let finalQuestions = [...data];
    if (settings?.shuffling) {
      finalQuestions = finalQuestions.sort(() => Math.random() - 0.5);
    }
    
    // Apply subject-specific question counts
    if (settings?.questionsPerSubject) {
      // Group by subject and take a subset
      const grouped: Record<string, Question[]> = {};
      finalQuestions.forEach(q => {
        if (!grouped[q.subject]) grouped[q.subject] = [];
        grouped[q.subject].push(q);
      });
      
      // Normalize settings keys for easier matching
      const normalizedCounts: Record<string, number> = {};
      let globalCount = 40; // Default to 40

      if (typeof settings.questionsPerSubject === 'number') {
        globalCount = settings.questionsPerSubject;
      } else if (typeof settings.questionsPerSubject === 'object') {
        Object.entries(settings.questionsPerSubject).forEach(([key, val]) => {
          normalizedCounts[key.toLowerCase().trim()] = Number(val);
        });
      }
      
      finalQuestions = Object.entries(grouped).flatMap(([subject, qs]) => {
        const subLower = subject.toLowerCase().trim();
        
        // Try exact match first
        let count = normalizedCounts[subLower];
        
        // If no exact match, try partial match (e.g., 'mathe' matches 'math')
        if (count === undefined) {
          const matchKey = Object.keys(normalizedCounts).find(k => 
            subLower.includes(k) || k.includes(subLower)
          );
          if (matchKey) count = normalizedCounts[matchKey];
        }

        const finalCount = count || globalCount;
        const shuffled = settings.shuffling ? [...qs].sort(() => Math.random() - 0.5) : qs;
        return shuffled.slice(0, finalCount);
      });
    }

    setQuestions(finalQuestions);
    setExamState(prev => ({
      ...prev,
      timeLeft: (settings?.totalDuration || 120) * 60,
      currentQuestionIndex: 0,
      answers: {},
      flagged: new Set(),
      tabSwitches: 0
    }));
    setScreen('exam');
    setLoading(false);
  };

  const restoreProgress = () => {
    if (!savedProgress) return;
    setQuestions(savedProgress.questions);
    setExamState({
      ...savedProgress.state,
      flagged: new Set(savedProgress.state.flagged)
    });
    setScreen('exam');
    setShowRestoreModal(false);
    setSavedProgress(null);
  };

  const handleSubmit = useCallback(async () => {
    if (!student) return;
    setLoading(true);
    console.log('Starting submission for:', student.regNo);
    
    // Calculate scores
    const scores: Record<string, number> = {};
    student.subjectCombination.forEach(sub => scores[sub] = 0);
    
    questions.forEach((q, i) => {
      if (examState.answers[i] === q.correctAnswer) {
        scores[q.subject] = (scores[q.subject] || 0) + 1;
      }
    });
    
    const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
    
    const result: ExamResult = {
      action: 'saveResult',
      regNo: student.regNo,
      name: student.name,
      subjectsTaken: student.subjectCombination.join(', '),
      scores,
      ...scores, // Flatten scores: English: 20, Mathematics: 15, etc.
      totalScore,
      date: new Date().toLocaleDateString(),
      timeSubmitted: new Date().toLocaleTimeString(),
      tabSwitchCount: examState.tabSwitches,
    };
    
    console.log('Submitting result:', result);
    setLastResult(result);
    const success = await googleSheetsService.saveResult(result);
    
    if (success) {
      console.log('Submission successful');
      setSubmissionStatus('success');
      setScreen('completed');
    } else {
      console.error('Submission failed after all attempts');
      setSubmissionStatus('failed');
      setScreen('completed');
    }
    setLoading(false);
    setShowSubmitModal(false);
  }, [student, questions, examState.answers, examState.tabSwitches]);

  const retrySubmission = async () => {
    if (!lastResult) return;
    setLoading(true);
    console.log('Retrying submission...');
    const success = await googleSheetsService.saveResult(lastResult);
    if (success) {
      setSubmissionStatus('success');
    } else {
      alert('Retry failed. Please check your internet connection or contact the supervisor.');
    }
    setLoading(false);
  };

  // Submit Modal Keyboard Shortcuts
  useEffect(() => {
    if (showSubmitModal) {
      const handleKeyDown = (e: KeyboardEvent) => {
        const key = e.key.toLowerCase();
        if (key === 'y') handleSubmit();
        if (key === 'n') setShowSubmitModal(false);
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [showSubmitModal, handleSubmit]);

  const handleAnswer = useCallback((idx: number, opt: string) => {
    setExamState(prev => ({
      ...prev,
      answers: { ...prev.answers, [idx]: opt }
    }));
  }, []);

  const toggleFlag = useCallback((idx: number) => {
    setExamState(prev => {
      const newFlagged = new Set(prev.flagged);
      if (newFlagged.has(idx)) {
        newFlagged.delete(idx);
      } else {
        newFlagged.add(idx);
      }
      return { ...prev, flagged: newFlagged };
    });
  }, []);

  const handleNext = useCallback(() => {
    setExamState(prev => ({ 
      ...prev, 
      currentQuestionIndex: Math.min(questions.length - 1, prev.currentQuestionIndex + 1) 
    }));
  }, [questions.length]);

  const handlePrev = useCallback(() => {
    setExamState(prev => ({ 
      ...prev, 
      currentQuestionIndex: Math.max(0, prev.currentQuestionIndex - 1) 
    }));
  }, []);

  const handleJump = useCallback((index: number) => {
    setExamState(prev => ({ ...prev, currentQuestionIndex: index }));
  }, []);

  const renderScreen = () => {
    switch (screen) {
      case 'login':
        return <LoginScreen onLogin={handleLogin} loading={loading} error={error} />;
      case 'confirm':
        return <ConfirmDetailsScreen settings={settings} student={student} onConfirm={() => setScreen('instructions')} />;
      case 'instructions':
        if (!settings) return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
        return <InstructionsScreen settings={settings} student={student} onProceed={() => loadQuestions()} loading={loading} />;
      case 'exam':
        if (questions.length === 0) return <div className="h-full flex items-center justify-center flex-col gap-4">
          <AlertCircle className="w-12 h-12 text-red-500" />
          <p className="text-gray-500">No questions found for your subject combination.</p>
          <button onClick={() => setScreen('login')} className="px-4 py-2 bg-[#004d27] text-white rounded-lg">Back to Login</button>
        </div>;
        return (
          <ExamEnvironment 
            state={examState} 
            questions={questions}
            student={student}
            settings={settings}
            onAnswer={handleAnswer}
            onToggleFlag={toggleFlag}
            onPrev={handlePrev}
            onNext={handleNext}
            onSubmit={() => setShowSubmitModal(true)}
            onJump={handleJump}
          />
        );
      case 'completed':
        return (
          <CompletedScreen 
            student={student} 
            status={submissionStatus} 
            onRetry={retrySubmission} 
            loading={loading}
            onLogout={() => window.location.reload()} 
          />
        );
    }
  };

  return (
    <div className="h-screen bg-[#f9f9f9] text-[#1a1c1c] font-sans overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={screen}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="h-full"
        >
          {renderScreen()}
        </motion.div>
      </AnimatePresence>

      {showRestoreModal && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-6">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-8 border border-gray-100"
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
                <BookOpen className="w-10 h-10 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-black text-gray-900 mb-2">Restore Progress?</h2>
              <p className="text-gray-500 text-lg mb-8">We found saved progress from your previous session. Would you like to restore your answers and continue where you left off?</p>
              <div className="flex flex-col sm:flex-row gap-4 w-full">
                <button 
                  onClick={restoreProgress}
                  className="flex-1 py-4 bg-[#004d27] text-white rounded-xl font-bold text-lg hover:shadow-lg transition-all active:scale-95"
                >
                  Yes, Restore
                </button>
                <button 
                  onClick={() => {
                    setShowRestoreModal(false);
                    loadQuestions(true); // Force new
                  }}
                  className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-xl font-bold text-lg hover:bg-gray-200 transition-all active:scale-95"
                >
                  No, Start Fresh
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {showSubmitModal && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-6">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-8 border border-gray-100"
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mb-6">
                <Info className="w-10 h-10 text-amber-600" />
              </div>
              <h2 className="text-2xl font-black text-gray-900 mb-2">Submission Confirmation</h2>
              <p className="text-gray-500 text-lg mb-8">Are you sure you want to submit the exam? You will not be able to return to your questions after this action.</p>
              <div className="flex flex-col sm:flex-row gap-4 w-full">
                <button 
                  onClick={() => {
                    handleSubmit();
                  }}
                  className="flex-1 py-4 bg-[#004d27] text-white rounded-xl font-bold text-lg hover:shadow-lg transition-all active:scale-95"
                >
                  Yes, Submit (Y)
                </button>
                <button 
                  onClick={() => setShowSubmitModal(false)}
                  className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-xl font-bold text-lg hover:bg-gray-200 transition-all active:scale-95"
                >
                  No, Return to Exam (N)
                </button>
              </div>
              <div className="mt-6 flex items-center gap-2 text-xs text-gray-400 font-medium">
                <Info className="w-4 h-4" />
                <span>All {questions.length} questions have been attempted.</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

// --- Calculator Component ---

const CalculatorTool = ({ onClose }: { onClose: () => void }) => {
  const [display, setDisplay] = useState('0');
  const [equation, setEquation] = useState('');
  const [shouldReset, setShouldReset] = useState(false);

  const handleNumber = (num: string) => {
    if (display === '0' || shouldReset) {
      setDisplay(num);
      setShouldReset(false);
    } else {
      setDisplay(display + num);
    }
  };

  const handleOperator = (op: string) => {
    setEquation(display + ' ' + op + ' ');
    setShouldReset(true);
  };

  const calculate = () => {
    try {
      const result = eval(equation + display);
      setDisplay(String(result));
      setEquation('');
      setShouldReset(true);
    } catch (e) {
      setDisplay('Error');
      setEquation('');
      setShouldReset(true);
    }
  };

  const clear = () => {
    setDisplay('0');
    setEquation('');
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 20 }}
      className="fixed bottom-4 right-4 sm:bottom-24 sm:right-8 w-[calc(100%-2rem)] sm:w-64 bg-[#1a1c1c]/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-700 p-4 z-[80] select-none"
    >
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2 text-gray-400">
          <Calculator className="w-4 h-4" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">Calculator</span>
        </div>
        <button 
          onClick={onClose} 
          className="text-gray-500 hover:text-white transition-colors"
          aria-label="Close Calculator"
          title="Close Calculator"
        >
          <LogOut className="w-4 h-4 rotate-90" />
        </button>
      </div>

      <div className="bg-[#2a2d2d] rounded-lg p-3 mb-4 text-right">
        <div className="text-[10px] text-gray-500 h-4 overflow-hidden">{equation}</div>
        <div className="text-2xl font-mono text-white truncate">{display}</div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {['7', '8', '9', '/'].map(btn => (
          <button 
            key={btn} 
            onClick={() => btn === '/' ? handleOperator('/') : handleNumber(btn)}
            className="h-10 rounded-lg bg-[#3a3d3d] text-white font-bold hover:bg-[#4a4d4d] transition-colors"
          >
            {btn}
          </button>
        ))}
        {['4', '5', '6', '*'].map(btn => (
          <button 
            key={btn} 
            onClick={() => btn === '*' ? handleOperator('*') : handleNumber(btn)}
            className="h-10 rounded-lg bg-[#3a3d3d] text-white font-bold hover:bg-[#4a4d4d] transition-colors"
          >
            {btn === '*' ? '×' : btn}
          </button>
        ))}
        {['1', '2', '3', '-'].map(btn => (
          <button 
            key={btn} 
            onClick={() => btn === '-' ? handleOperator('-') : handleNumber(btn)}
            className="h-10 rounded-lg bg-[#3a3d3d] text-white font-bold hover:bg-[#4a4d4d] transition-colors"
          >
            {btn}
          </button>
        ))}
        {['C', '0', '=', '+'].map(btn => (
          <button 
            key={btn} 
            onClick={() => {
              if (btn === 'C') clear();
              else if (btn === '=') calculate();
              else if (btn === '+') handleOperator('+');
              else handleNumber(btn);
            }}
            className={`h-10 rounded-lg font-bold transition-colors ${
              btn === 'C' ? 'bg-red-900/30 text-red-400 hover:bg-red-900/50' :
              btn === '=' ? 'bg-emerald-600 text-white hover:bg-emerald-500' :
              'bg-[#3a3d3d] text-white hover:bg-[#4a4d4d]'
            }`}
          >
            {btn}
          </button>
        ))}
      </div>
    </motion.div>
  );
};

// --- Sub-Screens ---

function LoginScreen({ onLogin, loading, error }: { onLogin: (regNo: string) => void, loading: boolean, error: string | null }) {
  const [regNo, setRegNo] = useState('');

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <header className="w-full py-4 md:py-8 flex flex-col items-center justify-center space-y-2 shrink-0">
        <div className="flex flex-col items-center">
          <img 
            src="https://www.jamb.gov.ng/img/JAMB_logo_transparentBg.png" 
            alt="JAMB Logo" 
            className="w-20 h-20 md:w-32 md:h-32 mb-2 object-contain"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = "https://jamb.gov.ng/assets/img/jamb-logo.png"; // Secondary fallback
            }}
          />
          <h1 className="text-xl md:text-2xl font-black text-[#004d27] tracking-tight">JAMB Mock Assessment</h1>
          <p className="text-gray-500 font-medium text-[10px] md:text-xs tracking-wide uppercase">Unified Tertiary Matriculation Examination</p>
        </div>
      </header>

      <main className="flex-grow flex items-center justify-center px-4 md:px-6 bg-[radial-gradient(#004d27_0.5px,transparent_0.5px)] [background-size:24px_24px] [background-opacity:0.05] overflow-hidden">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-xl p-5 md:p-6 shadow-sm border border-gray-100">
            <div className="mb-6">
              <h2 className="text-md md:text-lg font-bold text-gray-900 mb-1">Candidate Login</h2>
              <p className="text-gray-500 text-[10px] md:text-xs">Please enter your credentials to begin your session.</p>
            </div>
            
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg flex flex-col gap-2 text-red-600 text-xs font-medium">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
                {error.includes('Network Error') && (
                  <div className="flex gap-2 self-end">
                    <button 
                      onClick={() => window.open(import.meta.env.VITE_GOOGLE_SCRIPT_URL, '_blank')} 
                      className="px-3 py-1 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                    >
                      Check Script URL
                    </button>
                    <button 
                      onClick={() => window.location.reload()} 
                      className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                    >
                      Retry Connection
                    </button>
                  </div>
                )}
                {error.includes('Failed to connect') && !error.includes('Network Error') && (
                  <button 
                    onClick={() => window.location.reload()} 
                    className="self-end px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                  >
                    Retry Connection
                  </button>
                )}
              </div>
            )}

            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onLogin(regNo); }}>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-gray-900 uppercase tracking-widest">Registration Number</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <UserCircle className="w-5 h-5 text-gray-400" />
                  </div>
                  <input 
                    className="block w-full pl-12 pr-4 py-3 bg-gray-50 border-none focus:ring-2 focus:ring-[#004d27] rounded-lg text-gray-900 placeholder:text-gray-400 transition-all text-sm"
                    placeholder="e.g., 12345678AB"
                    value={regNo}
                    onChange={(e) => setRegNo(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
              </div>
              <div className="flex gap-3 p-3 bg-emerald-50 rounded-lg border-l-4 border-[#004d27]">
                <Info className="w-4 h-4 text-[#004d27] shrink-0" />
                <p className="text-[10px] text-gray-600 leading-relaxed">
                  Ensure you are at your assigned workstation. Do not attempt to log in until instructed by the supervisor.
                </p>
              </div>
              <button 
                disabled={loading}
                className="w-full py-3 bg-[#004d27] text-white font-bold rounded-lg shadow-md hover:shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 group text-sm disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Log In'}
                {!loading && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
              </button>
            </form>
            <div className="mt-6 pt-4 border-t border-gray-50 flex flex-col items-center">
              <button className="text-[#004d27] text-[10px] font-bold hover:underline">Forgotten Registration Number?</button>
            </div>
          </div>
          <div className="mt-4 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full text-[9px] font-bold text-gray-500 uppercase">
              <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              System Status: Secure & Ready
            </div>
          </div>
        </div>
      </main>

      <footer className="w-full py-4 px-6 bg-gray-50 flex flex-col items-center border-t border-gray-100 shrink-0">
        <div className="flex items-center gap-2 text-gray-500 mb-1">
          <UserCircle className="w-3 h-3" />
          <p className="text-[10px] font-medium">For technical support, contact the center supervisor.</p>
        </div>
        <div className="flex gap-4 opacity-40">
          <span className="text-[8px] font-bold tracking-widest uppercase">System v4.2.0</span>
          <span className="text-[8px] font-bold tracking-widest uppercase">© 2024 JAMB</span>
        </div>
      </footer>
    </div>
  );
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return 'Not Provided';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  } catch (e) {
    return dateStr;
  }
};

function ConfirmDetailsScreen({ settings, student, onConfirm }: { settings: ExamSettings | null, student: Student | null, onConfirm: () => void }) {
  if (!student) return null;

  console.log('Student photograph URL:', student.photograph);
  console.log('Direct image URL:', getDirectImageUrl(student.photograph));

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <Header 
        screen="confirm" 
        timeLeft={7200} 
        candidateName={student.name} 
        regNo={student.regNo} 
        photograph={student.photograph} 
        title={settings?.examTitle}
      />
      <main className="flex-grow flex items-center justify-center pt-14 pb-4 px-4 md:px-8 overflow-y-auto">
        <div className="max-w-5xl w-full flex flex-col min-h-full py-4">
          <div className="mb-4 shrink-0">
            <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-gray-900">Registration Details</h1>
            <p className="text-[10px] md:text-xs text-gray-500 font-medium uppercase tracking-wider">Verify your identity before proceeding.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            <div className="md:col-span-4 bg-white rounded-xl p-4 shadow-sm ring-1 ring-gray-100 flex flex-col">
              <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 mb-4 relative group w-full md:max-w-[300px] mx-auto">
                <img 
                  src={getDirectImageUrl(student.photograph)} 
                  alt="Student" 
                  className="absolute inset-0 w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (!target.src.includes('unsplash')) {
                      target.src = "https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=400&h=400&fit=crop";
                      console.error('Image failed to load.');
                    }
                  }}
                />
                <div className="absolute bottom-0 left-0 right-0 bg-[#004d27]/80 backdrop-blur-md p-2 text-center z-10">
                  <span className="text-[8px] uppercase tracking-widest text-white font-bold">Biometric Verified</span>
                </div>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg shrink-0">
                <p className="text-[8px] font-bold uppercase tracking-wider text-gray-500 mb-0.5">Registration Number</p>
                <p className="text-lg font-black text-[#004d27] tracking-tight">{student.regNo}</p>
              </div>
            </div>

            <div className="md:col-span-8 flex flex-col gap-4">
              <div className="bg-white rounded-xl p-5 md:p-6 shadow-sm ring-1 ring-gray-100 flex flex-col h-full">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 shrink-0">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Full Name</p>
                    <p className="text-lg md:text-xl font-bold text-gray-900">{student.name}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Date of Birth</p>
                    <p className="text-lg md:text-xl font-bold text-gray-900">{formatDate(student.dob)}</p>
                  </div>
                </div>
                
                <div className="border-t border-gray-50 pt-4 flex-grow flex flex-col">
                  <div className="flex items-center gap-2 mb-3 shrink-0">
                    <BookOpen className="w-4 h-4 text-[#004d27]" />
                    <h2 className="text-sm md:text-md font-bold text-gray-900">Subject Combination</h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3">
                    {student.subjectCombination.map((subName, i) => (
                      <div key={subName} className={`flex items-center gap-3 p-3 rounded-xl ${i === 0 ? 'bg-emerald-50 border-l-4 border-[#004d27]' : 'bg-gray-50 hover:bg-gray-100'} transition-all text-xs`}>
                        <span className={`flex items-center justify-center w-5 md:w-6 h-5 md:h-6 rounded-full shrink-0 ${i === 0 ? 'bg-[#004d27] text-white' : 'bg-gray-200 text-gray-500'} text-[10px] font-bold font-mono`}>{i + 1}</span>
                        <div>
                          <p className={`font-bold ${i === 0 ? 'text-[#004d27]' : 'text-gray-900'}`}>{subName}</p>
                          {i === 0 && <p className="text-[8px] uppercase font-bold text-emerald-600">Compulsory</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 p-3 rounded-lg bg-red-50 flex gap-3 items-start shrink-0">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <p className="text-[9px] font-medium text-red-800 leading-relaxed">
                    If these details are incorrect, please notify the supervisor immediately. Incorrect registration details may lead to disqualification.
                  </p>
                </div>

                <div className="pt-4 flex flex-col sm:flex-row items-center gap-3 shrink-0">
                  <button 
                    onClick={onConfirm}
                    className="w-full px-8 py-3 bg-[#004d27] text-white font-bold rounded-lg shadow-lg hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm"
                  >
                    Confirm & Start Session
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <footer className="py-3 px-6 border-t border-gray-100 text-center shrink-0">
        <p className="text-[10px] text-gray-400 font-medium">© 2024 Joint Admissions and Matriculation Board (JAMB). Computer Based Test Portal.</p>
      </footer>
    </div>
  );
}

function InstructionsScreen({ settings, student, onProceed, loading }: { settings: ExamSettings | null, student: Student | null, onProceed: () => void, loading: boolean }) {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <Header 
        screen="instructions" 
        timeLeft={settings?.totalDuration ? settings.totalDuration * 60 : 7200} 
        candidateName={student?.name} 
        regNo={student?.regNo} 
        photograph={student?.photograph} 
        title={settings?.examTitle}
      />
      <div className="flex flex-1 pt-14 overflow-hidden">
        <aside className="hidden md:flex flex-col w-64 bg-gray-50 border-r border-gray-100 p-4 shrink-0">
          <div className="mb-6">
            <h2 className="text-[#004d27] text-lg font-black">Exam Navigation</h2>
            <p className="text-gray-400 text-[10px] font-medium uppercase tracking-wider">Question Palette</p>
          </div>
          <nav className="space-y-1 flex-grow overflow-y-auto pr-1">
            {student?.subjectCombination?.map((subName, i) => (
              <div key={subName} className={`flex items-center justify-between p-3 rounded-xl font-black ${i === 0 ? 'bg-emerald-100 text-[#004d27]' : 'bg-white text-gray-400 border border-gray-100 shadow-sm'}`}>
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  <span className="text-[10px] uppercase tracking-widest">{subName}</span>
                </div>
                <span className="text-[10px] opacity-70 font-mono">
                  {typeof settings?.questionsPerSubject === 'object' 
                    ? (settings.questionsPerSubject as any)[subName] || 40 
                    : settings?.questionsPerSubject || 40} Qs
                </span>
              </div>
            ))}
          </nav>
          <button className="mt-4 w-full py-2.5 px-4 bg-gray-200 text-gray-400 rounded-lg font-black shrink-0 cursor-not-allowed opacity-50 text-[10px] uppercase tracking-widest">
            Submit Exam
          </button>
        </aside>

        <main className="flex-1 px-4 md:px-8 max-w-5xl mx-auto flex flex-col overflow-hidden">
          <div className="py-6 flex-grow overflow-y-auto pr-2">
            <header className="mb-6">
              <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight mb-1">{settings?.examTitle || 'Examination Instructions & Guidelines'}</h1>
              <p className="text-gray-500 text-sm">Please read the following carefully before proceeding to the examination hall.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-6">
              <div className="md:col-span-4 bg-white p-6 rounded-xl flex flex-col items-center justify-center text-center shadow-sm border border-gray-100">
                <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mb-3">
                  <Timer className="w-6 h-6 text-[#004d27]" />
                </div>
                <h3 className="text-gray-400 font-bold text-[10px] uppercase tracking-widest mb-0.5">Duration</h3>
                <div className="text-2xl font-extrabold text-[#004d27]">{settings?.totalDuration || 120} Minutes</div>
                <p className="text-gray-500 text-xs mt-1">Total Exam Time</p>
              </div>

              <div className="md:col-span-8 bg-gray-50 p-6 rounded-xl border border-gray-100">
                <div className="flex items-center gap-2 mb-4">
                  <Keyboard className="w-5 h-5 text-amber-600" />
                  <h3 className="text-md font-bold text-gray-900">Keyboard Shortcuts</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { label: 'Select Options', keys: ['A', 'B', 'C', 'D'] },
                    { label: 'Next Question', keys: ['N'] },
                    { label: 'Previous Question', keys: ['P'] },
                    { label: 'Submit Exam', keys: ['S'] },
                  ].map(item => (
                    <div key={item.label} className="flex items-center justify-between p-2 bg-white rounded-lg border border-gray-100">
                      <span className="text-xs text-gray-500 font-medium">{item.label}</span>
                      <div className="flex gap-1">
                        {item.keys.map(k => (
                          <kbd key={k} className="px-1.5 py-0.5 bg-gray-50 border border-gray-200 rounded font-bold text-[10px] text-gray-700">{k}</kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="md:col-span-12 bg-gray-50 p-6 rounded-xl border border-gray-100">
                <h3 className="text-md font-bold text-gray-900 mb-2">Instructions</h3>
                <div className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">
                  {settings?.instructions || 'No specific instructions provided.'}
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center gap-4 mt-6 pb-14 md:pb-10">
              <button 
                onClick={onProceed}
                disabled={loading}
                className="w-full md:w-auto px-10 py-4 bg-[#004d27] text-white text-md md:text-lg font-extrabold rounded-xl shadow-lg transition-all duration-300 transform hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-3 hover:shadow-xl disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Start Examination'}
                {!loading && <ArrowRight className="w-5 h-5" />}
              </button>
              <p className="text-gray-400 text-[8px] md:text-[10px] opacity-60 uppercase tracking-widest font-bold">System ID: JAMB-CBT-2024-V4-X892</p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function ExamEnvironment({ state, questions, student, settings, onAnswer, onToggleFlag, onPrev, onNext, onSubmit, onJump }: { 
  state: ExamState, 
  questions: Question[],
  student: Student | null,
  settings: ExamSettings | null,
  onAnswer: (idx: number, opt: string) => void,
  onToggleFlag: (idx: number) => void,
  onPrev: () => void,
  onNext: () => void,
  onSubmit: () => void,
  onJump: (idx: number) => void
}) {
  const currentQuestion = questions[state.currentQuestionIndex];
  const [showCalculator, setShowCalculator] = useState(false);
  const [showMobilePalette, setShowMobilePalette] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      
      // Option Selection (A, B, C, D)
      if (['a', 'b', 'c', 'd'].includes(key)) {
        const option = currentQuestion.options.find(opt => opt.id.toLowerCase() === key);
        if (option) {
          onAnswer(state.currentQuestionIndex, option.id);
          // If it was 'c', we don't want to toggle the calculator
          if (key === 'c') return;
        }
      }
      
      // Navigation
      if (key === 'n') {
        onNext();
        return;
      }
      if (key === 'p') {
        onPrev();
        return;
      }
      
      // Submission
      if (key === 's') {
        onSubmit();
        return;
      }

      // Calculator (only if 'c' wasn't handled as an option)
      if (key === 'c') {
        setShowCalculator(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.currentQuestionIndex, currentQuestion, onAnswer, onNext, onPrev, onSubmit]);

  if (!currentQuestion) return null;

  // Group questions by subject for the tabs
  const subjects = Array.from(new Set(questions.map(q => q.subject)));

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <Header 
        screen="exam" 
        timeLeft={state.timeLeft} 
        candidateName={student?.name} 
        regNo={student?.regNo} 
        photograph={student?.photograph}
        title={settings?.examTitle}
        onSubmit={onSubmit}
      />
      <div className="flex flex-1 pt-14 overflow-hidden relative">
        {/* Left Sidebar: Question Palette (Desktop) & Overlay (Mobile) */}
        <div 
          className={`
            fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm lg:hidden transition-opacity duration-300
            ${showMobilePalette ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
          `}
          onClick={() => setShowMobilePalette(false)}
        />
        
        <aside className={`
          fixed lg:static inset-y-0 left-0 z-[70] w-72 lg:w-64 bg-white lg:bg-gray-50 border-r border-gray-100 flex flex-col p-5 lg:p-4 shrink-0 transition-transform duration-300 transform
          ${showMobilePalette ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'}
        `}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
              <LayoutGrid className="w-3.5 h-3.5" />
              {currentQuestion.subject} Palette
            </h3>
             <button 
              onClick={() => setShowMobilePalette(false)}
              className="lg:hidden p-2 text-gray-400 hover:text-gray-600"
              aria-label="Close Palette"
              title="Close Palette"
            >
              <LogOut className="w-4 h-4 rotate-90" />
            </button>
          </div>
          
          <div className="flex-grow overflow-y-auto pr-1 mb-4 custom-scrollbar">
            <div className="grid grid-cols-5 md:grid-cols-6 gap-2">
              {questions.map((q, idx) => ({ ...q, originalIndex: idx }))
                .filter(q => q.subject === currentQuestion.subject)
                .map((q) => {
                  const i = q.originalIndex;
                  const isAnswered = state.answers[i] !== undefined;
                  const isCurrent = state.currentQuestionIndex === i;
                  const isFlagged = state.flagged.has(i);
                  
                  return (
                    <button 
                      key={i}
                      onClick={() => onJump(i)}
                      className={`aspect-square flex items-center justify-center text-[10px] font-bold rounded-md transition-all border-2 ${
                        isCurrent ? 'bg-red-600 border-red-600 text-white shadow-md scale-105 z-10' :
                        isFlagged ? 'bg-amber-400 border-amber-400 text-white shadow-sm' :
                        isAnswered ? 'bg-[#004d27] border-[#004d27] text-white shadow-sm' : 
                        'bg-white border-gray-100 text-gray-400 hover:border-[#004d27]/30 hover:text-[#004d27]'
                      }`}
                    >
                      {i + 1}
                    </button>
                  );
                })}
            </div>
          </div>

          <div className="mt-auto space-y-4 bg-gray-50 lg:bg-white p-4 rounded-2xl border border-gray-100 shadow-sm shrink-0">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Answered', color: 'bg-[#004d27]' },
                { label: 'Current', color: 'bg-red-600' },
                { label: 'Flagged', color: 'bg-amber-400' },
                { label: 'Untouched', color: 'bg-white border border-gray-200' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2">
                  <div className={`w-3 h-3 ${item.color} rounded-sm shadow-sm`}></div>
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-tight">{item.label}</span>
                </div>
              ))}
            </div>
            <div className="pt-3 border-t border-gray-200 lg:border-gray-50">
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-gray-400">
                <span>Progress</span>
                <span className="text-[#004d27]">
                  {questions.filter(q => q.subject === currentQuestion.subject && state.answers[questions.indexOf(q)] !== undefined).length} / {questions.filter(q => q.subject === currentQuestion.subject).length}
                </span>
              </div>
            </div>
          </div>
        </aside>

        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Top Navigation Bar: Subjects and Calculator */}
          <div className="bg-white border-b border-gray-100 px-3 md:px-6 py-2 shrink-0">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 overflow-hidden">
              <div className="flex items-center gap-2 shrink-0 lg:hidden">
                <button 
                  onClick={() => setShowMobilePalette(true)}
                  className="p-2 bg-gray-50 text-[#004d27] rounded-lg border border-gray-100 shadow-sm"
                  title="Question Palette"
                >
                  <LayoutGrid className="w-5 h-5" />
                </button>
              </div>

              {/* Subject Tabs */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth flex-grow">
                {subjects.map((subName) => {
                  const isCurrentSubject = currentQuestion.subject === subName;
                  return (
                    <button 
                      key={subName} 
                      onClick={() => {
                        const firstIdx = questions.findIndex(q => q.subject === subName);
                        if (firstIdx !== -1) onJump(firstIdx);
                      }}
                      className={`flex items-center gap-2 px-3 md:px-4 py-1.5 transition-all rounded-full font-black whitespace-nowrap text-xs ${isCurrentSubject ? 'bg-[#004d27] text-white shadow-md' : 'bg-white text-gray-400 border border-gray-100 hover:bg-gray-50'}`}
                    >
                      <BookOpen className="w-3 md:w-3.5 h-3 md:h-3.5 shrink-0" />
                      <span className="text-[10px] md:text-[11px] uppercase tracking-widest">{subName}</span>
                      <span className={`text-[8px] md:text-[9px] px-1.5 py-0.5 rounded-full shrink-0 font-mono ${isCurrentSubject ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
                        {questions.filter(q => q.subject === subName).length}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Calculator Button in Top Bar (Hidden on very small screens, visible in fixed menu otherwise) */}
              <button 
                onClick={() => setShowCalculator(prev => !prev)}
                className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all border shrink-0 ${
                  showCalculator ? 'bg-emerald-100 text-emerald-600 border-emerald-200' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50 shadow-sm'
                }`}
                title="Calculator (C)"
              >
                <Calculator className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Calculator</span>
              </button>
            </div>
          </div>

          <main className="flex-1 bg-gray-50 p-3 md:p-6 overflow-y-auto">
            <div className="max-w-4xl mx-auto h-full flex flex-col">
              <div className="flex justify-between items-center mb-4 md:mb-6 shrink-0">
                <div className="space-y-0.5">
                  <span className="text-[8px] md:text-[10px] font-black text-[#004d27] tracking-[0.2em] uppercase opacity-70">Question {state.currentQuestionIndex + 1} of {questions.length}</span>
                  <h1 className="text-lg md:text-xl font-black text-gray-900 tracking-tight">{currentQuestion.subject}</h1>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setShowCalculator(prev => !prev)}
                    className={`sm:hidden p-2 rounded-lg transition-all border ${showCalculator ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-400 border-gray-100 shadow-sm'}`}
                    aria-label="Open Calculator"
                    title="Calculator"
                  >
                    <Calculator className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => onToggleFlag(state.currentQuestionIndex)}
                    className={`p-2 rounded-lg transition-all shadow-sm border ${state.flagged.has(state.currentQuestionIndex) ? 'bg-amber-100 border-amber-200 text-amber-600' : 'bg-white border-gray-100 text-gray-400 hover:bg-gray-50'}`}
                    aria-label="Flag Question for Review"
                    title="Flag for Review"
                  >
                    <Flag className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex-grow flex flex-col overflow-hidden">
                <div className="bg-white p-5 md:p-8 rounded-2xl shadow-sm border border-gray-100 mb-4 md:mb-6 flex-grow overflow-y-auto min-h-[250px]">
                  <div className="text-md md:text-lg leading-relaxed text-gray-900 font-bold mb-6 md:mb-8">
                    <RenderMath text={currentQuestion.text} />
                  </div>
                  <div className="space-y-2 md:space-y-3">
                    {currentQuestion.options.map((opt) => {
                      const isSelected = state.answers[state.currentQuestionIndex] === opt.id;
                      return (
                        <label 
                          key={opt.id}
                          className={`group flex items-center p-3.5 md:p-4 rounded-xl cursor-pointer transition-all border-2 ${
                            isSelected ? 'bg-emerald-50 border-[#004d27] shadow-sm' : 'bg-white border-gray-50 hover:border-gray-100 hover:bg-gray-50'
                          }`}
                          onClick={() => onAnswer(state.currentQuestionIndex, opt.id)}
                        >
                          <div className={`flex items-center justify-center w-8 md:w-9 h-8 md:h-9 rounded-full border-2 text-xs md:text-sm font-black shrink-0 transition-all ${
                            isSelected ? 'bg-[#004d27] border-[#004d27] text-white' : 'border-gray-100 text-gray-400 group-hover:border-[#004d27]/30'
                          }`}>
                            {opt.id}
                          </div>
                          <span className={`ml-4 text-sm md:text-md ${isSelected ? 'text-[#004d27] font-black' : 'text-gray-700 font-bold'}`}>
                            <RenderMath text={opt.text} />
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0 pb-20 md:pb-4">
                  <div className="flex justify-between w-full sm:w-auto gap-3">
                    <button 
                      onClick={onPrev}
                      disabled={state.currentQuestionIndex === 0}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 md:px-6 py-3 rounded-xl font-black text-gray-500 bg-white border border-gray-100 hover:bg-gray-50 transition-all disabled:opacity-40 text-xs md:text-sm shadow-sm"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span className="hidden md:inline">Previous</span>
                      <span className="md:hidden">Prev</span>
                    </button>
                    
                    <button 
                      onClick={onNext}
                      disabled={state.currentQuestionIndex === questions.length - 1}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-7 md:px-8 py-3 rounded-xl font-black text-white bg-[#004d27] hover:brightness-110 active:scale-95 transition-all shadow-md disabled:opacity-40 text-xs md:text-sm"
                    >
                      <span className="hidden md:inline">Next Question</span>
                      <span className="md:hidden">Next</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="hidden sm:flex items-center gap-4 bg-white px-4 py-2.5 rounded-xl border border-gray-100 shadow-sm">
                    <span className="text-[10px] font-black text-[#004d27] uppercase tracking-widest opacity-60">Progress</span>
                    <div className="w-24 md:w-32 h-2 bg-gray-100 rounded-full overflow-hidden border border-gray-50">
                      <motion.div 
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: Object.keys(state.answers).length / questions.length || 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="h-full bg-[#004d27] origin-left"
                      />
                    </div>
                    <span className="text-[10px] font-mono font-black text-gray-600">{Object.keys(state.answers).length}/{questions.length}</span>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
      <AnimatePresence>
        {showCalculator && <CalculatorTool onClose={() => setShowCalculator(false)} />}
      </AnimatePresence>
    </div>
  );
}

function CompletedScreen({ student, status, onRetry, loading, onLogout }: { 
  student: Student | null, 
  status: 'idle' | 'success' | 'failed',
  onRetry: () => void,
  loading: boolean,
  onLogout: () => void 
}) {
  return (
    <div className="h-full bg-white flex items-center justify-center p-6 overflow-hidden">
      <div className="max-w-2xl w-full text-center">
        <div className="mb-8">
          <div className="relative inline-block">
            <div className={`w-24 h-24 rounded-full flex items-center justify-center ${status === 'failed' ? 'bg-red-50' : 'bg-emerald-50'}`}>
              {status === 'failed' ? (
                <AlertCircle className="w-12 h-12 text-red-600" />
              ) : (
                <CheckCircle2 className="w-12 h-12 text-[#004d27]" />
              )}
            </div>
            <div className="absolute -top-1 -right-1 w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center border-4 border-white">
              <ShieldCheck className="w-5 h-5 text-amber-600" />
            </div>
          </div>
        </div>
        
        <h1 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">
          {status === 'failed' ? 'Submission Issue Detected' : 'Exam Successfully Completed'}
        </h1>
        
        <div className={`p-5 md:p-6 rounded-2xl mb-8 border ${status === 'failed' ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
          <p className="text-md md:text-lg text-gray-500 leading-relaxed font-medium">
            {status === 'failed' ? (
              <span className="text-red-700">
                We encountered an issue saving your results. Please click "Retry Submission" or notify your supervisor.
              </span>
            ) : (
              `Congratulations, ${student?.name}. You have successfully completed your exam. Your results have been recorded.`
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left mb-8">
          <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100">
            <p className="text-[10px] uppercase font-bold text-emerald-600 mb-0.5">Registration No</p>
            <p className="text-sm font-bold text-gray-900">{student?.regNo}</p>
          </div>
          <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100">
            <p className="text-[10px] uppercase font-bold text-emerald-600 mb-0.5">Status</p>
            <p className={`text-sm font-bold flex items-center gap-1 ${status === 'failed' ? 'text-red-600' : 'text-emerald-600'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${status === 'failed' ? 'bg-red-600 animate-pulse' : 'bg-emerald-600'}`}></span>
              {status === 'failed' ? 'Pending Save' : 'Submitted'}
            </p>
          </div>
          <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100">
            <p className="text-[10px] uppercase font-bold text-emerald-600 mb-0.5">Date</p>
            <p className="text-sm font-bold text-gray-900">{new Date().toLocaleDateString()}</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center px-4">
          {status === 'failed' && (
            <button 
              onClick={onRetry}
              disabled={loading}
              className="w-full sm:w-auto px-8 py-3 bg-amber-600 text-white rounded-xl font-bold text-md hover:shadow-xl hover:bg-amber-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
              Retry Submission
            </button>
          )}
          <button 
            onClick={onLogout}
            className="w-full sm:w-auto px-8 py-3 bg-[#004d27] text-white rounded-xl font-bold text-md hover:shadow-xl hover:bg-[#003d1f] transition-all flex items-center justify-center gap-2"
          >
            Logout of Portal
            <LogOut className="w-4 h-4" />
          </button>
        </div>
        
        <p className="mt-8 text-gray-400 text-[10px] font-medium">
          © 2024 Joint Admissions and Matriculation Board (JAMB). All Rights Reserved.
        </p>
      </div>
    </div>
  );
}

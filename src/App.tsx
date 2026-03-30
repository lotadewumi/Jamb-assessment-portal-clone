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
  Loader2,
  Mail,
  Phone,
  Home,
  MapPin,
  Calendar,
  Building2,
  Users,
  CreditCard,
  MessageCircle,
  Smartphone,
  ArrowLeft,
  Camera
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { googleSheetsService } from './services/googleSheetsService';
import { Student, ExamSettings, Question, ExamResult, TutorialCenter } from './types';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';
import { AdminPage } from './components/AdminPage';
import { CenterDashboard } from './components/CenterDashboard';

// --- Types ---

type Screen = 'login' | 'confirm' | 'instructions' | 'exam' | 'completed' | 'student-register' | 'tutorial-register' | 'payment-success' | 'verifying-payment' | 'admin' | 'center-dashboard';

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

const sanitizeSpreadsheetValue = (val: any) => {
  if (val === null || val === undefined) return '';
  let str = String(val).trim();
  // Handle ISO date strings (e.g. "2026-01-31T23:00:00.000Z") which often happen 
  // when Google Sheets auto-formats fractions like 1/31 or 12/1.
  if (str.includes('T') && !isNaN(Date.parse(str)) && str.length > 15) {
    const date = new Date(str);
    // Convert back to a readable fraction-like format or simple date
    return `${date.getDate()}/${date.getMonth() + 1}`;
  }
  return str;
};

const RenderMath = ({ text }: { text: any }) => {
  const content = sanitizeSpreadsheetValue(text);
  if (!content) return null;

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
  const [center, setCenter] = useState<TutorialCenter | null>(null);
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
  const [registrationDetails, setRegistrationDetails] = useState<any>(null);
  const [registrationType, setRegistrationType] = useState<'student' | 'tutorial' | null>(null);

  const handleProceedToPayment = (details: any, type: 'student' | 'tutorial') => {
    const paystackKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
    
    if (!paystackKey || paystackKey.includes('placeholder')) {
      alert("Configuration Error: Live Paystack Public Key is missing. Please check your .env file or Settings.");
      return;
    }

    if (!details.email) {
      alert("Registration Error: Email address is required for payment.");
      return;
    }

    // @ts-ignore
    if (typeof window.PaystackPop === 'undefined') {
      alert("Payment Error: The Paystack payment gateway failed to load. Please check your internet connection or disable any ad-blockers.");
      return;
    }

    try {
      const amount = Math.round((type === 'student' ? (settings?.studentRegFee || 1500) : details.totalAmount) * 100);
      
      if (isNaN(amount) || amount <= 0) {
        alert("Payment Error: Invalid payment amount calculated. Please check your inputs.");
        return;
      }

      // Sanitize metadata: Paystack metadata has limits, so we only send key identifiers
      // We exclude the large photographBase64 to prevent crashes, but include other text fields
      const metadata = {
        type,
        ...details,
        custom_fields: [
          {
            display_name: "Registration Type",
            variable_name: "registration_type",
            value: type
          },
          {
            display_name: "Full Name",
            variable_name: "full_name",
            value: type === 'student' ? details.fullName : details.coordinatorName
          }
        ]
      };
      
      // Explicitly remove large fields from metadata for Paystack popup safety
      // @ts-ignore
      delete metadata.photographBase64;
      // @ts-ignore
      delete metadata.photographContentType;
      // @ts-ignore
      delete metadata.confirmed;

      // @ts-ignore
      const handler = window.PaystackPop.setup({
        key: paystackKey,
        email: details.email,
        amount: amount,
        currency: 'NGN',
        metadata: metadata,
        callback: function(response: any) {
          console.log('Payment successful, reference:', response.reference);
          setRegistrationDetails(details);
          setRegistrationType(type);
          setScreen('verifying-payment');
          
          // Execute the async backend registration
          (async () => {
            try {
              let result;
              if (type === 'student') {
                result = await googleSheetsService.registerStudent(details);
              } else {
                result = await googleSheetsService.registerTutorialCenter(details);
              }

              if (result && (result === true || (result as any).success)) {
                console.log('Backend registration succeeded.');
                await new Promise(resolve => setTimeout(resolve, 2000));
                setScreen('payment-success');
              } else {
                console.warn('Backend registration failed or returned error:', result);
                await new Promise(resolve => setTimeout(resolve, 3000));
                setScreen('payment-success'); // Fallback to success as payment is captured
              }
            } catch (err) {
              console.error('Final registration step failed:', err);
              setScreen('payment-success'); // Still treat as success since payment was taken
            }
          })();
        },
        onClose: () => {
          console.log('Payment window closed by user.');
        }
      });

      // Try both possible methods to open the payment window
      if (handler && typeof handler.openIframe === 'function') {
        handler.openIframe();
      } else if (handler && typeof handler.open === 'function') {
        handler.open();
      } else {
        throw new Error("Paystack handler failed to initialize correctly.");
      }
    } catch (error: any) {
      console.error('Paystack Initialization Error:', error);
      alert("Payment Error: Could not initialize Paystack. " + (error.message || ""));
    }
  };

  // Load settings on mount and setup polling
  useEffect(() => {
    const scriptUrl = import.meta.env.VITE_GOOGLE_SCRIPT_URL;
    if (!scriptUrl) {
      setError('Configuration Missing: Please add VITE_GOOGLE_SCRIPT_URL to your environment variables in the Settings menu.');
      return;
    }
    
    const loadSettings = async () => {
      try {
        const data = await googleSheetsService.getSettings();
        if (data) {
          setSettings(data);
          // Only update timeLeft if not already in an exam to avoid jumping
          if (screen !== 'exam') {
            setExamState(prev => ({ ...prev, timeLeft: (data.totalDuration || 120) * 60 }));
          }
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      }
    };

    // Initial load
    loadSettings();

    // Setup polling for real-time updates (e.g. locking the portal)
    const interval = setInterval(() => {
      // Only poll if on login or pre-exam screens to save quota
      if (['login', 'confirm', 'instructions', 'student-register', 'tutorial-register'].includes(screen)) {
        loadSettings();
      }
    }, 60000); // Check for global updates every 60 seconds
    
    return () => clearInterval(interval);
  }, [screen]);

  // Simple "routing" for specific pages
  useEffect(() => {
    const checkRoute = () => {
      const path = window.location.pathname;
      const hash = window.location.hash;
      
      if (path === '/admin' || path === '/admin/' || hash === '#/admin') {
        setScreen('admin');
      } else if (path === '/center' || path === '/center/' || hash === '#/center') {
        if (!center) {
           setScreen('login');
        } else {
           setScreen('center-dashboard');
        }
      } else if (path === '/student-registration' || hash === '#/student-registration' || hash === '#/new-student') {
        setScreen('student-register');
      } else if (path === '/tutorial-registration' || hash === '#/tutorial-registration' || hash === '#/center-registration') {
        setScreen('tutorial-register');
      }
    };

    checkRoute();
    window.addEventListener('hashchange', checkRoute);
    return () => window.removeEventListener('hashchange', checkRoute);
  }, [center]);

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

    // Refresh settings before login to enforce real-time lockdown
    try {
      const freshSettings = await googleSheetsService.getSettings();
      if (freshSettings) {
        setSettings(freshSettings);
        if (freshSettings.isLocked) {
          setError(freshSettings.lockMessage || 'The exam portal is currently locked by the administrator. Please contact your supervisor.');
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn('Failed to refresh settings during login:', err);
      // Proceed with current settings if refresh fails
      if (settings?.isLocked) {
        setError(settings.lockMessage || 'The exam portal is currently locked by the administrator. Please contact your supervisor.');
        setLoading(false);
        return;
      }
    }

    const data = await googleSheetsService.getStudent(regNo);
    if (data) {
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

  const handleCenterLogin = async (token: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await googleSheetsService.getTutorialCenter(token);
      if (data) {
        setCenter(data);
        setScreen('center-dashboard');
      } else {
        setError('Invalid Center Token. Please check and try again.');
      }
    } catch (err) {
      console.error('Center login error:', err);
      setError('An error occurred during center login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCenterStudentRegister = async (details: any) => {
    if (!center) return;
    setLoading(true);
    setError(null);
    try {
      // 1. Refresh center data to get latest student count
      const latestStudents = await googleSheetsService.getCenterStudents(center.token);
      if (latestStudents.length >= center.studentCount) {
        alert(`Registration failed: You have reached your quota of ${center.studentCount} students. Please contact support to increase your allocation.`);
        setLoading(false);
        return;
      }

      // 2. Upload photo first
      const photoUrl = await googleSheetsService.uploadPhoto(details.photographBase64, details.photographContentType, details.regNo);
      if (!photoUrl) throw new Error('Photo upload failed');

      // 2. Register student with center token
      const registrationData = {
        name: details.fullName,
        regNo: details.regNo,
        dob: details.dob,
        institution: details.institution,
        course: details.course,
        subjectCombination: [details.subject1, details.subject2, details.subject3, details.subject4].filter(Boolean),
        photograph: photoUrl,
        centerToken: center.token,
        registrationDate: new Date().toISOString(),
        gender: details.gender,
        address: details.address,
        parentName: details.parentName,
        parentPhone: details.parentPhone,
        email: details.email,
        phone: details.phone,
        whatsapp: details.whatsapp
      };

      const success = await googleSheetsService.registerStudent(registrationData);
      if (success) {
        setScreen('center-dashboard'); // Go back to dashboard on success
        alert('Student successfully registered under your center allocation.');
      } else {
        setError('Failed to register student. Please try again.');
        alert('Failed to register student. Please check if Registration Number is unique.');
      }
    } catch (err) {
      console.error('Center student registration error:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
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
    try {
      const data = await googleSheetsService.getQuestions(student.subjectCombination);
      
      if (!Array.isArray(data)) {
        console.error('Invalid questions data received:', data);
        const backendError = data && typeof data === 'object' ? ((data as any).error || JSON.stringify(data)) : 'Invalid data format';
        setError(`Failed to load questions: ${backendError}. Please check your Google Script deployment.`);
        setLoading(false);
        return;
      }

      if (data.length === 0) {
        console.warn('No questions found for subjects:', student.subjectCombination);
        setError('No questions found for your subject combination. Please notify the supervisor.');
        setLoading(false);
        return;
      }

      const uniqueMap = new Map<string, Question>();
      data.forEach((q: Question) => {
        // Create a unique key based on text and subject
        const textKey = String(q.text || '').trim().toLowerCase();
        const subKey = String(q.subject || '').trim().toLowerCase();
        const uniqueKey = `${subKey}_${textKey}`;

        if (!uniqueMap.has(uniqueKey)) {
          // Ensure q.id is populated for history tracking. 
          // If the spreadsheet lacks an ID, we use the uniqueKey as the ID.
          if (!q.id || q.id.trim() === '') {
            q.id = uniqueKey;
          }
          uniqueMap.set(uniqueKey, q);
        }
      });
      let dataPool = Array.from(uniqueMap.values());
      
      // Normalize settings keys for easier matching
      const normalizedCounts: Record<string, number> = {};
      let globalCount = 40; 

      if (settings?.questionsPerSubject) {
        if (typeof settings.questionsPerSubject === 'number') {
          globalCount = settings.questionsPerSubject;
        } else if (typeof settings.questionsPerSubject === 'object') {
          Object.entries(settings.questionsPerSubject).forEach(([key, val]) => {
            normalizedCounts[key.toLowerCase().trim()] = Number(val);
          });
        }
      }
      
      // Identify history
      const history = new Set(student.allAttemptedQuestionIds || []);
      
      // Group only relevant questions by subject from the pool
      const grouped: Record<string, Question[]> = {};
      dataPool.forEach(q => {
        const sub = q.subject.trim();
        if (!grouped[sub]) grouped[sub] = [];
        grouped[sub].push(q);
      });

      // Select questions following the order of student's subject combination
      let finalQuestions: Question[] = [];
      student.subjectCombination.forEach(subName => {
        const trimmedSub = subName.trim();
        const subLower = trimmedSub.toLowerCase();
        
        // Find the group that matches this subject (case-insensitive & flexible)
        const matchingKey = Object.keys(grouped).find(k => {
          const lk = k.toLowerCase().trim();
          return lk === subLower || lk.includes(subLower) || subLower.includes(lk);
        });
        const qs = matchingKey ? grouped[matchingKey] : [];
        
        if (qs.length > 0) {
          // Shuffle the pool first to ensure randomness
          let subPool = [...qs];
          for (let i = subPool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [subPool[i], subPool[j]] = [subPool[j], subPool[i]];
          }

          // Determine how many to take
          let count = normalizedCounts[subLower];
          if (count === undefined) {
            const partialKey = Object.keys(normalizedCounts).find(k => subLower.includes(k) || k.includes(subLower));
            if (partialKey) count = normalizedCounts[partialKey];
          }
          const finalCount = count || globalCount;

          // Separate fresh and repeat questions
          const freshPool = subPool.filter(q => !history.has(q.id));
          const repeatPool = subPool.filter(q => history.has(q.id));

          // Goal: Take mostly fresh, allow 5-10% repeats
          const repeatTargetCount = Math.floor(finalCount * 0.08); // 8% repeat target
          
          let selectedForSub: Question[] = [];
          
          // Take fresh ones first (limited to leave room for repeats)
          const freshToTake = Math.min(freshPool.length, finalCount - repeatTargetCount);
          selectedForSub = [...freshPool.slice(0, freshToTake)];

          // Fill remaining with repeat pool (up to target)
          let needed = finalCount - selectedForSub.length;
          if (needed > 0) {
            const repeatsToTake = Math.min(repeatPool.length, needed);
            selectedForSub = [...selectedForSub, ...repeatPool.slice(0, repeatsToTake)];
          }

          // Fallback: If still under-filled (because repeat pool was small), take more from fresh pool
          needed = finalCount - selectedForSub.length;
          if (needed > 0 && freshPool.length > freshToTake) {
            const additionalFresh = Math.min(freshPool.length - freshToTake, needed);
            selectedForSub = [...selectedForSub, ...freshPool.slice(freshToTake, freshToTake + additionalFresh)];
          }

          // Final shuffle of the selected questions for this subject
          for (let i = selectedForSub.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [selectedForSub[i], selectedForSub[j]] = [selectedForSub[j], selectedForSub[i]];
          }

          finalQuestions = [...finalQuestions, ...selectedForSub];
        }
      });

      // Ensure all questions have normalized subject names for consistent UI filtering
      finalQuestions = finalQuestions.map(q => ({
        ...q,
        subject: q.subject.trim()
      }));

      if (finalQuestions.length === 0) {
        setError('No questions available for your specific registration. Please contact the examiner.');
        setLoading(false);
        return;
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
    } catch (err) {
      console.error('Error during question loading process:', err);
      setError('A system error occurred while preparing your exam. Please try refreshing or contact support.');
    } finally {
      setLoading(false);
    }
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
    
    // Calculate raw scores and total questions per subject from the questions used in this exam
    const rawScores: Record<string, number> = {};
    const totalQuestionsPerSubject: Record<string, number> = {};
    student.subjectCombination.forEach(sub => {
      rawScores[sub] = 0;
      totalQuestionsPerSubject[sub] = 0;
    });
    
    questions.forEach((q, i) => {
      totalQuestionsPerSubject[q.subject] = (totalQuestionsPerSubject[q.subject] || 0) + 1;
      if (examState.answers[i] === q.correctAnswer) {
        rawScores[q.subject] = (rawScores[q.subject] || 0) + 1;
      }
    });
    
    // Compute percentage scores (each subject weighted to 100 marks)
    const subjectScores: Record<string, number> = {};
    let totalScore = 0;
    student.subjectCombination.forEach(sub => {
      const correct = rawScores[sub] || 0;
      const total = totalQuestionsPerSubject[sub] || 1; // Avoid division by zero
      const percentage = Math.round((correct / total) * 100);
      subjectScores[sub] = percentage;
      totalScore += percentage;
    });
    
    const result: ExamResult = {
      action: 'saveResult',
      regNo: student.regNo,
      name: student.name,
      subjectsTaken: student.subjectCombination.join(', '),
      scores: subjectScores,
      ...subjectScores, // Flatten scores: English: 85, Mathematics: 70, etc.
      totalScore,
      date: new Date().toLocaleDateString(),
      timeSubmitted: new Date().toLocaleTimeString(),
      tabSwitchCount: examState.tabSwitches,
      attemptedQuestionIds: questions.map(q => q.id), // Store attempted IDs
      rawScores // Storing raw counts for reference
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
        return (
          <LoginScreen 
            onLogin={handleLogin} 
            onStudentRegister={() => setScreen('student-register')}
            onTutorialRegister={() => setScreen('tutorial-register')}
            onCenterLogin={handleCenterLogin}
            loading={loading} 
            error={error} 
            studentRegEnabled={settings?.studentRegEnabled}
            tutorialRegEnabled={settings?.tutorialRegEnabled}
            title={settings?.examTitle}
            settings={settings}
          />
        );
      case 'confirm':
        return <ConfirmDetailsScreen settings={settings} student={student} onConfirm={() => setScreen('instructions')} />;
      case 'instructions':
        if (!settings) return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
        return <InstructionsScreen settings={settings} student={student} onProceed={() => loadQuestions()} loading={loading} error={error} />;
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
      case 'student-register':
        return <StudentRegistrationScreen onBack={() => setScreen(center ? 'center-dashboard' : 'login')} onProceedToPayment={center ? handleCenterStudentRegister : (details) => handleProceedToPayment(details, 'student')} regFee={settings?.studentRegFee} settings={settings} centerToken={center?.token} />;
      case 'tutorial-register':
        return <TutorialRegistrationScreen onBack={() => setScreen('login')} onProceedToPayment={(details) => handleProceedToPayment(details, 'tutorial')} baseFee={settings?.tutorialBaseFee} discountTiers={settings?.discountTiers} settings={settings} />;
      case 'admin':
        return <AdminPage initialSettings={settings} onBack={() => setScreen('login')} onSave={(s) => setSettings(s)} />;
      case 'center-dashboard':
        return <CenterDashboard center={center} onBack={() => { setCenter(null); setScreen('login'); }} onAddStudent={() => setScreen('student-register')} settings={settings} />;
      case 'payment-success':
        return <PaymentSuccessScreen details={registrationDetails} type={registrationType} onBackToLogin={() => setScreen('login')} settings={settings} />;
      case 'verifying-payment':
        return (
          <div className="h-screen bg-slate-50 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6 animate-pulse">
              <ShieldCheck className="w-10 h-10 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 mb-2">Verifying Payment...</h1>
            <p className="text-slate-500 max-w-sm">Please do not close this window. We are confirming your transaction and deploying your exam details.</p>
            <div className="mt-8 flex gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce"></div>
            </div>
          </div>
        );
      case 'completed':
        return (
          <CompletedScreen 
            student={student} 
            status={submissionStatus} 
            onRetry={retrySubmission} 
            loading={loading}
            onLogout={() => window.location.reload()} 
            settings={settings}
            result={lastResult}
          />
        );
    }
  };

  return (
    <div className="h-screen bg-[#f9f9f9] text-[#1a1c1c] font-sans scroll-smooth overflow-hidden">
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

function LoginScreen({ onLogin, onCenterLogin, onStudentRegister, onTutorialRegister, loading, error, studentRegEnabled = true, tutorialRegEnabled = true, title = 'JAMB Mock Assessment', settings }: { 
  onLogin: (regNo: string) => void, 
  onCenterLogin: (token: string) => void,
  onStudentRegister: () => void,
  onTutorialRegister: () => void,
  loading: boolean, 
  error: string | null,
  studentRegEnabled?: boolean,
  tutorialRegEnabled?: boolean,
  title?: string,
  settings: ExamSettings | null
}) {
  const [regNo, setRegNo] = useState('');
  const [centerToken, setCenterToken] = useState('');
  const [mode, setMode] = useState<'student' | 'center'>('student');

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
          <h1 className="text-xl md:text-2xl font-black text-[#004d27] tracking-tight">{title}</h1>
          <p className="text-gray-500 font-medium text-[10px] md:text-xs tracking-wide uppercase">Unified Tertiary Matriculation Examination</p>
        </div>
      </header>

      <main className="flex-grow flex items-center justify-center px-4 md:px-6 bg-[radial-gradient(#004d27_0.5px,transparent_0.5px)] [background-size:24px_24px] [background-opacity:0.05] overflow-y-auto min-h-0">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-xl p-5 md:p-6 shadow-sm border border-gray-100">
            <div className="mb-6 flex justify-between items-center">
              <div>
                <h2 className="text-md md:text-lg font-bold text-gray-900 mb-1">
                  {mode === 'student' ? 'Candidate Login' : 'Center Coordinator Login'}
                </h2>
                <p className="text-gray-500 text-[10px] md:text-xs">
                  {mode === 'student' ? 'Please enter your credentials to begin your session.' : 'Access your tutorial center dashboard.'}
                </p>
              </div>
              <Building2 className={`w-8 h-8 ${mode === 'center' ? 'text-emerald-600' : 'text-gray-200'} transition-colors`} />
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

            <form className="space-y-4" onSubmit={(e) => { 
                e.preventDefault(); 
                if (mode === 'student') onLogin(regNo);
                else onCenterLogin(centerToken);
              }}>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-gray-900 uppercase tracking-widest">
                  {mode === 'student' ? 'Registration Number' : 'Center Access Token'}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    {mode === 'student' ? <UserCircle className="w-5 h-5 text-gray-400" /> : <Building2 className="w-5 h-5 text-gray-400" />}
                  </div>
                  <input 
                    className="block w-full pl-12 pr-4 py-3 bg-gray-50 border-none focus:ring-2 focus:ring-[#004d27] rounded-lg text-gray-900 placeholder:text-gray-400 transition-all text-sm"
                    placeholder={mode === 'student' ? "e.g., 12345678AB" : "TC-XXXXXX"}
                    value={mode === 'student' ? regNo : centerToken}
                    onChange={(e) => mode === 'student' ? setRegNo(e.target.value) : setCenterToken(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
              </div>
              
              {mode === 'student' && (
                <div className="flex gap-3 p-3 bg-emerald-50 rounded-lg border-l-4 border-[#004d27]">
                  <Info className="w-4 h-4 text-[#004d27] shrink-0" />
                  <p className="text-[10px] text-gray-600 leading-relaxed">
                    Ensure you are at your assigned workstation. Do not attempt to log in until instructed by the supervisor.
                  </p>
                </div>
              )}

              <button 
                disabled={loading}
                className={`w-full py-3 ${mode === 'center' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-[#004d27]'} text-white font-bold rounded-lg shadow-md hover:shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 group text-sm disabled:opacity-50`}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (mode === 'student' ? 'Log In' : 'Manage Center')}
                {!loading && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
              </button>
            </form>
            <div className="mt-4 flex flex-col gap-2">
              {studentRegEnabled && !settings?.isLocked && (
                <button 
                  onClick={onStudentRegister}
                  className="w-full py-2 bg-white text-[#004d27] border-2 border-[#004d27] font-bold rounded-lg hover:bg-emerald-50 transition-all text-xs"
                >
                  New Student Registration
                </button>
              )}
              {tutorialRegEnabled && !settings?.isLocked && (
                <button 
                  onClick={onTutorialRegister}
                  className="w-full py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition-all text-xs"
                >
                  Tutorial Center Bulk Registration
                </button>
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-50 flex flex-col items-center">
              <button 
                onClick={() => setMode(mode === 'student' ? 'center' : 'student')}
                className="text-emerald-700 text-[10px] font-bold hover:underline py-1"
              >
                {mode === 'student' ? 'Are you a Center Coordinator? Access Dashboard' : 'Back to Candidate Login'}
              </button>
              {mode === 'student' && (
                <button className="text-gray-400 text-[10px] font-bold hover:underline py-1 mt-1">Forgotten Registration Number?</button>
              )}
            </div>
            {(settings?.customerServiceEmail || settings?.customerServiceNumber) && (
              <div className="mt-6 flex flex-col items-center gap-2 border-t border-gray-100 pt-6">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Candidate Support</p>
                <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mb-2">
                  {settings.customerServiceEmail && (
                    <a href={`mailto:${settings.customerServiceEmail}`} className="flex items-center gap-1.5 text-xs font-bold text-[#004d27] hover:underline">
                      <Mail className="w-3.5 h-3.5" />
                      {settings.customerServiceEmail}
                    </a>
                  )}
                  {settings.customerServiceNumber && (
                    <a href={`tel:${settings.customerServiceNumber}`} className="flex items-center gap-1.5 text-xs font-bold text-[#004d27] hover:underline">
                      <Phone className="w-3.5 h-3.5" />
                      {settings.customerServiceNumber}
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="mt-4 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full text-[9px] font-bold uppercase">
              <span className={`flex h-1.5 w-1.5 rounded-full animate-pulse ${settings?.isLocked ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
              <span className={settings?.isLocked ? 'text-red-600' : 'text-gray-500'}>
                System Status: {settings?.isLocked ? 'Portal Locked' : 'Secure & Ready'}
              </span>
            </div>
          </div>
        </div>
      </main>

      <footer className="w-full py-4 px-6 bg-gray-50 flex flex-col items-center border-t border-gray-100 shrink-0">
        <div className="flex flex-col items-center gap-2 mb-2">
          <div className="flex items-center gap-2 text-gray-500">
            <UserCircle className="w-3 h-3" />
            <p className="text-[10px] font-medium">{settings?.supportText || 'For technical support, contact the center supervisor.'}</p>
          </div>
          {(settings?.customerServiceEmail || settings?.customerServiceNumber) && (
            <div className="flex flex-wrap justify-center gap-3">
              {settings.customerServiceEmail && <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-tighter">{settings.customerServiceEmail}</span>}
              {settings.customerServiceNumber && <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-tighter">{settings.customerServiceNumber}</span>}
            </div>
          )}
        </div>
        <div className="flex gap-4 opacity-40">
          <span className="text-[8px] font-bold tracking-widest uppercase">{settings?.systemVersion || 'System v4.2.0'}</span>
          <span className="text-[8px] font-bold tracking-widest uppercase">{settings?.copyrightText || '© 2024 JAMB'}</span>
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

function InstructionsScreen({ settings, student, onProceed, loading, error }: { settings: ExamSettings | null, student: Student | null, onProceed: () => void, loading: boolean, error: string | null }) {
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

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-700 shadow-sm animate-shake">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-sm">Startup Error</p>
                  <p className="text-xs opacity-90">{error}</p>
                </div>
              </div>
            )}

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
              {currentQuestion.passage && (
                <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-gray-100 mb-4 overflow-y-auto max-h-[30vh]">
                  <div className="text-[10px] uppercase font-black text-emerald-600 tracking-widest mb-3 flex items-center gap-2">
                    <BookOpen className="w-3 h-3" />
                    Comprehension Passage
                  </div>
                  <div className="text-sm md:text-base text-gray-700 leading-relaxed font-serif italic border-l-4 border-emerald-100 pl-4 py-1">
                    <RenderMath text={currentQuestion.passage} />
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center mb-4 md:mb-6 shrink-0">
                <div className="mb-4">
                  <span className="text-[10px] uppercase font-black text-gray-400 tracking-widest bg-gray-100 px-2 py-0.5 rounded">
                    Question {state.currentQuestionIndex + 1} of {questions.length} • {currentQuestion.subject}
                  </span>
                  <div className="text-xl md:text-2xl font-black text-gray-900 leading-tight mt-2 min-h-[1.5em] flex items-center">
                    <RenderMath text={currentQuestion.text} />
                  </div>
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
                {currentQuestion.image && (
                  <div className="mb-4 bg-white p-2 border border-gray-100 rounded-xl overflow-hidden flex justify-center shadow-sm">
                    <img 
                      src={getDirectImageUrl(currentQuestion.image)} 
                      alt="Question Diagram" 
                      className="max-w-full max-h-[250px] object-contain cursor-zoom-in hover:scale-[1.02] transition-transform"
                      onClick={() => window.open(getDirectImageUrl(currentQuestion.image as string), '_blank')}
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}

                <div className="bg-white p-5 md:p-8 rounded-2xl shadow-sm border border-gray-100 mb-4 md:mb-6 flex-grow overflow-y-auto min-h-[250px]">
                  <div className="space-y-2 md:space-y-3">
                    {currentQuestion.options.map((option) => {
                        return (
                          <button
                            key={option.id}
                            onClick={() => onAnswer(state.currentQuestionIndex, option.id)}
                            className={`w-full p-4 md:p-5 rounded-xl border-2 text-left transition-all duration-200 flex items-center gap-4 group/opt ${
                              state.answers[state.currentQuestionIndex] === option.id
                                ? 'border-[#004d27] bg-emerald-50 shadow-md ring-2 ring-emerald-100'
                                : 'border-gray-100 bg-white hover:border-emerald-200 hover:bg-gray-50'
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm transition-colors ${
                              state.answers[state.currentQuestionIndex] === option.id
                                ? 'bg-[#004d27] text-white'
                                : 'bg-gray-100 text-gray-400 group-hover/opt:bg-emerald-100 group-hover/opt:text-[#004d27]'
                            }`}>
                              {option.id}
                            </div>
                            <div className={`flex-grow flex flex-col gap-2 font-bold text-sm md:text-base ${
                              state.answers[state.currentQuestionIndex] === option.id ? 'text-[#004d27]' : 'text-gray-700'
                            }`}>
                              <RenderMath text={option.text} />
                              {option.image && (
                                <img 
                                  src={getDirectImageUrl(option.image)} 
                                  alt={`Option ${option.id} Image`} 
                                  className="max-w-[150px] h-auto rounded border border-gray-50 mt-1"
                                  referrerPolicy="no-referrer"
                                />
                              )}
                            </div>
                            <div className={`w-2 h-2 rounded-full transition-all ${
                              state.answers[state.currentQuestionIndex] === option.id ? 'bg-[#004d27] scale-125' : 'bg-transparent'
                            }`}></div>
                          </button>
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

function CompletedScreen({ student, status, onRetry, loading, onLogout, settings, result }: { 
  student: Student | null, 
  status: 'idle' | 'success' | 'failed',
  onRetry: () => void,
  loading: boolean,
  onLogout: () => void,
  settings: ExamSettings | null,
  result: ExamResult | null
}) {
  const showResults = settings?.showResultsAfterExam && result && status === 'success';

  return (
    <div className="h-full bg-white flex items-center justify-center p-4 overflow-y-auto">
      <div className="max-w-2xl w-full text-center py-8">
        <div className="mb-6">
          <div className="relative inline-block">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center ${status === 'failed' ? 'bg-red-50' : 'bg-emerald-50'}`}>
              {status === 'failed' ? (
                <AlertCircle className="w-10 h-10 text-red-600" />
              ) : (
                <CheckCircle2 className="w-10 h-10 text-[#004d27]" />
              )}
            </div>
            <div className="absolute -top-1 -right-1 w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center border-4 border-white">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
            </div>
          </div>
        </div>
        
        <h1 className="text-2xl font-black text-gray-900 mb-2 tracking-tight">
          {status === 'failed' ? 'Submission Issue Detected' : 'Exam Successfully Completed'}
        </h1>
        
        <div className={`p-4 rounded-2xl mb-6 border ${status === 'failed' ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
          <p className="text-sm md:text-base text-gray-500 leading-relaxed font-medium">
            {status === 'failed' ? (
              <span className="text-red-700">
                We encountered an issue saving your results. Please click "Retry Submission" or notify your supervisor.
              </span>
            ) : (
              `Congratulations, ${student?.name}. You have successfully completed your exam. Your results have been recorded.`
            )}
          </p>
        </div>

        {showResults && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 bg-emerald-50/50 rounded-2xl border-2 border-emerald-100 p-6"
          >
            <h2 className="text-emerald-800 font-black uppercase tracking-widest text-xs mb-4">Exam Performance Score</h2>
            <div className="flex flex-col items-center mb-6">
              <div className="text-5xl font-black text-[#004d27] mb-1">{result.totalScore}</div>
              <div className="text-emerald-600 font-bold text-sm tracking-tighter">TOTAL SCORE / 400</div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {Object.entries(result.scores).map(([subject, score]) => (
                <div key={subject} className="bg-white p-3 rounded-xl border border-emerald-100 shadow-sm flex flex-col items-center">
                  <span className="text-[10px] font-black text-gray-400 uppercase truncate w-full">{subject}</span>
                  <span className="text-xl font-black text-[#004d27]">{score}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-left mb-8">
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

// --- Registration Screens ---

function StudentRegistrationScreen({ onBack, onProceedToPayment, regFee = 1500, settings, centerToken }: { onBack: () => void, onProceedToPayment: (details: any) => void, regFee?: number, settings: ExamSettings | null, centerToken?: string }) {
  const [formData, setFormData] = useState({
    regNo: "",
    fullName: "",
    dob: "",
    institution: "",
    course: "",
    subject1: "Use of English (Compulsory)", // Default to JAMB standard or first from list
    subject2: "",
    subject3: "",
    subject4: "",
    email: "",
    phone: "",
    whatsapp: "",
    gender: "",
    address: "",
    parentName: "",
    parentPhone: "",
    photographBase64: "", // Store base64 encoded photo
    photographContentType: "", // e.g., image/png
    confirmed: false
  });

  const [subjects, setSubjects] = useState<string[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        setLoadingSubjects(true);
        const data = await googleSheetsService.getSubjects();
        console.log('Fetched subjects in UI:', data);
        if (data && data.length > 0) {
          setSubjects(data);
          // Prioritize English for subject1
          const englishSub = data.find(s => s.toLowerCase().includes('english')) || data[0];
          setFormData(prev => ({ ...prev, subject1: englishSub }));
        } else {
          console.warn('No subjects returned from backend. Using static fallback.');
          const fallback = ["Mathematics", "Physics", "Chemistry", "Biology", "Economics", "Literature", "Government", "History", "Christian Religious Studies", "Islamic Studies"];
          setSubjects(fallback);
          setFormData(prev => ({ ...prev, subject1: "Use of English (Compulsory)" }));
        }
      } catch (err) {
        console.error('Failed to load subjects:', err);
        // Ensure some defaults even on total failure
        setSubjects(["Mathematics", "Physics", "Chemistry", "Biology", "Economics"]);
      } finally {
        setLoadingSubjects(false);
      }
    };
    fetchSubjects();
  }, []);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("Photo size too large. Please select an image smaller than 2MB.");
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setPhotoPreview(base64);
        setFormData(prev => ({ 
          ...prev, 
          photographBase64: base64,
          photographContentType: file.type 
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.confirmed) return;
    if (!formData.photographBase64) {
      alert("Please upload your photograph.");
      return;
    }
    
    // Ensure all subjects are unique (except for subject 1 which is compulsory)
    const selectedSubjects = [formData.subject2, formData.subject3, formData.subject4].filter(Boolean);
    const uniqueSubjects = new Set(selectedSubjects);
    if (uniqueSubjects.size < 3) {
      alert("Please select three different elective subjects.");
      return;
    }

    onProceedToPayment(formData);
  };

  return (
    <div className="h-full bg-slate-50 flex flex-col overflow-y-auto custom-scrollbar">
      {/* Header Area */}
      <div className="bg-[#004d27] p-3 md:p-4 text-white shadow-md sticky top-0 z-20 flex items-center justify-between">
        <div className="flex items-center gap-2 md:gap-3">
          <button onClick={onBack} type="button" title="Go back" className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5 text-emerald-100" />
          </button>
          <div>
            <h1 className="text-sm md:text-lg font-black tracking-tight uppercase">New Candidate Portal</h1>
            <p className="text-[10px] text-emerald-100/70 font-bold uppercase tracking-widest hidden md:block">Session 2026/2027</p>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <p className="text-[10px] font-bold text-emerald-100 uppercase tracking-widest">Registration Fee</p>
          <p className="text-sm font-black text-white">₦{regFee.toLocaleString()}</p>
        </div>
      </div>

      <div className="flex-grow p-4 md:p-6 lg:p-8 flex justify-center">
        <form onSubmit={handleSubmit} className="w-full max-w-7xl bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-gray-100 h-fit">
          {/* Identity & Personal - Col 1 */}
          <div className="flex-1 p-5 md:p-8 space-y-4 md:space-y-6">
            <div className="flex items-center gap-2 mb-2">
              <User className="w-4 h-4 text-[#004d27]" />
              <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">Personal Identity</h2>
            </div>
            <div className="space-y-3 md:space-y-4">
              <InputField label="JAMB Registration Number" value={formData.regNo} onChange={(v) => setFormData({...formData, regNo: v})} required placeholder="12345678AB" />
              <InputField label="Full Name" value={formData.fullName} onChange={(v) => setFormData({...formData, fullName: v})} required placeholder="John Doe" />
              <div className="grid grid-cols-2 gap-4">
                <InputField label="Date of Birth" type="date" value={formData.dob} onChange={(v) => setFormData({...formData, dob: v})} required />
                <InputField label="Gender" type="select" options={["Male", "Female"]} value={formData.gender} onChange={(v) => setFormData({...formData, gender: v})} required />
              </div>
              <InputField label="Residential Address" value={formData.address} onChange={(v) => setFormData({...formData, address: v})} required placeholder="Full residential address" />
            </div>
          </div>

          {/* Contact & Guardian - Col 2 */}
          <div className="flex-1 p-5 md:p-8 space-y-4 md:space-y-6 bg-gray-50/30">
            <div className="flex items-center gap-2 mb-2">
              <Mail className="w-4 h-4 text-[#004d27]" />
              <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">Contact Information</h2>
            </div>
            <div className="space-y-3 md:space-y-4">
              <InputField label="Email Address" type="email" value={formData.email} onChange={(v) => setFormData({...formData, email: v})} required placeholder="name@example.com" />
              <div className="grid grid-cols-2 gap-4">
                <InputField label="Phone Number" type="tel" value={formData.phone} onChange={(v) => setFormData({...formData, phone: v})} required placeholder="080XXXXXXXX" />
                <InputField label="WhatsApp" type="tel" value={formData.whatsapp} onChange={(v) => setFormData({...formData, whatsapp: v})} required placeholder="080XXXXXXXX" />
              </div>
              <div className="pt-2">
                <div className="flex items-center gap-2 mb-3">
                  <Building2 className="w-4 h-4 text-[#004d27]" />
                  <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">Next of Kin</h2>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <InputField label="Guardian Name" value={formData.parentName} onChange={(v) => setFormData({...formData, parentName: v})} required placeholder="Mr./Mrs. Doe" />
                  <InputField label="Guardian Phone" type="tel" value={formData.parentPhone} onChange={(v) => setFormData({...formData, parentPhone: v})} required placeholder="080XXXXXXXX" />
                </div>
              </div>
            </div>
          </div>

          {/* Academic & Submit - Col 3 */}
          <div className="flex-1 p-5 md:p-8 space-y-4 md:space-y-6">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="w-4 h-4 text-[#004d27]" />
              <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">Subject Selection</h2>
            </div>
            <div className="space-y-3 md:space-y-4">
              <div className="bg-[#004d27]/5 p-2.5 rounded-xl border border-[#004d27]/10 flex items-center justify-between">
                <span className="text-[9px] font-black text-[#004d27] uppercase opacity-60">Primary Subject</span>
                <span className="text-[11px] font-black text-[#004d27]">{loadingSubjects ? '...' : formData.subject1}</span>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {[2, 3, 4].map(num => (
                  <select 
                    key={num} 
                    required 
                    title={`Select Elective ${num - 1}`}
                    className="w-full p-2.5 bg-gray-50 border border-gray-100 rounded-xl text-[11px] font-bold focus:ring-2 focus:ring-[#004d27] transition-all cursor-pointer"
                    value={(formData as any)[`subject${num}`]}
                    onChange={(e) => setFormData({...formData, [`subject${num}`]: e.target.value})}
                  >
                    <option value="">Select Elective {num-1}</option>
                    {subjects.filter(s => s !== formData.subject1).map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                ))}
              </div>

              <div className="pt-2">
                 <div className="flex items-center gap-2 mb-2">
                  <Camera className="w-4 h-4 text-[#004d27]" />
                  <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">Verification Photo</h2>
                </div>
                <div className="border-2 border-dashed border-gray-100 rounded-2xl p-3 flex flex-col items-center justify-center gap-2 bg-gray-50/50 hover:bg-emerald-50/30 transition-all cursor-pointer relative group h-[80px]">
                  {photoPreview ? (
                    <div className="flex items-center gap-3">
                      <img src={photoPreview} alt="Preview" className="w-10 h-10 rounded-lg object-cover shadow-sm border border-white" />
                      <p className="text-[9px] font-bold text-[#004d27]">Photo Captured ✓</p>
                    </div>
                  ) : (
                    <>
                      <UserCircle className="w-5 h-5 text-gray-300" />
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Click to upload photo</p>
                    </>
                  )}
                  <input type="file" accept="image/*" onChange={handlePhotoChange} title="Upload photo" className="absolute inset-0 opacity-0 cursor-pointer" required={!formData.photographBase64} />
                </div>
              </div>

              <div className="pt-4 border-t border-gray-50">
                <label className="flex items-start gap-2 cursor-pointer group mb-3">
                  <input type="checkbox" checked={formData.confirmed} onChange={(e) => setFormData({...formData, confirmed: e.target.checked})} className="mt-1 w-4 h-4 rounded border-gray-300 text-[#004d27] focus:ring-[#004d27]" />
                  <span className="text-[9px] font-bold text-gray-500 leading-tight uppercase">I verify that all information is accurate and I am ready to pay ₦{regFee.toLocaleString()}</span>
                </label>
                <button type="submit" disabled={!formData.confirmed} className="w-full py-4 bg-[#004d27] text-white font-black rounded-2xl shadow-xl hover:-translate-y-0.5 active:scale-95 transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  {centerToken ? 'Register Student (Allocated)' : `Pay ₦${regFee.toLocaleString()}`}
                </button>
              </div>

              {(settings?.customerServiceEmail || settings?.customerServiceNumber) && (
                <div className="pt-4 mt-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-center gap-4 text-gray-400">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black uppercase tracking-widest">Support:</span>
                  </div>
                  {settings.customerServiceEmail && (
                    <a href={`mailto:${settings.customerServiceEmail}`} className="flex items-center gap-1.5 text-[10px] font-bold hover:text-[#004d27] transition-colors">
                      <Mail className="w-3 h-3" />
                      {settings.customerServiceEmail}
                    </a>
                  )}
                  {settings.customerServiceNumber && (
                    <a href={`tel:${settings.customerServiceNumber}`} className="flex items-center gap-1.5 text-[10px] font-bold hover:text-[#004d27] transition-colors">
                      <Phone className="w-3 h-3" />
                      {settings.customerServiceNumber}
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function TutorialRegistrationScreen({ onBack, onProceedToPayment, baseFee = 1000, discountTiers = [], settings }: { onBack: () => void, onProceedToPayment: (details: any) => void, baseFee?: number, discountTiers?: any[], settings: ExamSettings | null }) {
  const [formData, setFormData] = useState({
    centerName: "",
    coordinatorName: "",
    address: "",
    state: "",
    lga: "",
    studentCount: 150,
    email: "",
    phone: "",
    confirmed: false
  });

  const calculatePrice = (count: number) => {
    if (count < 150) return 0; // Not allowed
    
    // Find matching discount tier
    const tier = discountTiers.find(t => count >= t.min && (t.max === 0 || count <= t.max));
    if (tier) return tier.price;
    
    return baseFee;
  };

  const pricePerStudent = calculatePrice(formData.studentCount);
  const totalAmount = pricePerStudent * formData.studentCount;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.confirmed) return;
    onProceedToPayment({...formData, totalAmount, pricePerStudent});
  };

  return (
    <div className="h-full bg-slate-900/5 flex flex-col overflow-y-auto custom-scrollbar">
      {/* Dynamic Glass Header */}
      <div className="bg-slate-900 p-4 text-white shadow-xl sticky top-0 z-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} type="button" title="Go back" className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5 text-emerald-400" />
          </button>
          <div>
            <h1 className="text-sm md:text-lg font-black tracking-tight uppercase flex items-center gap-2">
              Tutorial Center Bulk Portal
              <span className="bg-emerald-500/20 text-emerald-400 text-[8px] px-1.5 py-0.5 rounded border border-emerald-500/20">PARTNER</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest hidden md:block">Tiered Discounts Active ✓</p>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Calculated Total</p>
          <p className="text-sm md:text-lg font-black text-emerald-400">₦{totalAmount.toLocaleString()}</p>
        </div>
      </div>

      <div className="flex-grow p-4 md:p-8 flex justify-center">
        <form onSubmit={handleSubmit} className="w-full max-w-7xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-100 h-fit">
          {/* Center Details - Col 1 */}
          <div className="flex-1 p-6 md:p-8 space-y-6">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="w-4 h-4 text-emerald-600" />
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">Establishment info</h2>
            </div>
            <div className="space-y-4">
              <InputField label="Name of Tutorial Center" value={formData.centerName} onChange={(v) => setFormData({...formData, centerName: v})} required placeholder="e.g. Royal Academy" />
              <InputField label="Official Business Address" value={formData.address} onChange={(v) => setFormData({...formData, address: v})} required placeholder="123 Academic Drive" />
              <div className="grid grid-cols-2 gap-4">
                <InputField label="State" value={formData.state} onChange={(v) => setFormData({...formData, state: v})} required placeholder="Lagos" />
                <InputField label="LGA" value={formData.lga} onChange={(v) => setFormData({...formData, lga: v})} required placeholder="Ikeja" />
              </div>
            </div>
          </div>

          {/* Logistics - Col 2 */}
          <div className="flex-1 p-6 md:p-8 space-y-6 bg-slate-50/30">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-emerald-600" />
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">Enrollment Logistics</h2>
            </div>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Student Count</label>
                <div className="relative">
                  <input type="number" min="150" title="Student count" className="block w-full px-4 py-3 bg-white border border-slate-200 focus:ring-2 focus:ring-emerald-500 rounded-xl text-slate-900 font-black transition-all text-sm" value={formData.studentCount} onChange={(e) => setFormData({...formData, studentCount: Math.max(0, parseInt(e.target.value) || 0)})} required />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">MIN 150</div>
                </div>
              </div>

              <div className="pt-4">
                <div className="flex items-center gap-2 mb-4">
                  <UserCircle className="w-4 h-4 text-emerald-600" />
                  <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">Lead Coordinator</h2>
                </div>
                <InputField label="Full Name of Coordinator" value={formData.coordinatorName} onChange={(v) => setFormData({...formData, coordinatorName: v})} required placeholder="Mark Jackson" />
              </div>
            </div>
          </div>

          {/* Pricing & Checkout - Col 3 */}
          <div className="flex-1 p-6 md:p-8 space-y-6">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="w-4 h-4 text-emerald-600" />
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">Contact & Pricing</h2>
            </div>
            <div className="space-y-4">
              <InputField label="Email Address" type="email" value={formData.email} onChange={(v) => setFormData({...formData, email: v})} required placeholder="coord@center.com" />
              <InputField label="Direct Phone Number" type="tel" value={formData.phone} onChange={(v) => setFormData({...formData, phone: v})} required placeholder="080XXXXXXXX" />

              <div className="bg-slate-900 rounded-2xl p-5 text-white shadow-2xl relative overflow-hidden mt-4">
                <div className="absolute top-0 right-0 p-2 opacity-10">
                  <Building2 className="w-12 h-12 text-white" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center border-b border-white/5 pb-2">
                    <span className="text-[9px] font-bold text-slate-500 uppercase">Unit Price</span>
                    <span className="text-xs font-black text-emerald-400">₦{pricePerStudent.toLocaleString()}</span>
                  </div>
                  <div className="pt-1">
                    <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Final Payable Amount</span>
                    <span className="text-2xl font-black text-white">₦{totalAmount.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <label className="flex items-start gap-3 cursor-pointer group mb-4">
                  <input type="checkbox" checked={formData.confirmed} onChange={(e) => setFormData({...formData, confirmed: e.target.checked})} className="mt-1 w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                  <span className="text-[9px] font-bold text-slate-500 leading-tight uppercase">I verify center details and accept the total payment of ₦{totalAmount.toLocaleString()}</span>
                </label>
                <button type="submit" disabled={!formData.confirmed || formData.studentCount < 150} className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl shadow-xl hover:-translate-y-0.5 active:scale-95 transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-30">
                  <CreditCard className="w-4 h-4" />
                  Initialize Payment
                </button>
              </div>

              {(settings?.customerServiceEmail || settings?.customerServiceNumber) && (
                <div className="pt-4 mt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-center gap-4 text-slate-400">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black uppercase tracking-widest">Help Desk:</span>
                  </div>
                  {settings.customerServiceEmail && (
                    <a href={`mailto:${settings.customerServiceEmail}`} className="flex items-center gap-1.5 text-[10px] font-bold hover:text-emerald-400 transition-colors">
                      <Mail className="w-3 h-3" />
                      {settings.customerServiceEmail}
                    </a>
                  )}
                  {settings.customerServiceNumber && (
                    <a href={`tel:${settings.customerServiceNumber}`} className="flex items-center gap-1.5 text-[10px] font-bold hover:text-emerald-400 transition-colors">
                      <Phone className="w-3 h-3" />
                      {settings.customerServiceNumber}
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function PaymentSuccessScreen({ details, type, onBackToLogin, settings }: { details: any, type: "student" | "tutorial" | null, onBackToLogin: () => void, settings: ExamSettings | null }) {
  return (
    <div className="h-full bg-[#f1f5f9] flex flex-col items-center justify-center py-4 px-4 overflow-y-auto custom-scrollbar">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-6 text-center border border-emerald-100 relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1.5 bg-emerald-500"></div>
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-emerald-600" />
        </div>
        
        <h1 className="text-2xl font-black text-slate-900 mb-2">Payment Successful!</h1>
        <p className="text-slate-500 text-sm mb-4 font-medium">
          {type === "student" 
            ? "Your registration for the JAMB Mock Assessment is complete. A confirmation has been sent to your email and phone number." 
            : "Deployment of exam tokens for your center is in progress. The tokens and instructions have been sent to your coordinator email."}
        </p>

        <div className="bg-slate-50 rounded-xl p-4 mb-6 text-left space-y-3 border border-slate-100">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Reference Code</span>
            <span className="text-xs font-black text-slate-900">JAMB-{Math.trunc(Math.random() * 10000000).toString(16).toUpperCase()}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount Paid</span>
            <span className="text-xs font-black text-emerald-600">₦{(type === "student" ? 1500 : details?.totalAmount).toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center pt-3 border-t border-slate-200">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recipient</span>
            <span className="text-xs font-bold text-slate-900">{type === "student" ? details?.fullName : details?.centerName}</span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex justify-center gap-6 mb-2">
            <div className="flex flex-col items-center gap-1">
              <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
                <Mail className="w-5 h-5" />
              </div>
              <span className="text-[9px] font-bold text-slate-400 uppercase">Email</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600">
                <Smartphone className="w-5 h-5" />
              </div>
              <span className="text-[9px] font-bold text-slate-400 uppercase">SMS</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center text-green-600">
                <MessageCircle className="w-5 h-5" />
              </div>
              <span className="text-[9px] font-bold text-slate-400 uppercase">WhatsApp</span>
            </div>
          </div>

          {settings?.customerServiceEmail && (
            <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100/50 mb-4">
              <p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest mb-1">Need Assistance?</p>
              <p className="text-[10px] text-emerald-600 font-bold">Please contact support at {settings.customerServiceEmail} or call {settings.customerServiceNumber}</p>
            </div>
          )}

          <button 
            onClick={onBackToLogin}
            className="w-full py-4 bg-[#004d27] text-white font-black rounded-xl hover:shadow-xl transition-all active:scale-[0.98]"
          >
            Back to Login
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function InputField({ label, icon, type = "text", value, onChange, required, placeholder, options }: { label: string, icon?: React.ReactNode, type?: string, value: any, onChange: (v: any) => void, required?: boolean, placeholder?: string, options?: string[] }) {
  return (
    <div className="space-y-1.5 flex flex-col items-start w-full">
      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">{label}</label>
      <div className="relative w-full">
        {icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4">
            {icon}
          </div>
        )}
        
        {type === "select" ? (
          <select
            required={required}
            title={label}
            className={`block w-full ${icon ? "pl-12" : "px-4"} pr-4 py-3 bg-gray-50 border-none focus:ring-2 focus:ring-[#004d27] rounded-lg text-gray-900 transition-all font-medium text-sm disabled:opacity-50`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={options?.length === 0}
          >
            <option value="">{options?.length === 0 ? 'No options available' : `Select ${label}`}</option>
            {options?.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        ) : (
          <input 
            type={type}
            required={required}
            placeholder={placeholder}
            className={`block w-full ${icon ? "pl-12" : "px-4"} pr-4 py-3 bg-gray-50 border-none focus:ring-2 focus:ring-[#004d27] rounded-lg text-gray-900 placeholder:text-gray-400 transition-all font-medium text-sm`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
      </div>
    </div>
  );
}


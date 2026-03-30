export interface Student {
  name: string;
  dob: string;
  regNo: string;
  subjectCombination: string[];
  photograph: string;
  allAttemptedQuestionIds?: string[]; // History from previous sessions
}

export interface ExamSettings {
  examTitle: string;
  totalDuration: number; // in minutes
  subjectDuration?: number;
  questionsPerSubject: Record<string, number>;
  activeSubjects: string[];
  startTime?: string;
  endTime?: string;
  instructions: string;
  randomSelection: boolean;
  shuffling: boolean;
  tabMonitoring: boolean;
  showResultsAfterExam: boolean;
  studentRegEnabled?: boolean;
  tutorialRegEnabled?: boolean;
  studentRegFee?: number;
  tutorialBaseFee?: number;
  discountTiers?: {
    min: number;
    max: number;
    price: number;
  }[];
  adminContactEmail?: string;
  adminContactPhone?: string;
  customerServiceNumber?: string;
  customerServiceEmail?: string;
  isLocked?: boolean;
  lockMessage?: string;
  supportText?: string;
  systemVersion?: string;
  copyrightText?: string;
}

export interface PaymentLog {
  timestamp: string;
  name: string;
  email: string;
  type: 'student' | 'tutorial';
  amount: number;
  reference: string;
  status: string;
}

export interface Question {
  id: string;
  subject: string;
  text: string;
  image?: string;
  passage?: string;
  type?: 'mcq' | 'image' | 'passage' | string;
  options: {
    id: string;
    text: string;
    image?: string;
  }[];
  correctAnswer: string;
  explanation?: string;
}


export interface TutorialCenter {
  centerName: string;
  coordinatorName: string;
  email: string;
  phone: string;
  token: string;
  studentCount: number;
}


export interface ExamResult {
  action?: string;
  regNo: string;
  name: string;
  subjectsTaken: string;
  scores: Record<string, number>;
  totalScore: number;
  date: string;
  timeSubmitted: string;
  tabSwitchCount: number;
  attemptedQuestionIds: string[]; // Questions from the current session
  [key: string]: any; // Allow for flattened scores
}

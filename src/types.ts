export interface Student {
  name: string;
  dob: string;
  regNo: string;
  subjectCombination: string[];
  photograph: string;
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
}

export interface Question {
  id: string;
  subject: string;
  text: string;
  options: {
    id: string;
    text: string;
  }[];
  correctAnswer: string;
  explanation?: string;
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
  [key: string]: any; // Allow for flattened scores
}

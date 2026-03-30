import axios from 'axios';
import { Student, ExamSettings, Question, ExamResult, PaymentLog, TutorialCenter } from '../types';

const SCRIPT_URL = import.meta.env.VITE_GOOGLE_SCRIPT_URL?.replace(/\/$/, '');

const axiosInstance = axios.create({
  timeout: 30000, // 30 seconds timeout - GAS can be slow
});

export const googleSheetsService = {
  async getStudent(regNo: string): Promise<Student | null> {
    if (!SCRIPT_URL) {
      console.error('VITE_GOOGLE_SCRIPT_URL is not defined');
      return null;
    }
    try {
      const response = await axiosInstance.get(`${SCRIPT_URL}?action=getStudent&regNo=${regNo}`);
      if (!response.data) return null;
      
      // Normalize keys from Google Sheets (which might be capitalized or have spaces)
      const data = response.data;
      const getVal = (keys: string[]) => {
        for (const key of keys) {
          if (data[key] !== undefined) return data[key];
          // Try lowercase and no spaces
          const normalizedKey = key.toLowerCase().replace(/\s+/g, '');
          for (const dKey in data) {
            if (dKey.toLowerCase().replace(/\s+/g, '') === normalizedKey) return data[dKey];
          }
        }
        return undefined;
      };

      const rawHistory = getVal(['allAttemptedQuestionIds', 'history', 'attemptedQuestions']) || '';
      let allAttemptedQuestionIds: string[] = [];
      if (Array.isArray(rawHistory)) {
        allAttemptedQuestionIds = rawHistory.map(String);
      } else if (typeof rawHistory === 'string' && rawHistory.trim()) {
        allAttemptedQuestionIds = rawHistory.split(',').map(s => s.trim()).filter(Boolean);
      }

      return {
        name: getVal(['name', 'Name', 'Full Name', 'Student Name']) || '',
        dob: getVal(['dob', 'DOB', 'Date of Birth', 'DateOfBirth']) || '',
        regNo: getVal(['regNo', 'RegNo', 'Registration Number', 'Reg Number']) || regNo,
        subjectCombination: Array.isArray(data.subjectCombination) ? data.subjectCombination : 
                            (getVal(['subjectCombination', 'Subject Combination', 'Subjects']) || '').split(',').map((s: string) => s.trim()).filter(Boolean),
        photograph: getVal(['photograph', 'Photograph', 'Photo', 'Image', 'Picture', 'Profile Picture', 'Student Picture']) || '',
        allAttemptedQuestionIds
      };
    } catch (error) {
      console.error('Error fetching student:', error);
      if (axios.isAxiosError(error)) {
        console.error('Axios error details:', {
          message: error.message,
          code: error.code,
          response: error.response?.data,
          status: error.response?.status
        });
      }
      return null;
    }
  },

  async getSettings(): Promise<ExamSettings | null> {
    if (!SCRIPT_URL) {
      console.error('VITE_GOOGLE_SCRIPT_URL is not defined');
      return null;
    }
    try {
      console.log('Fetching settings from:', SCRIPT_URL);
      const response = await axiosInstance.get(`${SCRIPT_URL}?action=getSettings`);
      console.log('Settings response:', response.data);
      if (!response.data) return null;

      let data = response.data;

      // Handle the "two-column key-value" format if data is an array
      // e.g., [{"Setting Name": "Title", "Setting Value": "Exam"}, ...]
      if (Array.isArray(data)) {
        console.log('Settings received as array, transforming to object...');
        const transformed: Record<string, any> = {};
        data.forEach(row => {
          // Find the key and value columns regardless of their exact names
          const keys = Object.keys(row);
          if (keys.length >= 2) {
            // Assume first column is key, second is value
            // Or try to find columns with "name", "key", "setting" vs "value", "result"
            let keyIdx = 0;
            let valIdx = 1;

            const nameIdx = keys.findIndex(k => k.toLowerCase().includes('name') || k.toLowerCase().includes('key') || k.toLowerCase().includes('setting'));
            const valueIdx = keys.findIndex(k => k.toLowerCase().includes('value') || k.toLowerCase().includes('result') || k.toLowerCase().includes('data'));

            if (nameIdx !== -1) keyIdx = nameIdx;
            if (valueIdx !== -1) valIdx = valueIdx;

            const key = String(row[keys[keyIdx]]).trim();
            const val = row[keys[valIdx]];
            if (key) transformed[key] = val;
          }
        });
        data = transformed;
        console.log('Transformed settings:', data);
      }

      const getVal = (keys: string[]) => {
        for (const key of keys) {
          if (data[key] !== undefined) return data[key];
          const normalizedKey = key.toLowerCase().replace(/\s+/g, '');
          for (const dKey in data) {
            if (dKey.toLowerCase().replace(/\s+/g, '') === normalizedKey) return data[dKey];
          }
        }
        return undefined;
      };

      const parseJSON = (val: any) => {
        if (typeof val === 'object' && val !== null) return val;
        if (typeof val !== 'string') return val;
        
        const trimmed = val.trim();
        if (!trimmed) return val;

        // Handle JSON Object/Array
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          try {
            return JSON.parse(trimmed);
          } catch (e) {
            console.warn('Failed to parse JSON string:', trimmed);
            return trimmed;
          }
        }

        // Handle Key:Value, Key:Value format (e.g., English:10, Math:5)
        if (trimmed.includes(':') && trimmed.includes(',')) {
          const obj: Record<string, any> = {};
          trimmed.split(',').forEach(pair => {
            const [k, v] = pair.split(':').map(s => s.trim());
            if (k && v !== undefined) {
              const num = Number(v);
              obj[k] = isNaN(num) ? v : num;
            }
          });
          return obj;
        }

        // Handle single Key:Value (e.g., English:10)
        if (trimmed.includes(':') && !trimmed.includes('http')) {
          const [k, v] = trimmed.split(':').map(s => s.trim());
          if (k && v !== undefined) {
            const num = Number(v);
            return { [k]: isNaN(num) ? v : num };
          }
        }

        // Handle comma-separated list (e.g., English, Math, Physics)
        if (trimmed.includes(',')) {
          return trimmed.split(',').map(s => s.trim()).filter(Boolean);
        }

        return val;
      };

      const standardKeys = [
        'examTitle', 'totalDuration', 'subjectDuration', 'questionsPerSubject', 
        'activeSubjects', 'startTime', 'endTime', 'instructions', 
        'randomSelection', 'shuffling', 'tabMonitoring', 'showResultsAfterExam',
        'isLocked', 'lockMessage', 'supportText', 'systemVersion', 'copyrightText',
        'customerServiceEmail', 'customerServiceNumber'
      ];

      const result: ExamSettings = {
        examTitle: getVal(['examTitle', 'Exam Title', 'Title']) || 'JAMB Assessment',
        totalDuration: parseInt(getVal(['totalDuration', 'Total Duration', 'Duration', 'Time']) || '120', 10),
        subjectDuration: parseJSON(getVal(['subjectDuration', 'Subject Duration'])),
        questionsPerSubject: parseJSON(getVal(['questionsPerSubject', 'Questions Per Subject', 'Question Count'])) || {},
        activeSubjects: parseJSON(getVal(['activeSubjects', 'Active Subjects', 'Subjects'])) || [],
        startTime: getVal(['startTime', 'Start Time']),
        endTime: getVal(['endTime', 'End Time']),
        instructions: getVal(['instructions', 'Instructions', 'Guidelines']) || '',
        randomSelection: getVal(['randomSelection', 'Random Selection', 'Randomize']) === true || getVal(['randomSelection', 'Random Selection', 'Randomize']) === 'TRUE',
        shuffling: getVal(['shuffling', 'Shuffling', 'Shuffle']) === true || getVal(['shuffling', 'Shuffling', 'Shuffle']) === 'TRUE',
        tabMonitoring: getVal(['tabMonitoring', 'Tab Monitoring', 'Monitor Tabs']) === true || getVal(['tabMonitoring', 'Tab Monitoring', 'Monitor Tabs']) === 'TRUE',
        showResultsAfterExam: ['true', 'TRUE', 'yes', 'YES', true, 1].includes(getVal(['showResultsAfterExam', 'Show Results After Exam']) as any),
        isLocked: ['true', 'TRUE', 'yes', 'YES', true, 1].includes(getVal(['isLocked', 'Lock Exam', 'Locked']) as any),
        lockMessage: getVal(['lockMessage', 'Lock Message', 'Custom Lock Message']) || 'This exam is currently locked by the administrator.',
        studentRegEnabled: getVal(['studentRegEnabled', 'Student Registration Enabled']) !== false && getVal(['studentRegEnabled', 'Student Registration Enabled']) !== 'FALSE',
        tutorialRegEnabled: getVal(['tutorialRegEnabled', 'Tutorial Registration Enabled']) !== false && getVal(['tutorialRegEnabled', 'Tutorial Registration Enabled']) !== 'FALSE',
        studentRegFee: parseInt(getVal(['studentRegFee', 'Student Registration Fee']) || '1500', 10),
        tutorialBaseFee: parseInt(getVal(['tutorialBaseFee', 'Tutorial Base Fee']) || '1000', 10),
        discountTiers: parseJSON(getVal(['discountTiers', 'Discount Tiers'])) || [],
        supportText: getVal(['supportText', 'Support Instruction', 'Support Message']),
        systemVersion: getVal(['systemVersion', 'System Version', 'Version Tag']),
        copyrightText: getVal(['copyrightText', 'Copyright Notice', 'Branding Notice']),
        customerServiceEmail: getVal(['customerServiceEmail', 'Support Email', 'Contact Email']),
        customerServiceNumber: getVal(['customerServiceNumber', 'Support Phone', 'Contact Number', 'Customer Service Number'])
      };

      // Collect unrecognized numeric keys as subject question counts
      // This handles the case where subjects are listed as individual rows in a 2-column settings sheet
      for (const key in data) {
        const isStandard = standardKeys.some(sk => 
          sk.toLowerCase() === key.toLowerCase().replace(/\s+/g, '') ||
          key.toLowerCase().includes(sk.toLowerCase())
        );

        if (!isStandard) {
          const val = data[key];
          const numVal = Number(val);
          if (!isNaN(numVal) && typeof val !== 'boolean') {
            if (!result.questionsPerSubject) result.questionsPerSubject = {};
            result.questionsPerSubject[key] = numVal;
          }
        }
      }

      console.log('Parsed settings:', result);
      return result;
    } catch (error) {
      console.error('Error fetching settings:', error);
      if (axios.isAxiosError(error)) {
        console.error('Axios error details:', {
          message: error.message,
          code: error.code,
          response: error.response?.data,
          status: error.response?.status
        });
      }
      return null;
    }
  },

  async getQuestions(subjects: string[]): Promise<Question[]> {
    if (!SCRIPT_URL) {
      console.error('VITE_GOOGLE_SCRIPT_URL is not defined');
      return [];
    }
    try {
      const response = await axiosInstance.get(`${SCRIPT_URL}?action=getQuestions&subjects=${subjects.join(',')}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching questions:', error);
      if (axios.isAxiosError(error)) {
        console.error('Axios error details:', {
          message: error.message,
          code: error.code,
          response: error.response?.data,
          status: error.response?.status
        });
      }
      return [];
    }
  },

  async saveResult(result: ExamResult): Promise<boolean> {
    if (!SCRIPT_URL) {
      console.error('VITE_GOOGLE_SCRIPT_URL is not defined');
      return false;
    }
    
    // Prepare payload
    const payload: any = { 
      ...result, 
      action: 'saveResult' 
    };

    // The scores object will be sent as a single stringified JSON in the 'scores' parameter
    // instead of being flattened into separate columns.

    const params = new URLSearchParams();
    Object.entries(payload).forEach(([key, value]) => {
      if (typeof value === 'object' && value !== null) {
        params.append(key, JSON.stringify(value));
      } else {
        params.append(key, String(value));
      }
    });

    console.log('Attempting to save result...', { regNo: result.regNo, totalScore: result.totalScore });

    // Attempt 1: POST with URLSearchParams (application/x-www-form-urlencoded)
    try {
      console.log('Attempt 1: POST (form-urlencoded)');
      const response = await axiosInstance.post(`${SCRIPT_URL}?action=saveResult`, params);
      console.log('Attempt 1 response:', response.data);
      if (response.data && (response.data.success || response.data.status === 'success' || response.data.status === 'ok')) {
        return true;
      }
    } catch (err) {
      console.warn('Attempt 1 failed:', err);
    }

    // Attempt 2: POST with JSON (text/plain to avoid CORS preflight)
    try {
      console.log('Attempt 2: POST (JSON as text/plain)');
      const response = await axiosInstance.post(SCRIPT_URL, JSON.stringify(payload), {
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }
      });
      console.log('Attempt 2 response:', response.data);
      if (response.data && (response.data.success || response.data.status === 'success' || response.data.status === 'ok')) {
        return true;
      }
    } catch (err) {
      console.warn('Attempt 2 failed:', err);
    }

    // Attempt 3: GET request (fallback for scripts that only handle doGet)
    try {
      console.log('Attempt 3: GET');
      const response = await axiosInstance.get(`${SCRIPT_URL}?${params.toString()}`);
      console.log('Attempt 3 response:', response.data);
      if (response.data && (response.data.success || response.data.status === 'success' || response.data.status === 'ok')) {
        return true;
      }
    } catch (err) {
      console.warn('Attempt 3 failed:', err);
    }

    // Attempt 4: Fetch with no-cors (The "Hail Mary")
    try {
      console.log('Attempt 4: Fetch (no-cors)');
      await fetch(`${SCRIPT_URL}?${params.toString()}`, {
        method: 'GET',
        mode: 'no-cors'
      });
      console.log('Attempt 4 sent (opaque response)');
      // We return true here because no-cors always succeeds from the browser's perspective
      // even if the server failed, but it's our last chance.
      return true;
    } catch (err) {
      console.error('Attempt 4 failed:', err);
    }

    return false;
  },

  async registerStudent(details: any): Promise<{ success: boolean, message?: string }> {
    if (!SCRIPT_URL) return { success: false };
    try {
      const response = await axiosInstance.post(SCRIPT_URL, JSON.stringify({
        action: 'registerStudent',
        ...details
      }), {
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }
      });
      return response.data || { success: false };
    } catch (error) {
      console.error('Error registering student:', error);
      return { success: false };
    }
  },

  async getSubjects(): Promise<string[]> {
    if (!SCRIPT_URL) return [];
    try {
      console.log('Fetching subjects from backend...');
      const response = await axiosInstance.get(`${SCRIPT_URL}?action=getSubjects`);
      console.log('Raw subjects response:', response.data);
      
      if (Array.isArray(response.data)) {
        return response.data;
      } else if (response.data && typeof response.data === 'object') {
        // Handle case where it might be wrapped in a 'data' property
        if (Array.isArray(response.data.data)) return response.data.data;
        if (response.data.error) {
          console.error('Backend returned error during getSubjects:', response.data.error);
        }
      }
      return [];
    } catch (error) {
      console.error('Error fetching subjects:', error);
      return [];
    }
  },

  async registerTutorialCenter(details: any): Promise<boolean> {
    if (!SCRIPT_URL) return false;
    try {
      const response = await axiosInstance.post(SCRIPT_URL, JSON.stringify({
        action: 'registerTutorialCenter',
        ...details
      }), {
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }
      });
      return response.data?.success || false;
    } catch (error) {
      console.error('Error registering tutorial center:', error);
      return false;
    }
  },

  async getPaymentLogs(): Promise<PaymentLog[]> {
    if (!SCRIPT_URL) return [];
    try {
      const response = await axiosInstance.get(`${SCRIPT_URL}?action=getPaymentLogs`);
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      console.error('Error fetching payment logs:', error);
      return [];
    }
  },

  async updateSettings(settings: Partial<ExamSettings>): Promise<boolean> {
    if (!SCRIPT_URL) return false;
    try {
      const response = await axiosInstance.post(SCRIPT_URL, JSON.stringify({
        action: 'updateSettings',
        settings
      }), {
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }
      });
      return response.data?.success || false;
    } catch (error) {
      console.error('Error updating settings:', error);
      return false;
    }
  },

  async getTutorialCenter(token: string): Promise<TutorialCenter | null> {
    if (!SCRIPT_URL) return null;
    try {
      const response = await axiosInstance.get(`${SCRIPT_URL}?action=getTutorialCenter&token=${token}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching tutorial center:', error);
      return null;
    }
  },

  async getCenterStudents(token: string): Promise<any[]> {
    if (!SCRIPT_URL) return [];
    try {
      const response = await axiosInstance.get(`${SCRIPT_URL}?action=getCenterStudents&token=${token}`);
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      console.error('Error fetching center students:', error);
      return [];
    }
  },

  async uploadCenterQuestions(token: string, questions: any[]): Promise<any> {
    if (!SCRIPT_URL) return { status: 'failed', message: 'Script URL not defined' };
    try {
      const response = await axiosInstance.post(SCRIPT_URL, JSON.stringify({ 
        action: 'uploadCenterQuestions', 
        token, 
        questions 
      }), {
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }
      });
      return response.data || { status: 'success' };
    } catch (error) {
      console.error('Error uploading center questions:', error);
      return { status: 'failed' };
    }
  }
};

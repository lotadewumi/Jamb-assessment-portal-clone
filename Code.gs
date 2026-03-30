/**
 * JAMB Assessment Portal Backend - Consolidated Code
 * 
 * Instructions:
 * 1. Open your Google Sheet.
 * 2. Go to Extensions -> Apps Script.
 * 3. Delete any existing code in Code.gs and paste this in.
 * 4. Ensure you have sheets for each subject (e.g. "Mathematics", "English", "Physics", "Chemistry").
 * 5. Ensure you have system sheets: "Student Biodata", "Exam Settings", "Results".
 * 6. Deploy as a Web App (Set "Who has access" to "Anyone").
 * 7. Use the provided .exec URL in your VITE_GOOGLE_SCRIPT_URL.
 */

const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();
const SHEET_NAMES = {
  QUESTIONS: "Questions",
  STUDENTS: "Student Biodata",
  SETTINGS: "Exam Settings",
  RESULTS: "Results",
  SUBJECTS: "Subjects"
};

/**
 * Helper to find a sheet by name (case-insensitive and partial match)
 */
function getSheetSafe(ss, name) {
  const sheets = ss.getSheets();
  const lowerName = name.toLowerCase().replace(/\s/g, '');
  
  // Try exact match first
  let sheet = ss.getSheetByName(name);
  if (sheet) return sheet;
  
  // Try normalized match
  for (let i = 0; i < sheets.length; i++) {
    const sName = sheets[i].getName().toLowerCase().replace(/\s/g, '');
    if (sName === lowerName) return sheets[i];
  }
  
  // Try partial match
  for (let i = 0; i < sheets.length; i++) {
    const sName = sheets[i].getName().toLowerCase();
    if (sName.includes(lowerName) || lowerName.includes(sName)) return sheets[i];
  }
  
  return null;
}

/**
 * Handles GET requests
 */
function doGet(e) {
  const action = e.parameter.action;
  
  try {
    switch (action) {
      case 'getStudent':
        return JSONResponse(getStudent(e.parameter.regNo));
      case 'getSettings':
        return JSONResponse(getSettings());
      case 'getQuestions':
        return JSONResponse(getQuestions(e.parameter.subjects));
      case 'getSubjects':
        return JSONResponse(getSubjects());
      case 'getTutorialCenter':
        return JSONResponse(getTutorialCenter(e.parameter.token));
      case 'getCenterStudents':
        return JSONResponse(getCenterStudents(e.parameter.token));
      case 'debugData':
        const diagnosticSs = SpreadsheetApp.getActiveSpreadsheet();
        return JSONResponse({
          version: 1.3, // Sheet-per-subject support
          activeSheetName: diagnosticSs.getName(),
          allSheets: diagnosticSs.getSheets().map(s => s.getName()),
        });
      default:
        // Also handle the case where parameters are sent directly for saveResult via GET fallback
        if (e.parameter.regNo && e.parameter.totalScore) {
          return JSONResponse(saveResult(e.parameter));
        }
        return JSONResponse({ error: 'Invalid action' });
    }
  } catch (error) {
    return JSONResponse({ error: error.toString(), stack: error.stack });
  }
}

/**
 * Handles POST requests
 */
function doPost(e) {
  let data;
  try {
    if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    } else {
      data = e.parameter;
    }
    
    const action = data.action || e.parameter.action;
    
    if (action === 'saveResult') {
      return JSONResponse(saveResult(data));
    } else if (action === 'registerStudent') {
      return JSONResponse(registerStudent(data));
    } else if (action === 'registerTutorialCenter') {
      return JSONResponse(registerTutorialCenter(data));
    } else if (action === 'updateSettings') {
      return JSONResponse(updateSettings(data.settings));
    } else if (data.event === 'charge.success') {
      return JSONResponse(handlePaystackWebhook(data));
    }
    
    return JSONResponse({ error: 'Invalid action: ' + action });
  } catch (error) {
    return JSONResponse({ error: error.toString(), stack: error.stack });
  }
}

/**
 * Update Settings
 */
function updateSettings(newSettings) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = getSheetSafe(ss, SHEET_NAMES.SETTINGS);
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAMES.SETTINGS);
    sheet.appendRow(["Setting Key", "Value"]);
  }

  const data = sheet.getDataRange().getValues();
  
  for (let key in newSettings) {
    let value = newSettings[key];
    if (typeof value === 'object' && value !== null) value = JSON.stringify(value);
    
    let found = false;
    for (let i = 0; i < data.length; i++) {
      if (data[i][0] && String(data[i][0]).trim().toLowerCase() === key.toLowerCase()) {
        sheet.getRange(i + 1, 2).setValue(value);
        found = true;
        break;
      }
    }
    if (!found) {
      sheet.appendRow([key, value]);
    }
  }
  return { success: true };
}

/**
 * Fetch Payment Logs
 */
function getPaymentLogs() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = getSheetSafe(ss, "Payment Log");
  if (!sheet) {
    sheet = ss.insertSheet("Payment Log");
    sheet.appendRow(['Date', 'Reference', 'Type', 'Email', 'Amount', 'Status']);
  }
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => h.toString().toLowerCase().trim());
  
  return data.slice(1).map(row => {
    let log = {};
    headers.forEach((h, i) => log[h] = row[i]);
    return log;
  }).reverse();
}

/**
 * Handle Webhook
 */
function handlePaystackWebhook(body) {
  const data = body.data;
  const metadata = data.metadata;
  const reference = data.reference;
  
  if (!metadata || !metadata.type) return { status: 'ignored' };

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let logSheet = ss.getSheetByName("Payment Log");
  if (!logSheet) {
    logSheet = ss.insertSheet("Payment Log");
    logSheet.appendRow(['Date', 'Reference', 'Type', 'Email', 'Amount', 'Status']);
  }
  
  const existingRefs = logSheet.getRange(1, 2, Math.max(1, logSheet.getLastRow()), 1).getValues().flat();
  if (existingRefs.includes(reference)) return { status: 'duplicate' };

  let result;
  if (metadata.type === 'student') result = registerStudent(metadata);
  else if (metadata.type === 'tutorial') result = registerTutorialCenter(metadata);

  if (result && result.success) {
    logSheet.appendRow([new Date(), reference, metadata.type, data.customer.email, data.amount / 100, 'Success']);
    return { status: 'success' };
  }
  return { status: 'failed' };
}

/**
 * Fetch Tutorial Center by Token
 */
function getTutorialCenter(token) {
  if (!token) return null;
  
  // Master Admin Token for testing
  if (token.trim().toUpperCase() === "ADMIN-999") {
    return {
      centerName: "Super Admin Hub (TEST)",
      coordinatorName: "Lead Administrator",
      studentCount: 5000,
      token: "ADMIN-999",
      email: "admin@portal.ng",
      phone: "08000000000"
    };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Registrations");
  if (!sheet) return null;
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return null;
  
  const headers = data[0].map(h => h.toString().toLowerCase().trim());
  const tokenIdx = headers.indexOf('token');
  if (tokenIdx === -1) return null;

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][tokenIdx]).trim().toUpperCase() === token.trim().toUpperCase()) {
      const center = {};
      headers.forEach((h, idx) => {
        let key = h.replace(/\s+/g, '');
        if (h.includes('center')) key = 'centerName';
        if (h.includes('coord')) key = 'coordinatorName';
        if (h === 'count') key = 'studentCount';
        center[key] = data[i][idx];
      });
      return center;
    }
  }
  return null;
}

/**
 * Fetch all students for a center
 */
function getCenterStudents(token) {
  if (!token) return [];
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheetSafe(ss, SHEET_NAMES.STUDENTS);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  const headers = data[0].map(h => h.toString().toLowerCase().trim());
  const tokenIdx = headers.indexOf('centertoken');
  if (tokenIdx === -1) return [];

  const students = [];
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][tokenIdx]).trim().toUpperCase() === token.trim().toUpperCase()) {
      const s = {};
      headers.forEach((h, idx) => s[h] = data[i][idx]);
      students.push(s);
    }
  }
  return students;
}

/**
 * Upload center-specific questions
 */
function uploadCenterQuestions(token, questions) {
  if (!token || !questions || !Array.isArray(questions)) return { status: 'failed', message: 'Invalid data' };
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Questions");
  if (!sheet) return { status: 'failed', message: 'Questions sheet not found' };
  
  const headers = sheet.getDataRange().getValues()[0];
  let centerTokenIdx = headers.findIndex(h => h.toString().toLowerCase() === 'centertoken');
  
  // If centerToken column doesn't exist, add it
  if (centerTokenIdx === -1) {
    centerTokenIdx = headers.length;
    sheet.getRange(1, centerTokenIdx + 1).setValue('centerToken');
  }
  
  const newHeaders = sheet.getDataRange().getValues()[0];
  const newRows = questions.map(q => {
    return newHeaders.map(h => {
      const key = h.toLowerCase().trim();
      if (key === 'centertoken') return token;
      
      // Map common CSV names to sheet headers
      if (key === 'subject') return q.subject || q.Subject || '';
      if (key === 'question') return q.question || q.Question || '';
      if (key === 'optiona') return q.optiona || q['Option A'] || '';
      if (key === 'optionb') return q.optionb || q['Option B'] || '';
      if (key === 'optionc') return q.optionc || q['Option C'] || '';
      if (key === 'optiond') return q.optiond || q['Option D'] || '';
      if (key === 'answer') return q.answer || q.Answer || q['Correct Answer'] || '';
      if (key === 'passage') return q.passage || q.Passage || '';
      
      return q[h] || q[key] || '';
    });
  });
  
  if (newRows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, newHeaders.length).setValues(newRows);
  }
  
  return { status: 'success', count: newRows.length };
}

/**
 * Register Student
 */
function registerStudent(details) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = getSheetSafe(ss, SHEET_NAMES.STUDENTS);
  const expectedHeaders = ['regNo', 'name', 'dob', 'subjectCombination', 'photograph', 'attemptedQuestions', 'gender', 'address', 'parentName', 'parentPhone', 'email', 'institution', 'course', 'phone', 'whatsapp', 'registrationDate', 'centerToken'];

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAMES.STUDENTS);
    sheet.appendRow(expectedHeaders);
  }
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => h.toString().toLowerCase().trim());
  
  const regNoIdx = headers.indexOf('regno');
  if (regNoIdx === -1) {
    sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
    return registerStudent(details);
  }

  // Photo
  let photographUrl = details.photograph || details.photographUrl || "";
  if (details.photographBase64) {
    try {
      const folderId = "185t2w5dmdukpIgTkjD0_-kIO-YcSbqpW";
      const folder = DriveApp.getFolderById(folderId);
      const blob = Utilities.newBlob(Utilities.base64Decode(details.photographBase64.split(',')[1] || details.photographBase64), "image/png", `student_${details.regNo}`);
      const file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      photographUrl = `https://drive.google.com/uc?id=${file.getId()}`;
    } catch (e) {}
  }
  
  const subjects = [details.subject1, details.subject2, details.subject3, details.subject4].filter(Boolean).join(', ');
  const rowData = {
    'regno': details.regNo,
    'name': details.fullName || details.name,
    'dob': details.dob,
    'subjectcombination': subjects || details.subjectCombination,
    'photograph': photographUrl,
    'attemptedquestions': details.attemptedQuestions || "",
    'gender': details.gender,
    'address': details.address,
    'parentname': details.parentName,
    'parentphone': details.parentPhone,
    'email': details.email,
    'institution': details.institution,
    'course': details.course,
    'phone': details.phone,
    'whatsapp': details.whatsapp,
    'registrationdate': details.registrationDate || new Date().toISOString(),
    'centertoken': details.centerToken || ""
  };

  let rowIdx = -1;
  const regNoSearch = String(details.regNo).trim().toUpperCase();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][regNoIdx]).trim().toUpperCase() === regNoSearch) {
      rowIdx = i + 1;
      break;
    }
  }

  if (rowIdx !== -1) {
    const range = sheet.getRange(rowIdx, 1, 1, headers.length);
    const existingValues = range.getValues()[0];
    const newValues = headers.map((h, i) => {
      let newVal = rowData[h];
      let oldVal = existingValues[i];
      if (h === 'photograph' && newVal) return newVal;
      if (h === 'subjectcombination' && newVal && newVal.length > oldVal.toString().length) return newVal;
      return (oldVal === "" ? newVal : oldVal) || "";
    });
    range.setValues([newValues]);
    return { success: true, registrationNumber: details.regNo };
  } else {
    sheet.appendRow(headers.map(h => rowData[h] || ""));
    return { success: true, registrationNumber: details.regNo };
  }
}

/**
 * Fetch Subjects dynamically from sheet names
 */
function getSubjects() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheets = ss.getSheets();
    const systemNames = [SHEET_NAMES.STUDENTS, SHEET_NAMES.SETTINGS, SHEET_NAMES.RESULTS, SHEET_NAMES.QUESTIONS, "Payment Log", "Admin", "Sheet1", "Sheet2", "Sheet3", "Sheet7"].map(s => s.toLowerCase().replace(/\s/g, ''));

    const subjects = sheets
      .map(s => s.getName())
      .filter(name => {
        const norm = name.toLowerCase().replace(/\s/g, '');
        return !systemNames.includes(norm) && norm !== "" && !norm.includes("conflict") && name.length > 2;
      });

    return Array.from(new Set(subjects)).sort();
  } catch (e) { return []; }
}

/**
 * Fetch Questions from whichever sheet matches the subject name
 */
function getQuestions(subjectsStr) {
  if (!subjectsStr) return [];
  const requested = subjectsStr.split(',').map(s => s.trim().toLowerCase().replace(/\s/g, ''));
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const allQuestions = [];

  ss.getSheets().forEach(sheet => {
    const name = sheet.getName();
    const normName = name.toLowerCase().replace(/\s/g, '');
    
    if (requested.includes(normName) || normName === 'questions') {
      const data = sheet.getDataRange().getValues();
      if (data.length <= 1) return;
      const headers = data[0].map(h => h.toString().trim().toLowerCase());
      
      const getIdx = (n) => {
        let idx = headers.indexOf(n);
        if (idx === -1) idx = headers.findIndex(h => h.includes(n));
        return idx;
      };

      const i = {
        id: getIdx('id'),
        text: getIdx('text') === -1 ? getIdx('question') : getIdx('text'),
        a: getIdx('optiona'),
        b: getIdx('optionb'),
        c: getIdx('optionc'),
        d: getIdx('optiond'),
        ans: getIdx('correct') !== -1 ? getIdx('correct') : getIdx('answer'),
        passage: getIdx('passage'),
        image: getIdx('image')
      };

      if (i.text === -1 || i.ans === -1) return;

      for (let r = 1; r < data.length; r++) {
        const row = data[r];
        // If it's a dedicated subject sheet, we take all rows. 
        // If it's the global "Questions" sheet, we check the subject column.
        if (normName === 'questions') {
          const rowSub = String(row[getIdx('subject')] || '').toLowerCase().replace(/\s/g, '');
          if (!requested.includes(rowSub)) continue;
        }

        allQuestions.push({
          id: i.id !== -1 ? String(row[i.id]) : `${normName}_${r}`,
          subject: name,
          text: String(row[i.text] || ''),
          options: [
            { id: 'A', text: String(row[i.a] || '') },
            { id: 'B', text: String(row[i.b] || '') },
            { id: 'C', text: String(row[i.c] || '') },
            { id: 'D', text: String(row[i.d] || '') }
          ],
          correctAnswer: String(row[i.ans] || '').trim().toUpperCase().charAt(0),
          passage: i.passage !== -1 ? String(row[i.passage] || '') : null,
          image: i.image !== -1 ? String(row[i.image] || '') : null
        });
      }
    }
  });
  return allQuestions;
}

function registerTutorialCenter(details) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Registrations") || ss.insertSheet("Registrations");
  if (sheet.getLastRow() === 0) sheet.appendRow(['Center Name', 'Coordinator', 'Address', 'State', 'LGA', 'Count', 'Email', 'Phone', 'Amount', 'Token', 'Date']);
  const token = 'TC-' + Math.random().toString(36).substring(2, 10).toUpperCase();
  sheet.appendRow([details.centerName, details.coordinatorName, details.address, details.state, details.lga, details.studentCount, details.email, details.phone, details.totalAmount, token, new Date().toISOString()]);
  return { success: true, token: token };
}

function saveResult(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rSheet = getSheetSafe(ss, SHEET_NAMES.RESULTS) || ss.insertSheet(SHEET_NAMES.RESULTS);
  if (rSheet.getLastRow() === 0) rSheet.appendRow(['RegNo', 'Name', 'Scores', 'TotalScore', 'Date', 'Time']);
  
  const scoresStr = typeof data.scores === 'string' ? data.scores : JSON.stringify(data.scores || {});
  rSheet.appendRow([data.regNo, data.name, scoresStr, data.totalScore, new Date().toLocaleDateString(), new Date().toLocaleTimeString()]);
  
  const sSheet = ss.getSheetByName(SHEET_NAMES.STUDENTS);
  if (sSheet && data.regNo && data.attemptedQuestionIds) {
    const sData = sSheet.getDataRange().getValues();
    const sHeaders = sData[0].map(h => h.toString().toLowerCase().trim());
    const regIdx = sHeaders.indexOf('regno');
    let histIdx = sHeaders.findIndex(h => h.includes('history') || h.includes('attempted'));
    if (regIdx !== -1 && histIdx !== -1) {
      for (let i = 1; i < sData.length; i++) {
        if (String(sData[i][regIdx]).trim() === String(data.regNo).trim()) {
          const current = String(sData[i][histIdx] || '');
          const newIds = Array.isArray(data.attemptedQuestionIds) ? data.attemptedQuestionIds : String(data.attemptedQuestionIds).split(',');
          const combined = Array.from(new Set([...current.split(','), ...newIds])).filter(Boolean).join(',');
          sSheet.getRange(i + 1, histIdx + 1).setValue(combined);
          break;
        }
      }
    }
  }
  return { success: true };
}

function getStudent(regNo) {
  if (!regNo) return null;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheetSafe(ss, SHEET_NAMES.STUDENTS);
  if (!sheet) return null;
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => h.toString().toLowerCase().trim());
  const regIdx = headers.indexOf('regno');
  if (regIdx === -1) return null;
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][regIdx]).trim() === String(regNo).trim()) {
      const student = {};
      headers.forEach((h, idx) => {
        // Smart mapping to camelCase for the frontend
        let key = h;
        if (h === 'regno') key = 'regNo';
        if (h === 'subjectcombination') key = 'subjectCombination';
        if (h === 'attemptedquestions' || h === 'history') key = 'attemptedQuestions';
        if (h === 'registrationdate') key = 'registrationDate';
        if (h === 'parentname') key = 'parentName';
        if (h === 'parentphone') key = 'parentPhone';
        student[key] = data[i][idx];
      });
      return student;
    }
  }
  return null;
}

function getSettings() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheetSafe(ss, SHEET_NAMES.SETTINGS);
  if (!sheet) return {};
  const data = sheet.getDataRange().getValues();
  const settings = {};
  data.forEach(row => {
    if (row[0]) {
      let val = row[1];
      if (val === 'true') val = true;
      if (val === 'false') val = false;
      settings[String(row[0]).trim()] = val;
    }
  });
  return settings;
}

function JSONResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

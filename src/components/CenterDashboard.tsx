import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Users, 
  BookOpen, 
  BarChart3, 
  Plus, 
  ArrowLeft, 
  ChevronRight, 
  Search, 
  Filter, 
  LogOut,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Package,
  Loader2,
  CheckCircle2,
  UserPlus,
  Menu,
  X 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { googleSheetsService } from '../services/googleSheetsService';
import { TutorialCenter, Student, ExamSettings } from '../types';

interface CenterDashboardProps {
  center: TutorialCenter | null;
  onBack: () => void;
  onAddStudent: () => void;
  settings: ExamSettings | null;
}

export const CenterDashboard: React.FC<CenterDashboardProps> = ({ center, onBack, onAddStudent, settings }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'students' | 'questions' | 'settings'>('overview');
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Center statistics
  const seatsUsed = students.length;
  const seatsRemaining = (center?.studentCount || 0) - seatsUsed;
  const usagePercentage = Math.round((seatsUsed / (center?.studentCount || 1)) * 100);

  useEffect(() => {
    if (center?.token) {
      loadCenterData();
    }
  }, [center?.token]);

  const loadCenterData = async () => {
    setLoading(true);
    try {
      const data = await googleSheetsService.getCenterStudents(center!.token);
      setStudents(data);
    } catch (err) {
      console.error('Failed to load center students:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = students.filter(s => 
    s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.regno?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const downloadCSVTemplate = () => {
    const headers = ["Subject", "Question", "Option A", "Option B", "Option C", "Option D", "Correct Answer (A/B/C/D)", "Passage (Optional)", "Image URL (Optional)"];
    const example = ["Mathematics", "Solve for x: 2x + 4 = 10", "2", "3", "4", "5", "B", "", ""];
    const csvContent = [headers, example].map(row => row.join(",")).join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `JAMB_Question_Template_${center?.centerName?.replace(/\s+/g, '_')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const parseCSV = (text: string) => {
    const lines = text.split('\n');
    if (lines.length < 2) return [];
    
    // Simple CSV parser that handles quotes
    const parseLine = (line: string) => {
      const result = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') inQuotes = !inQuotes;
        else if (char === ',' && !inQuotes) {
          result.push(cur.trim());
          cur = '';
        } else cur += char;
      }
      result.push(cur.trim());
      return result;
    };

    const headers = parseLine(lines[0]);
    return lines.slice(1).filter(l => l.trim()).map(line => {
      const values = parseLine(line);
      const obj: any = {};
      headers.forEach((h, i) => {
        obj[h] = values[i];
      });
      return obj;
    });
  };

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !center?.token) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const questions = parseCSV(text);
        
        if (questions.length === 0) {
          alert("No questions found in the CSV file.");
          return;
        }

        const result = await googleSheetsService.uploadCenterQuestions(center.token, questions);
        if (result.status === 'success') {
          alert(`Successfully uploaded ${questions.length} questions to your private bank!`);
        } else {
          alert("Failed to upload questions. Please check the console for details.");
        }
      } catch (err) {
        console.error('CSV Parsing/Upload failed:', err);
        alert("An error occurred during upload. Please ensure the CSV format is correct.");
      } finally {
        setLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };
  const NavItem = ({ active, onClick, icon, label, badge }: any) => (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold text-sm ${active ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:bg-slate-50'}`}
    >
      {icon}
      {label}
      {badge && <span className="ml-auto bg-white px-2 py-0.5 rounded-md text-[10px] border border-slate-200">{badge}</span>}
    </button>
  );

  const StatCard = ({ icon, label, value, sub, color }: any) => (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
      <div className="flex items-center gap-4 mb-4">
        <div className={`p-3 rounded-2xl bg-${color}-50`}>{icon}</div>
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
          <p className="text-2xl font-black text-slate-900">{value}</p>
        </div>
      </div>
      <p className="text-xs font-bold text-slate-400">{sub}</p>
    </div>
  );

  const ActionBtn = ({ icon, label, sub, onClick, disabled }: any) => (
    <button 
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-4 p-4 rounded-2xl border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/50 transition-all text-left ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <div className="p-3 bg-slate-100 rounded-xl text-slate-600">{icon}</div>
      <div>
        <p className="text-sm font-black text-slate-900">{label}</p>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{sub}</p>
      </div>
    </button>
  );

  const NavItemWithClose = (props: any) => (
    <NavItem {...props} onClick={() => { props.onClick(); setMobileMenuOpen(false); }} />
  );

  return (
    <div className="flex h-screen bg-[#f8fafc] overflow-hidden relative">
      {/* Mobile Top Bar */}
      <div className="lg:hidden flex items-center justify-between p-4 bg-white border-b border-[#e2e8f0] sticky top-0 z-40 w-full">
        <div className="flex items-center gap-2">
           <div className="w-8 h-8 bg-[#004d27] rounded-lg flex items-center justify-center">
             <Building2 className="w-5 h-5 text-white" />
           </div>
           <h1 className="font-black text-xs text-[#004d27] uppercase tracking-tight">Center Hub</h1>
        </div>
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 bg-slate-50 text-slate-600 rounded-lg hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Overlay for mobile navigation */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 w-72 bg-white border-r border-[#e2e8f0] flex flex-col shrink-0
        transform transition-transform duration-300 ease-in-out
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-6 border-b border-[#f1f5f9] hidden lg:flex items-center gap-3">
          <div className="w-10 h-10 bg-[#004d27] rounded-xl flex items-center justify-center shadow-lg shadow-[#004d27]/20">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div className="overflow-hidden">
            <h1 className="font-black text-sm text-[#004d27] truncate uppercase tracking-tight">Center Hub</h1>
            <p className="text-[10px] text-gray-500 font-bold uppercase truncate">{center?.centerName || 'Tutorial Center'}</p>
          </div>
        </div>

        {/* Mobile Sidebar Header */}
        <div className="lg:hidden p-6 border-b border-slate-100 flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center">
             <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="font-black text-slate-900">Hub Menu</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase">{center?.centerName?.substring(0, 20)}</p>
          </div>
        </div>

        <nav className="flex-grow p-4 space-y-2">
          <NavItemWithClose 
            active={activeTab === 'overview'} 
            onClick={() => setActiveTab('overview')} 
            icon={<LayoutDashboard className="w-5 h-5" />} 
            label="Overview" 
          />
          <NavItemWithClose 
            active={activeTab === 'students'} 
            onClick={() => setActiveTab('students')} 
            icon={<Users className="w-5 h-5" />} 
            label="My Students" 
            badge={students.length.toString()}
          />
          <NavItemWithClose 
            active={activeTab === 'questions'} 
            onClick={() => setActiveTab('questions')} 
            icon={<BookOpen className="w-5 h-5" />} 
            label="Question Bank" 
          />
          <NavItemWithClose 
            active={activeTab === 'settings'} 
            onClick={() => setActiveTab('settings')} 
            icon={<Settings className="w-5 h-5" />} 
            label="Preferences" 
          />
        </nav>

        <div className="p-4 border-t border-[#f1f5f9]">
          <button 
            onClick={onBack}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-red-600 hover:bg-red-50 rounded-xl transition-all"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-grow overflow-y-auto w-full scroll-smooth">
        <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-10">
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
            <div className="flex items-center gap-4">
               <div className="hidden lg:flex w-14 h-14 bg-white rounded-2xl shadow-sm border border-slate-200 items-center justify-center group hover:border-emerald-300 transition-colors">
                  <LayoutDashboard className="w-6 h-6 text-emerald-600 group-hover:scale-110 transition-transform" />
               </div>
               <div>
                  <h2 className="text-2xl md:text-4xl font-black text-[#1e293b] tracking-tight lowercase first-letter:uppercase">
                    {activeTab === 'overview' ? 'Dashboard' : 
                     activeTab === 'students' ? 'Student Roster' : 
                     activeTab === 'questions' ? 'Questions' : 'Preferences'}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Verified Hub</span>
                  </div>
               </div>
            </div>

            <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm self-start md:self-center">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-black text-slate-900 tracking-tight">Lead Administrator</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Coordinator</p>
              </div>
              <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center font-black text-emerald-700">
                {center?.coordinatorName?.charAt(0) || 'L'}
              </div>
            </div>
          </header>

        {/* Content Area */}
        <div className="flex-grow overflow-y-auto p-8 bg-[#f8fafc]">
          <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
              <motion.div 
                key="overview"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8"
              >
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <StatCard 
                    icon={<Package className="w-6 h-6 text-blue-600" />} 
                    label="Purchased Allocation" 
                    value={center?.studentCount || 0}
                    sub="Total seats paid for"
                    color="blue"
                  />
                  <StatCard 
                    icon={<Users className="w-6 h-6 text-emerald-600" />} 
                    label="Students Registered" 
                    value={seatsUsed}
                    sub={`${seatsRemaining} slots remaining`}
                    color="emerald"
                  />
                  <StatCard 
                    icon={<BarChart3 className="w-6 h-6 text-amber-600" />} 
                    label="Current Usage" 
                    value={`${usagePercentage}%`}
                    sub="Capacity utilization"
                    color="amber"
                  />
                </div>

                {/* Main Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Quota Progress */}
                  <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
                    <h3 className="font-black text-[#1e293b] text-lg mb-6 tracking-tight flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-emerald-600" />
                      Registration Quota
                    </h3>
                    <div className="space-y-6">
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-3xl font-black text-slate-900">{seatsUsed}<span className="text-slate-300 text-xl"> / {center?.studentCount}</span></p>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Enrolled Candidates</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-black text-emerald-600">{usagePercentage}%</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Utilization</p>
                        </div>
                      </div>
                      
                      <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600"
                          initial={{ width: 0 }}
                          animate={{ width: `${usagePercentage}%` }}
                          transition={{ duration: 1, ease: "easeOut" }}
                        />
                      </div>

                      <div className="pt-4 grid grid-cols-2 gap-4">
                        <div className="p-4 bg-slate-50 rounded-2xl">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Center Token</p>
                          <code className="text-sm font-black text-emerald-700 font-mono tracking-tighter">{center?.token}</code>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-2xl">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Access URL</p>
                          <code className="text-[10px] font-bold text-slate-500">JAMB-HUB/{center?.token?.split('-')[1]}</code>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
                    <h3 className="font-black text-[#1e293b] text-lg mb-6 tracking-tight">Quick Operations</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <ActionBtn 
                          icon={<UserPlus className="w-5 h-5" />} 
                          label="Enroll Student" 
                          sub="Add manually"
                          onClick={onAddStudent}
                        />
                      <ActionBtn 
                        icon={<Package className="w-5 h-5" />} 
                        label="Bulk Upload" 
                        sub="CSV Spreadsheet"
                        disabled
                      />
                      <ActionBtn 
                        icon={<BarChart3 className="w-5 h-5" />} 
                        label="Batch Results" 
                        sub="Export all PDF"
                        disabled
                      />
                      <ActionBtn 
                        icon={<ArrowLeft className="w-5 h-5" />} 
                        label="Switch Center" 
                        sub="Change active hub"
                        onClick={onBack}
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'students' && (
              <motion.div 
                key="students"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden"
              >
                <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="relative max-w-sm w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Search by name or reg number..."
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 transition-all font-medium"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  
                  <button 
                    onClick={onAddStudent}
                    className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm shadow-md shadow-emerald-600/20 flex items-center gap-2 hover:bg-emerald-700 transition-all"
                  >
                    <Plus className="w-5 h-5" />
                    Add Candidate
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50/50">
                      <tr>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Candidate</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Reg Number</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Subject Pool</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loading ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-emerald-600" />
                            <p className="font-bold text-sm">Syncing center records...</p>
                          </td>
                        </tr>
                      ) : filteredStudents.length > 0 ? (
                        filteredStudents.map((student, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center font-black text-slate-500 text-xs text-uppercase">
                                  {student.name?.charAt(0)}
                                </div>
                                <span className="text-sm font-bold text-slate-900">{student.name}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <code className="text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg uppercase tracking-wider font-mono">{student.regno}</code>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-wrap gap-1.5">
                                {student.subjectcombination?.split(',').map((s: string, i: number) => (
                                  <span key={i} className="px-2 py-0.5 bg-slate-100 text-[10px] font-bold text-slate-600 rounded-md uppercase">{s.trim()}</span>
                                ))}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                            <button 
                              className="p-2 text-slate-400 hover:text-emerald-600 transition-colors"
                              title="View Details"
                            >
                                <ChevronRight className="w-5 h-5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                            <Users className="w-12 h-12 mx-auto mb-4 opacity-10" />
                            <p className="font-black text-lg text-slate-400">No Candidates Found</p>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">Add your first student to get started</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {activeTab === 'questions' && (
              <motion.div 
                key="questions"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
                    <div className="flex items-center gap-4 flex-grow">
                      <div className="relative max-w-sm w-full">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                          type="text" 
                          placeholder="Search questions or subjects..."
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 transition-all font-medium"
                        />
                      </div>
                      <div className="flex bg-slate-100 p-1 rounded-xl">
                        <button className="px-4 py-1.5 bg-white shadow-sm rounded-lg text-xs font-bold text-slate-900">Private Pool</button>
                        <button className="px-4 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors">Global Bank</button>
                      </div>
                    </div>
                    
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm shadow-md shadow-emerald-600/20 flex items-center gap-2 hover:bg-emerald-700 transition-all font-mono"
                    >
                      <Plus className="w-5 h-5" />
                      Upload Private CSV
                    </button>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleCSVUpload} 
                      accept=".csv" 
                      className="hidden" 
                      title="Upload private questions CSV"
                    />
                  </div>

                  <div className="p-12 text-center flex flex-col items-center justify-center min-h-[350px]">
                    <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-6">
                      <BookOpen className="w-10 h-10 text-emerald-600 opacity-20" />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 mb-2">Private Question Repository</h3>
                    <p className="text-slate-500 max-w-md mx-auto mb-8 font-medium italic opacity-70">
                      You haven't uploaded any custom questions yet. Centers can host private question banks to serve their students during mock exams.
                    </p>
                    <div className="flex justify-center gap-4">
                      <button 
                        onClick={downloadCSVTemplate}
                        className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all flex items-center gap-2"
                      >
                        <Package className="w-4 h-4" />
                        Download CSV Template
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div 
                key="settings"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-1 lg:grid-cols-3 gap-8"
              >
                <div className="lg:col-span-2 space-y-6">
                  {/* Center Identity */}
                  <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
                    <h3 className="font-black text-[#1e293b] text-lg mb-6 tracking-tight">Institutional Profile</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <ProfileField label="Center Official Name" value={center?.centerName} />
                      <ProfileField label="Lead Coordinator" value={center?.coordinatorName} />
                      <ProfileField label="Primary Email" value={center?.email} />
                      <ProfileField label="Contact Phone" value={center?.phone} />
                      <div className="md:col-span-2">
                        <ProfileField label="Registered Physical Address" value={center?.address} />
                      </div>
                    </div>
                  </div>

                  {/* Quota Details */}
                  <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
                    <h3 className="font-black text-[#1e293b] text-lg mb-6 tracking-tight">Deployment & Quota</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <ProfileField label="Approved Student Count" value={`${center?.studentCount} Students`} />
                      <ProfileField label="Region / State" value={center?.state || 'Not Specified'} />
                      <ProfileField label="Local Govt Area" value={center?.lga || 'Not Specified'} />
                      <ProfileField label="Payment Reference" value={`JAMB-HUB-${center?.token?.split('-')[1]}`} />
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Token Status */}
                  <div className="bg-[#004d27] p-8 rounded-3xl shadow-xl shadow-[#004d27]/20 text-white overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                       <ShieldCheck className="w-24 h-24" />
                    </div>
                    <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mb-6 relative z-10">
                      <ShieldCheck className="w-6 h-6 text-emerald-400" />
                    </div>
                    <h3 className="font-black text-lg mb-2 relative z-10">Access Credentials</h3>
                    <p className="text-emerald-100/60 text-[10px] font-bold uppercase tracking-widest mb-6 relative z-10">Security Authorization Token</p>
                    
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/10 mb-6 relative z-10">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-black text-emerald-400 tracking-widest">PRIVATE TOKEN</span>
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      </div>
                      <code className="text-xl font-black block truncate font-mono">{center?.token}</code>
                    </div>

                    <p className="text-xs text-emerald-100/70 leading-relaxed font-medium relative z-10">
                      Share this token only with staff. Candidates do not need this token to log in if you register them from this hub.
                    </p>
                  </div>

                  <div className="bg-white p-6 rounded-3xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Support & Changes</p>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed mb-4">
                      To modify your center name, coordinator, or increase your student quota, please contact our support desk.
                    </p>
                    <button className="w-full py-3 bg-slate-50 text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-slate-100 transition-all">
                      Open Support Ticket
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

const NavItem = ({ active, onClick, icon, label, badge, tag }: { 
  active: boolean, 
  onClick: () => void, 
  icon: React.ReactNode, 
  label: string,
  badge?: string,
  tag?: string
}) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${
      active 
        ? 'bg-emerald-50 text-[#004d27] shadow-sm shadow-emerald-600/5' 
        : 'text-slate-500 hover:bg-slate-50'
    }`}
  >
    <div className="flex items-center gap-3">
      <div className={active ? 'text-[#004d27]' : 'text-slate-400'}>
        {icon}
      </div>
      <span className={`text-sm tracking-tight ${active ? 'font-black' : 'font-bold'}`}>{label}</span>
    </div>
    {badge && (
      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${
        active ? 'bg-[#004d27] text-white' : 'bg-slate-100 text-slate-500'
      }`}>
        {badge}
      </span>
    )}
    {tag && (
      <span className="px-1.5 py-0.5 bg-slate-100 text-slate-400 text-[8px] font-black uppercase rounded tracking-widest">
        {tag}
      </span>
    )}
  </button>
);

const StatCard = ({ icon, label, value, sub, color }: { 
  icon: React.ReactNode, 
  label: string, 
  value: string | number, 
  sub: string,
  color: 'blue' | 'emerald' | 'amber'
}) => (
  <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${
      color === 'blue' ? 'bg-blue-50' : 
      color === 'emerald' ? 'bg-emerald-50' : 
      'bg-amber-50'
    }`}>
      {icon}
    </div>
    <div className="space-y-1">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      <p className="text-3xl font-black text-slate-900 leading-tight">{value}</p>
      <p className="text-xs font-bold text-slate-500">{sub}</p>
    </div>
  </div>
);

const ActionBtn = ({ icon, label, sub, onClick, disabled }: { 
  icon: React.ReactNode, 
  label: string, 
  sub: string, 
  onClick?: () => void,
  disabled?: boolean
}) => (
  <button 
    onClick={onClick}
    disabled={disabled}
    className={`flex items-center gap-4 p-4 rounded-2xl border border-slate-100 transition-all text-left w-full group ${
      disabled ? 'opacity-40 cursor-not-allowed' : 'hover:border-emerald-200 hover:bg-emerald-50/50 hover:shadow-lg hover:shadow-emerald-600/5'
    }`}
  >
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all ${
      disabled ? 'bg-gray-100 text-gray-400' : 'bg-slate-50 text-slate-400 group-hover:bg-emerald-600 group-hover:text-white'
    }`}>
      {icon}
    </div>
    <div>
      <p className={`text-sm font-black tracking-tight transition-colors ${disabled ? 'text-gray-400' : 'text-slate-900 group-hover:text-emerald-800'}`}>{label}</p>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-1">{sub}</p>
    </div>
  );
};

const NavItem = ({ active, onClick, icon, label, badge, tag }: { 
  active: boolean, 
  onClick: () => void, 
  icon: React.ReactNode, 
  label: string,
  badge?: string,
  tag?: string
}) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${
      active 
        ? 'bg-emerald-50 text-[#004d27] shadow-sm shadow-emerald-600/5' 
        : 'text-slate-500 hover:bg-slate-50'
    }`}
  >
    <div className="flex items-center gap-3">
      <div className={active ? 'text-[#004d27]' : 'text-slate-400'}>
        {icon}
      </div>
      <span className={`text-sm tracking-tight ${active ? 'font-black' : 'font-bold'}`}>{label}</span>
    </div>
    <div className="flex items-center gap-2">
      {badge && (
        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${
          active ? 'bg-[#004d27] text-white' : 'bg-slate-100 text-slate-500'
        }`}>
          {badge}
        </span>
      )}
      {tag && (
        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-400 text-[8px] font-black uppercase rounded tracking-widest">
          {tag}
        </span>
      )}
    </div>
  </button>
);

const StatCard = ({ icon, label, value, sub, color }: { 
  icon: React.ReactNode, 
  label: string, 
  value: string | number, 
  sub: string,
  color: 'blue' | 'emerald' | 'amber'
}) => (
  <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${
      color === 'blue' ? 'bg-blue-50' : 
      color === 'emerald' ? 'bg-emerald-50' : 
      'bg-amber-50'
    }`}>
      {icon}
    </div>
    <div className="space-y-1">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      <p className="text-2xl md:text-3xl font-black text-slate-900 leading-tight">{value}</p>
      <p className="text-xs font-bold text-slate-500">{sub}</p>
    </div>
  </div>
);

const ActionBtn = ({ icon, label, sub, onClick, disabled }: { 
  icon: React.ReactNode, 
  label: string, 
  sub: string, 
  onClick?: () => void,
  disabled?: boolean
}) => (
  <button 
    onClick={onClick}
    disabled={disabled}
    className={`flex items-center gap-4 p-4 rounded-2xl border border-slate-100 transition-all text-left w-full group ${
      disabled ? 'opacity-40 cursor-not-allowed' : 'hover:border-emerald-200 hover:bg-emerald-50/50 hover:shadow-lg hover:shadow-emerald-600/5'
    }`}
  >
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all ${
      disabled ? 'bg-gray-100 text-gray-400' : 'bg-slate-50 text-slate-400 group-hover:bg-emerald-600 group-hover:text-white'
    }`}>
      {icon}
    </div>
    <div>
      <p className={`text-sm font-black tracking-tight transition-colors ${disabled ? 'text-gray-400' : 'text-slate-900 group-hover:text-emerald-800'}`}>{label}</p>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-1">{sub}</p>
    </div>
  </button>
);

const ProfileField = ({ label, value }: { label: string, value?: string | number }) => (
  <div className="space-y-1.5">
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
    <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-900 truncate">
      {value || 'Not Provided'}
    </div>
  </div>
);

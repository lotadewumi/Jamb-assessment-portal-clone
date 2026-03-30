import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Settings, 
  Users, 
  Eye, 
  EyeOff, 
  Plus, 
  Trash2, 
  Save, 
  CheckCircle2, 
  AlertCircle,
  TrendingUp,
  History,
  DollarSign,
  ChevronRight,
  Loader2,
  Lock,
  Unlock,
  ArrowLeft,
  Building2,
  Phone,
  Mail
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { googleSheetsService } from '../services/googleSheetsService';
import { ExamSettings, PaymentLog } from '../types';

interface AdminPageProps {
  onBack: () => void;
  initialSettings: ExamSettings | null;
  onSave?: (settings: ExamSettings) => void;
}

export const AdminPage: React.FC<AdminPageProps> = ({ onBack, initialSettings, onSave }) => {
  const [activeTab, setActiveTab] = useState<'payments' | 'controls' | 'pricing' | 'support'>('payments');
  const [settings, setSettings] = useState<ExamSettings | null>(initialSettings);
  const [paymentLogs, setPaymentLogs] = useState<PaymentLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [logs, currentSettings] = await Promise.all([
        googleSheetsService.getPaymentLogs(),
        googleSheetsService.getSettings()
      ]);
      setPaymentLogs(logs);
      if (currentSettings) setSettings(currentSettings);
    } catch (error) {
      console.error('Failed to load admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    setMessage(null);
    try {
      const success = await googleSheetsService.updateSettings(settings);
      if (success) {
        setMessage({ type: 'success', text: 'Settings updated successfully!' });
        if (onSave) onSave(settings);
      } else {
        setMessage({ type: 'error', text: 'Failed to update settings.' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An error occurred while saving.' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const toggleStudentReg = () => {
    if (!settings) return;
    setSettings({ ...settings, studentRegEnabled: !settings.studentRegEnabled });
  };

  const toggleTutorialReg = () => {
    if (!settings) return;
    setSettings({ ...settings, tutorialRegEnabled: !settings.tutorialRegEnabled });
  };
  
  const toggleLock = () => {
    if (!settings) return;
    setSettings({ ...settings, isLocked: !settings.isLocked });
  };

  const updateDiscountTier = (index: number, field: string, value: any) => {
    if (!settings || !settings.discountTiers) return;
    const newTiers = [...settings.discountTiers];
    newTiers[index] = { ...newTiers[index], [field]: Number(value) };
    setSettings({ ...settings, discountTiers: newTiers });
  };

  const addDiscountTier = () => {
    if (!settings) return;
    const newTiers = [...(settings.discountTiers || []), { min: 0, max: 0, price: 0 }];
    setSettings({ ...settings, discountTiers: newTiers });
  };

  const removeDiscountTier = (index: number) => {
    if (!settings || !settings.discountTiers) return;
    const newTiers = settings.discountTiers.filter((_, i) => i !== index);
    setSettings({ ...settings, discountTiers: newTiers });
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassword === 'admin123' || adminPassword === 'jamb2026') {
      setIsAuthenticated(true);
      setLoginError('');
    } else {
      setLoginError('Invalid Administrator Password');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 bg-[radial-gradient(circle_at_top_right,rgba(0,77,39,0.05),transparent_50%),radial-gradient(circle_at_bottom_left,rgba(0,77,39,0.05),transparent_50%)]">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-8 shadow-2xl"
        >
          <div className="w-16 h-16 bg-[#004d27]/10 rounded-2xl flex items-center justify-center mb-6 mx-auto border border-[#004d27]/20">
            <Lock className="w-8 h-8 text-[#004d27]" />
          </div>
          <h1 className="text-3xl font-black text-[#004d27] text-center mb-2">Admin Portal</h1>
          <p className="text-slate-500 text-center mb-8">Verification required to access management console</p>
          
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5 ml-1">Access Password</label>
              <div className="relative">
                <input 
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Enter administrator password"
                  title="Admin Password"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#004d27]/50 transition-all font-mono"
                  autoFocus
                />
              </div>
            </div>
            
            {loginError && (
              <div className="flex items-center gap-2 text-rose-600 text-sm bg-rose-50 p-3 rounded-lg border border-rose-100">
                <AlertCircle className="w-4 h-4" />
                <span>{loginError}</span>
              </div>
            )}
            
            <button 
              type="submit"
              className="w-full bg-[#004d27] hover:bg-[#003d1f] text-white font-bold py-3.5 rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-[#004d27]/20 flex items-center justify-center gap-2"
            >
              Verify Identity
              <ChevronRight className="w-5 h-5" />
            </button>
          </form>

          <button 
            onClick={onBack}
            className="w-full mt-4 text-slate-400 hover:text-[#004d27] transition-colors flex items-center justify-center gap-2 text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Public Site
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Sidebar / Navigation */}
      <div className="fixed left-0 top-0 h-full w-64 bg-white border-r border-slate-200 hidden lg:flex flex-col p-6 z-50 shadow-sm">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-10 h-10 bg-[#004d27] rounded-xl flex items-center justify-center shadow-lg shadow-[#004d27]/20">
            <Lock className="w-5 h-5 text-white" />
          </div>
          <span className="font-black text-xl tracking-tight text-[#004d27] uppercase">Admin<span className="text-[#004d27] text-xs align-top ml-0.5 opacity-60">PRO</span></span>
        </div>

        <nav className="space-y-2 flex-grow">
          <button 
            onClick={() => setActiveTab('payments')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'payments' ? 'bg-[#004d27] text-white shadow-lg shadow-[#004d27]/20' : 'hover:bg-slate-50 text-slate-500 hover:text-[#004d27]'}`}
          >
            <CreditCard className="w-5 h-5" />
            <span className="font-semibold text-sm">Payment Logs</span>
          </button>
          <button 
            onClick={() => setActiveTab('controls')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'controls' ? 'bg-[#004d27] text-white shadow-lg shadow-[#004d27]/20' : 'hover:bg-slate-50 text-slate-500 hover:text-[#004d27]'}`}
          >
            <Settings className="w-5 h-5" />
            <span className="font-semibold text-sm">Registration Controls</span>
          </button>
          <button 
            onClick={() => setActiveTab('pricing')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'pricing' ? 'bg-[#004d27] text-white shadow-lg shadow-[#004d27]/20' : 'hover:bg-slate-50 text-slate-500 hover:text-[#004d27]'}`}
          >
            <DollarSign className="w-5 h-5" />
            <span className="font-semibold text-sm">Pricing Strategy</span>
          </button>
          <button 
            onClick={() => setActiveTab('support')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'support' ? 'bg-[#004d27] text-white shadow-lg shadow-[#004d27]/20' : 'hover:bg-slate-50 text-slate-500 hover:text-[#004d27]'}`}
          >
            <Phone className="w-5 h-5" />
            <span className="font-semibold text-sm">Support Channels</span>
          </button>
        </nav>

        <div className="pt-6 border-t border-slate-100">
          <button 
            onClick={onBack}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all group"
          >
            <History className="w-5 h-5 group-hover:rotate-[-45deg] transition-transform" />
            <span className="font-semibold text-sm">Exit Terminal</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="lg:pl-64 min-h-screen">
        <header className="h-20 border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-40">
          <div>
            <h2 className="text-2xl font-black text-[#004d27] capitalize">{activeTab.replace('-', ' ')}</h2>
            <p className="text-slate-400 text-[10px] font-bold tracking-widest uppercase">Management Suite / {activeTab}</p>
          </div>

          <div className="flex items-center gap-4">
            {message && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${message.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700'}`}
              >
                {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                <span className="text-sm font-bold">{message.text}</span>
              </motion.div>
            )}

            <button 
              onClick={handleSaveSettings}
              disabled={saving || !settings}
              className="px-6 py-2.5 bg-[#004d27] text-white font-bold rounded-xl hover:bg-[#003d1f] transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-[#004d27]/20 active:scale-95"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Commit Changes
            </button>
          </div>
        </header>

        <main className="p-8 max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            {loading ? (
              <div className="h-96 flex flex-col items-center justify-center gap-4 text-slate-500">
                <Loader2 className="w-12 h-12 animate-spin text-emerald-500" />
                <p className="font-medium animate-pulse">Syncing with Central Database...</p>
              </div>
            ) : (
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === 'payments' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Gross Revenue</p>
                        <h3 className="text-3xl font-black text-[#004d27]">₦{paymentLogs.reduce((acc, log) => acc + (Number(log.amount) || 0), 0).toLocaleString()}</h3>
                        <div className="mt-2 flex items-center gap-1.5 text-emerald-600 text-[10px] font-bold uppercase">
                          <TrendingUp className="w-3 h-3" />
                          <span>8.4% vs last week</span>
                        </div>
                      </div>
                      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Active Students</p>
                        <h3 className="text-3xl font-black text-[#004d27]">{paymentLogs.filter(l => l.type === 'student').length}</h3>
                        <p className="mt-2 text-slate-400 text-[10px] font-bold uppercase">Total registrations</p>
                      </div>
                      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                        <p className="text-slate-400 text-[10px) font-bold uppercase tracking-widest mb-1">Tutorial Centers</p>
                        <h3 className="text-3xl font-black text-[#004d27]">{paymentLogs.filter(l => l.type === 'tutorial').length}</h3>
                        <p className="mt-2 text-slate-400 text-[10px] font-bold uppercase">Partner centers</p>
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                        <h4 className="font-bold text-[#004d27] uppercase tracking-wider text-xs flex items-center gap-2">
                          <History className="w-4 h-4 text-[#004d27]" />
                          Transaction Ledger
                        </h4>
                        <button className="text-[10px] font-bold text-[#004d27] hover:underline uppercase tracking-widest">Export CSV</button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Timestamp</th>
                              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Entity</th>
                              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Category</th>
                              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Credit</th>
                              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Receipt</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {paymentLogs.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-medium italic text-sm">No ledger entries found. Database is empty.</td>
                              </tr>
                            ) : (
                              paymentLogs.map((log, i) => (
                                <tr key={i} className="hover:bg-slate-50 transition-colors group">
                                  <td className="px-6 py-4">
                                    <p className="text-sm font-semibold text-slate-900">{new Date(log.timestamp).toLocaleDateString()}</p>
                                    <p className="text-[10px] text-slate-400 font-mono uppercase">{new Date(log.timestamp).toLocaleTimeString()}</p>
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black group-hover:bg-[#004d27] group-hover:text-white transition-colors">
                                        {log.name.charAt(0)}
                                      </div>
                                      <div>
                                        <p className="text-sm font-bold text-slate-900">{log.name}</p>
                                        <p className="text-xs text-slate-400">{log.email}</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${log.type === 'student' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-purple-50 text-purple-600 border border-purple-100'}`}>
                                      {log.type}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                    <p className="text-sm font-black text-[#004d27]">₦{Number(log.amount).toLocaleString()}</p>
                                    <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest">Successful</p>
                                  </td>
                                  <td className="px-6 py-4 text-center">
                                    <span className="text-[10px] font-mono text-slate-300 select-all">{log.reference}</span>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'controls' && settings && (
                  <div className="space-y-8">
                    {/* General Site Settings */}
                    <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-[#004d27]/10 rounded-xl flex items-center justify-center">
                          <Settings className="w-5 h-5 text-[#004d27]" />
                        </div>
                        <h4 className="text-lg font-black text-[#004d27] uppercase tracking-wider">General Configuration</h4>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Portal Display Title</label>
                          <input 
                            type="text"
                            value={settings.examTitle}
                            title="The title shown on the landing page and exam header"
                            placeholder="e.g. JAMB Mock Assessment 2026"
                            onChange={(e) => setSettings({ ...settings, examTitle: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-slate-900 font-bold text-lg focus:ring-2 focus:ring-[#004d27]/50 focus:border-[#004d27] outline-none transition-all shadow-sm"
                          />
                          <p className="mt-2 text-[10px] text-slate-400 ml-1">This title updates the landing page and the header during the exam.</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div 
                        onClick={toggleStudentReg}
                        className={`relative group cursor-pointer overflow-hidden border-2 transition-all p-8 rounded-[2rem] flex flex-col items-center text-center gap-4 ${settings.studentRegEnabled ? 'bg-[#004d27]/5 border-[#004d27] shadow-xl shadow-[#004d27]/5' : 'bg-white border-slate-100 grayscale opacity-60'}`}
                      >
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${settings.studentRegEnabled ? 'bg-[#004d27] text-white' : 'bg-slate-100 text-slate-400'}`}>
                          {settings.studentRegEnabled ? <Eye className="w-8 h-8" /> : <EyeOff className="w-8 h-8" />}
                        </div>
                        <div>
                          <h4 className="text-xl font-black text-[#004d27] mb-1">Student Registration</h4>
                          <p className="text-slate-500 text-sm leading-relaxed">
                            Currently <strong>{settings.studentRegEnabled ? 'VISIBLE' : 'HIDDEN'}</strong> to the public. Prospective candidates can {settings.studentRegEnabled ? 'now' : 'no longer'} register for mock exams.
                          </p>
                        </div>
                        <div className={`mt-4 px-6 py-2 rounded-full font-black text-xs uppercase tracking-tighter ${settings.studentRegEnabled ? 'bg-[#004d27] text-white' : 'bg-slate-200 text-slate-500'}`}>
                          {settings.studentRegEnabled ? 'Protocol Active' : 'Protocol Suspended'}
                        </div>
                      </div>

                      <div 
                        onClick={toggleTutorialReg}
                        className={`relative group cursor-pointer overflow-hidden border-2 transition-all p-8 rounded-[2rem] flex flex-col items-center text-center gap-4 ${settings.tutorialRegEnabled ? 'bg-emerald-50 border-emerald-600 shadow-xl shadow-emerald-900/5' : 'bg-white border-slate-100 grayscale opacity-60'}`}
                      >
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${settings.tutorialRegEnabled ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                          {settings.tutorialRegEnabled ? <Building2 className="w-8 h-8" /> : <EyeOff className="w-8 h-8" />}
                        </div>
                        <div>
                          <h4 className="text-xl font-black text-slate-900 mb-1">Center Registration</h4>
                          <p className="text-slate-500 text-sm leading-relaxed">
                            Currently <strong>{settings.tutorialRegEnabled ? 'VISIBLE' : 'HIDDEN'}</strong> to the public. Tutorial centers can {settings.tutorialRegEnabled ? 'now' : 'no longer'} apply for bulk tokens.
                          </p>
                        </div>
                        <div className={`mt-4 px-6 py-2 rounded-full font-black text-xs uppercase tracking-tighter ${settings.tutorialRegEnabled ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                          {settings.tutorialRegEnabled ? 'Protocol Active' : 'Protocol Suspended'}
                        </div>
                      </div>
                    </div>

                    {/* Lock Exam Logic */}
                    <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
                      <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-all ${settings.isLocked ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-emerald-50 border-emerald-200 text-emerald-600'}`}>
                            {settings.isLocked ? <Lock className="w-6 h-6" /> : <Unlock className="w-6 h-6" />}
                          </div>
                          <div>
                            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Exam Access Protocol</h3>
                            <p className="text-slate-400 text-[10px] font-bold tracking-widest uppercase">Global Access Lockdown</p>
                          </div>
                        </div>
                        
                        <button 
                          onClick={toggleLock}
                          className={`px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-lg flex items-center gap-3 ${settings.isLocked ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20' : 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20'}`}
                        >
                          {settings.isLocked ? (
                            <>
                              <Unlock className="w-4 h-4" />
                              Unlock Exam Portal
                            </>
                          ) : (
                            <>
                              <Lock className="w-4 h-4" />
                              Lock Exam Portal
                            </>
                          )}
                        </button>
                      </div>

                      <div className="space-y-6">
                        <div className={`p-6 rounded-2xl border transition-all ${settings.isLocked ? 'bg-rose-50 border-rose-100' : 'bg-slate-50 border-slate-100'}`}>
                          <div className="flex items-start gap-4">
                            <AlertCircle className={`w-5 h-5 shrink-0 mt-0.5 ${settings.isLocked ? 'text-rose-600' : 'text-slate-400'}`} />
                            <div className="space-y-4 flex-grow">
                              <div>
                                <h4 className={`text-sm font-black uppercase tracking-tight mb-1 ${settings.isLocked ? 'text-rose-700' : 'text-slate-600'}`}>
                                  {settings.isLocked ? 'Portal Currently Locked' : 'Portal Status: Operational'}
                                </h4>
                                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                                  {settings.isLocked 
                                    ? 'Students are currently blocked from logging in to take exams. They will see the custom message defined below.' 
                                    : 'Students can currently login and take exams if they have valid registration numbers.'}
                                </p>
                              </div>
                              
                              <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Student Notification Message</label>
                                <textarea 
                                  value={settings.lockMessage || ''}
                                  onChange={(e) => setSettings({ ...settings, lockMessage: e.target.value })}
                                  placeholder="e.g. The exam portal is currently closed for maintenance. Please check back later."
                                  rows={2}
                                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:ring-2 focus:ring-[#004d27]/20 outline-none transition-all resize-none"
                                />
                                <p className="mt-2 text-[9px] text-slate-400 italic">This message is only displayed to students when the portal is locked.</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'pricing' && settings && (
                  <div className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="w-10 h-10 bg-[#004d27]/10 rounded-xl flex items-center justify-center">
                            <Users className="w-5 h-5 text-[#004d27]" />
                          </div>
                          <h4 className="text-lg font-black text-[#004d27] uppercase tracking-wider">Candidate Fee</h4>
                        </div>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Individual Registration (₦)</label>
                            <div className="relative group">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₦</span>
                              <input 
                                type="number"
                                value={settings.studentRegFee}
                                title="Student registration fee per student"
                                onChange={(e) => setSettings({ ...settings, studentRegFee: Number(e.target.value) })}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-3.5 text-slate-900 font-black text-lg focus:ring-2 focus:ring-[#004d27]/50 focus:border-[#004d27] outline-none transition-all shadow-sm"
                              />
                            </div>
                            <p className="mt-2 text-[10px] text-slate-400 ml-1">Applied to all single-student registrations.</p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-emerald-600" />
                          </div>
                          <h4 className="text-lg font-black text-slate-900 uppercase tracking-wider">Center Base Rate</h4>
                        </div>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Standard Rate per Student (₦)</label>
                            <div className="relative group">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₦</span>
                              <input 
                                type="number"
                                value={settings.tutorialBaseFee}
                                title="Tutorial center base fee per student"
                                onChange={(e) => setSettings({ ...settings, tutorialBaseFee: Number(e.target.value) })}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-3.5 text-slate-900 font-black text-lg focus:ring-2 focus:ring-[#004d27]/50 focus:border-[#004d27] outline-none transition-all shadow-sm"
                              />
                            </div>
                            <p className="mt-2 text-[10px] text-slate-400 ml-1">Base price for centers before volume discounts apply.</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm">
                      <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-[#004d27]/10 rounded-[1.25rem] flex items-center justify-center border border-[#004d27]/20 shadow-lg shadow-[#004d27]/5">
                            <TrendingUp className="w-6 h-6 text-[#004d27]" />
                          </div>
                          <div>
                            <h4 className="text-xl font-black text-[#004d27] uppercase tracking-tighter">Volume Discount Tiers</h4>
                            <p className="text-slate-400 text-[10px] font-bold tracking-widest uppercase">Center Incentive Program</p>
                          </div>
                        </div>
                        <button 
                          onClick={addDiscountTier}
                          className="flex items-center gap-2 px-6 py-3 bg-slate-50 hover:bg-[#004d27] text-slate-600 hover:text-white font-black rounded-2xl transition-all border border-slate-200 active:scale-95 group shadow-sm"
                        >
                          <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
                          Initialize New Tier
                        </button>
                                        <div className="space-y-4">
                        {(settings.discountTiers || []).length === 0 ? (
                          <div className="py-12 border-2 border-dashed border-slate-100 rounded-3xl text-center bg-slate-50/50">
                            <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">Linear pricing active — No discount tiers defined</p>
                          </div>
                        ) : (
                          settings.discountTiers?.map((tier, index) => (
                            <motion.div 
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              key={index} 
                              className="group flex flex-col md:flex-row items-end md:items-center gap-4 bg-slate-50 border border-slate-200 p-6 rounded-[2rem] hover:border-[#004d27]/30 transition-all hover:bg-white shadow-sm"
                            >
                              <div className="w-full md:w-32">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Min. Students</label>
                                <input 
                                  type="number"
                                  value={tier.min}
                                  title="Minimum students for this tier"
                                  onChange={(e) => updateDiscountTier(index, 'min', e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 font-bold outline-none focus:ring-1 focus:ring-[#004d27]"
                                />
                              </div>
                              <div className="w-full md:w-32">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Max. Students</label>
                                <input 
                                  type="number"
                                  value={tier.max}
                                  title="Maximum students for this tier"
                                  onChange={(e) => updateDiscountTier(index, 'max', e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 font-bold outline-none focus:ring-1 focus:ring-[#004d27]"
                                />
                              </div>
                              <div className="flex-grow w-full">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Tier Price (₦)</label>
                                <div className="relative">
                                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₦</span>
                                  <input 
                                    type="number"
                                    value={tier.price}
                                    title="Discounted price per student for this tier"
                                    onChange={(e) => updateDiscountTier(index, 'price', e.target.value)}
                                    className="w-full bg-[#004d27]/5 border border-[#004d27]/20 rounded-xl pl-9 pr-4 py-2.5 text-[#004d27] font-black outline-none focus:ring-1 focus:ring-[#004d27]"
                                  />
                                </div>
                              </div>
                              <button 
                                onClick={() => removeDiscountTier(index)}
                                title="Remove discount tier"
                                className="p-3.5 rounded-xl text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-all group/del"
                              >
                                <Trash2 className="w-5 h-5 group-hover/del:scale-110 transition-transform" />
                              </button>
                            </motion.div>
                          ))
                        )}
                      </div>
           </div>
                    </div>
                  </div>
                )}
                {activeTab === 'support' && (
                  <div className="space-y-6 max-w-4xl animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
                      <div className="flex items-center gap-4 mb-8">
                        <div className="w-12 h-12 bg-[#004d27]/10 rounded-2xl flex items-center justify-center border border-[#004d27]/20 shadow-lg shadow-[#004d27]/5">
                          <Phone className="w-6 h-6 text-[#004d27]" />
                        </div>
                        <div>
                          <h3 className="text-xl font-black text-[#004d27] uppercase tracking-tight">Support Channels</h3>
                          <p className="text-slate-400 text-[10px] font-bold tracking-widest uppercase">Public Facing Contact Details</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                           <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Customer Service Email</label>
                            <div className="relative">
                              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                              <input 
                                type="email" 
                                className="w-full bg-slate-50 border border-slate-200 focus:border-[#004d27] rounded-xl pl-12 pr-4 py-3.5 text-slate-900 transition-all text-sm outline-none shadow-sm"
                                value={settings?.customerServiceEmail || ''}
                                onChange={(e) => setSettings(settings ? { ...settings, customerServiceEmail: e.target.value } : null)}
                                placeholder="support@jambportal.com"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Customer Service Phone</label>
                            <div className="relative">
                              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                              <input 
                                type="tel" 
                                className="w-full bg-slate-50 border border-slate-200 focus:border-[#004d27] rounded-xl pl-12 pr-4 py-3.5 text-slate-900 transition-all text-sm outline-none shadow-sm"
                                value={settings?.customerServiceNumber || ''}
                                onChange={(e) => setSettings(settings ? { ...settings, customerServiceNumber: e.target.value } : null)}
                                placeholder="+234 801 234 5678"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-6">
                          <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Admin Direct Email</label>
                            <div className="relative">
                              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                              <input 
                                type="email" 
                                className="w-full bg-slate-50 border border-slate-200 focus:border-[#004d27] rounded-xl pl-12 pr-4 py-3.5 text-slate-900 transition-all text-sm outline-none shadow-sm"
                                value={settings?.adminContactEmail || ''}
                                onChange={(e) => setSettings(settings ? { ...settings, adminContactEmail: e.target.value } : null)}
                                placeholder="admin@jambportal.com"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Admin Direct Phone</label>
                            <div className="relative">
                              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                              <input 
                                type="tel" 
                                className="w-full bg-slate-50 border border-slate-200 focus:border-[#004d27] rounded-xl pl-12 pr-4 py-3.5 text-slate-900 transition-all text-sm outline-none shadow-sm"
                                value={settings?.adminContactPhone || ''}
                                onChange={(e) => setSettings(settings ? { ...settings, adminContactPhone: e.target.value } : null)}
                                placeholder="+234 801 999 0000"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-10 p-4 bg-[#004d27]/5 rounded-2xl border border-[#004d27]/10">
                        <p className="text-[10px] text-[#004d27] font-bold uppercase tracking-widest text-center">
                          These details will be displayed to candidates on the registration and payment confirmation screens for support.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

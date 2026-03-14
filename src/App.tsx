import * as React from 'react';
import { useState, useEffect, Component } from 'react';
import { 
  ShieldCheck, 
  MapPin, 
  FileText, 
  Smartphone, 
  LayoutDashboard, 
  AlertTriangle,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Plus,
  Database,
  ChevronLeft,
  ChevronRight,
  Download,
  MoreHorizontal
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  where, 
  getDocs,
  doc,
  setDoc,
  Timestamp
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { db, auth } from './firebase';
import { AgroInput, VerificationLog, CounterfeitReport } from './types';
import { GoogleGenAI } from "@google/genai";

// --- Error Handling ---

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

class ErrorBoundary extends Component<any, any> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    // @ts-ignore
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    // @ts-ignore
    if (this.state.hasError) {
      let displayMessage = "Something went wrong.";
      try {
        // @ts-ignore
        const parsed = JSON.parse(this.state.error?.message || "{}");
        if (parsed.error) displayMessage = `Firestore Error: ${parsed.error} (${parsed.operationType} on ${parsed.path})`;
      } catch (e) {
        // @ts-ignore
        displayMessage = this.state.error?.message || displayMessage;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-6">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-zinc-100 max-w-md w-full text-center">
            <AlertTriangle size={48} className="text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-zinc-900 mb-2">Application Error</h2>
            <p className="text-zinc-500 text-sm mb-6">{displayMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-all"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    // @ts-ignore
    return this.props.children;
  }
}

// --- Components ---

const USSDSimulator = () => {
  const [text, setText] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [response, setResponse] = useState('Welcome to AgroInputTrust\n1. Verify Input\n2. Report Suspicious Activity\n3. Usage Guide');
  const [isSessionActive, setIsSessionActive] = useState(false);

  const handleSend = async (input: string) => {
    if (!input.trim()) return;
    
    // Simple validation for codes (e.g., alphanumeric only)
    if (text === '1' && !/^[a-zA-Z0-9]+$/.test(input)) {
      setResponse('Invalid code format. Please enter alphanumeric characters only.');
      return;
    }

    const newText = text ? `${text}*${input}` : input;
    const res = await fetch('/api/ussd', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'sim-123',
        serviceCode: '*384#',
        phoneNumber: '+254700000000',
        text: newText
      })
    });
    const data = await res.text();
    
    if (data.startsWith('END')) {
      setResponse(data.replace('END ', ''));
      setIsSessionActive(false);
      setText('');
    } else {
      setResponse(data.replace('CON ', ''));
      setIsSessionActive(true);
      setText(newText);
    }
    setHistory([...history, `User: ${input}`, `System: ${data}`]);
  };

  const reset = () => {
    setText('');
    setResponse('Welcome to AgroInputTrust\n1. Verify Input\n2. Report Suspicious Activity\n3. Usage Guide');
    setIsSessionActive(false);
    setHistory([]);
  };

  return (
    <div className="bg-zinc-900 text-zinc-100 p-6 rounded-2xl border border-zinc-800 shadow-xl max-w-md w-full">
      <div className="flex items-center gap-2 mb-4 text-emerald-500">
        <Smartphone size={20} />
        <h2 className="font-semibold">USSD Simulator (*384#)</h2>
      </div>
      
      <div className="bg-black rounded-xl p-4 mb-4 h-64 overflow-y-auto font-mono text-sm border border-zinc-800">
        <div className="whitespace-pre-wrap text-emerald-400">{response}</div>
      </div>

      <div className="flex gap-2">
        <input 
          type="text" 
          placeholder="Enter option..."
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSend((e.target as HTMLInputElement).value);
              (e.target as HTMLInputElement).value = '';
            }
          }}
        />
        <button 
          onClick={reset}
          className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
        >
          Reset
        </button>
      </div>
      
      <div className="mt-4 text-[10px] text-zinc-500 uppercase tracking-widest">
        Session History
        <div className="mt-1 h-20 overflow-y-auto opacity-50">
          {history.map((h, i) => <div key={i}>{h}</div>)}
        </div>
      </div>
    </div>
  );
};

const AdminDashboard = ({ user }: { user: User | null }) => {
  const [inputs, setInputs] = useState<AgroInput[]>([]);
  const [verifications, setVerifications] = useState<VerificationLog[]>([]);
  const [reports, setReports] = useState<CounterfeitReport[]>([]);
  const [activeTab, setActiveTab] = useState<'verifications' | 'reports' | 'inventory'>('verifications');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReport, setSelectedReport] = useState<CounterfeitReport | null>(null);
  const itemsPerPage = 5;

  useEffect(() => {
    if (!user) return;

    const qInputs = query(collection(db, 'inputs'));
    const qVerifications = query(collection(db, 'verifications'), orderBy('timestamp', 'desc'));
    const qReports = query(collection(db, 'reports'), orderBy('timestamp', 'desc'));

    const unsubInputs = onSnapshot(qInputs, (s) => setInputs(s.docs.map(d => ({ id: d.id, ...d.data() } as AgroInput))), (e) => handleFirestoreError(e, OperationType.LIST, 'inputs'));
    const unsubVerifications = onSnapshot(qVerifications, (s) => setVerifications(s.docs.map(d => ({ id: d.id, ...d.data() } as VerificationLog))), (e) => handleFirestoreError(e, OperationType.LIST, 'verifications'));
    const unsubReports = onSnapshot(qReports, (s) => setReports(s.docs.map(d => ({ id: d.id, ...d.data() } as CounterfeitReport))), (e) => handleFirestoreError(e, OperationType.LIST, 'reports'));

    return () => { unsubInputs(); unsubVerifications(); unsubReports(); };
  }, [user]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchTerm]);

  const getCurrentData = () => {
    let data: any[] = [];
    switch (activeTab) {
      case 'verifications': data = verifications; break;
      case 'reports': data = reports; break;
      case 'inventory': data = inputs; break;
    }

    if (!searchTerm) return data;

    const term = searchTerm.toLowerCase();
    return data.filter(item => {
      if ('code' in item && item.code.toLowerCase().includes(term)) return true;
      if ('product' in item && item.product.toLowerCase().includes(term)) return true;
      if ('phoneNumber' in item && item.phoneNumber.toLowerCase().includes(term)) return true;
      if ('location' in item && item.location.toLowerCase().includes(term)) return true;
      return false;
    });
  };

  const currentData = getCurrentData();
  const totalPages = Math.ceil(currentData.length / itemsPerPage);
  const paginatedData = currentData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const exportToCSV = () => {
    const data = getCurrentData();
    if (data.length === 0) return;

    const headers = Object.keys(data[0]).filter(k => k !== 'id').join(',');
    const rows = data.map(item => {
      return Object.entries(item)
        .filter(([k]) => k !== 'id')
        .map(([, v]) => `"${v}"`)
        .join(',');
    });

    const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + rows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `agro_trust_${activeTab}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const updateReportStatus = async (reportId: string, newStatus: CounterfeitReport['status']) => {
    try {
      const reportRef = doc(db, 'reports', reportId);
      await setDoc(reportRef, { status: newStatus }, { merge: true });
      if (selectedReport?.id === reportId) {
        setSelectedReport({ ...selectedReport, status: newStatus });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `reports/${reportId}`);
    }
  };

  const seedData = async () => {
    const demoInputs = [
      { code: 'SEED123', product: 'Maize Seed X-200', manufacturer: 'AgroCorp', status: 'VERIFIED', expiryDate: '2026-12-31' },
      { code: 'FERT456', product: 'NPK 17-17-17', manufacturer: 'SoilBoost', status: 'VERIFIED', expiryDate: '2025-06-30' },
      { code: 'PEST789', product: 'BugGone Pro', manufacturer: 'SafeCrop', status: 'SUSPICIOUS', expiryDate: '2024-01-01' },
      { code: 'SEED999', product: 'Hybrid Corn v2', manufacturer: 'AgroCorp', status: 'USED', expiryDate: '2025-12-31' },
      { code: 'FERT000', product: 'Urea 46%', manufacturer: 'GlobalAg', status: 'VERIFIED', expiryDate: '2027-01-01' },
      { code: 'FAKE123', product: 'Unknown Fertilizer', manufacturer: 'Unknown', status: 'SUSPICIOUS', expiryDate: '2023-01-01' },
    ];
    try {
      for (const item of demoInputs) {
        await setDoc(doc(db, 'inputs', item.code), item);
      }
      alert('Demo data seeded!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'inputs');
    }
  };

  if (!user) return (
    <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl shadow-sm border border-zinc-100">
      <ShieldCheck size={48} className="text-emerald-500 mb-4" />
      <h2 className="text-2xl font-bold text-zinc-900 mb-2">Admin Access Required</h2>
      <p className="text-zinc-500 mb-6 text-center max-w-xs">Sign in to view the counterfeit risk heatmap and verification logs.</p>
      <button 
        onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}
        className="px-6 py-3 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-all font-medium flex items-center gap-2"
      >
        Sign in with Google
      </button>
    </div>
  );

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 p-8 w-full max-w-5xl relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
            <LayoutDashboard size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-zinc-900">Ops Dashboard</h2>
            <p className="text-sm text-zinc-500">Monitoring quality control & trust</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={exportToCSV}
            className="text-xs px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Download size={14} /> Export CSV
          </button>
          <button 
            onClick={seedData}
            className="text-xs px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Database size={14} /> Seed Data
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex gap-1 p-1 bg-zinc-100 rounded-xl w-fit">
          {(['verifications', 'reports', 'inventory'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input 
            type="text" 
            placeholder="Search logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      <div className="overflow-hidden border border-zinc-100 rounded-2xl">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-500 font-medium border-bottom border-zinc-100">
            {activeTab === 'verifications' && (
              <tr>
                <th className="px-6 py-4">Code</th>
                <th className="px-6 py-4">Phone</th>
                <th className="px-6 py-4">Result</th>
                <th className="px-6 py-4">Time</th>
              </tr>
            )}
            {activeTab === 'reports' && (
              <tr>
                <th className="px-6 py-4">Reporter</th>
                <th className="px-6 py-4">Location</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            )}
            {activeTab === 'inventory' && (
              <tr>
                <th className="px-6 py-4">Code</th>
                <th className="px-6 py-4">Product</th>
                <th className="px-6 py-4">Manufacturer</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            )}
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {activeTab === 'verifications' && (paginatedData as VerificationLog[]).map((v) => (
              <tr key={v.id} className="hover:bg-zinc-50 transition-colors">
                <td className="px-6 py-4 font-mono text-zinc-900">{v.code}</td>
                <td className="px-6 py-4 text-zinc-500">{v.phoneNumber}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-md text-[10px] font-bold ${
                    v.result === 'VERIFIED' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {v.result}
                  </span>
                </td>
                <td className="px-6 py-4 text-zinc-400 text-xs">{new Date(v.timestamp).toLocaleString()}</td>
              </tr>
            ))}
            {activeTab === 'reports' && (paginatedData as CounterfeitReport[]).map((r) => (
              <tr key={r.id} className="hover:bg-zinc-50 transition-colors">
                <td className="px-6 py-4 text-zinc-500">{r.phoneNumber}</td>
                <td className="px-6 py-4 text-zinc-900 font-medium">{r.location}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-md text-[10px] font-bold ${
                    r.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : 
                    r.status === 'INVESTIGATING' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {r.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button 
                    onClick={() => setSelectedReport(r)}
                    className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-400 hover:text-zinc-600 transition-colors"
                  >
                    <MoreHorizontal size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {activeTab === 'inventory' && (paginatedData as AgroInput[]).map((i) => (
              <tr key={i.id} className="hover:bg-zinc-50 transition-colors">
                <td className="px-6 py-4 font-mono text-zinc-900">{i.code}</td>
                <td className="px-6 py-4 text-zinc-900">{i.product}</td>
                <td className="px-6 py-4 text-zinc-500">{i.manufacturer}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-md text-[10px] font-bold ${
                    i.status === 'VERIFIED' ? 'bg-emerald-100 text-emerald-700' : 
                    i.status === 'SUSPICIOUS' ? 'bg-red-100 text-red-700' : 
                    i.status === 'USED' ? 'bg-zinc-100 text-zinc-700' : 'bg-zinc-100 text-zinc-700'
                  }`}>
                    {i.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {currentData.length === 0 && (
          <div className="p-12 text-center text-zinc-400 italic">No results found matching your criteria.</div>
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between border-t border-zinc-100 pt-6">
          <div className="text-xs text-zinc-500">
            Showing <span className="font-bold text-zinc-900">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-bold text-zinc-900">{Math.min(currentPage * itemsPerPage, currentData.length)}</span> of <span className="font-bold text-zinc-900">{currentData.length}</span> results
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg border border-zinc-200 hover:bg-zinc-50 disabled:opacity-50 disabled:hover:bg-transparent transition-all"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                    currentPage === page ? 'bg-zinc-900 text-white' : 'hover:bg-zinc-100 text-zinc-500'
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg border border-zinc-200 hover:bg-zinc-50 disabled:opacity-50 disabled:hover:bg-transparent transition-all"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Report Detail Modal */}
      <AnimatePresence>
        {selectedReport && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
            onClick={() => setSelectedReport(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl border border-zinc-100"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-zinc-900">Report Details</h3>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  selectedReport.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : 
                  selectedReport.status === 'INVESTIGATING' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {selectedReport.status}
                </span>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold mb-1">Reporter</p>
                    <p className="text-zinc-900 font-medium">{selectedReport.phoneNumber}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold mb-1">Timestamp</p>
                    <p className="text-zinc-900 font-medium">{new Date(selectedReport.timestamp).toLocaleString()}</p>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold mb-1">Location</p>
                  <div className="flex items-center gap-2 text-zinc-900 font-medium">
                    <MapPin size={16} className="text-emerald-500" />
                    {selectedReport.location}
                  </div>
                </div>

                <div>
                  <p className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold mb-1">Description</p>
                  <p className="text-zinc-600 bg-zinc-50 p-4 rounded-2xl border border-zinc-100 text-sm leading-relaxed">
                    {selectedReport.description}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold mb-1">Update Status</p>
                  <div className="flex gap-2 mt-2">
                    {(['PENDING', 'INVESTIGATING', 'RESOLVED'] as const).map(s => (
                      <button
                        key={s}
                        onClick={() => updateReportStatus(selectedReport.id!, s)}
                        className={`flex-1 py-2 text-[10px] font-bold rounded-xl border transition-all ${
                          selectedReport.status === s 
                            ? 'bg-zinc-900 text-white border-zinc-900' 
                            : 'bg-white text-zinc-500 border-zinc-200 hover:border-zinc-300'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setSelectedReport(null)}
                className="w-full mt-8 py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 font-bold rounded-xl transition-all"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const GuideGenerator = () => {
  const [product, setProduct] = useState('');
  const [guide, setGuide] = useState('');
  const [loading, setLoading] = useState(false);

  const generateGuide = async () => {
    if (!product) return;
    setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Generate a concise micro-guide for a farmer using the following agro-input: ${product}. 
        Include: 
        1. Recommended Dosage
        2. Safety Precautions (PPE)
        3. Best Crop Stage for application
        4. Storage instructions.
        Format as clear bullet points. Keep it under 150 words.`,
      });
      setGuide(response.text || 'Failed to generate guide.');
    } catch (err) {
      console.error(err);
      setGuide('Error connecting to Gemini.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-emerald-900 text-white p-8 rounded-3xl shadow-xl w-full max-w-md">
      <div className="flex items-center gap-2 mb-6">
        <FileText size={24} className="text-emerald-400" />
        <h2 className="text-xl font-bold">AI Usage Guide</h2>
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="text-[10px] uppercase tracking-widest text-emerald-300 font-bold mb-1 block">Product Name</label>
          <input 
            type="text" 
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            placeholder="e.g. Maize Seed X-200"
            className="w-full bg-emerald-800 border border-emerald-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-400 placeholder:text-emerald-600"
          />
        </div>
        
        <button 
          onClick={generateGuide}
          disabled={loading || !product}
          className="w-full py-3 bg-emerald-400 text-emerald-950 font-bold rounded-xl hover:bg-emerald-300 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? 'Generating...' : <><Send size={18} /> Generate Guide</>}
        </button>

        {guide && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 p-4 bg-emerald-800/50 rounded-2xl border border-emerald-700 text-sm leading-relaxed whitespace-pre-wrap"
          >
            {guide}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const testConnection = async () => {
      try {
        const { getDocFromServer } = await import('firebase/firestore');
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();
    return onAuthStateChanged(auth, (u) => setUser(u));
  }, []);

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900">
      {/* Header */}
      <header className="bg-white border-b border-zinc-100 px-8 py-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white">
              <ShieldCheck size={24} />
            </div>
            <h1 className="text-xl font-bold tracking-tight">AgroInput<span className="text-emerald-500">Trust</span></h1>
          </div>
          
          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-bold text-zinc-900">{user.displayName}</p>
                  <p className="text-[10px] text-zinc-400">
                    Administrator {user.emailVerified ? '(Verified)' : '(Unverified)'}
                  </p>
                </div>
                <img src={user.photoURL || ''} className="w-8 h-8 rounded-full border border-zinc-200" referrerPolicy="no-referrer" />
                <button onClick={() => auth.signOut()} className="text-xs text-zinc-400 hover:text-zinc-600">Sign Out</button>
              </div>
            ) : (
              <button 
                onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}
                className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
              >
                Admin Login
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-12">
        {/* Hero Section */}
        <div className="mb-16 text-center max-w-2xl mx-auto">
          <h2 className="text-4xl font-bold text-zinc-900 mb-4 tracking-tight">Solving the trust bottleneck in agriculture.</h2>
          <p className="text-lg text-zinc-500">A USSD+SMS+Voice system to verify input authenticity and report counterfeit hotspots in real-time.</p>
        </div>

        {/* Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Simulator & Guide */}
          <div className="lg:col-span-4 space-y-8">
            <USSDSimulator />
            <GuideGenerator />
          </div>

          {/* Right Column: Dashboard */}
          <div className="lg:col-span-8">
            <AdminDashboard user={user} />
          </div>
        </div>

        {/* Features Section */}
        <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-8 bg-white rounded-3xl border border-zinc-100 shadow-sm">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-6">
              <Smartphone size={24} />
            </div>
            <h3 className="text-lg font-bold mb-2">USSD Verification</h3>
            <p className="text-zinc-500 text-sm leading-relaxed">Farmers verify seeds and fertilizers using simple scratch codes on any mobile device, no internet required.</p>
          </div>
          
          <div className="p-8 bg-white rounded-3xl border border-zinc-100 shadow-sm">
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-6">
              <AlertTriangle size={24} />
            </div>
            <h3 className="text-lg font-bold mb-2">Hotspot Mapping</h3>
            <p className="text-zinc-500 text-sm leading-relaxed">Crowdsourced reports of suspicious inputs create a real-time heatmap for regulators and manufacturers.</p>
          </div>

          <div className="p-8 bg-white rounded-3xl border border-zinc-100 shadow-sm">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6">
              <FileText size={24} />
            </div>
            <h3 className="text-lg font-bold mb-2">AI Usage Guides</h3>
            <p className="text-zinc-500 text-sm leading-relaxed">Gemini-powered micro-guides provide dosage, safety, and storage instructions grounded in product labels.</p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-24 border-t border-zinc-100 py-12 px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 opacity-50">
            <ShieldCheck size={20} />
            <span className="text-sm font-bold">AgroInputTrust</span>
          </div>
          <p className="text-xs text-zinc-400">© 2026 AgroInputTrust. Built for trust and quality control.</p>
          <div className="flex gap-6 text-xs text-zinc-400">
            <a href="#" className="hover:text-zinc-600 transition-colors">Documentation</a>
            <a href="#" className="hover:text-zinc-600 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-zinc-600 transition-colors">Contact Support</a>
          </div>
        </div>
      </footer>
    </div>
    </ErrorBoundary>
  );
}

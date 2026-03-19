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
  MoreHorizontal,
  Trophy,
  Medal,
  Languages,
  TrendingUp,
  Wallet,
  MessageSquare,
  PhoneCall,
  Volume2
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
  getDoc,
  setDoc,
  updateDoc,
  increment,
  Timestamp,
  limit
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider, 
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { db, auth } from './firebase';
import { AgroInput, VerificationLog, CounterfeitReport, FarmerProfile } from './types';
import { GoogleGenAI } from "@google/genai";
import { translations, Language } from './translations';
import { ethers } from 'ethers';

declare global {
  interface Window {
    ethereum?: any;
  }
}

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

const USSDSimulator = ({ lang, setLang }: { lang: Language, setLang: (l: Language) => void }) => {
  const [text, setText] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [response, setResponse] = useState('');
  const [isSessionActive, setIsSessionActive] = useState(false);
  const phoneNumber = '+254700000000'; // Simulated phone number

  const t = translations[lang];

  useEffect(() => {
    setResponse(`${t.welcome}\n${t.menu.verify}\n${t.menu.report}\n${t.menu.guide}\n${t.menu.leaderboard}\n${t.menu.language}`);
  }, [lang, t]);

  const awardPoints = async (points: number, isVerification: boolean = true) => {
    try {
      const profileRef = doc(db, 'profiles', phoneNumber);
      const profileSnap = await getDoc(profileRef);
      
      let badges: string[] = [];
      let currentPoints = 0;
      let currentCount = 0;

      if (profileSnap.exists()) {
        const data = profileSnap.data() as FarmerProfile;
        badges = data.badges || [];
        currentPoints = data.points || 0;
        currentCount = data.verificationCount || 0;
      }

      const newCount = currentCount + (isVerification ? 1 : 0);
      const totalPoints = currentPoints + points;
      
      const newBadges = [...badges];
      if (newCount >= 1 && !newBadges.includes('First Verification')) newBadges.push('First Verification');
      if (newCount >= 10 && !newBadges.includes('Trusted Farmer')) newBadges.push('Trusted Farmer');
      if (totalPoints >= 100 && !newBadges.includes('Elite Guardian')) newBadges.push('Elite Guardian');

      const updateData: any = {
        phoneNumber,
        points: increment(points),
        verificationCount: increment(isVerification ? 1 : 0),
        region: profileSnap.exists() ? (profileSnap.data() as FarmerProfile).region : 'Central Rift'
      };

      if (newBadges.length > badges.length) {
        updateData.badges = newBadges;
      }

      await setDoc(profileRef, updateData, { merge: true });
      return newBadges.length > badges.length ? newBadges[newBadges.length - 1] : null;
    } catch (error) {
      console.error('Points error:', error);
    }
    return null;
  };

  const handleSend = async (input: string) => {
    if (!input.trim()) return;
    
    // Language selection logic
    if (text === '5') {
      if (input === '1') setLang('en');
      else if (input === '2') setLang('sw');
      reset();
      return;
    }

    const newText = text ? `${text}*${input}` : input;
    
    // Mocking USSD logic for gamification feedback
    // In a real app, the backend /api/ussd would handle this and return the message
    // Here we simulate the points feedback
    
    const res = await fetch('/api/ussd', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'sim-123',
        serviceCode: '*384#',
        phoneNumber,
        text: newText,
        lang // Pass language to backend
      })
    });
    let data = await res.text();

    // Simulate points awarding on success
    if (data.includes('VERIFIED') || data.includes('IMEHAKIKISHWA')) {
      const badge = await awardPoints(10);
      if (badge) data += `\n${t.results.badgeEarned.replace('{badge}', badge)}`;
      
      // Extract product name from response if possible
      const productMatch = data.match(/Product: (.*)\n/i) || data.match(/Bidhaa: (.*)\n/i);
      const productName = productMatch ? productMatch[1] : 'Premium Maize Seed';
      
      window.dispatchEvent(new CustomEvent('demo-sms', { detail: { 
        text: `Receipt: Product ${productName} is VERIFIED.\nTxn ID: TRK-${Math.floor(Math.random()*10000)}` 
      }}));
    } else if (data.includes('SUSPICIOUS') || data.includes('SHAKA') || data.includes('USED') || data.includes('IMETUMIKA')) {
      const isSuspicious = data.includes('SUSPICIOUS') || data.includes('SHAKA');
      const badge = await awardPoints(isSuspicious ? 5 : 2);
      if (badge) data += `\n${t.results.badgeEarned.replace('{badge}', badge)}`;

      const productMatch = data.match(/Product: (.*)\n/i) || data.match(/Bidhaa: (.*)\n/i);
      const productName = productMatch ? productMatch[1] : 'Unknown Product';
      const status = isSuspicious ? 'is SUSPICIOUS' : 'has already been USED';

      window.dispatchEvent(new CustomEvent('demo-sms', { detail: { 
        text: `Alert: Product ${productName} ${status}. Do not use!\nCase ID: ${Math.random().toString(36).substring(7).toUpperCase()}` 
      }}));
    } else if (data.includes('Thank you') || data.includes('Asante')) {
      const badge = await awardPoints(20, false);
      if (badge) data += `\n${t.results.badgeEarned.replace('{badge}', badge)}`;
    }
    
    if (data.includes('Case ID:')) {
      const caseIdMatch = data.match(/Case ID: (\w+)/);
      if (caseIdMatch) {
         window.dispatchEvent(new CustomEvent('demo-sms', { detail: { 
            text: `Alert: Report ${caseIdMatch[1].slice(0,6)}... received. Authorities notified.` 
         }}));
      }
    }
    
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
    setResponse(`${t.welcome}\n${t.menu.verify}\n${t.menu.report}\n${t.menu.guide}\n${t.menu.leaderboard}\n${t.menu.language}`);
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
        <div className="whitespace-pre-wrap break-words text-emerald-400">{response}</div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <input 
          type="text" 
          placeholder="Enter option..."
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSend((e.target as HTMLInputElement).value);
              (e.target as HTMLInputElement).value = '';
            }
          }}
        />
        <button 
          onClick={reset}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors text-sm whitespace-nowrap"
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

const Leaderboard = ({ lang }: { lang: Language }) => {
  const [profiles, setProfiles] = useState<FarmerProfile[]>([]);
  const t = translations[lang].dashboard;

  useEffect(() => {
    const q = query(collection(db, 'profiles'), orderBy('points', 'desc'), limit(5));
    const unsub = onSnapshot(q, (s) => {
      setProfiles(s.docs.map(d => ({ id: d.id, ...d.data() } as FarmerProfile)));
    });
    return unsub;
  }, []);

  return (
    <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm p-6">
      <div className="flex items-center gap-2 mb-6">
        <Trophy size={20} className="text-amber-500" />
        <h3 className="font-bold text-zinc-900">{t.topFarmers}</h3>
      </div>
      <div className="space-y-4">
        {profiles.map((p, i) => (
          <div key={p.id} className="flex items-center justify-between p-3 bg-zinc-50 rounded-2xl border border-zinc-100">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                i === 0 ? 'bg-amber-100 text-amber-700' : 
                i === 1 ? 'bg-zinc-200 text-zinc-700' : 
                i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-zinc-100 text-zinc-500'
              }`}>
                {i + 1}
              </div>
              <div>
                <p className="text-sm font-bold text-zinc-900">{p.phoneNumber.slice(0, 6)}...{p.phoneNumber.slice(-3)}</p>
                <p className="text-[10px] text-zinc-400 uppercase tracking-wider">{p.region}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-emerald-600">{p.points} pts</p>
              <div className="flex gap-1 mt-1">
                {p.badges?.slice(0, 2).map((b, bi) => (
                  <div key={bi} title={b} className="w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center">
                    <Medal size={10} className="text-amber-900" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
        {profiles.length === 0 && (
          <div className="text-center py-8 text-zinc-400 text-sm italic">No data yet. Start verifying!</div>
        )}
      </div>
    </div>
  );
};

const AdminDashboard = ({ user, lang }: { user: User | null, lang: Language }) => {
  const [inputs, setInputs] = useState<AgroInput[]>([]);
  const [verifications, setVerifications] = useState<VerificationLog[]>([]);
  const [reports, setReports] = useState<CounterfeitReport[]>([]);
  const [profiles, setProfiles] = useState<FarmerProfile[]>([]);
  const [activeTab, setActiveTab] = useState<'verifications' | 'reports' | 'inventory' | 'leaderboard'>('verifications');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReport, setSelectedReport] = useState<CounterfeitReport | null>(null);
  const [triggeringVoice, setTriggeringVoice] = useState(false);
  const itemsPerPage = 5;

  const t = translations[lang].dashboard;

  useEffect(() => {
    if (!user) return;

    const qInputs = query(collection(db, 'inputs'));
    const qVerifications = query(collection(db, 'verifications'), orderBy('timestamp', 'desc'));
    const qReports = query(collection(db, 'reports'), orderBy('timestamp', 'desc'));
    const qProfiles = query(collection(db, 'profiles'), orderBy('points', 'desc'));

    const unsubInputs = onSnapshot(qInputs, (s) => setInputs(s.docs.map(d => ({ id: d.id, ...d.data() } as AgroInput))), (e) => handleFirestoreError(e, OperationType.LIST, 'inputs'));
    const unsubVerifications = onSnapshot(qVerifications, (s) => setVerifications(s.docs.map(d => ({ id: d.id, ...d.data() } as VerificationLog))), (e) => handleFirestoreError(e, OperationType.LIST, 'verifications'));
    const unsubReports = onSnapshot(qReports, (s) => setReports(s.docs.map(d => ({ id: d.id, ...d.data() } as CounterfeitReport))), (e) => handleFirestoreError(e, OperationType.LIST, 'reports'));
    const unsubProfiles = onSnapshot(qProfiles, (s) => setProfiles(s.docs.map(d => ({ id: d.id, ...d.data() } as FarmerProfile))), (e) => handleFirestoreError(e, OperationType.LIST, 'profiles'));

    return () => { unsubInputs(); unsubVerifications(); unsubReports(); unsubProfiles(); };
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
      case 'leaderboard': data = profiles; break;
    }

    if (!searchTerm) return data;

    const term = searchTerm.toLowerCase();
    return data.filter(item => {
      if ('code' in item && item.code.toLowerCase().includes(term)) return true;
      if ('product' in item && item.product.toLowerCase().includes(term)) return true;
      if ('phoneNumber' in item && item.phoneNumber.toLowerCase().includes(term)) return true;
      if ('location' in item && item.location.toLowerCase().includes(term)) return true;
      if ('region' in item && item.region.toLowerCase().includes(term)) return true;
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
      { code: '111111', product: 'Premium Maize Seed', manufacturer: 'AgroCorp', status: 'VERIFIED', expiryDate: '2027-12-31' },
      { code: '222222', product: 'Generic Fertilizer 50kg', manufacturer: 'Unknown Fake Co.', status: 'USED', expiryDate: '2024-01-01' },
    ];
    const { writeBatch } = await import('firebase/firestore');
    const batch = writeBatch(db);
    try {
      for (const item of demoInputs) {
        batch.set(doc(db, 'inputs', item.code), item);
      }
      await batch.commit();
      alert('Demo data seeded!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'inputs');
    }
  };

  if (!user) return (
    <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl shadow-sm border border-zinc-100">
      <ShieldCheck size={48} className="text-emerald-500 mb-4" />
      <h2 className="text-2xl font-bold text-zinc-900 mb-2">{t.adminDashboard}</h2>
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
            <h2 className="text-xl font-bold text-zinc-900">{t.adminDashboard}</h2>
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
          {(['verifications', 'reports', 'inventory', 'leaderboard'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              {tab === 'leaderboard' ? t.leaderboard : tab.charAt(0).toUpperCase() + tab.slice(1)}
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

      <div className="overflow-x-auto border border-zinc-100 rounded-2xl">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-500 font-medium border-bottom border-zinc-100">
            {activeTab === 'verifications' && (
              <tr>
                <th className="px-6 py-4">{t.tableHeaders.code}</th>
                <th className="px-6 py-4">{t.tableHeaders.phone}</th>
                <th className="px-6 py-4">{t.tableHeaders.result}</th>
                <th className="px-6 py-4">{t.tableHeaders.time}</th>
              </tr>
            )}
            {activeTab === 'reports' && (
              <tr>
                <th className="px-6 py-4">{t.tableHeaders.reporter}</th>
                <th className="px-6 py-4">{t.tableHeaders.location}</th>
                <th className="px-6 py-4">{t.tableHeaders.status}</th>
                <th className="px-6 py-4 text-right">{t.tableHeaders.actions}</th>
              </tr>
            )}
            {activeTab === 'inventory' && (
              <tr>
                <th className="px-6 py-4">{t.tableHeaders.code}</th>
                <th className="px-6 py-4">{t.tableHeaders.product}</th>
                <th className="px-6 py-4">{t.tableHeaders.manufacturer}</th>
                <th className="px-6 py-4">{t.tableHeaders.status}</th>
              </tr>
            )}
            {activeTab === 'leaderboard' && (
              <tr>
                <th className="px-6 py-4">{t.tableHeaders.farmer}</th>
                <th className="px-6 py-4">{t.tableHeaders.region}</th>
                <th className="px-6 py-4">{t.tableHeaders.points}</th>
                <th className="px-6 py-4">{t.tableHeaders.badges}</th>
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
            {activeTab === 'leaderboard' && (paginatedData as FarmerProfile[]).map((p) => (
              <tr key={p.id} className="hover:bg-zinc-50 transition-colors">
                <td className="px-6 py-4 text-zinc-900 font-medium">{p.phoneNumber}</td>
                <td className="px-6 py-4 text-zinc-500">{p.region}</td>
                <td className="px-6 py-4 font-bold text-emerald-600">{p.points}</td>
                <td className="px-6 py-4">
                  <div className="flex gap-1">
                    {p.badges?.map((b, bi) => (
                      <span key={bi} className="px-2 py-1 bg-amber-100 text-amber-700 rounded-md text-[10px] font-bold">
                        {b}
                      </span>
                    ))}
                  </div>
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

              <div className="mt-6 pt-6 border-t border-zinc-100 flex flex-col gap-3">
                <p className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold mb-1">Escalation</p>
                  <button 
                    onClick={() => {
                      setTriggeringVoice(true);
                      setTimeout(() => {
                        window.dispatchEvent(new CustomEvent('demo-sms', { detail: { 
                          text: `Voice API: Conf call initiated for Report ${selectedReport.id?.slice(0,6)}... Connect to Farmer & Regulator.` 
                        }}));
                        setTriggeringVoice(false);
                      }, 1000);
                    }}
                    disabled={triggeringVoice}
                    className={`flex-1 py-3 font-bold rounded-xl border transition-all flex items-center justify-center gap-2 ${
                      triggeringVoice 
                        ? 'bg-zinc-100 text-zinc-400 border-zinc-200' 
                        : 'bg-red-50 text-red-600 border-red-100 hover:bg-red-100'
                    }`}
                  >
                    {triggeringVoice ? (
                       <>
                         <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                         Connecting...
                       </>
                    ) : (
                      <><PhoneCall size={18} /> Trigger Voice Protocol</>
                    )}
                  </button>
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

const SMSInbox = () => {
  const [messages, setMessages] = useState<{id: number, text: string, time: string}[]>([]);

  useEffect(() => {
    const handleSms = (e: Event) => {
      const customEvent = e as CustomEvent;
      setMessages(prev => [{
        id: Date.now(),
        text: customEvent.detail.text,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      }, ...prev].slice(0, 5));
    };
    window.addEventListener('demo-sms', handleSms);
    return () => window.removeEventListener('demo-sms', handleSms);
  }, []);

  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-zinc-100 max-w-md w-full">
      <div className="flex items-center gap-2 mb-4 text-zinc-900 font-bold">
        <MessageSquare size={20} className="text-blue-500" />
        <h2>SMS Receipts & Alerts</h2>
      </div>
      <div className="space-y-3 min-h-[150px]">
        <AnimatePresence>
          {messages.length === 0 ? (
            <motion.p initial={{opacity: 0}} animate={{opacity: 1}} className="text-sm text-zinc-400 italic py-4 text-center">
              Waiting for incoming messages...
            </motion.p>
          ) : (
            messages.map(m => (
              <motion.div 
                key={m.id}
                initial={{ opacity: 0, x: -20, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                className="bg-blue-50 p-3 rounded-2xl border border-blue-100"
              >
                <p className="text-xs text-blue-900 font-medium whitespace-pre-wrap leading-relaxed">{m.text}</p>
                <div className="mt-2 text-[10px] text-blue-400 font-bold text-right">{m.time}</div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const GuideGenerator = ({ lang }: { lang: Language }) => {
  const [product, setProduct] = useState('');
  const [guide, setGuide] = useState('');
  const [loading, setLoading] = useState(false);

  const t = translations[lang].dashboard;

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
        Format as clear bullet points. Keep it under 150 words.
        Output the guide in ${lang === 'en' ? 'English' : 'Swahili'}.`,
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
        <h2 className="text-xl font-bold">{t.aiGuideTitle}</h2>
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
          {loading ? 'Generating...' : <><Send size={18} /> {t.generateGuide}</>}
        </button>

        {guide && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 p-4 bg-emerald-800/50 rounded-2xl border border-emerald-700 text-sm leading-relaxed whitespace-pre-wrap"
          >
            <h4 className="text-[10px] font-bold text-emerald-300 uppercase tracking-widest mb-2">{t.usageGuide}</h4>
            {guide}
          </motion.div>
        )}
      </div>
    </div>
  );
};

// --- Legal Modal Component ---

const LegalModal = ({ 
  isOpen, 
  onClose, 
  type 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  type: 'docs' | 'privacy' | 'contact' 
}) => {
  if (!isOpen) return null;

  const content = {
    docs: {
      title: "Documentation",
      body: (
        <div className="space-y-4">
          <section>
            <h4 className="font-bold text-zinc-900">Overview</h4>
            <p className="text-sm text-zinc-600">AgroInputTrust is a decentralized verification platform designed to eliminate counterfeit agro-inputs from the supply chain. We empower farmers with simple tools to verify seeds, fertilizers, and pesticides.</p>
          </section>
          <section>
            <h4 className="font-bold text-zinc-900">How to Verify</h4>
            <p className="text-sm text-zinc-600">1. Locate the scratch panel on your product packaging.<br/>2. Scratch to reveal the unique 12-digit code.<br/>3. Dial *384# (or use our simulator) and enter the code.<br/>4. Receive instant verification of authenticity.</p>
          </section>
          <section>
            <h4 className="font-bold text-zinc-900">Reporting Counterfeits</h4>
            <p className="text-sm text-zinc-600">If a product is flagged as suspicious, you can submit a report including the market location and photos. This data helps regulators track and shut down counterfeit operations.</p>
          </section>
          <section>
            <h4 className="font-bold text-zinc-900">Rewards System</h4>
            <p className="text-sm text-zinc-600">Earn 10 points for every valid verification and 20 points for reporting suspicious items. Points can be redeemed for agricultural insurance discounts and premium advice.</p>
          </section>
        </div>
      )
    },
    privacy: {
      title: "Privacy Policy",
      body: (
        <div className="space-y-4">
          <section>
            <h4 className="font-bold text-zinc-900">Data Collection</h4>
            <p className="text-sm text-zinc-600">We collect your phone number for session management and point tracking. When reporting, we may collect location data to map counterfeit hotspots.</p>
          </section>
          <section>
            <h4 className="font-bold text-zinc-900">Data Usage</h4>
            <p className="text-sm text-zinc-600">Your data is used strictly for verification services, reward distribution, and improving agricultural safety. We do not sell your personal information to third parties.</p>
          </section>
          <section>
            <h4 className="font-bold text-zinc-900">Security</h4>
            <p className="text-sm text-zinc-600">All verification data is stored securely on our decentralized ledger and encrypted Firestore database. We use industry-standard protocols to prevent unauthorized access.</p>
          </section>
          <section>
            <h4 className="font-bold text-zinc-900">Your Rights</h4>
            <p className="text-sm text-zinc-600">You can request a summary of your verification history or deletion of your profile at any time by contacting our support team.</p>
          </section>
        </div>
      )
    },
    contact: {
      title: "Contact Support",
      body: (
        <div className="space-y-6">
          <p className="text-sm text-zinc-600">Our support team is available 24/7 to help you with verification issues or reporting counterfeits.</p>
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
              <Smartphone className="text-emerald-500" size={20} />
              <div>
                <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Phone</p>
                <p className="text-sm font-medium text-zinc-900">08161656694</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
              <FileText className="text-emerald-500" size={20} />
              <div>
                <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Email</p>
                <p className="text-sm font-medium text-zinc-900">infoclimatovate@gmail.com</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
              <ShieldCheck className="text-emerald-500" size={20} />
              <div>
                <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Social</p>
                <p className="text-sm font-medium text-zinc-900">@climatovateLTD</p>
              </div>
            </div>
          </div>
        </div>
      )
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="px-8 py-6 border-b border-zinc-100 flex items-center justify-between">
          <h3 className="text-xl font-bold text-zinc-900">{content[type].title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-xl transition-colors">
            <XCircle size={20} className="text-zinc-400" />
          </button>
        </div>
        <div className="p-8 max-h-[70vh] overflow-y-auto">
          {content[type].body}
        </div>
        <div className="px-8 py-6 bg-zinc-50 border-t border-zinc-100 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 transition-all"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);
  const [lang, setLang] = useState<Language>('en');
  const [legalModal, setLegalModal] = useState<{ isOpen: boolean; type: 'docs' | 'privacy' | 'contact' }>({
    isOpen: false,
    type: 'docs'
  });
  const [adminLoginLoading, setAdminLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<{message: string, code: string} | null>(null);

  const t = translations[lang].dashboard;

  const connectWallet = async () => {
    if (typeof window.ethereum !== 'undefined') {
      setIsConnectingWallet(true);
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);
        setWalletAddress(accounts[0]);
      } catch (error: any) {
        console.error("Failed to connect to MetaMask:", error);
        if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
          // User rejected the request - no need for a loud alert, just log it or show a subtle toast
          console.log("User rejected the connection request.");
        } else {
          alert("Failed to connect to MetaMask. Please try again.");
        }
      } finally {
        setIsConnectingWallet(false);
      }
    } else {
      alert("MetaMask is not installed. Please install it to use this feature.");
    }
  };

  const handleAdminLogin = async (useRedirect = false) => {
    setAdminLoginLoading(true);
    setLoginError(null);
    console.log(`Starting Admin Login (${useRedirect ? 'Redirect' : 'Popup'})...`);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      
      if (useRedirect) {
        await signInWithRedirect(auth, provider);
      } else {
        await signInWithPopup(auth, provider);
      }
    } catch (error: any) {
      console.error("Admin Login Error:", {
        code: error.code,
        message: error.message,
        stack: error.stack
      });
      
      let message = "Failed to sign in. Please try again.";
      if (error.code === 'auth/popup-closed-by-user') message = "Login cancelled.";
      else if (error.code === 'auth/cancelled-popup-request') message = "Previous request cancelled.";
      else if (error.code === 'auth/network-request-failed') message = "Network error. Check your connection.";
      else if (error.code === 'auth/unauthorized-domain') message = "Domain not authorized in Firebase Console.";
      
      setLoginError({ message, code: error.code });
    } finally {
      // If we used redirect, the page will unload, so we won't hit 'finally' here in the same instance
      if (!useRedirect) setAdminLoginLoading(false);
    }
  };

  useEffect(() => {
    // Handle redirect result on mount
    const checkRedirect = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result) {
          console.log("Redirect login successful:", result.user.email);
        }
      } catch (error: any) {
        console.error("Redirect Result Error:", error);
        setLoginError({ message: "Login failed via redirect.", code: error.code });
      }
    };
    checkRedirect();

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
      <header className="bg-white border-b border-zinc-100 px-4 sm:px-8 py-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white">
              <ShieldCheck size={20} className="sm:size-24" />
            </div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight">AgroInput<span className="text-emerald-500">Trust</span></h1>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <button 
              onClick={() => setLang(lang === 'en' ? 'sw' : 'en')}
              className="flex items-center gap-2 px-2 sm:px-3 py-1.5 bg-zinc-100 rounded-xl border border-zinc-200 text-[10px] sm:text-xs font-medium hover:bg-zinc-200 transition-all"
            >
              <Languages size={12} className="text-emerald-500" />
              <span className="hidden xs:inline">{lang === 'en' ? 'Kiswahili' : 'English'}</span>
              <span className="xs:hidden">{lang === 'en' ? 'SW' : 'EN'}</span>
            </button>

            {walletAddress ? (
              <div className="flex items-center gap-2 px-2 sm:px-3 py-1.5 bg-zinc-100 rounded-xl border border-zinc-200">
                <Wallet size={12} className="text-emerald-500" />
                <span className="text-[10px] sm:text-xs font-mono text-zinc-600">
                  {walletAddress.slice(0, 4)}...{walletAddress.slice(-4)}
                </span>
              </div>
            ) : (
              <button 
                onClick={connectWallet}
                disabled={isConnectingWallet}
                className="flex items-center gap-2 px-2 sm:px-3 py-1.5 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-all text-[10px] sm:text-xs font-medium whitespace-nowrap"
              >
                <Wallet size={12} />
                {isConnectingWallet ? t.connecting.split(' ')[0] : t.connectWallet.split(' ')[0]}
              </button>
            )}

            {user ? (
              <div className="flex items-center gap-2 sm:gap-3">
                <img src={user.photoURL || ''} className="w-6 h-6 sm:w-8 sm:h-8 rounded-full border border-zinc-200" referrerPolicy="no-referrer" />
                <button onClick={() => auth.signOut()} className="text-[10px] sm:text-xs text-red-500 hover:text-red-600 font-bold">{t.signOut}</button>
              </div>
            ) : (
              <div className="flex flex-col items-end">
                <button 
                  onClick={() => handleAdminLogin(false)}
                  disabled={adminLoginLoading}
                  className={`text-[10px] sm:text-sm font-medium hover:text-zinc-900 bg-zinc-100 px-2 sm:px-4 py-1.5 rounded-xl border border-zinc-200 transition-all ${
                    adminLoginLoading ? 'opacity-50 cursor-wait' : 'text-zinc-600'
                  }`}
                >
                  {adminLoginLoading ? 'Starting...' : t.adminLogin}
                </button>
                {loginError && (
                  <div className="flex flex-col items-end mt-1">
                    <span className="text-[8px] text-red-500 font-bold uppercase tracking-tight">Error: {loginError.code}</span>
                    <span className="text-[8px] text-red-500 font-medium">{loginError.message}</span>
                    <button 
                      onClick={() => handleAdminLogin(true)}
                      className="text-[8px] text-emerald-600 hover:text-emerald-700 font-bold mt-1 underline"
                    >
                      Try Redirect Login (Use this if popup fails)
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
        {/* Hero Section */}
        <div className="mb-12 sm:mb-16 text-center max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-zinc-900 mb-4 tracking-tight leading-tight">{t.heroTitle}</h2>
          <p className="text-base sm:text-lg text-zinc-500">{t.heroSubtitle}</p>
        </div>

        {/* Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
          {/* Left Column: Simulator & Guide */}
          <div className="lg:col-span-4 space-y-6 sm:space-y-8">
            <USSDSimulator lang={lang} setLang={setLang} />
            <SMSInbox />
            <Leaderboard lang={lang} />
            <GuideGenerator lang={lang} />
          </div>

          {/* Right Column: Dashboard */}
          <div className="lg:col-span-8">
            <AdminDashboard user={user} lang={lang} />
          </div>
        </div>

        {/* Features Section */}
        <div className="mt-16 sm:mt-24 grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          <div className="p-6 sm:p-8 bg-white rounded-3xl border border-zinc-100 shadow-sm">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-6">
              <Smartphone size={24} />
            </div>
            <h3 className="text-lg font-bold mb-2">{t.ussdTitle}</h3>
            <p className="text-zinc-500 text-sm leading-relaxed">{t.ussdDesc}</p>
          </div>
          
          <div className="p-6 sm:p-8 bg-white rounded-3xl border border-zinc-100 shadow-sm">
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-6">
              <AlertTriangle size={24} />
            </div>
            <h3 className="text-lg font-bold mb-2">{t.hotspotTitle}</h3>
            <p className="text-zinc-500 text-sm leading-relaxed">{t.hotspotDesc}</p>
          </div>

          <div className="p-6 sm:p-8 bg-white rounded-3xl border border-zinc-100 shadow-sm">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6">
              <FileText size={24} />
            </div>
            <h3 className="text-lg font-bold mb-2">{t.aiGuideTitle}</h3>
            <p className="text-zinc-500 text-sm leading-relaxed">{t.aiGuideDesc}</p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-16 sm:mt-24 border-t border-zinc-100 py-12 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-col items-center md:items-start gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-white">
                <ShieldCheck size={18} />
              </div>
              <span className="text-sm font-bold tracking-tight">AgroInputTrust</span>
            </div>
            <p className="text-xs text-zinc-400 max-w-[200px] text-center md:text-left">
              Securing the agricultural supply chain through decentralized verification.
            </p>
          </div>

          <div className="flex flex-col items-center gap-4">
            <p className="text-xs text-zinc-400">© 2026 AgroInputTrust. All rights reserved.</p>
            <div className="flex flex-wrap justify-center gap-4 sm:gap-6 text-[10px] sm:text-xs font-bold text-zinc-400 uppercase tracking-widest">
              <button 
                onClick={() => setLegalModal({ isOpen: true, type: 'docs' })}
                className="hover:text-emerald-500 transition-colors"
              >
                Documentation
              </button>
              <button 
                onClick={() => setLegalModal({ isOpen: true, type: 'privacy' })}
                className="hover:text-emerald-500 transition-colors"
              >
                Privacy Policy
              </button>
              <button 
                onClick={() => setLegalModal({ isOpen: true, type: 'contact' })}
                className="hover:text-emerald-500 transition-colors"
              >
                Contact Support
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden lg:block">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Support</p>
              <p className="text-xs font-medium text-zinc-900">infoclimatovate@gmail.com</p>
            </div>
            <div className="w-10 h-10 bg-zinc-100 rounded-xl flex items-center justify-center text-zinc-400">
              <Smartphone size={20} />
            </div>
          </div>
        </div>
      </footer>

      <AnimatePresence>
        {legalModal.isOpen && (
          <LegalModal 
            isOpen={legalModal.isOpen} 
            type={legalModal.type} 
            onClose={() => setLegalModal({ ...legalModal, isOpen: false })} 
          />
        )}
      </AnimatePresence>
    </div>
    </ErrorBoundary>
  );
}

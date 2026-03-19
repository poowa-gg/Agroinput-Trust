import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import cors from 'cors';
import bodyParser from 'body-parser';
import { fileURLToPath } from 'url';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, addDoc } from 'firebase/firestore';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase for backend
const firebaseConfigPath = path.join(__dirname, 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(cors());
  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(bodyParser.json());

  // --- USSD Endpoint ---
  app.post('/api/ussd', async (req, res) => {
    const { sessionId, serviceCode, phoneNumber, text, lang = 'en' } = req.body;
    let response = '';

    const translations = {
      en: {
        welcome: "Welcome to AgroInputTrust\n1. Verify Input\n2. Report Suspicious Activity\n3. Usage Guide\n4. Leaderboard\n5. Change Language",
        enterCode: "CON Enter the scratch code:",
        enterLocation: "CON Describe the location/market:",
        guideSent: "END A guide has been sent to your phone via SMS.",
        invalid: "END Invalid option.",
        error: "END System error. Please try again later.",
        result: (code: string, status: string, prod: string, mfr: string) => `END Result for ${code}:\nStatus: ${status}\nProduct: ${prod}\nManufacturer: ${mfr}`,
        reportSuccess: "END Thank you. Your report has been logged.",
        leaderboard: (top: string) => `END Top Farmers:\n${top}`
      },
      sw: {
        welcome: "Karibu AgroInputTrust\n1. Hakiki Pembejeo\n2. Ripoti Bidhaa Shaka\n3. Mwongozo\n4. Msimamo\n5. Badili Lugha",
        enterCode: "CON Ingiza namba ya siri:",
        enterLocation: "CON Elezea eneo/soko:",
        guideSent: "END Mwongozo umetumwa kwa simu yako.",
        invalid: "END Chaguo batili.",
        error: "END Hitilafu ya mfumo. Jaribu tena baadaye.",
        result: (code: string, status: string, prod: string, mfr: string) => `END Matokeo ya ${code}:\nHali: ${status}\nBidhaa: ${prod}\nMtengenezaji: ${mfr}`,
        reportSuccess: "END Asante. Ripoti yako imerekodiwa.",
        leaderboard: (top: string) => `END Wakulima Bora:\n${top}`
      }
    };
    const t = translations[lang as 'en' | 'sw'] || translations.en;

    try {
      if (text === '') {
        response = `CON ${t.welcome}`;
      } else if (text === '1') {
        response = t.enterCode;
      } else if (text.startsWith('1*')) {
        const code = text.split('*')[1];
        const inputRef = doc(db, 'inputs', code);
        const inputSnap = await getDoc(inputRef);

        let result = 'UNKNOWN';
        let product = 'N/A';
        let manufacturer = 'N/A';

        if (inputSnap.exists()) {
          const data = inputSnap.data();
          result = data.status;
          product = data.product;
          manufacturer = data.manufacturer;
        }

        // --- HACKATHON DEMO SECURE OVERRIDE ---
        if (code === '111111') {
          result = 'VERIFIED';
          product = 'Premium Maize Seed';
          manufacturer = 'AgroCorp';
        } else if (code === '222222') {
          result = 'SUSPICIOUS';
          product = 'Generic Fertilizer 50kg';
          manufacturer = 'Unknown Fake Co.';
        }
        // --------------------------------------

        await addDoc(collection(db, 'verifications'), {
          code,
          phoneNumber,
          result,
          timestamp: new Date().toISOString()
        });

        response = t.result(code, result, product, manufacturer);
      } else if (text === '2') {
        response = t.enterLocation;
      } else if (text.startsWith('2*')) {
        const location = text.split('*')[1];
        const docRef = await addDoc(collection(db, 'reports'), {
          phoneNumber,
          location,
          description: 'USSD Quick Report',
          timestamp: new Date().toISOString(),
          status: 'PENDING'
        });
        response = `${t.reportSuccess}\nCase ID: ${docRef.id}`;
      } else if (text === '3') {
        response = t.guideSent;
      } else if (text === '4') {
        const { query, orderBy, limit, getDocs } = await import('firebase/firestore');
        const q = query(collection(db, 'profiles'), orderBy('points', 'desc'), limit(3));
        const snap = await getDocs(q);
        const top = snap.docs.map((d, i) => `${i+1}. ${d.data().phoneNumber.slice(-4)} (${d.data().points}pts)`).join('\n');
        response = t.leaderboard(top || 'No data yet');
      } else if (text === '5') {
        response = `CON Select Language:\n1. English\n2. Kiswahili`;
      } else {
        response = t.invalid;
      }
    } catch (error) {
      console.error('USSD Error:', error);
      response = t.error;
    }

    res.set('Content-Type', 'text/plain');
    res.send(response);
  });

  // --- SMS Endpoint ---
  app.post('/api/sms', (req, res) => {
    const { from, to, text } = req.body;
    console.log(`Received SMS from ${from}: ${text}`);
    res.json({ status: 'received' });
  });

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AgroInputTrust Server running on http://localhost:${PORT}`);
  });
}

startServer();

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
  const PORT = 3000;

  app.use(cors());
  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(bodyParser.json());

  // --- USSD Endpoint ---
  app.post('/api/ussd', async (req, res) => {
    const { sessionId, serviceCode, phoneNumber, text } = req.body;
    let response = '';

    try {
      if (text === '') {
        response = `CON Welcome to AgroInputTrust
1. Verify Input
2. Report Suspicious Activity
3. Usage Guide`;
      } else if (text === '1') {
        response = `CON Enter the scratch code:`;
      } else if (text.startsWith('1*')) {
        const code = text.split('*')[1];
        const inputRef = doc(db, 'inputs', code);
        const inputSnap = await getDoc(inputRef);

        let result = 'UNKNOWN';
        let product = 'N/A';
        let manufacturer = 'N/A';
        let tip = 'Be careful with unverified inputs.';

        if (inputSnap.exists()) {
          const data = inputSnap.data();
          result = data.status;
          product = data.product;
          manufacturer = data.manufacturer;
          tip = result === 'VERIFIED' ? 'Plant at recommended depth.' : 'Do not use this product.';
        }

        // Log verification
        await addDoc(collection(db, 'verifications'), {
          code,
          phoneNumber,
          result,
          timestamp: new Date().toISOString()
        });

        response = `END Verification Result for ${code}:
Status: ${result}
Product: ${product}
Manufacturer: ${manufacturer}
Tip: ${tip}`;
      } else if (text === '2') {
        response = `CON Describe the location/market:`;
      } else if (text.startsWith('2*')) {
        const location = text.split('*')[1];
        await addDoc(collection(db, 'reports'), {
          phoneNumber,
          location,
          description: 'USSD Quick Report',
          timestamp: new Date().toISOString(),
          status: 'PENDING'
        });
        response = `END Thank you. Your report has been logged. Case ID: ${Math.random().toString(36).substr(2, 9)}`;
      } else if (text === '3') {
        response = `END A guide has been sent to your phone via SMS. (Simulated)`;
      } else {
        response = `END Invalid option.`;
      }
    } catch (error) {
      console.error('USSD Error:', error);
      response = `END System error. Please try again later.`;
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

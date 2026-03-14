export type Language = 'en' | 'sw';

export const translations = {
  en: {
    welcome: "Welcome to AgroInputTrust",
    menu: {
      verify: "1. Verify Input",
      report: "2. Report Suspicious Activity",
      guide: "3. Usage Guide",
      leaderboard: "4. Leaderboard",
      language: "5. Change Language"
    },
    prompts: {
      enterCode: "Enter scratch code:",
      enterLocation: "Enter market/location:",
      enterDescription: "Describe the suspicion:",
      enterPhone: "Enter phone number:",
      selectLanguage: "Select Language:\n1. English\n2. Kiswahili"
    },
    results: {
      verified: "VERIFIED: {product} by {manufacturer}. Expiry: {date}. Points earned: +10!",
      suspicious: "SUSPICIOUS: This code is flagged. Do not use! Points earned: +5 for reporting.",
      used: "USED: This code has already been verified. Points earned: +2.",
      unknown: "UNKNOWN: Code not found. Please report if suspicious.",
      reportSuccess: "Thank you. Your report has been logged. Points earned: +20!",
      badgeEarned: "CONGRATULATIONS! You earned a new badge: {badge}!"
    },
    dashboard: {
      adminLogin: "Admin Login",
      signOut: "Sign Out",
      heroTitle: "Solving the trust bottleneck in agriculture.",
      heroSubtitle: "A USSD+SMS+Voice system to verify input authenticity and report counterfeit hotspots in real-time.",
      ussdTitle: "USSD Verification",
      ussdDesc: "Farmers verify seeds and fertilizers using simple scratch codes on any mobile device, no internet required.",
      hotspotTitle: "Hotspot Mapping",
      hotspotDesc: "Crowdsourced reports of suspicious inputs create a real-time heatmap for regulators and manufacturers.",
      aiGuideTitle: "AI Usage Guides",
      aiGuideDesc: "Gemini-powered micro-guides provide dosage, safety, and storage instructions grounded in product labels.",
      connectWallet: "Connect Wallet",
      connecting: "Connecting...",
      topFarmers: "Top Trusted Farmers",
      leaderboard: "Leaderboard",
      adminDashboard: "Admin Dashboard",
      verifyInput: "Verify Input",
      reportSuspicious: "Report Suspicious Activity",
      usageGuide: "Usage Guide",
      generateGuide: "Generate Guide",
      tableHeaders: {
        code: "Code",
        phone: "Phone",
        result: "Result",
        time: "Time",
        reporter: "Reporter",
        location: "Location",
        status: "Status",
        actions: "Actions",
        product: "Product",
        manufacturer: "Manufacturer",
        farmer: "Farmer",
        region: "Region",
        points: "Points",
        badges: "Badges"
      }
    }
  },
  sw: {
    welcome: "Karibu kwenye AgroInputTrust",
    menu: {
      verify: "1. Hakiki Pembejeo",
      report: "2. Ripoti Bidhaa Shaka",
      guide: "3. Mwongozo wa Matumizi",
      leaderboard: "4. Msimamo wa Wakulima",
      language: "5. Badili Lugha"
    },
    prompts: {
      enterCode: "Ingiza namba ya siri:",
      enterLocation: "Ingiza eneo/soko:",
      enterDescription: "Elezea wasiwasi wako:",
      enterPhone: "Ingiza namba ya simu:",
      selectLanguage: "Chagua Lugha:\n1. English\n2. Kiswahili"
    },
    results: {
      verified: "IMEHAKIKISHWA: {product} kutoka {manufacturer}. Muda wa kuisha: {date}. Alama ulizopata: +10!",
      suspicious: "SHAKA: Namba hii imewekewa alama ya shaka. Usitumie! Alama ulizopata: +5 kwa kuripoti.",
      used: "IMETUMIKA: Namba hii tayari imehakikiwa. Alama ulizopata: +2.",
      unknown: "HAIJULIKANI: Namba haijapatikana. Tafadhali ripoti ikiwa una shaka.",
      reportSuccess: "Asante. Ripoti yako imerekodiwa. Alama ulizopata: +20!",
      badgeEarned: "HONGERA! Umepata nishani mpya: {badge}!"
    },
    dashboard: {
      adminLogin: "Ingia kama Admin",
      signOut: "Ondoka",
      heroTitle: "Kutatua changamoto ya uaminifu katika kilimo.",
      heroSubtitle: "Mfumo wa USSD+SMS+Sauti wa kuhakiki uhalisi wa pembejeo na kuripoti maeneo yenye bidhaa bandia kwa wakati halisi.",
      ussdTitle: "Uhakiki wa USSD",
      ussdDesc: "Wakulima wanahakiki mbegu na mbolea kwa kutumia namba za siri kwenye simu yoyote, bila kuhitaji intaneti.",
      hotspotTitle: "Ramani ya Maeneo Shaka",
      hotspotDesc: "Ripoti kutoka kwa wakulima kuhusu pembejeo shaka zinatengeneza ramani ya wakati halisi kwa wasimamizi na watengenezaji.",
      aiGuideTitle: "Miongozo ya AI",
      aiGuideDesc: "Miongozo midogo inayowezeshwa na Gemini inatoa maelekezo ya kipimo, usalama, na uhifadhi kulingana na lebo za bidhaa.",
      connectWallet: "Unganisha Wallet",
      connecting: "Inaunganisha...",
      topFarmers: "Wakulima Bora Wanaoaminika",
      leaderboard: "Msimamo",
      adminDashboard: "Dashibodi ya Admin",
      verifyInput: "Hakiki Pembejeo",
      reportSuspicious: "Ripoti Bidhaa Shaka",
      usageGuide: "Mwongozo wa Matumizi",
      generateGuide: "Tengeneza Mwongozo",
      tableHeaders: {
        code: "Nambari",
        phone: "Simu",
        result: "Matokeo",
        time: "Muda",
        reporter: "Mripoti",
        location: "Eneo",
        status: "Hali",
        actions: "Hatua",
        product: "Bidhaa",
        manufacturer: "Mtengenezaji",
        farmer: "Mkulima",
        region: "Mkoa",
        points: "Pointi",
        badges: "Beji"
      }
    }
  }
};

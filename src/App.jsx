import { useRef, useState } from 'react';
import Tesseract from 'tesseract.js';

const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();

async function findLabel(name) {
  const safe = name.replace(/["']/g, ' ').trim();
  const query = `openfda.brand_name:"${safe}" OR openfda.generic_name:"${safe}"`;
  const response = await fetch(`https://api.fda.gov/drug/label.json?search=${encodeURIComponent(query)}&limit=1`);
  if (response.status === 404) throw new Error('No matching FDA label was found. Check the name and try again.');
  if (!response.ok) throw new Error('The label service is unavailable. Please try again later.');
  const data = await response.json();
  return data.results?.[0] || null;
}

function Brand({ onClick }) {
  return <button className="brand" onClick={onClick} aria-label="MediScan home"><span className="brand-mark">+</span><b>MediScan</b></button>;
}

export default function App() {
  const fileRef = useRef(null);
  const [screen, setScreen] = useState('welcome');
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState({ name: '', age: '', phone: '', home: '' });
  const [medicine, setMedicine] = useState('');
  const [preview, setPreview] = useState('');
  const [ocr, setOcr] = useState('');
  const [label, setLabel] = useState(null);
  const [busy, setBusy] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);
  const [error, setError] = useState('');

  const firstName = profile.name.trim().split(/\s+/)[0] || 'there';
  const isMinor = profile.age && Number(profile.age) < 18;

  const reset = () => {
    if (preview) URL.revokeObjectURL(preview);
    setScreen('welcome'); setStep(1); setProfile({ name: '', age: '', phone: '', home: '' });
    setMedicine(''); setPreview(''); setOcr(''); setLabel(null); setError('');
  };

  const scanAnother = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(''); setOcr(''); setMedicine(''); setLabel(null); setError(''); setScreen('scanner');
  };

  const submitStep = (event) => {
    event.preventEvent?.();
    event.preventDefault();
    if (step === 3) setScreen('home');
    else setStep(step + 1);
  };

  const useLocation = () => {
    if (!navigator.geolocation) {
      setError('Location is not supported in this browser. Enter your city instead.');
      return;
    }
    setLocationBusy(true); setError('');
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.latitude}&lon=${coords.longitude}`);
        const data = await response.json();
        const address = data.address || {};
        setProfile((current) => ({ ...current, home: [address.suburb || address.neighbourhood || address.city_district, address.city || address.town || address.village, address.country].filter(Boolean).join(', ') || `${coords.latitude.toFixed(3)}, ${coords.longitude.toFixed(3)}` }));
      } catch {
        setError('Could not resolve the location. Enter your city or area instead.');
      } finally {
        setLocationBusy(false);
      }
    }, () => {
      setLocationBusy(false);
      setError('Location permission was not granted. Enter your city or area instead.');
    }, { timeout: 10000 });
  };

  const scanImage = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image of the medicine package.');
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file)); setOcr(''); setError(''); setBusy(true);
    try {
      const result = await Tesseract.recognize(file, 'eng');
      const text = result.data.text || '';
      setOcr(text);
      const candidate = text.split(/\n+/).map(clean).filter((line) => line.length > 2).find((line) => /[a-z]/i.test(line) && !/\b(mg|ml|tablet|capsule|batch|expiry|warning|dosage)\b/i.test(line));
      if (candidate) setMedicine(candidate.slice(0, 80));
      if (!candidate) setError('No clear medicine name was detected. Please enter it manually.');
    } catch {
      setError('Could not read the image. Try a brighter photo or enter the name manually.');
    } finally {
      setBusy(false);
    }
  };

  const lookup = async (event) => {
    event.preventDefault();
    if (!medicine.trim()) {
      setError('Enter the medicine name shown on the package.');
      return;
    }
    setBusy(true); setError(''); setLabel(null);
    try {
      const result = await findLabel(medicine.trim());
      if (!result) throw new Error('No readable label was returned.');
      setLabel(result); setScreen('results');
    } catch (lookupError) {
      setError(lookupError.message);
    } finally {
      setBusy(false);
    }
  };

  if (screen === 'welcome') {
    return <div className="shell"><header className="header"><Brand onClick={reset}/><span className="header-note">Your medicine-label helper</span></header><main className="welcome"><section className="welcome-copy"><div className="eyebrow"><i/>YOUR POCKET PHARMACIST</div><h1>Scan a medicine.<br/><em>Know it.</em> Find it near home.</h1><p>Point your camera at a strip, bottle or box to review label information and find a pharmacy nearby.</p><div className="steps-mini"><span><b>01</b> Add your details</span><span><b>02</b> Scan or enter medicine</span><span><b>03</b> Review and find help</span></div><button className="primary welcome-button" onClick={() => setScreen('onboarding')}>Get started <b>→</b></button><small className="safety-note">Educational prototype—not a doctor or dosing calculator.</small></section><aside className="hero-art"><div className="phone"><div className="phone-top">MEDISCAN <span>● ● ●</span></div><div className="scan-box"><i/><i/><i/><i/><div className="package"><small>MEDICINE</small><b>LABEL</b><span>500 mg</span></div></div><div className="mini-result"><small>LABEL FOUND</small><b>Review safely</b><span>Warnings · directions</span></div></div><div className="art-caption"><b>✓</b> Scan. Read. Understand.</div></aside></main><footer className="footer"><span>MediScan</span><span>Not a substitute for medical advice</span></footer></div>;
  }

  if (screen === 'onboarding') {
    return <div className="shell"><header className="header"><Brand onClick={reset}/><span className="header-note">A few details to get started</span></header><main className="onboarding"><div className="progress"><div className="progress-line"/><div className="progress-fill" style={{ width: `${((step - 1) / 2) * 100}%` }}/>{['Name','Phone','Home'].map((name, index) => <div className="progress-item" key={name}><span className={index + 1 <= step ? 'active' : ''}>{index + 1}</span><b>{name}</b></div>)}</div><form className="card onboarding-card" onSubmit={submitStep}>{step === 1 && <><div className="step-label">STEP 1 · LET’S GET TO KNOW YOU</div><h1>What’s your name?</h1><p>We use it to personalize your medicine-label experience.</p><label htmlFor="name">Full name</label><input id="name" className="input large" placeholder="Enter your name" autoComplete="name" value={profile.name} onChange={(event) => setProfile({...profile, name:event.target.value})} required/><label htmlFor="age">Age</label><div className="age"><input id="age" className="input large" type="number" min="1" max="120" placeholder="Age in years" value={profile.age} onChange={(event) => setProfile({...profile, age:event.target.value})} required/><span>years</span></div><small className="privacy">Age provides a child-safety reminder only. We do not calculate a dose.</small></>} {step === 2 && <><div className="step-label">STEP 2 · HI {firstName.toUpperCase()} 👋</div><h1>Your phone number</h1><p>Optional. This demo does not call, text, or send this number anywhere.</p><label htmlFor="phone">Mobile number <span>(optional)</span></label><input id="phone" className="input large" type="tel" autoComplete="tel" placeholder="Leave blank to skip" value={profile.phone} onChange={(event) => setProfile({...profile, phone:event.target.value})}/><small class="privacy">Avoid entering real personal details on a public demo.</small></>} {step === 3 && <><div className="step-label">STEP 3 · ALMOST THERE</div><h1>Where is home?</h1><p>Use a city or your current location to search for pharmacies nearby.</p><button type="button" className="primary location" onClick={useLocation} disabled={locationBusy}>⌖ {locationBusy ? 'Finding location…' : 'Use my current location'}</button><div className="or"><i/><span>or enter your city or area</span><i/></div><label htmlFor="home">City or area</label><input id="home" className="input large" placeholder="e.g. Delhi, India" value={profile.home} onChange={(event) => setProfile({...profile, home:event.target.value})} required/><small className="privacy">Location is used only to open a nearby-pharmacy search.</small>{error && <div className="error" role="alert">{error}</div>}</>}<div className="actions">{step > 1 && <button type="button" className="back" onClick={() => { setStep(step - 1); setError(''); }}>← Back</button>}<button type="submit" className="primary continue">{step === 3 ? 'Open MediScan' : 'Continue'} <b>→</b></button></div></form></main><footer className="footer"><span>MediScan</span><span>Your details stay in this page session.</span></footer></div>;
  }

  if (screen === 'home') {
    return <div className="shell"><header className="header"><Brand onClick={reset}/><button className="profile" onClick={reset}><span>{firstName[0]?.toUpper()}</span>{firstName}</button></header><main className="dashboard"><section className="dashboard-hero"><div><div className="eyebrow"><i/>YOUR POCKET PHARMACIST</div><h1>Scan a medicine.<br/><em>Know it.</em> Find it near home.</h1><p>Point your camera at a strip, bottle or box. MediScan helps you review important label information and find pharmacies near {profile.home || 'you'}.</p><button className="primary welcome-button" onClick={() => setScreen('scanner')}>Scan a medicine <b>→</b></button><button className="text-link" onClick={reset}>Not you? Start fresh</button></div><aside className="hero-art small"><div className="phone"><div className="phone-top">MEDISCAN <span>● ● ●</span></div><div className="scan-box"><i/><i/><i/><i/><div className="package"><small>MEDICINE</small><b>LABEL</b><span>500 mg</span></div></div></div></aside></section><section className="how"><article><b>1</b><span>Tell us your name and age</span></article><article><b>2</b><span>Choose or enter your location</span></article><article><b>3</b><span>Scan, review and find pharmacies</span></article></section><div className="safety-strip"><b>Safety first</b><span>Label information for review—never a personal dose recommendation.</span></div></main><footer className="footer"><span>MediScan</span><span>{profile.home || 'Location not set'}</span></footer></div>;
  }

  if (screen === 'scanner') {
    return <div className="shell"><header className="header"><Brand onClick={reset}/><div className="header-tools"><button className="profile" onClick={reset}><span>{firstName[0]?.toUpper()}</span>{firstName}</button><button className="text-link" onClick={() => setScreen('home')}>Home</button></div></header><main className="app-layout"><section className="intro"><div class="eyebrow"><i/>MEDICINE LABEL SCANNER</div><h1>Let’s scan, {firstName}.</h1><p>Photograph the package and confirm the medicine name before lookup.</p></section><section className="card scanner-card"><div className="card-heading"><div><span className="step-label">YOUR SCAN</span><h2>Scan a medicine</h2></div><span className="scan-icon">⌕</span></div><input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={(event) => scanImage(event.target.files?.[0])} hidden/><button className={`upload ${preview ? 'preview' : ''}`} onClick={() => fileRef.current?.click()}>{preview ? <img src={preview} alt="Medicine package preview"/> : <span><b>＋</b><strong>Tap to take a photo</strong><small>or choose an image</small></span>} {preview && <i>↻ Retake photo</i>}</button><p className="status"><span className={busy ? 'busy' : ''}/>{busy ? 'Reading package…' : 'Scan a package or enter the name manually.'}</p><form onSubmit={lookup}><label htmlFor="medicine">Medicine name</label><div className="search"><input id="medicine" className="input" value={medicine} onChange={(event) => setMedicine(event.target.value)} placeholder="Confirm or enter the name"/><button className="dark" disabled={busy}>{busy ? 'Checking…' : 'Look up label'}</button></div></form>{error && <div className="error" role="alert">{error}</div>}{ocr && <details className="ocr"><summary>Show detected text</summary><p>{ocr}</p></details>}</section><div className="disclaimer"><b>General information only.</b> OCR may be wrong and this cannot authenticate or diagnose a medicine.</div></main><footer className="footer"><span>MediScan</span><span>{profile.home || 'Location not set'}</span></footer></div>;
  }

  const fields = [
    ['indications_and_usage','Used for'], ['dosage_and_administration','Dosage information'],
    ['pediatric_use','Children and adolescents'], ['warnings','Warnings'],
    ['contraindications','When not to use'], ['adverse_reactions','Possible side effects'],
    ['drug_interactions','Drug interactions'], ['storage_and_handling','Storage']
  ];
  const sections = label ? fields.map(([key,title]) => ({ title, text: Array.isArray(label[key]) ? label[key].join('\n\n') : label[key] })).filter((item) => item.text) : [];
  const name = label?.openfda?.brand_name?.[0] || label?.openfda?.generic_name?.[0] || medicine;
  const pharmacy = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`pharmacy near ${profile.home || ''}`)}`;

  return <div className="shell"><header className="header"><Brand onClick={reset}/><div className="header-tools"><button className="profile"><span>{firstName[0]?.toUpper()}</span>{firstName}</button><button className="text-link" onClick={() => setScreen('scanner')}>Scanner</button></div></header><main className="app-layout"><button className="text-link back-link" onClick={() => setScreen('scanner')}>← Back to scanner</button><section className="card results-card"><div className="match"><span>Possible label match</span><b>U.S. FDA label</b></div><h1>{name}</h1>{label?.openfda?.generic_name?.[0] && <p className="generic">{label.openfda.generic_name[0]}</p>}<div className="callout">This is label information, not a personal treatment or dose recommendation. Confirm the product with its package and a pharmacist or clinician.</div>{isMinor && <div className="child-warning"><b>Child and teen safety</b><p>Do not use an adult dose. Dosing may depend on age, weight, the exact product and health. Ask a pharmacist or clinician first.</p></div>}<div className="sections">{sections.map((section) => <article className={/warn|contra/i.test(section.title) ? 'warning' : ''} key={section.title}><h2><span>{/warn|contra/i.test(section.title) ? '!' : '✓'}</span>{section.title}</h2><p>{clean(section.text).slice(0,1800)}</p></article>)}</div>{sections.length === 0 && <p>No readable label sections were included in this record. Check the package leaflet or ask a pharmacist.</p>}<small className="source">Source: U.S. FDA openFDA drug-label database. This does not authenticate the photographed product or guarantee that the data applies to a medicine sold in your country.</small></section><section className="card pharmacy"><span className="pin">⌖</span><div><span className="step-label">NEAR YOUR HOME</span><h2>Pharmacies nearby</h2><p>{profile.home || 'Search near your location'}</p><small>Open in Google Maps to confirm pharmacy details, hours and availability.</small><a className="dark" href={pharmacy} target="_blank" rel="noreferrer">Find pharmacies ↗</a></div></section><button className="primary scan-again" onClick={scanAnother}>Scan another medicine</button><div className="disclaimer"><b>Medical safety.</b> For an emergency or possible overdose, contact local emergency services or poison control.</div></main><footer className="footer"><span>MediScan</span><span>Profile used only in this page session.</span></footer></div>;
}

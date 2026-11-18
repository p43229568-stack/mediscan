# MediScan

A mobile-first medicine label scanning and pharmacy-search prototype.

## Run

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Deploy to Netlify with build command `npm run build` and publish directory `dist`.

## Features

- Three-step onboarding matching the supplied MediScan design
- Name, age, optional phone number, and home location
- Browser geolocation with a city/area fallback
- Browser camera or image upload
- In-browser OCR using Tesseract.js
- U.S. FDA openFDA label lookup
- Label sections and child-safety reminder
- Google Maps nearby-pharmacy search
- Responsive mobile and desktop presentation

## Safety

This is a general-information prototype, not a medical device or dosing tool. It may misread text or return a label that does not match the photographed product. The app does not authenticate medicines or calculate personal doses. Follow the prescription and package leaflet and ask a licensed pharmacist or clinician. For an emergency or possible overdose, contact local emergency services or poison control.

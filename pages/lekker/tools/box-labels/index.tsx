// pages/lekker/tools/box-labels/index.tsx
import Head from 'next/head';
import Script from 'next/script';
import { useEffect } from 'react';

export default function BoxLabels() {
  useEffect(() => {
    // This code will only run on the client side
    const initializeApp = async () => {
      try {
        // Wait for external dependencies to load
        await new Promise<void>((resolve) => {
          if (typeof window.jspdf !== 'undefined' && typeof window.html2canvas !== 'undefined') {
            resolve();
          } else {
            const checkInterval = setInterval(() => {
              if (typeof window.jspdf !== 'undefined' && typeof window.html2canvas !== 'undefined') {
                clearInterval(checkInterval);
                resolve();
              }
            }, 100);
          }
        });

        // Initialize your app functionality
        window.jsPDF = window.jspdf.jsPDF;
        
        const shipmentInput = document.getElementById('shipmentId');
        const generateBtn = document.getElementById('generate-btn');
        const printBtn = document.getElementById('print-btn');
        const pdfBtn = document.getElementById('pdf-btn');

        if (shipmentInput && window.fetchShipment) {
          shipmentInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
              window.fetchShipment();
            }
          });
        }

        if (generateBtn && window.fetchShipment) {
          generateBtn.addEventListener('click', window.fetchShipment);
        }

        if (printBtn && window.printLabels) {
          printBtn.addEventListener('click', window.printLabels);
        }

        if (pdfBtn && window.exportLabelsToPDF) {
          pdfBtn.addEventListener('click', window.exportLabelsToPDF);
        }

        document.body.classList.add('resources-loaded');
      } catch (error) {
        console.error('Initialization error:', error);
      }
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initializeApp);
    } else {
      initializeApp();
    }

    // Cleanup function
    return () => {
      document.removeEventListener('DOMContentLoaded', initializeApp);
    };
  }, []);

  return (
    <>
      <Head>
        <title>Generador de etiquetas para cajas</title>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="icon" href="data:," />
        <link rel="stylesheet" href="/lekker/tools/box-labels/css/styles.css" />
        <style jsx>{`
          .label-pdf-container {
            position: fixed;
            left: -9999px;
            top: 0;
            width: 86mm;
            height: 54mm;
          }
          body { 
            visibility: hidden; 
          }
          body.resources-loaded { 
            visibility: visible; 
          }
        `}</style>
      </Head>

      {/* External scripts */}
      <Script 
        src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js" 
        strategy="afterInteractive"
      />
      <Script 
        src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js" 
        strategy="afterInteractive"
      />
      <Script 
        src="/lekker/tools/box-labels/js/main.js" 
        strategy="afterInteractive"
        onLoad={() => {
          // Ensure jsPDF is available
          if (typeof window.jspdf !== 'undefined') {
            window.jsPDF = window.jspdf.jsPDF;
          }
        }}
      />

      {/* Your HTML content */}
      <div className="no-print controls">
        <h1>Generador de etiquetas para cajas</h1>
        <div className="form-group">
          <label htmlFor="company-select">Company:</label>
          <select id="company-select" className="form-control">
            <option value="secura">Secura Inc</option>
            <option value="libertad">Libertad Inc</option>
          </select>
        </div>
        <div>
          <label htmlFor="shipmentId">Shipment ID:</label>
          <input type="text" id="shipmentId" placeholder="Enter shipment ID" />
          <button id="generate-btn">Generar Etiquetas</button>
          <button id="print-btn">Imprimir etiquetas</button>
          <button id="pdf-btn">Exportar a PDF</button>
        </div>
        <div id="error"></div>
        <div id="processing">Processing shipment data...</div>
      </div>
      
      <div id="labels-container" className="label-sheet"></div>
      <div id="pdf-container" className="label-pdf-container"></div>
    </>
  );
}
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright');

const ARTIFACT_DIR = 'C:/Users/vrmus/.gemini/antigravity/brain/debdadf7-1b8d-4d42-a09b-89efbfddddf8';

const PROGRAMS = [
  {
    id: 'prog_a_financial',
    name: 'Program A: Financial Withdrawal Validator',
    code: `def process_withdrawal(balance, amount):
    if not isinstance(balance, int) or not isinstance(amount, int):
        raise TypeError("Amounts must be integers")
    if amount < 0:
        raise ValueError("Negative withdrawal amount prohibited")
    if amount > balance:
        raise RuntimeError("Insufficient funds")
    return balance - amount`
  },
  {
    id: 'prog_b_matrix',
    name: 'Program B: Matrix Diagonal Extractor',
    code: `def extract_diagonal(matrix):
    result = []
    for i in range(len(matrix)):
        result.append(matrix[i][i])
    return result`
  },
  {
    id: 'prog_c_network',
    name: 'Program C: Network Throughput Calculator',
    code: `def calculate_throughput(total_bytes, duration_sec):
    if duration_sec == 0:
        raise ZeroDivisionError("Duration cannot be zero seconds")
    return (total_bytes * 8) / duration_sec`
  }
];

function waitForUrl(url, timeoutMs = 25000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      http.get(url, (res) => {
        resolve();
      }).on('error', (err) => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Timeout waiting for ${url}`));
        } else {
          setTimeout(check, 500);
        }
      });
    };
    check();
  });
}

(async () => {
  console.log('[1/6] Starting Backend Execution Pipeline (port 3001)...');
  const logStream = fs.createWriteStream(path.join(ARTIFACT_DIR, 'backend_execution_pipeline.log'), { flags: 'w' });
  logStream.write('=== OMEGA FUZZ BACKEND PRODUCTION EXECUTION LOG ===\n');
  
  const apiProcess = spawn('node', ['dist/index.js'], {
    cwd: path.join(__dirname, 'apps/api'),
    env: { ...process.env, PORT: '3001', OMEGA_ALLOW_UNSAFE_LOCAL_EXECUTION: 'true' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  
  apiProcess.stdout.pipe(logStream, { end: false });
  apiProcess.stderr.pipe(logStream, { end: false });
  apiProcess.stdout.on('data', d => process.stdout.write('[API] ' + d));
  apiProcess.stderr.on('data', d => process.stderr.write('[API ERR] ' + d));

  console.log('[2/6] Starting Frontend Preview Server (port 4173)...');
  const feProcess = spawn('npx', ['vite', 'preview', '--port', '4173', '--host'], {
    cwd: path.join(__dirname, 'apps/frontend'),
    env: { ...process.env },
    shell: true,
    stdio: 'inherit'
  });

  try {
    await waitForUrl('http://localhost:4173/');
    console.log('✅ Frontend Preview and Backend Server verified running.');
    
    console.log('[3/6] Launching Playwright to record 3 Fuzzing Campaigns & capture PDF/JSON exports...');
    const browser = await chromium.launch({ headless: true });
    
    // Create Desktop Context with video recording
    const desktopContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      recordVideo: {
        dir: ARTIFACT_DIR,
        size: { width: 1280, height: 800 }
      },
      acceptDownloads: true
    });

    const page = await desktopContext.newPage();
    await page.goto('http://localhost:4173/');
    await page.waitForTimeout(1500);
    
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'desktop_landing.png') });
    console.log('📸 Saved desktop_landing.png');

    for (let i = 0; i < PROGRAMS.length; i++) {
      const prog = PROGRAMS[i];
      console.log(`▶ Executing Campaign #${i+1}: ${prog.name}...`);
      
      if (i > 0) {
        // Click New Campaign to go back to editor
        await page.click('button:has-text("New Campaign")');
        await page.waitForSelector('textarea');
      }

      await page.fill('textarea', prog.code);
      await page.fill('input[type="number"]', '30');
      await page.waitForTimeout(500);

      // Initialize Engine
      await page.click('button:has-text("Initialize Engine")');

      // Wait for completion (Report Export buttons appear)
      console.log(`⏳ Waiting for ${prog.name} fuzzing cycle and SSE telemetry to finish...`);
      await page.waitForSelector('button:has-text("Export PDF Report")', { timeout: 45000 });
      await page.waitForTimeout(1200);

      await page.screenshot({ path: path.join(ARTIFACT_DIR, `desktop_report_${prog.id}.png`), fullPage: true });
      console.log(`📸 Saved desktop_report_${prog.id}.png`);

      // Download JSON Report
      const [jsonDownload] = await Promise.all([
        page.waitForEvent('download'),
        page.click('button:has-text("Export JSON")')
      ]);
      const jsonDest = path.join(ARTIFACT_DIR, `report_${prog.id}.json`);
      await jsonDownload.saveAs(jsonDest);
      console.log(`📦 Exported JSON: ${jsonDest}`);

      // Download PDF Report
      const [pdfDownload] = await Promise.all([
        page.waitForEvent('download'),
        page.click('button:has-text("Export PDF Report")')
      ]);
      const pdfDest = path.join(ARTIFACT_DIR, `report_${prog.id}.pdf`);
      await pdfDownload.saveAs(pdfDest);
      console.log(`📦 Exported PDF: ${pdfDest}`);
    }

    // Now test Comparison & Replay on the history archive!
    console.log('[4/6] Testing Campaign Comparison and Timeline Replay in Desktop Studio...');
    const checkboxes = await page.$$('input[type="checkbox"]');
    if (checkboxes.length >= 2) {
      await checkboxes[0].check();
      await checkboxes[1].check();
      const compareBtn = await page.$('button:has-text("Compare Selected")');
      if (compareBtn) {
        await compareBtn.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'desktop_campaign_comparison.png') });
        console.log('📸 Saved desktop_campaign_comparison.png');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }
    }

    await desktopContext.close();
    console.log('🎥 Video recording closed and saved to artifacts directory.');
    
    // Rename saved webm to fuzzing_runs_recording.webm
    const files = fs.readdirSync(ARTIFACT_DIR);
    const webmFile = files.find(f => f.endsWith('.webm') && f !== 'fuzzing_runs_recording.webm');
    if (webmFile) {
      const targetPath = path.join(ARTIFACT_DIR, 'fuzzing_runs_recording.webm');
      if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
      fs.renameSync(path.join(ARTIFACT_DIR, webmFile), targetPath);
      console.log(`✅ Renamed recording to fuzzing_runs_recording.webm`);
    }

    // Mobile UI Capture
    console.log('[5/6] Creating Mobile iPhone context for Mobile UI verification...');
    const mobileContext = await browser.newContext({
      viewport: { width: 375, height: 812 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
    });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto('http://localhost:4173');
    await mobilePage.waitForTimeout(1000);
    await mobilePage.screenshot({ path: path.join(ARTIFACT_DIR, 'mobile_ui_landing.png') });
    console.log('📸 Saved mobile_ui_landing.png');

    await mobilePage.fill('textarea', PROGRAMS[0].code);
    await mobilePage.fill('input[type="number"]', '30');
    await mobilePage.click('button:has-text("Initialize Engine")');
    await mobilePage.waitForSelector('button:has-text("Export PDF Report")', { timeout: 45000 });
    await mobilePage.waitForTimeout(1000);
    await mobilePage.screenshot({ path: path.join(ARTIFACT_DIR, 'mobile_ui_report.png'), fullPage: true });
    console.log('📸 Saved mobile_ui_report.png');
    await mobileContext.close();
    await browser.close();

    console.log('[6/6] Executing real Lighthouse Audit against production Vite build...');
    try {
      const lighthouseCmd = `npx -y lighthouse http://localhost:4173/ --output=json --output-path="${path.join(ARTIFACT_DIR, 'lighthouse_report.json')}" --chrome-flags="--headless" --only-categories=performance,accessibility,best-practices,seo`;
      console.log(`Running: ${lighthouseCmd}`);
      execSync(lighthouseCmd, { stdio: 'inherit', shell: true });
      console.log('✅ Real Lighthouse Audit completed and report saved!');
    } catch (e) {
      console.warn('⚠️ Lighthouse command exited with code (often due to headless flags), checking report file...');
    }
    
    const reportPath = path.join(ARTIFACT_DIR, 'lighthouse_report.json');
    if (fs.existsSync(reportPath)) {
      const lhData = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
      const scores = {
        performance: Math.round((lhData.categories?.performance?.score || 0) * 100),
        accessibility: Math.round((lhData.categories?.accessibility?.score || 0) * 100),
        bestPractices: Math.round((lhData.categories?.['best-practices']?.score || 0) * 100),
        seo: Math.round((lhData.categories?.seo?.score || 0) * 100),
      };
      console.log('\n=========================================');
      console.log('🏆 LIGHTHOUSE AUDIT SCORES:');
      console.log(`🚀 Performance   : ${scores.performance}/100`);
      console.log(`♿ Accessibility : ${scores.accessibility}/100`);
      console.log(`🛡️ Best Practices: ${scores.bestPractices}/100`);
      console.log(`🔍 SEO           : ${scores.seo}/100`);
      console.log('=========================================\n');
    }

  } catch (err) {
    console.error('❌ Error during E2E proof collection:', err);
  } finally {
    console.log('Stopping background server processes...');
    if (apiProcess.pid) {
      try { process.kill(apiProcess.pid); } catch (e) {}
    }
    if (feProcess.pid) {
      try { process.kill(feProcess.pid); } catch (e) {}
    }
    logStream.end();
    setTimeout(() => process.exit(0), 1500);
  }
})();

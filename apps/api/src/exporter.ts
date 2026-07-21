import { CanonicalReport } from '@omega-fuzz/canonical-model';
import { LosslessSerializer } from '@omega-fuzz/orchestrator/dist/serializer';
import * as fs from 'fs';
import * as path from 'path';

export class ReportExporter {
  static exportJSON(report: CanonicalReport, outDir: string): string {
    const filename = `omega_fuzz_report_${report.campaign_id}.json`;
    const fullPath = path.join(outDir, filename);

    // Deep serialize the report using the canonical LosslessSerializer
    // We stringify the already serialized canonical structure
    const serializedReport = LosslessSerializer.serialize(report as any);
    
    fs.writeFileSync(fullPath, JSON.stringify(serializedReport, null, 2), 'utf-8');
    return fullPath;
  }

  static exportPDF(report: CanonicalReport, outDir: string): string {
    const filename = `omega_fuzz_report_${report.campaign_id}.md`;
    const fullPath = path.join(outDir, filename);

    // Mocking PDF export as a structured markdown file for now
    // In production, this would use pdfkit or puppeteer.
    const content = `
# Omega Fuzz - Forensic Report
**Campaign ID:** ${report.campaign_id}
**Generated At:** ${report.generated_at}

## Target
- Language: ${report.target.language}
- Runtime: ${report.target.runtime}

## Summary
- Executed: ${report.summary.executed}
- Unique Findings: ${report.summary.unique_findings}
- Duplicates: ${report.summary.duplicates}
- Expected Rejections: ${report.summary.expected_rejections}

## Findings
${report.findings.map((f: any) => `
### ${f.id} [${f.severity}]
- **Category:** ${f.fingerprint.outcomeCategory}
- **Type:** ${f.fingerprint.exceptionType}
- **Location:** ${f.fingerprint.rootSourceLocation}
- **Reproducible:** ${f.isReproducible ? 'Yes' : 'No'}
`).join('\n')}
    `;
    
    fs.writeFileSync(fullPath, content.trim(), 'utf-8');
    return fullPath; // Returning .md, simulating PDF structure
  }
}

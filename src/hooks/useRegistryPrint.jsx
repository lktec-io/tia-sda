import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import RegistryPrintReport from '../components/RegistryPrintReport';

/**
 * "Export Registry to PDF": renders the branded report into <body>, waits until the
 * logo has loaded (or failed) so it appears on the page, then opens the browser's print
 * dialog — choose "Save as PDF". The report is removed again after printing.
 *
 * Usage: const { exportPdf, printPortal, preparing } = useRegistryPrint();
 *        exportPdf(members, 'All members');   …   {printPortal}
 */
export default function useRegistryPrint() {
  const [job, setJob] = useState(null); // { members, scope, generatedAt, ready }

  const exportPdf = useCallback((members, scope = 'All members') => {
    if (!members.length) return;
    setJob({ members, scope, generatedAt: Date.now(), ready: false });
  }, []);

  const markReady = useCallback(() => {
    setJob((current) => (current && !current.ready ? { ...current, ready: true } : current));
  }, []);

  // Safety net: print even if the logo never reports back.
  useEffect(() => {
    if (!job || job.ready) return undefined;
    const timer = setTimeout(markReady, 1500);
    return () => clearTimeout(timer);
  }, [job, markReady]);

  useEffect(() => {
    if (!job?.ready) return undefined;
    const finish = () => setJob(null);
    window.addEventListener('afterprint', finish);
    // Let the browser paint the report before the dialog snapshots it.
    const frame = requestAnimationFrame(() => {
      window.print();
    });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('afterprint', finish);
    };
  }, [job?.ready]);

  const printPortal = job
    ? createPortal(
        <RegistryPrintReport
          members={job.members}
          scope={job.scope}
          generatedAt={job.generatedAt}
          onLogoSettled={markReady}
        />,
        document.body
      )
    : null;

  return { exportPdf, printPortal, preparing: Boolean(job) };
}

// Only a positively acknowledged upload clears pending work. A newer change
// supersedes this scheduler through effect cleanup, including during an upload.
export function scheduleBackup({ snapshot, upload, onStatus, delay = 5000, retryDelay = 30000 }) {
  let stopped = false;
  let timer;
  onStatus({ status: 'pending', error: null });
  const run = async () => {
    if (stopped) return;
    onStatus({ status: 'uploading', error: null });
    try {
      if (await upload(snapshot()) !== true) throw new Error('تعذر حفظ النسخة الاحتياطية السحابية؛ ستتم إعادة المحاولة');
      if (!stopped) onStatus({ status: 'saved', error: null });
    } catch (error) {
      if (!stopped) {
        onStatus({ status: 'retrying', error: error.message || String(error) });
        timer = setTimeout(run, retryDelay);
      }
    }
  };
  timer = setTimeout(run, delay);
  return () => { stopped = true; clearTimeout(timer); };
}

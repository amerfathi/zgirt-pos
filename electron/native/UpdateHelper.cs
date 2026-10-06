using System;
using System.Diagnostics;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Windows.Forms;

// Independent WinExe: no shell, force termination, credentials or exclusions.
internal static class UpdateHelper
{
    private static string journal;
    private static bool acknowledged;
    private static void Record(string stage)
    {
        File.AppendAllText(journal, DateTime.UtcNow.ToString("o") + " " + stage + Environment.NewLine, Encoding.UTF8);
    }
    private static void Verify(string installer, string expected)
    {
        using (var stream = new FileStream(installer, FileMode.Open, FileAccess.Read, FileShare.Read))
        using (var hash = SHA256.Create())
        {
            string actual = BitConverter.ToString(hash.ComputeHash(stream)).Replace("-", "").ToLowerInvariant();
            if (!String.Equals(actual, expected, StringComparison.Ordinal)) throw new InvalidDataException("Installer checksum mismatch");
        }
    }
    [STAThread]
    private static int Main(string[] args)
    {
        if (args.Length != 6) return 10;
        string ready = args[4]; journal = args[5];
        try
        {
            string installer = Path.GetFullPath(args[0]);
            if (!String.Equals(Path.GetExtension(installer), ".exe", StringComparison.OrdinalIgnoreCase)) throw new InvalidDataException("Executable required");
            int pid = Int32.Parse(args[1]);
            if (pid <= 0 || args[3].Length != 64) throw new InvalidDataException("Invalid handoff");
            using (var parent = Process.GetProcessById(pid))
            {
                if (!String.Equals(Path.GetFullPath(parent.MainModule.FileName), Path.GetFullPath(args[2]), StringComparison.OrdinalIgnoreCase))
                    throw new InvalidDataException("Parent identity mismatch");
                var handle = parent.Handle; // Capture identity before ACK; no PID reuse.
                Verify(installer, args[3]);
                if (File.Exists(ready + ".cancel")) throw new OperationCanceledException("Handoff cancelled");
                Record("ready");
                File.WriteAllText(ready + ".tmp", "ready", Encoding.ASCII); File.Move(ready + ".tmp", ready);
                acknowledged = true;
                var deadline = DateTime.UtcNow.AddMinutes(3);
                while (!parent.WaitForExit(200))
                {
                    if (File.Exists(ready + ".cancel")) throw new OperationCanceledException("Handoff cancelled");
                    if (DateTime.UtcNow >= deadline) throw new TimeoutException("Application is still running");
                }
            }
            if (File.Exists(ready + ".cancel")) throw new OperationCanceledException("Handoff cancelled");
            using (var locked = new FileStream(installer, FileMode.Open, FileAccess.Read, FileShare.Read))
            {
                Verify(installer, args[3]);
                var start = new ProcessStartInfo(installer) { UseShellExecute = true, WindowStyle = ProcessWindowStyle.Normal };
                using (var process = Process.Start(start))
                {
                    if (process == null) throw new InvalidOperationException("Installer launch failed");
                    Record("installer_started"); process.WaitForExit(); Record("installer_exit_" + process.ExitCode);
                    // Exit zero is not a claim that installation was completed.
                }
            }
            return 0;
        }
        catch (Exception error)
        {
            try { Record("failed_" + error.GetType().Name); } catch { }
            if (!acknowledged)
            {
                try { File.WriteAllText(ready + ".tmp", "failed", Encoding.ASCII); File.Move(ready + ".tmp", ready); } catch { }
            }
            else if (!(error is OperationCanceledException)) MessageBox.Show("تعذر إكمال التحديث. لم تُحذف بياناتك. أعد فتح براكه أو شغّل المثبت المحمّل يدويًا.\n" + error.Message,
                "تحديث براكه", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 20;
        }
    }
}

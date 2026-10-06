using System;
using System.IO;
internal static class InstallerFixture
{
    private static int Main()
    {
        File.WriteAllText(Environment.GetEnvironmentVariable("BRAKA_TEST_MARKER"), "started");
        return 0;
    }
}

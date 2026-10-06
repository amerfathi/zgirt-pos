!macro customCheckAppRunning
  check_app_again:
    nsProcess::_FindProcess /NOUNLOAD "${APP_EXECUTABLE_FILENAME}"
    Pop $R0
    ${if} $R0 == 0
      MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "$(appRunning)" /SD IDCANCEL IDRETRY check_app_again
      Quit
    ${endIf}
  !ifndef BUILD_UNINSTALLER
    # Old Windows packages accidentally included Capacitor native build output.
    # NSIS moves old files into a longer temporary path during upgrade; those
    # paths can exceed MAX_PATH. Archive the unused tree with one directory
    # rename before invoking the old uninstaller. Keep it for recovery.
    IfFileExists "$INSTDIR\resources\app.asar.unpacked\node_modules\@capacitor\*.*" 0 legacy_archive_done
    StrCpy $R1 0
    legacy_archive_next:
      IntOp $R1 $R1 + 1
      StrCpy $R2 "$INSTDIR-legacy-unpacked-$R1"
      IfFileExists "$R2\*.*" legacy_archive_next
    ClearErrors
    Rename "$INSTDIR\resources\app.asar.unpacked" "$R2"
    ${if} ${Errors}
      MessageBox MB_OK|MB_ICONSTOP "Could not archive legacy installation files. Close BRAKA and retry. Your data has not been removed."
      SetErrorLevel 2
      Quit
    ${endIf}
    DetailPrint "Legacy installation files archived at $R2"
    legacy_archive_done:
  !endif
!macroend

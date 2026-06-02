package com.muhammadkhan.codepocket;

import android.content.res.AssetManager;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.HashMap;
import java.util.Map;

@CapacitorPlugin(name = "PRootPlugin")
public class PRootPlugin extends Plugin {

    private static final String TAG = "PRootPlugin";
    private static final String DEFAULT_SESSION = "default";

    // Map: sessionId -> running Process
    private final Map<String, Process> sessions = new HashMap<>();

    // ---------------------------------------------------------------
    // initEnvironment — extracts alpine.bin from assets/ to filesDir
    // ---------------------------------------------------------------
    @PluginMethod
    public void initEnvironment(PluginCall call) {
        new Thread(() -> {
            try {
                File alpineDir = new File(getContext().getFilesDir(), "alpine");
                File doneMarker = new File(alpineDir, ".extracted");

                if (!doneMarker.exists()) {
                    alpineDir.mkdirs();
                    AssetManager assets = getContext().getAssets();

                    // Extract alpine tarball
                    try (InputStream in = assets.open("public/native/alpine.bin");
                         FileOutputStream out = new FileOutputStream(new File(alpineDir, "alpine.bin"))) {
                        copyStream(in, out);
                    }

                    // Extract the tarball using tar
                    Process tar = Runtime.getRuntime().exec(new String[]{
                        "tar", "-xf", new File(alpineDir, "alpine.bin").getAbsolutePath(),
                        "-C", alpineDir.getAbsolutePath()
                    });
                    tar.waitFor();
                    doneMarker.createNewFile();
                    Log.i(TAG, "Alpine extracted to " + alpineDir.getAbsolutePath());
                } else {
                    Log.i(TAG, "Alpine already extracted");
                }

                // Extract and chmod PRoot binary from assets
                File prootFile = new File(getContext().getFilesDir(), "proot");
                if (!prootFile.exists() || prootFile.length() == 0) {
                    try (InputStream in = getContext().getAssets().open("public/native/proot");
                         FileOutputStream out = new FileOutputStream(prootFile)) {
                        copyStream(in, out);
                    }
                    Runtime.getRuntime().exec(new String[]{"chmod", "+x", prootFile.getAbsolutePath()}).waitFor();
                    Log.i(TAG, "PRoot extracted to " + prootFile.getAbsolutePath());
                }

                call.resolve();
            } catch (Exception e) {
                Log.e(TAG, "initEnvironment failed", e);
                call.reject("Failed to init environment: " + e.getMessage());
            }
        }).start();
    }

    // ---------------------------------------------------------------
    // startSession — spawns a PRoot shell for a named session
    // ---------------------------------------------------------------
    @PluginMethod
    public void startSession(PluginCall call) {
        String sessionId = call.getString("sessionId", DEFAULT_SESSION);

        // Stop existing session with same ID if any
        if (sessions.containsKey(sessionId)) {
            stopSessionInternal(sessionId);
        }

        new Thread(() -> {
            try {
                File filesDir = getContext().getFilesDir();
                File alpineDir = new File(filesDir, "alpine");
                File prootFile = new File(filesDir, "proot");

                String[] cmd;
                if (prootFile.exists()) {
                    cmd = new String[]{
                        prootFile.getAbsolutePath(),
                        "--rootfs=" + alpineDir.getAbsolutePath(),
                        "--bind=/dev",
                        "--bind=/proc",
                        "--bind=/sys",
                        "/bin/sh", "-i"
                    };
                } else {
                    // Fallback: bare shell
                    cmd = new String[]{"/bin/sh", "-i"};
                    notifyListeners("terminal_output", buildOutput(sessionId, "\x1b[33m[WARN] PRoot not found, using system shell\x1b[0m\r\n"));
                }

                ProcessBuilder pb = new ProcessBuilder(cmd);
                pb.environment().put("TERM", "xterm-256color");
                pb.environment().put("HOME", "/root");
                pb.environment().put("PATH", "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin");
                pb.redirectErrorStream(true);
                Process process = pb.start();
                sessions.put(sessionId, process);

                // Read output loop
                final String sid = sessionId;
                new Thread(() -> {
                    byte[] buf = new byte[1024];
                    int n;
                    try {
                        while ((n = process.getInputStream().read(buf)) != -1) {
                            String chunk = new String(buf, 0, n);
                            notifyListeners("terminal_output", buildOutput(sid, chunk));
                        }
                    } catch (IOException e) {
                        // Process ended
                    }
                    sessions.remove(sid);
                    notifyListeners("terminal_output", buildOutput(sid, "\r\n[session ended]\r\n"));
                }).start();

                call.resolve();
            } catch (Exception e) {
                Log.e(TAG, "startSession failed", e);
                call.reject("Failed to start session: " + e.getMessage());
            }
        }).start();
    }

    // ---------------------------------------------------------------
    // writeData — send input to a session's stdin
    // ---------------------------------------------------------------
    @PluginMethod
    public void writeData(PluginCall call) {
        String sessionId = call.getString("sessionId", DEFAULT_SESSION);
        String data = call.getString("data", "");

        Process process = sessions.get(sessionId);
        if (process == null) {
            call.reject("No session: " + sessionId);
            return;
        }

        new Thread(() -> {
            try {
                process.getOutputStream().write(data.getBytes());
                process.getOutputStream().flush();
                call.resolve();
            } catch (IOException e) {
                call.reject("writeData failed: " + e.getMessage());
            }
        }).start();
    }

    // ---------------------------------------------------------------
    // resizeTerminal — send SIGWINCH to update terminal dimensions
    // ---------------------------------------------------------------
    @PluginMethod
    public void resizeTerminal(PluginCall call) {
        String sessionId = call.getString("sessionId", DEFAULT_SESSION);
        int cols = call.getInt("cols", 80);
        int rows = call.getInt("rows", 24);

        Process process = sessions.get(sessionId);
        if (process == null) {
            call.reject("No session: " + sessionId);
            return;
        }

        new Thread(() -> {
            try {
                // Send stty resize command to the shell
                String resizeCmd = String.format("stty cols %d rows %d\n", cols, rows);
                process.getOutputStream().write(resizeCmd.getBytes());
                process.getOutputStream().flush();

                JSObject result = new JSObject();
                result.put("cols", cols);
                result.put("rows", rows);
                call.resolve(result);
            } catch (IOException e) {
                call.reject("resizeTerminal failed: " + e.getMessage());
            }
        }).start();
    }

    // ---------------------------------------------------------------
    // stopSession — kill a named session
    // ---------------------------------------------------------------
    @PluginMethod
    public void stopSession(PluginCall call) {
        String sessionId = call.getString("sessionId", DEFAULT_SESSION);
        stopSessionInternal(sessionId);
        call.resolve();
    }

    private void stopSessionInternal(String sessionId) {
        Process p = sessions.get(sessionId);
        if (p != null) {
            p.destroy();
            sessions.remove(sessionId);
        }
    }

    private JSObject buildOutput(String sessionId, String data) {
        JSObject obj = new JSObject();
        obj.put("sessionId", sessionId);
        obj.put("data", data);
        return obj;
    }

    private void copyStream(InputStream in, OutputStream out) throws IOException {
        byte[] buf = new byte[8192];
        int n;
        while ((n = in.read(buf)) != -1) {
            out.write(buf, 0, n);
        }
    }
}

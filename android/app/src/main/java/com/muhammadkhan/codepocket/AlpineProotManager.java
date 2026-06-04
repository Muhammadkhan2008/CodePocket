package com.muhammadkhan.codepocket;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.res.AssetManager;
import android.util.Log;

import org.json.JSONObject;

import java.io.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Alpine Proot Manager
 * Advanced PRoot/Proot-based Alpine Linux environment
 * Acode-style native backend with Python, Node.js, Git, etc.
 */
public class AlpineProotManager {

    private static final String TAG = "AlpineProotManager";

    private static final String ALPINE_TARBALL = "alpine.bin";
    private static final String PROOT_BINARY = "proot";
    private static final String ALPINE_DIR = "alpine";
    private static final String MARKER_FILE = ".extracted";
    private static final String CONFIG_FILE = "alpine_config.json";

    private final Context context;
    private final File filesDir;

    private final Map<String, Process> sessions = new ConcurrentHashMap<>();
    private final Map<String, OutputStreamWriter> sessionInputs = new ConcurrentHashMap<>();
    private final Map<String, AlpineSessionListener> sessionListeners = new ConcurrentHashMap<>();

    private boolean isInitialized = false;
    private File prootBinary;
    private File alpineRootfs;

    public interface AlpineSessionListener {
        void onData(String sessionId, String data);
        void onError(String sessionId, String error);
        void onExit(String sessionId, int exitCode);
    }

    public AlpineProotManager(Context context) {
        this.context = context;
        this.filesDir = context.getFilesDir();
    }

    /**
     * Initialize Alpine environment
     * - Extract alpine.bin tarball (Alpine rootfs)
     * - Extract proot binary
     * - Setup PATH, environment
     * - Install Python, Node.js, Git, compiler toolchain
     */
    public synchronized void initialize() throws IOException, InterruptedException {
        if (isInitialized) return;

        Log.i(TAG, "Initializing Alpine Proot environment...");

        File alpineDir = new File(filesDir, ALPINE_DIR);
        File markerFile = new File(alpineDir, MARKER_FILE);

        // Extract Alpine rootfs if not already
        if (!markerFile.exists() || shouldForceExtract()) {
            extractAlpineRootfs(alpineDir, markerFile);
        } else {
            Log.i(TAG, "Alpine already extracted, skipping");
        }

        // Extract proot binary
        prootBinary = setupProotBinary();

        // Setup environment PATH
        setupEnvironment();

        isInitialized = true;
        Log.i(TAG, "Alpine Proot initialized successfully");
    }

    private boolean shouldForceExtract() {
        // Check a config flag if we want to force re-extract
        SharedPreferences prefs = context.getSharedPreferences("codepocket_prefs", Context.MODE_PRIVATE);
        return prefs.getBoolean("force_alpine_extract", false);
    }

    private void extractAlpineRootfs(File alpineDir, File markerFile) throws IOException, InterruptedException {
        alpineDir.mkdirs();

        AssetManager assets = context.getAssets();

        // Extract alpine.bin from assets/public/native
        File tarballFile = new File(alpineDir, ALPINE_TARBALL);
        try (InputStream in = assets.open("public/native/" + ALPINE_TARBALL);
             FileOutputStream out = new FileOutputStream(tarballFile)) {
            copyStream(in, out);
        }

        Log.i(TAG, "Alpine tarball copied to: " + tarballFile.getAbsolutePath());

        // Extract tarball using system tar
        ProcessBuilder tarPb = new ProcessBuilder(
            "tar", "-xf", tarballFile.getAbsolutePath(),
            "-C", alpineDir.getAbsolutePath()
        );
        tarPb.redirectErrorStream(true);
        Process tarProcess = tarPb.start();
        int exitCode = tarProcess.waitFor();

        if (exitCode != 0) {
            throw new IOException("Failed to extract Alpine tarball (exit " + exitCode + ")");
        }

        // Delete tarball to save space
        tarballFile.delete();

        // Create marker file
        markerFile.createNewFile();

        // Setup Alpine directories
        setupAlpineDirs(alpineDir);

        Log.i(TAG, "Alpine rootfs extracted to: " + alpineDir.getAbsolutePath());
    }

    private void setupAlpineDirs(File alpineDir) {
        String[] dirs = {
            "root/workspace",
            "root/projects",
            "root/.config",
            "root/.local",
            "usr/local/bin",
            "tmp",
            "var/log"
        };

        for (String dir : dirs) {
            File d = new File(alpineDir, dir);
            if (!d.exists()) {
                d.mkdirs();
            }
        }
    }

    private File setupProotBinary() throws IOException, InterruptedException {
        File prootFile = new File(filesDir, PROOT_BINARY);

        if (!prootFile.exists() || prootFile.length() == 0) {
            AssetManager assets = context.getAssets();
            try (InputStream in = assets.open("public/native/" + PROOT_BINARY);
                 FileOutputStream out = new FileOutputStream(prootFile)) {
                copyStream(in, out);
            }

            // Make it executable
            Process chmod = Runtime.getRuntime().exec(new String[]{
                "chmod", "+x", prootFile.getAbsolutePath()
            });
            chmod.waitFor();

            Log.i(TAG, "PRoot binary extracted to: " + prootFile.getAbsolutePath());
        }

        return prootFile;
    }

    private void setupEnvironment() {
        // Environment setup for Alpine
        Map<String, String> env = new HashMap<>();
        env.put("TERM", "xterm-256color");
        env.put("HOME", "/root");
        env.put("USER", "root");
        env.put("LANG", "en_US.UTF-8");
        env.put("LC_ALL", "en_US.UTF-8");

        // PATH with Python, Node, Git, compilers
        env.put("PATH",
            "/usr/local/sbin:/usr/local/bin:" +
            "/usr/sbin:/usr/bin:/sbin:/bin:" +
            "/usr/lib/python3.11:/usr/lib/node_modules/.bin"
        );
    }

    /**
     * Start a new PRoot shell session
     */
    public synchronized String startSession(String sessionId) throws IOException {
        if (sessions.containsKey(sessionId)) {
            stopSession(sessionId);
        }

        if (!isInitialized) {
            throw new IOException("Alpine environment not initialized");
        }

        String[] cmd;

        if (prootBinary != null && prootBinary.exists()) {
            alpineRootfs = new File(filesDir, ALPINE_DIR);

            cmd = new String[]{
                prootBinary.getAbsolutePath(),
                "--rootfs=" + alpineRootfs.getAbsolutePath(),
                "--bind=/dev",
                "--bind=/proc",
                "--bind=/sys",
                "/bin/sh", "-i"
            };
        } else {
            // Fallback to system shell
            cmd = new String[]{"/bin/sh", "-i"};
        }

        ProcessBuilder pb = new ProcessBuilder(cmd);

        // Set environment
        Map<String, String> processEnv = pb.environment();
        processEnv.put("TERM", "xterm-256color");
        processEnv.put("HOME", "/root");
        processEnv.put("USER", "root");
        processEnv.put("LANG", "en_US.UTF-8");
        processEnv.put("LC_ALL", "en_US.UTF-8");
        processEnv.put("PATH",
            "/usr/local/sbin:/usr/local/bin:" +
            "/usr/sbin:/usr/bin:/sbin:/bin"
        );

        pb.redirectErrorStream(true);

        Process process = pb.start();
        sessions.put(sessionId, process);

        OutputStreamWriter writer = new OutputStreamWriter(process.getOutputStream());
        sessionInputs.put(sessionId, writer);

        // Start output reader thread
        startOutputReader(sessionId, process);

        Log.i(TAG, "Session started: " + sessionId);

        // Run initialization commands
        sendCommand(sessionId, "cd /root\n");

        return sessionId;
    }

    private void startOutputReader(final String sessionId, final Process process) {
        new Thread(() -> {
            BufferedReader reader = new BufferedReader(
                new InputStreamReader(process.getInputStream())
            );

            char[] buffer = new char[4096];
            int n;

            try {
                while ((n = reader.read(buffer)) != -1) {
                    final String data = new String(buffer, 0, n);

                    AlpineSessionListener listener = sessionListeners.get(sessionId);
                    if (listener != null) {
                        listener.onData(sessionId, data);
                    }
                }
            } catch (IOException e) {
                Log.e(TAG, "Output reader error", e);
            } finally {
                try {
                    process.waitFor();
                    int exitCode = process.exitValue();

                    AlpineSessionListener listener = sessionListeners.get(sessionId);
                    if (listener != null) {
                        listener.onExit(sessionId, exitCode);
                    }
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                }

                sessions.remove(sessionId);
                sessionInputs.remove(sessionId);
            }
        }).start();
    }

    /**
     * Send input/command to a session
     */
    public void sendCommand(String sessionId, String command) throws IOException {
        OutputStreamWriter writer = sessionInputs.get(sessionId);
        if (writer != null) {
            writer.write(command);
            writer.flush();
        } else {
            throw new IOException("No active session: " + sessionId);
        }
    }

    /**
     * Resize terminal
     */
    public void resizeTerminal(String sessionId, int cols, int rows) throws IOException {
        // Send stty resize command
        String resizeCmd = String.format("stty cols %d rows %d\n", cols, rows);
        sendCommand(sessionId, resizeCmd);
    }

    /**
     * Stop a session
     */
    public synchronized void stopSession(String sessionId) {
        Process process = sessions.remove(sessionId);
        if (process != null) {
            process.destroy();

            try {
                process.waitFor(500, java.util.concurrent.TimeUnit.MILLISECONDS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }

            if (process.isAlive()) {
                process.destroyForcibly();
            }
        }

        sessionInputs.remove(sessionId);
        sessionListeners.remove(sessionId);

        Log.i(TAG, "Session stopped: " + sessionId);
    }

    public void setSessionListener(String sessionId, AlpineSessionListener listener) {
        sessionListeners.put(sessionId, listener);
    }

    public boolean isSessionActive(String sessionId) {
        Process process = sessions.get(sessionId);
        return process != null && process.isAlive();
    }

    public List<String> getActiveSessions() {
        return new ArrayList<>(sessions.keySet());
    }

    /**
     * Install packages via apk (Alpine package manager)
     */
    public void installPackages(List<String> packages) throws IOException {
        if (packages == null || packages.isEmpty()) return;

        String pkgList = String.join(" ", packages);
        String installCmd = "apk add --no-cache " + pkgList + "\n";

        // Send to all active sessions or a dedicated system session
        for (String sessionId : sessions.keySet()) {
            sendCommand(sessionId, installCmd);
        }
    }

    /**
     * Execute a one-shot command and get output
     */
    public String executeOnce(String command) throws IOException, InterruptedException {
        ProcessBuilder pb = new ProcessBuilder(
            prootBinary.getAbsolutePath(),
            "--rootfs=" + alpineRootfs.getAbsolutePath(),
            "/bin/sh", "-c", command
        );

        pb.environment().put("PATH",
            "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
        );

        Process process = pb.start();

        StringBuilder output = new StringBuilder();
        BufferedReader reader = new BufferedReader(
            new InputStreamReader(process.getInputStream())
        );
        String line;
        while ((line = reader.readLine()) != null) {
            output.append(line).append("\n");
        }

        process.waitFor();
        return output.toString();
    }

    public File getAlpineDir() {
        return new File(filesDir, ALPINE_DIR);
    }

    public File getRootfs() {
        return alpineRootfs;
    }

    private void copyStream(InputStream in, OutputStream out) throws IOException {
        byte[] buf = new byte[8192];
        int n;
        while ((n = in.read(buf)) != -1) {
            out.write(buf, 0, n);
        }
    }

    public void shutdown() {
        // Stop all sessions
        for (String sessionId : new ArrayList<>(sessions.keySet())) {
            stopSession(sessionId);
        }

        Log.i(TAG, "Alpine Proot Manager shutdown");
    }
}

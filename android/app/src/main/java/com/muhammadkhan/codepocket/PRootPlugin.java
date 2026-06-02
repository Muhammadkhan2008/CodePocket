package com.muhammadkhan.codepocket;

import android.content.Context;
import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.IOException;

@CapacitorPlugin(name = "PRootPlugin")
public class PRootPlugin extends Plugin {

    private static final String TAG = "PRootPlugin";
    private Process currentProcess;
    private OutputStream processInput;
    private Thread readThread;
    private Thread errorThread;

    @PluginMethod
    public void initEnvironment(PluginCall call) {
        Context context = getContext();
        File filesDir = context.getFilesDir();
        File prootFile = new File(filesDir, "proot");
        File alpineDir = new File(filesDir, "alpine");

        new Thread(() -> {
            try {
                if (!prootFile.exists() || !alpineDir.exists()) {
                    Log.i(TAG, "Initializing Alpine Environment...");
                    notifyJS("Installing Core System... (Requires Internet)\r\n");

                    // Download PRoot
                    notifyJS("Downloading PRoot Engine...\r\n");
                    downloadFile("https://github.com/proot-me/proot/releases/download/v5.3.0/proot-v5.3.0-aarch64-static", prootFile);
                    prootFile.setExecutable(true);

                    // Download Alpine
                    notifyJS("Downloading Alpine Linux rootfs (~3MB)...\r\n");
                    File tarball = new File(filesDir, "alpine.tar.gz");
                    downloadFile("https://dl-cdn.alpinelinux.org/alpine/v3.19/releases/aarch64/alpine-minirootfs-3.19.1-aarch64.tar.gz", tarball);

                    // Extract Alpine using native tar
                    notifyJS("Extracting Alpine Linux...\r\n");
                    alpineDir.mkdirs();
                    Process tarProcess = Runtime.getRuntime().exec(new String[]{"tar", "-xzf", tarball.getAbsolutePath(), "-C", alpineDir.getAbsolutePath()});
                    tarProcess.waitFor();
                    tarball.delete(); // Cleanup
                    
                    // Write nameserver to resolv.conf so internet works inside alpine
                    File resolvConf = new File(alpineDir, "etc/resolv.conf");
                    if (!resolvConf.exists()) {
                        resolvConf.getParentFile().mkdirs();
                    }
                    FileOutputStream out = new FileOutputStream(resolvConf);
                    out.write("nameserver 8.8.8.8\nnameserver 1.1.1.1\n".getBytes());
                    out.close();

                    notifyJS("Environment initialized successfully!\r\n");
                } else {
                    notifyJS("Alpine Environment found.\r\n");
                }

                JSObject ret = new JSObject();
                ret.put("status", "ready");
                call.resolve(ret);
            } catch (Exception e) {
                Log.e(TAG, "Init failed", e);
                notifyJS("\x1b[31mInit Error: " + e.getMessage() + "\x1b[0m\r\n");
                call.reject("Init failed: " + e.getMessage());
            }
        }).start();
    }

    private void downloadFile(String urlStr, File dest) throws IOException {
        java.net.URL url = new java.net.URL(urlStr);
        java.net.HttpURLConnection conn = (java.net.HttpURLConnection) url.openConnection();
        conn.setInstanceFollowRedirects(true);
        conn.connect();
        
        // Handle redirects manually if needed
        int status = conn.getResponseCode();
        if (status == java.net.HttpURLConnection.HTTP_MOVED_TEMP || status == java.net.HttpURLConnection.HTTP_MOVED_PERM || status == java.net.HttpURLConnection.HTTP_SEE_OTHER) {
            String newUrl = conn.getHeaderField("Location");
            conn = (java.net.HttpURLConnection) new java.net.URL(newUrl).openConnection();
            conn.connect();
        }

        InputStream in = conn.getInputStream();
        FileOutputStream out = new FileOutputStream(dest);
        byte[] buffer = new byte[8192];
        int read;
        while ((read = in.read(buffer)) != -1) {
            out.write(buffer, 0, read);
        }
        in.close();
        out.close();
    }

    @PluginMethod
    public void startSession(PluginCall call) {
        if (currentProcess != null) {
            currentProcess.destroy();
        }

        try {
            File filesDir = getContext().getFilesDir();
            String prootPath = new File(filesDir, "proot").getAbsolutePath();
            String alpinePath = new File(filesDir, "alpine").getAbsolutePath();

            // Check if proot exists, else fallback to standard Android shell
            ProcessBuilder pb;
            if (new File(prootPath).exists()) {
                // Binding /dev, /proc, /sys is critical for PRoot!
                pb = new ProcessBuilder(prootPath, "--bind=/dev", "--bind=/proc", "--bind=/sys", "-S", alpinePath, "/bin/sh");
            } else {
                pb = new ProcessBuilder("/system/bin/sh");
            }

            pb.environment().put("TERM", "xterm-256color");
            pb.environment().put("HOME", "/root");
            pb.environment().put("PATH", "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin");
            pb.redirectErrorStream(true); // merge stderr into stdout
            
            currentProcess = pb.start();
            processInput = currentProcess.getOutputStream();

            InputStream processOutput = currentProcess.getInputStream();

            readThread = new Thread(() -> {
                byte[] buffer = new byte[4096];
                int read;
                try {
                    while ((read = processOutput.read(buffer)) > 0) {
                        String outputStr = new String(buffer, 0, read);
                        notifyJS(outputStr);
                    }
                } catch (IOException e) {
                    Log.e(TAG, "Read thread error", e);
                }
                notifyJS("\r\n[Process Exited]\r\n");
            });
            readThread.start();

            call.resolve();
        } catch (Exception e) {
            Log.e(TAG, "Failed to start session", e);
            call.reject("Failed to start session: " + e.getMessage());
        }
    }

    @PluginMethod
    public void writeData(PluginCall call) {
        String data = call.getString("data");
        if (data == null || processInput == null) {
            call.resolve();
            return;
        }

        try {
            processInput.write(data.getBytes());
            processInput.flush();
            call.resolve();
        } catch (IOException e) {
            Log.e(TAG, "Failed to write data", e);
            call.reject("Failed to write data: " + e.getMessage());
        }
    }
    
    // One-shot command execution for compiler bypass if needed
    @PluginMethod
    public void executeCommand(PluginCall call) {
        String command = call.getString("command");
        if (command == null) {
            call.reject("Must provide a command");
            return;
        }

        try {
            Process process = Runtime.getRuntime().exec(new String[]{"sh", "-c", command});
            java.io.BufferedReader reader = new java.io.BufferedReader(new java.io.InputStreamReader(process.getInputStream()));
            java.io.BufferedReader errorReader = new java.io.BufferedReader(new java.io.InputStreamReader(process.getErrorStream()));
            StringBuilder output = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) output.append(line).append("\n");
            while ((line = errorReader.readLine()) != null) output.append(line).append("\n");
            process.waitFor();
            
            JSObject ret = new JSObject();
            ret.put("output", output.toString());
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Execution failed: " + e.getMessage());
        }
    }

    private void notifyJS(String data) {
        JSObject ret = new JSObject();
        ret.put("data", data);
        notifyListeners("terminal_output", ret);
    }

    private void copyAssetFile(Context context, String assetPath, File dest) throws IOException {
        InputStream in = context.getAssets().open(assetPath);
        FileOutputStream out = new FileOutputStream(dest);
        byte[] buffer = new byte[8192];
        int read;
        while ((read = in.read(buffer)) != -1) {
            out.write(buffer, 0, read);
        }
        in.close();
        out.close();
    }
}

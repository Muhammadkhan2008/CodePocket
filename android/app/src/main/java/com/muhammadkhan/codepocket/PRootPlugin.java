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
import java.util.HashMap;

@CapacitorPlugin(name = "PRootPlugin")
public class PRootPlugin extends Plugin {

    private static final String TAG = "PRootPlugin";
    
    private HashMap<String, Process> processes = new HashMap<>();
    private HashMap<String, OutputStream> outputStreams = new HashMap<>();

    @PluginMethod
    public void initEnvironment(PluginCall call) {
        Context context = getContext();
        File filesDir = context.getFilesDir();
        File alpineDir = new File(filesDir, "alpine");

        new Thread(() -> {
            try {
                if (!alpineDir.exists()) {
                    Log.i(TAG, "Initializing Alpine Environment...");
                    notifyJS("system", "Installing Core System from bundled assets...\r\n");

                    // Copy Alpine tarball from APK bundled assets
                    File tarball = new File(filesDir, "alpine.tar.gz");
                    copyAssetFile(context, "public/assets/native/alpine.tar.gz", tarball);

                    // Extract Alpine using native tar
                    notifyJS("system", "Extracting Alpine Linux...\r\n");
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

                    notifyJS("system", "Environment initialized successfully!\r\n");
                } else {
                    notifyJS("system", "Alpine Environment found.\r\n");
                }

                JSObject ret = new JSObject();
                ret.put("status", "ready");
                call.resolve(ret);
            } catch (Exception e) {
                Log.e(TAG, "Init failed", e);
                notifyJS("system", "\u001b[31mInit Error: " + e.getMessage() + "\u001b[0m\r\n");
                call.reject("Init failed: " + e.getMessage());
            }
        }).start();
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

    @PluginMethod
    public void startSession(PluginCall call) {
        String sessionId = call.getString("sessionId", "default");
        
        if (processes.containsKey(sessionId)) {
            processes.get(sessionId).destroy();
            processes.remove(sessionId);
            outputStreams.remove(sessionId);
        }

        try {
            File filesDir = getContext().getFilesDir();
            String alpinePath = new File(filesDir, "alpine").getAbsolutePath();
            
            // JNI Hack: Find the extracted libproot.so
            String prootPath = getContext().getApplicationInfo().nativeLibraryDir + "/libproot.so";

            ProcessBuilder pb;
            if (new File(prootPath).exists()) {
                pb = new ProcessBuilder(prootPath, "--bind=/dev", "--bind=/proc", "--bind=/sys", "-S", alpinePath, "/bin/sh");
            } else {
                notifyJS(sessionId, "\u001b[31mError: libproot.so not found! Falling back to Android shell.\u001b[0m\r\n");
                pb = new ProcessBuilder("/system/bin/sh");
            }

            pb.environment().put("TERM", "xterm-256color");
            pb.environment().put("HOME", "/root");
            pb.environment().put("PATH", "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin");
            pb.redirectErrorStream(true);
            
            Process currentProcess = pb.start();
            processes.put(sessionId, currentProcess);
            outputStreams.put(sessionId, currentProcess.getOutputStream());

            InputStream processOutput = currentProcess.getInputStream();

            Thread readThread = new Thread(() -> {
                byte[] buffer = new byte[4096];
                int read;
                try {
                    while ((read = processOutput.read(buffer)) > 0) {
                        String outputStr = new String(buffer, 0, read);
                        notifyJS(sessionId, outputStr);
                    }
                } catch (IOException e) {
                    Log.e(TAG, "Read thread error", e);
                }
                notifyJS(sessionId, "\r\n[Process Exited]\r\n");
                processes.remove(sessionId);
                outputStreams.remove(sessionId);
            });
            readThread.start();

            JSObject ret = new JSObject();
            ret.put("sessionId", sessionId);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Failed to start session", e);
            notifyJS(sessionId, "\u001b[31mLaunch Error: " + e.getMessage() + "\u001b[0m\r\n");
            call.reject("Failed to start session: " + e.getMessage());
        }
    }

    @PluginMethod
    public void writeData(PluginCall call) {
        String sessionId = call.getString("sessionId", "default");
        String data = call.getString("data");
        
        OutputStream processInput = outputStreams.get(sessionId);

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
    
    private void notifyJS(String sessionId, String data) {
        JSObject ret = new JSObject();
        ret.put("sessionId", sessionId);
        ret.put("data", data);
        notifyListeners("terminal_output", ret);
    }
}

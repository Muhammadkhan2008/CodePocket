package com.muhammadkhan.codepocket;
import android.os.Build;
import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.*;
import java.util.*;

@CapacitorPlugin(name = "PRootPlugin")
public class PRootPlugin extends Plugin {
    private static final String TAG = "PRootPlugin";
    private static final String DEF = "default";
    private final Map<String,Process> sessions = new HashMap<>();
    private boolean ready = false;

    private String getAbi() {
        String[] a = Build.SUPPORTED_ABIS;
        if (a != null && a.length > 0) {
            if (a[0].contains("arm64") || a[0].contains("aarch64")) return "proot_arm64";
            if (a[0].contains("x86_64")) return "proot_x86_64";
            if (a[0].contains("armeabi")) return "proot_arm";
        }
        return "proot_arm64";
    }

    // Loader asset name matches the ABI - proot REQUIRES this to work
    private String getLoaderAsset() {
        String[] a = Build.SUPPORTED_ABIS;
        if (a != null && a.length > 0) {
            if (a[0].contains("arm64") || a[0].contains("aarch64")) return "loader_arm64";
            if (a[0].contains("x86_64")) return "loader_x86_64";
            if (a[0].contains("armeabi")) return "loader_arm";
        }
        return "loader_arm64";
    }

    private void cp(InputStream i, OutputStream o) throws IOException {
        byte[] b = new byte[65536]; int n;
        while ((n = i.read(b)) != -1) o.write(b, 0, n);
    }

    private void emit(String sid, String data) {
        JSObject o = new JSObject();
        o.put("sessionId", sid); o.put("data", data);
        notifyListeners("terminal_output", o);
    }

    @PluginMethod
    public void initEnvironment(PluginCall call) {
        new Thread(() -> {
            try {
                File fd = getContext().getFilesDir();
                File ad = new File(fd, "alpine");
                File done = new File(ad, ".done");
                if (!done.exists()) {
                    ad.mkdirs();
                    emit(DEF, "\u001B[36m[+] Extracting Alpine Linux...\u001B[0m\r\n");
                    File tb = new File(fd, "alpine.tar.gz");
                    try (InputStream in = getContext().getAssets().open("public/native/alpine.bin");
                         FileOutputStream out = new FileOutputStream(tb)) { cp(in, out); }
                    Process tar = new ProcessBuilder("tar","-xzf",tb.getAbsolutePath(),"-C",ad.getAbsolutePath())
                        .redirectErrorStream(true).start();
                    int exit = tar.waitFor();
                    tb.delete();
                    if (exit != 0) {
                        emit(DEF, "\u001B[31m[!] Alpine extract failed\u001B[0m\r\n");
                        call.resolve(); return;
                    }
                    for (String d : new String[]{"proc","sys","dev","dev/pts","tmp","root","root/workspace","etc","usr/bin","usr/sbin","bin","sbin"})
                        new File(ad, d).mkdirs();
                    try (PrintWriter pw = new PrintWriter(new File(ad,"etc/resolv.conf")))
                        { pw.println("nameserver 8.8.8.8"); pw.println("nameserver 1.1.1.1"); }
                    try (PrintWriter pw = new PrintWriter(new File(ad,"etc/passwd")))
                        { pw.println("root:x:0:0:root:/root:/bin/sh"); }
                    try (PrintWriter pw = new PrintWriter(new File(ad,"root/.profile"))) {
                        pw.println("export HOME=/root TERM=xterm-256color");
                        pw.println("export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin");
                        pw.println("alias ll='ls -la' cls='clear'");
                    }
                    done.createNewFile();
                    emit(DEF, "\u001B[32m[+] Alpine Linux ready!\u001B[0m\r\n");
                }
                File proot = new File(fd, "proot");
                if (!proot.exists() || proot.length() < 1000) {
                    String abiName = getAbi();
                    emit(DEF, "\u001B[36m[+] Extracting PRoot (" + abiName + ")...\u001B[0m\r\n");
                    try (InputStream in = getContext().getAssets().open("public/native/" + abiName);
                         FileOutputStream out = new FileOutputStream(proot)) { cp(in, out); }
                    new ProcessBuilder("chmod","+x",proot.getAbsolutePath()).start().waitFor();
                    emit(DEF, "\u001B[32m[+] PRoot ready!\u001B[0m\r\n");
                }
                // CRITICAL: extract proot loader - proot fails without PROOT_LOADER
                File loader = new File(fd, "proot_loader");
                if (!loader.exists() || loader.length() < 100) {
                    try (InputStream lin = getContext().getAssets().open("public/native/" + getLoaderAsset());
                         FileOutputStream lout = new FileOutputStream(loader)) { cp(lin, lout); }
                    new ProcessBuilder("chmod","+x",loader.getAbsolutePath()).start().waitFor();
                }
                ready = true;
                call.resolve();
            } catch (Exception e) {
                Log.e(TAG, "init: " + e.getMessage(), e);
                ready = false;
                call.resolve();
            }
        }).start();
    }

    @PluginMethod
    public void startSession(PluginCall call) {
        String sid = call.getString("sessionId", DEF);
        kill(sid);
        new Thread(() -> {
            try {
                File fd = getContext().getFilesDir();
                File ad = new File(fd, "alpine");
                File proot = new File(fd, "proot");
                File binSh = new File(ad, "bin/sh");
                ProcessBuilder pb;
                if (ready && proot.exists() && proot.length() > 1000 && binSh.exists()) {
                    pb = new ProcessBuilder(proot.getAbsolutePath(),
                        "--rootfs=" + ad.getAbsolutePath(),
                        "--bind=/dev","--bind=/proc","--bind=/sys",
                        "--cwd=/root","--kill-on-exit","/bin/sh","--login");
                    emit(sid, "\u001B[32m\r\n  Alpine Linux Terminal - CodePocket\r\n  python3 | gcc | node | git\r\n\u001B[0m\r\n");
                } else {
                    pb = new ProcessBuilder("/system/bin/sh");
                    String why = !proot.exists() ? "proot missing" : proot.length()<1000 ? "proot corrupt" : "bin/sh missing";
                    emit(sid, "\u001B[33m\r\n  System Shell (" + why + ")\r\n  ls,cd,cat,echo,pwd work\r\n\u001B[0m\r\n");
                }
                Map<String,String> env = pb.environment();
                env.put("TERM","xterm-256color"); env.put("HOME","/root");
                env.put("USER","root"); env.put("SHELL","/bin/sh");
                env.put("LC_ALL","C");
                env.put("PATH","/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin");
                File loaderFile = new File(fd, "proot_loader");
                if (loaderFile.exists()) env.put("PROOT_LOADER", loaderFile.getAbsolutePath());
                env.put("PROOT_TMP_DIR", new File(fd, "alpine/tmp").getAbsolutePath());
                pb.redirectErrorStream(true);
                Process proc = pb.start();
                sessions.put(sid, proc);
                proc.getOutputStream().write("\n".getBytes("UTF-8"));
                proc.getOutputStream().flush();
                final String s = sid;
                new Thread(() -> {
                    byte[] buf = new byte[4096]; int n;
                    try { while ((n=proc.getInputStream().read(buf))!=-1) emit(s,new String(buf,0,n,"UTF-8")); }
                    catch (IOException ignored) {}
                    sessions.remove(s);
                    emit(s,"\r\n\u001B[33m[session ended]\u001B[0m\r\n");
                }).start();
                call.resolve();
            } catch (Exception e) { call.reject(e.getMessage()); }
        }).start();
    }

    @PluginMethod
    public void writeData(PluginCall call) {
        String sid = call.getString("sessionId", DEF);
        String data = call.getString("data", "");
        Process p = sessions.get(sid);
        if (p == null) { call.reject("no session"); return; }
        new Thread(() -> {
            try { p.getOutputStream().write(data.getBytes("UTF-8")); p.getOutputStream().flush(); call.resolve(); }
            catch (IOException e) { call.reject(e.getMessage()); }
        }).start();
    }

    @PluginMethod
    public void resizeTerminal(PluginCall call) {
        int cols = call.getInt("cols",80), rows = call.getInt("rows",24);
        Process p = sessions.get(call.getString("sessionId",DEF));
        if (p!=null) new Thread(()->{
            try { p.getOutputStream().write(("stty cols "+cols+" rows "+rows+"\n").getBytes()); p.getOutputStream().flush(); }
            catch(IOException ignored){}
        }).start();
        JSObject r=new JSObject(); r.put("cols",cols); r.put("rows",rows); call.resolve(r);
    }

    @PluginMethod
    public void stopSession(PluginCall call) { kill(call.getString("sessionId",DEF)); call.resolve(); }

    private void kill(String id) { Process p=sessions.remove(id); if(p!=null) try{p.destroy();}catch(Exception ignored){} }
}
package com.muhammadkhan.codepocket;

import android.app.Application;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import org.json.JSONObject;

import java.io.File;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * CodePocket Application
 * Extended initialization, crash handling, global state
 * Acode-style app initialization with plugin engine and settings
 */
public class CodePocketApp extends Application {

    private static final String TAG = "CodePocketApp";
    private static final String PREFS_NAME = "codepocket_prefs";
    private static final String KEY_FIRST_RUN = "first_run";
    private static final String KEY_NATIVE_READY = "native_ready";

    private static CodePocketApp instance;
    private static ExecutorService executorService;
    private static Handler mainHandler;

    private boolean isProotReady = false;
    private boolean isPluginEngineReady = false;

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;

        executorService = Executors.newCachedThreadPool();
        mainHandler = new Handler(Looper.getMainLooper());

        setupCrashHandler();
        initializeSettings();
        initializePluginsDir();
        initializeTempDir();

        Log.i(TAG, "CodePocket Application initialized");
    }

    public static CodePocketApp getInstance() {
        return instance;
    }

    public static ExecutorService getExecutor() {
        return executorService;
    }

    public static void runOnUiThread(Runnable runnable) {
        mainHandler.post(runnable);
    }

    public static void runOnBackground(Runnable runnable) {
        executorService.submit(runnable);
    }

    public static Context getAppContext() {
        return instance.getApplicationContext();
    }

    private void setupCrashHandler() {
        Thread.setDefaultUncaughtExceptionHandler((thread, throwable) -> {
            Log.e(TAG, "Uncaught exception", throwable);

            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
            prefs.edit()
                .putString("last_crash", throwable.getMessage())
                .putLong("last_crash_time", System.currentTimeMillis())
                .apply();

            System.exit(1);
        });
    }

    private void initializeSettings() {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);

        if (prefs.getBoolean(KEY_FIRST_RUN, true)) {
            prefs.edit()
                .putBoolean(KEY_FIRST_RUN, false)
                .putBoolean("auto_save", true)
                .putBoolean("word_wrap", false)
                .putBoolean("line_numbers", true)
                .putBoolean("minimap", false)
                .putInt("font_size", 14)
                .putInt("tab_size", 2)
                .putString("theme", "one-dark")
                .putString("encoding", "utf-8")
                .putString("eol", "\n")
                .apply();

            Log.i(TAG, "Default settings initialized");
        }
    }

    private void initializePluginsDir() {
        File pluginsDir = new File(getFilesDir(), "plugins");
        if (!pluginsDir.exists()) {
            pluginsDir.mkdirs();
            Log.i(TAG, "Plugins directory created: " + pluginsDir.getAbsolutePath());
        }

        File pluginsDataDir = new File(getFilesDir(), "plugins_data");
        if (!pluginsDataDir.exists()) {
            pluginsDataDir.mkdirs();
        }
    }

    private void initializeTempDir() {
        File tempDir = new File(getCacheDir(), "codepocket_temp");
        if (!tempDir.exists()) {
            tempDir.mkdirs();
        }

        // Clean old temp files on startup
        cleanTempDir(tempDir);
    }

    private void cleanTempDir(File tempDir) {
        File[] files = tempDir.listFiles();
        if (files != null) {
            for (File file : files) {
                if (file.isFile()) {
                    file.delete();
                }
            }
        }
    }

    public void setProotReady(boolean ready) {
        this.isProotReady = ready;
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        prefs.edit().putBoolean(KEY_NATIVE_READY, ready).apply();
    }

    public boolean isProotReady() {
        return isProotReady;
    }

    public void setPluginEngineReady(boolean ready) {
        this.isPluginEngineReady = ready;
    }

    public boolean isPluginEngineReady() {
        return isPluginEngineReady;
    }

    public SharedPreferences getSettings() {
        return getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
    }

    public String getWorkspaceDir() {
        File workspace = new File(getFilesDir(), "workspace");
        if (!workspace.exists()) {
            workspace.mkdirs();
        }
        return workspace.getAbsolutePath();
    }

    public String getProjectsDir() {
        File projects = new File(getFilesDir(), "projects");
        if (!projects.exists()) {
            projects.mkdirs();
        }
        return projects.getAbsolutePath();
    }

    public String getPluginDir() {
        return new File(getFilesDir(), "plugins").getAbsolutePath();
    }
}

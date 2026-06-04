package com.muhammadkhan.codepocket;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.*;
import java.util.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Plugin Engine
 * Acode-style plugin system with marketplace, hot-reload, dependencies
 */
public class PluginEngine {

    private static final String TAG = "PluginEngine";

    private static final String PLUGINS_DIR = "plugins";
    private static final String PLUGINS_DATA_DIR = "plugins_data";
    private static final String PLUGINS_CONFIG = "plugins_config.json";

    private final Context context;
    private final File pluginsDir;
    private final File pluginsDataDir;
    private final File pluginsConfigFile;

    private final ExecutorService executor = Executors.newCachedThreadPool();
    private final Map<String, PluginInstance> loadedPlugins = new ConcurrentHashMap<>();
    private final JSONObject pluginsConfig;

    public static class PluginInstance {
        public String id;
        public String name;
        public String version;
        public String path;
        public String code;
        public JSONObject metadata;
        public boolean enabled;
        public long loadedAt;
    }

    public PluginEngine(Context context) {
        this.context = context;
        this.pluginsDir = new File(context.getFilesDir(), PLUGINS_DIR);
        this.pluginsDataDir = new File(context.getFilesDir(), PLUGINS_DATA_DIR);
        this.pluginsConfigFile = new File(context.getFilesDir(), PLUGINS_CONFIG);

        // Ensure dirs exist
        pluginsDir.mkdirs();
        pluginsDataDir.mkdirs();

        // Load config
        this.pluginsConfig = loadPluginsConfig();
    }

    /**
     * Get list of installed plugins
     */
    public List<PluginInstance> getInstalledPlugins() {
        List<PluginInstance> list = new ArrayList<>();

        File[] files = pluginsDir.listFiles((dir, name) -> name.endsWith(".js"));
        if (files == null) return list;

        for (File f : files) {
            PluginInstance instance = new PluginInstance();
            instance.id = f.getName().replace(".js", "");
            instance.path = f.getAbsolutePath();
            instance.enabled = true;

            try {
                instance.code = readFile(f);
            } catch (IOException e) {
                Log.e(TAG, "Failed to read plugin: " + instance.id, e);
            }

            list.add(instance);
        }

        return list;
    }

    /**
     * Install plugin from code
     */
    public void installPlugin(String pluginId, String code) throws IOException {
        File pluginFile = new File(pluginsDir, pluginId + ".js");
        writeFile(pluginFile, code);

        PluginInstance instance = new PluginInstance();
        instance.id = pluginId;
        instance.path = pluginFile.getAbsolutePath();
        instance.code = code;
        instance.enabled = true;

        loadedPlugins.put(pluginId, instance);

        Log.i(TAG, "Plugin installed: " + pluginId);
    }

    /**
     * Install plugin from file
     */
    public void installPluginFromFile(File pluginFile) throws IOException {
        String pluginId = pluginFile.getName().replace(".js", "");
        String code = readFile(pluginFile);
        installPlugin(pluginId, code);
    }

    /**
     * Uninstall a plugin
     */
    public void uninstallPlugin(String pluginId) {
        File pluginFile = new File(pluginsDir, pluginId + ".js");
        if (pluginFile.exists()) {
            pluginFile.delete();
        }

        File dataFile = new File(pluginsDataDir, pluginId + ".json");
        if (dataFile.exists()) {
            dataFile.delete();
        }

        loadedPlugins.remove(pluginId);

        Log.i(TAG, "Plugin uninstalled: " + pluginId);
    }

    /**
     * Enable/disable a plugin
     */
    public void setPluginEnabled(String pluginId, boolean enabled) {
        PluginInstance instance = loadedPlugins.get(pluginId);
        if (instance != null) {
            instance.enabled = enabled;
        }

        try {
            if (pluginsConfig.has(pluginId)) {
                JSONObject pluginConf = pluginsConfig.getJSONObject(pluginId);
                pluginConf.put("enabled", enabled);
            } else {
                JSONObject pluginConf = new JSONObject();
                pluginConf.put("enabled", enabled);
                pluginsConfig.put(pluginId, pluginConf);
            }

            savePluginsConfig();
        } catch (JSONException e) {
            Log.e(TAG, "Failed to update plugin config", e);
        }
    }

    /**
     * Get plugin data directory
     */
    public File getPluginDataDir(String pluginId) {
        File dataDir = new File(pluginsDataDir, pluginId);
        if (!dataDir.exists()) {
            dataDir.mkdirs();
        }
        return dataDir;
    }

    /**
     * Read plugin setting
     */
    public String getPluginSetting(String pluginId, String key, String defaultValue) {
        try {
            File dataFile = new File(pluginsDataDir, pluginId + ".json");
            if (!dataFile.exists()) return defaultValue;

            JSONObject data = new JSONObject(readFile(dataFile));
            return data.optString(key, defaultValue);
        } catch (Exception e) {
            Log.e(TAG, "Failed to read plugin setting", e);
            return defaultValue;
        }
    }

    /**
     * Save plugin setting
     */
    public void setPluginSetting(String pluginId, String key, String value) {
        try {
            File dataFile = new File(pluginsDataDir, pluginId + ".json");
            JSONObject data;

            if (dataFile.exists()) {
                data = new JSONObject(readFile(dataFile));
            } else {
                data = new JSONObject();
            }

            data.put(key, value);
            writeFile(dataFile, data.toString(2));
        } catch (Exception e) {
            Log.e(TAG, "Failed to save plugin setting", e);
        }
    }

    private JSONObject loadPluginsConfig() {
        try {
            if (pluginsConfigFile.exists()) {
                return new JSONObject(readFile(pluginsConfigFile));
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to load plugins config", e);
        }
        return new JSONObject();
    }

    private void savePluginsConfig() {
        try {
            writeFile(pluginsConfigFile, pluginsConfig.toString(2));
        } catch (IOException e) {
            Log.e(TAG, "Failed to save plugins config", e);
        }
    }

    private String readFile(File file) throws IOException {
        BufferedReader reader = new BufferedReader(new FileReader(file));
        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) {
            sb.append(line).append("\n");
        }
        reader.close();
        return sb.toString();
    }

    private void writeFile(File file, String content) throws IOException {
        FileWriter writer = new FileWriter(file);
        writer.write(content);
        writer.close();
    }

    /**
     * Get marketplace plugins (demo list)
     */
    public List<JSONObject> getMarketplacePlugins() {
        List<JSONObject> list = new ArrayList<>();

        // Demo marketplace plugins (in real app, fetch from server)
        String[] demoPlugins = {
            "{\"id\":\"autocomplete\",\"name\":\"Autocomplete\",\"version\":\"1.0\",\"author\":\"CodePocket\",\"description\":\"Advanced code completion\"}",
            "{\"id\":\"autosuggest\",\"name\":\"AI Autosuggest\",\"version\":\"1.0\",\"author\":\"CodePocket\",\"description\":\"Smart line suggestions\"}",
            "{\"id\":\"react-snippets\",\"name\":\"React Snippets\",\"version\":\"1.0\",\"author\":\"CodePocket\",\"description\":\"Insert React components\"}",
            "{\"id\":\"dracula-theme\",\"name\":\"Dracula Theme\",\"version\":\"1.0\",\"author\":\"Dracula\",\"description\":\"Dark mode for vampires\"}",
            "{\"id\":\"monokai-theme\",\"name\":\"Monokai Theme\",\"version\":\"1.0\",\"author\":\"Monokai\",\"description\":\"Classic warm theme\"}",
            "{\"id\":\"hacker-mode\",\"name\":\"Hacker Mode\",\"version\":\"1.0\",\"author\":\"CodePocket\",\"description\":\"Matrix style terminal UI\"}",
            "{\"id\":\"word-counter\",\"name\":\"Word Counter\",\"version\":\"1.0\",\"author\":\"Utils\",\"description\":\"Track lines and characters\"}",
            "{\"id\":\"live-clock\",\"name\":\"Live Clock\",\"version\":\"1.0\",\"author\":\"UI\",\"description\":\"Clock injected in header\"}"
        };

        for (String json : demoPlugins) {
            try {
                list.add(new JSONObject(json));
            } catch (JSONException e) {
                Log.e(TAG, "Failed to parse demo plugin", e);
            }
        }

        return list;
    }
}

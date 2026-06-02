package com.muhammadkhan.codepocket;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.File;

@CapacitorPlugin(name = "PRootPlugin")
public class PRootPlugin extends Plugin {

    @PluginMethod
    public void executeCommand(PluginCall call) {
        String command = call.getString("command");
        if (command == null) {
            call.reject("Must provide a command");
            return;
        }

        try {
            // Future Alpine Implementation:
            // Extract alpine tarball and proot binary
            // String prootPath = getContext().getFilesDir().getAbsolutePath() + "/proot";
            // String alpinePath = getContext().getFilesDir().getAbsolutePath() + "/alpine";
            // Process process = Runtime.getRuntime().exec(new String[]{prootPath, "-S", alpinePath, "/bin/sh", "-c", command});

            // Standard Android Shell Execution for the bridge
            Process process = Runtime.getRuntime().exec(new String[]{"sh", "-c", command});
            
            BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
            BufferedReader errorReader = new BufferedReader(new InputStreamReader(process.getErrorStream()));
            
            StringBuilder output = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                output.append(line).append("\n");
            }
            while ((line = errorReader.readLine()) != null) {
                output.append(line).append("\n");
            }
            
            process.waitFor();
            
            JSObject ret = new JSObject();
            ret.put("output", output.toString());
            call.resolve(ret);

        } catch (Exception e) {
            call.reject("Execution failed: " + e.getMessage());
        }
    }
}

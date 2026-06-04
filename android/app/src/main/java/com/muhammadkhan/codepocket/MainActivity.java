package com.muhammadkhan.codepocket;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register all plugins
        registerPlugin(PRootPlugin.class);
        registerPlugin(PluginEngine.class);
        super.onCreate(savedInstanceState);
    }
}

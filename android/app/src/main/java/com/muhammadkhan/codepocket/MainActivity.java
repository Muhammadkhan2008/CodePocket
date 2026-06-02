package com.muhammadkhan.codepocket;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PRootPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

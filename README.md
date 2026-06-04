# CodePocket - Professional Mobile IDE

**CodePocket** is a powerful, professional-grade mobile code editor and IDE for Android/iOS, inspired by Acode. Built with Capacitor, CodeMirror 6, and xterm.js.

## ✨ New Features in v2.0

### 🤖 AI Coding Assistant
- Intelligent code completion
- Context-aware suggestions
- Multi-language support

### 🔄 Git Integration
- Version control operations
- Commit, push, pull
- Branch management

### 🐛 Debugging Tools
- Error highlighting
- Runtime debugging
- Code analysis

### 🐧 Alpine Linux Terminal
- Full Linux environment
- Python, Java, Node.js pre-installed
- GCC/G++ compiler support

### 🔌 Plugin System
- Dynamic plugin loading
- Custom themes
- Extended functionality

### 🎨 Enhanced UI
- Catppuccin Mocha theme
- Responsive design
- Multi-panel layout

## 📱 Build APK

### Prerequisites
```bash
# 1. Install Node.js (v18+)
node --version

# 2. Install Java JDK 17
java -version

# 3. Install Android SDK
# Download from: https://developer.android.com/studio#command-tools
export ANDROID_HOME=/path/to/android-sdk

# 4. Install dependencies
npm install -g @capacitor/cli
```

### Build Steps
```bash
# 1. Clone repository
git clone https://github.com/Muhammadkhan2008/CodePocket.git
cd CodePocket

# 2. Install dependencies
npm install

# 3. Build web assets
npm run build

# 4. Sync Capacitor
npx cap sync android

# 5. Build APK
cd android
./gradlew assembleDebug

# 6. APK will be at:
# android/app/build/outputs/apk/debug/app-debug.apk
```

### Install APK
```bash
# Transfer to phone and install
adb install android/app/build/outputs/apk/debug/app-debug.apk

# Or directly on device
# Copy APK to phone → Enable "Unknown Sources" → Install
```

## 🛠️ Development Setup

```bash
# Run in browser
npm run dev

# Run on Android device
npx cap run android

# Run on iOS device
npx cap run ios
```

## 📝 License

MIT License - Feel free to use and modify!

## 👨‍💻 Author

**Muhammad Khan**
- GitHub: [@Muhammadkhan2008](https://github.com/Muhammadkhan2008)

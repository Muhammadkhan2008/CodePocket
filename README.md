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

### 🐛 Advanced Debugging
- Breakpoint support
- Variable inspection
- Call stack visualization

### 🐧 Alpine Linux Terminal
- Full Linux environment
- Python 3.12, Java 17, Node.js 20 pre-installed
- GCC, Go, Rust support

### 🔌 Plugin Marketplace
- 12+ built-in plugins
- Auto-install from URL
- Custom plugin development

## 📦 Installation

### Prerequisites
- Node.js 18+
- Android Studio / Xcode
- Capacitor CLI

### Setup
```bash
# Clone repository
git clone https://github.com/Muhammadkhan2008/CodePocket.git
cd CodePocket

# Install dependencies
npm install

# Build web assets
npm run build

# Sync with native
npx cap sync

# Run on Android
npx cap run android
```

## 🚀 Building APK

```bash
# Generate release APK
cd android
./gradlew assembleRelease

# APK will be at:
# android/app/build/outputs/apk/release/app-release.apk
```

## 📝 License

MIT License - Feel free to use and modify!

## 👨‍💻 Author

**Muhammad Khan**
- GitHub: [@Muhammadkhan2008](https://github.com/Muhammadkhan2008)

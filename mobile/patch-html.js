const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, 'dist', 'index.html');

if (!fs.existsSync(targetPath)) {
  console.log('patch-html.js: dist/index.html not found, skipping.');
  process.exit(0);
}

let html = fs.readFileSync(targetPath, 'utf8');

// 1. Replace viewport meta & inject anti-cache meta tags
const antiCacheMeta = '\n    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />\n    <meta http-equiv="Pragma" content="no-cache" />\n    <meta http-equiv="Expires" content="0" />';
const antiZoomViewport = '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no, shrink-to-fit=no, viewport-fit=cover" />\n    <meta name="HandheldFriendly" content="true" />\n    <meta name="MobileOptimized" content="width" />' + antiCacheMeta;
if (html.includes('<meta name="viewport"')) {
  html = html.replace(/<meta\s+name="viewport"[^>]*>/i, antiZoomViewport);
} else {
  html = html.replace('<head>', '<head>\n    ' + antiZoomViewport);
}

// 2. Inject anti-zoom CSS & JS if not already present
const antiZoomPayload = `
    <!-- STRICT ZERO ZOOM LOCKDOWN FOR MOBILE -->
    <style id="anti-zoom-style">
      @font-face { font-family: 'AntDesign'; src: url('https://cdnjs.cloudflare.com/ajax/libs/ant-design-icons/4.2.1/fonts/anticon.ttf') format('truetype'); }
      @font-face { font-family: 'Entypo'; src: url('https://cdnjs.cloudflare.com/ajax/libs/entypo/2.2.1/font/entypo.ttf') format('truetype'); }
      @font-face { font-family: 'EvilIcons'; src: url('https://cdnjs.cloudflare.com/ajax/libs/evil-icons/1.9.0/evil-icons.ttf') format('truetype'); }
      @font-face { font-family: 'Feather'; src: url('https://cdnjs.cloudflare.com/ajax/libs/feather-icons/4.28.0/feather.ttf') format('truetype'); }
      @font-face { font-family: 'FontAwesome'; src: url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/fonts/fontawesome-webfont.ttf') format('truetype'); }
      @font-face { font-family: 'FontAwesome5_Brands'; src: url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/webfonts/fa-brands-400.ttf') format('truetype'); }
      @font-face { font-family: 'FontAwesome5_Regular'; src: url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/webfonts/fa-regular-400.ttf') format('truetype'); }
      @font-face { font-family: 'FontAwesome5_Solid'; src: url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/webfonts/fa-solid-900.ttf') format('truetype'); }
      @font-face { font-family: 'Ionicons'; src: url('https://cdnjs.cloudflare.com/ajax/libs/ionicons/5.5.2/fonts/ionicons.ttf?v=5.5.2') format('truetype'); }
      @font-face { font-family: 'ionicons'; src: url('https://cdnjs.cloudflare.com/ajax/libs/ionicons/5.5.2/fonts/ionicons.ttf?v=5.5.2') format('truetype'); }
      @font-face { font-family: 'MaterialCommunityIcons'; src: url('https://cdn.jsdelivr.net/npm/@mdi/font@6.9.96/fonts/materialdesignicons-webfont.ttf') format('truetype'); }
      @font-face { font-family: 'MaterialIcons'; src: url('https://cdnjs.cloudflare.com/ajax/libs/material-design-icons/3.0.1/iconfont/MaterialIcons-Regular.ttf') format('truetype'); }
      @font-face { font-family: 'Material Icons'; src: url('https://cdnjs.cloudflare.com/ajax/libs/material-design-icons/3.0.1/iconfont/MaterialIcons-Regular.ttf') format('truetype'); }
      html, body, #root {
        touch-action: pan-x pan-y !important;
        -webkit-text-size-adjust: 100% !important;
        -moz-text-size-adjust: 100% !important;
        text-size-adjust: 100% !important;
        overflow-x: hidden !important;
        width: 100% !important;
        max-width: 100vw !important;
        position: relative !important;
      }
      *, *::before, *::after {
        touch-action: pan-x pan-y !important;
        -webkit-touch-callout: none !important;
      }
      input, select, textarea, [role="textbox"], [contenteditable="true"] {
        font-size: 16px !important;
      }
    </style>
    <script id="anti-zoom-script">
      (function () {
        function killPinch(e) {
          if (e.touches && e.touches.length > 1) {
            e.preventDefault();
          }
        }
        ['touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach(function (type) {
          window.addEventListener(type, killPinch, { passive: false, capture: true });
          document.addEventListener(type, killPinch, { passive: false, capture: true });
        });

        document.addEventListener('touchmove', function (e) {
          if ((e.scale !== undefined && e.scale !== 1) || (e.touches && e.touches.length > 1)) {
            e.preventDefault();
          }
        }, { passive: false, capture: true });

        ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (eventName) {
          window.addEventListener(eventName, function (e) {
            e.preventDefault();
          }, { passive: false, capture: true });
          document.addEventListener(eventName, function (e) {
            e.preventDefault();
          }, { passive: false, capture: true });
        });

        var lastTouchEnd = 0;
        document.addEventListener('touchend', function (e) {
          var now = Date.now();
          if (now - lastTouchEnd <= 300) {
            e.preventDefault();
          }
          lastTouchEnd = now;
        }, { passive: false, capture: true });

        window.addEventListener('dblclick', function (e) {
          e.preventDefault();
        }, { passive: false, capture: true });

        window.addEventListener('wheel', function (e) {
          if (e.ctrlKey) {
            e.preventDefault();
          }
        }, { passive: false });

        window.addEventListener('keydown', function (e) {
          if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0')) {
            e.preventDefault();
          }
        }, { capture: true });

        if (window.visualViewport) {
          var resetScale = function () {
            if (window.visualViewport.scale !== 1) {
              var meta = document.querySelector('meta[name="viewport"]');
              if (meta) {
                meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no, shrink-to-fit=no, viewport-fit=cover';
              }
            }
          };
          window.visualViewport.addEventListener('resize', resetScale);
          window.visualViewport.addEventListener('scroll', resetScale);
        }

        document.addEventListener('focusin', function (e) {
          if (e.target && /^(INPUT|SELECT|TEXTAREA)$/i.test(e.target.tagName)) {
            e.target.style.fontSize = '16px';
          }
        }, { capture: true });
      })();
    </script>
`;

if (!html.includes('anti-zoom-style')) {
  html = html.replace('</head>', antiZoomPayload + '\n  </head>');
}

fs.writeFileSync(targetPath, html, 'utf8');
console.log('patch-html.js: successfully injected zero-zoom protection into mobile dist/index.html');

// 3. Fix: replace the bundled JS script defer → no defer, and inject local font preloads
let html2 = fs.readFileSync(targetPath, 'utf8');

// Remove defer from the main bundle script so fonts load before paint
html2 = html2.replace(/<script src="\/_expo\/static\/js\/web\/[^"]+\.js" defer><\/script>/, (match) => {
  return match.replace(' defer', '');
});

// Build local @font-face rules using exact hashed bundled font files
const localFontFaces = `
  <!-- EXPO BUNDLED FONT PRELOADS -->
  <style id="expo-bundled-fonts">
    @font-face { font-family: 'AntDesign'; src: url('/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/AntDesign.3f78af31cca60105799838a1a7a59fbd.ttf') format('truetype'); font-display: block; }
    @font-face { font-family: 'Entypo'; src: url('/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Entypo.31b5ffea3daddc69dd01a1f3d6cf63c5.ttf') format('truetype'); font-display: block; }
    @font-face { font-family: 'EvilIcons'; src: url('/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/EvilIcons.140c53a7643ea949007aa9a282153849.ttf') format('truetype'); font-display: block; }
    @font-face { font-family: 'Feather'; src: url('/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Feather.ca4b48e04dc1ce10bfbddb262c8b835f.ttf') format('truetype'); font-display: block; }
    @font-face { font-family: 'FontAwesome'; src: url('/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/FontAwesome.b06871f281fee6b241d60582ae9369b9.ttf') format('truetype'); font-display: block; }
    @font-face { font-family: 'FontAwesome5_Brands'; src: url('/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/FontAwesome5_Brands.3b89dd103490708d19a95adcae52210e.ttf') format('truetype'); font-display: block; }
    @font-face { font-family: 'FontAwesome5_Regular'; src: url('/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/FontAwesome5_Regular.1f77739ca9ff2188b539c36f30ffa2be.ttf') format('truetype'); font-display: block; }
    @font-face { font-family: 'FontAwesome5_Solid'; src: url('/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/FontAwesome5_Solid.605ed7926cf39a2ad5ec2d1f9d391d3d.ttf') format('truetype'); font-display: block; }
    @font-face { font-family: 'FontAwesome6_Brands'; src: url('/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/FontAwesome6_Brands.56c8d80832e37783f12c05db7c8849e2.ttf') format('truetype'); font-display: block; }
    @font-face { font-family: 'FontAwesome6_Regular'; src: url('/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/FontAwesome6_Regular.370dd5af19f8364907b6e2c41f45dbbf.ttf') format('truetype'); font-display: block; }
    @font-face { font-family: 'FontAwesome6_Solid'; src: url('/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/FontAwesome6_Solid.adec7d6f310bc577f05e8fe06a5daccf.ttf') format('truetype'); font-display: block; }
    @font-face { font-family: 'Fontisto'; src: url('/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Fontisto.b49ae8ab2dbccb02c4d11caaacf09eab.ttf') format('truetype'); font-display: block; }
    @font-face { font-family: 'Foundation'; src: url('/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Foundation.e20945d7c929279ef7a6f1db184a4470.ttf') format('truetype'); font-display: block; }
    @font-face { font-family: 'Ionicons'; src: url('/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.b4eb097d35f44ed943676fd56f6bdc51.ttf') format('truetype'); font-display: block; }
    @font-face { font-family: 'MaterialCommunityIcons'; src: url('/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialCommunityIcons.6e435534bd35da5fef04168860a9b8fa.ttf') format('truetype'); font-display: block; }
    @font-face { font-family: 'MaterialIcons'; src: url('/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialIcons.4e85bc9ebe07e0340c9c4fc2f6c38908.ttf') format('truetype'); font-display: block; }
    @font-face { font-family: 'Material Icons'; src: url('/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialIcons.4e85bc9ebe07e0340c9c4fc2f6c38908.ttf') format('truetype'); font-display: block; }
    @font-face { font-family: 'Octicons'; src: url('/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Octicons.871378c6eab492a3e689a9385dc45a12.ttf') format('truetype'); font-display: block; }
    @font-face { font-family: 'SimpleLineIcons'; src: url('/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/SimpleLineIcons.d2285965fe34b05465047401b8595dd0.ttf') format('truetype'); font-display: block; }
    @font-face { font-family: 'Zocial'; src: url('/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Zocial.1681f34aaca71b8dfb70756bca331eb2.ttf') format('truetype'); font-display: block; }
  </style>
`;

// Remove old CDN font injection if present
html2 = html2.replace(/<style id="expo-vector-icons">[\s\S]*?<\/style>/g, '');
// Remove anti-zoom style block font-face declarations but keep anti-zoom CSS
// Inject our local fonts right after <head>
html2 = html2.replace('<head>', '<head>\n' + localFontFaces);

fs.writeFileSync(targetPath, html2, 'utf8');
console.log('patch-html.js: injected local bundled font-faces and removed script defer.');

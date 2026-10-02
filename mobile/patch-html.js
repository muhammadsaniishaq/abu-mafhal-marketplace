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

// 2. Comprehensive Expo & React Native Vector Icons font mapping
// react-native-vector-icons uses internal names like 'ionicons', 'material-community', 'material', 'anticon', 'feather'
const fontDefinitions = [
  {
    families: ['Ionicons', 'ionicons'],
    local: '/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.6148e7019854f3bde85b633cb88f3c25.ttf',
    cdn: 'https://cdnjs.cloudflare.com/ajax/libs/ionicons/5.5.2/fonts/ionicons.ttf?v=5.5.2'
  },
  {
    families: ['MaterialCommunityIcons', 'material-community', 'Material Community Icons'],
    local: '/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialCommunityIcons.b62641afc9ab487008e996a5c5865e56.ttf',
    cdn: 'https://cdn.jsdelivr.net/npm/@mdi/font@6.9.96/fonts/materialdesignicons-webfont.ttf'
  },
  {
    families: ['MaterialIcons', 'material', 'Material Icons'],
    local: '/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialIcons.4e85bc9ebe07e0340c9c4fc2f6c38908.ttf',
    cdn: 'https://cdnjs.cloudflare.com/ajax/libs/material-design-icons/3.0.1/iconfont/MaterialIcons-Regular.ttf'
  },
  {
    families: ['Feather', 'feather'],
    local: '/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Feather.a76d309774d33d9856f650bed4292a23.ttf',
    cdn: 'https://cdnjs.cloudflare.com/ajax/libs/feather-icons/4.28.0/feather.ttf'
  },
  {
    families: ['FontAwesome', 'fontawesome'],
    local: '/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/FontAwesome.b06871f281fee6b241d60582ae9369b9.ttf',
    cdn: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/fonts/fontawesome-webfont.ttf'
  },
  {
    families: ['FontAwesome5Free-Solid', 'FontAwesome5_Solid', 'FontAwesome5Solid'],
    local: '/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/FontAwesome5_Solid.605ed7926cf39a2ad5ec2d1f9d391d3d.ttf',
    cdn: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/webfonts/fa-solid-900.ttf'
  },
  {
    families: ['FontAwesome5Free-Regular', 'FontAwesome5_Regular', 'FontAwesome5Regular'],
    local: '/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/FontAwesome5_Regular.1f77739ca9ff2188b539c36f30ffa2be.ttf',
    cdn: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/webfonts/fa-regular-400.ttf'
  },
  {
    families: ['FontAwesome5Brands-Regular', 'FontAwesome5_Brands', 'FontAwesome5Free-Brand'],
    local: '/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/FontAwesome5_Brands.3b89dd103490708d19a95adcae52210e.ttf',
    cdn: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/webfonts/fa-brands-400.ttf'
  },
  {
    families: ['FontAwesome6Free-Solid', 'FontAwesome6_Solid', 'FontAwesome6Solid'],
    local: '/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/FontAwesome6_Solid.adec7d6f310bc577f05e8fe06a5daccf.ttf',
    cdn: ''
  },
  {
    families: ['FontAwesome6Free-Regular', 'FontAwesome6_Regular', 'FontAwesome6Regular'],
    local: '/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/FontAwesome6_Regular.370dd5af19f8364907b6e2c41f45dbbf.ttf',
    cdn: ''
  },
  {
    families: ['FontAwesome6Brands-Regular', 'FontAwesome6_Brands', 'FontAwesome6Free-Brand'],
    local: '/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/FontAwesome6_Brands.56c8d80832e37783f12c05db7c8849e2.ttf',
    cdn: ''
  },
  {
    families: ['AntDesign', 'anticon'],
    local: '/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/AntDesign.3a2ba31570920eeb9b1d217cabe58315.ttf',
    cdn: 'https://cdnjs.cloudflare.com/ajax/libs/ant-design-icons/4.2.1/fonts/anticon.ttf'
  },
  {
    families: ['Entypo', 'entypo'],
    local: '/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Entypo.31b5ffea3daddc69dd01a1f3d6cf63c5.ttf',
    cdn: 'https://cdnjs.cloudflare.com/ajax/libs/entypo/2.2.1/font/entypo.ttf'
  },
  {
    families: ['EvilIcons', 'evilicons'],
    local: '/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/EvilIcons.140c53a7643ea949007aa9a282153849.ttf',
    cdn: 'https://cdnjs.cloudflare.com/ajax/libs/evil-icons/1.9.0/evil-icons.ttf'
  },
  {
    families: ['Octicons', 'octicons'],
    local: '/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Octicons.f7c53c47a66934504fcbc7cc164895a7.ttf',
    cdn: ''
  },
  {
    families: ['SimpleLineIcons', 'simple-line-icons'],
    local: '/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/SimpleLineIcons.d2285965fe34b05465047401b8595dd0.ttf',
    cdn: ''
  },
  {
    families: ['Zocial', 'zocial'],
    local: '/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Zocial.1681f34aaca71b8dfb70756bca331eb2.ttf',
    cdn: ''
  },
  {
    families: ['Fontisto', 'fontisto'],
    local: '/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Fontisto.b49ae8ab2dbccb02c4d11caaacf09eab.ttf',
    cdn: ''
  },
  {
    families: ['Foundation', 'foundation'],
    local: '/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Foundation.e20945d7c929279ef7a6f1db184a4470.ttf',
    cdn: ''
  }
];

let fontFaceRules = '';
for (const font of fontDefinitions) {
  for (const family of font.families) {
    const urls = [
      `url('${font.local}') format('truetype')`,
      `url('/mobile${font.local}') format('truetype')`
    ];
    if (font.cdn) {
      urls.push(`url('${font.cdn}') format('truetype')`);
    }
    fontFaceRules += `    @font-face { font-family: '${family}'; src: ${urls.join(', ')}; font-display: block; }\n`;
  }
}

const fontFaceStyleBlock = `
    <!-- COMPLETE EXPO & REACT-NATIVE-VECTOR-ICONS WEB FIX -->
    <style id="expo-vector-icons-complete">
${fontFaceRules}    </style>
`;

// 3. Anti-zoom styles and script
const antiZoomPayload = `
    <!-- STRICT ZERO ZOOM LOCKDOWN FOR MOBILE -->
    <style id="anti-zoom-style">
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

// Clean up any previously injected styles
html = html.replace(/<style id="expo-bundled-fonts">[\s\S]*?<\/style>/g, '');
html = html.replace(/<style id="expo-vector-icons">[\s\S]*?<\/style>/g, '');
html = html.replace(/<style id="expo-vector-icons-complete">[\s\S]*?<\/style>/g, '');
html = html.replace(/<style id="anti-zoom-style">[\s\S]*?<\/style>/g, '');
html = html.replace(/<script id="anti-zoom-script">[\s\S]*?<\/script>/g, '');

// Inject complete font-face rules right after <head>
html = html.replace('<head>', '<head>\n' + fontFaceStyleBlock);

// Inject anti-zoom payload before </head>
html = html.replace('</head>', antiZoomPayload + '\n  </head>');

// Remove defer from bundle script tag so fonts and app render smoothly
html = html.replace(/<script src="\/_expo\/static\/js\/web\/[^"]+\.js" defer><\/script>/, (match) => {
  return match.replace(' defer', '');
});

fs.writeFileSync(targetPath, html, 'utf8');
console.log('patch-html.js: successfully injected complete vector icon fonts & anti-zoom rules into mobile dist/index.html');

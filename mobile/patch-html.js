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

// 2. Base64 Embed Fonts for 100% Reliable, Zero-Latency Icon Rendering
// Inlining fonts as data URIs guarantees fonts are immediately available in memory
// without any 404s, CORS restrictions, network latency, or SPA routing issues.
const fontsDir = path.resolve(__dirname, 'node_modules', '@expo', 'vector-icons', 'build', 'vendor', 'react-native-vector-icons', 'Fonts');

const fontConfigs = [
  {
    fileName: 'Ionicons.ttf',
    families: ['Ionicons', 'ionicons']
  },
  {
    fileName: 'MaterialCommunityIcons.ttf',
    families: ['MaterialCommunityIcons', 'material-community', 'Material Community Icons']
  },
  {
    fileName: 'MaterialIcons.ttf',
    families: ['MaterialIcons', 'material', 'Material Icons']
  },
  {
    fileName: 'Feather.ttf',
    families: ['Feather', 'feather']
  },
  {
    fileName: 'FontAwesome.ttf',
    families: ['FontAwesome', 'fontawesome']
  },
  {
    fileName: 'FontAwesome5_Solid.ttf',
    families: ['FontAwesome5Free-Solid', 'FontAwesome5_Solid', 'FontAwesome5Solid']
  },
  {
    fileName: 'FontAwesome5_Regular.ttf',
    families: ['FontAwesome5Free-Regular', 'FontAwesome5_Regular', 'FontAwesome5Regular']
  },
  {
    fileName: 'FontAwesome5_Brands.ttf',
    families: ['FontAwesome5Brands-Regular', 'FontAwesome5_Brands', 'FontAwesome5Free-Brand']
  },
  {
    fileName: 'AntDesign.ttf',
    families: ['AntDesign', 'anticon']
  },
  {
    fileName: 'Entypo.ttf',
    families: ['Entypo', 'entypo']
  },
  {
    fileName: 'EvilIcons.ttf',
    families: ['EvilIcons', 'evilicons']
  },
  {
    fileName: 'Octicons.ttf',
    families: ['Octicons', 'octicons']
  },
  {
    fileName: 'SimpleLineIcons.ttf',
    families: ['SimpleLineIcons', 'simple-line-icons']
  }
];

let inlineFontFaceCSS = '';

for (const cfg of fontConfigs) {
  const filePath = path.join(fontsDir, cfg.fileName);
  if (fs.existsSync(filePath)) {
    const base64Data = fs.readFileSync(filePath).toString('base64');
    const dataUri = `data:font/truetype;charset=utf-8;base64,${base64Data}`;
    for (const family of cfg.families) {
      inlineFontFaceCSS += `      @font-face { font-family: '${family}'; src: url('${dataUri}') format('truetype'); font-weight: normal; font-style: normal; font-display: block; }\n`;
    }
  } else {
    console.warn(`patch-html.js: font file not found: ${filePath}`);
  }
}

const fontStyleBlock = `
    <!-- INLINE ZERO-FAIL VECTOR ICONS -->
    <style id="expo-vector-icons-inline">
${inlineFontFaceCSS}    </style>
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
html = html.replace(/<style id="expo-vector-icons-inline">[\s\S]*?<\/style>/g, '');
html = html.replace(/<style id="anti-zoom-style">[\s\S]*?<\/style>/g, '');
html = html.replace(/<script id="anti-zoom-script">[\s\S]*?<\/script>/g, '');

// Inject inline fonts right after <head>
html = html.replace('<head>', '<head>\n' + fontStyleBlock);

// Inject anti-zoom payload before </head>
html = html.replace('</head>', antiZoomPayload + '\n  </head>');

// Remove defer from bundle script tag so fonts and app render smoothly
html = html.replace(/<script src="\/_expo\/static\/js\/web\/[^"]+\.js" defer><\/script>/, (match) => {
  return match.replace(' defer', '');
});

fs.writeFileSync(targetPath, html, 'utf8');
console.log('patch-html.js: successfully injected inline Base64 vector icon fonts & anti-zoom rules into mobile dist/index.html');

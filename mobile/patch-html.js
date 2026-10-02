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

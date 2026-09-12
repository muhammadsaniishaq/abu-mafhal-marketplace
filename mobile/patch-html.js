const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, 'dist', 'index.html');

if (!fs.existsSync(targetPath)) {
  console.log('patch-html.js: dist/index.html not found, skipping.');
  process.exit(0);
}

let html = fs.readFileSync(targetPath, 'utf8');

// 1. Replace viewport meta
const antiZoomViewport = '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no, shrink-to-fit=no, viewport-fit=cover" />\n    <meta name="HandheldFriendly" content="true" />\n    <meta name="MobileOptimized" content="width" />';
if (html.includes('<meta name="viewport"')) {
  html = html.replace(/<meta\s+name="viewport"[^>]*>/i, antiZoomViewport);
} else {
  html = html.replace('<head>', '<head>\n    ' + antiZoomViewport);
}

// 2. Inject anti-zoom CSS & JS if not already present
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

if (!html.includes('anti-zoom-style')) {
  html = html.replace('</head>', antiZoomPayload + '\n  </head>');
}

fs.writeFileSync(targetPath, html, 'utf8');
console.log('patch-html.js: successfully injected zero-zoom protection into mobile dist/index.html');

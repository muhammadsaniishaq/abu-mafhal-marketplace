const fs = require('fs');
const path = require('path');

const fontsDir = path.resolve(__dirname, 'node_modules', '@expo', 'vector-icons', 'build', 'vendor', 'react-native-vector-icons', 'Fonts');

const fontConfigs = [
  { fileName: 'Ionicons.ttf', families: ['Ionicons', 'ionicons'] },
  { fileName: 'MaterialCommunityIcons.ttf', families: ['MaterialCommunityIcons', 'material-community', 'Material Community Icons'] },
  { fileName: 'MaterialIcons.ttf', families: ['MaterialIcons', 'material', 'Material Icons'] },
  { fileName: 'Feather.ttf', families: ['Feather', 'feather'] },
  { fileName: 'FontAwesome.ttf', families: ['FontAwesome', 'fontawesome'] },
  { fileName: 'FontAwesome5_Solid.ttf', families: ['FontAwesome5Free-Solid', 'FontAwesome5_Solid', 'FontAwesome5Solid'] },
  { fileName: 'FontAwesome5_Regular.ttf', families: ['FontAwesome5Free-Regular', 'FontAwesome5_Regular', 'FontAwesome5Regular'] },
  { fileName: 'FontAwesome5_Brands.ttf', families: ['FontAwesome5Brands-Regular', 'FontAwesome5_Brands', 'FontAwesome5Free-Brand'] },
  { fileName: 'AntDesign.ttf', families: ['AntDesign', 'anticon'] },
  { fileName: 'Entypo.ttf', families: ['Entypo', 'entypo'] },
  { fileName: 'EvilIcons.ttf', families: ['EvilIcons', 'evilicons'] },
  { fileName: 'Octicons.ttf', families: ['Octicons', 'octicons'] },
  { fileName: 'SimpleLineIcons.ttf', families: ['SimpleLineIcons', 'simple-line-icons'] }
];

let css = '';
for (const cfg of fontConfigs) {
  const filePath = path.join(fontsDir, cfg.fileName);
  if (fs.existsSync(filePath)) {
    const b64 = fs.readFileSync(filePath).toString('base64');
    const uri = `data:font/truetype;charset=utf-8;base64,${b64}`;
    for (const fam of cfg.families) {
      css += `      @font-face { font-family: '${fam}'; src: url('${uri}') format('truetype'); font-weight: normal; font-style: normal; font-display: block; }\n`;
    }
  } else {
    console.warn(`Font file not found: ${filePath}`);
  }
}

const styleBlock = `    <!-- EXPO VECTOR ICONS INLINE BASE64 ZERO-FAIL FIX -->\n    <style id="expo-vector-icons">\n${css}    </style>`;

const targets = [
  path.resolve(__dirname, 'public', 'index.html'),
  path.resolve(__dirname, 'web', 'index.html'),
  path.resolve(__dirname, 'dist', 'index.html'),
  path.resolve(__dirname, '..', 'index.html'),
  path.resolve(__dirname, '..', 'dist', 'index.html'),
  path.resolve(__dirname, '..', 'dist', 'mobile', 'index.html')
];

for (const targetPath of targets) {
  if (fs.existsSync(targetPath)) {
    let html = fs.readFileSync(targetPath, 'utf8');
    if (html.includes('<style id="expo-vector-icons">')) {
      html = html.replace(/<style id="expo-vector-icons">[\s\S]*?<\/style>/i, `<style id="expo-vector-icons">\n${css}    </style>`);
    } else {
      html = html.replace('</head>', `${styleBlock}\n  </head>`);
    }
    fs.writeFileSync(targetPath, html, 'utf8');
    console.log(`Successfully updated: ${targetPath}`);
  }
}

console.log('Done patching all web icons.');

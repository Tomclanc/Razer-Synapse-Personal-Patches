const fs=require('fs'),vm=require('vm'),assert=require('assert');
const code=fs.readFileSync('src/theme.js','utf8');
function declaration(values) {
  const names=Object.keys(values);
  names.getPropertyValue=name=>values[name];
  return names;
}
const light={matches:true,addEventListener(_,fn){this.change=fn;}};
const contrast={matches:false,addEventListener(_,fn){this.change=fn;}};
const style={id:'',textContent:'',contains:()=>false,remove(){}};
let observer,scheduled=0;
const inlineAttrs={};
const inline={style:declaration({'background-color':'rgb(34, 34, 34)','color':'rgba(204,204,204,0.6)'}),
  hasAttribute:n=>n in inlineAttrs,setAttribute:(n,v)=>inlineAttrs[n]=v,getAttribute:n=>inlineAttrs[n]};
const originalRules=[
  {selectorText:'.panel',style:declaration({'background-color':'#111','color':'#ccc','background-image':'url("data:image/svg+xml,#ffffff")'})},
  {selectorText:'.action',style:declaration({'background-color':'#44d62c','color':'#000'})},
  {selectorText:'.heading',style:declaration({'color':'#44d62c'})},
  {selectorText:'.hero',style:declaration({'background-image':'linear-gradient(rgba(0,0,0,0),#fff),url("device.png")'})},
  {selectorText:'.card',style:declaration({'border-color':'#444','box-shadow':'0 2px 8px rgba(0,0,0,0.1)'})}
];
const document={
  readyState:'complete',head:{appendChild(el){document.styleSheets.push({ownerNode:el,cssRules:[]})}},
  documentElement:{appendChild(){}},styleSheets:[{cssRules:originalRules}],
  getElementById:()=>null,createElement:()=>style,
  querySelector:()=>null,querySelectorAll:q=>q==='[style]'?[inline]:[],addEventListener(){}
};
const context={location:{protocol:'https:',hostname:'apps.razer.com'},document,
  matchMedia:q=>q.includes('forced-colors')?contrast:light,
  MutationObserver:class{constructor(fn){observer=fn}observe(){}},
  setTimeout(fn,delay){if(delay===1200){fn();return;}scheduled++;fn();},clearTimeout(){}
};
document.defaultView=context;
vm.runInNewContext(code,context);
assert(style.textContent.includes('background-color:rgb(255,255,255)'));
assert(style.textContent.includes('color:rgb(39,49,62)'));
assert(style.textContent.includes('background-color:rgb(104,184,113)'));
assert(style.textContent.includes('color:rgb(39,49,62)'));
assert(style.textContent.includes('color:rgb(39,112,65)'));
assert(!style.textContent.includes('data:image')); // Unchanged URL has no override.
assert(style.textContent.includes('rgba(39,49,62,0.6)'));
assert(style.textContent.includes('linear-gradient(rgba(246,248,250,0),rgb(246,248,250)),url("device.png")'));
assert(style.textContent.includes('border-color:rgb(199,209,219)'));
assert(style.textContent.includes('box-shadow:0 2px 8px rgba(39,49,62,0.1)'));
assert(style.textContent.includes('.etabs-tab .btn-close { background-color:transparent !important; }'));
assert(style.textContent.includes('.etabs-tab .btn-close:hover { background-color:#dce5ee !important;'));
assert(style.textContent.includes('.etabs-tab .btn-close:active { background-color:#c8d5e2 !important;'));
function luminance(rgb) {
  const channels=rgb.map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4});
  return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;
}
function contrastRatio(a,b) {
  const values=[luminance(a),luminance(b)].sort((x,y)=>y-x);
  return (values[0]+.05)/(values[1]+.05);
}
for(const text of [[39,49,62],[80,94,110],[105,119,134],[39,112,65]])
  assert(contrastRatio(text,[255,255,255])>=4.5,'Card text contrast');
assert(contrastRatio([39,49,62],[104,184,113])>=4.5,'Green control label contrast');
const before=style.textContent;
observer([{target:style}]);assert.equal(scheduled,0);
light.matches=false;light.change();
assert(style.textContent.includes('border-radius:12px !important'));
assert(!/background(?:-color|-image)?\s*:/.test(style.textContent));
light.matches=true;light.change();assert.equal(style.textContent,before);
contrast.matches=true;contrast.change();assert.equal(style.textContent,'');
contrast.matches=false;contrast.change();assert.equal(style.textContent,before);
inline.style=declaration({color:'#fff'});
observer([{target:inline}]);
assert.equal(scheduled,1);assert(style.textContent.includes('color:rgb(39,49,62)'));
console.log('PASS: palette, alpha, green controls/text, image URL preservation, light/dark switching, forced colors, dynamic inline styles, observer loop guard.');
const childStyle={id:'',textContent:'',contains:()=>false,remove(){}};
const child={
  readyState:'complete',defaultView:context,documentElement:{appendChild(){}},
  head:{appendChild(el){child.styleSheets.push({ownerNode:el,cssRules:[]});}},
  styleSheets:[{cssRules:[{selectorText:'.pairing',style:declaration({background:'#222',color:'#ccc'})}]}],
  getElementById:()=>null,createElement:()=>childStyle,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){}
};
const frame={contentDocument:child,addEventListener(){}};
document.querySelectorAll=q=>q==='iframe,frame'?[frame]:q==='[style]'?[inline]:[];
observer([{target:document.documentElement}]);
assert(childStyle.textContent.includes('background:rgb(242,245,248)'));
assert(childStyle.textContent.includes('color:rgb(39,49,62)'));
console.log('PASS: nested document installation and background shorthand conversion.');

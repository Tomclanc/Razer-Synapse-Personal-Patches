const fs=require('fs'),crypto=require('crypto'),vm=require('vm');
const path=require('path');
const root=path.resolve(__dirname,'..');
const output=path.join(root,'dist')+path.sep;
fs.mkdirSync(output,{recursive:true});
const input=process.argv[2];
if(!input)throw Error('Pass the path to the original app.asar');
const original=fs.readFileSync(input);
function parse(data) {
  return {tree:JSON.parse(data.subarray(16,16+data.readUInt32LE(12))),base:8+data.readUInt32LE(4)};
}
const {tree,base}=parse(original);
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const compatibility=JSON.parse(fs.readFileSync(path.join(root,'compatibility.json'),'utf8'));
if(hash(original)!==compatibility.originalSha256)throw Error('Unsupported original app.asar hash');
const payloads=[];let offset=0,changed=[];
const theme=fs.readFileSync(path.join(root,'src/theme.js'),'utf8');
const mainTheme=fs.readFileSync(path.join(root,'src/theme-main.js'),'utf8').trim();
const tabTheme=fs.readFileSync(path.join(root,'src/theme-tab.js'),'utf8').trim();
new vm.Script(theme);
new vm.Script(mainTheme);
new vm.Script(tabTheme);
function walk(dir,prefix='') {
  for(const [name,entry]of Object.entries(dir.files)) {
    const namePath=prefix+name;
    if(entry.files){walk(entry,namePath+'/');continue;}
    if(entry.unpacked||entry.link)continue;
    let data=original.subarray(base+Number(entry.offset),base+Number(entry.offset)+entry.size);
    if(namePath==='electron/main.js') {
      const text=data.toString();
      if(text.split('l.themeSource="dark"').length!==2)throw Error('Unexpected main.js');
      data=Buffer.from(text.replace('l.themeSource="dark"','l.themeSource='+mainTheme));
      changed.push(namePath);
    }
    if(namePath==='electron/preload.js') {
      data=Buffer.concat([data,Buffer.from('\n;'+theme+'\n')]);
      changed.push(namePath);
    }
    if(namePath==='electron/components/Tab/Tab.js') {
      const text=data.toString();
      const creation='this.tab=w()?new n(N):new e(N),';
      const background='this.tab.setBackgroundColor(g)';
      if(text.split(creation).length!==2||text.split(background).length!==2)
        throw Error('Unexpected tab lifecycle code');
      data=Buffer.from(text.replace(creation,creation+tabTheme+',')
        .replace(background,"this.tab.setBackgroundColor(require('electron').nativeTheme.shouldUseDarkColors?'#222222':'#f2f5f8')"));
      changed.push(namePath);
    }
    if(namePath==='electron/components/Tab/LeftSystray.js') {
      const text=data.toString(),options='hasShadow:!1,resizable:!1';
      if(text.split(options).length!==2)throw Error('Unexpected tray window options');
      data=Buffer.from(text.replace(options,'hasShadow:!0,resizable:!1,transparent:!0,backgroundColor:"#00000000",roundedCorners:!0'));
      changed.push(namePath);
    }
    if(changed.includes(namePath)) {
      new vm.Script(data.toString());
      if(entry.integrity) {
        const blockSize=entry.integrity.blockSize;
        if(!blockSize||entry.integrity.algorithm!=='SHA256')throw Error('Unexpected integrity');
        entry.integrity.hash=hash(data);
        entry.integrity.blocks=[];
        for(let p=0;p<data.length;p+=blockSize)entry.integrity.blocks.push(hash(data.subarray(p,p+blockSize)));
      }
    }
    entry.offset=String(offset);entry.size=data.length;
    offset+=data.length;payloads.push(data);
  }
}
walk(tree);
if(changed.length!==4)throw Error('Missing patch targets');
const additions={
  'local-tray-menu.js':'tray-menu.cjs','local-tray-preload.js':'tray-preload.cjs',
  'local-tray-renderer.js':'tray-renderer.js','local-tray-menu.html':'tray-menu.html'
};
for(const[name,source]of Object.entries(additions)) {
  if(tree.files.electron.files[name])throw Error('Existing tray patch entry '+name);
  const data=fs.readFileSync(path.join(root,'src',source));
  if(name.endsWith('.js'))new vm.Script(data.toString());
  tree.files.electron.files[name]={size:data.length,offset:String(offset),
    integrity:{algorithm:'SHA256',hash:hash(data),blockSize:4194304,blocks:[hash(data)]}};
  offset+=data.length;payloads.push(data);changed.push('electron/'+name);
}
const json=Buffer.from(JSON.stringify(tree));
const headerLength=4+Math.ceil((4+json.length)/4)*4;
const header=Buffer.alloc(8+headerLength);
header.writeUInt32LE(4,0);header.writeUInt32LE(headerLength,4);
header.writeUInt32LE(headerLength-4,8);header.writeUInt32LE(json.length,12);json.copy(header,16);
const patched=Buffer.concat([header,...payloads]);
// Verify every packed entry against the original except the intended changes.
const check=parse(patched),old=parse(original);
let verified=0;
function verify(dir,oldDir,prefix='') {
  for(const[name,e]of Object.entries(dir.files)) {
    const fullName=prefix+name;
    const prev=oldDir.files[name];
    if(e.files){verify(e,prev,fullName+'/');continue;}
    if(e.unpacked||e.link)continue;
    const current=patched.subarray(check.base+Number(e.offset),check.base+Number(e.offset)+e.size);
    if(!prev) {
      if(prefix!=='electron/'||!additions[name]||hash(current)!==hash(fs.readFileSync(path.join(root,'src',additions[name]))))
        throw Error('Unexpected added entry '+fullName);
      verified++;continue;
    }
    const before=original.subarray(old.base+Number(prev.offset),old.base+Number(prev.offset)+prev.size);
    if(hash(current)!==hash(before)) {
      if(!((name==='main.js'&&current.includes(Buffer.from('local-razer-theme-set'))) ||
           (name==='preload.js'&&current.includes(Buffer.from('local-razer-system-theme'))) ||
           (fullName==='electron/components/Tab/Tab.js'&&current.includes(Buffer.from("theme.removeListener('updated',paint)"))) ||
           (fullName==='electron/components/Tab/LeftSystray.js'&&current.includes(Buffer.from('roundedCorners:!0')))))throw Error('Unexpected changed entry '+name);
    }
    verified++;
  }
}
verify(tree,old.tree);
fs.writeFileSync(output+'app.asar',patched);
fs.copyFileSync(path.join(root,'src/theme.js'),output+'theme-source.js');
fs.copyFileSync(path.join(root,'src/theme-main.js'),output+'theme-main-source.js');
fs.copyFileSync(path.join(root,'src/theme-tab.js'),output+'theme-tab-source.js');
const previous=compatibility;
fs.writeFileSync(output+'manifest.json',JSON.stringify({version:'4.0.827',revision:8,originalSha256:hash(original),patchedSha256:hash(patched),previousPatchedSha256:[...new Set([...(previous.previousPatchedSha256||[]),previous.patchedSha256])],changedFiles:changed,verifiedPackedEntries:verified},null,2));
console.log({changed,verified,originalSha256:hash(original),patchedSha256:hash(patched)});

for(const name of ['Apply-Theme.ps1','INSTALL.cmd','RESTORE.cmd','Cleanup-History.ps1','CLEANUP.cmd'])fs.copyFileSync(path.join(root,'templates',name),path.join(output,name));
fs.copyFileSync(path.join(root,'README.md'),path.join(output,'README.md'));

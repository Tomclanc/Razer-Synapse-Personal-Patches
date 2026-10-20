const fs=require('fs'),vm=require('vm'),assert=require('assert'),{EventEmitter}=require('events');
const code=fs.readFileSync('src/theme-tab.js','utf8');
for(const transparent of [false,true]) {
  const theme=new EventEmitter();theme.shouldUseDarkColors=false;
  const contents=new EventEmitter();contents.isDestroyed=()=>false;
  const paints=[];
  const tab={webContents:contents,setBackgroundColor:color=>paints.push(color)};
  vm.runInNewContext(code,{tab,m:{transparent},require:()=>({nativeTheme:theme})});
  assert.deepEqual(paints,transparent?[]:['#f2f5f8']);
  contents.emit('did-start-loading');
  theme.shouldUseDarkColors=true;theme.emit('updated');
  if(!transparent)assert.deepEqual(paints,['#f2f5f8','#f2f5f8','#222222']);
  contents.emit('destroyed');
  assert.equal(theme.listenerCount('updated'),0);
  if(transparent)assert.equal(paints.length,0);
}
console.log('PASS: tab background set synchronously at creation, navigation, theme change, transparent views preserved, listener cleaned up.');

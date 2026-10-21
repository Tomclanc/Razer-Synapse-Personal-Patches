const {chromium}=require('playwright');
const fs=require('fs'),assert=require('assert');
(async()=>{
  fs.mkdirSync('test-artifacts',{recursive:true});
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try {
    const context=await browser.newContext({colorScheme:'light',viewport:{width:540,height:650}});
    const html=`<!doctype html><meta charset="utf-8"><style>
      html,body{margin:0;background:#222;color:#ccc;font:16px Arial}.systray{border:1px solid #000;width:100%}
      .header,.apps{padding:20px;background:#000}.username{color:#fff}.app-section-title{padding:10px;text-align:center}
      .devices{margin:0;padding:0;list-style:none}.devices>li{display:flex;align-items:center;padding:18px}
      .icon{width:32px;height:36px;background:center/contain no-repeat url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 30"><rect x="4" y="4" width="12" height="24" rx="2" fill="%23ccc"/></svg>')}
      .info{margin-left:16px}.title{color:#999;font-size:12px}.profile{margin-bottom:8px}.battery{margin-left:auto;display:flex;align-items:center}.battery .icon{width:22px}.apps{margin-top:28px}
    </style><div class="systray"><div class="header"><strong class="username">TomClnancy</strong></div>
    <div class="app-section-title">RAZER SYNAPSE</div><div class="synapse"><ul class="devices">
    <li><div class="icon"></div><div class="info"><div class="profile">WORKSTATION-Default</div><div class="title">RAZER HYPERPOLLING 无线接收器</div></div></li>
    <li><div class="icon"></div><div class="info"><div class="profile">WorkStation</div><div class="title">RAZER 噬魂金蝎 V2 无线版</div></div><div class="battery"><span class="label">85%</span><div class="icon"></div></div></li>
    <li><div class="icon"></div><div class="info"><div class="profile">Computex</div><div class="title">RAZER 炼狱蝰蛇 V3 专业版 白色</div></div><div class="battery low-batt"><span class="label">9%</span><div class="icon"></div></div></li>
    </ul></div><div class="apps">●　RAZER SYNAPSE</div></div>`;
    await context.route('https://apps.razer.com/**',route=>route.fulfill({body:html,contentType:'text/html'}));
    await context.addInitScript({content:fs.readFileSync('src/theme.js','utf8')});
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('https://apps.razer.com/systray/systrayv2/');
    await page.waitForFunction(()=>getComputedStyle(document.querySelector('.systray')).borderRadius==='12px');
    const style=selector=>page.locator(selector).first().evaluate(el=>({filter:getComputedStyle(el).filter,color:getComputedStyle(el).color}));
    assert.equal((await style('.devices>li>.icon')).filter,'brightness(0.42)');
    assert.equal((await style('.battery .icon')).filter,'brightness(0.42)');
    assert.equal((await style('.battery.low-batt .label')).color,'rgb(180, 35, 50)');
    await page.screenshot({path:'test-artifacts/tray-panel-light.png'});
    await page.emulateMedia({colorScheme:'dark'});
    await page.waitForFunction(()=>getComputedStyle(document.querySelector('.systray')).backgroundColor==='rgba(0, 0, 0, 0)');
    assert.equal(await page.locator('.systray').evaluate(el=>getComputedStyle(el).borderRadius),'12px');
    assert.equal((await style('.devices>li>.icon')).filter,'none');
    await page.emulateMedia({forcedColors:'active'});
    await page.waitForFunction(()=>document.getElementById('local-razer-system-theme').textContent==='');
    // Exercise the actual local context menu document and renderer without Electron privileges.
    const menuPage=await browser.newPage({viewport:{width:320,height:240}});
    await menuPage.route('https://tray.test/**',route=>route.fulfill({
      body:fs.readFileSync(route.request().url().endsWith('.js')?'src/tray-renderer.js':'src/tray-menu.html','utf8'),
      contentType:route.request().url().endsWith('.js')?'application/javascript':'text/html'}));
    await menuPage.addInitScript(()=>{window.localTray={onModel:cb=>window.renderModel=cb,activate:index=>window.chosen=index,dismiss:()=>window.dismissed=true};});
    await menuPage.goto('https://tray.test/');
    const model={dark:false,items:[{index:0,label:'RAZER SYNAPSE',enabled:true},{index:1,separator:true},{index:2,label:'设置',enabled:true},{index:3,label:'禁用项',enabled:false},{index:4,label:'退出',enabled:true}]};
    await menuPage.evaluate(model=>window.renderModel(model),model);
    assert.equal(await menuPage.locator('#menu').evaluate(el=>getComputedStyle(el).borderRadius),'12px');
    await menuPage.keyboard.press('ArrowDown');assert.equal(await menuPage.locator(':focus').getAttribute('data-index'),'2');
    await menuPage.keyboard.press('ArrowDown');assert.equal(await menuPage.locator(':focus').getAttribute('data-index'),'4');
    await menuPage.keyboard.press('Enter');assert.equal(await menuPage.evaluate(()=>window.chosen),4);
    await menuPage.screenshot({path:'test-artifacts/tray-menu-light.png'});
    await menuPage.evaluate(model=>window.renderModel({...model,dark:true}),model);
    await menuPage.screenshot({path:'test-artifacts/tray-menu-dark.png'});
    await menuPage.keyboard.press('Escape');assert(await menuPage.evaluate(()=>window.dismissed));
    assert.deepEqual(errors,[]);
    console.log('PASS: tray palette, icon contrast, warning color, dark mode, forced colors, rounded menu, keyboard/disabled action behavior.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

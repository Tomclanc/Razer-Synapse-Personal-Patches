require('fs').mkdirSync('test-artifacts',{recursive:true});
const {chromium}=require('playwright');
const fs=require('fs'),assert=require('assert');
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try {
    const context=await browser.newContext({colorScheme:'light',viewport:{width:1100,height:700}});
    const source=fs.readFileSync('src/theme.js','utf8');
    const html=`<!doctype html><html><head><style>
      body{background:#222;color:#ccc;font:16px Arial}
      #body-wrapper{padding:24px}.widget-prod{height:200px;position:relative}
      .dot-bg{background:linear-gradient(90deg,#222 20px,transparent 1%) center,linear-gradient(#222 20px,transparent 1%) center,#5d5d5d;background-size:22px 22px}
      .dim-corner,.custom-dim-corner{position:absolute;inset:0;background:radial-gradient(transparent,#222)}
      .dot-bg,.dot-background--wireless{position:relative;height:100px}
      .dot-background--wireless{background:#222}
      .device{position:absolute;left:48%;top:30%;width:30px;height:100px;background:#111}
    </style></head><body><main id="body-wrapper">
      <div class="widget-prod dot-bg"><div class="dim-corner"></div><div class="device"></div></div>
      <div class="config-wrapper dot-bg"><div class="config-block"><img id="product-art" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20'%3E%3Crect width='20' height='20' fill='black'/%3E%3C/svg%3E"></div><div class="dim-corner"></div></div>
      <div id="multipleBrightness"><div class="dot-background--wireless"><div class="custom-dim-corner"></div></div></div>
    </main></body></html>`;
    await context.route('https://apps.razer.com/**',route=>route.fulfill({body:html,contentType:'text/html'}));
    await context.addInitScript(()=>{
      const listeners={};
      window.__themeIPC={
        sendSync:()=>localStorage.getItem('test-mode')||'system',
        on:(name,fn)=>listeners[name]=fn,
        invoke:async(_name,mode)=>{
          localStorage.setItem('test-mode',mode);
          listeners['local-razer-theme-changed']?.({},mode);
          return mode;
        }
      };
      window.require=()=>({ipcRenderer:window.__themeIPC});
    });
    await context.addInitScript({content:source});
    const page=await context.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('https://apps.razer.com/settings/');
    const selector=page.getByRole('combobox',{name:'显示主题'});
    await selector.waitFor();
    const selected=page.locator('#local-razer-appearance select');
    const choose=async(mode)=>{await selector.click();await page.locator(`.theme-option[data-value="${mode}"]`).click();};
    assert.equal(await selected.inputValue(),'system');
    await page.waitForFunction(()=>!document.getElementById('local-razer-theme-first-paint'));
    assert.equal(await page.locator('.widget-prod').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(237, 242, 246)');
    for(const surface of ['.config-wrapper.dot-bg','.dot-background--wireless'])
      assert.equal(await page.locator(surface).evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(237, 242, 246)',surface);
    for(const overlay of ['.config-wrapper .dim-corner','#multipleBrightness .custom-dim-corner']) {
      assert.equal(await page.locator(overlay).evaluate(el=>getComputedStyle(el).backgroundImage),'none',overlay);
      assert.equal(await page.locator(overlay).evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)',overlay);
    }
    assert.equal(await page.locator('#product-art').evaluate(el=>getComputedStyle(el).filter),'none');
    const artwork=await page.locator('#product-art').getAttribute('src');
    await choose('dark');
    await page.waitForFunction(()=>document.getElementById('local-razer-system-theme').textContent==='');
    assert((await page.locator('.config-wrapper .dim-corner').evaluate(el=>getComputedStyle(el).backgroundImage)).includes('radial-gradient'));
    assert.equal(await page.locator('#product-art').getAttribute('src'),artwork);
    await page.reload();await selector.waitFor();assert.equal(await selected.inputValue(),'dark');
    await choose('light');
    await page.emulateMedia({colorScheme:'dark'});
    await page.waitForFunction(()=>getComputedStyle(document.querySelector('.widget-prod')).backgroundColor==='rgb(237, 242, 246)');
    assert.equal(await selected.inputValue(),'light');
    await choose('system');
    await page.waitForFunction(()=>document.getElementById('local-razer-system-theme').textContent==='');
    await page.emulateMedia({colorScheme:'light'});
    await page.waitForFunction(()=>document.getElementById('local-razer-system-theme').textContent.includes('.dot-background--wireless'));
    await selector.click();
    assert.equal(await page.getByRole('listbox').evaluate(el=>getComputedStyle(el).borderRadius),'10px');
    await page.keyboard.press('Escape');
    assert.equal(await selector.getAttribute('aria-expanded'),'false');
    await selector.press('ArrowDown');
    await page.keyboard.press('Home');await page.keyboard.press('Enter');
    await page.waitForFunction(()=>localStorage.getItem('test-mode')==='dark');
    await choose('system');await selector.click();
    await page.screenshot({path:'test-artifacts/theme-settings-preview.png'});
    await page.locator('h2').click();
    assert.equal(await selector.getAttribute('aria-expanded'),'false');
    // A page that never finishes its loader must not remain hidden indefinitely.
    await page.evaluate(()=>{document.body.innerHTML='<div class="rz-init-loader">Loading</div>';});
    await page.waitForTimeout(1300);
    assert.equal(await page.locator('body').evaluate(el=>getComputedStyle(el).visibility),'visible');
    assert.deepEqual(errors,[]);
    console.log('PASS: real browser settings UI, persistence, light/dark/system, live OS switch, preview background, first-paint release; no JS errors.');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});

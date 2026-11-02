const {chromium}=require('playwright');const fs=require('fs'),assert=require('assert');
fs.mkdirSync('test-artifacts',{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const context=await browser.newContext({viewport:{width:420,height:270}});
 const css='body{color:#ccc;font:14px Arial}.notifications{position:absolute;bottom:0;right:0;list-style:none;margin:0;padding:0 0 2px}.notifications>li{width:360px;background:#111;outline:1px solid #44d62c;transform:translateX(-15px)}.info{padding:20px 20px 20px 32px}.header{color:#44d62c;margin-bottom:20px}.body{margin-bottom:16px}';
 await context.route('https://apps.razer.com/**',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><meta charset="utf-8"><style>${css}</style><div id="root"><div class="app"><ul class="notifications"><li class="notification-enter-done"><div class="info"><div class="header">游戏模式已禁用</div><div class="body">所有按键均已重新启用。</div><div class="footer">Razer 噬魂金蝎 V2 无线版</div></div></li></ul></div></div>`}));
 await context.addInitScript(()=>{window.require=()=>({ipcRenderer:{sendSync:()=> 'system',on:(n,f)=>window.changeTheme=mode=>f({},mode)}})});
 await context.addInitScript({content:fs.readFileSync('src/theme.js','utf8')});const page=await context.newPage();
 await page.goto('https://apps.razer.com/notification-manager/');
 for(const mode of ['light','dark']){await page.evaluate(m=>window.changeTheme(m),mode);await page.waitForTimeout(100);
 const result=await page.evaluate(()=>{const c=getComputedStyle(document.querySelector('li'));return {radius:c.borderRadius,bg:c.backgroundColor,color:c.color,root:getComputedStyle(document.documentElement).backgroundColor,body:getComputedStyle(document.body).backgroundColor}});
 assert.equal(result.radius,'16px');assert.equal(result.root,'rgba(0, 0, 0, 0)');assert.equal(result.body,'rgba(0, 0, 0, 0)');assert.equal(result.color,mode==='light'?'rgb(39, 49, 62)':'rgb(237, 240, 245)');
 await page.screenshot({path:'test-artifacts/notification-'+mode+'.png',omitBackground:true});console.log(mode,result);
 }
 await page.emulateMedia({colorScheme:'light'});await page.evaluate(()=>window.changeTheme('system'));await page.waitForTimeout(80);assert.equal(await page.locator('li').evaluate(e=>getComputedStyle(e).color),'rgb(39, 49, 62)');
 await page.emulateMedia({forcedColors:'active'});await page.waitForTimeout(80);assert.equal(await page.locator('li').evaluate(e=>getComputedStyle(e).borderRadius),'16px');console.log('PASS notification light/dark/system, transparent canvas, rounded card, forced colors.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});

// Local, reversible theme adaptation for Razer App Engine 4.0.896.
(() => {
  'use strict';
  if (!(location.protocol === 'file:' ||
        location.hostname === 'apps.razer.com')) return;
  let ipc, preference='system';
  const subscribers=new Set();
  try {
    ipc=require('electron').ipcRenderer;
    preference=ipc.sendSync('local-razer-theme-get')||'system';
    ipc.on('local-razer-theme-changed',(_event,next)=>{
      preference=next;
      for(const notify of subscribers)notify();
    });
  } catch {}
  const visited = new WeakSet();
  function install(document) {
  if(visited.has(document))return;
  visited.add(document);
  const view=document.defaultView;
  if(!view)return;
  const light = view.matchMedia('(prefers-color-scheme: light)');
  const contrast = view.matchMedia('(forced-colors: active)');
  const styleId = 'local-razer-system-theme';
  const isLight=()=>preference==='light'||(preference==='system'&&light.matches);
  let bootStyle,bootTimer,bootObserver;
  function releaseBoot() {
    if(bootStyle){bootStyle.remove();bootStyle=null;}
    if(bootObserver)bootObserver.disconnect();
    if(bootTimer)view.clearTimeout(bootTimer);
  }
  function prime() {
    if(!document.documentElement||bootStyle)return;
    bootStyle=document.createElement('style');
    bootStyle.id='local-razer-theme-first-paint';
    bootStyle.textContent=isLight()&&!contrast.matches?
      'html{background:#f2f5f8!important;color-scheme:light}body{visibility:hidden!important;background:#f2f5f8!important}':'';
    document.documentElement.appendChild(bootStyle);
    bootTimer=view.setTimeout(releaseBoot,1200);
  }
  if(document.documentElement)prime();
  else {
    bootObserver=new view.MutationObserver(()=>{if(document.documentElement){prime();bootObserver.disconnect();}});
    bootObserver.observe(document,{childList:true,subtree:true});
  }
  let settingsHost,settingsSelect,settingsStatus,themeButton,themeMenu;
  function mountSettings() {
    if(!ipc||!/^\/(?:synapse\/)?settings(?:\/|$)/.test(view.location.pathname))return;
    if(settingsHost?.isConnected)return;
    const parent=document.querySelector('#body-wrapper');
    if(!parent)return;
    settingsHost=document.createElement('section');
    settingsHost.id='local-razer-appearance';
    settingsHost.style.cssText='display:block;flex:0 0 100%;grid-column:1 / -1;width:100%;box-sizing:border-box;margin:10px 0 20px';
    const root=settingsHost.attachShadow({mode:'open'});
    const style=document.createElement('style');
    style.textContent=`
      :host{font-family:Roboto,"Microsoft YaHei",sans-serif}
      .card{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:20px 24px;border:1px solid var(--line);border-radius:12px;background:var(--surface);color:var(--text)}
      h2{font-size:16px;margin:0 0 8px;font-weight:500}
      p{font-size:13px;margin:0;color:var(--muted);line-height:1.5}
      .theme-button{min-width:160px;padding:8px 12px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--text);font:inherit;font-size:14px;display:flex;justify-content:space-between;gap:24px;align-items:center;cursor:pointer}
      .theme-button:after{content:"";width:6px;height:6px;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:rotate(45deg);margin-top:-3px}
      button:focus-visible{outline:2px solid #68b871;outline-offset:2px}
      .theme-menu{position:fixed;inset:auto;margin:0;padding:5px;box-sizing:border-box;border:1px solid var(--line);border-radius:10px;background:var(--surface);color:var(--text);box-shadow:0 8px 24px #0002;overflow:hidden}
      .theme-option{display:flex;justify-content:space-between;align-items:center;box-sizing:border-box;width:100%;padding:9px 12px;border:0;border-radius:6px;background:transparent;color:var(--text);font:inherit;font-size:14px;text-align:left;cursor:pointer}
      .theme-option:hover,.theme-option:focus-visible{background:var(--hover)}
      .theme-option[aria-selected=true]{background:var(--selected)}
      .theme-option[aria-selected=true]:after{content:"✓";color:var(--text)}
      button:disabled{opacity:.6;cursor:wait}
    `;
    const card=document.createElement('div');card.className='card';
    const copy=document.createElement('div');
    const heading=document.createElement('h2');heading.textContent='外观';
    const help=document.createElement('p');help.textContent='选择雷云的显示主题，立即生效并自动保存。';
    settingsStatus=document.createElement('p');settingsStatus.setAttribute('role','status');
    copy.append(heading,help,settingsStatus);
    settingsSelect=document.createElement('select');
    settingsSelect.hidden=true;
    settingsSelect.setAttribute('aria-hidden','true');
    settingsSelect.setAttribute('aria-label','显示主题');
    for(const [value,label]of [['dark','深色'],['light','亮色'],['system','跟随系统']]) {
      const option=document.createElement('option');option.value=value;option.textContent=label;
      settingsSelect.appendChild(option);
    }
    settingsSelect.value=preference;
    themeButton=document.createElement('button');themeButton.type='button';themeButton.className='theme-button';
    themeButton.setAttribute('role','combobox');themeButton.setAttribute('aria-label','显示主题');
    themeButton.setAttribute('aria-haspopup','listbox');themeButton.setAttribute('aria-expanded','false');
    themeButton.setAttribute('aria-controls','theme-options');
    themeMenu=document.createElement('div');themeMenu.className='theme-menu';themeMenu.id='theme-options';
    themeMenu.setAttribute('popover','manual');themeMenu.setAttribute('role','listbox');themeMenu.setAttribute('aria-label','显示主题选项');
    const closeMenu=(focus=false)=>{
      themeMenu.hidePopover();themeButton.setAttribute('aria-expanded','false');
      if(focus)themeButton.focus();
    };
    const openMenu=()=>{
      const rect=themeButton.getBoundingClientRect();
      themeMenu.style.width=rect.width+'px';
      themeMenu.style.left=Math.max(8,Math.min(rect.left,view.innerWidth-rect.width-8))+'px';
      themeMenu.style.top=(rect.bottom+6+130>view.innerHeight?Math.max(8,rect.top-136):rect.bottom+6)+'px';
      themeMenu.showPopover();themeButton.setAttribute('aria-expanded','true');
      themeMenu.querySelector('[aria-selected=true]')?.focus();
    };
    for(const option of settingsSelect.options) {
      const item=document.createElement('button');item.type='button';item.className='theme-option';
      item.setAttribute('role','option');item.dataset.value=option.value;item.textContent=option.textContent;
      item.setAttribute('aria-selected',String(option.value===preference));
      item.addEventListener('click',()=>{
        settingsSelect.value=option.value;closeMenu(true);
        settingsSelect.dispatchEvent(new view.Event('change'));
      });
      themeMenu.appendChild(item);
    }
    themeButton.addEventListener('click',()=>themeMenu.matches(':popover-open')?closeMenu():openMenu());
    themeButton.addEventListener('keydown',event=>{
      if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();openMenu();}
    });
    themeMenu.addEventListener('keydown',event=>{
      const items=[...themeMenu.children],index=items.indexOf(root.activeElement);
      if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
        event.preventDefault();
        const next=event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;
        items[next].focus();
      } else if(event.key==='Escape'){event.preventDefault();closeMenu(true);}
      else if(event.key==='Tab')closeMenu(true);
    });
    document.addEventListener('pointerdown',event=>{
      if(themeMenu.matches(':popover-open')&&!event.composedPath().includes(themeMenu)&&!event.composedPath().includes(themeButton))closeMenu();
    });
    document.addEventListener('scroll',()=>{if(themeMenu.matches(':popover-open'))closeMenu();},true);
    settingsSelect.addEventListener('change',async()=>{
      settingsSelect.disabled=true;
      themeButton.disabled=true;
      try {
        preference=await ipc.invoke('local-razer-theme-set',settingsSelect.value);
        settingsStatus.textContent='已保存';
        for(const notify of subscribers)notify();
      } catch {settingsSelect.value=preference;settingsStatus.textContent='保存失败，请重试。';}
      finally{settingsSelect.disabled=false;themeButton.disabled=false;}
    });
    card.append(copy,settingsSelect,themeButton);root.append(style,card,themeMenu);parent.prepend(settingsHost);
    updateSettings();
  }
  function updateSettings() {
    if(!settingsHost)return;
    settingsSelect.value=preference;
    themeButton.textContent=settingsSelect.selectedOptions[0].textContent;
    for(const item of themeMenu.children)item.setAttribute('aria-selected',String(item.dataset.value===preference));
    const colors=isLight()?['#fff','#27313e','#506070','#c7d1db','#eef3f6','#e0efe3']:['#191919','#ddd','#aaa','#555','#303030','#24452e'];
    ['surface','text','muted','line','hover','selected'].forEach((key,i)=>settingsHost.style.setProperty('--'+key,colors[i]));
  }
  const allowed = /^(color|background|background-color|background-image|border|border-(top|right|bottom|left)|border.*color|outline-color|box-shadow|text-shadow|fill|stroke|caret-color|scrollbar-color|--.*)$/;
  function mapColor(r, g, b, foreground, role='surface') {
    if (Math.max(r,g,b) - Math.min(r,g,b) <= 12) {
      const v = (r+g+b)/3;
      // Deliberate surface/text tiers instead of an inverted grey ramp.
      if(role==='gradient')return [246,248,250];
      if(role==='shadow')return [39,49,62];
      if(role==='border')return [199,209,219];
      if(foreground) {
        if(v<65 || v>=190)return [39,49,62];
        if(v>=130)return [80,94,110];
        return [105,119,134];
      }
      if(v<10)return [250,251,252];
      if(v<27)return [255,255,255];
      if(v<50)return [242,245,248];
      if(v<85)return [231,237,243];
      if(v<140)return [216,226,235];
      return [199,213,224];
    }
    if (g > 145 && g > r*1.5 && g > b*1.5)
      return foreground ? [39,112,65] : [104,184,113];
    return [r,g,b];
  }
  function convert(value, foreground, role='surface') {
    // Do not touch URLs, image assets, or data URIs.
    return value.split(/(url\([^)]*\))/gi).map(part => /^url\(/i.test(part) ? part :
      part.replace(/#([\da-f]{8}|[\da-f]{6}|[\da-f]{4}|[\da-f]{3})\b|rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)|\b(white|black)\b/gi,
        (match,hex,r,g,b,a,named) => {
          if (hex) {
            if (hex.length <= 4) hex = [...hex].map(c=>c+c).join('');
            r=parseInt(hex.slice(0,2),16);g=parseInt(hex.slice(2,4),16);b=parseInt(hex.slice(4,6),16);
            if(hex.length===8)a=String(parseInt(hex.slice(6,8),16)/255);
          } else if(named) r=g=b=named.toLowerCase()==='white'?255:0;
          const rgb=mapColor(+r,+g,+b,foreground,role);
          return a===undefined ? `rgb(${rgb.join(',')})` : `rgba(${rgb.join(',')},${a})`;
        })).join('');
  }
  function convertProperty(prop,value) {
    const foreground=/^(color|fill|stroke|caret-color)$/.test(prop)||/text|foreground/i.test(prop);
    const role=/shadow/.test(prop)?'shadow':
      /border|outline/.test(prop)?'border':
      /background/.test(prop)&&/gradient\(/.test(value)?'gradient':'surface';
    return convert(value,foreground,role);
  }
  function declarations(style) {
    let result='';
    for (const prop of style) {
      if (!allowed.test(prop)) continue;
      const value=style.getPropertyValue(prop);
      const mapped=convertProperty(prop,value);
      if(mapped!==value) result+=`${prop}:${mapped} !important;`;
    }
    return result;
  }
  function rules(list) {
    let result='';
    for(const rule of list) {
      if(rule.selectorText && rule.style) {
        const body=declarations(rule.style);
        if(body) result+=`${rule.selectorText}{${body}}\n`;
      } else if(rule.cssRules && /^(CSSMediaRule|CSSSupportsRule|CSSLayerBlockRule)$/.test(rule.constructor.name)) {
        result+=rule.cssText.slice(0,rule.cssText.indexOf('{')+1)+rules(rule.cssRules)+'}\n';
      } else if(rule.styleSheet) {
        try { result+=rules(rule.styleSheet.cssRules); } catch {}
      }
    }
    return result;
  }
  // Shared geometry is independent of the light-only palette conversion.
  // Use observed Synapse surfaces, not every button/input: switches, sliders,
  // circular icons and the native window controls keep their original shapes.
  // Do not clip containers: anchored menus, tooltips and artwork can overflow.
  const geometry=`
    .body-widgets .widget,
    .widget-prod,
    .dot-bg,.dot-background,.dot-background--wireless {
      border-radius:12px !important;
    }
    .dot-bg .dim-corner,
    .dot-background .dim-corner,
    .dot-background--wireless .dim-corner,
    #multipleBrightness .custom-dim-corner {
      border-radius:12px !important;
    }
    .s3-modal--body,
    .modal-patch-notes .modal-content,
    .warning-backdrop .popup,
    .help-component .factory-reset-overlay__dialog {
      border-radius:16px !important;
    }
    .s3-dropdown,.s3-dropdown-with-dual-item,
    .widget .button,
    .warning-backdrop .razer-button,
    .help-component .factory-reset-overlay__button,
    .main-nav .search-wrapper .search-input,
    .search-bar .search-wrapper .search-input,
    input[name=profile] {
      border-radius:8px !important;
    }
    .dropdown-razer-2,.s3-options,.s3-options-with-dual-item {
      border-radius:10px !important;
    }
    .dropdown-razer-2 .dropdown-item,
    .dropdown-razer-2 .dropdown-item-2,
    .s3-options .options,.s3-options-with-dual-item .options {
      border-radius:6px !important;
    }
    .etabs-tab .btn-close {border-radius:4px !important;}
  `;
  let sheet, scheduled=false, counter=0;
  const frames=new WeakSet();
  function visitFrames() {
    for(const frame of document.querySelectorAll('iframe,frame')) {
      const enter=()=>{try{if(frame.contentDocument)install(frame.contentDocument);}catch{}};
      if(!frames.has(frame)){frames.add(frame);frame.addEventListener('load',enter);}
      enter();
    }
  }
  function marker(el) {
    if(!el.hasAttribute('data-local-razer-theme'))el.setAttribute('data-local-razer-theme',String(++counter));
    return `[data-local-razer-theme="${el.getAttribute('data-local-razer-theme')}"]`;
  }
  function refresh() {
    scheduled=false;
    visitFrames();
    mountSettings();updateSettings();
    if(!sheet || contrast.matches) { if(sheet)sheet.textContent=''; releaseBoot();return; }
    if(!isLight()) {sheet.textContent=geometry;releaseBoot();return;}
    let css=':root{color-scheme:light}html,body{background-color:#f2f5f8;color:#27313e}\n';
    let inaccessible=false;
    for(const source of document.styleSheets) {
      if(source.ownerNode===sheet||source.ownerNode===bootStyle)continue;
      try { css+=rules(source.cssRules); } catch { inaccessible=true; }
    }
    // CDN stylesheet rules can be opaque to CSSOM. Read the rendered colors,
    // without fetching the stylesheet or changing origin/security settings.
    if(inaccessible) {
      sheet.disabled=true;
      try {
        for(const el of document.querySelectorAll('*')) {
          if(el===settingsHost||/^(STYLE|SCRIPT|LINK|META|IMG|VIDEO|CANVAS|IFRAME)$/.test(el.tagName))continue;
          const computed=view.getComputedStyle(el);
          let body='';
          for(const prop of ['color','background-color','background-image','border-top-color','border-right-color','border-bottom-color','border-left-color','fill','stroke']) {
            const value=computed.getPropertyValue(prop);
            if(!value || value==='none' || /rgba\([^)]*,\s*0\)$/.test(value))continue;
            const mapped=convertProperty(prop,value);
            if(mapped!==value)body+=`${prop}:${mapped} !important;`;
          }
          if(body)css+=`${marker(el)}{${body}}\n`;
        }
      } finally {sheet.disabled=false;}
    }
    for(const el of document.querySelectorAll('[style]')) {
      if(el===settingsHost)continue;
      const body=declarations(el.style);
      if(!body)continue;
      css+=`${marker(el)}{${body}}\n`;
    }
    css+='.etab-minimize,.etab-restore,.etab-close,#scroll-left-btn,#scroll-right-btn{filter:brightness(.35)}\n';
    // Replace the dark bitmap/SVG button tile, rather than darkening its background.
    css+=`
      .etabs-tab .btn-close,
      .etabs-tab .btn-close:hover,
      .etabs-tab .btn-close:active {
        filter:none !important;
        color:#526171 !important;
        background-image:linear-gradient(45deg,transparent 44%,currentColor 45%,currentColor 55%,transparent 56%),linear-gradient(-45deg,transparent 44%,currentColor 45%,currentColor 55%,transparent 56%) !important;
        background-size:11px 11px !important;
        background-position:center !important;
        background-repeat:no-repeat !important;
        box-shadow:none !important;
      }
      .etabs-tab .btn-close { background-color:transparent !important; }
      .etabs-tab .btn-close:hover { background-color:#dce5ee !important;color:#27313e !important; }
      .etabs-tab .btn-close:active { background-color:#c8d5e2 !important;color:#202c38 !important; }
    `;
    // Shared preview surfaces across mouse, keyboard, dongle and lighting pages.
    // Product artwork stays untouched; only the dotted surface and shade layers change.
    css+=`
      .dot-bg,
      .dot-background,
      .dot-background--wireless,
      #multipleBrightness .dot-background {
        background:radial-gradient(circle,#cbd6df .8px,transparent 1px) 0 0 / 22px 22px,#edf2f6 !important;
        box-shadow:inset 0 0 0 1px #e1e8ee !important;
      }
      .dot-bg .dim-corner,
      .dot-background .dim-corner,
      .dot-background--wireless .dim-corner,
      #multipleBrightness .custom-dim-corner {
        background:transparent !important;
        box-shadow:none !important;
      }
    `;
    sheet.textContent=`@media (forced-colors:none){${css}\n${geometry}}`;
    if(document.readyState!=='loading'&&!document.querySelector('.rz-init-loader'))releaseBoot();
  }
  function schedule() {
    if(!scheduled) {scheduled=true;view.setTimeout(refresh,16);}
  }
  function start() {
    if(document.getElementById(styleId))return;
    sheet=document.createElement('style');sheet.id=styleId;
    (document.head||document.documentElement).appendChild(sheet);
    new view.MutationObserver(records=>{
      if(records.some(record=>record.target!==sheet && record.target!==bootStyle && record.target!==settingsHost && !sheet.contains(record.target)))schedule();
    }).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['style','href','class']});
    document.addEventListener('load',schedule,true);
    subscribers.add(refresh);
    light.addEventListener('change',refresh);
    contrast.addEventListener('change',refresh);
    refresh();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
  }
  install(document);
})();

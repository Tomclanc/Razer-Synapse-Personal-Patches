(() => {
  'use strict';
  const menu = document.getElementById('menu');
  window.localTray.onModel(model => {
    const previous = document.activeElement?.dataset.index;
    document.documentElement.classList.toggle('dark', model.dark);
    menu.replaceChildren();
    for (const item of model.items) {
      if (item.separator) {menu.appendChild(document.createElement('hr')); continue;}
      const button = document.createElement('button');
      button.type = 'button'; button.setAttribute('role', 'menuitem');
      button.disabled = !item.enabled; button.dataset.index = item.index;
      const icon = document.createElement(item.icon ? 'img' : 'span'); icon.className = 'icon';
      if (item.icon) {icon.src = item.icon; icon.alt = '';}
      // Native settings/account assets are monochrome; keep colored app logos intact.
      if (item.icon && /^(设置|設定|Settings|登录|登入|登出|注销|Log\s?(in|out)|Sign\s?(in|out))$/i.test(item.label)) icon.classList.add('mono');
      const label = document.createElement('span'); label.className = 'label'; label.textContent = item.label;
      button.append(icon, label); button.title = item.label;
      button.addEventListener('click', () => window.localTray.activate(item.index));
      menu.appendChild(button);
    }
    const buttons = [...menu.querySelectorAll('button:not(:disabled)')];
    (buttons.find(button => button.dataset.index === previous) || buttons[0])?.focus();
  });
  document.addEventListener('keydown', event => {
    const buttons = [...menu.querySelectorAll('button:not(:disabled)')];
    const index = buttons.indexOf(document.activeElement);
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) && buttons.length) {
      event.preventDefault();
      buttons[event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 :
        (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length].focus();
    } else if (event.key === 'Escape' || event.key === 'Tab') {event.preventDefault(); window.localTray.dismiss();}
  });
})();

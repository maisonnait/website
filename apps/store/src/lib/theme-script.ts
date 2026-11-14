/** Shared by the server (inline script in <head>) and the browser (theme toggle). */
export const MODE_KEY = 'nait-mode';
export const THEME_COLOR = { light: '#FFFFFF', dark: '#080B1F' } as const;

/** Runs in <head> before the first paint, so a saved dark theme never flashes white. */
export const MODE_SCRIPT = `try{if(localStorage.getItem('${MODE_KEY}')==='dark'){document.documentElement.setAttribute('data-mode','dark');var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content','${THEME_COLOR.dark}')}}catch(e){}`;

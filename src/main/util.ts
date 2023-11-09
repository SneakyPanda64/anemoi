/* eslint import/prefer-default-export: off */
import { URL } from 'url'
import path from 'path'
import { BrowserView, BrowserWindow } from 'electron'

// export function resolveHtmlPath(htmlFileName: string) {
//   if (process.env.NODE_ENV === 'development') {
//     const port = process.env.PORT || 1212;
//     const url = new URL(`http://localhost:${port}`);
//     url.pathname = htmlFileName;
//     return url.href;
//   }
//   return `file://${path.resolve(__dirname, '../renderer/', htmlFileName)}`;
// }

export async function getFavicon(browserView: BrowserView) {
  if (!(browserView instanceof BrowserView)) {
    throw new Error('Invalid argument. Expected a BrowserView instance.')
  }

  return await browserView.webContents.executeJavaScript(
    `
    (function() {
      console.log("attemp");
      const favicon = document.querySelector('link[rel="icon"]');
      if (favicon) {
        return favicon.href;
      } else {
        return null;
      }
    })();
  `,
    true
  )
}

export function findViewById(win: BrowserWindow, id: number): BrowserView | null {
  let found: BrowserView | boolean = false
  win.getBrowserViews().forEach((elem) => {
    if (elem.webContents.id == id) {
      console.log('compare: ', elem.webContents.id, id)
      found = elem
    }
  })
  if (found == false) {
    console.log(id, 'not found')
    return null
  }
  console.log(id, 'found')
  return found
}
